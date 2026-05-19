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

// ─── Julia · @juliabreitenfeld (DB-Brand-Slug: "julia") ─────────────────────
// V2 (2026-05-12): radikaler Revert von v1. Die erste Iteration war "zu
// hart gepromptet" und produzierte schlechte Bilder — gleiche Lesson wie
// Biene v9.1/9.2/9.3: zuviele NEVER/NOT/no-X-Klauseln sagen Flux indirekt
// "render cleaner" und der homemade-Reel-Look stirbt. Ihr Brand IST der
// homemade-Reel-Look, also weniger Constraints, nicht mehr.
//
// Beobachtete Signature aus 5 IG-Screenshots (Hero-applicable):
//   - bone-grey/light concrete counter (nicht Marmor, nicht Holz)
//   - bright natural daylight, leicht contrasty (NICHT "harsh midday sun"
//     wie v1 gesagt hat — das war ueberzeichnet)
//   - whole loose ingredients casually around the dish — IHR Signature-
//     Element, analog zu Bienes cutting-board-mit-bowl
//
// Was wir explizit NICHT uebernehmen (HERO_BASE_NEGATIVE bannt es eh):
//   - hand-held POV mit manikuerter Hand — Reel-Cover-Stil, nicht Hero
export const JULIA_STYLE: BrandImageStyle = {
  brandSlug: "julia",
  // Bright daylight, leicht contrasty — Mix statt 5x "harsh". Bienes
  // Pattern: simple positive Beschreibungen ohne "NOT X".
  lightingOptions: [
    "bright natural daylight from a kitchen window with clean shadows",
    "warm afternoon light from the side, modern home-kitchen feel",
    "bright daylight catching the dish edges, slight contrast",
    "natural Instagram-real daylight, crisp clean shadows",
    "clean bright daylight from above with soft directional shadows",
  ],
  // Scene-Optionen NUR der Counter, keine "scattered ingredients" mehr.
  // Das war v1's Doppel-Mention bug — ingredients gehoeren in den
  // heroElement-Slot, nicht zusaetzlich auch in den scene-Slot.
  sceneOptions: [
    "a bone-grey concrete kitchen counter",
    "a light neutral stone countertop",
    "a rough concrete surface near a window",
    "a minimal pale-grey concrete counter",
    "a bone-grey stone work surface with subtle texture",
  ],
  styleSuffix: "",
  // Schlank gehalten — 4 Items wie Bienes 3. Wir negieren ihre echten
  // Anti-Patterns (Cutting-Board, Bowl, Marmor) ohne Flux mit 11+ "no X"
  // zu ueberregulieren.
  negativeAddition:
    "no wooden cutting board, no ceramic bowl of ingredients in background, no marble counter, no white tablecloth",
  // Kurz und positiv — Bienes Pattern: eine Hauptaussage statt drei
  // Negationen. v1 hatte 3x "NOT X" + "no studio look" — zuviel.
  cameraAesthetic:
    "natural Instagram-real food photograph, smartphone-snap feel, no studio look",
  // Julias Signature: lose ganze Zutaten verstreut. Schlanker formuliert
  // (kein 3x NEVER mehr). Flux liest "casually placed" als hint, nicht
  // als hard rule — das ist okay, lieber natuerlich aussehende Bilder
  // als ueber-precise-platzierte.
  heroElementGuidance:
    "Whole loose ingredients placed casually around the dish — fresh strawberries, lemon halves, herb sprigs, or whole tomatoes/peppers depending on the recipe. Naturally placed nearby, not arranged on a board or in a bowl.",
  // Angles: NUR Winkel + leichter Schatten-Hint. KEIN Vessel-Hardcode
  // mehr — das war v1's groesster Bug, weil Vessel von der Reference
  // kommt und der Hardcode dagegen kaempfte. Strukturell wie Bienes
  // defaultAngles, ohne Background-Prop weil Julias scattered ingredients
  // schon im heroElement-Slot abgedeckt sind.
  defaultAngles: {
    flat: "from a high overhead angle (about 75-80°, slightly tilted not strict 90°)",
    mixed: "from a 30-45° three-quarter angle, slight natural shadows on the counter",
    layered: "from a 30° three-quarter angle so the layers of the dish are visible",
    tall: "from a 45° eye-level angle that shows the dish's full height",
    liquid: "from a 30° three-quarter angle so the surface texture is visible",
  },
};

// ─── Kristina · @kristinas.healthylife (DB-Brand-Slug: "kristina") ───────────
// Calibrated against 5 IG-Screenshots from the user (2026-05-19):
//   1. Gnocchi One-Pot mit Hackfleisch (top-down, helles Eichenholz,
//      Basilikum-Pflanze in weißem Riffel-Topf rechts, grau-beige Keramik)
//   2. Kirsch-Tiramisu (30° three-quarter, gleiches Holz, Basilikum im
//      Hintergrund, Holzlöffel + Leinen-Serviette als Props)
//   3. Profil-Grid (mix Studio-Talking-Head + Food-Shots, alle Food-Shots
//      mit charakteristischem Holzboden + Pflanze)
//   4. One-Pot Nudelpfanne in echter Küche (helle moderne Familien-
//      Küche, viel Tageslicht, Holzarbeitsplatte)
//   5. Asia Kohlrouladen (30° three-quarter, dunkler grauer Keramik-
//      Teller, Frühlingszwiebeln, Basilikum oben im Frame)
//
// Brand-DNA-Kernunterschied zu Biene/Julia:
//   - Biene = pale-grey concrete + cutting-board-mit-ingredient-bowl
//   - Julia = bone-grey concrete + scattered loose ingredients
//   - Kristina = warm light-oak wood + basil-plant-in-white-pot
//
// Lessons aus Biene v9.x: weniger NEVER/NOT-Klauseln, sonst rendert Flux
// clean-magazine statt homemade-Reel. Schlanke Negatives, klares Signature-
// Element, simple positive Beschreibungen.
export const KRISTINA_STYLE: BrandImageStyle = {
  brandSlug: "kristina",
  lightingOptions: [
    "soft natural daylight on a warm oak counter, gentle directional shadows",
    "warm afternoon daylight from a kitchen window, slightly honey-toned",
    "bright neutral daylight from above with soft shadows on the wood grain",
    "warm side daylight catching the oak grain, healthy-home-cook feel",
    "diffused daylight from the left, warm cosy modern-kitchen mood",
  ],
  sceneOptions: [
    "a warm light-oak wooden counter with visible plank seams and natural grain",
    "a wide-plank honey-oak kitchen table, warm and lived-in",
    "a natural light-oak wood surface in a modern healthy home kitchen",
    "a soft light-oak counter near a sunny kitchen window",
    "a warm honey-toned oak table top, family-kitchen feel",
  ],
  styleSuffix: "",
  // Schlank wie Biene v9.4 — nur die echten Anti-Patterns negieren:
  // keine Stein/Beton/Marmor-Counter (Biene/Julia-Territorium), kein
  // dunkel-vintage Farmhouse-Tisch, kein clean Studio-Look.
  negativeAddition:
    "no concrete or stone counter, no marble surface, no dark vintage farmhouse table, no studio-clean magazine look",
  cameraAesthetic:
    "natural healthy-home-kitchen food photograph, homemade-feeling, no studio look",
  // Kristinas Signature: Basilikum-Pflanze im weißen Riffel-Übertopf im
  // soft-blurred Background. Konsistent in fast all ihren Reels (4 von 5
  // Reference-Screenshots haben sie sichtbar). Wichtig: SOFT background,
  // never on the dish or in the foreground.
  heroElementGuidance:
    "A complete English phrase: 'a small fresh basil plant in a white ribbed ceramic pot sits softly in the upper background of the scene, slightly out of focus'. The basil plant is a separate prop in the soft background, never on or in the dish itself.",
  // Per-shape Winkel an Kristinas Reel-Repertoire angepasst: one-pot bowls
  // und Pfannen top-down (häufigster Shot), layered desserts (Tiramisu,
  // Mealprep-Auflauf) 30° three-quarter, tall single items 45°, Suppen/
  // Liquids 30° für Glanz.
  defaultAngles: {
    flat: "from a high overhead angle looking down (about 75°, slightly tilted not strict 90°), with the dish as the main subject in the foreground on the warm oak counter, and the basil-plant prop placed separately on the counter in the soft upper background of the scene",
    mixed: "from a high overhead angle (about 75°, slightly tilted not strict 90°), warm oak counter visible, basil plant softly in the upper background",
    layered: "from a 30° three-quarter angle so the layers of the dish are visible, basil plant softly visible in the upper background",
    tall: "from a 45° eye-level angle that shows the dish's full height, basil plant softly in the background",
    liquid: "from a 30° three-quarter angle so the liquid surface shines, basil plant softly in the background",
  },
};

// ─── Alina · @alina.walbrun (DB-Brand-Slug: "alina") ─────────────────────────
// Calibrated against 5 IG-Screenshots from the user (2026-05-19):
//   1. Zuckerfreie Schokolade (Hero mit ihr, weißer Counter, weiße Schränke,
//      braune Silikon-Tafelform, gefriergetrocknete Himbeeren)
//   2. Profil-Grid (15 Reels): alle in weißem Setting — weiße Küche, weiße
//      Wand, weißes Bett, weißer Bademantel — Weiß ist konsequente Brand-Farbe
//   3. Schoko-Mousse mit Himbeeren (Glasschale auf hellem Grund, weich
//      neutrales Licht, sehr cleaner Look)
//   4. Schokoladen-Silikonform mit Himbeeren (hellgrauer Mesh-Hintergrund,
//      cleane Ästhetik)
//   5. Blueberry-Müsli-Auflauf (Glasform in der Hand, weiße Küchenschränke,
//      weißer Counter, neutrales helles Licht)
//
// Brand-Positionierung: "Angehende Ärztin / Doctor's Wellness / Longevity".
// Sie nutzt Marker wie "A doctor's favorite" — die Brand verkauft Premium-
// Wellness-Aesthetic statt cottage-homemade.
//
// Brand-DNA-Kernunterschied zu Biene/Julia/Kristina (alle home-cosy):
//   - Biene = pale-grey concrete + cutting-board (cottage-home)
//   - Julia = bone-grey concrete + scattered ingredients (smartphone-snap)
//   - Kristina = warm oak + basil-pot (family-healthy-home)
//   - Alina = white matte counter + NO PROPS (doctor's modern minimal)
//
// INVERSE Lesson zu Biene v9.x: bei Biene war "no studio-clean" wichtig
// (Bienes echter Look ist homemade). Bei Alina ist Studio-clean GENAU der
// Ziel-Look. Cleanness IST das Signature, also Negatives flippen: aggressiv
// "no wood, no rustic, no scattered herbs, no background props" — sonst
// rendert Flux seine Default-Kräuter-Bias und bricht den Doctor's-Look.
export const ALINA_STYLE: BrandImageStyle = {
  brandSlug: "alina",
  // Neutral bis leicht kühl — NICHT honey-toned wie Kristina, NICHT warm-
  // amber wie Biene. Tageslicht, weich, modern-clinical-clean.
  lightingOptions: [
    "bright neutral daylight from a kitchen window with soft directional shadows",
    "clean cool daylight from above, modern minimal kitchen mood",
    "soft bright daylight from the left, slight clinical-clean feel",
    "neutral bright daylight from a sunny window with crisp clean shadows",
    "soft diffused daylight, modern doctor's-kitchen aesthetic",
  ],
  // Weißer matter Counter ist Alinas Signatur-Surface. Variationen damit
  // Gemini Range hat ohne in beige/grau abzudriften.
  sceneOptions: [
    "a clean matte-white kitchen counter",
    "a smooth white quartz countertop",
    "a clean white modern kitchen surface near a window",
    "a matte white counter with subtle minimal texture",
    "a clean white kitchen counter with white cabinets softly blurred in the upper background",
  ],
  styleSuffix: "",
  // Aggressiv-flip zu Biene/Julia/Kristina: hier ist clean-studio GUT,
  // home-cosy/rustic/farmhouse SCHLECHT. Schlank gehalten (5 Items wie
  // Biene v9.4), nicht in 11+ NEVER-Klauseln zerfallen lassen.
  negativeAddition:
    "no wood counter or table, no concrete or stone counter, no scattered herbs or ingredients around the dish, no background plants or props, no rustic farmhouse styling",
  // Bei Alina explicit Studio-clean ZULASSEN — sonst dreht Flux es weg.
  // "Modern minimal doctor's-kitchen" ist die Aesthetic.
  cameraAesthetic:
    "clean modern minimal food photograph, doctor's-kitchen aesthetic, premium wellness feel, no over-styling, no rustic styling",
  // Alinas Signature ist die ABWESENHEIT von Background-Props. Die Cleanness
  // des weißen Counters IST das visuelle Statement. Explicit positive
  // Beschreibung "stands alone, empty space around it" — Flux bekommt
  // einen klaren Anker statt nur Negatives.
  heroElementGuidance:
    "The dish stands alone on the clean white counter with absolute minimal styling and empty negative space around it — no background props, no scattered ingredients, no plants, no cutting boards, no decorative elements. The cleanness of the white surface and the dish alone IS the visual statement.",
  // Per-shape Winkel: top-down 75° für flat dishes, 30° three-quarter für
  // layered (Cheesecake, Mousse-Glass), 45° eye-level für tall, 30° für
  // liquid. Composition mit explicit "empty space around the dish" damit
  // Flux nicht den Frame mit Props füllt.
  defaultAngles: {
    flat: "from a high overhead angle (about 75°, slightly tilted not strict 90°), the dish centered on the clean white counter with generous empty negative space around it",
    mixed: "from a high overhead angle (about 75°, slightly tilted not strict 90°), clean white counter visible, no surrounding props, generous empty space around the dish",
    layered: "from a 30° three-quarter angle so the layers of the dish are visible, clean white counter with white cabinets softly blurred in the upper background, no other props",
    tall: "from a 45° eye-level angle that shows the dish's full height, clean white background, no other props in frame",
    liquid: "from a 30° three-quarter angle so the liquid surface shines, clean white surface, no surrounding props",
  },
};

// ─── Laetitia · @laetitiaszabo (DB-Brand-Slug: "laetitia") ───────────────────
// Calibrated against 5 IG-Screenshots from the user (2026-05-19):
//   1. Profil-Grid: Mix aus Food (Donauwelle, Happy Hippo Bowl, Strawberry
//      Cheesecake, Milchschnitten, Kuchen-Bowls) + Lifestyle (Pferd,
//      Sunrise-Run, Pilates, Cape-Town, Marbella). Hero-relevant ist die
//      Food-Side — alle Food-Shots auf Marmor mit Adern.
//   2. Kinderriegel Kuchen Close-up: heller Marmor mit feinen Adern,
//      Glasform, Cream-Textur mit Highlights, Hand mit beigen Naegeln
//   3. Milchschnitten Bowl: gleiche Marmor-Surface, Glas-Aufbewahrungs-
//      form mit sichtbaren Schichten, Erdbeeren als Akzent
//   4. High Protein Greek Pasta Salad: Glasschuessel, Marmor-Hintergrund,
//      buntes Recipe mit Tomaten/Gurken
//   5. Raspberry Schicht Kuchenbowl: Glasform top-down, Marmor sichtbar,
//      Beeren-Schicht als Hero-Element
//
// Brand-Positionierung: "Luxe High-Protein Meal-Prep". MORE Nutrition
// Partnership, Wettkampf-Vorpac, Female-Strength-Lifestyle aber Food-
// Content ist sehr Hero-Recipe-style mit Premium-Meal-Prep-Aesthetic.
//
// Brand-DNA-Kernunterschied zu allen anderen:
//   - Biene = pale-grey concrete + cutting-board (cottage)
//   - Julia = bone-grey concrete + scattered (smartphone-snap)
//   - Kristina = warm oak + basil-pot (family-healthy)
//   - Alina = white matte + zero props (doctor's-clean)
//   - Laetitia = light marble with veining + glass-container-aesthetic
//     (luxe meal-prep close-up)
//
// Lesson: Vessel-Hardcode bewusst raus — das war Julias v1-Bug. Glas-
// Container ist Laetitias Reel-Pattern, aber vessel kommt aus dem Recipe
// via Stage-2 (sonst kämpft Style gegen Reel-Reality). Wir lassen das
// Marmor + Highlights + Close-up-Atmosphaere als Signature ohne den
// Vessel-Wechsel zu erzwingen.
export const LAETITIA_STYLE: BrandImageStyle = {
  brandSlug: "laetitia",
  // Weich + neutral + cream-Highlights. Ihr Reel-Look hat charakteristisch
  // Highlights auf den cremigen Texturen (Mousse, Quark, Sauce-Glanz).
  // Kein warm-honey wie Kristina, kein clinical wie Alina — eher modern-
  // editorial mit Cream-Sheen.
  lightingOptions: [
    "soft natural daylight on light marble, gentle highlights on cream textures",
    "neutral bright daylight from a window, slight warm tone on the marble veining",
    "soft directional daylight catching cream and protein textures",
    "diffused daylight from above with cream-rich highlights",
    "modern editorial daylight on marble, premium meal-prep feel",
  ],
  // Marmor mit Adern in 5 Variationen — alle hellgrau-weiß, verschiedene
  // Vein-Intensitäten damit Gemini Range hat.
  sceneOptions: [
    "a light grey marble kitchen counter with subtle natural veining",
    "a white-grey carrara-style marble countertop with delicate veins",
    "a polished light marble surface with fine grey veining",
    "a clean light marble counter near a window, soft natural sheen",
    "a premium light marble work surface, modern fitness-kitchen feel",
  ],
  styleSuffix: "",
  // Klares Anti-Pattern zu Biene/Julia/Kristina: KEIN Holz, KEIN Beton,
  // KEINE rustic-Props. Schlank gehalten (5 Items wie Biene v9.4).
  negativeAddition:
    "no wood counter or table, no plain concrete or stone, no scattered herbs or ingredients around the dish, no background plants or props, no rustic farmhouse styling",
  // Editorial close-up Premium-Feel ohne "studio look" — sie ist
  // smartphone-shot, aber gut-lit und dramatisch.
  cameraAesthetic:
    "premium modern food photograph, high-protein meal-prep aesthetic, editorial close-up feel, smartphone-shot but well-lit, no over-styled studio look",
  // Signature ist Marmor + Close-up-Atmosphaere + Cream-Highlights. KEIN
  // Vessel-Hardcode (Julia v1-Lesson). Positiv beschrieben damit Flux
  // einen klaren Anker hat statt nur Negatives.
  heroElementGuidance:
    "The dish is presented in close-up on the light marble counter, the camera relatively tight on the dish so the marble veining and any cream/protein textures fill the frame atmospherically. No background props, no plants, no cutting boards, no scattered ingredients — the marble surface and the dish itself ARE the visual statement.",
  // Per-shape Winkel: Laetitia hat einen Mix aus 30° three-quarter
  // (Cheesecake, Schicht-Bowls) und 75°-Topdown (Pasta-Salat). Layered
  // Shapes mit close-up Frame damit die Schichten dramatisch wirken.
  defaultAngles: {
    flat: "from a high overhead angle (about 75°, slightly tilted not strict 90°), the dish filling most of the frame on the light marble surface with veining subtly visible",
    mixed: "from a 30-45° three-quarter angle so cream and protein textures catch the light, light marble counter visible with subtle veining",
    layered: "from a close 30° three-quarter angle so visible layers in the dish are central and dramatic, marble counter softly visible below the dish",
    tall: "from a 45° eye-level angle that shows the dish's full height, light marble background",
    liquid: "from a close 30° three-quarter angle so the cream or sauce surface catches highlights, marble surface visible",
  },
};

// ─── IQ's Kitchen · @iqskitchen (DB-Brand-Slug: "iqskitchen") ────────────────
// Calibrated against 4 IG-Screenshots from the user (2026-05-19):
//   1. Schoko-Mousse/Brownie-Teig in hellgrauer Keramikschale auf dunklem
//      grauen Leinen-Geschirrtuch, dunkler Hintergrund-Counter, warmes
//      Indoor-Licht mit weichen Highlights
//   2. Profil-Grid: Talking-Head + Food-Shots, Mix aus Edukation
//      (Magnesium/Eisen-Talks) + Recipes (One-Pot, Mealprep) + MORE-
//      Werbung. Maskuline Coaching-Brand mit substanzieller Food-Side.
//   3. High-Protein Eis in Glas-Becher auf DUNKLEM Stone-Counter,
//      MORE-Produkte als Backdrop, warm-indoor Lighting
//   4. Schnelle One-Pot Pasta mit Spinat in Edelstahl-Pfanne, DUNKLER
//      Granit-Counter, Induktionsherd sichtbar, moody Indoor-Light
//   5. High-Protein Blueberry Cake in Glas-Auflaufform auf DUNKLEM
//      Leinen-Underlay, dramatisches side-lit Editorial-Foto mit golden
//      Highlights auf der Crust, scriptige Typo "High-Protein Blueberry
//      Cake" — sein bestes Brand-Foto, definiert den Look
//
// Brand-Positionierung: "Masculine Coaching Kitchen / Premium Dark
// Editorial Food". IFBB-Pro-Look, MORE Nutrition Partnership, hybride
// Edukations-Content + Recipe-Posts. User klassifiziert als Rezept-
// Brand weil Food-Side substanziell ist (One-Pots, Cakes, Mealprep,
// Mousse).
//
// Brand-DNA-Kernunterschied zu allen anderen — er ist fast das Gegenteil
// von Alina (white minimal):
//   - Biene = pale-grey concrete + cutting-board (cottage)
//   - Julia = bone-grey concrete + scattered (smartphone-snap)
//   - Kristina = warm oak + basil-pot (family-healthy)
//   - Alina = white matte + zero props (doctor's-clean)
//   - Laetitia = light marble + glass-container (luxe meal-prep)
//   - IQ's Kitchen = dark granite + side-lit drama (masculine editorial)
//
// Wichtig: das ist der erste Brand-Style mit DARK base. Lighting muss
// dramatisch, side-lit, mit golden Crust-Highlights — sonst wirkt
// dark-grey wie undeflited statt editorial. Aggressive positive
// Lighting-Hints damit Flux nicht in dark-flat fällt.
export const IQSKITCHEN_STYLE: BrandImageStyle = {
  brandSlug: "iqskitchen",
  // Dramatic, side-lit, moody warm. KEY-Lighting muss Highlights auf
  // gebackenen Crusts und glänzenden Saucen erzeugen — das macht den
  // editorial Look. Indoor warm, nicht harsh daylight.
  lightingOptions: [
    "dramatic warm side-lighting from the left with golden highlights on the dish, dark moody background",
    "moody indoor warm light from a single window, strong side-shadows, golden edges on the food",
    "warm directional light catching crusts and sauces with golden sheen, dark surroundings",
    "editorial dark mood lighting with a single warm light source, food glowing against dark counter",
    "low-key warm indoor light, dramatic chiaroscuro on the dish, dark moody atmosphere",
  ],
  // Dunkle Stone-Surfaces. 5 Variationen damit Gemini Range hat ohne
  // in pure black abzudriften (Flux rendert pure black flach).
  sceneOptions: [
    "a dark charcoal granite kitchen counter with subtle natural texture",
    "a black-grey stone countertop with fine speckled texture",
    "a dark slate kitchen surface, modern coaching-kitchen feel",
    "a deep grey stone counter under moody warm light",
    "a dark textured counter with a dark grey linen underlay near the dish",
  ],
  styleSuffix: "",
  // Klares Anti-Pattern zu allen anderen 5 Rezept-Brands: KEIN heller
  // Counter, KEIN Marmor, KEIN Holz, KEIN Weiß. Schlank gehalten.
  negativeAddition:
    "no white or light counter, no marble, no wood counter or table, no bright airy kitchen, no scattered herbs or background plants, no flat even lighting",
  // Editorial Premium-Look ohne studio-cleanness — sein Stil ist
  // smartphone-shot aber gut-lit. Aggressive moody Indikatoren damit
  // Flux nicht in seinen Default bright-clean Bias fällt.
  cameraAesthetic:
    "moody editorial food photograph, dark masculine coaching-kitchen aesthetic, premium high-protein feel, dramatic close-up with strong side-light, smartphone-shot but well-lit, no studio bright look",
  // Signature ist Dunkelheit + dramatic Lighting + Golden Highlights.
  // Positiv beschrieben damit Flux einen klaren Atmosphere-Anker hat
  // (sonst rendert dark-grey als underexposed-flat statt editorial).
  heroElementGuidance:
    "The dish is presented dramatically against the dark counter, lit from one side so golden highlights play on crusts, sauces, or creamy surfaces — the contrast between the warm-lit food and the dark surroundings IS the visual statement. No background props, no plants, no scattered ingredients — the moody atmosphere and the food's own glow carry the frame.",
  // Per-shape Winkel: 30° three-quarter dominant (Blueberry Cake-Style,
  // sein bester Hero-Shot). Layered Shapes besonders dramatisch in 30°.
  // Top-down 75° für flat dishes (One-Pot, Mousse-Bowl).
  defaultAngles: {
    flat: "from a high overhead angle (about 75°, slightly tilted not strict 90°), centered on the dark stone counter with strong side-light creating moody shadows around the dish",
    mixed: "from a 30-45° three-quarter angle with dramatic warm side-lighting, the dark counter visible, golden highlights on the dish",
    layered: "from a close 30° three-quarter angle so the layers and crusts are dramatically lit from the side, dark counter softly visible below, editorial moody atmosphere",
    tall: "from a 45° eye-level angle that shows the dish's full height against the dark moody background, side-lit for editorial drama",
    liquid: "from a close 30° three-quarter angle so the warm side-light glints on the liquid surface, dark counter and moody atmosphere",
  },
};

// ─── Lookup by brand slug ────────────────────────────────────────────────────
const STYLES: Record<string, BrandImageStyle> = {
  biene: BIENE_STYLE,
  julia: JULIA_STYLE,
  kristina: KRISTINA_STYLE,
  alina: ALINA_STYLE,
  laetitia: LAETITIA_STYLE,
  iqskitchen: IQSKITCHEN_STYLE,
};

// Sagt: haben wir fuer diesen Slug einen hand-kalibrierten Code-Style?
// Wichtig fuer generate-hero.ts: bei Brands mit Code-Style soll KEIN
// dynamischer Reel-Style-Override gefahren werden — der hardcoded Style
// gewinnt. Semantisch verschieden von isCodeBrand() in lib/brands.ts —
// das prueft, ob der Brand im brands-Array steht (= UI-Editierbarkeit).
// Hier geht es nur um die Style-Quelle der Hero-Pipeline.
export function hasHardCodedStyle(brandSlug: string): boolean {
  return brandSlug in STYLES;
}

// ─── Per-Run Style-Override (PR 16) ──────────────────────────────────────────
// AsyncLocalStorage erlaubt es, fuer einen einzelnen Hero-Generation-Run
// einen dynamisch aus dem Reel abgeleiteten Style einzuspeisen, ohne die
// Pipeline-Funktionen umbauen zu muessen. generate-hero.ts wraps den
// reference-Hero-Call in withBrandImageStyleOverride(reelStyle, ...) und
// getBrandImageStyle picksauber den Override fuer alle nested Calls
// (generateImageSpec, buildPrompt, heroPrompt etc.).
//
// Nur fuer DB-Brands genutzt — Code-Brands (Biene) gehen direkt durch
// die STYLES Map ohne Override.
import { AsyncLocalStorage } from "node:async_hooks";

const styleOverrideStorage = new AsyncLocalStorage<BrandImageStyle>();

export function withBrandImageStyleOverride<T>(
  style: BrandImageStyle,
  fn: () => Promise<T>
): Promise<T> {
  return styleOverrideStorage.run(style, fn);
}

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

// Async-Loader fuer Brand-DNA. Vier Quellen, in dieser Reihenfolge:
//   0. Per-Run Override (AsyncLocalStorage) — fuer dynamisch aus Reel
//      abgeleitete Styles bei DB-Brands (PR 16)
//   1. Code-Brand (STYLES Map) — Biene, hand-kalibriert
//   2. DB-Brand mit imageStyle (Onboarding-Template aus PR 11)
//   3. FALLBACK_STYLE (generischer Cookbook-Look)
//
// Async, weil DB-Lookup. Caller in der Hero-Pipeline (image-prompts.ts +
// recipe-image-spec.ts) sind eh schon in async-Kontexten (Server-Calls).
export async function getBrandImageStyle(
  brandSlug: string
): Promise<BrandImageStyle> {
  // 0. Per-Run Override (PR 16) — bei DB-Brands wird hier der pro Reel
  // dynamisch aus dem Keyframe abgeleitete Style eingespeist. Hat absolute
  // Prioritaet, weil's auf das konkrete Reel zugeschnitten ist.
  const override = styleOverrideStorage.getStore();
  if (override) return override;

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
