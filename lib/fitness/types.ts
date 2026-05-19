// Fitness-Pack-Typen — Parallel-Welt zur Rezept-Pipeline.
//
// Architektur (Pack-Type-Hybrid, Option C):
//   - Brand.defaultPackType + Pack.packType steuern, welche Pipeline laeuft.
//   - Recipe-Pipeline bleibt unangetastet (lib/recipes.ts, lib/packs.ts).
//   - Fitness-Cards leben in der eigenen Tabelle `fitness_cards` (siehe
//     sql/fitness-cards-table.sql) — Brand-System, Auth, Hub, PDF-Job-Queue,
//     Hero-Cache, Storage-Buckets bleiben geteilt.
//
// Datenmodell:
//   FitnessCard ist eine diskriminierte Union ueber CardType:
//     - exercise:     einzelne Uebung mit Saetzen x Wdh, Technik-Cues
//     - workout:      mehrere Uebungen als Block (Warm-up/Main/Cool-down)
//     - weekplan:     Mo-So-Plan mit Workout-Slot pro Tag
//     - mindset:      Pull-Quote + Story + konkrete Aktionen
//     - progress:     Tracking-Tabelle zum Eintragen
//     - nutrition-tip: leichte Ernaehrungs-Karte (Bridge fuer Hybrid-Creator)
//
// MVP-Fokus: ExerciseCard ist voll spezifiziert (Hyrox-Pilot fuer Simon
// braucht 8 davon). Andere Card-Types sind als Skelette definiert und
// werden in spaeteren Bloecken ausdetailliert.

import type { BrandImageStyleOverride } from "../brands";

// ─── Pack-Type-Discriminator ────────────────────────────────────────────────
// Wird sowohl auf Brand (als Default) als auch auf Pack (als override) gesetzt.
// "recipe" = bestehende Rezept-Pipeline. "fitness" = neue Fitness-Pipeline.
// Default ueberall "recipe" fuer Backward-Compat mit Bienen-Daten.
export type PackType = "recipe" | "fitness";

// ─── Fitness-Card-Discriminators ────────────────────────────────────────────
export type FitnessCardType =
  | "exercise"
  | "workout"
  | "weekplan"
  | "mindset"
  | "progress"
  | "nutrition-tip";

// ─── Controlled Vocabularies ────────────────────────────────────────────────
// Werden vom Klassifikator (Phase 3) extrahiert + vom Editor als Dropdown
// vorgegeben. Erweiterbar, aber bewusst klein gehalten fuer Konsistenz.

/** Welcher Workout-Typ. cardio/strength/mobility sind die haeufigsten. */
export type WorkoutType =
  | "strength"        // Krafttraining (Hypertrophie, Maximalkraft)
  | "cardio"          // Ausdauer (Laufen, Rudern, Bike)
  | "hiit"            // High-Intensity-Intervals
  | "functional"      // Hyrox, CrossFit-style, Hybrid-Endurance
  | "mobility"        // Stretching, Beweglichkeit
  | "pilates"         // Pilates / Barre
  | "yoga"            // Yoga
  | "posing"          // Bodybuilding-Posing
  | "rehab"           // Reha / Verletzungs-Prevention
  | "calisthenics";   // Bodyweight / Street-Workout

/** Welche Muskelgruppe primaer. full-body wenn mehrere gleich stark. */
export type BodyPart =
  | "chest"
  | "back"
  | "shoulders"
  | "arms"
  | "legs"
  | "glutes"
  | "core"
  | "full-body"
  | "cardio-conditioning";

/** Equipment-Bedarf. "none" = Bodyweight, "outdoor" = Park/Strasse/Trail. */
export type Equipment =
  | "none"
  | "dumbbell"
  | "barbell"
  | "kettlebell"
  | "machine"
  | "cable"
  | "bands"
  | "bodyweight"
  | "sled"             // Hyrox-spezifisch
  | "ski-erg"          // Hyrox-spezifisch
  | "rower"            // Hyrox-spezifisch
  | "wall-ball"        // Hyrox-spezifisch
  | "sandbag"          // Hyrox-spezifisch
  | "outdoor"          // Park, Strasse, Trail
  | "studio"           // Mat, Block, Roller (Pilates/Yoga)
  | "mixed";           // Workout mit mehreren Equipment-Typen

/** Wo trainiert. Steuert Hero-Bild-Tonalitaet. */
export type TrainingSetting =
  | "home"
  | "commercial-gym"   // Fitnessstudio (FitX, McFit, etc.)
  | "studio"           // Pilates-/Yoga-Studio, helle Raeume
  | "functional-gym"   // CrossFit-Box, Hyrox-Setup
  | "outdoor"
  | "stage";           // Bodybuilding-Buehne (Marvin, Johny)

/** Trainings-Ziel. Steuert Pack-Narrativ + Suggestion-Logik. */
export type TrainingGoal =
  | "hypertrophy"      // Muskelaufbau
  | "fat-loss"         // Abnehmen
  | "strength"         // Maximalkraft
  | "endurance"        // Ausdauer
  | "mobility"         // Beweglichkeit
  | "aesthetic"        // Optik (Bikini-Fitness, Posing)
  | "performance"      // Wettkampf-orientiert (Hyrox, BB-Comp)
  | "posture"          // Haltung, Rumpf-Stabilitaet
  | "longevity";       // Gesundheit, Anti-Aging (Pilates/Alina)

/** Schwierigkeit. Default-Filter im Pack-Builder. */
export type FitnessLevel = "beginner" | "intermediate" | "advanced" | "pro";

/** Geschlechts-Skew des Brands/Pack. Beeinflusst Tonalitaet + Bild-Auswahl.
 *  neutral = "fuer alle"; male-coded = Hardcore-BB-Tonalitaet; female-coded
 *  = Frauen-Fitness / Glute-Fokus / Pilates. */
export type GenderSkew = "male-coded" | "female-coded" | "neutral";

// ─── Card-Base ──────────────────────────────────────────────────────────────
// Felder die JEDE Fitness-Card hat (analog zu den Basis-Recipe-Feldern).

export type FitnessCardBase = {
  /** URL-Slug, unique pro Pack. */
  slug: string;
  brandSlug: string;
  packSlug: string;
  type: FitnessCardType;
  /** Position im Pack (1..N). Bei Cards-Order-Change im Editor updatebar. */
  number: number;
  /** Karten-Titel (z.B. Uebungs-Name "Wall Ball" oder Workout-Name
   *  "Push-Day 1: Brust + Schultern"). */
  title: string;
  /** Optionaler Untertitel ("100 Reps · 6 kg" / "Hyrox Station 8"). */
  subtitle?: string;
  /** Kurze Beschreibung / Story ueber die Karte. Bei `mindset` ist das der
   *  Hauptinhalt; bei `exercise` ein einzelner Satz Kontext. */
  description?: string;
  /** Hero-Bild-URL (Supabase Storage). Bei Fitness: meist Reel-Keyframe
   *  direkt (siehe Hero-Pipeline-Variante). */
  hero?: string;
  /** Quell-Reel-URL fuer QR-Code im PDF. Optional, weil manuelle Karten
   *  ohne Source gibt. */
  sourceUrl?: string;
  /** Label fuer den QR-Code-Footer ("@simongronau · 2024-08-12"). */
  sourceLabel?: string;
  /** Gemeinsame Filter-Tags pro Karte (mealType-Aequivalent fuer Fitness). */
  bodyParts?: BodyPart[];
  equipment?: Equipment[];
  setting?: TrainingSetting;
  level?: FitnessLevel;
  /** Geschaetzte Dauer in Minuten (fuer exercise: Single-Set; fuer workout:
   *  Gesamt-Workout). */
  durationMinutes?: number;
  /** Optionales per-Card-Layout-Override analog zu Recipe.cardLayout.
   *  Default: Pack-Layout. */
  cardLayout?: FitnessCardLayout;
};

// ─── ExerciseCard (MVP-Fokus) ───────────────────────────────────────────────

/** Eine einzelne Uebung mit Saetzen/Wiederholungen und Technik-Cues.
 *  Haeufigster Card-Typ bei Bodybuilding, Hyrox, Frauen-Fitness. */
export type ExerciseCard = FitnessCardBase & {
  type: "exercise";
  exercise: {
    /** Workout-Typ-Tag (steuert ggf. visuelle Akzente). */
    workoutType?: WorkoutType;
    /** Saetze × Wiederholungen als strukturierter String. Beispiele:
     *  "3 × 12" / "5 × 5" / "4 × 8-12" / "1 × Max" / "100 Reps".
     *  Bewusst flexibel als String, weil Bodybuilding-Schemas extrem
     *  variieren (Drop-Sets, Rest-Pause, AMRAP, Pyramid, ...). */
    setsReps: string;
    /** Pause zwischen Saetzen (z.B. "90 sec" / "2 min"). Optional weil
     *  bei Cardio/Hyrox-Stationen nicht immer relevant. */
    rest?: string;
    /** Gewicht / Last (z.B. "70 kg" / "Bodyweight" / "RPE 8" / "24 kg" fuer
     *  Hyrox Farmers Carry). Optional. */
    load?: string;
    /** Distanz statt Reps (Hyrox: "50m Sled Push", "1000m Row"). */
    distance?: string;
    /** Tempo-Notation (z.B. "3-1-1-0"). Selten genutzt, aber bei
     *  Hypertrophie-Fokus relevant. */
    tempo?: string;
    /** 3-6 Technik-Cues / Ausfuehrungs-Schritte. Reihenfolge wichtig. */
    cues: string[];
    /** 2-4 typische Fehler die vermieden werden sollten. */
    commonMistakes?: string[];
    /** Tipp fuer Anfaenger / Pro-Variation. */
    beginnerVariation?: string;
    advancedVariation?: string;
    /** Welche Muskeln werden primaer trainiert (frei beschriftbar, fuer
     *  Anzeige in der Karte; Tags zum Filtern in bodyParts auf Base). */
    primaryMuscles?: string;
    /** Sekundaer-Muskulatur, wird subtiler dargestellt. */
    secondaryMuscles?: string;
  };
};

// ─── WorkoutCard (Skelett fuer spaeter) ─────────────────────────────────────

/** Ein komplettes Workout aus mehreren Uebungen. Z.B. "Push-Day 1" mit
 *  6 Uebungen, oder ein Hyrox-Race-Simulation-Workout.
 *  Wird in einem spaeteren Block ausdetailliert. */
export type WorkoutCard = FitnessCardBase & {
  type: "workout";
  workout: {
    workoutType?: WorkoutType;
    totalDurationMinutes?: number;
    estimatedCalories?: number;
    blocks: WorkoutBlock[];
    notes?: string;
  };
};

export type WorkoutBlock = {
  /** "Warm-Up" / "Main" / "Cool-Down" / "Block A" / "Finisher" */
  name: string;
  /** Wie ausgefuehrt: "3 Runden" / "AMRAP 10 min" / "For Time" / "EMOM" /
   *  "Stationen". */
  format?: string;
  exercises: Array<{
    title: string;
    setsReps: string;
    load?: string;
    rest?: string;
    note?: string;
  }>;
};

// ─── WeekplanCard (Skelett) ─────────────────────────────────────────────────

/** Mo-So-Plan: pro Tag ein Workout-Slot + ggf. Ernaehrungs-Hinweis.
 *  Genutzt fuer "X-Wochen-Programm"-Packs (Tim, Johannes, Christian, Jan). */
export type WeekplanCard = FitnessCardBase & {
  type: "weekplan";
  weekplan: {
    /** Wochen-Nummer im Mehrwochen-Programm (1..N). */
    weekNumber: number;
    /** Wochenziel als 1-Satz-Beschreibung. */
    weekGoal?: string;
    days: WeekplanDay[];
  };
};

export type WeekplanDay = {
  /** "Mo" | "Di" | "Mi" | "Do" | "Fr" | "Sa" | "So" */
  day: string;
  workoutTitle?: string;
  workoutType?: WorkoutType;
  durationMinutes?: number;
  /** "rest" wenn Regenerations-Tag (workoutTitle leer). */
  isRest?: boolean;
  nutritionTip?: string;
};

// ─── MindsetCard (Skelett) ──────────────────────────────────────────────────

/** Text-fokussierte Karte: Pull-Quote, Story, konkrete Aktionen. Kein
 *  Hero-Bild noetig (oder Lifestyle-Reel-Keyframe). */
export type MindsetCard = FitnessCardBase & {
  type: "mindset";
  mindset: {
    /** Pull-Quote (1-3 Saetze, gross dargestellt). */
    quote: string;
    /** Storyblock-Text (1-3 Absaetze). */
    story?: string;
    /** 3-5 konkrete Aktionen. */
    actions?: string[];
    /** Optionale Tracking-Slots zum Eintragen (Habit-Tracker-Stil). */
    trackingSlots?: string[];
  };
};

// ─── ProgressCard (Skelett) ─────────────────────────────────────────────────

/** Tabellen-Karte zum Eintragen (Logbook). Wochenzeilen, Werte-Spalten. */
export type ProgressCard = FitnessCardBase & {
  type: "progress";
  progress: {
    /** Was getrackt wird: "Bench Press" / "Bodyweight" / "Schritte" */
    metricName: string;
    /** Welche Spalten in der Tabelle. ["Datum", "Gewicht", "Reps", "Notiz"] */
    columns: string[];
    /** Anzahl Leer-Zeilen die im PDF gerendert werden (default 12 = 12 Wochen). */
    rows: number;
  };
};

// ─── NutritionTipCard (Skelett, Bridge fuer Hybrid-Creator) ─────────────────

/** Leichte Ernaehrungs-Karte fuer Fitness-Packs mit Ernaehrungs-Komponente
 *  (Tim "Fit mit Tim", Christian Wolf Protein-Fasten). KEIN volles Rezept —
 *  wenn der Creator volle Rezepte will, ist das ein Recipe-Pack. */
export type NutritionTipCard = FitnessCardBase & {
  type: "nutrition-tip";
  nutritionTip: {
    headline: string;
    story?: string;
    macroTargets?: {
      kcal?: number;
      protein?: number;
      carbs?: number;
      fat?: number;
    };
    sampleMeal?: string;
  };
};

// ─── Discriminated Union ────────────────────────────────────────────────────

export type FitnessCard =
  | ExerciseCard
  | WorkoutCard
  | WeekplanCard
  | MindsetCard
  | ProgressCard
  | NutritionTipCard;

// ─── Card-Layouts ───────────────────────────────────────────────────────────
// Analog zu lib/packs.ts CardLayout fuer Rezept-Karten, aber eigene Slots.
// Phase 1 (MVP): nur "studio-performance" — der Marvin/Simon-Stil.
// Spaeter: "pilates-soft", "frauen-fitness", "abnehm-guide", "hyrox-race".

export type FitnessCardLayout =
  | "studio-performance"   // Hardcore-Studio, dunkel-amber, Performance-Fokus
  | "pilates-soft"         // Hell, ruhig, Wellness-Look (fuer Alina)
  | "frauen-fitness"       // Bright + warm, Glute-/Bikini-Fokus
  | "abnehm-guide"         // Mix Ernaehrung+Training, motivational
  | "hyrox-race";          // Functional/Hyrox-Setup, Race-Prep-Vibe

// ─── Fitness-Brand-Image-Style ──────────────────────────────────────────────
// Bei Fitness-Brands greift die KI-Image-Pipeline auf andere Slots zu als
// bei Food. Wir wiederverwenden BrandImageStyleOverride als Container, aber
// die Slot-Belegung ist semantisch anders:
//
//   sceneOptions      -> Trainings-Setting ("modern commercial gym, ...")
//   lightingOptions   -> Beleuchtung des Setting
//   cameraAesthetic   -> Foto-Stil (gritty action vs. clean studio)
//   heroElementGuidance -> Signature-Equipment (Hyrox-Sled, Hantel, Mat, ...)
//   negativeAddition  -> z.B. "no posing on stage, no flexing close-up"
//
// Fuer den MVP (Simon) reicht der Default-Style — wir bauen ihn direkt
// als Code-Brand analog zu BIENE_STYLE wenn die Hero-Pipeline-Variante steht.
export type FitnessBrandImageStyle = BrandImageStyleOverride & {
  /** Welcher TrainingSetting der Brand am haeufigsten zeigt. Steuert Default-
   *  Backdrop bei Flux-Generation (Equipment-Cards). */
  preferredSetting?: TrainingSetting;
  /** Gender-Skew des Visual-Stils. Beeinflusst Bildkomposition + Bildauswahl
   *  beim Reel-Keyframe-Picker. */
  genderSkew?: GenderSkew;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Returnt den effective Pack-Type. Falls Pack.packType gesetzt, gewinnt
 *  das; sonst fallback auf Brand.defaultPackType; sonst "recipe". */
export function resolvePackType(
  pack: { packType?: PackType } | undefined,
  brand: { defaultPackType?: PackType } | undefined
): PackType {
  return pack?.packType ?? brand?.defaultPackType ?? "recipe";
}

/** Type-Guard fuer ExerciseCard. */
export function isExerciseCard(card: FitnessCard): card is ExerciseCard {
  return card.type === "exercise";
}

/** Type-Guard fuer WorkoutCard. */
export function isWorkoutCard(card: FitnessCard): card is WorkoutCard {
  return card.type === "workout";
}
