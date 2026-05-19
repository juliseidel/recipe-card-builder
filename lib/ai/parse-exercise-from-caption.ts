import { callGemini } from "./gemini";
import type {
  ExerciseCard,
  WorkoutType,
  BodyPart,
  Equipment,
  FitnessLevel,
} from "@/lib/fitness/types";

// Spiegel zu lib/ai/parse-instagram.ts, aber fuer Fitness-Reels. Extrahiert
// aus einer Reel-Caption die Felder einer ExerciseCard:
// title, subtitle, setsReps, load, rest, distance, cues, commonMistakes,
// beginnerVariation, advancedVariation, primaryMuscles.
//
// Wird vom fitness-pack-builder.ts beim Suggestion-Accept aufgerufen.
// Pro Reel ein Gemini-Call (parallelisierbar via Promise.allSettled).
//
// Schwierigkeitsgrad: Fitness-Captions sind oft kuerzer + technischer als
// Rezept-Captions (weniger "Story", mehr "3x10 mit 20 kg, halte den
// Ruecken gerade"). Wir extrahieren was da ist, faellt auf sinnvolle
// Defaults zurueck wenn Felder fehlen.

export type ParseExerciseResult =
  | { ok: true; card: ParsedExerciseCard }
  | { ok: false; error: string };

export type ParsedExerciseCard = {
  title: string;
  subtitle?: string;
  setsReps: string;
  load?: string;
  rest?: string;
  distance?: string;
  tempo?: string;
  cues: string[];
  commonMistakes?: string[];
  beginnerVariation?: string;
  advancedVariation?: string;
  primaryMuscles?: string;
  secondaryMuscles?: string;
};

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    confidence: {
      type: "number",
      description:
        "0..1 — wie sicher bist du dass du die Uebung sauber extrahieren konntest. <0.3 = die Caption hat zu wenig Trainings-Info, dann fallback.",
    },
    title: {
      type: "string",
      description:
        "Uebungs-Name (z.B. 'Wall Ball', 'Back Squat', 'Sled Push'). Kein Marketing, keine Floskeln. Max 50 chars.",
    },
    subtitle: {
      type: "string",
      description:
        "Kontext oder Variante (z.B. 'Hyrox Station 8', '5×5 Programm', 'Glute Activation'). Optional, leer wenn nichts klar erkennbar.",
    },
    setsReps: {
      type: "string",
      description:
        "Saetze x Wiederholungen. Formate: '3 × 12', '5 × 5', '4 × 8-12', '100 Reps', '1 × Max'. Wenn nicht erkennbar: 'Siehe Reel'.",
    },
    load: {
      type: "string",
      description:
        "Gewicht/Last. Z.B. '70 kg', '24 kg pro Hantel', 'Bodyweight', 'RPE 8'. Leer wenn unklar.",
    },
    rest: {
      type: "string",
      description:
        "Pause zwischen Saetzen. Z.B. '90 sec', '2 min', 'unbroken'. Leer wenn nicht erwaehnt.",
    },
    distance: {
      type: "string",
      description:
        "Distanz statt Reps. Z.B. '50m Sled Push', '1000m Row'. Leer wenn keine Distanz-Uebung.",
    },
    tempo: {
      type: "string",
      description:
        "Tempo-Notation (selten erwaehnt). Z.B. '3-1-1-0'. Leer wenn nicht erwaehnt.",
    },
    cues: {
      type: "array",
      items: { type: "string" },
      description:
        "3-6 Technik-Cues / Ausfuehrungs-Schritte. Klare Imperative, nicht 'man sollte...' sondern 'Brust raus', 'Knie folgen den Zehen'. Aus der Caption extrahiert ODER, wenn dort nichts steht, mit Standard-Cues fuer die Uebung gefuellt.",
    },
    commonMistakes: {
      type: "array",
      items: { type: "string" },
      description:
        "0-3 typische Fehler die die Uebung haeufig kaputt machen. Aus Caption extrahiert wenn der Creator welche nennt — sonst leer (besser nichts als Standard-Floskeln).",
    },
    beginnerVariation: {
      type: "string",
      description:
        "Anfaenger-Variation. Aus Caption oder common-sense (z.B. 'Mit weniger Gewicht starten' / 'Bodyweight statt Hantel'). Leer wenn unklar.",
    },
    advancedVariation: {
      type: "string",
      description:
        "Pro/Rx+ Variation. Aus Caption oder common-sense (z.B. 'Tempo verlangsamen' / 'Tempo + 5kg + Pause kuerzen'). Leer wenn unklar.",
    },
    primaryMuscles: {
      type: "string",
      description:
        "Primaerer Muskel/Muskelgruppen. Kommagetrennt. Z.B. 'Quadrizeps, Glutaeus, Schultern'. Leer wenn unklar.",
    },
    secondaryMuscles: {
      type: "string",
      description:
        "Sekundaere Muskulatur. Z.B. 'Wadenheber, Rumpf-Stabilisatoren'. Leer wenn unklar.",
    },
  },
  required: [
    "confidence",
    "title",
    "setsReps",
    "cues",
  ],
};

const SYSTEM_INSTRUCTION = `Du extrahierst Trainings-Daten aus Fitness-Reels (Instagram/TikTok). Caption + Klassifikations-Tags sind dein Input, ein strukturiertes ExerciseCard-Objekt der Output.

WAS du gut machst:
- Saetze x Wiederholungen aus der Caption ziehen
- Technik-Cues als kurze Imperative formulieren ("Squat tief", "Brust raus")
- Wenn der Creator typische Fehler nennt, in commonMistakes uebernehmen
- Wenn der Creator NICHTS sagt was nuetzlich ist, fuelle mit Standard-Coaching-Wissen — aber pragmatisch, nicht generisch ("Standard-Squat-Cues" statt erfundener Spezial-Tipps)

WAS du NICHT machst:
- Marketing-Floskeln ("revolutionaer", "ultimative", "beste je")
- Halluzinationen — wenn unklar: leer lassen statt erfinden
- Standard-Cues bei sehr spezifischer Uebung (z.B. wenn die Caption nur "Day 3 Push" sagt und kein konkreter Uebungs-Name erkennbar ist, sag das durch confidence < 0.3)

Bei Hyrox-Stationen (SkiErg, Sled Push/Pull, Burpee Broad Jumps, Row, Farmers Carry, Sandbag Lunges, Wall Balls): nutze Standard-Pacing-Empfehlungen wenn Caption nichts sagt (z.B. Wall Ball 100 Reps mit 6/9kg, Race-Pace 4-5 min).

Bei Bodybuilding-Uebungen: Saetze x Wdh aus 5×5 / 4×8-12 / 3×12 / etc. Default-Cues sind ok (Form/Atmung/Range-of-Motion).

WICHTIG: Korrekte deutsche Umlaute (ä, ö, ü, ß). Niemals "ue", "oe", "ae", "ss" wo Umlaute hingehoeren.

Antworte AUSSCHLIESSLICH im JSON-Schema.`;

export type ReelClassificationContext = {
  contentType: string | null;
  workoutType: string | null;
  bodyParts: string[];
  equipment: string[];
  trainingSetting: string | null;
  trainingGoal: string | null;
  fitnessLevel: string | null;
  durationMinutes: number | null;
  recipeTitle: string | null; // ist auch fuer Workouts der "Name"
};

export async function parseExerciseFromCaption(
  caption: string,
  context: ReelClassificationContext
): Promise<ParseExerciseResult> {
  if (!caption || caption.trim().length < 10) {
    return { ok: false, error: "Caption zu kurz" };
  }

  const promptLines = [
    `Caption:`,
    caption.slice(0, 1500),
    ``,
    `Klassifikations-Tags (Gemini hat den Reel bereits klassifiziert):`,
    context.recipeTitle ? `- Geraetenamen/Title-Hinweis: ${context.recipeTitle}` : "",
    context.workoutType ? `- Workout-Typ: ${context.workoutType}` : "",
    context.bodyParts.length > 0 ? `- Body-Parts: ${context.bodyParts.join(", ")}` : "",
    context.equipment.length > 0 ? `- Equipment: ${context.equipment.join(", ")}` : "",
    context.trainingSetting ? `- Setting: ${context.trainingSetting}` : "",
    context.trainingGoal ? `- Goal: ${context.trainingGoal}` : "",
    context.fitnessLevel ? `- Level: ${context.fitnessLevel}` : "",
    context.durationMinutes ? `- Dauer: ${context.durationMinutes} min` : "",
    ``,
    `Extrahiere die ExerciseCard-Felder im JSON-Schema.`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const result = await callGemini<{
      confidence: number;
      title: string;
      subtitle?: string;
      setsReps: string;
      load?: string;
      rest?: string;
      distance?: string;
      tempo?: string;
      cues: string[];
      commonMistakes?: string[];
      beginnerVariation?: string;
      advancedVariation?: string;
      primaryMuscles?: string;
      secondaryMuscles?: string;
    }>({
      prompt: promptLines,
      schema: RESPONSE_SCHEMA,
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.3,
      maxOutputTokens: 1024,
      thinkingBudget: 0,
      retries: 1,
      model: "flash",
    });

    if (result.confidence < 0.3) {
      return { ok: false, error: `low confidence ${result.confidence}` };
    }

    const card: ParsedExerciseCard = {
      title: clean(result.title, 60),
      ...(result.subtitle?.trim() ? { subtitle: clean(result.subtitle, 100) } : {}),
      setsReps: clean(result.setsReps, 40) || "Siehe Reel",
      ...(result.load?.trim() ? { load: clean(result.load, 40) } : {}),
      ...(result.rest?.trim() ? { rest: clean(result.rest, 30) } : {}),
      ...(result.distance?.trim() ? { distance: clean(result.distance, 30) } : {}),
      ...(result.tempo?.trim() ? { tempo: clean(result.tempo, 30) } : {}),
      cues: (result.cues ?? [])
        .map((c) => clean(c, 140))
        .filter(Boolean)
        .slice(0, 6),
      ...(result.commonMistakes && result.commonMistakes.length > 0
        ? {
            commonMistakes: result.commonMistakes
              .map((m) => clean(m, 140))
              .filter(Boolean)
              .slice(0, 3),
          }
        : {}),
      ...(result.beginnerVariation?.trim()
        ? { beginnerVariation: clean(result.beginnerVariation, 200) }
        : {}),
      ...(result.advancedVariation?.trim()
        ? { advancedVariation: clean(result.advancedVariation, 200) }
        : {}),
      ...(result.primaryMuscles?.trim()
        ? { primaryMuscles: clean(result.primaryMuscles, 80) }
        : {}),
      ...(result.secondaryMuscles?.trim()
        ? { secondaryMuscles: clean(result.secondaryMuscles, 80) }
        : {}),
    };

    if (card.cues.length < 2) {
      // Mindestens 2 Cues — sonst ist die Karte unbrauchbar
      return { ok: false, error: "too few cues extracted" };
    }

    return { ok: true, card };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function clean(s: string, max: number): string {
  let out = (s ?? "").trim();
  out = out.replace(/^["'„«]+|["'"»]+$/g, "");
  out = out.replace(/\s+/g, " ");
  if (out.length > max) out = out.slice(0, max).trimEnd() + "…";
  return out;
}

// Helper: WorkoutType + Level aus ReelRow-Strings sicher casten (TypeScript-
// strict-Workaround). Bei ungueltigen Werten Defaults.
export function safeWorkoutType(s: string | null | undefined): WorkoutType {
  const valid: WorkoutType[] = [
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
  ];
  return valid.includes(s as WorkoutType) ? (s as WorkoutType) : "strength";
}

export function safeBodyParts(arr: string[] | null | undefined): BodyPart[] {
  if (!arr) return [];
  const valid: BodyPart[] = [
    "chest",
    "back",
    "shoulders",
    "arms",
    "legs",
    "glutes",
    "core",
    "full-body",
    "cardio-conditioning",
  ];
  return arr.filter((s): s is BodyPart => valid.includes(s as BodyPart));
}

export function safeEquipment(arr: string[] | null | undefined): Equipment[] {
  if (!arr) return [];
  const valid: Equipment[] = [
    "none",
    "dumbbell",
    "barbell",
    "kettlebell",
    "machine",
    "cable",
    "bands",
    "bodyweight",
    "sled",
    "ski-erg",
    "rower",
    "wall-ball",
    "sandbag",
    "outdoor",
    "studio",
    "mixed",
  ];
  return arr.filter((s): s is Equipment => valid.includes(s as Equipment));
}

export function safeLevel(s: string | null | undefined): FitnessLevel {
  const valid: FitnessLevel[] = ["beginner", "intermediate", "advanced", "pro"];
  return valid.includes(s as FitnessLevel)
    ? (s as FitnessLevel)
    : "intermediate";
}

// Convenience: ParsedExerciseCard + Klassifikations-Context → finales
// ExerciseCard-Objekt (ohne brand_slug/pack_slug/number — die werden vom
// pack-builder gesetzt).
export function assembleExerciseCard(
  parsed: ParsedExerciseCard,
  context: ReelClassificationContext
): Omit<ExerciseCard, "number" | "brandSlug" | "packSlug" | "slug"> {
  return {
    type: "exercise",
    title: parsed.title,
    ...(parsed.subtitle ? { subtitle: parsed.subtitle } : {}),
    bodyParts: safeBodyParts(context.bodyParts),
    equipment: safeEquipment(context.equipment),
    level: safeLevel(context.fitnessLevel),
    ...(context.durationMinutes
      ? { durationMinutes: context.durationMinutes }
      : {}),
    exercise: {
      workoutType: safeWorkoutType(context.workoutType),
      setsReps: parsed.setsReps,
      ...(parsed.load ? { load: parsed.load } : {}),
      ...(parsed.distance ? { distance: parsed.distance } : {}),
      ...(parsed.rest ? { rest: parsed.rest } : {}),
      ...(parsed.tempo ? { tempo: parsed.tempo } : {}),
      cues: parsed.cues,
      ...(parsed.commonMistakes && parsed.commonMistakes.length > 0
        ? { commonMistakes: parsed.commonMistakes }
        : {}),
      ...(parsed.beginnerVariation
        ? { beginnerVariation: parsed.beginnerVariation }
        : {}),
      ...(parsed.advancedVariation
        ? { advancedVariation: parsed.advancedVariation }
        : {}),
      ...(parsed.primaryMuscles ? { primaryMuscles: parsed.primaryMuscles } : {}),
      ...(parsed.secondaryMuscles
        ? { secondaryMuscles: parsed.secondaryMuscles }
        : {}),
    },
  };
}
