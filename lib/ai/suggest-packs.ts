import { callGemini } from "./gemini";
import type { ReelRow } from "@/lib/creator-reels-server";
import type { Brand } from "@/lib/brands";
import {
  formatVoiceProfileForPrompt,
  formatCaptionFewShot,
  ensureBrandVoiceProfile,
} from "./analyze-voice-profile";
import { findBannedPhrases, buildAvoidHint } from "./banned-phrases";

// Pack-Vorschlags-Generator (Phase 3 — beim Onboarding-Backfill).
//
// Aus der klassifizierten Reel-Library generiert Gemini Flash 10-20
// Pack-Konzepte als Vorschlaege fuer das Team — pro Onboarding einmalig.
//
// Diese Pipeline ist anders aufgebaut als generatePackMeta /
// suggestPackDesign: hier kommen MEHRERE Suggestions aus EINEM Call.
// Multi-Candidate macht hier weniger Sinn (würde 30-60 Suggestions
// produzieren und ist zu teuer beim Onboarding). Stattdessen:
//   - Voice-Profil + Few-Shot mit echten Captions in Prompt
//   - Post-Generation: Banned-Phrases-Filter pro Suggestion
//   - Wenn weniger als 5 saubere Suggestions zurueckkommen: Retry-Pass
//     mit explizitem "AVOID:"-Hint
//
// Brand-agnostisch by design: keine hardcoded Vorlieben.

export type PackSuggestion = {
  title: string;
  subtitle: string;
  tagline: string;
  description: string;
  category: string;
  reelIds: string[];
  reasoning: string;
  score: number;
};

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description:
              "Pack-Titel, 15-40 chars. Knackig, konkret. KEINE Marketing-Floskeln.",
          },
          subtitle: {
            type: "string",
            description:
              "Ein Satz Untertitel, 20-80 chars. Schaerft das Pack-Versprechen.",
          },
          tagline: {
            type: "string",
            description:
              "Teaser mit 2-3 KONKRETEN Recipe-Titles aus der Liste, kommagetrennt. 30-120 chars.",
          },
          description: {
            type: "string",
            description:
              "2 Saetze in der Stimme des Creators, 140-260 chars. Was zeichnet das Pack aus, fuer wen ist es gedacht. Konkret auf 1-2 Rezepte beziehen.",
          },
          category: {
            type: "string",
            description:
              "Kategorie-Bezeichnung (Frühstück, Snacks, Backen, Mittagessen, Saison, Top Reels).",
          },
          reelIds: {
            type: "array",
            items: { type: "string" },
            description:
              "Die UUIDs der Reels, die in dieses Pack gehoeren. 5-15 Reels pro Pack. IDs MUESSEN exakt aus dem Input stammen.",
          },
          reasoning: {
            type: "string",
            description:
              "Ein Satz, warum diese Auswahl gut zusammenpasst.",
          },
          score: {
            type: "number",
            description:
              "0..1 — wie stark glaubst du, dass das Team dieses Pack haben will.",
          },
        },
        required: [
          "title",
          "subtitle",
          "tagline",
          "description",
          "category",
          "reelIds",
          "reasoning",
          "score",
        ],
      },
    },
  },
  required: ["suggestions"],
};

function buildSystemInstruction(brand: Brand | null, brandName: string): string {
  const voiceBlock = formatVoiceProfileForPrompt(brand?.voiceProfile, brandName);
  const fewShotBlock = formatCaptionFewShot(brand?.voiceProfile);

  return `Du bist ein Pack-Strategist fuer einen Food-Creator-Recipe-Pack-Generator.

${voiceBlock}

${fewShotBlock}

AUFGABE: Aus einer Liste klassifizierter Rezept-Reels schlaegst du 10-20 Pack-Konzepte vor, die das Team mit einem Klick anlegen kann. Alle Texte (Title, Subtitle, Tagline, Description) klingen wie ${brandName} selbst — nicht wie generische KI.

STRATEGIE-MIX (moeglichst diverse Auswahl):
1. ZEIT-BASIERT: "Top 12 Reels aus Mai 2026" — nimm die ~12 mit den meisten Likes/Views aus dem letzten Monat, dem vorletzten Monat, dem aktuellen Jahr.
2. KATEGORIE-BASIERT: alle Frueh-Stuecke, Desserts, Snacks, Mittagsgerichte — wenn min 5 Reels in der Kategorie.
3. INGREDIENT-BASIERT: alle mit Haehnchen, Pasta, Cheesecakes, Bowls — wenn min 5 Reels.
4. DIET-BASIERT: High-Protein, vegan, low-carb — wenn min 5 Reels mit dem Tag.
5. ENGAGEMENT-BASIERT: "Top 10 Most-Loved" ueber alle Zeit.
6. SAISONAL: "Sommer-Sammlung", "Winter-Comfort" — bei klarer Saison-Signatur.

PACK-TEXT-REGELN (gelten fuer ALLE 10-20 Suggestions):
- Pack-Titel: 15-40 chars, knackig, in der Sprache/Stimme des Creators
- KEINE Marketing-Floskeln: "perfekt fuer...", "die besten...", "angesagteste...", "must-have", "Lass dich inspirieren"
- KEINE Emojis, Hashtags, Anfuehrungszeichen, Em-Dashes (—)
- Tagline: nennt 2-3 ECHTE Rezeptnamen aus der gelieferten Liste
- Description: 2 Saetze in ${brandName}s Stimme, bezieht sich konkret auf 1-2 Rezepte

STRUKTUR-REGELN:
- Mindestens 5, maximal 15 Reels pro Pack. Cluster mit <5 Reels: ueberspringen.
- Ein Reel darf in MEHREREN Packs sein.
- reelIds muessen exakt aus dem Input-Array stammen — KEINE neuen UUIDs erfinden.
- Diversitaet: wenn nur 80 Reels da sind, lieber 8 gute Packs als 15 ueberlappende.
- score: Engagement-basierte Packs (Top Reels) hoch (0.85+), thematische Sammlungen mittel (0.6-0.8), nischig (0.4-0.6).

Antworte AUSSCHLIESSLICH im JSON-Schema. Keine Erklaerung ausserhalb des JSON.`;
}

function reelToPromptLine(r: ReelRow): string {
  const dateLabel = r.posted_at ? r.posted_at.slice(0, 10) : "—";
  const eng =
    r.like_count !== null || r.view_count !== null
      ? `lk=${r.like_count ?? 0}/v=${r.view_count ?? 0}`
      : "";
  const dietary = r.dietary?.length ? r.dietary.join(",") : "";
  return [
    `id=${r.id}`,
    `d=${dateLabel}`,
    eng,
    `t="${(r.recipe_title ?? "").slice(0, 80)}"`,
    r.meal_type ? `meal=${r.meal_type}` : "",
    r.cuisine ? `c=${r.cuisine}` : "",
    r.main_ingredient ? `ing=${r.main_ingredient}` : "",
    dietary ? `diet=${dietary}` : "",
    r.estimated_time_minutes ? `${r.estimated_time_minutes}min` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

function buildUserPrompt(opts: {
  brandName: string;
  reels: ReelRow[];
  shown: ReelRow[];
  extraInstruction?: string;
}): string {
  const today = new Date().toISOString().slice(0, 10);
  const promptLines = opts.shown.map((r) => reelToPromptLine(r)).join("\n");
  const extra = opts.extraInstruction ? `\n\n${opts.extraInstruction}\n` : "";

  return `Brand: ${opts.brandName}
Heutiges Datum: ${today}
Anzahl Rezept-Reels: ${opts.reels.length} (im Input gezeigt: ${opts.shown.length} top-engagement)
${extra}
Reels (eine Zeile pro Reel):
${promptLines}

Generiere 10-20 Pack-Vorschlaege im JSON-Schema.`;
}

function filterAndValidate(
  raw: PackSuggestion[],
  validReelIds: Set<string>,
  brandBannedPhrases: string[]
): { clean: PackSuggestion[]; dirty: PackSuggestion[] } {
  const clean: PackSuggestion[] = [];
  const dirty: PackSuggestion[] = [];

  for (const s of raw) {
    // Reel-ID-Halluzinationen ausfiltern
    const filteredIds = s.reelIds.filter((id) => validReelIds.has(id));
    if (filteredIds.length < 5) continue;
    const candidate = { ...s, reelIds: filteredIds };

    // Banned-Phrases-Check
    const textBlob = `${s.title} ${s.subtitle} ${s.tagline} ${s.description}`;
    const hits = findBannedPhrases(textBlob, brandBannedPhrases);
    if (hits.length === 0) {
      clean.push(candidate);
    } else {
      dirty.push(candidate);
    }
  }
  return { clean, dirty };
}

export async function suggestPacks(opts: {
  brandName: string;
  recipeReels: ReelRow[];
  /** Voller Brand fuer Voice-Profil-Zugriff. Wenn null/undefined: Pipeline
   *  funktioniert mit generic-Defaults. */
  brand?: Brand | null;
}): Promise<PackSuggestion[]> {
  if (opts.recipeReels.length < 5) return [];

  // Pre-Filter: Top-200 nach Engagement, damit Gemini Token-Budget reicht
  const sorted = [...opts.recipeReels].sort((a, b) => {
    const aEng = (a.like_count ?? 0) + (a.view_count ?? 0) / 10;
    const bEng = (b.like_count ?? 0) + (b.view_count ?? 0) / 10;
    return bEng - aEng;
  });
  const slice = sorted.slice(0, 200);
  const validIds = new Set(opts.recipeReels.map((r) => r.id));

  // Lazy-Backfill: wenn der Brand kein Voice-Profil hat, leiten wir es
  // jetzt aus den DB-Captions ab + persistieren. Bei suggestPacks ist das
  // typisch unnoetig (laeuft direkt nach Onboarding wo voiceProfile schon
  // synchron gesetzt wurde), aber es schadet nicht und covered manuelle
  // Re-Suggester-Triggers fuer alte Brands.
  const brandWithVoice = await ensureBrandVoiceProfile(opts.brand);
  const brandBanned = brandWithVoice?.voiceProfile?.bannedPhrases ?? [];

  // Pass 1: normal generation
  const system = buildSystemInstruction(brandWithVoice, opts.brandName);
  const firstPrompt = buildUserPrompt({
    brandName: opts.brandName,
    reels: opts.recipeReels,
    shown: slice,
  });

  let raw: PackSuggestion[] = [];
  try {
    const result = await callGemini<{ suggestions: PackSuggestion[] }>({
      prompt: firstPrompt,
      schema: RESPONSE_SCHEMA,
      systemInstruction: system,
      temperature: 0.55,
      maxOutputTokens: 16384,
      thinkingBudget: 1024,
      retries: 1,
      model: "flash",
    });
    raw = result.suggestions ?? [];
  } catch (err) {
    console.warn(
      "[suggest-packs] pass 1 failed:",
      err instanceof Error ? err.message : err
    );
    raw = [];
  }

  let { clean, dirty } = filterAndValidate(raw, validIds, brandBanned);

  // Wenn zu wenige saubere Suggestions: Retry-Pass mit Avoid-Hint
  if (clean.length < 5 && raw.length > 0) {
    const observedFloskel = dirty
      .slice(0, 4)
      .flatMap((s) =>
        findBannedPhrases(
          `${s.title} ${s.subtitle} ${s.description}`,
          brandBanned
        ).map((h) => h.phrase)
      )
      .slice(0, 8);
    const avoidHint = buildAvoidHint(brandBanned);
    const extra = observedFloskel.length
      ? `${avoidHint}\n\nDein vorheriger Versuch hatte diese Probleme: ${observedFloskel.map((p) => `"${p}"`).join(", ")}. Schreibe es komplett anders.`
      : avoidHint;

    try {
      const retry = await callGemini<{ suggestions: PackSuggestion[] }>({
        prompt: buildUserPrompt({
          brandName: opts.brandName,
          reels: opts.recipeReels,
          shown: slice,
          extraInstruction: extra,
        }),
        schema: RESPONSE_SCHEMA,
        systemInstruction: system,
        temperature: 0.65,
        maxOutputTokens: 16384,
        thinkingBudget: 1024,
        retries: 1,
        model: "flash",
      });
      const retryRaw = retry.suggestions ?? [];
      const retryFiltered = filterAndValidate(retryRaw, validIds, brandBanned);
      // Mergen: erst saubere aus Retry, dann saubere aus Pass 1, dann
      // dreckige als Fallback (nur wenn wir sonst <5 haetten)
      clean = [...retryFiltered.clean, ...clean];
      dirty = [...retryFiltered.dirty, ...dirty];
    } catch (err) {
      console.warn(
        "[suggest-packs] retry pass failed:",
        err instanceof Error ? err.message : err
      );
    }
  }

  // Final: saubere zuerst, dann dreckige als Notnagel (auf 20 capped)
  const final = clean.length >= 5 ? clean : [...clean, ...dirty];

  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[suggest-packs] clean=${clean.length} dirty=${dirty.length} final=${Math.min(final.length, 20)}`
    );
  }

  return final.slice(0, 20);
}
