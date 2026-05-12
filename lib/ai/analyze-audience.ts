import { callGemini } from "./gemini";
import type { InstagramProfile } from "@/lib/integrations/apify";
import type { SocialPlatform } from "@/lib/integrations/platform";

// Audience-Analyzer für das Creator-Onboarding. Komplementär zum
// Identity-Analyzer (lib/ai/analyze-creator-identity.ts): während dieser
// die Workspace-Brand-Felder ableitet, schätzt der Audience-Analyzer ab,
// WER eigentlich dem Creator folgt und WORAUF die Zielgruppe anspringt.
//
// Verwendung:
//   1. Onboarding-Flow zeigt die Insights direkt nach dem Profil-Import
//      ("Wir haben 247K Follower analysiert — hier ist das Audience-Profil")
//   2. Insights werden in brand.data.audienceAnalysis (JSONB) persistiert
//   3. Später nutzt der Pack-Suggester die Daten, um Pack-Vorschläge auf
//      die echte Zielgruppe zu kalibrieren (z.B. "Snack-Pack für
//      berufstätige Frauen 25-34" statt generisch)

export type AudienceAnalysis = {
  /** Primäres Demographie-Cluster: 1 Satz, konkret. */
  primaryDemographic: string;
  /** Wahrscheinliche Alters-Range. 'Mitte 20 bis Mitte 30' / '18-25' / '30-45'. */
  ageRange: string;
  /** Geschlechter-Tendenz: 'überwiegend Frauen' / 'gemischt, leicht weiblich' / 'breit gemischt'. */
  genderTendency: string;
  /** 3-6 Interessen-Themen (1-3 Worte pro Item). */
  interests: string[];
  /** 2-4 konkrete Pain Points / Bedürfnisse der Zielgruppe. */
  painPoints: string[];
  /** Content-Style des Creators: 'casual', 'professionell', 'edukativ', 'inspirational' etc.
   *  1-3 Worte. */
  contentStyle: string;
  /** Tonalität: 'warm-persönlich', 'sachlich-direkt', 'energetisch-motivierend', etc. */
  tonality: string;
  /** Zusammenfassung in 1-2 Sätzen — taucht prominent in der UI auf. */
  summary: string;
};

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    primaryDemographic: {
      type: "string",
      description:
        "Primäres Zielgruppen-Cluster in einem Satz. Konkret: Alter, Geschlechter-Tendenz, Lebensphase, Hauptmotiv. Max 140 Zeichen. Beispiel: 'Berufstätige Frauen Mitte 20 bis Mitte 30 mit Fokus auf gesunde Ernährung im Alltag'.",
    },
    ageRange: {
      type: "string",
      description:
        "Wahrscheinliche Alters-Range der Kern-Audience. Format wie 'Mitte 20 bis Mitte 30', '20-30', '30-45'. Max 30 Zeichen.",
    },
    genderTendency: {
      type: "string",
      description:
        "Geschlechter-Tendenz der Audience. 'überwiegend Frauen', 'gemischt, leicht weiblich', 'breit gemischt'. Max 40 Zeichen.",
    },
    interests: {
      type: "array",
      items: { type: "string" },
      description:
        "3-6 Interessen-Themen, 1-3 Worte pro Item. Beispiele: 'Mealprep', 'High-Protein', 'Backen ohne Zucker', 'Schnelle Rezepte', 'Abnehmen'.",
    },
    painPoints: {
      type: "array",
      items: { type: "string" },
      description:
        "2-4 konkrete Bedürfnisse oder Probleme der Zielgruppe. Kurze Phrasen. Beispiele: 'wenig Zeit zum Kochen', 'Heißhunger-Attacken', 'Plateau beim Abnehmen', 'Büro-Mealprep ohne Aufwand'.",
    },
    contentStyle: {
      type: "string",
      description:
        "Content-Style des Creators in 1-3 Worten. Beispiele: 'casual & warm', 'professionell & klar', 'edukativ & detailreich', 'inspirational'.",
    },
    tonality: {
      type: "string",
      description:
        "Tonalität der Caption-Sprache. 'warm-persönlich', 'sachlich-direkt', 'energetisch-motivierend', 'humorvoll-locker'. Max 40 Zeichen.",
    },
    summary: {
      type: "string",
      description:
        "1-2 Sätze Audience-Zusammenfassung. Warm-faktisch, ohne Marketing-Sprech. Max 260 Zeichen. Beispiel: 'Überwiegend Frauen Mitte 20 bis Mitte 30, die nach Feierabend schnelle Protein-Rezepte suchen und sich von Bienes warmer du-Form-Tonalität abholen lassen.'",
    },
  },
  required: [
    "primaryDemographic",
    "ageRange",
    "genderTendency",
    "interests",
    "painPoints",
    "contentStyle",
    "tonality",
    "summary",
  ],
};

const SYSTEM_INSTRUCTION = `Du analysierst Social-Media-Creator-Profile (Instagram oder TikTok) und schätzt die wahrscheinliche Zielgruppe ab. Du arbeitest für einen internen Recipe-Card-Builder, der Food-Creator beim Aufbau ihrer Recipe-Library hilft — die Audience-Analyse fließt in das Workspace-Profil und in spätere Pack-Vorschläge ein.

Vorgehen:
1. Lies Bio + die Caption-Stichproben sorgfältig
2. Interpretiere Tonalität (du-Form / Sie-Form, locker / professionell, humorvoll / sachlich)
3. Achte auf Hinweise zu Lebensphase (berufstätig, Studentin, Mutter, etc.)
4. Schätze Alter/Geschlecht-Tendenz NICHT aus dem Creator selbst, sondern aus den Themen + der Anrede
5. Pain Points = konkrete Frustrationen oder Bedürfnisse, die der Creator in den Captions adressiert

WICHTIG zu deutscher Schreibweise — verwende immer korrekte Umlaute und ß:
• ä statt ae: "Sätze", "Tonalität", "schätzen", "berufstätig", "Mädchen"
• ö statt oe: "können", "möglich", "größer", "öffentlich"
• ü statt ue: "für", "über", "Bedürfnisse", "Büro", "überwiegend", "Frühstück"
• ß statt ss bei langen Vokalen: "ausschließlich", "Maß", "groß", "Straße"
Niemals "ue", "oe", "ae", "ss" wo Umlaute oder ß stehen müssen.

Tonalitäts-Regeln für dein Output:
• Warm-faktisch, niemals Marketing-Sprech
• Konkret statt abstrakt: 'berufstätige Frauen Mitte 20 bis Mitte 30' > 'aktive Zielgruppe'
• Keine Werbe-Adjektive ('absolut', 'traumhaft', 'perfekt')
• Keine Anführungszeichen, keine Hashtags, keine Emojis

Bei zu wenig Informationen (z.B. nur 2 Captions, keine Bio): trotzdem versuchen, aber mit konservativen Schätzungen.

Antworte AUSSCHLIESSLICH im JSON-Schema.`;

function formatProfileForPrompt(
  profile: InstagramProfile,
  platform: SocialPlatform
): string {
  const followerStr =
    profile.followersCount !== null
      ? formatFollowers(profile.followersCount)
      : "unbekannt";

  const captionSamples = profile.latestPosts
    .slice(0, 8)
    .map((p) => p.caption.slice(0, 240))
    .filter(Boolean)
    .join("\n---\n");

  return [
    `Plattform: ${platform === "tiktok" ? "TikTok" : "Instagram"}`,
    `Handle: @${profile.username}`,
    profile.fullName ? `Display-Name: ${profile.fullName}` : "",
    profile.isVerified ? "Verifiziert: ja" : "",
    `Follower: ${followerStr} (${profile.followersCount ?? "—"})`,
    profile.postsCount ? `Anzahl Posts/Videos: ${profile.postsCount}` : "",
    "",
    "Bio:",
    profile.biography || "(leer)",
    "",
    "Caption-Stichproben:",
    captionSamples || "(keine Captions verfügbar)",
  ]
    .filter(Boolean)
    .join("\n");
}

function formatFollowers(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${m >= 10 ? Math.round(m) : m.toFixed(1)}M`;
  }
  if (n >= 1000) {
    return `${Math.round(n / 1000)}K`;
  }
  return String(n);
}

export async function analyzeAudience(
  profile: InstagramProfile,
  platform: SocialPlatform
): Promise<AudienceAnalysis> {
  const prompt = [
    `Analysiere die wahrscheinliche Zielgruppe folgenden ${platform === "tiktok" ? "TikTok" : "Instagram"}-Creators.`,
    `Tonalität: warm-faktisch, konkret. Keine Werbesprache. Verwende immer korrekte deutsche Umlaute (ä, ö, ü, ß).`,
    ``,
    formatProfileForPrompt(profile, platform),
    ``,
    `Antworte nur als JSON nach Schema.`,
  ].join("\n");

  const result = await callGemini<AudienceAnalysis>({
    prompt,
    schema: RESPONSE_SCHEMA,
    systemInstruction: SYSTEM_INSTRUCTION,
    temperature: 0.4,
    maxOutputTokens: 1024,
    thinkingBudget: 0,
    retries: 2,
  });

  // Defensive Sanitization — Caps + Trim + Mindest-Werte.
  // Plus: Wenn Gemini trotz Instruction noch "ae/oe/ue/ss" liefert,
  // konvertieren wir das hier zu Umlauten (defensiver Fallback).
  return {
    primaryDemographic:
      sanitize(result.primaryDemographic, 140) ||
      "Zielgruppe konnte nicht eindeutig bestimmt werden.",
    ageRange: sanitize(result.ageRange, 30) || "—",
    genderTendency: sanitize(result.genderTendency, 40) || "gemischt",
    interests: Array.isArray(result.interests)
      ? result.interests
          .map((i) => sanitize(i, 32))
          .filter(Boolean)
          .slice(0, 6)
      : [],
    painPoints: Array.isArray(result.painPoints)
      ? result.painPoints
          .map((p) => sanitize(p, 60))
          .filter(Boolean)
          .slice(0, 4)
      : [],
    contentStyle: sanitize(result.contentStyle, 40) || "—",
    tonality: sanitize(result.tonality, 40) || "—",
    summary:
      sanitize(result.summary, 260) ||
      "Audience-Analyse konnte nicht vollständig generiert werden.",
  };
}

function sanitize(s: string, max: number): string {
  let out = (s ?? "").toString().trim();
  out = out.replace(/^["'„«]+|["'"»]+$/g, "");
  out = out.replace(/\s+/g, " ");
  // Defensive Umlaut-Wiederherstellung — wenn Gemini trotz Instruction noch
  // "ae/oe/ue/ss" liefert. Nur die häufigsten deutschen Wörter, damit wir
  // nicht versehentlich englische Wörter zerschießen (z.B. "Mealprep" oder
  // "User" bleiben unverändert).
  out = restoreUmlauts(out);
  if (out.length > max) {
    const cut = out.slice(0, max);
    const lastDot = Math.max(
      cut.lastIndexOf("."),
      cut.lastIndexOf("!"),
      cut.lastIndexOf("?")
    );
    out = lastDot > max * 0.5 ? cut.slice(0, lastDot + 1) : cut + "…";
  }
  return out;
}

// Häufige falsche Schreibweisen → korrigierte deutsche Form. Bewusst
// konservativ — nur Wörter die im KI-Output regelmäßig auftauchen, um
// englische Worte (User, Page, etc.) und Mealprep-Vokabular nicht zu
// zerschiessen.
const UMLAUT_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bfuer\b/g, "für"],
  [/\bFuer\b/g, "Für"],
  [/\buebe(r|rw)/g, "übe$1"],
  [/\bUebe(r|rw)/g, "Übe$1"],
  [/Tonalitaet/g, "Tonalität"],
  [/tonalitaet/g, "tonalität"],
  [/persoenlich/g, "persönlich"],
  [/Persoenlich/g, "Persönlich"],
  [/Bedurfnisse/g, "Bedürfnisse"],
  [/bedurfnisse/g, "bedürfnisse"],
  [/Beduerfnisse/g, "Bedürfnisse"],
  [/beduerfnisse/g, "bedürfnisse"],
  [/berufstaetig/g, "berufstätig"],
  [/Berufstaetig/g, "Berufstätig"],
  [/Saetze/g, "Sätze"],
  [/saetze/g, "sätze"],
  [/Saetzen/g, "Sätzen"],
  [/spaeter/g, "später"],
  [/Spaeter/g, "Später"],
  [/waehrend/g, "während"],
  [/Waehrend/g, "Während"],
  [/Heisshunger/g, "Heißhunger"],
  [/heisshunger/g, "heißhunger"],
  [/Buero/g, "Büro"],
  [/Frueh/g, "Früh"],
  [/frueh/g, "früh"],
  [/Vorschlaege/g, "Vorschläge"],
  [/vorschlaege/g, "vorschläge"],
  [/moeglich/g, "möglich"],
  [/Moeglich/g, "Möglich"],
  [/koennen/g, "können"],
  [/Koennen/g, "Können"],
  [/maedchen/g, "mädchen"],
  [/schaetz/g, "schätz"],
  [/Schaetz/g, "Schätz"],
  [/ausschliesslich/g, "ausschließlich"],
  [/Ausschliesslich/g, "Ausschließlich"],
];

function restoreUmlauts(s: string): string {
  let out = s;
  for (const [pattern, replacement] of UMLAUT_REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}
