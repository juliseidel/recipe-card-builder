import type { Recipe } from "@/lib/recipes";
import { callGemini } from "./gemini";
import { getBrandImageStyle } from "./brand-image-style";

// "Image Spec" — the 9 cinematography fields that drive Flux prompting.
// Mirrors Stage 2 of Jan's pipeline, but adapted: Jan's prompt parses an
// Instagram reel caption; ours feeds in a structured recipe (title, sub,
// description, ingredients, steps) because that's what the editor produces
// and what our static catalogue already has.
export type RecipeImageSpec = {
  servingTemperature: "hot" | "warm" | "cold" | "frozen";
  heroElement: string;
  servingVessel: string;
  dishShape: "flat" | "layered" | "tall" | "liquid" | "mixed";
  textureFocus: string;
  dishColorTone: "warm" | "cool" | "neutral" | "colorful";
  primaryUtensil: "spoon" | "fork" | "fork_and_knife" | "none";
  lightingMood: string;
  sceneContext: string;
};

// Build the JSON schema dynamically — lightingMood + sceneContext use
// brand-specific enum values so each creator's signature look gets baked into
// the spec instead of forcing every dish into Jan's generic "farmhouse" world.
function buildSchema(brandSlug: string) {
  const style = getBrandImageStyle(brandSlug);
  const lightingList = style.lightingOptions
    .map((s) => `'${s}'`)
    .join(", ");
  const sceneList = style.sceneOptions.map((s) => `'${s}'`).join(", ");
  // Brand-overridable heroElement description. Without this override, Gemini
  // pulls Jan's default pattern ("alongside / to one side") and ignores
  // brand-specific framing — observed in iter 11, where Biene's signature
  // wooden-cutting-board scene was lost because the schema description
  // out-ranked the system instruction.
  const heroElementDescription = style.heroElementGuidance
    ? style.heroElementGuidance
    : "Short phrase using one of these patterns: 'a bunch of [herb] laid alongside', '[fruit] halved, placed to one side', 'a handful of [nuts/berries] resting on a linen cloth nearby', 'a small warm-toned ceramic bowl of [oats/granola/spice] to one side', 'a small glass of [milk/yogurt] in the soft background'. Whole, natural forms only — never packaging.";
  return {
    type: "object",
    properties: {
      servingTemperature: {
        type: "string",
        enum: ["hot", "warm", "cold", "frozen"],
      },
      heroElement: {
        type: "string",
        description: heroElementDescription,
      },
      servingVessel: {
        type: "string",
        description:
          "The vessel this dish is typically served in: 'baking dish', 'bowl', 'plate', 'glass', 'skillet', 'sheet pan', 'ramekin', 'cutting board', 'muffin tin', 'ceramic tart dish', 'loaf pan', etc.",
      },
      dishShape: {
        type: "string",
        enum: ["flat", "layered", "tall", "liquid", "mixed"],
      },
      textureFocus: {
        type: "string",
        description:
          "Two to three adjectives describing the most prominent textures, comma-separated. E.g. 'crispy, golden, glossy'.",
      },
      dishColorTone: {
        type: "string",
        enum: ["warm", "cool", "neutral", "colorful"],
      },
      primaryUtensil: {
        type: "string",
        enum: ["spoon", "fork", "fork_and_knife", "none"],
      },
      lightingMood: {
        type: "string",
        enum: style.lightingOptions,
        description: `EXACTLY one of: ${lightingList}.`,
      },
      sceneContext: {
        type: "string",
        enum: style.sceneOptions,
        description: `EXACTLY one of: ${sceneList}.`,
      },
    },
    required: [
      "servingTemperature",
      "heroElement",
      "servingVessel",
      "dishShape",
      "textureFocus",
      "dishColorTone",
      "primaryUtensil",
      "lightingMood",
      "sceneContext",
    ],
  };
}

// Jan's rules for the 9 fields. heroElement guidance is brand-overridable —
// some creators (Biene) finish their dishes with garnish on top of the food
// itself, not styled alongside it.
function buildSystemInstruction(brandSlug: string): string {
  const style = getBrandImageStyle(brandSlug);
  const heroRule = style.heroElementGuidance
    ? `- heroElement: ${style.heroElementGuidance}`
    : `- heroElement: a single visually distinctive ingredient from this recipe, presented as a styling element alongside the finished dish. Choose the ingredient that is most recognizable and visually interesting — a colorful vegetable, a fresh herb bundle, a halved fruit, whole nuts, a bunch of greens, or for recipes whose main components are powders/grains/liquids, a small ceramic bowl or small glass of the ingredient. Never render packaging. Never pick items that only exist in packaging (milk carton, yogurt tub, flour bag) unless presented in a bowl or glass. Prefer whole, natural forms over prepared ones. The item must be visible or clearly implied in the finished dish.`;

  return `You analyse a German recipe and return cinematography fields for a single hero food photograph. The values are consumed by a downstream Flux 2 Pro image prompt — they must read as natural English phrases, never as labels or notes.

IMPORTANT: A reference image of the actual finished dish is provided separately to the image generator. Your fields control the SERVING CONTEXT and SCENE SETUP only — do NOT try to describe what the dish itself looks like (shape, color, texture, garnish on the dish). The reference image handles that. Focus on: vessel, scene, lighting, hero element styled alongside, camera utensil.

Rules:
${heroRule}

- servingVessel: based on the preparation instructions, what is the dish actually plated/served in? A "baking dish" if it stays in the oven dish, a "plate" if dished out, a "skillet" if served straight from the pan, a "glass" for liquids, etc.

- dishShape:
    flat = pizza, tarte, pancake, cookie, flatbread
    layered = lasagna, layer cake, Schichtsalat, sandwich
    tall = burger, muffin, soufflé, stacked
    liquid = soup, smoothie, sauce, drink
    mixed = bowl, salad, stir-fry, curry with rice

- textureFocus: 2-3 adjectives the macro lens would emphasise on the finished dish. crispy, creamy, glossy, flaky, fluffy, caramelized, chunky, smooth, crumbly, melty, golden, crunchy, gooey, silky, rustic. Pick the ones that ACTUALLY apply.

- dishColorTone:
    warm = golden, brown, orange, red-dominant
    cool = green, blue-tinted, white-dominant
    neutral = beige, muted, mixed without strong color
    colorful = vibrant multi-coloured (poke bowls, salads with many colors)

- primaryUtensil:
    spoon = soft/creamy/liquid eaten from a bowl or glass
    fork = plated solid foods (pasta, salad, rice dishes, pancakes, cake slices, baked goods)
    fork_and_knife = dishes that need cutting at the table (whole roasts, steak, fish fillets, whole quiches, whole pies)
    none = drinks in a glass, smoothies in a glass (not bowls), handheld foods
  Default to "fork" only when none of the other three clearly fit.

- lightingMood: pick the SINGLE most fitting option (verbatim) from the five enum strings. Breakfast dishes lean morning/diffused; heartier dishes lean golden/amber; use the backlit option when the dish has steam or surface shine worth emphasising.

- sceneContext: pick the SINGLE most fitting option (verbatim) from the five enum strings.

Always answer in valid JSON matching the schema. Never explain.`;
}

function formatRecipeForPrompt(recipe: Recipe): string {
  const ingredients = recipe.ingredients
    .map((i) => `  • ${i.amount} ${i.name}${i.note ? ` (${i.note})` : ""}`)
    .join("\n");
  const steps = recipe.steps.map((s, i) => `  ${i + 1}. ${s}`).join("\n");

  return [
    `Title: ${recipe.title}`,
    `Subtitle: ${recipe.subtitle}`,
    `Description: ${recipe.description}`,
    `Servings: ${recipe.servings}`,
    `Tags: ${recipe.tags?.join(", ") ?? "—"}`,
    ``,
    `Ingredients:`,
    ingredients,
    ``,
    `Steps:`,
    steps,
  ].join("\n");
}

export async function generateImageSpec(
  recipe: Recipe,
  brandSlug: string
): Promise<RecipeImageSpec> {
  const style = getBrandImageStyle(brandSlug);
  const schema = buildSchema(brandSlug);

  const prompt = [
    `Analyse this German recipe and return the 9 cinematography fields as JSON.`,
    ``,
    `Lighting and scene MUST be drawn from the brand-specific enum values in the schema —`,
    `they encode ${brandSlug}'s signature instagram aesthetic. Pick the single best fit for this dish.`,
    ``,
    formatRecipeForPrompt(recipe),
  ].join("\n");

  const result = await callGemini<RecipeImageSpec>({
    prompt,
    schema,
    systemInstruction: buildSystemInstruction(brandSlug),
    temperature: 0.4,
    maxOutputTokens: 1024,
    thinkingBudget: 0,
    retries: 2,
  });

  // Defensive: if Gemini hallucinates a string that isn't in the brand's
  // enum (rare but possible), snap it to the closest brand option so the
  // downstream prompt assembly stays on brand.
  const lightingOk = style.lightingOptions.includes(result.lightingMood);
  const sceneOk = style.sceneOptions.includes(result.sceneContext);
  if (!lightingOk) result.lightingMood = style.lightingOptions[0];
  if (!sceneOk) result.sceneContext = style.sceneOptions[0];

  // Defensive normalisation: occasionally Gemini drops trailing punctuation
  // or wraps strings in quotes — strip both so downstream prompt assembly is
  // clean.
  return {
    ...result,
    heroElement: stripQuotes(result.heroElement),
    servingVessel: stripQuotes(result.servingVessel).toLowerCase(),
    textureFocus: stripQuotes(result.textureFocus).toLowerCase(),
    lightingMood: stripQuotes(result.lightingMood),
    sceneContext: stripQuotes(result.sceneContext),
  };
}

function stripQuotes(s: string): string {
  return s.trim().replace(/^["']|["']$/g, "").trim();
}
