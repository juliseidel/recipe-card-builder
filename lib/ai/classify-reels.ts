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
          occasion: {
            type: "string",
            enum: [
              "mealprep",
              "quick-weeknight",
              "cozy",
              "gameday",
              "brunch",
              "family-dinner",
              "date-night",
              "summer-bbq",
              "festive",
              "sunday-baking",
              "post-workout",
              "lazy-morning",
              "",
            ],
            description:
              "Wann wuerde man dieses Rezept machen? Nur EIN Hauptanlass. Leerer String wenn unklar oder kein Rezept.",
          },
          season: {
            type: "string",
            enum: ["spring", "summer", "autumn", "winter", "year-round", ""],
            description:
              'Saison-Kontext. "year-round" = passt jederzeit. Leerer String wenn kein Rezept.',
          },
          skillLevel: {
            type: "string",
            enum: ["beginner", "intermediate", "advanced", ""],
            description:
              "Schwierigkeit: beginner = wenige Zutaten + simple Schritte, intermediate = mehrere Komponenten, advanced = Backen/Teig/Technik. Leer wenn unklar.",
          },
          vessel: {
            type: "string",
            enum: [
              "bowl",
              "pan",
              "sheet",
              "airfryer",
              "mug",
              "mixer",
              "oven",
              "pot",
              "no-cook",
              "grill",
              "blender",
              "",
            ],
            description:
              "Hauptgefaess/Methode. bowl = Bowl/Schuessel-Gericht, sheet = Backblech, no-cook = ohne Kochen. Leer wenn unklar.",
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
          "occasion",
          "season",
          "skillLevel",
          "vessel",
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

cuisine-Werte (Controlled Vocabulary, exakt einer dieser Strings oder leer): "italian", "asian", "german", "mediterranean", "mexican", "indian", "american", "middle-eastern", "french", "healthy", "baking", "bbq", "fastfood-makeover", "comfort-food". Wenn unklar oder kein Rezept: leerer String. Sei NICHT zu kreativ — waehle den nahesten Bucket.

mainIngredient-Buckets (Controlled Vocabulary): "chicken", "beef", "pork", "fish", "seafood", "tofu", "eggs", "oats", "pasta", "rice", "potato", "quark", "skyr", "chocolate", "berries", "apple", "banana", "vegetables", "legumes", "cheese", "bread", "nuts", "yogurt", "noodles", "flour-baking". Waehle den dominierenden Bucket. Leer wenn unklar.

dietary-Tags nur wenn aus der Caption ABLEITBAR (Hashtags zaehlen). Mehrere moeglich, als Array:
- "highprotein": Protein-Pulver, Quark, Skyr, hohe Protein-Werte angegeben
- "lowcarb": ausdruecklich "low carb", "keto", kein Brot/Reis/Pasta
- "lowcal": unter ~300 kcal pro Portion / "kalorienarm" / "light"
- "vegan": kein tierisches Produkt sichtbar/genannt
- "vegetarian": kein Fleisch/Fisch
- "glutenfree": "gf", "glutenfrei", explizit ohne Mehl
- "dairyfree": ohne Milchprodukte / "laktosefrei" (Skyr/Quark/Kaese disqualifizieren)
- "sugarfree": "ohne Zucker", "zuckerfrei", nur natuerliche Suesse (Banane, Datteln)
- "nutfree": explizit "nussfrei"

estimatedTimeMinutes: realistische Gesamt-Zubereitungszeit. Pancakes ~15, Pasta ~25, Schmorgerichte ~90, Backwaren ~45. Bei null Info: 0.

occasion-Regeln (waehle den BESTEN Hauptanlass, nicht mehrere):
- mealprep: explizit "Mealprep", Schmorgerichte mit grosser Menge, "Sonntag vorbereiten", aufgeteilt in Boxen
- quick-weeknight: 5-30 Min, Werktags-tauglich, ein-Topf, kein Aufwand ("Feierabend", "easy")
- cozy: Suppe, Eintopf, Aufstrich, deftig-warm, Herbst/Winter-Vibes
- gameday: Snacks, Dips, Wings, Loaded-Fries, fingerfood-style
- brunch: Pancakes, Waffeln, French-Toast, Eggs Benedict, Aufstrich, Wochenend-Fruehstueck
- family-dinner: groessere Mengen, klassisch (Pasta Bolognese, Lasagne, Auflaeufe)
- date-night: aufwendiger, "Restaurant-Feeling", Steak, Pasta-Klassiker, Dessert
- summer-bbq: Grill, Salate, frische Sommer-Bowls, Aussen-Cooking
- festive: Weihnachten, Ostern, Geburtstag, Show-Off-Kuchen
- sunday-baking: ruhiges Backen, Hefeteig, Kuchen, Cookies, Donuts
- post-workout: explizit "nach dem Sport", high-protein shakes, recovery
- lazy-morning: gemuetliche Fruehstuecke, Overnight-Oats, slow-vibes

season: Pancakes / Bowls / Salate ohne expliziten Saison-Bezug = "year-round". Sommer-Salate, Eis, Smoothies = "summer". Suppen, Eintoepfe, Glueh-Drinks = "winter". Spargel, Rhabarber = "spring". Kuerbis, Apfel, Pflaumen, Pumpkin-Spice = "autumn".

skillLevel:
- beginner: <=6 Zutaten, simple Schritte (mischen, anbraten, ofen rein), keine Technik
- intermediate: 7-15 Zutaten, mehrere Komponenten, mehrere Schritte
- advanced: Hefeteig, Macarons, Patisserie, Sauce Hollandaise, Souffle, fortgeschrittene Technik

vessel (Hauptgefaess waehrend der Hauptzubereitung):
- bowl: Bowl/Schuessel-Gericht zum Servieren
- pan: Pfanne (anbraten, schmoren)
- sheet: Backblech (Sheet-Pan-Dinner, Ofengemuese)
- airfryer: explizit Airfryer/Heissluft-Fritteuse
- mug: Mug-Cake, Tasse als Gefaess
- mixer: Standmixer (Hauptarbeit dort)
- oven: Ofen (Aufläufe, Cheesecake, Brot, Pizza, Lasagne)
- pot: Topf (Pasta-Wasser, Suppen, Schmorgerichte)
- no-cook: keine Hitze ueberhaupt (Energy-Balls, Tartar, Bowls aus rohen Zutaten)
- grill: Grill
- blender: Smoothies, Shakes

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
    occasion: string;
    season: string;
    skillLevel: string;
    vessel: string;
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
      occasion: c.occasion?.trim() || null,
      season: c.season?.trim() || null,
      skillLevel: c.skillLevel?.trim() || null,
      vessel: c.vessel?.trim() || null,
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
    occasion: null,
    season: null,
    skillLevel: null,
    vessel: null,
  };
}

// Top-Level: nimmt eine Liste Reels und klassifiziert sie in Batches.
// Returnt Map: reel.id → ReelClassification. Caller persistiert die in
// die DB (update_reel_classification).
//
// Parallelisierung: 5 Batches gleichzeitig (Promise.all). Gemini-Flash-
// Rate-Limits sind grosszuegig (60 RPM bei Free-Tier, 1000 RPM bei Paid),
// 5 parallele Calls liegen klar unter dem Limit. Speed-Gain: bei 50
// Reels (5 Batches) Klassifikation von ~10s sequenziell auf ~2s parallel.
const PARALLEL_BATCHES = 5;

export async function classifyReels(
  reels: ReelRow[]
): Promise<Map<string, ReelClassification>> {
  const out = new Map<string, ReelClassification>();

  // Alle Batches vorab erstellen
  const batches: ReelRow[][] = [];
  for (let i = 0; i < reels.length; i += BATCH_SIZE) {
    batches.push(reels.slice(i, i + BATCH_SIZE));
  }

  // Batches in Gruppen von PARALLEL_BATCHES parallel verarbeiten.
  // Wenn ein einzelner Batch failed, betrifft das nur die 10 Reels darin
  // (defaultMiss), die anderen 40 in der Gruppe gehen durch.
  for (let g = 0; g < batches.length; g += PARALLEL_BATCHES) {
    const groupBatches = batches.slice(g, g + PARALLEL_BATCHES);
    const groupResults = await Promise.all(
      groupBatches.map(async (batch, idx) => {
        try {
          const batchOut = await classifyBatch(batch);
          return { batch, batchOut, error: null };
        } catch (err) {
          console.warn(
            `[classify-reels] parallel batch ${g + idx} failed:`,
            err instanceof Error ? err.message : err,
            err instanceof GeminiError ? `(status=${err.status})` : ""
          );
          return { batch, batchOut: null, error: err };
        }
      })
    );

    for (const { batch, batchOut } of groupResults) {
      for (const r of batch) {
        if (batchOut) {
          out.set(r.id, batchOut.get(r.id) ?? defaultMiss());
        } else {
          out.set(r.id, defaultMiss());
        }
      }
    }
  }

  return out;
}
