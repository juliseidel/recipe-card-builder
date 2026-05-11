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
  // Brand-spezifische Negatives. v9.1/9.2/9.3 haben mehr Constraints
  // dazugepackt (Anti-Fabric, blondes Holz, weisse Keramik) und damit den
  // authentischen homemade-Reel-Look kaputtgemacht — jede zusaetzliche
  // Anti-X-Klausel sagt Flux indirekt "render cleaner", die Bilder wurden
  // poliert/KI-mae3sig. v9.4 ist der komplette Revert auf v9-Stand, der
  // beim ersten Test "sensationell" war (Frozen Cups, Kaiserschmarren,
  // Cheesecake). Trade-off: das Cheesecake-Tuch kann zurueckkommen, falls
  // es im Reel-Keyframe sichtbar war — akzeptabel weil Reel-Treue gewuenscht.
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

// Generic fallback: clean modern minimal — wird genutzt, wenn ein Brand
// weder im Code definiert ist noch ein DB-imageStyle hat (z. B. frisch
// onboarded, Vision-Analyse hat keinen sauberen Style erkannt). Vorher
// war das Jan's Original-Default (warm rustic wooden table), aber das hat
// frischen Creators den "Vintage-Cookbook"-Look aufgezwungen, auch wenn
// ihre Reels modern-minimal sind (wie Jule).
//
// Neue Default-Aesthetik: bright natural daylight, pale neutral surfaces,
// overhead-leaning angles — passt zu 80% der modernen Food-Creator und ist
// neutraler als Jan's farmhouse-Bias. Wenn ein Creator wirklich Rustic
// shoot't, holt die Vision-Analyse das raus und ueberschreibt diesen
// Fallback.
const FALLBACK_STYLE: Omit<BrandImageStyle, "brandSlug"> = {
  lightingOptions: [
    "bright natural daylight from above with soft even illumination",
    "soft diffused morning light from a side window with gentle shadows",
    "cool clean daylight from a window, neutral white balance, modern feel",
    "bright overhead daylight with minimal shadows, clean editorial look",
    "soft natural light with subtle warm highlights from a kitchen window",
  ],
  sceneOptions: [
    "a clean pale neutral surface with minimal styling",
    "a soft cream-colored matte countertop, modern and unfussy",
    "a smooth light-grey surface with subtle natural texture",
    "a pale warm-white countertop near a window with bright daylight",
    "a clean modern kitchen surface, lightly textured, photographed close",
  ],
  styleSuffix: "",
  negativeAddition:
    "no rustic wooden table, no farmhouse table, no dark vintage props, no heavy cookbook styling",
  cameraAesthetic:
    "natural unstaged food photograph, modern minimal styling, homemade-feeling, no studio look, no heavy props",
  heroElementGuidance:
    "Keep styling minimal — the dish is the hero. Optionally a small neutral linen napkin or a single ingredient placed loosely beside the bowl/plate.",
  defaultAngles: {
    flat: "from a high overhead angle looking down (about 80°, slightly tilted not strict 90°)",
    mixed: "from a high overhead angle looking down (about 80°, slightly tilted)",
    layered: "from a 30° three-quarter angle so the layers are visible",
    tall: "from a 45° eye-level angle showing the full height",
    liquid: "from a 30° three-quarter angle so the liquid surface shines",
  },
};

// Async-Loader fuer Brand-DNA. Drei Quellen, in dieser Reihenfolge:
//   1. Code-Brand (STYLES Map) — Biene, hand-kalibriert
//   2. DB-Brand mit imageStyle (von der Vision-Analyse beim Onboarding)
//   3. FALLBACK_STYLE (generischer Cookbook-Look)
//
// Async, weil DB-Lookup. Caller in der Hero-Pipeline (image-prompts.ts +
// recipe-image-spec.ts) sind eh schon in async-Kontexten (Server-Calls).
export async function getBrandImageStyle(
  brandSlug: string
): Promise<BrandImageStyle> {
  // Code-Brand zuerst — sync, kein DB-Roundtrip
  const code = STYLES[brandSlug];
  if (code) return code;

  // DB-Brand: dynamic import damit dieses Modul auch aus Client-Code
  // importiert werden kann ohne Supabase-Server-Bundle ins Browser-Bundle
  // zu schleppen. (Aktuell zwar nur server-side genutzt, aber defensiv.)
  try {
    const { loadBrand } = await import("@/lib/custom-brands-server");
    const brand = await loadBrand(brandSlug);
    if (brand?.imageStyle) {
      return {
        brandSlug,
        ...brand.imageStyle,
      };
    }
  } catch (err) {
    console.warn("[brand-image-style] DB-Style-Lookup failed:", err);
  }

  return { brandSlug, ...FALLBACK_STYLE };
}
