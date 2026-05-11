import { callGemini, GeminiError } from "./gemini";
import type { ReelRow, ReelClassification } from "@/lib/creator-reels-server";

// Reel-Klassifikator (Phase 2). Gemini Flash bekommt pro Batch 10 Reel-
// Captions und entscheidet:
//   1. Ist das ein Rezept? (vs Talking-Head, Werbung, Reise, Workout-Video)
//   2. Falls ja: meal_type, cuisine, main_ingredient, dietary, time-estimate
//
// Wir nutzen Batch-Calls statt einzelner Calls weil:
//   - Latenz: 50 Reels einzeln = 50 * 3s = 150s; in Batches von 10 = 5 * 4s = 20s
//   - Kosten: ein Batch-Call hat einen System-Instruction-Overhead, dann
//     pro Caption nur ~50-200 tokens. 50 einzelne Calls haetten 50x den
//     System-Overhead.
//   - Quota: Gemini Flash hat Rate-Limits pro Minute, weniger Calls = mehr
//     parallele Brands.
//
// Bei Fehlern (Gemini fail, JSON ungueltig) fallback wir auf
// is_recipe=false fuer alle Reels im Batch — Phase 3 ignoriert sie dann.
// Defensiv: einzelne Reels koennen ueber den deterministic Hashtag-Check
// trotzdem gerettet werden.

const BATCH_SIZE = 10;

// Caption-Snippet-Laenge fuer den Batch-Prompt. 800 chars geben Gemini
// genug Kontext (Rezept, Zutaten, Schritte erkennbar) ohne den Prompt
// aufzublaehen. Volle Captions koennen 2000+ chars haben.
const CAPTION_SNIPPET = 800;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    classifications: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: {
            type: "integer",
            description:
              "Index aus dem Eingabe-Array (0-basiert). MUSS mit der Reihenfolge der Eingabe matchen.",
          },
          isRecipe: {
            type: "boolean",
            description:
              "true wenn der Post ein ausgeschriebenes Rezept enthaelt (Zutaten + Zubereitung erkennbar). false bei Talking-Heads, Workout-Videos, Reise-Content, Werbung ohne Rezept, Foto-Dumps.",
          },
          recipeConfidence: {
            type: "number",
            description: "0..1 — wie sicher ist die Klassifikation als Rezept.",
          },
          recipeTitle: {
            type: "string",
            description:
              'Falls Rezept: ein knapper, lesbarer Titel (z.B. "Protein-Pancakes mit Beeren"). Falls kein Rezept: leerer String.',
          },
          mealType: {
            type: "string",
            enum: [
              "breakfast",
              "lunch",
              "dinner",
              "snack",
              "dessert",
              "drink",
              "unknown",
            ],
            description: "Mahlzeit-Kategorie. unknown wenn kein Rezept.",
          },
          cuisine: {
            type: "string",
            description:
              'Free-form ("italian", "asian", "german", "healthy", "baking", "mediterranean", ...). Leerer String wenn unklar oder kein Rezept.',
          },
          mainIngredient: {
            type: "string",
            description:
              'Wichtigste Zutat ("chicken", "oats", "pasta", "eggs", "potato", "chocolate"). Leerer String wenn kein Rezept.',
          },
          dietary: {
            type: "array",
            items: { type: "string" },
            description:
              'Eigenschaften: "highprotein", "lowcarb", "vegan", "vegetarian", "glutenfree", "lactosefree", "lowcal". Leeres Array moeglich.',
          },
          estimatedTimeMinutes: {
            type: "integer",
            description:
              "Geschaetzte Zubereitungszeit in Minuten (5..240). 0 wenn unklar oder kein Rezept.",
          },
        },
        required: [
          "index",
          "isRecipe",
          "recipeConfidence",
          "recipeTitle",
          "mealType",
          "cuisine",
          "mainIngredient",
          "dietary",
          "estimatedTimeMinutes",
        ],
      },
    },
  },
  required: ["classifications"],
};

const SYSTEM_INSTRUCTION = `Du bist ein Klassifikator fuer Food-Creator-Instagram-Posts.

Aufgabe: Pro Post entscheide, ob es ein RICHTIGES REZEPT ist (Zutaten + Zubereitung in der Caption erkennbar) und extrahiere Meta-Felder fuer die Pack-Generierung.

KRITISCH — was ist KEIN Rezept:
- Talking-Head-Videos ohne Rezept-Text in der Caption
- Workout-Videos, Reise-Vlogs, Lifestyle-Posts
- "Buch erschienen", Produkt-Werbung, Sponsoring-Posts ohne Rezept-Inhalt
- Foto-Dumps ("recap of my week")
- Schritte-Anleitungen ohne Zutaten (z.B. "How to organize your kitchen")

Was IST ein Rezept:
- Caption enthaelt Zutaten-Liste (auch implizit: "200g Quark, 2 Eier, ...")
- Caption beschreibt Zubereitung (auch knapp: "Alles vermengen, 12 Min backen")
- Reel oder Image-Post wo die Zubereitung gezeigt wird UND in der Caption nachvollziehbar steht

mealType-Regeln:
- breakfast: Pancakes, Overnight Oats, Bowls, Eier-Gerichte fuer den Morgen
- lunch: meist herzhafte Mittagsgerichte
- dinner: Abendessen (Pasta, Bowls, Aufstrich, Fleisch-Gerichte)
- snack: kleine herzhafte oder suesse Snacks unter 200 kcal
- dessert: Kuchen, Kekse, Eis, Cheesecakes, Pudding
- drink: Smoothies, Shakes, Drinks
- unknown: nicht eindeutig oder kein Rezept

cuisine-Beispiele: "italian", "asian", "german", "mediterranean", "mexican", "indian", "healthy", "baking", "bbq", "fastfood-makeover". Sei nicht zu kreativ — wenn unklar, leerer String.

dietary-Tags nur wenn aus der Caption ABLEITBAR (Hashtags zaehlen):
- "highprotein": Protein-Pulver, Quark, Skyr, hohe Protein-Werte angegeben
- "lowcarb": ausdruecklich "low carb", "keto", kein Brot/Reis/Pasta
- "vegan": kein tierisches Produkt sichtbar/genannt
- "vegetarian": kein Fleisch/Fisch
- "glutenfree": "gf", "glutenfrei" genannt, oder explizit ohne Mehl

estimatedTimeMinutes: realistische Gesamt-Zubereitungszeit. Pancakes ~15, Pasta ~25, Schmorgerichte ~90, Backwaren ~45. Bei null Info: 0.

Antworte AUSSCHLIESSLICH im JSON-Schema. Reihenfolge im classifications-Array MUSS mit der Eingabe matchen (Index 0..n).`;

function summariseReel(reel: ReelRow, index: number): string {
  const captionSnippet = reel.caption.slice(0, CAPTION_SNIPPET);
  const hashtags = reel.hashtags.slice(0, 15);
  return [
    `[Post ${index}]`,
    `Type: ${reel.type}`,
    reel.posted_at ? `Posted: ${reel.posted_at.slice(0, 10)}` : "",
    reel.like_count ? `Likes: ${reel.like_count}` : "",
    reel.view_count ? `Views: ${reel.view_count}` : "",
    hashtags.length > 0 ? `Hashtags: #${hashtags.join(" #")}` : "",
    `Caption:`,
    captionSnippet,
  ]
    .filter(Boolean)
    .join("\n");
}

type BatchOut = {
  classifications: Array<{
    index: number;
    isRecipe: boolean;
    recipeConfidence: number;
    recipeTitle: string;
    mealType: string;
    cuisine: string;
    mainIngredient: string;
    dietary: string[];
    estimatedTimeMinutes: number;
  }>;
};

// Klassifiziert einen einzelnen Batch (max BATCH_SIZE Reels). Returnt
// ein Map von Reel-ID auf ReelClassification.
async function classifyBatch(
  reels: ReelRow[]
): Promise<Map<string, ReelClassification>> {
  const summaries = reels.map((r, i) => summariseReel(r, i)).join("\n\n---\n\n");
  const prompt = `Klassifiziere folgende ${reels.length} Posts. Liefere fuer jeden Post genau einen Eintrag im classifications-Array, mit dem entsprechenden index (0..${reels.length - 1}).\n\n${summaries}`;

  const result = await callGemini<BatchOut>({
    prompt,
    schema: RESPONSE_SCHEMA,
    systemInstruction: SYSTEM_INSTRUCTION,
    temperature: 0.2,
    maxOutputTokens: 8192,
    thinkingBudget: 0,
    retries: 1,
    model: "flash",
  });

  const map = new Map<string, ReelClassification>();
  for (const c of result.classifications) {
    const reel = reels[c.index];
    if (!reel) continue;
    map.set(reel.id, {
      isRecipe: c.isRecipe,
      recipeConfidence: Math.max(0, Math.min(1, c.recipeConfidence)),
      recipeTitle: c.recipeTitle?.trim() || null,
      mealType:
        c.mealType && c.mealType !== "unknown" ? c.mealType : null,
      cuisine: c.cuisine?.trim() || null,
      mainIngredient: c.mainIngredient?.trim() || null,
      dietary: Array.isArray(c.dietary) ? c.dietary.filter(Boolean) : [],
      estimatedTimeMinutes:
        typeof c.estimatedTimeMinutes === "number" &&
        c.estimatedTimeMinutes > 0
          ? c.estimatedTimeMinutes
          : null,
    });
  }
  return map;
}

// Defensive Fallback-Klassifikation: bei Gemini-Fail markieren wir die
// Reels nicht als is_recipe=null (dann wuerden sie immer wieder re-tried),
// sondern als is_recipe=false mit recipeConfidence=0. Sie tauchen nicht in
// Pack-Vorschlaegen auf, das ist OK fuer den Onboarding-Run. Manueller
// Re-Classify-Trigger kann sie spaeter neu prozessieren.
function defaultMiss(): ReelClassification {
  return {
    isRecipe: false,
    recipeConfidence: 0,
    recipeTitle: null,
    mealType: null,
    cuisine: null,
    mainIngredient: null,
    dietary: [],
    estimatedTimeMinutes: null,
  };
}

// Top-Level: nimmt eine Liste Reels und klassifiziert sie in Batches.
// Returnt Map: reel.id → ReelClassification. Caller persistiert die in
// die DB (update_reel_classification).
export async function classifyReels(
  reels: ReelRow[]
): Promise<Map<string, ReelClassification>> {
  const out = new Map<string, ReelClassification>();
  for (let i = 0; i < reels.length; i += BATCH_SIZE) {
    const batch = reels.slice(i, i + BATCH_SIZE);
    try {
      const batchOut = await classifyBatch(batch);
      // Fuer jeden Reel, der nicht im Batch-Output ist → Fallback.
      for (const r of batch) {
        out.set(r.id, batchOut.get(r.id) ?? defaultMiss());
      }
    } catch (err) {
      console.warn(
        `[classify-reels] batch ${i}-${i + batch.length} failed:`,
        err instanceof Error ? err.message : err,
        err instanceof GeminiError ? `(status=${err.status})` : ""
      );
      for (const r of batch) out.set(r.id, defaultMiss());
    }
  }
  return out;
}
