import { callGemini } from "./gemini";
import type { InstagramProfile } from "@/lib/integrations/apify";

// Identity-Analyzer fuer das Creator-Onboarding. Bekommt das gescrapete
// Profil (Bio, Stats, letzte Posts) und leitet daraus die Brand-Felder
// ab, die in der Hub-Card + im Workspace-Hero auftauchen.
//
// Gemini-Job:
//   - Display-Name: kurzer Workspace-Anker (oft Vorname)
//   - Voller Name: real name aus dem Profil
//   - Bio: 2–3 Saetze IM STIL DES CREATORS — Tonalitaet aus den eigenen
//     Captions abgeleitet (warm/sachlich/lakonisch/etc.), nicht generisch
//   - Tagline: ein Satz, headlinig
//   - Niche: Stil "Fitness · Food · 280K Instagram"
//   - Signature: "Deine [Name]" / "Dein [Name]"
//
// Brand-agnostisch: Gemini liest die echten Captions des Creators und
// uebernimmt die tatsaechliche Stimme — kein Default auf "warm du-Form".

export type CreatorIdentity = {
  name: string;
  fullName: string;
  bio: string;
  tagline: string;
  niche: string;
  signature: string;
  /** Geschlecht des Creators. Wird beim Onboarding aus Vorname + Bio +
   *  Captions abgeleitet. Steuert die grammatikalisch korrekte Anrede
   *  ('Dein Martin' vs 'Deine Julia') wenn die signature dem Standard-
   *  Pattern folgt. 'neutral' fuer Marken-Accounts (z.B. 'Bienesfitlife'). */
  gender: "male" | "female" | "neutral";
};

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    name: {
      type: "string",
      description:
        "Kurzer Workspace-Anker, oft Vorname oder Marken-Kuerzel. Beispiele: 'Biene', 'Lina', 'Sarah'. Max 25 Zeichen.",
    },
    fullName: {
      type: "string",
      description:
        "Vollstaendiger Name laut Instagram-Profil oder Bio. Wenn nicht klar erkennbar: Display-Name uebernehmen.",
    },
    bio: {
      type: "string",
      description:
        "2-3 Sätze deutsche Beschreibung des Creators im warmen, du-Form-nahen Ton. Keine Hashtag-Salven, keine Affiliate-Codes, keine Anführungszeichen. Beschreibt Nische + Persönlichkeit. Verwende korrekte deutsche Umlaute (ä, ö, ü, ß). Max 240 Zeichen.",
    },
    tagline: {
      type: "string",
      description:
        "Ein Satz Headline für die Hub-Card. Kurz, konkret, sinnlich. Max 80 Zeichen. Beispiele: 'Abnehmen ohne Verzicht', 'Mealprep für Berufstätige', 'Vegane Backwerke ohne Mehl'.",
    },
    niche: {
      type: "string",
      description:
        "Im 'Fitness · Food · 280K Instagram'-Stil. Bullet-Stil mit '·' getrennt. 2-4 Items: Hauptbereich, Sub-Bereich, Reichweite (Follower abgerundet wie '280K', '1.2M'). Max 80 Zeichen.",
    },
    gender: {
      type: "string",
      enum: ["male", "female", "neutral"],
      description:
        "Geschlecht des Creators basierend auf Vorname + Bio + Pronomen in den Captions. 'male' = männlich (z.B. Martin, Lukas, Thomas), 'female' = weiblich (z.B. Julia, Lara, Sarah), 'neutral' = Marken-/Unisex-Account ohne klare Person (z.B. 'Bienesfitlife', 'Healthy Kitchen Co.'). KRITISCH: Dieses Feld steuert die grammatikalische Anrede im Druck-PDF ('Dein Martin' vs 'Deine Julia') — bei Unsicherheit konservativ 'neutral' wählen.",
    },
    signature: {
      type: "string",
      description:
        "Sign-off im Workspace-Footer / am Ende des Pack-PDFs. Soll zum Voice-Profil des Creators passen — NICHT zwingend 'Dein/Deine [Name]'. Erlaubte Varianten: 'Dein Martin' (klassisch maennlich), 'Deine Julia' (klassisch weiblich), 'Bis bald, Lukas', 'Cheers, Sarah', 'Eure Sophie' (informeller Plural), 'Hab dich lieb, deine Mia' (sehr warm), oder einfach nur der Name wenn der Creator lakonisch schreibt. Max 30 Zeichen. Bei Unsicherheit: 'Dein [Name]' (gender=male) oder 'Deine [Name]' (gender=female) oder einfach 'Bis bald, [Name]' (gender=neutral).",
    },
  },
  required: ["name", "fullName", "bio", "tagline", "niche", "gender", "signature"],
};

const SYSTEM_INSTRUCTION = `Du analysierst Social-Media-Profile (Instagram oder TikTok) von Food-/Fitness-/Recipe-Creators und leitest daraus die Identität ihres Workspaces in unserem internen Recipe-Card-Builder-Tool ab.

Tonalität für Bio + Tagline + Signature:
• Du orientierst dich AM STIL DES CREATORS aus den gelieferten Caption-Auszügen — nicht an einem Standard-Schema.
• Wenn der Creator warm/persönlich schreibt → Bio in dem Ton. Wenn sachlich/knapp → in dem Ton. Wenn englisch → englische Bio. Wenn lakonisch-direkt → so übernehmen.
• Beziehe dich auf die KONKRETEN Themen des Profils (z.B. "Mealprep", "Backen ohne Zucker", "vegane Bowls") — nicht auf generische Food-Schlagworte.
• KEINE Werbesprache ("absolut traumhaft", "perfekt für jeden Anlass", "die besten")
• KEINE Hashtags, KEINE Emojis, KEINE Anführungszeichen
• Sinnlich-konkret statt abstrakt

WICHTIG zu deutscher Schreibweise — verwende immer korrekte Umlaute und ß:
• ä statt ae: "Sätze", "Tonalität", "tätig", "Mädchen", "spät"
• ö statt oe: "können", "möglich", "größer", "öffentlich"
• ü statt ue: "für", "über", "Bedürfnisse", "Frühstück"
• ß statt ss bei langen Vokalen: "ausschließlich", "Maß", "groß", "Straße"
Niemals "ue", "oe", "ae", "ss" wo Umlaute oder ß stehen müssen.

Display-Name-Regel:
• Wenn der Profil-fullName ein Vorname + Nachname ist, nimm den Vornamen als Display-Name ('Lina Müller' → name: 'Lina')
• Wenn der Account ein Marken-Account ist (z.B. 'Bienesfitlife'), wandle in eine knackige Form um ('Bienesfitlife' → 'Biene' wenn die Bio-Sprache das suggeriert)
• Bei Unsicherheit: Username ohne Suffix-Endungen übernehmen

Follower-Format für Niche-Feld:
• 819000 → '819K'
• 1200000 → '1.2M'
• 95000 → '95K'

Niche-Bullet-Format:
• 'Fitness · Food · MORE Nutrition · 819K Instagram'
• 'Vegan · Backen · 230K Instagram'
• Hauptbereich zuerst, Reichweite zuletzt

Antworte AUSSCHLIESSLICH im JSON-Schema, ohne Erklärung.`;

function formatProfileForPrompt(profile: InstagramProfile): string {
  const followerStr =
    profile.followersCount !== null
      ? formatFollowers(profile.followersCount)
      : "unbekannt";

  // Auszug aus den letzten Captions als zusaetzliches Tonalitaets-Signal.
  // Wir nehmen die ersten 200 Zeichen jeder Caption — Genug, um den Stil
  // einzufangen, ohne Tokens zu verschwenden.
  const captionSamples = profile.latestPosts
    .slice(0, 6)
    .map((p) => p.caption.slice(0, 200))
    .filter(Boolean)
    .join("\n---\n");

  return [
    `Instagram-Handle: @${profile.username}`,
    profile.fullName ? `Display-Name: ${profile.fullName}` : "",
    profile.isVerified ? "Verifiziert: ja" : "",
    `Follower: ${followerStr} (${profile.followersCount ?? "—"})`,
    profile.postsCount ? `Posts: ${profile.postsCount}` : "",
    "",
    "Instagram-Bio:",
    profile.biography || "(leer)",
    "",
    "Caption-Auszuege der letzten Posts (Tonalitaets-Signal):",
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

export async function analyzeCreatorIdentity(
  profile: InstagramProfile
): Promise<CreatorIdentity> {
  const prompt = [
    `Analysiere folgenden Creator und leite die Workspace-Identität ab.`,
    `Tonalität bei bio/tagline/signature: warm, du-Form, persönlich — wie ein guter Freund den Creator beschreibt.`,
    `Verwende immer korrekte deutsche Umlaute (ä, ö, ü, ß).`,
    ``,
    formatProfileForPrompt(profile),
    ``,
    `Antworte nur als JSON nach Schema.`,
  ].join("\n");

  const result = await callGemini<CreatorIdentity>({
    prompt,
    schema: RESPONSE_SCHEMA,
    systemInstruction: SYSTEM_INSTRUCTION,
    // Mittlere Temp — Identitaet braucht Voice, aber nicht Halluzination
    temperature: 0.6,
    maxOutputTokens: 1024,
    thinkingBudget: 0,
    retries: 2,
  });

  // Defensive sanitization — strip stray quotes, collapse whitespace, cap
  // length pro Feld. Schema-Limits sind Empfehlungen, nicht hart enforced.
  const cleanName = sanitize(result.name, 25) || "Creator";
  // Gender-Fallback: wenn Gemini den Wert nicht liefert oder ungueltigen
  // String returnt, faellt 'neutral' als sicherer Default ein — die
  // signature kompiliert dann mit dem name ohne grammatikalisches Risiko.
  const validGenders = new Set(["male", "female", "neutral"]);
  const gender = (validGenders.has(result.gender)
    ? result.gender
    : "neutral") as "male" | "female" | "neutral";
  // Signature-Fallback: wenn Gemini nichts liefert oder Standard-Pattern
  // gewuenscht ist, bauen wir die Anrede aus gender + name. So ist
  // 'Dein Martin' bei male, 'Deine Julia' bei female, neutraler Sign-off
  // bei neutral (z.B. Marken-Accounts).
  const fallbackSignature =
    gender === "male"
      ? `Dein ${cleanName}`
      : gender === "female"
        ? `Deine ${cleanName}`
        : `Bis bald, ${cleanName}`;
  return {
    name: cleanName,
    fullName: sanitize(result.fullName, 60) || sanitize(result.name, 60) || "Creator",
    bio: sanitize(result.bio, 240) || "Creator-Workspace im Recipe Card Builder.",
    tagline: sanitize(result.tagline, 80) || "Eigener Workspace",
    niche: sanitize(result.niche, 80) || "Food · Recipes",
    gender,
    signature: sanitize(result.signature, 30) || fallbackSignature,
  };
}

function sanitize(s: string, max: number): string {
  let out = (s ?? "").trim();
  out = out.replace(/^["'„«]+|["'"»]+$/g, "");
  out = out.replace(/\s+/g, " ");
  // Defensive Umlaut-Wiederherstellung — wenn Gemini trotz System-Instruction
  // noch "ae/oe/ue/ss"-Schreibweisen liefert, korrigieren wir die häufigsten
  // Patterns. Konservativ: nur typische deutsche Wörter, damit englische
  // Begriffe (Mealprep, User, etc.) unangetastet bleiben.
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

const UMLAUT_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bfuer\b/g, "für"],
  [/\bFuer\b/g, "Für"],
  [/Tonalitaet/g, "Tonalität"],
  [/persoenlich/g, "persönlich"],
  [/Persoenlich/g, "Persönlich"],
  [/berufstaetig/g, "berufstätig"],
  [/Berufstaetig/g, "Berufstätig"],
  [/Saetze/g, "Sätze"],
  [/Naehe\b/g, "Nähe"],
  [/Erklaerung/g, "Erklärung"],
  [/ueber(\w)/g, "über$1"],
  [/Ueber(\w)/g, "Über$1"],
  [/Persoenlichkeit/g, "Persönlichkeit"],
  [/Nische\b/g, "Nische"],
  [/Anfuehrungszeichen/g, "Anführungszeichen"],
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
