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
- Keine Haende, Finger, Arme, Loeffel, Pfannenwender ueber dem Gericht
- Kein Text-Overlay, kein Recipe-Titel, keine Caption, kein Sticker, kein Werbe-Stempel auf dem Bild
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

KRITISCH — Null-Return-Path:
Wenn ALLE Frames mindestens eines der folgenden Probleme haben — und KEINER ein clean food shot ohne Text/Personen ist — setze noCleanFrameAvailable auf true und chosenIndex auf -1:
  - alle Frames haben Text-Overlays / Recipe-Titel / Cover-Schrift
  - alle Frames zeigen prominent Personen, Haende oder Finger
  - alle Frames sind mid-cooking / nur Zutaten / nicht das fertige Gericht
Das Downstream-System uebernimmt dann text-only-Generation statt eines schlechten Reference-Image.

Wenn mindestens ein Frame OK ist (auch wenn nicht perfekt), waehle den besten und setze noCleanFrameAvailable auf false. Compromise-Picks sind OK, solange das Gericht klar und ohne Text/Personen erkennbar ist.

Antworte AUSSCHLIESSLICH im JSON-Schema.`;

const SCHEMA = {
  type: "object",
  properties: {
    chosenIndex: {
      type: "integer",
      description:
        "0-basierter Index des gewaehlten Frames in der uebergebenen Liste. -1 wenn noCleanFrameAvailable=true (kein Frame ist sauber genug).",
    },
    noCleanFrameAvailable: {
      type: "boolean",
      description:
        "true wenn ALLE Frames Text-Overlays, prominente Personen oder unfertige Zubereitung zeigen — dann skippt das System die Reference und macht text-only Generation.",
    },
    reasoning: {
      type: "string",
      description:
        "Ein deutscher Satz: warum dieser Frame gewaehlt wurde — oder warum noCleanFrameAvailable=true (welche Probleme alle Frames hatten).",
    },
  },
  required: ["chosenIndex", "noCleanFrameAvailable", "reasoning"],
};

export type KeyframeSelection = {
  frame: ExtractedFrame;
  index: number;
  reasoning: string;
};

// Returnt null wenn keiner der Frames sauber genug ist — dann fallback
// im Caller zu text-only Flux mit Vision-Description als Anker.
export async function selectBestKeyframe(opts: {
  frames: ExtractedFrame[];
  recipeTitle: string;
  caption: string;
}): Promise<KeyframeSelection | null> {
  if (opts.frames.length === 0) {
    return null;
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
    noCleanFrameAvailable: boolean;
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

  // Null-Return-Path: Gemini hat erkannt dass ALLE Frames Probleme haben.
  // Caller faellt auf text-only Generation zurueck.
  if (raw.noCleanFrameAvailable || raw.chosenIndex < 0) {
    console.log(
      `[select-keyframe] no clean frame — ${(raw.reasoning ?? "").slice(0, 200)}`
    );
    return null;
  }

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
