import type { Brand } from "@/lib/brands";
import type { Pack, StoryPage } from "@/lib/packs";
import { callGemini } from "./gemini";
import {
  formatVoiceProfileForPrompt,
  formatCaptionFewShot,
  ensureBrandVoiceProfile,
} from "./analyze-voice-profile";
import {
  ensureBrandCreatorStory,
  formatCreatorStoryForPrompt,
} from "./analyze-creator-story";
import {
  findBannedPhrases,
  buildAvoidHint,
} from "./banned-phrases";
import { restoreGermanUmlauts } from "@/lib/restore-umlauts";
import { correctGermanUmlautsBatch } from "./correct-german-umlauts";

// Story-Pages-Generator fuer den Guide-Modus.
//
// User-Wunsch (Niklas-Kritik): manche Creator wollen nicht nur ein Rezept-
// buch, sondern einen Guide — mit ganzen Seiten zur Person, ihrer Geschichte,
// ihrem Why. Diese Seiten sitzen zwischen Vorwort und Inhaltsverzeichnis,
// NICHT im Vorwort drin. Vorwort bleibt 1 Seite.
//
// Standard-Kinds (default 3 Seiten):
//   1. personal-story  — Werdegang / Wendepunkt aus dem creatorStory
//   2. philosophy      — Mein Why / Wie ich heute koche
//   3. what-you-find   — Brueche zum Pack-Inhalt
//
// Modell: gemini-2.5-pro (narrative Aufgabe).
// Output: Array von Pages mit Title + Body (Text only — Bilder kommen via
// separater Pipeline in lib/ai/generate-story-page-image.ts).

export type StoryPageKind = StoryPage["kind"];

const STANDARD_KINDS: StoryPageKind[] = [
  "personal-story",
  "philosophy",
  "what-you-find",
];

// Pro Kind ein Brief mit Default-Title-Vorschlag und inhaltlicher Anweisung
// fuer Gemini. Wird in den User-Prompt eingespeist.
const KIND_BRIEFS: Record<StoryPageKind, { defaultTitle: string; brief: string }> = {
  "personal-story": {
    defaultTitle: "Meine Geschichte",
    brief: `Erzaehle die eigene Geschichte der Creatorin — Werdegang, Wendepunkt, was sie bewegt hat. Konkret, persoenlich, in der ICH-Form. NICHT abstrakt. Wenn die creatorStory bestimmte Details enthaelt (Foto-Moment bei Biene, Schmerz bei Julia etc.), nutze die. Vermeide Selbsthilfe-Floskeln.`,
  },
  philosophy: {
    defaultTitle: "Mein Why",
    brief: `Erklaere die Philosophie der Creatorin: warum kocht sie wie sie kocht, was ist ihr Anti-Modell, welches Gefuehl will sie vermitteln. Konkret und sinnlich. NICHT "Mein Ziel ist es, dich zu inspirieren" — sondern echte Werte und Mikro-Rituale.`,
  },
  "what-you-find": {
    defaultTitle: "Was dich in diesem Guide erwartet",
    brief: `Beschreibe was die Leserin in diesem konkreten Pack findet und wie sie es nutzen kann. MUSS mindestens 2 Rezepte oder Pack-Themen aus dem Pack-Kontext namentlich erwaehnen. Praktisch, einladend, nicht werbisch.`,
  },
  custom: {
    defaultTitle: "Story-Seite",
    brief: `Eine zusaetzliche Story-Seite mit freiem Thema. Folge der creatorStory + Voice-Profile.`,
  },
};

// ─── Schema ──────────────────────────────────────────────────────────────

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    pages: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: ["personal-story", "philosophy", "what-you-find"],
            description:
              "Welcher Story-Page-Typ. Muss zur Reihenfolge der Eingabe-Kinds passen.",
          },
          title: {
            type: "string",
            description:
              "Seite-Titel auf Deutsch, 3-7 Woerter, prazise. KEINE Hashtags, Emojis, Em-Dashes. Beispiele: 'Meine Geschichte', 'Vom unzufriedenen Foto zur Buehne', 'Warum ich anders koche'. Nicht 'Hi ich bin X' — der Title ist eine Ueberschrift.",
          },
          body: {
            type: "string",
            description:
              "Body-Text auf Deutsch, ICH-Form, 600-1200 Zeichen, 3-5 Absaetze getrennt durch \\n\\n. Konkret, sinnlich, persoenlich. KEINE Werbe-Floskeln, KEINE Hashtags, Emojis, Em-Dashes. MUSS sich in der Tonalitaet der Creator-Captions bewegen.",
          },
        },
        required: ["kind", "title", "body"],
      },
    },
  },
  required: ["pages"],
};

type RawOutput = {
  pages: Array<{ kind: StoryPageKind; title: string; body: string }>;
};

// ─── Prompt-Builder ──────────────────────────────────────────────────────

function buildSystemInstruction(brand: Brand): string {
  const voiceBlock = formatVoiceProfileForPrompt(brand.voiceProfile, brand.name);
  const fewShotBlock = formatCaptionFewShot(brand.voiceProfile);
  const storyBlock = formatCreatorStoryForPrompt(brand);

  return `Du schreibst Story-Seiten fuer einen Recipe-Pack-Guide von ${brand.name} (${brand.handle}).

Eine Story-Seite ist eine GANZE Buchseite ueber die Person — wie ein Kapitel-Eintrag in einem Kochbuch, das nicht nur Rezepte sondern auch Persoenlichkeit transportiert. NICHT eine Caption, NICHT ein Vorwort. Mehr Tiefe, mehr Erzaehlraum.

${storyBlock}

Brand-Kontext:
- Name: ${brand.name}
- Handle: ${brand.handle}
- Bio: ${brand.bio}
- Tagline: ${brand.tagline}

${voiceBlock}

${fewShotBlock}

GENERATIONS-REGELN:
- ICH-Form, als ob ${brand.name} selbst spricht
- Konkret und sinnlich, NICHT abstrakt: nicht "ich liebe es zu kochen", sondern "ich liebe den Moment wenn der Teig genau richtig glaenzt"
- Mikro-Anker erlaubt: "an meinen Buerotagen", "mein Sonntagsritual", "wenn das Wetter umschlaegt"
- KEINE Werbesprache (NIEMALS: "perfekt fuer", "koestlich", "absolut", "Geschmacksexplosion", "kulinarisch", "tauche ein", "lass dich inspirieren", "must-have")
- KEINE Aufzaehlungen mit Bindestrichen/Bullets — Fliesstext
- KEINE Hashtags, KEINE Emojis, KEINE Anfuehrungszeichen, KEINE Em-Dashes (—)
- 3-5 Absaetze pro Body, getrennt durch \\n\\n. Jeder Absatz 2-3 Saetze.

DEUTSCHE SCHREIBWEISE (KRITISCH):
- Korrekte Umlaute: ä, ö, ü, ß. NIEMALS "ae/oe/ue/ss" wo Umlaute hingehoeren.

REZEPT-NAMEN:
- In Title-Case ("Spaghetti Protein Eis"), NIEMALS ALL-CAPS.

Antworte AUSSCHLIESSLICH im JSON-Schema. Erzeuge GENAU die im User-Prompt verlangten Kinds, in der gleichen Reihenfolge.`;
}

function buildUserPrompt(
  pack: Pack,
  brand: Brand,
  kinds: StoryPageKind[],
  recipeTitles: string[]
): string {
  const lines: string[] = [];
  lines.push(`Generiere ${kinds.length} Story-Seiten fuer diesen Pack-Guide.`);
  lines.push("");
  lines.push(`PACK-INFO:`);
  lines.push(`- Titel: ${pack.title}`);
  lines.push(`- Untertitel: ${pack.subtitle}`);
  lines.push(`- Tagline: ${pack.tagline}`);
  lines.push(`- Kategorie: ${pack.category}`);
  lines.push(`- Beschreibung: ${pack.description}`);

  if (recipeTitles.length > 0) {
    lines.push("");
    lines.push(`REZEPTE im Pack (fuer what-you-find namentlich erwaehnen):`);
    recipeTitles.slice(0, 15).forEach((t) => lines.push(`- ${t}`));
  }

  lines.push("");
  lines.push(`STORY-SEITEN — generiere in dieser Reihenfolge:`);
  kinds.forEach((kind, i) => {
    const brief = KIND_BRIEFS[kind];
    lines.push("");
    lines.push(`${i + 1}. kind="${kind}"`);
    lines.push(`   Default-Title: "${brief.defaultTitle}" (kannst du anpassen wenn etwas besseres passt)`);
    lines.push(`   Inhalt: ${brief.brief}`);
  });

  lines.push("");
  lines.push(`Antworte nur als JSON nach Schema. Reihenfolge der pages MUSS der Reihenfolge der Kinds oben entsprechen.`);

  return lines.join("\n");
}

// ─── Field-Cleaners ──────────────────────────────────────────────────────

function cleanTitle(s: string): string {
  let out = (s ?? "").trim();
  out = restoreGermanUmlauts(out);
  out = out.replace(/^["'„«]+|["'"»]+$/g, "");
  out = out.replace(/\s*[—–]\s*/g, " — ").trim();
  out = out.replace(/\s+/g, " ");
  if (out.length > 80) out = out.slice(0, 80);
  return out;
}

function cleanBody(s: string): string {
  let out = (s ?? "").trim();
  out = restoreGermanUmlauts(out);
  // Em-/En-Dashes → Komma fuer prosa-Look
  out = out.replace(/\s*[—–]\s*/g, ", ");
  // Normalisiere Whitespace ABER bewahre Doppel-Newlines (Absaetze)
  out = out.replace(/[ \t]+/g, " ");
  out = out.replace(/\n{3,}/g, "\n\n");
  // Hartes Cap auf 1400 Zeichen, sonst PDF-Layout-Overflow
  if (out.length > 1400) {
    const cut = out.slice(0, 1400);
    const lastDot = Math.max(
      cut.lastIndexOf("."),
      cut.lastIndexOf("!"),
      cut.lastIndexOf("?")
    );
    out = lastDot > 800 ? cut.slice(0, lastDot + 1) : cut + "…";
  }
  return out;
}

// ─── Generation ──────────────────────────────────────────────────────────

const BASE_TEMP = 0.6;
const CANDIDATE_COUNT = 2;

async function generateCandidates(
  prompt: string,
  systemInstruction: string,
  extra: string
): Promise<RawOutput[]> {
  const fullSystem = extra ? `${systemInstruction}\n\n${extra}` : systemInstruction;
  const temps = Array.from({ length: CANDIDATE_COUNT }, (_, i) => {
    const offset = (i - (CANDIDATE_COUNT - 1) / 2) * 0.15;
    return Math.max(0.3, Math.min(1.0, BASE_TEMP + offset));
  });
  const results = await Promise.allSettled(
    temps.map((t) =>
      callGemini<RawOutput>({
        prompt,
        schema: RESPONSE_SCHEMA,
        systemInstruction: fullSystem,
        temperature: t,
        maxOutputTokens: 6144,
        retries: 1,
        model: "pro",
      })
    )
  );
  return results
    .filter(
      (r): r is PromiseFulfilledResult<RawOutput> => r.status === "fulfilled"
    )
    .map((r) => r.value)
    .filter((c) => Array.isArray(c.pages) && c.pages.length > 0);
}

/**
 * Generiert eine Liste von Story-Seiten fuer einen Pack im Guide-Modus.
 * Default sind die 3 Standard-Kinds (personal-story, philosophy,
 * what-you-find). Bilder werden nicht hier erzeugt — Caller ruft optional
 * generateStoryPageImage pro Page separat auf.
 */
export async function generateStoryPages(
  pack: Pack,
  brand: Brand,
  opts: {
    kinds?: StoryPageKind[];
    recipeTitles?: string[];
  } = {}
): Promise<StoryPage[]> {
  const brandWithVoice = (await ensureBrandVoiceProfile(brand)) ?? brand;
  const brandFull = (await ensureBrandCreatorStory(brandWithVoice)) ?? brandWithVoice;
  const brandBanned = brandFull.voiceProfile?.bannedPhrases ?? [];

  const kinds = opts.kinds ?? STANDARD_KINDS;
  const recipeTitles = opts.recipeTitles ?? [];

  const systemInstruction = buildSystemInstruction(brandFull);
  const userPrompt = buildUserPrompt(pack, brandFull, kinds, recipeTitles);

  // 2 Kandidaten + Banned-Check + 1 Retry-Pass.
  let candidates = await generateCandidates(userPrompt, systemInstruction, "");

  const hitsByIdx = (cs: RawOutput[]): number[] =>
    cs.map((c) => {
      const text = c.pages.map((p) => `${p.title} ${p.body}`).join(" ");
      return findBannedPhrases(text, brandBanned).length;
    });

  let hits = hitsByIdx(candidates);
  let cleanCount = hits.filter((h) => h === 0).length;
  let passes = 1;

  if (cleanCount === 0 && candidates.length > 0) {
    const avoidHint = buildAvoidHint(brandBanned);
    candidates = await generateCandidates(userPrompt, systemInstruction, avoidHint);
    hits = hitsByIdx(candidates);
    cleanCount = hits.filter((h) => h === 0).length;
    passes = 2;
  }

  if (candidates.length === 0) {
    throw new Error(`[generate-story-pages] keine Kandidaten nach ${passes} Pass(es)`);
  }

  const cleanIdx = hits.findIndex((h) => h === 0);
  const winnerIdx = cleanIdx >= 0 ? cleanIdx : 0;
  const winner = candidates[winnerIdx];

  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[generate-story-pages] passes=${passes} cleanCount=${cleanCount}/${candidates.length} pages=${winner.pages.length}`
    );
  }

  // Reihenfolge sicherstellen: Schema verlangt gleiche Reihenfolge wie
  // kinds, aber defensive — wenn KI vertauscht hat, sortieren wir nach
  // kinds-Index.
  const pagesByKind = new Map<StoryPageKind, RawOutput["pages"][0]>();
  for (const p of winner.pages) {
    if (!pagesByKind.has(p.kind)) pagesByKind.set(p.kind, p);
  }

  const ordered: StoryPage[] = [];
  for (const kind of kinds) {
    const page = pagesByKind.get(kind);
    if (!page) continue;
    ordered.push({
      id: cryptoRandomId(),
      kind,
      title: cleanTitle(page.title) || KIND_BRIEFS[kind].defaultTitle,
      body: cleanBody(page.body),
    });
  }

  if (ordered.length === 0) {
    throw new Error("[generate-story-pages] keine validen Pages nach Cleanup");
  }

  // Stage 2 Umlaut-Korrektur ueber alle Bodies.
  try {
    const flat: Record<string, string> = {};
    ordered.forEach((p, i) => {
      flat[`title_${i}`] = p.title;
      flat[`body_${i}`] = p.body;
    });
    const fixed = await correctGermanUmlautsBatch(flat);
    ordered.forEach((p, i) => {
      p.title = fixed[`title_${i}`] ?? p.title;
      p.body = fixed[`body_${i}`] ?? p.body;
    });
  } catch (err) {
    console.warn(
      "[generate-story-pages] Umlaut-Korrektur fehlgeschlagen, Stage-1 reicht:",
      err instanceof Error ? err.message : err
    );
  }

  return ordered;
}

function cryptoRandomId(): string {
  // Bevorzugt globalThis.crypto.randomUUID (Edge + Node 19+).
  // Fallback fuer aeltere Runtimes: Math.random-basiert (nicht crypto-stark,
  // reicht aber fuer eine Pack-interne ID).
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return `story-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
