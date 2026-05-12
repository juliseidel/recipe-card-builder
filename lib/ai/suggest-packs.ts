import { callGemini } from "./gemini";
import type { ReelRow } from "@/lib/creator-reels-server";

// Pack-Vorschlags-Generator (Phase 3). Aus der klassifizierten Reel-
// Library generiert Gemini Pro 10-20 Pack-Konzepte als Vorschlaege fuer
// das Team.
//
// Mix der Vorschlag-Strategien (Ingo's Vision):
//   - Zeit-basiert: "Top-Rezepte Mai 2026", "Sommer-Sammlung 2025"
//   - Kategorie-basiert: "Suesse Backwelt", "Sattmacher", "Schnelle Snacks"
//   - Ingredient-basiert: "Alles mit Haehnchen", "Pasta-Klassiker"
//   - Engagement-basiert: "Top 12 meistgesehene Reels"
//   - Diet-basiert: "High-Protein-Sammlung"
//
// Ein Reel kann in mehreren Packs vorkommen — Ueberlappung ist OK, der
// User waehlt ja welche er annimmt. Mindestens 5, maximal 15 Reels pro
// Pack (Pack-Detail-Page funktioniert mit dieser Spanne sauber).
//
// Wir geben Gemini eine kompakte Sicht: pro Reel nur die wichtigsten
// Felder (id, posted_at, title, meal_type, cuisine, main_ingredient,
// dietary, likes/views, eine Caption-Zusammenfassung in 1 Satz). Das
// haelt den Prompt klein selbst bei 500 Reels.

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
              'Kurzer, einpraegsamer Pack-Titel auf Deutsch. Max 40 chars. Beispiele: "Suesse Backwelt", "Top 12 Mai 2026", "Schnelle Frueh stuecke", "Sattmacher unter 600 kcal".',
          },
          subtitle: {
            type: "string",
            description:
              "Ein Satz Untertitel (max 80 chars), der das Pack-Versprechen scharf macht.",
          },
          tagline: {
            type: "string",
            description:
              "Kurzer Teaser (max 120 chars) — nennt 2-3 konkrete Recipe-Titles aus der Auswahl, kommagetrennt.",
          },
          description: {
            type: "string",
            description:
              "2 Saetze auf Deutsch, was das Pack auszeichnet und fuer wen es gedacht ist.",
          },
          category: {
            type: "string",
            description:
              'Eine Kategorie-Bezeichnung ("Fruehstueck", "Snacks", "Backen", "Mittagessen", "Saison", "Top Reels").',
          },
          reelIds: {
            type: "array",
            items: { type: "string" },
            description:
              "Die ID-Werte (UUIDs) der Reels, die in dieses Pack gehoeren. 5-15 Reels pro Pack. Die IDs MUESSEN exakt aus dem Input stammen.",
          },
          reasoning: {
            type: "string",
            description:
              'Ein Satz auf Deutsch, warum diese Auswahl: "Top 12 Reels mit den meisten Likes aus Mai 2026", "Alle Cheesecake-Varianten der letzten 12 Monate", etc.',
          },
          score: {
            type: "number",
            description:
              "0..1 — wie stark glaubst du, dass das Team dieses Pack haben will. Top-Engagement-Packs hoch (0.9+), nischige Sammlungen niedriger (0.5).",
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

const SYSTEM_INSTRUCTION = `Du bist ein Pack-Strategist fuer einen Food-Creator-Recipe-Pack-Generator.

Aufgabe: Aus einer Liste von ${"<"}N${">"} klassifizierten Rezept-Reels schlaegst du 10-20 Pack-Konzepte vor, die das Team mit einem Klick anlegen kann.

Strategie-Mix (MOEGLICHST diverse Auswahl):
1. ZEIT-BASIERT: "Top 12 Reels aus Mai 2026" — nimm die ~12 mit den meisten Likes/Views aus dem letzten Monat, dem vorletzten Monat, dem aktuellen Jahr.
2. KATEGORIE-BASIERT: alle Frueh stuecke, alle Desserts, alle Snacks, alle Mittagsgerichte — wenn mindestens 5 Reels in der Kategorie sind.
3. INGREDIENT-BASIERT: alle mit Haehnchen, alle Pasta-Rezepte, alle Cheesecakes, alle Bowls — wenn mindestens 5 Reels.
4. DIET-BASIERT: High-Protein-Sammlung, vegane Sammlung, low-carb-Sammlung — wenn mindestens 5 Reels mit dem Tag.
5. ENGAGEMENT-BASIERT: "Top 10 Most-Loved" — die 10 mit der hoechsten Engagement-Rate ueber alle Zeit.
6. SAISONAL: "Sommer-Sammlung", "Winter-Comfort" — bei klarer Saison-Signatur.

REGELN:
- Mindestens 5, maximal 15 Reels pro Pack. Cluster mit weniger als 5 Reels: ueberspringen.
- Ein Reel darf in MEHREREN Packs sein (das ist gewollt).
- Pack-Titel sind auf Deutsch, kurz und knackig (max 40 chars).
- reelIds muessen exakt aus dem Input-Array stammen — wenn ein Reel nicht in der Input-Liste ist, NICHT auf erfinden.
- Diversitaet: nicht 10 Pack-Vorschlaege gleicher Strategie. Wenn das Profil nur 80 Reels hat, lieber 8 gute Packs als 15 ueberlappende.
- score: Engagement-basierte Packs (Top Reels) bekommen hoch (0.85+), thematische Sammlungen mittel (0.6-0.8), nischig (0.4-0.6).

Antworte AUSSCHLIESSLICH im JSON-Schema. Keine Erklaerung ausserhalb des JSON.`;

// Kompakte Reel-Repraesentation fuer den Prompt. Wir wollen alle Felder,
// die fuer Cluster-Bildung gebraucht werden, aber nicht die volle Caption
// (zu viel Tokens). Eine 1-Satz-Caption-Zusammenfassung reicht — das
// recipe_title aus der Klassifikation ist schon eine.
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

export async function suggestPacks(opts: {
  brandName: string;
  recipeReels: ReelRow[];
}): Promise<PackSuggestion[]> {
  // Below 5 recipes there's no meaningful pack to build.
  if (opts.recipeReels.length < 5) return [];

  // Bei sehr grossen Libraries (>200 Reels) capen wir auf die 200
  // engagementstaerksten — Gemini Pro hat Input-Token-Limits, plus die
  // Vorschlaege werden besser, wenn der Input pre-gefiltert ist auf "das
  // was die Audience tatsaechlich liebt".
  const sorted = [...opts.recipeReels].sort((a, b) => {
    const aEng = (a.like_count ?? 0) + (a.view_count ?? 0) / 10;
    const bEng = (b.like_count ?? 0) + (b.view_count ?? 0) / 10;
    return bEng - aEng;
  });
  const slice = sorted.slice(0, 200);
  const promptLines = slice.map((r) => reelToPromptLine(r)).join("\n");

  const today = new Date().toISOString().slice(0, 10);
  const result = await callGemini<{ suggestions: PackSuggestion[] }>({
    prompt: `Brand: ${opts.brandName}
Heutiges Datum: ${today}
Anzahl Rezept-Reels: ${opts.recipeReels.length} (im Input gezeigt: ${slice.length} top-engagement)

Reels (eine Zeile pro Reel):
${promptLines}

Generiere 10-20 Pack-Vorschlaege im JSON-Schema.`,
    schema: RESPONSE_SCHEMA,
    systemInstruction: SYSTEM_INSTRUCTION,
    temperature: 0.5,
    maxOutputTokens: 16384,
    // Pro → Flash umgestellt (Mai 2026): Flash 2.5 mit moderatem Thinking-
    // Budget liefert vergleichbare Pack-Konzepte fuer ein Drittel der
    // Kosten. Ca. $0.10-0.15 statt $0.40-0.80 pro Onboarding.
    thinkingBudget: 1024,
    retries: 1,
    model: "flash",
  });

  // Sicherheits-Filter: nur Suggestions mit existierenden reelIds + min
  // 5 Reels durchlassen. Gemini halluziniert manchmal IDs.
  const validIds = new Set(opts.recipeReels.map((r) => r.id));
  return result.suggestions
    .map((s) => ({
      ...s,
      reelIds: s.reelIds.filter((id) => validIds.has(id)),
    }))
    .filter((s) => s.reelIds.length >= 5)
    .slice(0, 20);
}
