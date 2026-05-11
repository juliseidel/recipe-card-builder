import type { Recipe } from "@/lib/recipes";
import type { RecipeImageSpec } from "./recipe-image-spec";
import { getBrandImageStyle } from "./brand-image-style";

// Three Flux prompt templates from Jan's brief, verbatim with our spec
// fields slotted in. We use the first one (HERO) for the cover image of
// every recipe — it's the most consistent across dish types because it
// always frames the dish in its serving vessel with the hero ingredient
// styled alongside.

export type PromptStyle = "hero" | "lifestyle" | "macro";

// Steam suffix appended for hot dishes — Jan's prompts mention this
// explicitly via "{steamSuffix}" placeholders.
function steamSuffix(spec: RecipeImageSpec): string {
  return spec.servingTemperature === "hot" ? ", with subtle steam rising" : "";
}

// Tone word reflects dishColorTone — keeps the colour grading hint coherent
// with the dish itself.
function toneWord(spec: RecipeImageSpec): string {
  switch (spec.dishColorTone) {
    case "warm":
      return "warm golden";
    case "cool":
      return "cool muted";
    case "colorful":
      return "vibrant warm";
    case "neutral":
    default:
      return "warm neutral";
  }
}

// Camera angle is dictated by dishShape — but each brand can override the
// defaults (Biene leans top-down even for mixed and layered dishes because
// that's the angle her smartphone reels actually use).
function angle(spec: RecipeImageSpec, brandSlug: string): string {
  const override = getBrandImageStyle(brandSlug).defaultAngles?.[spec.dishShape];
  if (override) return override;
  switch (spec.dishShape) {
    case "flat":
      return "top-down 90°";
    case "tall":
      return "45° eye-level";
    case "liquid":
      return "30° three-quarter";
    case "layered":
    case "mixed":
    default:
      return "30° three-quarter";
  }
}

// Utensil clause for the lifestyle prompt — single utensil, never a pair.
function utensilClause(spec: RecipeImageSpec): string {
  switch (spec.primaryUtensil) {
    case "spoon":
      return "with a single small spoon resting alongside";
    case "fork":
      return "with a single fork resting alongside";
    case "fork_and_knife":
      return "with a single fork and a single knife resting alongside";
    case "none":
    default:
      return "with no cutlery in frame";
  }
}

// Background clause for the lifestyle prompt — re-uses sceneContext but
// downgrades it to a "behind" hint so the plate stays the hero.
function backgroundClause(spec: RecipeImageSpec): string {
  return `${spec.sceneContext}, softly out of focus`;
}

// HERO — Stage 4 in Jan's brief, simplified for the no-reference-image path.
//
// Jan's original closes with a Leica-cookbook body ("Leica SL2 50mm at f/5.6,
// cookbook-style instagram food photograph, homemade imperfect character
// preserved from the reference image"). That language assumes Stage 3 has
// produced a real reel keyframe to anchor the dish's look — without one, it
// pulls Flux toward magazine-shoot composition rather than the creator's
// real reel scene. We strip the cookbook body and use the brand's own
// cameraAesthetic line instead, which for Biene is unstaged-natural with
// no "phone"/"reel" trigger words (those caused iter-8 to render a headline
// overlay even with negative prompts).
export function heroPrompt(
  recipe: Recipe,
  spec: RecipeImageSpec,
  brandSlug: string,
  /** Optional: Gemini-Vision-Beschreibung vom echten Reel-Bild
   *  (lib/ai/describe-instagram-dish.ts). Wenn vorhanden, wird sie
   *  prominent als zweiter Satz eingebaut — damit Flux weiss, wie das
   *  Gericht tatsaechlich aussehen soll (Form, Farbe, Garnish), nicht
   *  nur "irgendein Kaiserschmarren". Loest Ingo-Feedback "die Bilder
   *  matchen nicht das Reel". */
  dishDescription?: string | null
): string {
  const a = angle(spec, brandSlug);
  const style = getBrandImageStyle(brandSlug);
  const parts: string[] = [
    `A still-life food photograph of ${recipe.title}, served in a ${spec.servingVessel}, photographed ${a}, on ${spec.sceneContext}.`,
  ];
  // Wenn wir das echte Reel gesehen haben — Form/Farbe/Garnish direkt in
  // den Prompt, prominent vor dem rest. Flux 2 Pro respektiert spezifische
  // visuelle Beschreibungen wesentlich staerker als generische
  // textureFocus-Adjektive.
  if (dishDescription && dishDescription.trim()) {
    parts.push(
      `The dish itself looks like this — match these visual specifics exactly, especially the color tone: ${dishDescription.trim()}.`,
      // Anti-Duplikat: Flux 2 Pro neigt dazu, das Gericht zweimal ins
      // Bild zu stellen (Backform plus plattiert, ganzes Stueck plus
      // angeschnittenes Demo-Stueck), weil Reels diesen Pattern zeigen.
      // Wir muessen explizit: nur EINE Anrichtung, KEINE Demo-Slice.
      `Show the dish in a single staging — exactly one main composition, exactly one serving variant. No second portion alongside, no cross-section demo slice next to it, no whole-plus-cut comparison. The hero element (fruit bowl, garnish bowl) sits in the background as accent, not as a second plating of the dish.`
    );
  }
  parts.push(
    // textureFocus drives the dish's visible character (creamy/melty/crispy/
    // golden) — without it Flux renders a generically "correct" version of
    // the dish that misses the recipe's signature look. Iter 12 had this
    // gap: Käse-Nudeln came out as plain pasta because "creamy, melty" was
    // never injected into the prompt.
    `The finished dish has visible ${spec.textureFocus} character — true to the recipe.`,
    `${spec.heroElement}.`,
    `${spec.lightingMood}.`,
    `${style.cameraAesthetic}, ${toneWord(spec)} tones${steamSuffix(spec)}.`
  );
  if (style.styleSuffix) parts.push(`${style.styleSuffix}.`);
  return parts.join(" ");
}

// Negative covers Flux 2 Pro's typical failure modes for instagram-style
// food prompts. The brand `negativeAddition` adds creator-specific
// exclusions on top (for Biene: cast-iron pan, cream counter, title overlay).
const HERO_BASE_NEGATIVE =
  "no text, no labels, no logos, no packaging, no cartons, no bottles, no jars with labels, no bags, no brand names, no hands, no people, no faces, no rigid centering, no plastic-looking sauce, no unnatural gloss, no studio lighting, no white void background, no cool blue tones, no fluorescent lighting, no headline at the bottom of the image, no large letters anywhere, no typography, no watermark, no duplicate dishes, no multiple plating versions, no two servings of the same dish, no demonstration shot alongside finished shot, no before-and-after staging, no cross-section view alongside finished serving, no opened slice next to whole serving, no demo cut showing the interior, no second piece on a plate next to a baking tray, no half-portion as visual demo";

export function heroNegative(brandSlug: string): string {
  const add = getBrandImageStyle(brandSlug).negativeAddition;
  return add ? `${HERO_BASE_NEGATIVE}, ${add}` : HERO_BASE_NEGATIVE;
}

// LIFESTYLE — Stage 5. Plated portion on a ceramic plate with one utensil.
// Useful as a secondary "served" image; we don't use it in the cover slot
// because the vessel is generic (always a plate).
export function lifestylePrompt(
  recipe: Recipe,
  spec: RecipeImageSpec,
  brandSlug: string
): string {
  const a = angle(spec, brandSlug);
  const style = getBrandImageStyle(brandSlug);
  const parts = [
    `A generous plated portion of ${recipe.title}, on a warm-cream ceramic plate, ${utensilClause(spec)}, ${a} view, ${backgroundClause(spec)}.`,
    `${spec.lightingMood}.`,
    `${style.cameraAesthetic}, ${toneWord(spec)} tones, dish matching the recipe${steamSuffix(spec)}.`,
  ];
  if (style.styleSuffix) parts.push(`${style.styleSuffix}.`);
  return parts.join(" ");
}

const LIFESTYLE_BASE_NEGATIVE =
  "no text, no labels, no logos, no packaging, no hands, no people, no faces, no matched utensil pairs, no two forks, no two spoons, no two knives, no distorted cutlery, no plastic-looking sauce, no studio lighting, no white void background, no cool blue tones, no fluorescent lighting";

export function lifestyleNegative(brandSlug: string): string {
  const add = getBrandImageStyle(brandSlug).negativeAddition;
  return add ? `${LIFESTYLE_BASE_NEGATIVE}, ${add}` : LIFESTYLE_BASE_NEGATIVE;
}

// MACRO — Stage 6. Tight close-up. Useful for recipe-detail page accents.
export function macroPrompt(recipe: Recipe, spec: RecipeImageSpec): string {
  return [
    `Tight close-up filling the frame of ${recipe.title}, emphasizing ${spec.textureFocus} textures in detail, soft warm backlight with rim glow and gentle fill from the front, shot on Sony A7IV 90mm macro lens at f/2.8, shallow depth of field, natural food photograph, warm natural color grading, dish matching the recipe.`,
  ].join(" ");
}

const MACRO_BASE_NEGATIVE =
  "no text, no logos, no hands, no people, no packaging, no plastic-looking sauce, no unnatural gloss";

export function macroNegative(brandSlug: string): string {
  const add = getBrandImageStyle(brandSlug).negativeAddition;
  return add ? `${MACRO_BASE_NEGATIVE}, ${add}` : MACRO_BASE_NEGATIVE;
}

export function buildPrompt(
  style: PromptStyle,
  recipe: Recipe,
  spec: RecipeImageSpec,
  brandSlug: string,
  /** Optionale Gemini-Vision-Beschreibung vom Reel-Bild. Nur hero nutzt
   *  sie aktuell — lifestyle/macro sind General-Purpose-Slots und brauchen
   *  keine 1:1-Reel-Treue. */
  dishDescription?: string | null
): { prompt: string; negative: string } {
  switch (style) {
    case "lifestyle":
      return {
        prompt: lifestylePrompt(recipe, spec, brandSlug),
        negative: lifestyleNegative(brandSlug),
      };
    case "macro":
      return {
        prompt: macroPrompt(recipe, spec),
        negative: macroNegative(brandSlug),
      };
    case "hero":
    default:
      return {
        prompt: heroPrompt(recipe, spec, brandSlug, dishDescription),
        negative: heroNegative(brandSlug),
      };
  }
}
