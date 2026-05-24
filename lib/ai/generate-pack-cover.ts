import type { Pack } from "@/lib/packs";
import { generateImage, downloadImage } from "./bfl-flux";
import { callGemini } from "./gemini";

// Pack-Cover (full-bleed-Edition, Mai 2026)
//
// Pre-refactor: Single-Dish auf Solid-Backdrop (Bon-Appétit clean, 1:1).
// War gebaut für 1:1-Container neben einem Editorial-Textblock. Sobald das
// Bild full-bleed über die ganze A4-Seite läuft, wirkt der Solid-Backdrop
// flach und stock-fotomäßig — kein Cookbook-Cover-Feel.
//
// Jetzt: atmospheric Lifestyle/Kitchen-Szene, Aspect 3:4 Portrait (passt
// fast verlustfrei in A4 1:1.414, marginaler Top/Bottom-Crop bei
// objectFit cover). Bewusst Pack-spezifisch via Style-Inferenz (analog
// generate-foreword-image.ts), damit Niclas' "kein Template-Feel" trifft.
//
// Unterscheidung zu den anderen beiden Image-Pipelines:
//   - Cover (hier)    = atmospheric Lifestyle, hands working / table set / kitchen scene, 3:4
//   - Foreword-Bild   = ruhiges Still-Life (Ingredients + Utensils), 1:1
//   - Outro-Bild      = "after the meal" / abendliche Ruhe, 3:4 (analog Cover)
//
// Text rendert react-pdf drüber — wir prompten hart "no text" und
// "negative space at bottom-left" damit der Title-Overlay-Bereich
// visuell ruhig bleibt. Pack-Mood-Color geht als Color-Cast Hint.

export type PackCoverStyle = {
  /** Was passiert in der Szene — Lifestyle/Kitchen, NICHT Still-Life. */
  scene: string;
  /** Surface der Szene (Wood-Counter, Concrete-Counter, Marble, etc.). */
  surface: string;
  /** Lichtstimmung — passt zum Pack-Emotional-Register. */
  lighting: string;
  /** Color-Cast Hint aus Pack-Mood, hält Bild farblich anchored. */
  colorCast: string;
  /** Camera-Angle. Cover meist 30-45° three-quarter cookbook-feel. */
  angle: string;
};

// Pack-spezifische Cover-Recipes, hand-getuned für die kuratierten
// Bienen-Packs. Sub-Niche-spezifisch genug damit jedes Pack-Cover wie
// "ein anderes Kapitel" aussieht, nicht wie "ein Template mit anderem Bild".
const PACK_COVER_STYLES: Record<string, PackCoverStyle> = {
  "bienes-backwelt": {
    scene:
      "two hands gently dusting flour over a freshly-baked vanilla bundt cake on a wire cooling rack, a small enamel measuring cup with cocoa flakes nearby, three vanilla pods, a soft cloud of flour caught in the light",
    surface: "weathered pale-wood baker's table",
    lighting:
      "soft late-morning window light from the upper left, dust motes visible, gentle warm shadows",
    colorCast: "lavender-tinged warm cream",
    angle: "45° three-quarter cookbook-cover composition, slight editorial tilt",
  },
  "volumen-wunder": {
    scene:
      "a deep ceramic bowl filled with vibrant green leaves and roasted vegetables on a kitchen island, a wooden serving spoon mid-action lifting a portion, half a cucumber and two limes scattered nearby, a folded linen towel",
    surface: "natural unbleached linen runner over pale stone counter",
    lighting:
      "bright, clean noon kitchen light, fresh and energetic, crisp shadows",
    colorCast: "sage-green tinged daylight white",
    angle: "30° angled overhead cookbook composition",
  },
  "blitz-snacks": {
    scene:
      "a single small ceramic ramekin with three perfect berries and a tiny silver spoon mid-air about to scoop, surrounding white napkin folded flat, soft minimal styling",
    surface: "smooth concrete-look matte ceramic surface",
    lighting:
      "soft indirect daylight, very even almost shadowless, apple-store-clean feel",
    colorCast: "mint-tinged near-white",
    angle: "30° three-quarter composition with generous negative space bottom-left for title overlay",
  },
  "meal-prep-heroes": {
    scene:
      "three matching glass meal-prep containers in a neat row on a kitchen counter, each with different prep visible — roasted vegetables, grains, protein portion — a small folded notebook with a pen leaning against the first container, late-afternoon planning vibe",
    surface: "pale grey concrete kitchen counter",
    lighting:
      "structured even daylight, subtle shadows, organised Sunday-prep feel",
    colorCast: "sky-blue tinged cool cream",
    angle: "30° angled three-quarter so containers show their layers, cookbook editorial",
  },
  "feierabend-klassiker": {
    scene:
      "a deep-walled cast-iron pan filled with golden braised vegetables resting on a folded honey-coloured kitchen towel, a wooden spoon laid across its rim, two rustic ceramic plates stacked nearby, a small bunch of fresh thyme",
    surface: "warm-toned dark walnut wood table",
    lighting:
      "golden-hour late-afternoon window light from the right, warm cosy shadows, magazine-cover atmosphere",
    colorCast: "honey-amber warm",
    angle: "30-40° three-quarter view, magazine cover composition",
  },
};

// Letzter Notnagel wenn weder PACK_COVER_STYLES noch styleFromTitle noch
// Gemini-Inferenz greifen. Generisch aber tonally neutral.
const FALLBACK_STYLE: PackCoverStyle = {
  scene:
    "a beautifully arranged dish on a kitchen counter with a wooden serving spoon, one folded linen napkin, two or three loose ingredients scattered nearby for context",
  surface: "pale weathered wood",
  lighting: "soft window light, gentle shadows, warm intimate atmosphere",
  colorCast: "warm neutral cream",
  angle: "30-40° three-quarter cookbook composition",
};

// Title-Keyword-Heuristik für Custom-Packs ohne expliziten PACK_COVER_STYLES-
// Eintrag. Matched die häufigsten Pack-Themen aus dem Titel — User-Packs mit
// klarem Thema (Airfryer, Snacks, Meal-Prep, Backen, Salat) bekommen sofort
// einen passenden Look, ohne Gemini-Call.
function styleFromTitle(title: string): PackCoverStyle | null {
  const t = title.toLowerCase();
  if (
    t.includes("airfryer") ||
    t.includes("heißluft") ||
    t.includes("heisluft") ||
    t.includes("fritteuse")
  ) {
    return {
      scene:
        "an open airfryer basket revealing golden crispy potato wedges, a small ceramic bowl of dipping sauce beside it, a folded linen kitchen towel, a sprig of fresh rosemary",
      surface: "pale grey concrete kitchen counter",
      lighting:
        "bright natural daylight from a side window, clean fresh shadows",
      colorCast: "warm amber-cream",
      angle: "30-40° three-quarter cookbook composition",
    };
  }
  if (t.includes("snack") || t.includes("naschen") || t.includes("bites")) {
    return {
      scene:
        "three small ceramic bowls arranged in a relaxed row, each with a different bite-sized snack, tiny silver spoons, a long folded white napkin flat across the front",
      surface: "smooth concrete-look matte ceramic surface",
      lighting:
        "soft indirect daylight, very even, gentle shadows",
      colorCast: "mint-tinged near-white",
      angle: "30° three-quarter with negative space bottom-left",
    };
  }
  if (t.includes("meal") || t.includes("prep") || t.includes("vorkoch")) {
    return {
      scene:
        "three matching glass meal-prep containers neatly arranged, each with different prep visible, a small folded notebook with a pen leaning against them",
      surface: "pale grey concrete kitchen counter",
      lighting:
        "structured even daylight, organised Sunday-prep feel",
      colorCast: "sky-blue tinged cool cream",
      angle: "30° three-quarter showing container layers",
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
        "two hands gently dusting flour over a freshly-baked cake on a wire rack, a small enamel measuring cup nearby, three vanilla pods, a soft cloud of flour in the light",
      surface: "weathered pale-wood baker's table",
      lighting:
        "soft late-morning window light, dust motes, warm shadows",
      colorCast: "warm cream",
      angle: "45° three-quarter cookbook composition",
    };
  }
  if (t.includes("salat") || t.includes("bowl") || t.includes("veggie")) {
    return {
      scene:
        "a deep ceramic bowl filled with vibrant greens and roasted vegetables, a wooden serving spoon mid-action, half a cucumber and two limes scattered nearby, folded linen towel",
      surface: "natural unbleached linen runner over pale stone counter",
      lighting:
        "bright clean noon kitchen light, fresh and energetic",
      colorCast: "sage-green tinged daylight white",
      angle: "30° angled overhead cookbook composition",
    };
  }
  if (t.includes("frühstück") || t.includes("breakfast") || t.includes("morgen")) {
    return {
      scene:
        "a breakfast spread on a wooden table — a bowl of porridge with berries, a small jug of milk, a folded linen napkin, two hands gently placing a coffee mug at the edge of the frame",
      surface: "warm-toned oak wood breakfast table",
      lighting:
        "soft golden morning window light from the side, warm intimate shadows",
      colorCast: "warm honey-amber morning",
      angle: "30-45° three-quarter cookbook composition",
    };
  }
  return null;
}

// Gemini-Inferenz für Custom-Packs ohne expliziten PACK_COVER_STYLES- oder
// Title-Match. 1 zusätzlicher Gemini-Call beim Pack-Enrich, läuft im
// after()-Hook, kein UX-Impact. Brand-agnostisch by design.
const STYLE_INFERENCE_SCHEMA = {
  type: "object",
  properties: {
    scene: {
      type: "string",
      description:
        "1-2 Saetze beschreibung der Lifestyle-Kitchen-Scene. Englisch. NICHT Still-Life — die Szene zeigt das Pack-Thema in Action (hands working, table set, kitchen scene, dish being plated). KEINE Personen-Gesichter. Konkrete Items. Max 240 chars.",
    },
    surface: {
      type: "string",
      description:
        "Englischer Surface-Hint, max 80 chars. Beispiele: 'weathered pale-wood table', 'pale grey concrete kitchen counter', 'warm-toned walnut wood', 'natural unbleached linen over stone'.",
    },
    lighting: {
      type: "string",
      description:
        "Englischer Lighting-Hint, max 140 chars. Beispiele: 'soft morning window light from the left', 'bright clean noon kitchen light, fresh and energetic', 'golden-hour late-afternoon, warm cosy shadows'.",
    },
    colorCast: {
      type: "string",
      description:
        "Englischer Color-Cast-Hint, max 60 chars. Beispiele: 'warm cream', 'sage-green tinged daylight white', 'honey-amber warm', 'sky-blue tinged cool cream'.",
    },
    angle: {
      type: "string",
      description:
        "Englischer Camera-Angle-Hint, max 80 chars. COVER bevorzugt 30-45° three-quarter (cookbook-feel), nicht flat-overhead. Beispiele: '30° three-quarter cookbook composition', '45° three-quarter with editorial tilt'.",
    },
  },
  required: ["scene", "surface", "lighting", "colorCast", "angle"],
};

async function inferStyleViaGemini(pack: Pack): Promise<PackCoverStyle | null> {
  try {
    const result = await callGemini<PackCoverStyle>({
      prompt: `Generate a lifestyle/kitchen scene description for a recipe-pack COVER image. The cover is the first thing the reader sees, it should evoke the THEME of the pack in motion, NOT a static plated dish.

Pack-Title: ${pack.title}
Pack-Subtitle: ${pack.subtitle ?? "—"}
Pack-Tagline: ${pack.tagline ?? "—"}
Pack-Category: ${pack.category ?? "—"}
Pack-Description: ${pack.description ?? "—"}

Pick scene items that THEMATICALLY anchor the pack and feel lived-in (e.g. for "Sommer-BBQ" → tongs lifting grilled vegetables off a grate, fresh herbs scattered; for "Date-Night" → two wine glasses, candle, a hand setting down a plate; for "Schnell + Einfach" → a timer mid-action beside a quick stovetop scene).

REGELN:
- 30-45° three-quarter cookbook-cover composition (NOT flat overhead).
- Lifestyle/Kitchen-Scene, NICHT Still-Life.
- NO faces visible (hands welcome, no faces).
- Negative space on bottom-left or bottom-third for the title overlay.
- Real food, intimate inviting feel.`,
      schema: STYLE_INFERENCE_SCHEMA,
      systemInstruction:
        "You generate cinematic lifestyle scene descriptions for cookbook cover images. Always answer in English (Flux understands English best). Concrete, sensory, NO faces, hands welcome.",
      temperature: 0.6,
      maxOutputTokens: 1024,
      thinkingBudget: 0,
      retries: 1,
      model: "flash",
    });
    if (!result.scene?.trim() || !result.surface?.trim()) return null;
    return {
      scene: result.scene.trim().slice(0, 280),
      surface: result.surface.trim().slice(0, 100),
      lighting:
        result.lighting?.trim().slice(0, 160) ||
        "soft window light, gentle warm shadows",
      colorCast: result.colorCast?.trim().slice(0, 80) || "warm neutral cream",
      angle:
        result.angle?.trim().slice(0, 100) ||
        "30-40° three-quarter cookbook composition",
    };
  } catch (err) {
    console.warn(
      "[generate-pack-cover] inferStyleViaGemini failed:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

// Universal Negative-Prompt. Text-Output ist hier hartcodiert OUT,
// Title-Overlay rendert react-pdf in Brand-Fonts. Faces sind out
// (rechtlich+ethisch, plus Flux ist eh schwach auf Anatomie).
const COVER_NEGATIVE =
  "no text, no words, no letters, no captions, no titles, no written language, no signage, no watermark, no logo, no brand names, no packaging labels, no recipe-card overlay, no instagram captions, no faces, no people-faces, no humans-with-faces, no fingers in extreme close-up, no body parts visible in extreme close-up, no plastic-looking food, no unnatural gloss, no oversaturated colours, no harsh studio lighting, no fluorescent lighting, no white-void background, no cluttered overflowing scene, no AI artifacts, no CGI, no illustration, no painting, no drawing, no cartoon";

export type PackCoverBuildResult = {
  prompt: string;
  negative: string;
};

function composePrompt(style: PackCoverStyle): string {
  return [
    `A cinematic lifestyle cookbook cover photograph.`,
    `${style.scene}, sitting on ${style.surface}, photographed ${style.angle}.`,
    `${style.lighting}.`,
    `Color grading: ${style.colorCast} tones, natural and gentle, never neon.`,
    `Shot on a 50 mm lens at f/2.8, slight natural film grain, magazine-quality composition.`,
    `Generous breathable negative space in the lower-left portion of the frame for a title overlay.`,
    `The mood is intimate, inviting, lived-in, like the opening shot of a beloved cookbook chapter.`,
  ].join(" ");
}

// Resolution-Reihenfolge (Pack-Variante):
//   1. PACK_COVER_STYLES — hand-getunte Bienen-Packs
//   2. styleFromTitle    — Keyword-Heuristik (Airfryer, Snack, Backen, etc.)
//   3. Gemini-Inferenz   — Custom-Packs mit eigenem Thema
//   4. FALLBACK_STYLE    — letzter Notnagel
export async function buildPackCoverPrompt(
  pack: Pack
): Promise<PackCoverBuildResult> {
  const style =
    PACK_COVER_STYLES[pack.slug] ??
    styleFromTitle(pack.title) ??
    (await inferStyleViaGemini(pack)) ??
    FALLBACK_STYLE;
  return { prompt: composePrompt(style), negative: COVER_NEGATIVE };
}

// Akzeptiert entweder einen vollen DB-Pack ODER nur die minimalen Felder
// (title, tagline, bgHex). Letzteres nutzt der Suggestion-Cover-Generator:
// dort gibt es noch keinen Pack in der DB, nur das Vorschlags-Konzept, plus
// wir wollen pro Suggestion KEINEN Gemini-Style-Call brennen (würde 10-20×
// pro Onboarding feuern, teuer + langsam). Suggestion-Pfad bleibt auf
// Title-Heuristik + Fallback beschränkt.
type PackCoverInput =
  | { pack: Pack }
  | { title: string; tagline?: string; bgHex?: string };

export async function generatePackCover(input: PackCoverInput): Promise<{
  buffer: Buffer;
  contentType: "image/jpeg";
}> {
  let prompt: string;
  let negative: string;

  if ("pack" in input) {
    const built = await buildPackCoverPrompt(input.pack);
    prompt = built.prompt;
    negative = built.negative;
  } else {
    // Suggestion-Pfad: kein DB-Pack, kein Gemini-Call. styleFromTitle
    // greift bei den meisten Pack-Konzepten; bei generischen Titeln nimmt
    // FALLBACK_STYLE übernimmt. bgHex wird aktuell nicht in den Prompt
    // gewoben — die Style-Heuristik trägt den Color-Cast schon, und der
    // Suggestion-Use-Case ist ein Vorschau-Cover, nicht Druck-final.
    const style = styleFromTitle(input.title) ?? FALLBACK_STYLE;
    prompt = composePrompt(style);
    negative = COVER_NEGATIVE;
  }

  const result = await generateImage({
    prompt,
    negativePrompt: negative,
    model: "flux-2-pro",
    // 3:4 Portrait, passt fast verlustfrei in A4 1:1.414 (minimaler
    // Top/Bottom-Crop bei objectFit cover). Vorher 1:1 quadratisch,
    // war für den 1:1-Container neben Text gebaut, wirkt full-bleed
    // zu flach.
    aspectRatio: "3:4",
    outputFormat: "jpeg",
    safetyTolerance: 2,
  });

  const buffer = await downloadImage(result.imageUrl);
  return { buffer, contentType: "image/jpeg" };
}
