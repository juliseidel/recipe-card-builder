import { callGeminiMultimodal } from "./gemini";
import type { ExtractedFrame } from "./extract-video-frames";

// V7 Reference-Frame-Selector — Vision schaut alle Frames durch, wählt
// den besten Kandidaten für Reference-Image und sagt WIE wir ihn cropen
// müssen, um Text/Hände/Sticker physisch wegzuschneiden.
//
// Reels haben oft:
//   - Untertitel-Banner unten (untere 25%)
//   - POV-Texte mittig auf dem Gericht (uncroppable)
//   - Werbe-Logo oben rechts (obere 15%)
//   - Hand die Cup hält (Vordergrund)
//
// Strategie:
//   1. Vision wählt aus den letzten ~15 Frames den mit dem prominentesten
//      Dish UND der wenigsten Text/Hand-Belastung.
//   2. Vision sagt cropMode an: welcher quadratische Bereich des Frames
//      enthält nur das Gericht, kein Schmutz?
//   3. Wenn kein clean cropable Bereich existiert → cleanEnough=false.
//      Caller fällt auf text-only-Pipeline zurück (V6).

export type CropMode =
  | "center_square" // mittige 1080x1080 aus 1080x1920 — Standard
  | "top_square" // oberes Quadrat (Text unten weg)
  | "bottom_square" // unteres Quadrat (Text oben weg)
  | "uncroppable"; // Text/Hand mittig → keine clean crop möglich

export type ReferenceFrameSelection = {
  chosenIndex: number;
  cropMode: CropMode;
  cleanEnough: boolean;
  reasoning: string;
};

// Schema bewusst SIMPEL ohne enum — Gemini Flash hat manchmal Schema-
// Probleme bei enum + multi-image. Wir nehmen Strings + post-validieren.
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    chosenIndex: {
      type: "integer",
      description:
        "0-basierter Index des besten Frames. -1 wenn alle Frames zu schmutzig sind.",
    },
    cropMode: {
      type: "string",
      description:
        "Eines von: 'center_square' (mittiger Crop, Text nur oben/unten), 'top_square' (oberer Crop, Text nur unten), 'bottom_square' (unterer Crop, Text nur oben), 'uncroppable' (Text mittig drüber, kein clean crop möglich).",
    },
    cleanEnough: {
      type: "boolean",
      description:
        "true wenn nach Crop ein sauberer Reference-Frame entsteht. false wenn cropMode='uncroppable' oder chosenIndex=-1.",
    },
    reasoning: {
      type: "string",
      description: "Ein deutscher Satz Begründung.",
    },
  },
  required: ["chosenIndex", "cropMode", "cleanEnough", "reasoning"],
};

const SYSTEM_INSTRUCTION = `Du bekommst mehrere Frames aus einem Cooking-Reel und wählst den besten als REFERENCE-Image für ein KI-Bild-Generierungs-System (Flux 2 Pro).

Ziel: Flux soll die ECHTE FARBE und FORM des Gerichts vom Reference übernehmen. Daher brauchen wir einen Frame, der:
  1. Das fertige Gericht prominent zeigt (mindestens 40% der Bildfläche)
  2. Kein Text/Banner/Watermark/Sticker enthält ODER der Text in croppen-bare Bereiche liegt
  3. Keine Hand/Finger/Person enthält
  4. Scharfe Farben (kein motion blur, kein extreme Über-/Unterbelichtung)

CROP-LOGIC (kritisch wichtig):
Reels sind typisch 1080x1920 (9:16). Wir cropen zum 1:1 Quadrat. Vier Crop-Modi:
  - "center_square": mittiger Crop ab y_center. Schneidet oberen + unteren ~25% weg. NUTZE wenn Text/Banner nur am oberen UND/ODER unteren Rand sind. (Häufigster Fall.)
  - "top_square": oberer Crop. Schneidet untere 45% weg. NUTZE wenn Text NUR unten ist, Dish aber im oberen Bereich.
  - "bottom_square": unterer Crop. Schneidet obere 45% weg. NUTZE wenn Text NUR oben ist (Watermark/Logo), Dish im unteren Bereich.
  - "uncroppable": Text/Hand mittig drüber gelegt. KEIN clean crop möglich. → cleanEnough=false setzen.

KEY-DECISION:
- Wenn der gewählte Frame nach Crop sauber wäre → cleanEnough=true
- Wenn auch nach Crop noch Text/Hand sichtbar bleibt → cleanEnough=false
- Wenn ALLE Frames zu schmutzig sind → chosenIndex=-1, cropMode="uncroppable", cleanEnough=false

Lieber konservativ: bei Zweifel cleanEnough=false setzen. Der Caller hat einen sauberen text-only-Fallback. Ein verschmutztes Reference-Image macht das Output schlechter, kein Reference macht es immer noch okay.

Antworte AUSSCHLIESSLICH im JSON-Schema.`;

export async function selectReferenceFrame(
  frames: ExtractedFrame[]
): Promise<ReferenceFrameSelection | null> {
  if (frames.length === 0) return null;

  const userText = [
    `${frames.length} frame(s) from a cooking reel follow, in time order.`,
    "Choose the best frame for use as a Reference-Image. Tell us how to crop it.",
  ].join("\n");

  const parts: Array<
    { text: string } | { inlineData: { mimeType: string; data: string } }
  > = [{ text: userText }];
  for (const frame of frames) {
    const base64 = frame.dataUri.split(",")[1] ?? "";
    parts.push({
      inlineData: { mimeType: "image/jpeg", data: base64 },
    });
  }

  try {
    const result = await callGeminiMultimodal<{
      chosenIndex: number;
      cropMode: string;
      cleanEnough: boolean;
      reasoning: string;
    }>({
      parts,
      schema: RESPONSE_SCHEMA,
      systemInstruction: SYSTEM_INSTRUCTION,
      // Flash statt Pro — bei multi-image Schema-Calls oft stabiler.
      model: "flash",
      temperature: 0.2,
      maxOutputTokens: 512,
      thinkingBudget: 0,
      retries: 1,
    });

    const rawMode = (result.cropMode ?? "").toLowerCase().trim();
    const validModes: CropMode[] = [
      "center_square",
      "top_square",
      "bottom_square",
      "uncroppable",
    ];
    const cropMode: CropMode = validModes.includes(rawMode as CropMode)
      ? (rawMode as CropMode)
      : "uncroppable";

    console.log(
      `[select-reference-frame] index=${result.chosenIndex} mode=${cropMode} clean=${result.cleanEnough} — ${(result.reasoning ?? "").slice(0, 150)}`
    );

    return {
      chosenIndex: result.chosenIndex ?? -1,
      cropMode,
      cleanEnough: Boolean(result.cleanEnough),
      reasoning: (result.reasoning ?? "").trim(),
    };
  } catch (err) {
    console.error(
      "[select-reference-frame] failed:",
      err instanceof Error
        ? `${err.name}: ${err.message}`
        : String(err)
    );
    return null;
  }
}
