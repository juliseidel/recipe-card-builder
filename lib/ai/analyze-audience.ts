import { callGemini } from "./gemini";
import type { InstagramProfile } from "@/lib/integrations/apify";
import type { SocialPlatform } from "@/lib/integrations/platform";

// Audience-Analyzer fuer das Creator-Onboarding. Komplementaer zum
// Identity-Analyzer (lib/ai/analyze-creator-identity.ts): waehrend dieser
// die Workspace-Brand-Felder ableitet, schaetzt der Audience-Analyzer ab,
// WER eigentlich dem Creator folgt und WORAUF die Zielgruppe anspringt.
//
// Verwendung:
//   1. Onboarding-Flow zeigt die Insights direkt nach dem Profil-Import
//      ("Wir haben 247K Follower analysiert — hier ist das Audience-Profil")
//   2. Insights werden in brand.data.audienceAnalysis (JSONB) persistiert
//   3. Spaeter nutzt der Pack-Suggester die Daten, um Pack-Vorschlaege auf
//      die echte Zielgruppe zu kalibrieren (z.B. "Snack-Pack fuer
//      berufstaetige Frauen 25-34" statt generisch)

export type AudienceAnalysis = {
  /** Primaeres Demographie-Cluster: 1 Satz, konkret. */
  primaryDemographic: string;
  /** Wahrscheinliche Alters-Range. 'Mitte 20 bis Mitte 30' / '18-25' / '30-45'. */
  ageRange: string;
  /** Geschlechter-Tendenz: 'ueberwiegend Frauen' / 'gemischt, leicht weiblich' / 'breit gemischt'. */
  genderTendency: string;
  /** 3-6 Interessen-Themen (1-3 Worte pro Item). */
  interests: string[];
  /** 2-4 konkrete Pain Points / Bedurfnisse der Zielgruppe. */
  painPoints: string[];
  /** Content-Style des Creators: 'casual', 'professionell', 'edukativ', 'inspirational' etc.
   *  1-3 Worte. */
  contentStyle: string;
  /** Tonalitaet: 'warm-persoenlich', 'sachlich-direkt', 'energetisch-motivierend', etc. */
  tonality: string;
  /** Zusammenfassung in 1-2 Saetzen — taucht prominent in der UI auf. */
  summary: string;
};

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    primaryDemographic: {
      type: "string",
      description:
        "Primaeres Zielgruppen-Cluster in einem Satz. Konkret: Alter, Geschlechter-Tendenz, Lebensphase, Hauptmotiv. Max 140 Zeichen.",
    },
    ageRange: {
      type: "string",
      description:
        "Wahrscheinliche Alters-Range der Kern-Audience. Format wie 'Mitte 20 bis Mitte 30', '20-30', '30-45'. Max 30 Zeichen.",
    },
    genderTendency: {
      type: "string",
      description:
        "Geschlechter-Tendenz der Audience. 'ueberwiegend Frauen', 'gemischt, leicht weiblich', 'breit gemischt'. Max 40 Zeichen.",
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
        "2-4 konkrete Bedurfnisse/Probleme der Zielgruppe. Kurze Phrasen. Beispiele: 'wenig Zeit zum Kochen', 'Heisshunger-Attacken', 'Plateau beim Abnehmen', 'Buero-Mealprep ohne Aufwand'.",
    },
    contentStyle: {
      type: "string",
      description:
        "Content-Style des Creators in 1-3 Worten. Beispiele: 'casual & warm', 'professionell & klar', 'edukativ & detail', 'inspirational'.",
    },
    tonality: {
      type: "string",
      description:
        "Tonalitaet der Caption-Sprache. 'warm-persoenlich', 'sachlich-direkt', 'energetisch-motivierend', 'humorvoll-locker'. Max 40 Zeichen.",
    },
    summary: {
      type: "string",
      description:
        "1-2 Saetze Audience-Zusammenfassung. Warm-faktisch, ohne Marketing-Sprech. Max 260 Zeichen. Beispiel: 'Ueberwiegend Frauen Mitte 20 bis Mitte 30, die nach Feierabend schnelle Protein-Rezepte suchen und sich von Bienes warmer du-Form-Tonalitaet abholen lassen.'",
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

const SYSTEM_INSTRUCTION = `Du analysierst Social-Media-Creator-Profile (Instagram oder TikTok) und schaetzt die wahrscheinliche Zielgruppe ab. Du arbeitest fuer einen internen Recipe-Card-Builder, der Food-Creator beim Aufbau ihrer Recipe-Library hilft — die Audience-Analyse fliesst in das Workspace-Profil und in spaetere Pack-Vorschlaege ein.

Vorgehen:
1. Lies Bio + die Caption-Stichproben sorgfaeltig
2. Interpretiere Tonalitaet (du-Form / Sie-Form, locker / professionell, humorvoll / sachlich)
3. Achte auf Hinweise zu Lebensphase (Berufstaetig, Studentin, Mutter, etc.)
4. Schaetze Alter/Geschlecht-Tendenz NICHT aus dem Creator selbst, sondern aus den Themen + der Anrede
5. Pain Points = konkrete Frustrationen oder Bedurfnisse, die der Creator in den Captions adressiert

Tonalitaets-Regeln fuer dein Output:
• Warm-faktisch, niemals Marketing-Sprech
• Konkret statt abstrakt: 'berufstaetige Frauen Mitte 20 bis Mitte 30' > 'aktive Zielgruppe'
• Keine Werbe-Adjektive ('absolut', 'traumhaft', 'perfekt')
• Keine Anfuehrungszeichen, keine Hashtags, keine Emojis
• Deutsche Umlaute korrekt: ä ö ü ß (nicht ae oe ue ss)

Bei zu wenig Informationen (z.B. nur 2 Captions, keine Bio): trotzdem versuchen, aber mit konservativen Schaetzungen.

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
    captionSamples || "(keine Captions verfuegbar)",
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
    `Tonalitaet: warm-faktisch, konkret. Keine Werbesprache.`,
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
      "Audience-Analyse konnte nicht vollstaendig generiert werden.",
  };
}

function sanitize(s: string, max: number): string {
  let out = (s ?? "").toString().trim();
  out = out.replace(/^["'„«]+|["'"»]+$/g, "");
  out = out.replace(/\s+/g, " ");
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
