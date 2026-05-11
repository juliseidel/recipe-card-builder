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
//   - dishes are plated up (rustic grey ceramic plate, white cake plate),
//     pans only when genuinely served from the pan
//   - bright natural daylight, not warm-amber, not moody
//
// REMOVED 2026-05-07: "scattered parsley on counter+board" was an over-
// generalisation from her savoury reels. On baked goods, sweet desserts and
// snacks (Pack 1, Pack 3, most of Pack 4) it reads as random green flecks
// next to chocolate cakes — the opposite of polished. Parsley is now
// explicitly negated; the cutting board with main-ingredient bowl is the
// only universal signature element.
export const BIENE_STYLE: BrandImageStyle = {
  brandSlug: "biene",
  // Five lighting strings — zurueck auf Jan's Original-Optionen (warm,
  // golden, amber). Frueher waren das hier daylight-neutral-Optionen
  // basierend auf einer Pinterest-Annahme. User-Feedback (2026-05-11):
  // Bienes echte Reels haben warmes Kuechen-Licht, nicht clinical-cool.
  // Jan's Original-Wording matched besser ihren tatsaechlichen Reel-Look.
  lightingOptions: [
    "warm morning light streaming from the left with soft shadows",
    "golden afternoon light from a side window with long gentle shadows",
    "warm diffused daylight from above, honey-toned",
    "warm backlight glowing through a kitchen window, amber",
    "late afternoon amber light from the right with soft highlights",
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
  //
  // Greens-out: Flux carries a strong cookbook bias and adds parsley/herb
  // sprigs as default garnish even when the prompt is silent on it. We
  // negate it aggressively here. "no parsley" alone wasn't enough in
  // testing — it kept rendering loose green leaves which look like parsley
  // even if Flux semantically classed them as something else.
  // Nur die brand-spezifischen Negatives, die wirklich helfen.
  // Frueher waren hier 25+ Items mit vielen Variationen ("no parsley sprigs",
  // "no scattered parsley on counter", "no scattered parsley on board", ...).
  // Konsolidiert auf 3 Kernregeln — der Rest macht Flux ueberregelmaessig.
  negativeAddition:
    "no parsley or scattered herbs around the dish, no cast-iron pan as vessel, no recipe title text overlay",
  // No "smartphone reel" or "phone" — both trigger Flux 2 Pro's reel-frame
  // mode, which renders headline overlays. "Natural unstaged" gets the
  // same look without the trigger word.
  cameraAesthetic:
    "natural unstaged food photograph, homemade-feeling, no studio look",
  // Bienes signature framing: cutting board with a MAIN-INGREDIENT bowl in
  // the soft background. NO scattered greens on counter or board — that
  // earlier hypothesis didn't survive contact with the sweet/baked dishes
  // (Pack 1 Backwelt, Pack 3 Snacks, half of Pack 4 Meal-Prep).
  //
  // CRITICAL distinction (kept from iter 13): the bowl holds the recipe's
  // MAIN HEADLINE INGREDIENT (the thing that NAMES the dish — cheese for
  // cheese-pasta, blueberries for blueberry-cheesecake, eggs for an
  // omelette). NEVER parsley, herbs, salt, oil or garnish in the bowl.
  // Bienes Signature-Framing in einem klaren Satz — frueher 300+ Woerter
  // mit Beispielen + sechs Negationen. Das ueberforderte Flux. Knapp und
  // klar funktioniert besser; die "main ingredient"-Auswahl ueberlassen
  // wir Gemini's Intuition.
  heroElementGuidance:
    "A complete English phrase describing the scene: 'a small wooden cutting board with a small ceramic bowl of [main recipe ingredient in its most photogenic natural form] sits softly in the background, behind the dish'. The cutting board is a separate prop in the background, never under the dish itself.",
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
