import type { Pack } from "@/lib/packs";
import type { Brand } from "@/lib/brands";
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
  type BannedHit,
} from "./banned-phrases";
import { restoreGermanUmlauts } from "@/lib/restore-umlauts";
import { correctGermanUmlautsBatch } from "./correct-german-umlauts";
import { normalizeRecipeTitleForProse } from "@/lib/normalize-recipe-title";

// Pack-Vorwort-Generator (v3, Mai 2026).
//
// v3-Aenderungen vs. v2:
//   - Modell: gemini-2.5-pro statt -flash. Pro klingt deutlich weniger
//     generisch bei narrativem Text; bei ~50 Packs/Monat sind die Mehr-
//     kosten vernachlaessigbar.
//   - Schema: nicht mehr 4 starre Felder (greeting/story/signoff/outro),
//     sondern flexible Block-Liste (greeting, paragraphs[], optional
//     pullquote, signoff, outro). Damit hat das Vorwort variable Tiefe
//     je nach Pack/Creator, klingt nicht jedesmal nach Template.
//   - Brand-Context: zusaetzlich zu Voice-Profile speist sich jetzt auch
//     brand.creatorStory in den Prompt (Persoenlichkeits-Portrait, 5-10
//     Saetze). Das ist der groesste Hebel gegen "Werbe-Sprache".
//   - Self-Critique-Pipeline (generateWithCritique) entfaellt — Pipeline
//     ist auf Flash gepinnt, fuer Pro brauchen wir keinen Critic, der
//     mit Flash den Pro-Output downscoren wuerde. Banned-Check + Retry-
//     Pass bleiben inline.
//
// Output-Form:
//   - blocks: geordnete Liste von greeting + 1-3 paragraphs + optional
//     pullquote + signoff. Renderer entscheidet ueber Layout/Reihenfolge.
//   - outro: separater String fuer die LETZTE Pack-Seite.
//
// Legacy-Compat: alte PackForewordContent-Records aus der DB (mit greeting/
// story/signoff statt blocks) werden vom Renderer per Adapter konvertiert.

// ─── Output-Types ────────────────────────────────────────────────────────

export type ForewordBlockKind = "greeting" | "paragraph" | "pullquote" | "signoff";

export type ForewordBlock = {
  kind: ForewordBlockKind;
  text: string;
};

export type PackForewordContent = {
  /** Geordnete Block-Liste fuer das Vorwort. Renderer rendert sie
   *  Reihenfolge-treu — KI entscheidet Anzahl + Mix. */
  blocks?: ForewordBlock[];
  /** 2-3 Saetze fuer die LETZTE Pack-Seite (separat vom Vorwort). */
  outro?: string;
  // ─── Legacy-Felder (vor v3-Migration) ──────────────────────────────────
  // Werden vom Renderer per Adapter (toBlocks) in blocks konvertiert.
  // Neu generierte Forewords schreiben sie nicht mehr, sondern direkt
  // blocks. Bestehende DB-Rows funktionieren weiter.
  /** @deprecated v2 — durch blocks ersetzt */
  greeting?: string;
  /** @deprecated v2 — durch blocks ersetzt */
  story?: string;
  /** @deprecated v2 — durch blocks ersetzt */
  signoff?: string;
};

// ─── Internes Generation-Schema ─────────────────────────────────────────

// Flach gehalten weil Gemini-Schema mit Arrays-of-Objects bei response
// JSON manchmal hakelig wird. Wir mappen am Ende auf die Block-Liste.

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    greeting: {
      type: "string",
      description:
        "Persoenliche Anrede oben auf der Vorwort-Page. 4-10 Woerter mit korrekten deutschen Umlauten. KEINE Hashtags, Emojis, Anfuehrungszeichen, Em-Dashes (—). Nicht 'Hi ich bin <Name>' — die Person spricht IM Vorwort, der Name kommt aus dem Avatar-Strip darunter.",
    },
    paragraphs: {
      type: "array",
      items: { type: "string" },
      description:
        "1-3 zusammenhaengende Absaetze des Vorwort-Bodys. Jeder Absatz 2-4 Saetze, 120-300 Zeichen. Erster Absatz: warum dieses Pack jetzt da ist (persoenlich, anker-haft, KEINE Werbe-Floskeln). Optional Folge-Absaetze: konkrete Inhalte des Packs (mindestens 2 Rezepte beim Namen), kleine persoenliche Notiz, Hinweis zu Anlass/Saison. KEINE Hashtags, Emojis, Em-Dashes. KEINE Werbe-Sprache ('perfekt fuer jeden', 'koestlich', 'absolut', 'kulinarische Reise'). Bei einfachen Packs reicht 1 Absatz, bei storyreichen/saisonalen 2-3.",
    },
    pullquote: {
      type: "string",
      description:
        "OPTIONAL — leerer String wenn unpassend. Sonst: 1 pointierter Satz aus dem Vorwort, 8-22 Woerter, der spaeter italic/groesser als Pull-Quote zwischen den Absaetzen gesetzt werden kann. Muss inhaltlich aus den paragraphs ableitbar sein (kein neuer Inhalt). Beispiele: 'Das ist mein Sonntagsritual, seit ich denken kann.' / 'Bei mir wird kein Teller halbleer aus der Kueche getragen.'",
    },
    signoff: {
      type: "string",
      description:
        "Kurzer Schluss-Satz UNTER den Absaetzen. 4-10 Woerter. Einladung zum Stoebern, Backen, Probieren. KEIN 'Deine <NAME>' — die Avatar-Signatur kommt darunter im Layout. KEINE Hashtags, Emojis, Em-Dashes.",
    },
    outro: {
      type: "string",
      description:
        "2-3 Saetze persoenliche Abschiedsworte fuer die LETZTE Pack-Seite (separater Render-Ort). ICH-Form, warm, konkret. MUSS auf mindestens 1 echtes Rezept ODER auf Saison/Anlass im Pack-Titel Bezug nehmen. Max 320 Zeichen. KEIN 'Deine <NAME>'. KEINE Hashtags, Emojis, Em-Dashes.",
    },
  },
  required: ["greeting", "paragraphs", "signoff", "outro"],
};

type RawForewordOutput = {
  greeting: string;
  paragraphs: string[];
  pullquote?: string;
  signoff: string;
  outro: string;
};

// ─── Prompt Construction ────────────────────────────────────────────────

function buildSystemInstruction(brand: Brand): string {
  const voiceBlock = formatVoiceProfileForPrompt(brand.voiceProfile, brand.name);
  const fewShotBlock = formatCaptionFewShot(brand.voiceProfile);
  const storyBlock = formatCreatorStoryForPrompt(brand);

  return `Du schreibst Pack-Vorworte fuer die Rezept-Karten von ${brand.name} (${brand.handle}).

Ein Pack-Vorwort ist KEIN Marketingtext und KEINE Social-Media-Caption. Es ist die Eroeffnung eines Kochbuch-Kapitels — wie ein persoenlicher Brief an die Leserin, die das Buch gerade aufschlaegt.

${storyBlock}

Brand-Kontext:
- Name: ${brand.name}
- Handle: ${brand.handle}
- Bio: ${brand.bio}
- Tagline: ${brand.tagline}

${voiceBlock}

${fewShotBlock}

GENERATIONS-REGELN:
- Sprich in der ICH-Form, als ob ${brand.name} selbst die Leserin anspricht
- Warm, persoenlich, "wie zu einer Freundin am Kuechentisch" — aber NICHT generisch warm
- Konkret und sinnlich, nicht abstrakt: nicht "lecker", sondern "knusprig aussen, fluffig innen", "in 15 Minuten auf dem Tisch", "schmilzt zwischen zwei Loeffeln Quark"
- Persoenliche Mikro-Anker willkommen: "an meinen Buerotagen", "wenn das Wetter umschlaegt", "mein Sonntagsritual"
- KEINE Werbesprache (NIEMALS: "perfekt fuer jeden Anlass", "absolute Lieblinge", "koestlich", "Geschmacksexplosion", "kulinarische Reise", "entdecke die", "lass dich inspirieren", "must-have", "perfekte Sammlung")
- KEINE Uebertreibungen ("absolut traumhaft", "unwiderstehlich", "sensationell")
- KEINE Hashtags, KEINE Emojis, KEINE Anfuehrungszeichen, KEINE Em-Dashes (—)
- KEINE Aufzaehlungen mit Bindestrichen oder Bullets — der Vorwort-Text ist Fliesstext

VARIABLE TIEFE — die Anzahl der Absaetze richtet sich nach dem Pack:
- Einfaches schnelles Pack (z.B. "Blitz-Snacks"): 1 Absatz reicht, kurz und prazise
- Standard-Pack mit klarem Thema: 2 Absaetze (Anker + Inhalte/Anlass)
- Pack mit starkem Saison-/Anlass-/Geschichte-Charakter: 3 Absaetze (Anker + Story + Pack-Konkret)

PULLQUOTE — nur wenn wirklich passend. Gib einen leeren String zurueck wenn es keinen pointierten Satz gibt, der als Pull-Quote sinnvoll ist. Lieber kein Pullquote als ein erzwungener.

REZEPT-NAMEN IM FLIESSTEXT:
- Mindestens EIN konkretes Rezept aus dem Pack namentlich erwaehnen (in paragraphs oder outro)
- Title-Case verwenden ("Spaghetti Protein Eis"), NIEMALS ALL-CAPS auch wenn die Liste so kommt
- Beispiel falsch: "Das SPAGHETTI PROTEIN EIS ist mein Liebling"
- Beispiel richtig: "Das Spaghetti Protein Eis ist mein Liebling"

DEUTSCHE SCHREIBWEISE (KRITISCH):
- Korrekte Umlaute: ä, ö, ü, ß
- NIEMALS "ae/oe/ue/ss" wo Umlaute hingehoeren
- Bei langem Vokal: ß statt ss ("süß", "heiß", "groß", "weiß")

Antworte AUSSCHLIESSLICH im JSON-Schema.`;
}

function buildUserPrompt(
  pack: Pack,
  brand: Brand,
  recipeTitles: string[]
): string {
  const lines: string[] = [
    `Schreibe ein persoenliches Pack-Vorwort fuer das folgende Pack.`,
    ``,
    `PACK-INFO:`,
    `- Titel: ${pack.title}`,
    `- Untertitel: ${pack.subtitle}`,
    `- Tagline: ${pack.tagline}`,
    `- Kategorie: ${pack.category}`,
    `- Beschreibung: ${pack.description}`,
  ];

  if (pack.edgeCase) {
    lines.push(`- Pack-Charakter: ${pack.edgeCase}`);
  }

  if (recipeTitles.length > 0) {
    lines.push("");
    lines.push(`REZEPTE im Pack (mindestens EINES davon in den paragraphs ODER im outro namentlich erwaehnen — keine erfinden):`);
    recipeTitles.slice(0, 20).forEach((t) => lines.push(`- ${t}`));
  }

  lines.push("");
  lines.push(`Brand: ${brand.name} (${brand.handle})`);
  lines.push(`Brand-Bio: ${brand.bio}`);
  lines.push(`Brand-Tagline: ${brand.tagline}`);
  lines.push("");
  lines.push(`Antworte nur als JSON nach Schema, ohne Erklaerung. Variable Tiefe: 1-3 paragraphs je nach Pack-Charakter, pullquote nur wenn wirklich passend.`);

  return lines.filter(Boolean).join("\n");
}

// ─── Generation Pipeline (inline statt generateWithCritique) ────────────

const CANDIDATE_COUNT = 3;
const BASE_TEMP = 0.65;

async function generateCandidates(
  prompt: string,
  systemInstruction: string,
  extraInstruction: string
): Promise<RawForewordOutput[]> {
  const fullSystem = extraInstruction
    ? `${systemInstruction}\n\n${extraInstruction}`
    : systemInstruction;

  // Temperatur-Spread fuer echte Vielfalt zwischen den Kandidaten.
  // 0.5 / 0.65 / 0.8 — niedrig genug damit Pro nicht halluziniert,
  // hoch genug damit nicht alle Kandidaten gleich klingen.
  const temps = Array.from({ length: CANDIDATE_COUNT }, (_, i) => {
    const offset = (i - (CANDIDATE_COUNT - 1) / 2) * 0.15;
    return Math.max(0.3, Math.min(1.0, BASE_TEMP + offset));
  });

  const results = await Promise.allSettled(
    temps.map((t) =>
      callGemini<RawForewordOutput>({
        prompt,
        schema: RESPONSE_SCHEMA,
        systemInstruction: fullSystem,
        temperature: t,
        maxOutputTokens: 3072,
        // thinkingBudget absichtlich UNSET fuer Pro — narrative Tiefe braucht
        // Think-Tokens. Bei Flash war 0 sinnvoll, bei Pro nicht.
        retries: 1,
        model: "pro",
      })
    )
  );

  return results
    .filter(
      (r): r is PromiseFulfilledResult<RawForewordOutput> =>
        r.status === "fulfilled"
    )
    .map((r) => r.value)
    .filter((c) => {
      // Pre-Filter: Schema-Required-Felder muessen non-empty sein
      if (!c.greeting?.trim() || !c.signoff?.trim()) return false;
      if (!Array.isArray(c.paragraphs) || c.paragraphs.length === 0) return false;
      if (c.paragraphs.every((p) => !p?.trim())) return false;
      if (!c.outro?.trim()) return false;
      return true;
    });
}

/** Concat aller Text-Felder eines Kandidaten fuer Banned-Check. */
function candidateAsText(c: RawForewordOutput): string {
  return [
    c.greeting,
    c.paragraphs?.join(" "),
    c.pullquote ?? "",
    c.signoff,
    c.outro,
  ]
    .filter(Boolean)
    .join(" \n ");
}

// ─── Field-Cleaners ──────────────────────────────────────────────────────

function cleanField(s: string, max: number): string {
  let out = (s ?? "").trim();
  out = restoreGermanUmlauts(out);
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

function cleanParagraph(s: string): string {
  // Paragraphs duerfen laenger sein als single-line Felder. Max 380 chars
  // ist die Schmerzgrenze fuer 1 Absatz auf einer A4-Vorwort-Seite mit
  // 11.5pt Body.
  return cleanField(s, 380);
}

// ─── Main Export ─────────────────────────────────────────────────────────

/**
 * Generate a structured pack-foreword via Brand-Voice + Brand-Story-
 * Pipeline. Modell: gemini-2.5-pro. 3 Kandidaten parallel + Banned-Check +
 * 1 Retry-Pass bei Floskeln. Throws on Gemini failure.
 *
 * recipeTitles ist optional aber stark empfohlen — gibt der KI konkrete
 * Anker fuer persoenliche Texte.
 */
export async function generatePackForeword(
  pack: Pack,
  brand: Brand,
  recipeTitles: string[] = []
): Promise<PackForewordContent> {
  // Lazy-Backfill 1: Voice-Profile (existierendes Pattern aus v2)
  const brandWithVoice = (await ensureBrandVoiceProfile(brand)) ?? brand;
  // Lazy-Backfill 2: Creator-Story (NEU in v3)
  const brandFull = (await ensureBrandCreatorStory(brandWithVoice)) ?? brandWithVoice;

  const brandBanned = brandFull.voiceProfile?.bannedPhrases ?? [];

  // ALL-CAPS → Title-Case Konversion fuer Prose-Erwaehnungen.
  const normalizedTitles = recipeTitles.map(normalizeRecipeTitleForProse);

  const systemInstruction = buildSystemInstruction(brandFull);
  const userPrompt = buildUserPrompt(pack, brandFull, normalizedTitles);

  // Pass 1: Generation ohne Avoid-Hint
  let candidates = await generateCandidates(userPrompt, systemInstruction, "");

  // Banned-Hits pro Kandidat ermitteln
  const hitsByIdx = (cs: RawForewordOutput[]): BannedHit[][] =>
    cs.map((c) => findBannedPhrases(candidateAsText(c), brandBanned));

  let hitsPerCandidate = hitsByIdx(candidates);
  let cleanCount = hitsPerCandidate.filter((h) => h.length === 0).length;
  let passes = 1;

  // Retry-Pass bei null sauberen Kandidaten
  if (cleanCount === 0 && candidates.length > 0) {
    const avoidHint = buildAvoidHint(brandBanned);
    const observedFloskeln = hitsPerCandidate
      .flat()
      .map((h) => h.phrase)
      .slice(0, 8);
    const extra = observedFloskeln.length
      ? `${avoidHint}\n\nDeine vorherigen Versuche hatten diese Probleme: ${observedFloskeln.map((p) => `"${p}"`).join(", ")}. Schreibe komplett anders — andere Bilder, andere Worte, andere Struktur.`
      : avoidHint;
    candidates = await generateCandidates(userPrompt, systemInstruction, extra);
    hitsPerCandidate = hitsByIdx(candidates);
    cleanCount = hitsPerCandidate.filter((h) => h.length === 0).length;
    passes = 2;
  }

  if (candidates.length === 0) {
    throw new Error(
      `[generate-foreword] Generation failed: keine Kandidaten nach ${passes} Pass(es)`
    );
  }

  // Winner: sauberer Kandidat bevorzugt, sonst erster
  const cleanIdx = hitsPerCandidate.findIndex((h) => h.length === 0);
  const winnerIdx = cleanIdx >= 0 ? cleanIdx : 0;
  const winner = candidates[winnerIdx];

  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[generate-foreword] passes=${passes} cleanCount=${cleanCount}/${candidates.length} winnerBannedHits=${hitsPerCandidate[winnerIdx].length} paragraphs=${winner.paragraphs.length}`
    );
  }

  // Stage 1: schnelle Wortlisten-Korrektur (instant, kein API-Call)
  const preCorrected = {
    greeting: cleanField(winner.greeting, 80),
    paragraphs: winner.paragraphs
      .map((p) => cleanParagraph(p))
      .filter((p) => p.length > 0)
      .slice(0, 3),
    pullquote: winner.pullquote ? cleanField(winner.pullquote, 180) : "",
    signoff: cleanField(winner.signoff, 120),
    outro: cleanField(winner.outro, 360),
  };

  // Stage 2: semantische Umlaut-Korrektur via Gemini-Mini-Call.
  // Funktioniert ueber alle String-Felder; paragraphs Array wird einzeln
  // durchgereicht ueber Join+Split.
  let corrected = preCorrected;
  try {
    // correctGermanUmlautsBatch erwartet ein Object mit String-Feldern.
    // Wir packen paragraphs als 3 Einzel-Felder, korrigieren, packen zurueck.
    const flat: Record<string, string> = {
      greeting: preCorrected.greeting,
      signoff: preCorrected.signoff,
      outro: preCorrected.outro,
      pullquote: preCorrected.pullquote,
    };
    preCorrected.paragraphs.forEach((p, i) => {
      flat[`paragraph_${i}`] = p;
    });
    const fixed = await correctGermanUmlautsBatch(flat);
    corrected = {
      greeting: fixed.greeting ?? preCorrected.greeting,
      paragraphs: preCorrected.paragraphs.map(
        (_, i) => fixed[`paragraph_${i}`] ?? preCorrected.paragraphs[i]
      ),
      pullquote: fixed.pullquote ?? preCorrected.pullquote,
      signoff: fixed.signoff ?? preCorrected.signoff,
      outro: fixed.outro ?? preCorrected.outro,
    };
  } catch (err) {
    console.warn(
      "[generate-foreword] Umlaut-Korrektur fehlgeschlagen, nutze Stage-1-Ergebnis:",
      err instanceof Error ? err.message : err
    );
  }

  // Convert flat → Block-Liste. Reihenfolge: greeting → paragraphs →
  // optional pullquote → signoff. Renderer kann den pullquote ggf. zwischen
  // paragraph 0 und 1 bewegen, aber Default ist "vor signoff".
  const blocks: ForewordBlock[] = [];
  blocks.push({ kind: "greeting", text: corrected.greeting });
  corrected.paragraphs.forEach((p) => {
    if (p.trim()) blocks.push({ kind: "paragraph", text: p });
  });
  if (corrected.pullquote.trim()) {
    blocks.push({ kind: "pullquote", text: corrected.pullquote });
  }
  blocks.push({ kind: "signoff", text: corrected.signoff });

  return {
    blocks,
    outro: corrected.outro.trim() ? corrected.outro : undefined,
  };
}
