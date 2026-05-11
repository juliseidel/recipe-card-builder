import { callGeminiMultimodal } from "./gemini";
import type { ExtractedFrame } from "./extract-video-frames";

// Phase-3-Pipeline Step 2: aus den ~14 Frames den besten Keyframe waehlen.
// Wir geben Gemini 2.5 Flash alle Frames + Caption + Recipe-Title und
// fragen nach EINEM Index (kein Timestamp, weil Indices in der Liste
// eindeutiger sind und Gemini sich nicht in Float-Rundungen verheddert).
//
// Prompt-Spec laut Jan's #3:
//   REQUIREMENTS:
//     - dish in finished form (cooked, assembled, garnished)
//     - dish ≥ 40 % der Bildflaeche
//     - keine Haende / Tools darueber
//     - keine Text-Overlays
//     - in focus, true colour
//     - matches recipe description
//   PREFERENCE (when multiple qualify):
//     - prefer frames from last 40 % of video
//     - prefer frame im serving vessel statt mid-plating
//     - prefer natural window light
//     - prefer full dish over partial
//   REJECT:
//     - strong color casts (greenish, orange tungsten, blue phone-screen)
//     - creator's face / body takes significant space
//     - dish < 50 % assembled
//     - heavy motion blur
//     - only ingredients / prep stages

const SYSTEM_INSTRUCTION = `Du bist ein Vision-Selektor fuer Food-Photography. Aus einer Reihe von Reel-Frames (jeder mit Index 0, 1, 2, ...) waehlst du EINEN, der als Reference-Image fuer professionelle Food-Photography genutzt wird.

ANFORDERUNGEN (alle muessen gelten):
- Das Gericht ist fertig (gekocht, angerichtet, garniert — nicht roh, nicht in der Zubereitung)
- Das Gericht ist das primaere Motiv (≥ 40 % der Bildflaeche)
- Keine Haende, Loeffel, Pfannenwender darueber
- Kein Text-Overlay / Caption / Sticker auf dem Essen
- Bild scharf, kein Motion-Blur
- Echte Farben sichtbar (nicht ueberbelichtet, nicht stark farbstich-verfaelscht)
- Gericht matcht das beschriebene Rezept

PRAEFERENZ-REIHENFOLGE (wenn mehrere Frames qualifizieren):
1. Frames aus dem letzten Drittel des Videos
2. Frames mit Gericht im Serving-Gefaess statt mid-plating
3. Frames mit natuerlichem Tageslicht
4. Frames mit vollstaendigem Gericht-Blick

VOLLSTAENDIG ABLEHNEN:
- Frames mit starkem Farbstich (gruenlich-fluoreszierend, orange-Glühlampe, blau-Bildschirm)
- Frames wo Gesicht oder Koerper des Creators viel Platz einnimmt
- Frames mit unter 50 % angerichtetem Gericht
- Heavy Motion-Blur
- Frames die nur Zutaten oder Zubereitungsschritte zeigen

Antworte AUSSCHLIESSLICH im JSON-Schema mit dem Index (0-basiert) des gewaehlten Frames und einer kurzen reasoning-Notiz. Wenn KEIN Frame die Anforderungen erfuellt, gib den am wenigsten schlechten zurueck und vermerke das in reasoning.`;

const SCHEMA = {
  type: "object",
  properties: {
    chosenIndex: {
      type: "integer",
      description:
        "0-basierter Index des gewaehlten Frames in der uebergebenen Liste.",
    },
    reasoning: {
      type: "string",
      description:
        "Ein deutscher Satz: warum dieser Frame gewaehlt wurde (oder welche Kompromisse gemacht wurden).",
    },
  },
  required: ["chosenIndex", "reasoning"],
};

export type KeyframeSelection = {
  frame: ExtractedFrame;
  index: number;
  reasoning: string;
};

export async function selectBestKeyframe(opts: {
  frames: ExtractedFrame[];
  recipeTitle: string;
  caption: string;
}): Promise<KeyframeSelection> {
  if (opts.frames.length === 0) {
    throw new Error("No frames to choose from");
  }
  if (opts.frames.length === 1) {
    return { frame: opts.frames[0], index: 0, reasoning: "Nur ein Frame verfuegbar." };
  }

  const userText = [
    `Rezept-Titel: ${opts.recipeTitle}`,
    "",
    `Caption (Auszug):`,
    opts.caption.slice(0, 1500),
    "",
    `Frames (in Reihenfolge ab Video-Start, mit Index und Timestamp in Sekunden):`,
    ...opts.frames.map(
      (f, i) => `[Index ${i}] Timestamp ${f.timestampSeconds.toFixed(1)} s`
    ),
    "",
    `Waehle den besten Index gemaess Anforderungen.`,
  ].join("\n");

  const parts: Array<
    { text: string } | { inlineData: { mimeType: string; data: string } }
  > = [{ text: userText }];
  for (const f of opts.frames) {
    // dataUri ist "data:image/jpeg;base64,...." — wir trennen den base64-Teil ab.
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
