import { callGemini } from "./gemini";
import type { ReelRow } from "@/lib/creator-reels-server";
import type { Brand } from "@/lib/brands";
import {
  formatVoiceProfileForPrompt,
  formatCaptionFewShot,
  ensureBrandVoiceProfile,
} from "./analyze-voice-profile";
import { findBannedPhrases } from "./banned-phrases";

// Fitness-Pack-Vorschlags-Generator. Spiegel zu suggest-packs.ts, aber:
//   - Input: klassifizierte Fitness-Reels (content_type IN ('exercise',
//     'workout') statt is_recipe=true)
//   - Strategie-Mix: Sub-Niche-basiert (Push-Pull-Legs-Split, Hyrox-Race-Prep,
//     Abnehm-Wochenplan, Mobility-Routine) statt Mealtype/Cuisine
//   - Nutzt Fitness-Klassifikations-Felder: workoutType, bodyParts,
//     equipment, trainingSetting, trainingGoal, fitnessLevel, durationMinutes
//   - Output: PackSuggestion-Shape identisch zu recipe-suggestions
//     (gleiches DB-Schema), aber Tagline referenziert Uebungs-Namen
//
// Aufruf vom classify-and-suggest.ts-Orchestrator nach Klassifikation:
// wenn Brand defaultPackType='fitness' oder Mehrheit der Reels exercise/
// workout → diese Pipeline statt suggest-packs.

export type FitnessPackSuggestion = {
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
              "Pack-Titel, 15-50 chars. Trainings-spezifisch + konkret. Beispiele: 'Hyrox Race Prep 6 Wochen', 'Push-Pull-Legs Split', 'Glutes Power 4 Wochen', 'Hypertrophie Bootcamp'. Vermeide Marketing-Floskeln, sei konkret.",
          },
          subtitle: {
            type: "string",
            description:
              "Ein Satz Untertitel, 20-100 chars. Schaerft das Pack-Versprechen, z.B. 'Alle 8 Stationen mit Pacing-Plan', '5 Splits, 12 Wochen, 18 Uebungen'.",
          },
          tagline: {
            type: "string",
            description:
              "Teaser mit 2-3 KONKRETEN Uebungs- oder Workout-Namen aus der Liste, kommagetrennt. 30-140 chars. z.B. 'Wall Ball, Sled Push, Burpee Broad Jumps — die Hyrox-Stationen mit Race-Pace'.",
          },
          description: {
            type: "string",
            description:
              "2 Saetze in der Stimme des Creators, 140-280 chars. Was zeichnet das Pack aus, fuer wen ist es gedacht. Konkret auf 1-2 Uebungen/Workouts beziehen. Nutze Coaching-Sprache (Form, Pacing, Volumen) nicht Foodporn-Vokabular.",
          },
          category: {
            type: "string",
            description:
              "Kategorie-Bezeichnung: 'Race Prep', 'Krafttraining', 'Abnehm-Wochenplan', 'Mobility', 'Hypertrophie', 'Functional', 'Beginner Start'.",
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
              "Ein Satz, warum diese Auswahl gut zusammenpasst (z.B. 'Alle 8 Hyrox-Stationen einzeln im 2-Jahres-Backlog', 'Push-Day-Uebungen mit klarer Form-Demonstration').",
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

  return `Du bist ein Trainings-Pack-Strategist fuer einen Fitness-Coach-Pack-Generator.

${voiceBlock}

${fewShotBlock}

AUFGABE: Aus einer Liste klassifizierter Trainings- und Coaching-Reels (Uebungen, Workouts, Mindset, Tutorials) schlaegst du 10-20 Pack-Konzepte vor, die das Team mit einem Klick anlegen kann. Alle Texte (Title, Subtitle, Tagline, Description) klingen wie ${brandName} selbst — Coaching-Sprache, nicht generische KI.

WICHTIG: Es gibt ZWEI Arten von Fitness-Coaches im Input:
- DEMONSTRATIONS-COACHES: Reels zeigen Workouts/Uebungen direkt (content_type=exercise/workout). Bei diesen baust du klassische Trainings-Programme.
- EDUKATIONS-COACHES (z.B. Christian Wolf, Tim Rabitz): Reels sind primaer Mindset/Tutorial-Content — der Coach REDET ueber Methoden, statt sie zu zeigen. Bei diesen baust du WISSENS-PACKS / METHODEN-GUIDES / MINDSET-COLLECTIONS.

Schau dir die TYPE-Verteilung an (im Input markiert als "type=exercise/workout/mindset/tutorial") und entscheide pro Suggestion welche Art Pack sinnvoll ist.

STRATEGIE-MIX (moeglichst diverse Auswahl):

A. WENN viele exercise/workout-Reels vorhanden:

1. PROGRAMME / WOCHENPLAENE: zeitlich strukturierte Mehrwochenplaene
   - "6-Wochen-Hypertrophie-Bootcamp" (wenn primaer Krafttraining)
   - "Hyrox Race Prep" (wenn Hyrox/Functional + Wettkampf-Vibe)
   - "Abnehm-Kickstart 30 Tage" (wenn Fat-Loss + Mix aus Training+Lifestyle)
   - "Glutes Power 4 Wochen" (wenn primaer Glutes/Female-Strength)

2. SPLIT- ODER STRUKTUR-BASIERT: nach Trainings-System
   - "Push-Pull-Legs-Split"
   - "Upper-Lower-Split"
   - "Full-Body 3x Woche"
   - "Hyrox 8-Stationen-Mastery"

3. BODY-PART-FOKUS: wenn 5+ Reels zur selben Muskelgruppe
   - "Chest Day Drills"
   - "Glutes Volume Bootcamp"
   - "Back & Pulls"

4. EQUIPMENT-BASIERT: wenn klares Equipment-Pattern
   - "Hantel-Only Programm"
   - "Bodyweight Anywhere"
   - "Sled & Sandbag Conditioning"

5. SKILL-LEVEL: wenn Reels klar fuer Beginner oder Pro
   - "Beginner Start — 14 Tage Einstieg"
   - "Rx+ Race-Pace"

6. GOAL-BASIERT: Mobility/Recovery, Strength/Power, Endurance Builder

B. WENN viele mindset/tutorial-Reels vorhanden (Edukations-Coaches):

7. METHODEN-GUIDES: aus mindset-Reels, die eine Methodik des Creators erklaeren
   - "Protein-Fasten Erklaert: Die 12 wichtigsten Lessons" (Christian Wolf)
   - "Mein Mindset fuer nachhaltiges Abnehmen"
   - "Die wahren Grundlagen von Hypertrophie"

8. MYTHEN & FAKTEN: aus tutorial-Reels die Missverstaendnisse aufklaeren
   - "10 Abnehm-Mythen, die du loswerden musst"
   - "Was die Fitness-Industrie dir verschweigt"
   - "Die haeufigsten Trainings-Fehler"

9. KONZEPT-SAMMLUNGEN: aus mindset-Reels die ein Coaching-Konzept transportieren
   - "Habits, die mein Leben veraendert haben"
   - "Mental-Reset fuer Plateau-Phasen"
   - "Tagesroutinen erfolgreicher Athleten"

10. EXPLAINER-PACKS: aus tutorial-Reels die "How-To" lehren
    - "Mealprep wie ein Pro — Komplett-Guide"
    - "Supplement-Stack fuer jedes Ziel"
    - "Erholung optimieren: Schlaf, Stress, Regeneration"

Bei MISCHCREATORN (sowohl Demo als auch Edukation): mische beides. Z.B. ein Strength-Programm + ein Mindset-Pack + ein Mythen-Pack.

PRAEFERENZEN:
- Bevorzuge Reels mit hoher Engagement (likes/views)
- Diversifiziere — nicht 10x Push-Pull-Legs
- Bei Hyrox-Brand: mindestens 1 Pack pro Standard-Hyrox-Format
- Bei BB-Brand: mindestens 1 Split + 1 Body-Part-Pack
- Skip Pack-Konzept wenn weniger als 5 passende Reels in der Library

WICHTIG zu deutscher Schreibweise — verwende immer korrekte Umlaute und ß:
ä statt ae, ö statt oe, ü statt ue, ß statt ss bei langen Vokalen.

KEINE Marketing-Floskeln ("revolutionaer", "ultimative", "beste je"). Coaching-Sprache: Form, Pace, Volumen, Saetze, Wiederholungen, Pausen, Progression.

Antworte AUSSCHLIESSLICH im JSON-Schema, ohne Erklaerung.`;
}

function fitnessReelToPromptLine(r: ReelRow): string {
  const dateLabel = r.posted_at ? r.posted_at.slice(0, 10) : "—";
  const eng =
    r.like_count !== null || r.view_count !== null
      ? `lk=${r.like_count ?? 0}/v=${r.view_count ?? 0}`
      : "";
  const bodyParts = r.body_parts?.length ? r.body_parts.join(",") : "";
  const equip = r.equipment?.length ? r.equipment.join(",") : "";
  return [
    `id=${r.id}`,
    `type=${r.content_type ?? "exercise"}`,
    `d=${dateLabel}`,
    eng,
    `t="${(r.recipe_title ?? "").slice(0, 80)}"`,
    r.workout_type ? `w=${r.workout_type}` : "",
    bodyParts ? `bp=${bodyParts}` : "",
    equip ? `eq=${equip}` : "",
    r.training_goal ? `goal=${r.training_goal}` : "",
    r.training_setting ? `set=${r.training_setting}` : "",
    r.fitness_level ? `lvl=${r.fitness_level}` : "",
    r.duration_minutes ? `${r.duration_minutes}min` : "",
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
  const promptLines = opts.shown.map((r) => fitnessReelToPromptLine(r)).join("\n");
  const extra = opts.extraInstruction ? `\n\n${opts.extraInstruction}\n` : "";

  return `Brand: ${opts.brandName}
Heutiges Datum: ${today}
Anzahl Trainings-Reels: ${opts.reels.length} (im Input gezeigt: ${opts.shown.length} top-engagement)
${extra}
Reels (eine Zeile pro Reel):
${promptLines}

Generiere 10-20 Trainings-Pack-Vorschlaege im JSON-Schema.`;
}

function filterAndValidate(
  raw: FitnessPackSuggestion[],
  validReelIds: Set<string>,
  brandBannedPhrases: string[]
): { clean: FitnessPackSuggestion[]; dirty: FitnessPackSuggestion[] } {
  const clean: FitnessPackSuggestion[] = [];
  const dirty: FitnessPackSuggestion[] = [];

  for (const s of raw) {
    const filteredIds = s.reelIds.filter((id) => validReelIds.has(id));
    if (filteredIds.length < 5) continue;
    const candidate = { ...s, reelIds: filteredIds };

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

export async function suggestFitnessPacks(opts: {
  brandName: string;
  /** Trainings-Reels: content_type IN ('exercise', 'workout', 'mindset') */
  fitnessReels: ReelRow[];
  brand?: Brand | null;
}): Promise<FitnessPackSuggestion[]> {
  if (opts.fitnessReels.length < 5) return [];

  // Pre-Filter: Top 200 nach Engagement (gleicher Token-Budget-Schutz wie
  // suggest-packs).
  const sorted = [...opts.fitnessReels].sort((a, b) => {
    const aEng = (a.like_count ?? 0) + (a.view_count ?? 0) / 10;
    const bEng = (b.like_count ?? 0) + (b.view_count ?? 0) / 10;
    return bEng - aEng;
  });
  const slice = sorted.slice(0, 200);
  const validIds = new Set(opts.fitnessReels.map((r) => r.id));

  const brandWithVoice = await ensureBrandVoiceProfile(opts.brand);
  const brandBanned = brandWithVoice?.voiceProfile?.bannedPhrases ?? [];

  const system = buildSystemInstruction(brandWithVoice, opts.brandName);
  const firstPrompt = buildUserPrompt({
    brandName: opts.brandName,
    reels: opts.fitnessReels,
    shown: slice,
  });

  let raw: FitnessPackSuggestion[] = [];
  try {
    const result = await callGemini<{ suggestions: FitnessPackSuggestion[] }>({
      prompt: firstPrompt,
      schema: RESPONSE_SCHEMA,
      systemInstruction: system,
      temperature: 0.6,
      maxOutputTokens: 16384,
      thinkingBudget: 1024,
      retries: 1,
      model: "flash",
    });
    raw = result.suggestions ?? [];
  } catch (err) {
    console.warn(
      "[suggest-fitness-packs] pass 1 failed:",
      err instanceof Error ? err.message : err
    );
    return [];
  }

  const { clean, dirty } = filterAndValidate(raw, validIds, brandBanned);
  if (clean.length >= 5) return clean;

  // Retry-Pass mit AVOID-Hint, wenn zu wenige saubere Suggestions
  if (dirty.length > 0 && brandBanned.length > 0) {
    const avoidHint = `WICHTIG: Vermeide diese Phrasen in title/subtitle/tagline/description: ${brandBanned.join(", ")}. Sie passen NICHT zum Stil von ${opts.brandName}.`;
    const retryPrompt = buildUserPrompt({
      brandName: opts.brandName,
      reels: opts.fitnessReels,
      shown: slice,
      extraInstruction: avoidHint,
    });
    try {
      const result = await callGemini<{ suggestions: FitnessPackSuggestion[] }>({
        prompt: retryPrompt,
        schema: RESPONSE_SCHEMA,
        systemInstruction: system,
        temperature: 0.5,
        maxOutputTokens: 16384,
        thinkingBudget: 1024,
        retries: 1,
        model: "flash",
      });
      const retryFiltered = filterAndValidate(
        result.suggestions ?? [],
        validIds,
        brandBanned
      );
      if (retryFiltered.clean.length > 0) {
        return [...clean, ...retryFiltered.clean].slice(0, 20);
      }
    } catch (err) {
      console.warn(
        "[suggest-fitness-packs] retry-pass failed:",
        err instanceof Error ? err.message : err
      );
    }
  }

  // Fallback: nehme alle Suggestions (auch die mit Banned-Hits) wenn sonst
  // gar keine kommen wuerden.
  return [...clean, ...dirty].slice(0, 20);
}
