import type { Pack } from "@/lib/packs";
import { generateImage, downloadImage } from "./bfl-flux";
import { callGemini } from "./gemini";

// Pack-Outro-Image (Mai 2026)
//
// Driitter Image-Pfad neben Cover und Foreword. Bewusst eigenes Modul,
// nicht in generate-pack-cover / generate-foreword-image gemerged:
//
//   - Cover    = atmospheric Lifestyle-Action ("dish being plated", "hands
//                working", "table set"), 3:4 Portrait
//   - Foreword = ruhiges Still-Life (Ingredients/Utensils), 1:1
//   - Outro    = "after the meal" / abendliche Ruhe — der Moment NACH dem
//                Kochen: abgesetzter Tisch, leere Teller mit Krümeln, eine
//                Tasse Kaffee im Spätlicht, eine Hand die das Geschirr-
//                tuch wegnimmt — visuell langsam, emotional warm. 3:4.
//
// Der Renderer legt eine zentrierte Floating-Quote-Card darüber. Dafür
// promptet wir hart "generous negative space in the center" — sonst
// landet das Subject genau hinter der Karte und ist visuell verloren.
//
// Text rendert die Karte; Bild bleibt textfrei (Negative-Prompt).

export type PackOutroStyle = {
  /** Was passiert in der Szene — "after the meal"-Stimmung. */
  scene: string;
  /** Surface der Szene. */
  surface: string;
  /** Lichtstimmung — eher Spätlicht / Abend / Nach-Mahlzeit-Ruhe. */
  lighting: string;
  /** Color-cast hint aus Pack-Mood. */
  colorCast: string;
  /** Camera-Angle. Outro meist overhead 80-90° oder soft 30° — Subject
   *  RAND-positioniert (links oder rechts), Center bleibt leer. */
  angle: string;
};

// Pack-spezifische Outro-Recipes für kuratierte Bienen-Packs.
// Bewusst "abgeschlossen" — der Moment NACH dem Essen, nicht währenddessen.
const PACK_OUTRO_STYLES: Record<string, PackOutroStyle> = {
  "bienes-backwelt": {
    scene:
      "an empty pale-ceramic cake plate at the upper-right of the frame with a few crumbs and a fork resting on its rim, a folded honey-coloured linen napkin nearby, a half-finished cup of coffee at the very edge of the frame — entire center of the frame is empty wooden table",
    surface: "weathered pale-wood baker's table",
    lighting:
      "soft late-afternoon window light from the upper right, long warm shadows, intimate after-baking calm",
    colorCast: "warm cream tinged with honey-amber",
    angle: "overhead 75° angle with subject positioned to the right third, generous empty negative space center and left",
  },
  "volumen-wunder": {
    scene:
      "two empty pale-ceramic bowls stacked at the upper-right of the frame with a fork inside, half a lime and a folded linen towel beside them — the entire lower-center of the frame is empty stone counter with one stray sprig of mint",
    surface: "natural unbleached linen runner over pale stone counter",
    lighting:
      "soft late-afternoon daylight, gentle shadows, after-lunch calm",
    colorCast: "sage-green tinged warm daylight",
    angle: "overhead 80° angle with subject positioned upper-right, large empty negative space center and lower-left",
  },
  "blitz-snacks": {
    scene:
      "a single small empty ceramic ramekin with one tiny silver spoon resting beside it, a long simple white napkin folded flat — positioned at the upper-right of the frame, the entire center and lower-left is empty smooth surface",
    surface: "smooth concrete-look matte ceramic surface",
    lighting:
      "soft indirect daylight, almost no shadow, minimal calm",
    colorCast: "mint-tinged near-white",
    angle: "overhead 90° flat-lay with subject upper-right, generous negative space center",
  },
  "meal-prep-heroes": {
    scene:
      "three matching empty glass meal-prep containers in a neat row at the upper-edge of the frame, lids open, a folded notebook with a closed pen resting beside them — the entire lower-center of the frame is empty concrete counter",
    surface: "pale grey concrete kitchen counter",
    lighting:
      "soft evening kitchen light, organised after-Sunday-prep calm",
    colorCast: "sky-blue tinged cool cream",
    angle: "30° angled overhead with subject in the upper third, large empty negative space lower-center",
  },
  "feierabend-klassiker": {
    scene:
      "an empty deep-walled cast-iron pan with a wooden spoon resting on its rim positioned at the upper-right of the frame, two empty rustic ceramic plates stacked beside it, a folded honey-coloured kitchen towel — the entire center and lower-left of the frame is empty walnut wood",
    surface: "warm-toned dark walnut wood table",
    lighting:
      "golden-hour late-evening window light, warm long shadows, magazine-cover after-dinner atmosphere",
    colorCast: "honey-amber warm",
    angle: "30-40° three-quarter view, subject upper-right, generous empty negative space center and lower-left",
  },
};

const FALLBACK_STYLE: PackOutroStyle = {
  scene:
    "an empty ceramic plate with a fork resting on its rim at the upper-right of the frame, a folded linen napkin nearby — the entire center and lower-left of the frame is empty wood",
  surface: "pale weathered wood",
  lighting: "soft late-afternoon window light, gentle warm shadows",
  colorCast: "warm neutral cream",
  angle: "overhead 75° angle with subject upper-right, generous negative space center",
};

function styleFromTitle(title: string): PackOutroStyle | null {
  const t = title.toLowerCase();
  if (
    t.includes("airfryer") ||
    t.includes("heißluft") ||
    t.includes("heisluft") ||
    t.includes("fritteuse")
  ) {
    return {
      scene:
        "an empty airfryer with the basket sitting beside it, a folded kitchen towel and one used dipping bowl — positioned at the upper-right, entire center is empty concrete counter",
      surface: "pale grey concrete kitchen counter",
      lighting:
        "soft evening daylight, clean shadows, after-cooking calm",
      colorCast: "warm amber-cream",
      angle: "30-40° three-quarter with subject upper-right, large empty center",
    };
  }
  if (t.includes("snack") || t.includes("naschen") || t.includes("bites")) {
    return {
      scene:
        "an empty small ceramic ramekin with a tiny silver spoon beside it, a flat folded white napkin — upper-right of the frame, entire center and lower-left empty",
      surface: "smooth concrete-look matte ceramic surface",
      lighting:
        "soft indirect daylight, very even, minimal calm",
      colorCast: "mint-tinged near-white",
      angle: "overhead 90° with subject upper-right, generous negative space center",
    };
  }
  if (t.includes("meal") || t.includes("prep") || t.includes("vorkoch")) {
    return {
      scene:
        "three empty glass meal-prep containers stacked at the upper-edge, lids open, a closed notebook with pen beside them — entire lower-center empty",
      surface: "pale grey concrete kitchen counter",
      lighting:
        "soft evening kitchen light, organised after-prep calm",
      colorCast: "sky-blue tinged cool cream",
      angle: "30° angled overhead, subject upper, large empty negative space lower",
    };
  }
  if (
    t.includes("backwelt") ||
    t.includes("backen") ||
    t.includes("backwaren") ||
    t.includes("dessert") ||
    t.includes("kuchen")
  ) {
    return {
      scene:
        "an empty pale-ceramic cake plate with crumbs and a fork at the upper-right, a folded honey-coloured linen napkin, a half-finished cup of coffee at the edge — entire center empty wood",
      surface: "weathered pale-wood baker's table",
      lighting:
        "soft late-afternoon window light, long warm shadows, intimate after-baking calm",
      colorCast: "warm cream tinged with honey-amber",
      angle: "overhead 75° with subject upper-right, generous empty negative space center",
    };
  }
  if (t.includes("salat") || t.includes("bowl") || t.includes("veggie")) {
    return {
      scene:
        "two empty stacked bowls with a fork inside at the upper-right, half a lime and a folded linen towel — entire lower-center empty stone with one sprig of mint",
      surface: "natural unbleached linen runner over pale stone counter",
      lighting:
        "soft late-afternoon daylight, gentle shadows, after-lunch calm",
      colorCast: "sage-green tinged warm daylight",
      angle: "overhead 80° with subject upper-right, large empty negative space center",
    };
  }
  if (t.includes("frühstück") || t.includes("breakfast") || t.includes("morgen")) {
    return {
      scene:
        "an empty breakfast bowl with a spoon resting inside at the upper-right of the frame, a small jug with a few drops of milk, a folded linen napkin — entire center is empty wood, a single ray of morning light",
      surface: "warm-toned oak wood breakfast table",
      lighting:
        "soft golden mid-morning window light, warm intimate shadows, after-breakfast calm",
      colorCast: "warm honey-amber morning",
      angle: "30-45° three-quarter with subject upper-right, generous negative space center",
    };
  }
  return null;
}

const STYLE_INFERENCE_SCHEMA = {
  type: "object",
  properties: {
    scene: {
      type: "string",
      description:
        "1-2 Saetze beschreibung der \"after the meal\"-Szene. Englisch. Subject ist IMMER abgeschlossen (empty plate, used cup, folded napkin) und VISUELL AM RAND positioniert (upper-right/upper-left/upper-third) — Center MUSS leer sein, da eine Quote-Card drüber rendert. NIE plated dish, NIE Personen-Gesichter. Max 280 chars.",
    },
    surface: {
      type: "string",
      description:
        "Englischer Surface-Hint, max 80 chars.",
    },
    lighting: {
      type: "string",
      description:
        "Englischer Lighting-Hint, max 140 chars. Late-afternoon / evening / after-meal calm bevorzugt.",
    },
    colorCast: {
      type: "string",
      description:
        "Englischer Color-Cast-Hint, max 60 chars.",
    },
    angle: {
      type: "string",
      description:
        "Englischer Camera-Angle-Hint, max 100 chars. MUSS explizit 'subject upper-right' oder 'subject upper-third' oder 'subject upper-left' enthalten + 'generous negative space center'.",
    },
  },
  required: ["scene", "surface", "lighting", "colorCast", "angle"],
};

async function inferStyleViaGemini(pack: Pack): Promise<PackOutroStyle | null> {
  try {
    const result = await callGemini<PackOutroStyle>({
      prompt: `Generate an "after the meal" scene description for a recipe-pack OUTRO image. The outro is the LAST page of the pack — it should evoke the quiet moment after cooking/eating, NOT the dish itself.

Pack-Title: ${pack.title}
Pack-Subtitle: ${pack.subtitle ?? "—"}
Pack-Tagline: ${pack.tagline ?? "—"}
Pack-Category: ${pack.category ?? "—"}

CRITICAL: The center of the frame MUST be empty — a quote-card with text renders over it. Position the subject in the upper-right, upper-left, or upper-third of the frame. The center and lower portions stay visually quiet.

Subject items are ALWAYS finished/used (empty plate, used cup, folded napkin, closed container, fork resting on rim). NEVER plated dishes, NEVER faces.

REGELN:
- Subject upper-edge of frame, center empty for overlay
- "After the meal" emotional register — late-afternoon / evening calm
- NO faces visible (hands welcome only if at edge)
- Real food remnants, intimate inviting closing-moment feel`,
      schema: STYLE_INFERENCE_SCHEMA,
      systemInstruction:
        "You generate quiet 'after-meal' scene descriptions for the final page of cookbook chapters. Always answer in English. Subject MUST be edge-positioned, center MUST be empty for a text overlay.",
      temperature: 0.6,
      maxOutputTokens: 1024,
      thinkingBudget: 0,
      retries: 1,
      model: "flash",
    });
    if (!result.scene?.trim() || !result.surface?.trim()) return null;
    return {
      scene: result.scene.trim().slice(0, 320),
      surface: result.surface.trim().slice(0, 100),
      lighting:
        result.lighting?.trim().slice(0, 160) ||
        "soft late-afternoon window light, gentle warm shadows",
      colorCast: result.colorCast?.trim().slice(0, 80) || "warm neutral cream",
      angle:
        result.angle?.trim().slice(0, 120) ||
        "overhead 75° with subject upper-right, generous negative space center",
    };
  } catch (err) {
    console.warn(
      "[generate-outro-image] inferStyleViaGemini failed:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

const OUTRO_NEGATIVE =
  "no text, no words, no letters, no captions, no titles, no written language, no signage, no watermark, no logo, no brand names, no packaging labels, no faces, no people-faces, no humans-with-faces, no fully-plated dish, no ready-to-eat portion, no fresh-from-the-oven food, no busy chaotic scene, no clutter, no fingers in extreme close-up, no body parts visible in extreme close-up, no plastic-looking food, no unnatural gloss, no oversaturated colours, no harsh studio lighting, no fluorescent lighting, no white-void background, no AI artifacts, no CGI, no illustration, no painting, no drawing, no cartoon";

export type PackOutroBuildResult = {
  prompt: string;
  negative: string;
};

export async function buildPackOutroPrompt(
  pack: Pack
): Promise<PackOutroBuildResult> {
  const style =
    PACK_OUTRO_STYLES[pack.slug] ??
    styleFromTitle(pack.title) ??
    (await inferStyleViaGemini(pack)) ??
    FALLBACK_STYLE;

  const prompt = [
    `A quiet "after the meal" editorial photograph for the closing page of a recipe pack.`,
    `${style.scene}, on ${style.surface}, photographed ${style.angle}.`,
    `${style.lighting}.`,
    `Color grading: ${style.colorCast} tones, gentle and warm, never neon.`,
    `Shot on a 50 mm lens at f/2.8, slight natural film grain, magazine-quality composition.`,
    `CRITICAL: large empty negative space in the center of the frame for a text overlay — the subject sits at the edge, the middle of the frame is visually quiet.`,
    `The mood is intimate, content, after-the-meal calm — like the last page of a beloved cookbook.`,
  ].join(" ");

  return { prompt, negative: OUTRO_NEGATIVE };
}

export async function generateOutroImage(
  pack: Pack,
  opts: { seed?: number } = {}
): Promise<Buffer> {
  const { prompt, negative } = await buildPackOutroPrompt(pack);
  const result = await generateImage({
    prompt,
    negativePrompt: negative,
    model: "flux-2-pro",
    // 3:4 wie Cover — passt fast verlustfrei in A4 1:1.414, marginaler
    // Top/Bottom-Crop bei objectFit cover.
    aspectRatio: "3:4",
    outputFormat: "jpeg",
    safetyTolerance: 2,
    seed: opts.seed,
  });
  return await downloadImage(result.imageUrl);
}
