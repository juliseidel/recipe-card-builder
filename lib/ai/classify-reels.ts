import { callGemini, GeminiError } from "./gemini";
import type { ReelRow, ReelClassification } from "@/lib/creator-reels-server";

// Reel-Klassifikator (Phase 2c, 2026-05-19). Gemini Flash bekommt pro Batch
// 10 Reel-Captions und entscheidet:
//   1. contentType: recipe | exercise | workout | mindset | tutorial |
//      transformation | vlog | other
//   2. Falls contentType='recipe': mealType, cuisine, mainIngredient,
//      dietary, time, occasion, season, skillLevel, vessel
//   3. Falls contentType IN ('exercise','workout'): workoutType, bodyParts,
//      equipment, trainingSetting, trainingGoal, fitnessLevel, duration
//
// is_recipe (alter Bool) wird automatisch aus contentType abgeleitet:
// is_recipe = (contentType === 'recipe'). So bleiben alle alten Filter
// (getRecipeReelsForBrand, Auto-Pack-UI, etc.) backward-compatible.
//
// Wir nutzen Batch-Calls statt einzelner Calls weil:
//   - Latenz: 50 Reels einzeln = 50 * 3s = 150s; in Batches von 10 = 5 * 4s = 20s
//   - Kosten: ein Batch-Call hat einen System-Instruction-Overhead, dann
//     pro Caption nur ~50-200 tokens. 50 einzelne Calls haetten 50x den
//     System-Overhead.
//   - Quota: Gemini Flash hat Rate-Limits pro Minute, weniger Calls = mehr
//     parallele Brands.
//
// Bei Fehlern (Gemini fail, JSON ungueltig) markieren wir den Batch als
// CLASSIFICATION_FAILED — Caller schreibt nichts in die DB, naechster
// Resume probiert es erneut. Verhindert Daten-Zerstoerung bei Gemini-Fail.

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
          contentType: {
            type: "string",
            enum: [
              "recipe",
              "exercise",
              "workout",
              "mindset",
              "tutorial",
              "transformation",
              "vlog",
              "other",
            ],
            description:
              "Was fuer ein Content ist das Reel? recipe=Rezept mit Zutaten+Zubereitung; exercise=einzelne Uebungs-Demo (eine Bewegung mit Form-Cues); workout=kompletter Workout-Block mit mehreren Uebungen+Reihenfolge; mindset=motivationaler Text/Pull-Quote-Material; tutorial=How-To ohne Rezept/Workout (Mealprep-Tipps, Kueche organisieren); transformation=Vorher/Nachher/Progress; vlog=Lifestyle/Day-in-Life/Reise; other=Werbung/Foto-Dump/nicht klassifizierbar. EXAKT EIN Wert.",
          },
          recipeConfidence: {
            type: "number",
            description:
              "0..1 — wie sicher ist die Klassifikation als Rezept. Bei contentType!='recipe': 0.",
          },
          recipeTitle: {
            type: "string",
            description:
              'Falls contentType="recipe": knapper Titel ("Protein-Pancakes mit Beeren"). Falls contentType="exercise": Uebungs-Name ("Wall Ball", "Sled Push"). Falls contentType="workout": Workout-Name ("Push-Day 1", "Full-Body HIIT"). Sonst leerer String.',
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
            description: "Nur bei contentType='recipe' gesetzt. unknown sonst.",
          },
          cuisine: {
            type: "string",
            description:
              "Controlled Vocabulary. Nur bei contentType='recipe'. Sonst leer.",
          },
          mainIngredient: {
            type: "string",
            description:
              "Controlled Vocabulary. Nur bei contentType='recipe'. Sonst leer.",
          },
          dietary: {
            type: "array",
            items: { type: "string" },
            description:
              "Nur bei contentType='recipe'. Sonst leeres Array.",
          },
          estimatedTimeMinutes: {
            type: "integer",
            description:
              "Zubereitungszeit (Recipe) in Minuten. 0 wenn nicht-recipe.",
          },
          occasion: {
            type: "string",
            description: "Recipe-Anlass. Nur bei contentType='recipe'.",
          },
          season: {
            type: "string",
            description: "Recipe-Saison. Nur bei contentType='recipe'.",
          },
          skillLevel: {
            type: "string",
            description:
              "Recipe-Schwierigkeit. Nur bei contentType='recipe'. (Fuer Fitness-Skill siehe fitnessLevel.)",
          },
          vessel: {
            type: "string",
            description: "Recipe-Gefaess/Methode. Nur bei contentType='recipe'.",
          },
          // ─── Fitness-Felder (Phase 2c) — nur bei contentType IN
          //     ('exercise','workout') sinnvoll gesetzt; sonst leer/0/[]
          workoutType: {
            type: "string",
            enum: [
              "strength",
              "cardio",
              "hiit",
              "functional",
              "mobility",
              "pilates",
              "yoga",
              "posing",
              "rehab",
              "calisthenics",
              "",
            ],
            description:
              "Trainings-Typ. Nur bei contentType IN (exercise, workout). strength=Krafttraining/Hypertrophie; cardio=Ausdauer-Steady-State; hiit=High-Intensity-Intervals; functional=Hyrox/CrossFit/Hybrid; mobility=Beweglichkeit/Stretching; pilates=Pilates/Barre; yoga=Yoga; posing=Bodybuilding-Posing; rehab=Reha/Verletzung; calisthenics=Bodyweight/Street. Leer wenn unklar oder nicht-Fitness.",
          },
          bodyParts: {
            type: "array",
            items: { type: "string" },
            description:
              "Trainierte Muskelgruppen als Array. Werte: chest, back, shoulders, arms, legs, glutes, core, full-body, cardio-conditioning. Mehrere moeglich. Leer wenn nicht-Fitness.",
          },
          equipment: {
            type: "array",
            items: { type: "string" },
            description:
              "Equipment als Array. Werte: none, dumbbell, barbell, kettlebell, machine, cable, bands, bodyweight, sled, ski-erg, rower, wall-ball, sandbag, outdoor, studio, mixed. Leer wenn nicht-Fitness.",
          },
          trainingSetting: {
            type: "string",
            enum: [
              "home",
              "commercial-gym",
              "studio",
              "functional-gym",
              "outdoor",
              "stage",
              "",
            ],
            description:
              "Wo trainiert. home=zuhause; commercial-gym=Fitnessstudio (FitX/McFit); studio=Pilates-/Yoga-Studio; functional-gym=CrossFit-Box/Hyrox; outdoor=Park/Strasse/Trail; stage=Bodybuilding-Buehne. Leer wenn unklar.",
          },
          trainingGoal: {
            type: "string",
            enum: [
              "hypertrophy",
              "fat-loss",
              "strength",
              "endurance",
              "mobility",
              "aesthetic",
              "performance",
              "posture",
              "longevity",
              "",
            ],
            description:
              "Trainings-Ziel. hypertrophy=Muskelaufbau; fat-loss=Abnehmen; strength=Maximalkraft; endurance=Ausdauer; mobility=Beweglichkeit; aesthetic=Optik/Bikini-Fitness; performance=Wettkampf (Hyrox, BB-Comp); posture=Haltung; longevity=Gesundheit/Anti-Aging. Leer wenn unklar.",
          },
          fitnessLevel: {
            type: "string",
            enum: ["beginner", "intermediate", "advanced", "pro", ""],
            description:
              "Schwierigkeit der Uebung/Workout. Leer wenn unklar oder nicht-Fitness.",
          },
          durationMinutes: {
            type: "integer",
            description:
              "Workout-Dauer in Minuten (NICHT Recipe-Zubereitungszeit). 0 wenn unklar oder nicht-Workout.",
          },
        },
        required: [
          "index",
          "contentType",
          "recipeConfidence",
          "recipeTitle",
          "mealType",
          "cuisine",
          "mainIngredient",
          "dietary",
          "estimatedTimeMinutes",
          // Fitness- und erweiterte Recipe-Felder sind optional — Gemini darf
          // sie weglassen wenn unklar oder Kategorie nicht passt.
        ],
      },
    },
  },
  required: ["classifications"],
};

const SYSTEM_INSTRUCTION = `Du bist ein Klassifikator fuer Creator-Instagram-/TikTok-Posts.
Die Creator sind entweder Food-Creator (Rezepte) oder Fitness-Coaches
(Trainingsplaene, Uebungs-Demos) — beide Welten gehoeren ins Schema.

Aufgabe: Pro Post entscheide den contentType (recipe / exercise / workout /
mindset / tutorial / transformation / vlog / other) und extrahiere die
passenden Meta-Felder.

CONTENT-TYPE-ENTSCHEIDUNG (kritisch):

- recipe: Caption enthaelt Zutaten + Zubereitung erkennbar. Z.B. "200g
  Quark, 2 Eier, alles vermengen, 12 Min backen". Auch implizite Mengen
  zaehlen. Reels die Kochen/Backen zeigen UND Rezept in Caption haben.

- exercise: Caption oder Video zeigt EINE einzelne Uebung mit Form-Cues
  ("So machst du Squats richtig", "Wall Ball Technik"). Sets/Reps optional,
  aber der Fokus liegt auf EINER Bewegung mit Ausfuehrungs-Erklaerung.

- workout: Caption beschreibt einen KOMPLETTEN Workout-Block aus mehreren
  Uebungen ("Push-Day 1: 5 Uebungen, hier ist mein Split"). Reihenfolge +
  Saetze/Wdh fuer mehrere Uebungen erkennbar.

- mindset: Reiner Motivations-/Inhalts-Text ohne Rezept oder Workout.
  Z.B. "3 Sachen die mir geholfen haben", Pull-Quote-Material, Reflexion.

- tutorial: How-To ohne Rezept und ohne Workout. Z.B. "Wie organisiere
  ich Mealprep-Boxen", "Wie packe ich Gym-Bag", "5 Supplement-Tipps".

- transformation: Vorher/Nachher, Progress-Update, "-20kg in 6 Monaten".

- vlog: Lifestyle, Day-in-Life, Reise, persoenlicher Vlog ohne klares
  Lern-Element.

- other: Werbung, Produkt-Promo ohne Bildungs-Inhalt, Foto-Dump,
  nicht klassifizierbar.

REZEPT-spezifische Felder (nur bei contentType='recipe' fuellen):

mealType-Regeln:
- breakfast: Pancakes, Overnight Oats, Bowls, Eier-Gerichte fuer den Morgen
- lunch: meist herzhafte Mittagsgerichte
- dinner: Abendessen (Pasta, Bowls, Aufstrich, Fleisch-Gerichte)
- snack: kleine herzhafte oder suesse Snacks unter 200 kcal
- dessert: Kuchen, Kekse, Eis, Cheesecakes, Pudding
- drink: Smoothies, Shakes, Drinks
- unknown: nicht eindeutig oder kein Rezept

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

FITNESS-spezifische Felder (nur bei contentType IN ('exercise','workout') fuellen):

workoutType:
- strength: Krafttraining/Hypertrophie (Hantel-/Maschinen-Training)
- cardio: Ausdauer-Steady-State (Laufen, Rudern, Bike)
- hiit: High-Intensity-Intervals (kurze hochintensive Bursts mit Pausen)
- functional: Hyrox, CrossFit-Style, Hybrid-Endurance (Sled/Wall-Ball/SkiErg)
- mobility: Stretching, Beweglichkeit, Foam-Rolling
- pilates: Pilates/Barre (Mat-Work, Reformer)
- yoga: Yoga (Vinyasa, Hatha, Ashtanga)
- posing: Bodybuilding-Posing-Practice
- rehab: Reha/Verletzungs-Prevention, Physio-Uebungen
- calisthenics: Bodyweight/Street-Workout (Pull-Ups, Push-Ups, Dips)

bodyParts (mehrere moeglich):
- chest, back, shoulders, arms, legs, glutes, core, full-body,
  cardio-conditioning. cardio-conditioning = explizit Conditioning ohne
  Muskel-Schwerpunkt (Burpees, Mountain Climbers, Jump Rope).

equipment (mehrere moeglich):
- none/bodyweight: ohne Equipment
- dumbbell/barbell/kettlebell: klassische Krafttraining-Gewichte
- machine/cable: Studio-Maschinen
- bands: Resistance-Bands
- sled/ski-erg/rower/wall-ball/sandbag: Hyrox-spezifisches Equipment
- outdoor: Park/Strasse/Trail (Laufen, Outdoor-Workouts)
- studio: Mat/Block/Roller (Pilates/Yoga)
- mixed: Workout mit mehreren Equipment-Typen

trainingSetting (genau einer):
- home: zuhause (Wohnzimmer, Garage)
- commercial-gym: klassisches Fitnessstudio (FitX, McFit, Gold's Gym)
- studio: Pilates-/Yoga-Studio (hell, ruhig, edle Optik)
- functional-gym: CrossFit-Box, Hyrox-Setup (rustikal, viel Equipment)
- outdoor: Park, Strasse, Trail
- stage: Bodybuilding-Buehne (Posing, Wettkampf)

trainingGoal (genau einer, bester Hauptanlass):
- hypertrophy: Muskelaufbau (BB-Splits, Volumen-Training)
- fat-loss: Abnehmen (Kalorien-Defizit, Cardio, leichtes Strength)
- strength: Maximalkraft (1RM-Fokus, Powerlifting)
- endurance: Ausdauer (Lauf-Programme, Bike, Rudern)
- mobility: Beweglichkeit, Reha-Aspekt
- aesthetic: Optik (Bikini-Fitness, Glute-/Booty-Fokus, Stage-Look)
- performance: Wettkampf-orientiert (Hyrox-Race-Prep, BB-Comp)
- posture: Haltung, Rumpf-Stabilitaet
- longevity: Gesundheit, Anti-Aging (sanftes Pilates, Mobility)

fitnessLevel:
- beginner: Einsteiger-Uebung (Basic-Squat, Bodyweight)
- intermediate: solide Technik vorausgesetzt (Deadlift, Pull-Ups)
- advanced: fortgeschrittene Technik (Olympic-Lifts, Muscle-Up, Plyo)
- pro: Wettkampf-Niveau (IFBB-Pro-Training, Hyrox-Pro)

durationMinutes: nur fuer Workouts (komplette Sessions). Bei einzelnen
Uebungs-Demos: 0.

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
    contentType: string;
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
    workoutType?: string;
    bodyParts?: string[];
    equipment?: string[];
    trainingSetting?: string;
    trainingGoal?: string;
    fitnessLevel?: string;
    durationMinutes?: number;
  }>;
};

const VALID_CONTENT_TYPES = new Set([
  "recipe",
  "exercise",
  "workout",
  "mindset",
  "tutorial",
  "transformation",
  "vlog",
  "other",
]);

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
    maxOutputTokens: 16384,
    thinkingBudget: 0,
    retries: 1,
    model: "flash",
  });

  const map = new Map<string, ReelClassification>();
  for (const c of result.classifications) {
    const reel = reels[c.index];
    if (!reel) continue;
    // contentType normalisieren: nur erlaubte Werte durchlassen.
    const contentType = VALID_CONTENT_TYPES.has(c.contentType)
      ? (c.contentType as ReelClassification["contentType"])
      : null;
    // is_recipe ableiten — bleibt der einzige Bool fuer Backward-Compat
    // mit getRecipeReelsForBrand, isRecipe-Filter, etc.
    const isRecipe = contentType === "recipe";
    const isFitness =
      contentType === "exercise" || contentType === "workout";

    map.set(reel.id, {
      contentType,
      isRecipe,
      recipeConfidence: Math.max(0, Math.min(1, c.recipeConfidence)),
      recipeTitle: c.recipeTitle?.trim() || null,
      // Recipe-Felder nur bei contentType='recipe' uebernehmen, sonst null.
      mealType:
        isRecipe && c.mealType && c.mealType !== "unknown"
          ? c.mealType
          : null,
      cuisine: isRecipe ? c.cuisine?.trim() || null : null,
      mainIngredient: isRecipe ? c.mainIngredient?.trim() || null : null,
      dietary:
        isRecipe && Array.isArray(c.dietary)
          ? c.dietary.filter(Boolean)
          : [],
      estimatedTimeMinutes:
        isRecipe &&
        typeof c.estimatedTimeMinutes === "number" &&
        c.estimatedTimeMinutes > 0
          ? c.estimatedTimeMinutes
          : null,
      occasion: isRecipe ? c.occasion?.trim() || null : null,
      season: isRecipe ? c.season?.trim() || null : null,
      skillLevel: isRecipe ? c.skillLevel?.trim() || null : null,
      vessel: isRecipe ? c.vessel?.trim() || null : null,
      // Fitness-Felder nur bei contentType IN ('exercise','workout').
      workoutType: isFitness ? c.workoutType?.trim() || null : null,
      bodyParts:
        isFitness && Array.isArray(c.bodyParts)
          ? c.bodyParts.filter(Boolean)
          : [],
      equipment:
        isFitness && Array.isArray(c.equipment)
          ? c.equipment.filter(Boolean)
          : [],
      trainingSetting: isFitness ? c.trainingSetting?.trim() || null : null,
      trainingGoal: isFitness ? c.trainingGoal?.trim() || null : null,
      fitnessLevel: isFitness ? c.fitnessLevel?.trim() || null : null,
      durationMinutes:
        isFitness &&
        typeof c.durationMinutes === "number" &&
        c.durationMinutes > 0
          ? c.durationMinutes
          : null,
    });
  }
  return map;
}

// Sentinel-Wert: signalisiert dem Caller dass ein Reel bei der Klassifikation
// gefailt ist UND nicht in die DB geschrieben werden soll (classified_at
// bleibt NULL, naechster Resume-Lauf probiert es erneut). Frueher haben wir
// hier defaultMiss() mit is_recipe=false zurueckgegeben — bei Schema-Bug
// 2026-05-13 wurden so 1004 Reels als "kein Rezept" markiert obwohl es
// nur ein Gemini-Schema-Fehler war. Dieser Sentinel verhindert das.
export const CLASSIFICATION_FAILED = Symbol("classification-failed");
export type ClassificationResult = ReelClassification | typeof CLASSIFICATION_FAILED;

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
): Promise<Map<string, ClassificationResult>> {
  const out = new Map<string, ClassificationResult>();

  // Alle Batches vorab erstellen
  const batches: ReelRow[][] = [];
  for (let i = 0; i < reels.length; i += BATCH_SIZE) {
    batches.push(reels.slice(i, i + BATCH_SIZE));
  }

  // Batches in Gruppen von PARALLEL_BATCHES parallel verarbeiten.
  // Wenn ein einzelner Batch failed, markieren wir die 10 Reels als
  // CLASSIFICATION_FAILED — der Caller schreibt sie NICHT in die DB, sie
  // bleiben classified_at=NULL und werden beim naechsten Resume retried.
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
          // Per-Reel-Lookup: wenn Gemini den Reel im response vergessen
          // hat, markieren wir ihn als failed (retry next round).
          const c = batchOut.get(r.id);
          out.set(r.id, c ?? CLASSIFICATION_FAILED);
        } else {
          // Ganzer Batch gefailt → alle 10 Reels failed.
          out.set(r.id, CLASSIFICATION_FAILED);
        }
      }
    }
  }

  return out;
}
