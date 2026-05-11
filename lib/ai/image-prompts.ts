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
//
// Async seit PR 5: getBrandImageStyle macht DB-Lookup. Caller (heroPrompt,
// lifestylePrompt, buildPrompt) sind alle async.
async function angle(
  spec: RecipeImageSpec,
  brandSlug: string
): Promise<string> {
  const style = await getBrandImageStyle(brandSlug);
  const override = style.defaultAngles?.[spec.dishShape];
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
export async function heroPrompt(
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
): Promise<string> {
  const [a, style] = await Promise.all([
    angle(spec, brandSlug),
    getBrandImageStyle(brandSlug),
  ]);

  // Vessel-Handling:
  // - Bei Reference-Path: Vessel kommt NICHT in den Prompt. Gemini extrahiert
  //   das Vessel aus den Preparation-Steps (z. B. "muffin tin" weil "In Form
  //   einfuellen"), aber das ist oft das Vorbereitungs-Gefaess, nicht das
  //   echte Serving-Gefaess (das im Reel zu sehen ist). Wenn beide nicht
  //   matchen, kaempft der Prompt-Text gegen die Reference und Flux mischt
  //   (z. B. Muffin-Form MIT Cups drauf). Loesung: Vessel weglassen, Reference
  //   uebernimmt das automatisch — wir verstaerken das mit "vessel matching
  //   the reference" weiter unten.
  // - Bei Text-Only: Vessel BLEIBT im Prompt (Flux hat sonst keinen Anker).
  const parts: string[] = withReferenceImage
    ? [
        `${recipe.title}, ${a} view, placed on ${spec.sceneContext}.`,
        `${spec.heroElement}, styled deliberately as part of the scene.`,
        `${spec.lightingMood}.`,
      ]
    : [
        `${recipe.title}, shown in a ${spec.servingVessel}, ${a} view, placed on ${spec.sceneContext}.`,
        `${spec.heroElement}, styled deliberately as part of the scene.`,
        `${spec.lightingMood}.`,
      ];

  if (withReferenceImage) {
    // Vessel explizit in die "matching the reference" Klausel — sonst koennte
    // Flux das Vessel kreativ interpretieren statt aus der Reference zu
    // uebernehmen. Restliche Klausel ist Jan's Original-Wording.
    parts.push(
      `${style.cameraAesthetic}, ${toneWord(spec)} tones, homemade imperfect character preserved from the reference image, dish shape, color, serving vessel and garnish placement matching the reference, environment and lighting re-staged for warmth${steamSuffix(spec)}.`
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

export async function heroNegative(brandSlug: string): Promise<string> {
  const style = await getBrandImageStyle(brandSlug);
  const add = style.negativeAddition;
  return add ? `${HERO_BASE_NEGATIVE}, ${add}` : HERO_BASE_NEGATIVE;
}

// LIFESTYLE — Stage 5. Plated portion on a ceramic plate with one utensil.
// Useful as a secondary "served" image; we don't use it in the cover slot
// because the vessel is generic (always a plate).
export async function lifestylePrompt(
  recipe: Recipe,
  spec: RecipeImageSpec,
  brandSlug: string
): Promise<string> {
  const [a, style] = await Promise.all([
    angle(spec, brandSlug),
    getBrandImageStyle(brandSlug),
  ]);
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

export async function lifestyleNegative(
  brandSlug: string
): Promise<string> {
  const style = await getBrandImageStyle(brandSlug);
  const add = style.negativeAddition;
  return add ? `${LIFESTYLE_BASE_NEGATIVE}, ${add}` : LIFESTYLE_BASE_NEGATIVE;
}

// REFERENCE-FIRST Prompt fuer DB-Brands (PR 12, ueberarbeitet in PR 13).
// Anders als der heroPrompt fuer Code-Brands (Biene), der einen ausgepraegten
// Style ueberlagert, folgt dieser Prompt der Reel-Reference visuell, aber
// REMOVED konsequent alle Werbe-Elemente aus dem Reel-Cover.
//
// PR 13 Fix: vorheriger Prompt sagte "preserve everything" — Flux hat das
// woertlich genommen und auch Text-Overlays + POV-Captions + Werbe-Sticker
// 1:1 ins generierte Bild kopiert. Neues Wording:
//   - "Re-render" statt "preserve" → klar: Re-Rendering, nicht Pure-Copy
//   - Explizit: "remove all text overlays, captions, stickers, watermarks"
//   - Negatives massiv ausgebaut fuer Text-Entfernung
//
// Visuell soll das Bild der Reel-Aesthetik folgen (Counter, Lighting,
// Dish-Form, Vessel), aber CLEAN ohne Werbe-Klotz oben drauf.
export function buildReferenceFirstPrompt(
  recipe: Recipe
): { prompt: string; negative: string } {
  const steam =
    recipe.title.match(/suppe|soup|stew|eintopf|tee|kakao|brei/i)
      ? ", with subtle steam rising"
      : "";
  return {
    prompt: [
      `Re-render this dish ("${recipe.title}") from the reference image as a clean editorial food photograph.`,
      `Match the dish itself precisely: same food, same vessel, same plating, same garnish placement, same general surface and lighting style as in the reference.`,
      `CRITICAL: completely remove any text overlays, captions, POV text, stickers, watermarks, brand stamps, hashtags, or graphic elements from the reference image — render the scene as if those overlays were never there. The final image must have NO text whatsoever.`,
      `Natural unstaged food photograph, homemade imperfect character, no studio look${steam}.`,
    ].join(" "),
    negative: [
      "text",
      "captions",
      "subtitles",
      "stickers",
      "watermarks",
      "overlays",
      "overlay text",
      "POV text",
      "descriptive text on image",
      "recipe title text",
      "instagram captions",
      "@username",
      "hashtags in image",
      "typography",
      "font",
      "letters",
      "words",
      "writing",
      "labels",
      "logos",
      "packaging",
      "graphic elements",
      "promotional graphics",
      "ad banners",
      "studio lighting",
      "white void background",
    ]
      .map((s) => `no ${s}`)
      .join(", "),
  };
}

export async function buildPrompt(
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
): Promise<{ prompt: string; negative: string }> {
  switch (style) {
    case "lifestyle": {
      const [prompt, negative] = await Promise.all([
        lifestylePrompt(recipe, spec, brandSlug),
        lifestyleNegative(brandSlug),
      ]);
      return { prompt, negative };
    }
    case "hero":
    default: {
      const [prompt, negative] = await Promise.all([
        heroPrompt(
          recipe,
          spec,
          brandSlug,
          dishDescription,
          withReferenceImage
        ),
        heroNegative(brandSlug),
      ]);
      return { prompt, negative };
    }
  }
}
