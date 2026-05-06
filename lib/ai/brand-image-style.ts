// Brand-DNA layer that wraps Jan's generic cinematography pipeline.
//
// Jan's Stage 2 prompt offers five generic lighting moods and five generic
// scene contexts — both lean cookbook-rustic ("farmhouse table", "kitchen
// shelves softly blurred"). That's safe for arbitrary creators but not on
// brand for Biene, whose actual instagram aesthetic is bright, cream-toned,
// modern german home kitchen, NOT dark vintage farmhouse.
//
// This module overrides the lighting + scene enums per brand and adds a
// style suffix that nudges Flux toward each creator's signature look.

export type BrandImageStyle = {
  brandSlug: string;
  /** Five lighting strings — overrides Jan's defaults in the Stage 2 schema. */
  lightingOptions: string[];
  /** Five scene strings — overrides Jan's defaults in the Stage 2 schema. */
  sceneOptions: string[];
  /** Free-form description appended to the Stage 4 hero prompt. */
  styleSuffix: string;
  /** Negative-prompt additions, comma-separated. */
  negativeAddition: string;
  /** Camera/aesthetic line that replaces Jan's "Leica SL2 50mm f/5.6,
   *  cookbook-style ..., homemade imperfect character" body — this is the
   *  one piece of Jan's hero prompt we override per brand because the
   *  DSLR-cookbook framing is what creates the magazine look. */
  cameraAesthetic: string;
  /** Override for Stage 2 heroElement patterns. Some creators arrange the
   *  hero ingredient alongside the dish (Jan's default); others (Biene)
   *  feel more authentic with the garnish on the dish itself. Empty string
   *  = use Jan's default. */
  heroElementGuidance: string;
  /** Default camera angle override per dish-shape — Biene's reels lean
   *  top-down for flat/mixed dishes more than Jan's generic 30°
   *  three-quarter default. Keys are dishShape values. */
  defaultAngles?: Partial<Record<"flat" | "layered" | "tall" | "liquid" | "mixed", string>>;
};

// ─── Biene · @bienesfitlife ──────────────────────────────────────────────────
// Calibrated against four real Bienes-reel screenshots from the user's
// research. Observed signature elements:
//   - counter is pale-grey concrete-stone (NOT cream — that was a wrong
//     assumption from earlier iterations)
//   - small wooden cutting board ALWAYS in the soft upper background, holding
//     a tiny ceramic bowl with one or two key recipe ingredients
//   - fresh parsley scattered loosely across the cutting board AND across
//     the counter near the dish — her trademark
//   - dishes are plated up (rustic grey ceramic plate, white cake plate),
//     pans only when genuinely served from the pan
//   - bright natural daylight, not warm-amber, not moody
export const BIENE_STYLE: BrandImageStyle = {
  brandSlug: "biene",
  // Five lighting strings, all daylight-neutral. Bienes reels are bright
  // and clean, never golden-hour-warm.
  lightingOptions: [
    "bright morning daylight from a window on the left",
    "soft natural daylight from a side window",
    "bright midday daylight from above",
    "fresh natural backlight from a kitchen window",
    "clean cool daylight from a window on the right",
  ],
  // Five scene options, all variations on Bienes pale-grey concrete-stone
  // counter. Subtle differences (smooth, lightly-textured, near-window) so
  // Gemini has range without drifting into other surfaces.
  sceneOptions: [
    "a smooth pale-grey concrete kitchen counter",
    "a lightly-textured pale-grey stone countertop",
    "a pale-grey concrete-stone counter near a window",
    "a soft grey kitchen surface with subtle natural texture",
    "a clean pale-grey concrete counter under bright daylight",
  ],
  styleSuffix: "",
  // Pan-out goes here so it scopes to Biene specifically (other brands may
  // legitimately serve from the pan). Tilt-out forces the bird's-eye angle
  // for flat/mixed dishes — Flux 2 Pro otherwise drifts to a 30°
  // three-quarter view even when the prompt requests overhead.
  negativeAddition:
    "no styled food magazine, no decorative props, no recipe title overlay, no large letters in the image, no instagram caption text, no cast-iron pan as the main vessel, no frying pan, no skillet, no cream-coloured counter, no oak wood counter, no marble counter, no beige countertop, no parsley in the ingredient bowl, no herbs in the ingredient bowl, no garnish in the ingredient bowl",
  // No "smartphone reel" or "phone" — both trigger Flux 2 Pro's reel-frame
  // mode, which renders headline overlays. "Natural unstaged" gets the
  // same look without the trigger word.
  cameraAesthetic:
    "natural unstaged food photograph, homemade-feeling, no studio look",
  // Bienes signature framing: cutting board with a MAIN-INGREDIENT bowl in
  // the soft background, loose-scattered parsley on board and counter.
  //
  // CRITICAL distinction observed in iter 13: Gemini conflated the bowl
  // ingredient with the parsley garnish and put parsley in the bowl on a
  // cheese-pasta recipe. The fix is to separate the two roles emphatically:
  // (a) the bowl holds the recipe's MAIN HEADLINE INGREDIENT (the thing
  //     that names the dish — cheese for cheese-pasta, blueberries for
  //     blueberry-cheesecake, eggs for an omelette);
  // (b) the parsley is the universal garnish on counter/board, NEVER the
  //     bowl content.
  heroElementGuidance:
    "Return a complete English phrase. Fill in the recipe's MAIN HEADLINE INGREDIENT — the ingredient that NAMES the dish — in its MOST PHOTOGENIC AND ICONIC FORM (e.g. for 'Käse-Nudeln': grated parmesan or shaved hard cheese, NEVER sliced processed cheese or sandwich cheese; for 'Erdbeer-Cheesecake': fresh whole strawberries, NEVER strawberry sauce; for 'Banana-Bread-Pudding': fresh sliced banana, NEVER bottled banana sauce; for 'Schoko-Biskuitrolle': cocoa powder or chocolate shavings, NEVER pre-made chocolate sauce). NEVER pick parsley, herbs, salt, oil, or any garnish — those are NOT main ingredients. The phrase: 'separately on the counter in the soft upper background of the scene sits a small wooden cutting board, and on top of that cutting board rests a small ceramic bowl of [MAIN HEADLINE INGREDIENT IN ITS MOST PHOTOGENIC FORM, NEVER parsley or herbs]; a few sprigs of fresh parsley are scattered loosely across the cutting board and across the counter near the dish'. The cutting board sits on the counter as a SEPARATE prop in the background — the dish bowl is in the foreground, NOT placed on top of the cutting board. The cutting board, the small ingredient bowl, AND the scattered parsley MUST all be present — it is Biene's signature framing.",
  // Per-shape angle overrides. Calibrated against Bienes real reels:
  // pasta-bowls and plated mains shoot top-down (most of her content),
  // layered desserts (cheesecake, tiramisu) shoot 30° three-quarter so
  // the layers read, tall single items (whole cake, burger) shoot 45°,
  // liquids (smoothies, soups) shoot 30° three-quarter for surface shine.
  //
  // Tuned by iter 14 feedback: strict 90° bird's-eye stacked everything
  // onto the cutting board (Flux took "bowl on the cutting board" as
  // composition rather than scene grammar). Soft high-angle 75°ish keeps
  // Bienes look without flattening the foreground/background separation.
  defaultAngles: {
    flat: "from a high overhead angle looking down (about 75°, slightly tilted not strict 90°), with the dish as the main subject in the foreground on the counter, and the wooden cutting board with its small ingredient bowl placed separately on the counter in the soft upper background of the scene",
    mixed: "from a high overhead angle looking down (about 75°, slightly tilted not strict 90°), with the dish as the main subject in the foreground on the counter, and the wooden cutting board with its small ingredient bowl placed separately on the counter in the soft upper background of the scene",
    layered: "from a 30° three-quarter angle so the layers of the dish are visible",
    tall: "from a 45° eye-level angle that shows the dish's full height",
    liquid: "from a 30° three-quarter angle so the liquid surface shines",
  },
};

// ─── Lookup by brand slug ────────────────────────────────────────────────────
const STYLES: Record<string, BrandImageStyle> = {
  biene: BIENE_STYLE,
};

export function getBrandImageStyle(brandSlug: string): BrandImageStyle {
  const style = STYLES[brandSlug];
  if (style) return style;
  // Sensible fallback that won't break for new brands. Mirrors Jan's original
  // generic options verbatim so older callers still get a coherent prompt.
  return {
    brandSlug,
    lightingOptions: [
      "warm morning light streaming from the left with soft shadows",
      "golden afternoon light from a side window with long gentle shadows",
      "warm diffused daylight from above, honey-toned",
      "warm backlight glowing through a kitchen window, amber",
      "late afternoon amber light from the right with soft highlights",
    ],
    sceneOptions: [
      "a warm rustic wooden table with kitchen shelves softly blurred behind",
      "a pale oak countertop with a folded linen cloth and small ceramic out of focus nearby",
      "a light wooden surface with a small leafy potted plant softly out of focus behind",
      "a warm farmhouse table with a soft linen runner and stoneware suggested behind",
      "a warm-toned kitchen counter near a window with bright natural daylight, wooden surfaces softly suggested behind",
    ],
    styleSuffix: "cookbook-style modern food photograph",
    negativeAddition: "",
    cameraAesthetic:
      "Shot on Leica SL2 50mm lens at f/5.6, dish in sharp focus from edge to edge, background softly out of focus, cookbook-style instagram food photograph, homemade imperfect character",
    heroElementGuidance: "",
  };
}
