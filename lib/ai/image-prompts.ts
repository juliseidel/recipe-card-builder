import type { Recipe } from "@/lib/recipes";
import type { RecipeImageSpec } from "./recipe-image-spec";
import { getBrandImageStyle } from "./brand-image-style";

// Three Flux prompt templates from Jan's brief, verbatim with our spec
// fields slotted in. We use the first one (HERO) for the cover image of
// every recipe — it's the most consistent across dish types because it
// always frames the dish in its serving vessel with the hero ingredient
// styled alongside.

export type PromptStyle = "hero" | "lifestyle";

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

// HERO — Jan's Prompt #4, mit Brand-Overrides fuer cameraAesthetic +
// heroElement-Wording.
//
// v9-Logik (Jan's Original):
// - WENN Reference-Image vorhanden (Keyframe oder Cover): NICHT das Gericht
//   beschreiben. Jan's Prompt #2 sagt explizit "do NOT describe what the
//   dish looks like". Die Reference uebernimmt die Dish-Beschreibung.
// - WENN keine Reference (text-only Fallback): Vision-Description vom Cover
//   einfuegen als Anker, sonst rendert Flux eine generische Version.
// - Brand-DNA (cameraAesthetic, heroElement, lightingOptions) sind keine
//   Hard-Constraints sondern Identitaets-Slots in Jan's Template — bleiben
//   drin, weil sie definieren WIE der Brand aussehen soll, nicht WAS.
export function heroPrompt(
  recipe: Recipe,
  spec: RecipeImageSpec,
  brandSlug: string,
  /** Vision-Description vom Reel-Cover (lib/ai/describe-instagram-dish.ts).
   *  NUR im text-only Fallback genutzt — bei Reference-Path ignoriert,
   *  weil die Reference das Gericht visuell uebernimmt. */
  dishDescription?: string | null,
  /** True wenn ein input_image an Flux geht. Bei true wird die Vision-
   *  Description NICHT in den Prompt eingebaut (Jan's Regel) und das
   *  "homemade imperfect ... matching the reference"-Wording aktiviert. */
  withReferenceImage: boolean = false
): string {
  const a = angle(spec, brandSlug);
  const style = getBrandImageStyle(brandSlug);
  const parts: string[] = [
    `${recipe.title}, shown in a ${spec.servingVessel}, ${a} view, placed on ${spec.sceneContext}.`,
    `${spec.heroElement}, styled deliberately as part of the scene.`,
    `${spec.lightingMood}.`,
  ];

  if (withReferenceImage) {
    // Jan's Original-Wording — keine zusaetzlichen Anti-Misinterpretation-
    // Klauseln. Vertrauen auf die Reference.
    parts.push(
      `${style.cameraAesthetic}, ${toneWord(spec)} tones, homemade imperfect character preserved from the reference image, dish shape and color and garnish placement matching the reference, environment and lighting re-staged for warmth${steamSuffix(spec)}.`
    );
  } else if (dishDescription && dishDescription.trim()) {
    // Text-Only-Pfad mit Cover-Beschreibung als Anker
    parts.push(`The dish itself: ${dishDescription.trim()}.`);
    parts.push(
      `${style.cameraAesthetic}, ${toneWord(spec)} tones${steamSuffix(spec)}.`
    );
  } else {
    // Text-Only-Pfad ohne irgendeinen visuellen Anker — Backup ueber
    // textureFocus aus der Spec, sonst rendert Flux eine generische Version
    parts.push(
      `The finished dish has visible ${spec.textureFocus} character.`,
      `${style.cameraAesthetic}, ${toneWord(spec)} tones${steamSuffix(spec)}.`
    );
  }

  if (style.styleSuffix) parts.push(`${style.styleSuffix}.`);
  return parts.join(" ");
}

// Negative — Jan's Original-Set mit "Anti-Studio-Look"-Items (no rigid
// centering, no plastic-looking sauce, no unnatural gloss, no white void
// background, no cool blue tones, no fluorescent lighting). Die Brand-
// negativeAddition kommt obendrauf (fuer Biene: kein Petersilien-Garnish,
// keine Gusspfanne).
//
// Memory-Lesson v8: 25+ Items machten Flux ueberregelmaessig. Jan's Set
// hat ~17 Items — das ist der Sweet-Spot zwischen Studio-Schutz und nicht-
// uebersteuert.
const HERO_BASE_NEGATIVE =
  "no text, no labels, no logos, no packaging, no cartons, no bottles, no jars with labels, no bags, no brand names, no watermark, no hands, no people, no faces, no rigid centering, no plastic-looking sauce, no unnatural gloss, no studio lighting, no white void background, no cool blue tones, no fluorescent lighting";

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

export function buildPrompt(
  style: PromptStyle,
  recipe: Recipe,
  spec: RecipeImageSpec,
  brandSlug: string,
  /** Optionale Gemini-Vision-Beschreibung vom Reel-Bild. Nur hero (im
   *  text-only Fallback) nutzt sie. */
  dishDescription?: string | null,
  /** Wenn true: heroPrompt aktiviert Jan's "preserve reference"-Wording
   *  und ignoriert dishDescription (Jan's Regel: do NOT describe the dish
   *  when a reference image is provided). */
  withReferenceImage: boolean = false
): { prompt: string; negative: string } {
  switch (style) {
    case "lifestyle":
      return {
        prompt: lifestylePrompt(recipe, spec, brandSlug),
        negative: lifestyleNegative(brandSlug),
      };
    case "hero":
    default:
      return {
        prompt: heroPrompt(
          recipe,
          spec,
          brandSlug,
          dishDescription,
          withReferenceImage
        ),
        negative: heroNegative(brandSlug),
      };
  }
}
