import { callGemini } from "./gemini";
import type { InstagramProfile } from "@/lib/integrations/apify";

// Identity-Analyzer fuer das Creator-Onboarding. Bekommt das gescrapete
// Instagram-Profil (Bio, Stats, letzte Posts) und leitet daraus die
// Brand-Felder ab, die in der Hub-Card + im Workspace-Hero auftauchen.
//
// Gemini-Job:
//   - Display-Name: kurzer Workspace-Anker (oft Vorname, "Bienes", "Lina")
//   - Voller Name: real name aus dem Profil
//   - Bio: 2–3 Saetze deutsch, warmer Creator-Tonalitaet (du-Form, sinnlich-
//     konkret) — keine Hashtag-Salat-Direktuebernahme der Instagram-Bio
//   - Tagline: ein Satz, headlinig
//   - Niche: "Fitness · Food · 280K Instagram" Stil
//   - Signature: "Deine [Name]" / "Dein [Name]"
//
// Tonalitaet wird so vorgegeben, dass sich der neue Workspace anfuehlt
// wie Bienes (warm, du-Form, persoenlich) — saubere Konsistenz im Tool.

export type CreatorIdentity = {
  name: string;
  fullName: string;
  bio: string;
  tagline: string;
  niche: string;
  signature: string;
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
        "2-3 Saetze deutsche Beschreibung des Creators im warmen, du-Form-naheen Ton. Keine Hashtag-Salven, keine Affiliate-Codes, keine Anfuehrungszeichen. Beschreibt Nische + Persoenlichkeit. Max 240 Zeichen.",
    },
    tagline: {
      type: "string",
      description:
        "Ein Satz Headline fuer die Hub-Card. Kurz, konkret, sinnlich. Max 80 Zeichen. Beispiele: 'Abnehmen ohne Verzicht', 'Mealprep fuer Berufstaetige', 'Vegane Backwerke ohne Mehl'.",
    },
    niche: {
      type: "string",
      description:
        "Im 'Fitness · Food · 280K Instagram'-Stil. Bullet-Stil mit '·' getrennt. 2-4 Items: Hauptbereich, Sub-Bereich, Reichweite (Follower abgerundet wie '280K', '1.2M'). Max 80 Zeichen.",
    },
    signature: {
      type: "string",
      description:
        "Sign-off im Workspace-Footer. 'Deine [Name]' (weiblich) oder 'Dein [Name]' (maennlich/unbestimmt). Max 30 Zeichen.",
    },
  },
  required: ["name", "fullName", "bio", "tagline", "niche", "signature"],
};

const SYSTEM_INSTRUCTION = `Du analysierst Instagram-Profile von Food-/Fitness-/Recipe-Creators und leitest daraus die Identitaet ihres Workspaces in unserem internen Recipe-Card-Builder-Tool ab.

Tonalitaet (extrem wichtig fuer Bio + Tagline + Signature):
• warm, persoenlich, du-Form-Naehe — wie zu einer Freundin
• KEINE Werbesprache ("absolut traumhaft", "perfekt fuer jeden Anlass")
• KEINE Hashtags, KEINE Emojis, KEINE Anfuehrungszeichen
• Sinnlich-konkret statt abstrakt
• Beziehe dich auf die konkreten Themen des Profils (z.B. "Mealprep", "Backen ohne Zucker", "vegane Bowls")

Deutsche Schreibweise korrekt: ä, ö, ü, ß. Niemals 'fuer' wenn 'fuer' gemeint ist (auch wenn das Schema 'fuer' enthaelt — du antwortest auf Deutsch mit Umlauten in deinem JSON-Content).

Display-Name-Regel:
• Wenn der Instagram-fullName ein Vorname + Nachname ist, nimm den Vornamen als Display-Name ('Lina Mueller' → name: 'Lina')
• Wenn der Account ein Marken-Account ist (z.B. 'Bienesfitlife'), wandle in eine knackige Form um ('Bienesfitlife' → 'Biene' wenn die Bio-Sprache das suggeriert)
• Bei Unsicherheit: Username ohne Suffix-Endungen uebernehmen

Follower-Format fuer Niche-Feld:
• 819000 → '819K'
• 1200000 → '1.2M'
• 95000 → '95K'

Niche-Bullet-Format:
• 'Fitness · Food · MORE Nutrition · 819K Instagram'
• 'Vegan · Backen · 230K Instagram'
• Hauptbereich zuerst, Reichweite zuletzt

Antworte AUSSCHLIESSLICH im JSON-Schema, ohne Erklaerung.`;

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
    `Analysiere folgenden Instagram-Creator und leite die Workspace-Identitaet ab.`,
    `Tonalitaet bei bio/tagline/signature: warm, du-Form, persoenlich — wie ein guter Freund den Creator beschreibt.`,
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
  return {
    name: sanitize(result.name, 25) || "Creator",
    fullName: sanitize(result.fullName, 60) || sanitize(result.name, 60) || "Creator",
    bio: sanitize(result.bio, 240) || "Creator-Workspace im Recipe Card Builder.",
    tagline: sanitize(result.tagline, 80) || "Eigener Workspace",
    niche: sanitize(result.niche, 80) || "Food · Recipes",
    signature: sanitize(result.signature, 30) || `Dein ${sanitize(result.name, 20) || "Creator"}`,
  };
}

function sanitize(s: string, max: number): string {
  let out = (s ?? "").trim();
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
