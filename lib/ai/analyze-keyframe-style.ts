import { callGeminiMultimodal } from "./gemini";
import type { BrandImageStyle } from "./brand-image-style";

// Per-Recipe-Style-Ableitung aus dem Reel-Keyframe (PR 16). Vorher:
// DB-Brand bekam ein onboardingsweise gewaehltes Template (modern-
// minimal/patisserie-warm/...). Problem: das Template war oft generisch
// und matched nicht den echten Look von DIESEM Reel.
//
// Jetzt: pro Reel-Keyframe ein eigener Vision-Call. Gemini Flash schaut
// das Frame an und beschreibt Counter, Lighting, Camera-Aesthetic,
// Hero-Element-Pattern, default Camera-Angle. Diese Beschreibung fliesst
// 1:1 als BrandImageStyle in die Pipeline — gleiche Slots wie Bienes
// hardcoded BIENE_STYLE, nur dynamisch generiert.
//
// Gemini 2.5 Flash (nicht Pro!) — 1 Bild Multimodal-Call ist robust mit
// Flash, hat seit Identity-Analyse zuverlaessig funktioniert. Pro mit
// 10+ Bildern war das Problem; mit 1 Bild keine Schema-Validator-Issues.

export type ReelDerivedStyle = {
  sceneContext: string;
  lightingMood: string;
  cameraAesthetic: string;
  heroElementGuidance: string;
  defaultAngle: string;
  dishShape: "flat" | "layered" | "tall" | "liquid" | "mixed";
};

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    sceneContext: {
      type: "string",
      description:
        "English Beschreibung der Surface/Counter im Bild. Sehr spezifisch — Material UND Farbton. Beispiele: 'a smooth white marble surface with subtle grey veining', 'a pale-grey concrete kitchen counter', 'a warm walnut wooden cutting board on a folded linen runner', 'a soft cream-colored matte countertop'.",
    },
    lightingMood: {
      type: "string",
      description:
        "English Beschreibung der Lighting. Direction + intensity + color-temperature. Beispiele: 'bright natural daylight from above with soft even illumination', 'warm morning light streaming from the left with long shadows', 'cool diffused daylight from a window'.",
    },
    cameraAesthetic: {
      type: "string",
      description:
        "English Beschreibung des Camera-Setups + Overall-Aesthetic. Beispiele: 'natural unstaged food photograph, modern minimal styling, homemade-feeling', 'cookbook-style food photograph with intentional styling and props', 'editorial flat-lay with clean composition'.",
    },
    heroElementGuidance: {
      type: "string",
      description:
        "English Beschreibung was sonst noch im Bild ist — Garnish, Props, Hintergrund-Elemente. Beispiele: 'A small linen napkin folded loosely beside the bowl, with scattered cocoa flakes around it', 'A wooden cutting board with whole fruits sits softly in the background'. Wenn nichts: 'Keep styling minimal — the dish is the hero.'",
    },
    defaultAngle: {
      type: "string",
      description:
        "English Camera-Angle. Beispiele: 'from a high overhead angle looking down (about 80°, slightly tilted)', 'from a 30° three-quarter angle', 'from a 45° eye-level angle'.",
    },
    dishShape: {
      type: "string",
      enum: ["flat", "layered", "tall", "liquid", "mixed"],
      description:
        "Form des Gerichts. flat=pizza/pancake, layered=cake/lasagna, tall=burger/muffin, liquid=soup/smoothie, mixed=bowl/salad.",
    },
  },
  required: [
    "sceneContext",
    "lightingMood",
    "cameraAesthetic",
    "heroElementGuidance",
    "defaultAngle",
    "dishShape",
  ],
};

const SYSTEM_INSTRUCTION = `Du analysierst EIN Food-Photography-Bild (Reel-Keyframe) und beschreibst seinen visuellen Stil in englischen Praezisions-Phrasen, die als Prompt-Bausteine fuer ein KI-Bild-Generierungs-System (Flux 2 Pro) dienen.

Ziel: Flux soll spaeter ein neues Bild rendern, das diesen visuellen Stil reproduziert — gleiche Surface, gleiches Lighting, gleicher Look. Du beschreibst, was DU im Bild siehst.

WICHTIG:
- Antwort auf ENGLISCH (Flux versteht nur Englisch).
- Sei SPEZIFISCH und PRAEZISE. Nicht 'good lighting' — sondern 'bright natural daylight from above with soft even illumination'.
- Ignoriere Text-Overlays, Werbe-Sticker, Hashtags im Bild — die sind nicht Teil des Stils.
- Wenn das Bild ein Talking-Head oder Werbe-Cover ohne Gericht ist, gib trotzdem deine beste Einschaetzung des Hintergrund-Stils ab.

Antworte AUSSCHLIESSLICH im JSON-Schema.`;

export async function analyzeKeyframeStyle(
  keyframeDataUri: string
): Promise<ReelDerivedStyle | null> {
  // dataUri ist "data:image/jpeg;base64,..." — base64-Teil extrahieren
  const [, base64 = ""] = keyframeDataUri.split(",");
  if (!base64) return null;

  try {
    const result = await callGeminiMultimodal<ReelDerivedStyle>({
      parts: [
        {
          text: "Analysiere dieses Food-Photography-Bild und gib die visuellen Stil-Felder als JSON zurueck.",
        },
        {
          inlineData: { mimeType: "image/jpeg", data: base64 },
        },
      ],
      schema: RESPONSE_SCHEMA,
      systemInstruction: SYSTEM_INSTRUCTION,
      model: "flash",
      temperature: 0.4,
      maxOutputTokens: 1024,
      thinkingBudget: 0,
      retries: 1,
    });

    return {
      sceneContext: (result.sceneContext ?? "").trim(),
      lightingMood: (result.lightingMood ?? "").trim(),
      cameraAesthetic: (result.cameraAesthetic ?? "").trim(),
      heroElementGuidance: (result.heroElementGuidance ?? "").trim(),
      defaultAngle: (result.defaultAngle ?? "").trim(),
      dishShape: result.dishShape ?? "mixed",
    };
  } catch (err) {
    console.warn(
      "[analyze-keyframe-style] failed:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

// Baut aus dem Per-Reel-Style ein vollwertiges BrandImageStyle-Object,
// das durch die existing Pipeline (recipe-image-spec.ts + image-prompts.ts)
// laufen kann. Die enum-Listen lightingOptions+sceneOptions sind 5-fach
// Wiederholung des gleichen Wertes — der Image-Spec-Schema-Validator
// braucht ein non-leeres Array.
export function buildStyleFromReel(
  reelStyle: ReelDerivedStyle,
  brandSlug: string
): BrandImageStyle {
  return {
    brandSlug,
    lightingOptions: [reelStyle.lightingMood],
    sceneOptions: [reelStyle.sceneContext],
    styleSuffix: "",
    negativeAddition: "",
    cameraAesthetic: reelStyle.cameraAesthetic,
    heroElementGuidance: reelStyle.heroElementGuidance,
    defaultAngles: {
      [reelStyle.dishShape]: reelStyle.defaultAngle,
    },
  };
}
