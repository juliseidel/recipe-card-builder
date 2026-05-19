import { callGeminiMultimodal } from "./gemini";
import type { ExtractedFrame } from "./extract-video-frames";

// Fitness-Variante von select-keyframe.ts. Selektiert aus ~14 Reel-Frames
// den besten Frame fuer Hero-Bild einer Trainings-Karte.
//
// Andere Anforderungen als bei Food:
//   - Bei Food (select-keyframe.ts): fertiges Gericht ≥ 40 %, keine Haende,
//     keine Talking-Heads, ruhige Komposition.
//   - Bei Fitness: PERSON IN AKTION ist gewuenscht. Mid-Execution-Phase
//     (z.B. Squat in tiefster Position, Wall Ball in der Luft, Sled Push
//     mit Spannung). Gesicht teilweise ok, aber nicht vor der Kamera als
//     Talking-Head. Bewegung soll lesbar sein.
//
// Anti-Pattern (wird abgelehnt):
//   - Talking-Head VOR oder NACH der Uebung (Person erklaert in die Kamera)
//   - Bild zeigt nur Equipment ohne Person (langweilig)
//   - Bild zeigt nur Endposition stehend zwischen Sets
//   - Heavy Motion-Blur
//   - Strong color casts oder schlechte Belichtung

const SYSTEM_INSTRUCTION = `Du bist ein Vision-Selektor fuer Fitness-Photography. Aus einer Reihe von Reel-Frames (jeder mit Index 0, 1, 2, ...) waehlst du EINEN, der als Hero-Bild fuer eine Trainings-Karte (Uebung oder Workout) genutzt wird.

ANFORDERUNGEN (alle muessen gelten):
- Person ist sichtbar (idealerweise Ganzkoerper oder Hueftaufwaerts)
- Die Person fuehrt die Uebung GERADE aus (Mid-Execution-Moment):
  * Bei Squats: tiefste Position oder Aufwaerts-Phase
  * Bei Wall Ball: Ball in der Luft oder beim Catch
  * Bei Sled Push: vollstaendige Druck-Position mit klarer Spannung
  * Bei Burpees: Push-Up-Bottom oder Jump-Up
  * Bei Hantel-Uebungen: Concentric (Aufwaerts) oder Bottom-Position
- Form/Technik gut lesbar (Position, Koerper-Linie, Equipment klar)
- Bild scharf, kein Motion-Blur (leichter Bewegungs-Blur in Glied ist ok)
- Echte Farben, gute Belichtung

PRAEFERENZ-REIHENFOLGE (wenn mehrere Frames qualifizieren):
1. Frames mit klarem Mid-Execution-Moment (statt Setup oder Ruhe-Position)
2. Frames mit dynamischer Komposition (Diagonale, Bewegungs-Richtung)
3. Frames mit gutem Equipment-Kontext sichtbar
4. Frames aus dem Mittelteil oder letzten Drittel des Videos
5. Frames mit natuerlichem Licht statt knallharter Studio-Beleuchtung

VOLLSTAENDIG ABLEHNEN:
- Talking-Head: Person erklaert vor der Kamera, keine Uebungs-Ausfuehrung
- Person steht ruhig zwischen Sets ohne Spannung
- Nur Equipment im Bild, keine Person
- Person liegt auf dem Boden vor/nach der Uebung
- Selbstpromotion-Shots (Posing, Mirror-Selfie)
- Frames mit Werbe-Text-Overlay vom Creator
- Heavy Motion-Blur
- Strong color casts oder schwere Ueberbelichtung
- Frames die nur Vor/Nach-Vergleiche zeigen

Antworte AUSSCHLIESSLICH im JSON-Schema mit dem Index (0-basiert) des gewaehlten Frames und einer kurzen reasoning-Notiz. Wenn KEIN Frame die Anforderungen erfuellt, gib den am wenigsten schlechten zurueck und vermerke das in reasoning.`;

const SCHEMA = {
  type: "object",
  properties: {
    chosenIndex: {
      type: "integer",
      description: "0-basierter Index des gewaehlten Frames.",
    },
    reasoning: {
      type: "string",
      description:
        "Ein deutscher Satz: warum dieser Frame gewaehlt wurde (oder welche Kompromisse).",
    },
  },
  required: ["chosenIndex", "reasoning"],
};

export type ExerciseKeyframeSelection = {
  frame: ExtractedFrame;
  index: number;
  reasoning: string;
};

export async function selectBestExerciseKeyframe(opts: {
  frames: ExtractedFrame[];
  exerciseTitle: string;
  caption: string;
}): Promise<ExerciseKeyframeSelection> {
  if (opts.frames.length === 0) {
    throw new Error("No frames to choose from");
  }
  if (opts.frames.length === 1) {
    return {
      frame: opts.frames[0],
      index: 0,
      reasoning: "Nur ein Frame verfuegbar.",
    };
  }

  const userText = [
    `Uebungs-/Workout-Titel: ${opts.exerciseTitle}`,
    "",
    `Caption (Auszug):`,
    opts.caption.slice(0, 1500),
    "",
    `Frames (in Reihenfolge ab Video-Start):`,
    ...opts.frames.map(
      (f, i) => `[Index ${i}] Timestamp ${f.timestampSeconds.toFixed(1)} s`
    ),
    "",
    `Waehle den besten Index fuer Hero-Bild einer Trainings-Karte.`,
  ].join("\n");

  const parts: Array<
    { text: string } | { inlineData: { mimeType: string; data: string } }
  > = [{ text: userText }];
  for (const f of opts.frames) {
    const base64 = f.dataUri.split(",")[1] ?? "";
    parts.push({
      inlineData: { mimeType: "image/jpeg", data: base64 },
    });
  }

  const raw = await callGeminiMultimodal<{
    chosenIndex: number;
    reasoning: string;
  }>({
    parts,
    schema: SCHEMA,
    systemInstruction: SYSTEM_INSTRUCTION,
    temperature: 0.1,
    maxOutputTokens: 256,
    thinkingBudget: 0,
    retries: 1,
  });

  const idx = Math.min(
    Math.max(0, Math.floor(raw.chosenIndex ?? 0)),
    opts.frames.length - 1
  );
  return {
    frame: opts.frames[idx],
    index: idx,
    reasoning: (raw.reasoning ?? "").trim() || "(keine Begruendung)",
  };
}
