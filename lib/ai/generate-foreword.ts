import type { Pack } from "@/lib/packs";
import type { Brand } from "@/lib/brands";
import {
  formatVoiceProfileForPrompt,
  formatCaptionFewShot,
  ensureBrandVoiceProfile,
} from "./analyze-voice-profile";
import { generateWithCritique } from "./text-generation-pipeline";
import { restoreGermanUmlauts } from "@/lib/restore-umlauts";
import { correctGermanUmlautsBatch } from "./correct-german-umlauts";
import { normalizeRecipeTitleForProse } from "@/lib/normalize-recipe-title";

// Pack-Vorwort-Generator (v2, Mai 2026): jetzt brand-agnostisch ueber
// Voice-Profil + Multi-Candidate + Self-Critique + Banned-Check.
//
// Generiert vier Felder fuer das Pack-Foreword:
//   - greeting: Anrede oben auf der Vorwort-Page
//   - story:    Pack-spezifisches Vorwort im Body (3-5 Saetze, nennt 2+
//               Rezepte beim Namen)
//   - signoff:  Kurzer Schluss-CTA UNTER der story (Vorwort-Page)
//   - outro:    2-3 Saetze persoenliche Abschiedsworte auf der LETZTEN
//               Pack-Seite (Outro-Page)
//
// Pipeline identisch zu generate-pack-meta: 3 Kandidaten parallel,
// Self-Critique, Banned-Check, Retry-Pass.

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    greeting: {
      type: "string",
      description:
        "Direkte, persoenliche Anrede in der Stimme der Creatorin. 4-7 Woerter mit korrekten deutschen Umlauten. KEINE Hashtags, Emojis, Anfuehrungszeichen, Em-Dashes (—).",
    },
    story: {
      type: "string",
      description:
        "Pack-spezifisches Vorwort, 3-5 kurze Saetze, 200-380 Zeichen. Erklaert persoenlich warum dieses Pack besonders ist. MUSS mindestens 2 konkrete Rezept-Namen aus dem Pack erwaehnen. In der Stimme der Creatorin. KEINE Werbesprache, Hashtags, Emojis, Anfuehrungszeichen, Em-Dashes.",
    },
    signoff: {
      type: "string",
      description:
        "Kurzer Schluss-CTA fuer die Vorwort-Page, 4-9 Woerter. Laedt zum Stoebern/Backen/Probieren ein. KEIN 'Deine <NAME>'. KEINE Hashtags, Emojis, Em-Dashes.",
    },
    outro: {
      type: "string",
      description:
        "2-3 Saetze persoenliche Abschiedsworte fuer die LETZTE Pack-Seite. ICH-Form, persoenlich, warm. MUSS auf mindestens 1 konkretes Rezept aus dem Pack ODER Saison/Anlass beziehen. Max 280 Zeichen. KEIN 'Deine <NAME>'. KEINE Hashtags, Emojis, Em-Dashes.",
    },
  },
  required: ["greeting", "story", "signoff", "outro"],
};

function buildSystemInstruction(brand: Brand): string {
  const voiceBlock = formatVoiceProfileForPrompt(brand.voiceProfile, brand.name);
  const fewShotBlock = formatCaptionFewShot(brand.voiceProfile);

  return `Du schreibst Pack-Vorworte fuer die Recipe-Cards von ${brand.name} (${brand.handle}).

Brand-Kontext:
- Name: ${brand.name}
- Handle: ${brand.handle}
- Bio: ${brand.bio}
- Tagline: ${brand.tagline}

${voiceBlock}

${fewShotBlock}

GENERATIONS-REGELN:
- Sprich in der ICH-Form, als ob ${brand.name} selbst spricht
- Warm, persoenlich, "wie zu einer Freundin am Kuechentisch"
- KEINE Werbesprache, KEINE Floskeln ("genussvoll", "koestlich", "perfekt fuer jeden Anlass", "absolute Lieblinge", "angesagt")
- KEINE Uebertreibungen ("absolut traumhaft", "unwiderstehlich", "sensationell")
- KEINE Hashtags, Emojis, Anfuehrungszeichen, Em-Dashes (—)
- Sinnlich-konkret statt abstrakt: nicht "lecker", sondern "schmilzt auf der Zunge", "knusprig aussen, fluffig innen", "in 15 Min auf dem Tisch"
- Eine kleine persoenliche Note willkommen: "das ist mein Sonntagsritual", "ich back das mindestens einmal die Woche"

DEUTSCHE SCHREIBWEISE (KRITISCH wenn Sprache=de):
- Verwende immer korrekte Umlaute: ä, ö, ü, ß
- NIEMALS "ae/oe/ue/ss" wo Umlaute hingehoeren
- Bei langem Vokal: ß statt ss ("süß", "heiß", "groß", "weiß")

REZEPT-NAMEN IM FLIESSTEXT:
- Schreibe Rezept-Namen IMMER in Title-Case ("Spaghetti Protein Eis", "Homemade Döner") — NIEMALS in ALL-CAPS, auch wenn sie in der Recipe-Liste oben so vorkommen
- Im Fliesstext eines Vorworts wirkt ALL-CAPS schreiend und unleserlich
- Beispiel falsch: "Das SPAGHETTI PROTEIN EIS ist ein Knaller"
- Beispiel richtig: "Das Spaghetti Protein Eis ist ein Knaller"

PACK-VORWORT-STRUKTUR:
- greeting: 4-7 Woerter, direkte Anrede
- story: 3-5 Saetze. MUSS mindestens 2 konkrete Rezept-Namen aus dem Pack erwaehnen. Bezieht sich auf Pack-Charakter, sagt fuer wen/wann das Pack gedacht ist
- signoff: 4-9 Woerter, Einladung zum Stoebern
- outro: 2-3 Saetze persoenliche Abschiedsworte. Bezieht sich konkret auf 1-2 Rezepte ODER auf Saison/Anlass aus dem Title

Antworte AUSSCHLIESSLICH im JSON-Schema.`;
}

function buildUserPrompt(
  pack: Pack,
  brand: Brand,
  recipeTitles: string[]
): string {
  const lines = [
    `Schreibe ein persoenliches Pack-Vorwort.`,
    ``,
    `Pack-Titel: ${pack.title}`,
    `Pack-Untertitel: ${pack.subtitle}`,
    `Tagline: ${pack.tagline}`,
    `Kategorie: ${pack.category}`,
    `Beschreibung: ${pack.description}`,
    pack.edgeCase ? `Pack-Charakter: ${pack.edgeCase}` : "",
  ];

  if (recipeTitles.length > 0) {
    lines.push("");
    lines.push(`REZEPTE im Pack (MUSST mindestens 2 davon in der story namentlich erwaehnen — KEINE erfinden):`);
    recipeTitles.slice(0, 20).forEach((t) => lines.push(`- ${t}`));
  }

  lines.push("");
  lines.push(`Brand: ${brand.name} (${brand.handle})`);
  lines.push(`Brand-Bio: ${brand.bio}`);
  lines.push(`Brand-Tagline: ${brand.tagline}`);
  lines.push("");
  lines.push(`Antworte nur als JSON nach Schema, ohne Erklaerung.`);

  return lines.filter(Boolean).join("\n");
}

export type PackForewordContent = {
  greeting: string;
  story: string;
  signoff: string;
  /** Optionales Outro fuer die letzte Pack-Seite. Bei aelteren Forewords
   *  kann das Feld fehlen — der Renderer faellt dann auf Default zurueck. */
  outro?: string;
};

function cleanField(s: string, max: number): string {
  let out = (s ?? "").trim();
  // Stage 1: Umlauts wiederherstellen (greift bei deutschen Brands)
  out = restoreGermanUmlauts(out);
  // Stage 2: typografisch sauber
  out = out.replace(/^["'„«]+|["'"»]+$/g, "");
  out = out.replace(/\s*[—–]\s*/g, ", "); // Em/En-Dashes → Komma
  out = out.replace(/\s+/g, " ");
  out = out.replace(/,\s*,/g, ",");
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

/**
 * Generate a structured pack-foreword via Brand-Voice-Pipeline.
 * recipeTitles ist optional aber sehr empfohlen — gibt der KI konkrete
 * Anker fuer persoenliche Texte. Throws on Gemini failure.
 */
export async function generatePackForeword(
  pack: Pack,
  brand: Brand,
  recipeTitles: string[] = []
): Promise<PackForewordContent> {
  // Lazy-Backfill: brand kann ohne voiceProfile reinkommen (Code-Brand,
  // alter Custom-Brand). ensureBrandVoiceProfile leitet es lazy aus DB-
  // Captions ab + persistiert. Naechster Call profitiert.
  const brandWithVoice = (await ensureBrandVoiceProfile(brand)) ?? brand;
  const brandBanned = brandWithVoice.voiceProfile?.bannedPhrases ?? [];

  // ALL-CAPS-Recipe-Titel ("SPAGHETTI PROTEIN EIS") werden fuer die
  // Prose-Erwaehnung im Vorwort in Title-Case ueberfuehrt ("Spaghetti
  // Protein Eis"). User-Feedback: ALL-CAPS-Erwaehnungen im Fliesstext
  // wirken schreiend + triggern Char-Level-Wraps in react-pdf. Recipe-
  // Cards selbst behalten ihre Original-Schreibweise — das hier ist
  // nur fuer Gemini's Story/Outro-Generation.
  const normalizedTitles = recipeTitles.map(normalizeRecipeTitleForProse);

  const result = await generateWithCritique<PackForewordContent>({
    schema: RESPONSE_SCHEMA,
    generationPrompt: buildUserPrompt(pack, brandWithVoice, normalizedTitles),
    generationSystemInstruction: buildSystemInstruction(brandWithVoice),
    candidateCount: 3,
    generationTemperature: 0.7,
    maxOutputTokens: 1024,
    brandBannedPhrases: brandBanned,
    bannedCheckFields: ["greeting", "story", "signoff", "outro"],
    scorableFields: [
      {
        key: "greeting",
        label: "Greeting",
        minLength: 10,
        maxLength: 60,
        goodCriteria: "Direkte, persoenliche Anrede. Klingt wie der Creator selbst.",
      },
      {
        key: "story",
        label: "Story",
        minLength: 200,
        maxLength: 380,
        goodCriteria:
          "3-5 Saetze in Creator-Stimme. Nennt mind. 2 ECHTE Rezeptnamen. Konkret, nicht generisch.",
      },
      {
        key: "signoff",
        label: "Signoff",
        minLength: 10,
        maxLength: 100,
        goodCriteria: "Einladung zum Stoebern, kurz und einladend.",
      },
      {
        key: "outro",
        label: "Outro",
        minLength: 100,
        maxLength: 280,
        goodCriteria:
          "2-3 Saetze persoenliche Abschiedsworte. Bezieht sich auf Rezept/Saison/Anlass.",
      },
    ],
    preFilter: (c) => {
      if (!c.greeting?.trim() || !c.story?.trim()) return true;
      if (!c.signoff?.trim() || !c.outro?.trim()) return true;
      return false;
    },
    debugTag: "generate-foreword",
  });

  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[generate-foreword] passes=${result.passes} cleanCount=${result.cleanCount} winnerBannedHits=${result.winnerBannedHits.length}`
    );
  }

  const winner = result.winner;

  // Stage 1: schnelle Wortlisten-Korrektur (instant, kein API-Call).
  // Faengt die ~100 haeufigsten deutschen Woerter ab und ist defense
  // gegen Gemini-Outage in Stage 2.
  const preCorrected = {
    greeting: cleanField(winner.greeting, 60),
    story: cleanField(winner.story, 420),
    signoff: cleanField(winner.signoff, 100),
    outro: winner.outro ? cleanField(winner.outro, 320) : "",
  };

  // Stage 2: semantische Umlaut-Korrektur via Gemini-Mini-Call.
  // Faengt alle Woerter ab die nicht in der Whitelist sind — auch ganz
  // neue oder seltene Begriffe. Skipt falls keine verdaechtigen Patterns
  // mehr drin sind (also Gemini Output war von vornherein sauber +
  // Stage 1 hat alles abgedeckt). Cost ~1s + ~$0.0001 pro Foreword.
  let corrected: typeof preCorrected;
  try {
    corrected = await correctGermanUmlautsBatch(preCorrected);
  } catch (err) {
    console.warn(
      "[generate-foreword] Umlaut-Korrektur fehlgeschlagen, nutze Stage-1-Ergebnis:",
      err instanceof Error ? err.message : err
    );
    corrected = preCorrected;
  }

  return {
    greeting: corrected.greeting,
    story: corrected.story,
    signoff: corrected.signoff,
    outro: corrected.outro ? corrected.outro : undefined,
  };
}
