import type { Pack } from "@/lib/packs";
import { generateImage, downloadImage } from "./bfl-flux";
import { callGemini } from "./gemini";

// Foreword still-life image generator. Sits OUTSIDE the recipe-hero and
// pack-cover pipelines on purpose — those are tuned for plated dishes
// (recipe heroes) and tilted-overhead pack covers, both of which the
// pack-cover and per-recipe assets already use.
//
// The foreword image is a different beast: a tonally-quiet still life
// that complements the editorial vorwort (the user's own face is
// represented by avatar.jpg next to it). No human face, no plated dish
// — just an atmospheric ingredient/utensil arrangement that says "this
// pack is about THIS world".
//
// We never run this against a creator's face. Generating a synthetic
// likeness of a real person without their consent is off-limits — both
// ethically and legally — so even the prompt rules out humans.

export type ForewordImageStyle = {
  /** What the still-life arrangement actually shows. Pack-specific. */
  subject: string;
  /** Surface the arrangement sits on (wood / linen / ceramic / stone). */
  surface: string;
  /** Lighting mood that matches the pack's emotional register. */
  lighting: string;
  /** Hex-tinted color cast hint, derived from pack mood — keeps the
   *  rendered image visually anchored to the pack-cover palette. */
  colorCast: string;
  /** Camera angle. Backwelt-style packs lean overhead, sport packs
   *  lean 30-45° to show vertical layering. */
  angle: string;
};

// Pack-specific still-life recipes. Hand-tuned per pack — not derived
// from a template — because the visual register has to match the pack
// the same way the layout does. A generic "ingredients on wood" prompt
// would produce competent but interchangeable images; these recipes
// give each pack its own visual fingerprint.
const PACK_STYLES: Record<string, ForewordImageStyle> = {
  "bienes-backwelt": {
    subject:
      "a vintage matte-cream cake tin tilted slightly on its side, a soft drift of flour on the surface beside it, three whole vanilla pods scattered, one small worn enamel measuring cup with a few cocoa flakes inside",
    surface: "weathered pale-wood baker's table",
    lighting:
      "soft late-morning window light from the upper left, gentle shadows, no harsh contrast",
    colorCast: "lavender-tinged warm cream",
    angle: "overhead 75° angle, slight tilt for editorial energy",
  },
  "volumen-wunder": {
    subject:
      "a generous cluster of fresh greens — kale, parsley, half a cucumber, two whole limes — arranged loose around a deep ceramic bowl with a wooden serving spoon resting against its rim",
    surface: "natural unbleached linen runner over a pale stone counter",
    lighting:
      "bright, high noon kitchen light, clean shadows, fresh feel",
    colorCast: "sage-green tinged daylight white",
    angle: "overhead 90° flat-lay",
  },
  "blitz-snacks": {
    subject:
      "a single small ceramic ramekin holding three perfect berries, one tiny silver spoon at rest beside it, a long simple white napkin folded flat",
    surface: "smooth concrete-look matte ceramic surface",
    lighting:
      "soft indirect daylight, very even, almost no shadow — apple-store-clean feel",
    colorCast: "mint-tinged near-white",
    angle: "overhead 90°, lots of negative space around the subject",
  },
  "meal-prep-heroes": {
    subject:
      "three matching glass meal-prep containers in a neat row, each with a different prep visible — grains, roasted vegetables, a portion of protein — a small folded notebook with a pen sits at the edge of the frame",
    surface: "pale grey concrete kitchen counter",
    lighting:
      "structured, even fluorescent-like daylight, subtle shadow, organised feel",
    colorCast: "sky-blue tinged cool cream",
    angle: "30° angled overhead so containers show their layers",
  },
  "feierabend-klassiker": {
    subject:
      "a deep-walled cast-iron pan resting on a folded honey-coloured kitchen towel, a wooden spoon laid across its rim, two rustic ceramic plates stacked beside it, a small bunch of fresh thyme",
    surface: "warm-toned dark walnut wood",
    lighting:
      "golden-hour late-afternoon window light from the right, warm shadows, cosy magazine-cover feel",
    colorCast: "honey-amber warm",
    angle: "30-40° three-quarter view, magazine cover composition",
  },
};

// Built-in fallback for custom packs ohne erkennbares Theme. Generic
// aber tonally neutral — der letzte Ausweg wenn weder PACK_STYLES noch
// styleFromTitle noch Gemini-Inference einen Treffer haben.
const FALLBACK_STYLE: ForewordImageStyle = {
  subject:
    "a small wooden chopping board with two or three loose ingredients arranged around it, one ceramic bowl, one folded linen kitchen towel",
  surface: "pale weathered wood",
  lighting: "soft window light, gentle shadows",
  colorCast: "warm neutral cream",
  angle: "overhead 80° angle",
};

// Gemini-Inference fuer Custom-Packs: wenn weder PACK_STYLES noch
// styleFromTitle greifen (z.B. fuer einen Pack mit Titel "Sommer-Spass"),
// laesst Gemini einen passenden Still-Life-Style aus dem Pack-Kontext
// ableiten. Das ist 1 extra Gemini-Call beim Pack-Enrich — laeuft async
// im Hintergrund, ist also kein UX-Issue.
//
// Brand-agnostisch by design: jeder neue Creator bekommt fuer JEDEN
// seiner Custom-Packs einen gut passenden Foreword-Style ohne dass jemand
// PACK_STYLES manuell pflegen muss.
const STYLE_INFERENCE_SCHEMA = {
  type: "object",
  properties: {
    subject: {
      type: "string",
      description:
        "1-2 Saetze beschreibung der Still-Life-Arrangement. Englisch. KEINE Personen, kein angerichtetes Gericht. Konkrete Items: z.B. 'a small ceramic bowl of fresh strawberries beside three vanilla pods on a folded linen napkin'. Max 200 chars.",
    },
    surface: {
      type: "string",
      description:
        "Englischer Surface-Hint, max 60 chars. Beispiele: 'weathered pale-wood baker's table', 'natural unbleached linen', 'pale grey concrete counter', 'warm-toned dark walnut wood'.",
    },
    lighting: {
      type: "string",
      description:
        "Englischer Lighting-Hint, max 120 chars. Beispiele: 'soft morning window light from the left, gentle shadows', 'bright high-noon kitchen light, clean shadows'.",
    },
    colorCast: {
      type: "string",
      description:
        "Englischer Color-Cast-Hint, max 40 chars. Beispiele: 'warm cream', 'sage-green tinged daylight white', 'honey-amber warm'.",
    },
    angle: {
      type: "string",
      description:
        "Englischer Camera-Angle-Hint, max 60 chars. Beispiele: 'overhead 90° flat-lay', '30-40° three-quarter view', 'overhead 75° angle with editorial tilt'.",
    },
  },
  required: ["subject", "surface", "lighting", "colorCast", "angle"],
};

async function inferStyleViaGemini(pack: Pack): Promise<ForewordImageStyle | null> {
  try {
    const result = await callGemini<ForewordImageStyle>({
      prompt: `Generate a still-life Foreword-Image-Style for this recipe pack. The image is the opening page of a printed cookbook chapter — it should evoke the THEME of the pack visually, NOT show a finished dish.

Pack-Title: ${pack.title}
Pack-Subtitle: ${pack.subtitle ?? "—"}
Pack-Tagline: ${pack.tagline ?? "—"}
Pack-Category: ${pack.category ?? "—"}
Pack-Description: ${pack.description ?? "—"}

Pick subject items that THEMATICALLY anchor the pack (e.g. for "Sommer-BBQ" → tongs + fresh herbs; for "Date-Night" → two wine glasses + linen napkin; for "Schnell + Einfach" → timer + simple knife + cutting board). Avoid plated meals, hands, faces.`,
      schema: STYLE_INFERENCE_SCHEMA,
      systemInstruction:
        "You generate visual still-life style descriptions for editorial cookbook foreword images. Always answer in English (Flux understands English best). Be concrete and sensory. Never include people, faces, hands, or plated food.",
      temperature: 0.6,
      maxOutputTokens: 1024,
      thinkingBudget: 0,
      retries: 1,
      model: "flash",
    });
    // Sanity-Check: alle Felder müssen non-empty sein
    if (!result.subject?.trim() || !result.surface?.trim()) return null;
    return {
      subject: result.subject.trim().slice(0, 240),
      surface: result.surface.trim().slice(0, 80),
      lighting: result.lighting?.trim().slice(0, 140) || "soft window light, gentle shadows",
      colorCast: result.colorCast?.trim().slice(0, 60) || "warm neutral cream",
      angle: result.angle?.trim().slice(0, 80) || "overhead 80° angle",
    };
  } catch (err) {
    console.warn(
      "[generate-foreword-image] inferStyleViaGemini failed:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

// Title-keyword heuristic fallback — fuer Custom-Packs ohne expliziten
// PACK_STYLES-Eintrag. Matched gaengige Pack-Themen aus dem Titel, damit
// der User nicht das generische "chopping board"-Bild bekommt wenn sein
// Pack klar ein Thema hat (Airfryer, Snacks, Meal-Prep, Backen).
function styleFromTitle(title: string): ForewordImageStyle | null {
  const t = title.toLowerCase();
  if (
    t.includes("airfryer") ||
    t.includes("heißluft") ||
    t.includes("heisluft") ||
    t.includes("fritteuse")
  ) {
    return {
      subject:
        "a sleek black airfryer with its basket pulled out slightly to reveal golden crispy potato wedges inside, a few extra wedges scattered on the surface beside it, one small bowl of ketchup, one folded linen kitchen towel",
      surface: "pale grey concrete kitchen counter",
      lighting:
        "bright natural daylight from a side window, clean shadows, fresh kitchen feel",
      colorCast: "warm amber-cream",
      angle: "overhead 75° angle, slight editorial tilt",
    };
  }
  if (t.includes("snack") || t.includes("naschen") || t.includes("bites")) {
    return {
      subject:
        "a single small ceramic ramekin holding three perfect berries, one tiny silver spoon at rest beside it, a long simple white napkin folded flat",
      surface: "smooth concrete-look matte ceramic surface",
      lighting:
        "soft indirect daylight, very even, almost no shadow",
      colorCast: "mint-tinged near-white",
      angle: "overhead 90°, lots of negative space around the subject",
    };
  }
  if (t.includes("meal") || t.includes("prep") || t.includes("vorkoch")) {
    return {
      subject:
        "three matching glass meal-prep containers in a neat row, each with a different prep visible — grains, roasted vegetables, a portion of protein — a small folded notebook with a pen sits at the edge of the frame",
      surface: "pale grey concrete kitchen counter",
      lighting:
        "structured, even daylight, subtle shadow, organised feel",
      colorCast: "sky-blue tinged cool cream",
      angle: "30° angled overhead so containers show their layers",
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
      subject:
        "a vintage matte-cream cake tin tilted slightly on its side, a soft drift of flour on the surface beside it, three whole vanilla pods scattered, one small worn enamel measuring cup",
      surface: "weathered pale-wood baker's table",
      lighting:
        "soft late-morning window light, gentle shadows, no harsh contrast",
      colorCast: "warm cream",
      angle: "overhead 75° angle, slight tilt for editorial energy",
    };
  }
  if (t.includes("salat") || t.includes("bowl") || t.includes("veggie")) {
    return {
      subject:
        "a generous cluster of fresh greens, half a cucumber, two whole limes, arranged loose around a deep ceramic bowl with a wooden serving spoon resting against its rim",
      surface: "natural unbleached linen runner over a pale stone counter",
      lighting:
        "bright, high noon kitchen light, clean shadows, fresh feel",
      colorCast: "sage-green tinged daylight white",
      angle: "overhead 90° flat-lay",
    };
  }
  return null;
}

// Universal negative prompt — these are the failure modes that turn
// foreword still-lifes into something else entirely. We list them
// explicitly because Flux otherwise drifts toward plated portions or
// social-media-style food photography under load.
const FOREWORD_NEGATIVE =
  "no people, no faces, no hands, no humans, no fingers, no body parts, no plated dish, no fully cooked meal, no cake on a plate, no portion ready to eat, no text, no labels, no brand names, no logos, no packaging, no cartons, no signs, no recipe cards, no instagram-style captions, no studio lighting, no fluorescent lighting, no white void background, no cluttered overflowing scene, no plastic-looking food, no unnatural gloss, no oversaturated colours, no harsh shadows";

export type ForewordImageBuildResult = {
  prompt: string;
  negative: string;
};

// Builds the final Flux prompt from a pack's style recipe. Exposed so the
// generation script can log/audit prompts before spending API credit.
//
// Style-Resolution-Reihenfolge:
//   1. PACK_STYLES — hand-getunte Bienen-Packs (statisch)
//   2. styleFromTitle — Keyword-Heuristik (Airfryer, Snack, Backwelt, etc.)
//   3. Gemini-Inference — fuer Custom-Packs mit eigenem Thema
//   4. FALLBACK_STYLE — letzter Notnagel
//
// Async geworden seit v2: Schritt 3 macht einen Gemini-Call. Caller sind
// schon async (generateForewordImage, das Script).
export async function buildForewordImagePrompt(pack: Pack): Promise<ForewordImageBuildResult> {
  const style =
    PACK_STYLES[pack.slug] ??
    styleFromTitle(pack.title) ??
    (await inferStyleViaGemini(pack)) ??
    FALLBACK_STYLE;
  const prompt = [
    `An editorial still-life photograph for the opening page of a recipe booklet.`,
    `${style.subject}, sitting on ${style.surface}, photographed ${style.angle}.`,
    `${style.lighting}.`,
    `Color grading: ${style.colorCast} tones, natural and gentle, never neon.`,
    `Shot on a 50 mm lens at f/2.8, slight natural film grain, magazine-quality composition with breathable negative space.`,
    `The mood is intimate and inviting — like turning the first page of a beloved cookbook.`,
  ].join(" ");
  return { prompt, negative: FOREWORD_NEGATIVE };
}

// Generates the foreword still-life for a pack and returns the JPEG
// buffer. The caller decides where to write it (public/brands/<brand>/
// forewords/<packSlug>.jpg for static packs; Supabase Storage for
// custom packs). Throws on Flux failure — caller decides whether to
// retry or skip the foreword for this pack.
export async function generateForewordImage(
  pack: Pack,
  opts: { seed?: number } = {}
): Promise<Buffer> {
  const { prompt, negative } = await buildForewordImagePrompt(pack);
  const result = await generateImage({
    prompt,
    negativePrompt: negative,
    // flux-2-pro is the same model the recipe-hero pipeline uses —
    // shared model, separate prompt template, no entanglement.
    model: "flux-2-pro",
    aspectRatio: "1:1",
    width: 1024,
    height: 1024,
    outputFormat: "jpeg",
    safetyTolerance: 2,
    seed: opts.seed,
  });
  return await downloadImage(result.imageUrl);
}
