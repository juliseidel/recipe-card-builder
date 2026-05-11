import type { BrandImageStyleOverride } from "@/lib/brands";

// Sechs hand-tunede Brand-Style-Templates fuer die Text-basierte Style-
// Detection beim Creator-Onboarding (PR 11). Jedes Template matched
// exakt die Shape von BIENE_STYLE in brand-image-style.ts — komplette
// 5 lightingOptions, 5 sceneOptions, cameraAesthetic, heroElementGuidance,
// defaultAngles pro DishShape, negativeAddition.
//
// Statt Gemini Vision auf wackeligen Reel-Covers laufen zu lassen (was
// reliable mit 400 INVALID_ARGUMENT failed), waehlt Gemini Flash TEXT
// aus diesen Templates basierend auf Bio + Captions + Mood. Das ist:
//   - robust (kein Vision-Schema-Glitch)
//   - schnell (~3-5s statt 30s)
//   - billig (Flash kostet ~10x weniger als Pro Multimodal)
//   - deterministic-ish (Keyword-Fallback wenn Gemini failt)
//
// Bienes Style bleibt UNANGETASTET — diese Templates sind nur fuer
// DB-Brands ohne Code-Style.

export type BrandStyleTemplate = {
  id: string;
  label: string;
  description: string;
  /** Keywords die zu diesem Template passen — Bio/Caption-Matching im
   *  deterministic Fallback. */
  keywords: string[];
  style: BrandImageStyleOverride;
};

export const BRAND_STYLE_TEMPLATES: BrandStyleTemplate[] = [
  // 1. MODERN MINIMAL — heller Counter, top-down, clean editorial
  //    Passt fuer: Fitness, Healthy, Clean Eating, moderne Food-Creator
  //    mit bright Kitchen-Setup
  {
    id: "modern-minimal",
    label: "Modern Minimal",
    description:
      "Clean modern kitchen, bright daylight, pale neutral surfaces, top-down composition. Helle Bilder ohne Vintage-Bias.",
    keywords: [
      "fitness",
      "healthy",
      "clean",
      "modern",
      "minimal",
      "abnehmen",
      "protein",
      "low carb",
      "mealprep",
      "lean",
    ],
    style: {
      lightingOptions: [
        "bright natural daylight from above with soft even illumination",
        "soft diffused morning light from a side window with gentle shadows",
        "cool clean daylight from a window, neutral white balance",
        "bright overhead daylight with minimal shadows, clean editorial look",
        "soft natural light with subtle warm highlights from a kitchen window",
      ],
      sceneOptions: [
        "a clean pale neutral countertop with minimal styling",
        "a smooth cream-colored matte surface, modern and unfussy",
        "a soft light-grey kitchen counter near a window",
        "a pale warm-white countertop with bright daylight",
        "a clean modern kitchen surface, lightly textured",
      ],
      styleSuffix: "",
      negativeAddition:
        "no rustic wooden table, no farmhouse table, no dark vintage props, no heavy cookbook styling, no candles, no dim lighting",
      cameraAesthetic:
        "natural unstaged food photograph, modern minimal styling, homemade-feeling, no studio look, no heavy props",
      heroElementGuidance:
        "Keep styling minimal — the dish is the hero. Optionally a single ingredient or a clean linen napkin placed loosely beside the bowl/plate.",
      defaultAngles: {
        flat: "from a high overhead angle looking down (about 80°, slightly tilted not strict 90°)",
        mixed:
          "from a high overhead angle looking down (about 80°, slightly tilted)",
        layered: "from a 30° three-quarter angle so the layers are visible",
        tall: "from a 45° eye-level angle showing the full height",
        liquid: "from a 30° three-quarter angle so the liquid surface shines",
      },
    },
  },

  // 2. PATISSERIE WARM — wie Bienes Sweet-Pack, polaroid-feel, sweet
  //    Passt fuer: Backen, Patisserie, Desserts, suesse Snacks
  {
    id: "patisserie-warm",
    label: "Patisserie Warm",
    description:
      "Warm pale wood, soft morning light, polaroid-feel, sweet styling — wie Bienes Backwelt.",
    keywords: [
      "backen",
      "baking",
      "dessert",
      "kuchen",
      "cookies",
      "muffins",
      "cake",
      "torte",
      "patisserie",
      "süß",
      "suess",
      "schoko",
      "vanille",
    ],
    style: {
      lightingOptions: [
        "soft warm morning light from a side window with gentle long shadows",
        "warm diffused daylight from above, honey-toned with soft glow",
        "late afternoon amber light from the right with soft highlights",
        "soft window light with warm cream tones across the surface",
        "morning light streaming softly from the left, sweet polaroid feel",
      ],
      sceneOptions: [
        "a pale weathered wooden baker's table with soft natural texture",
        "a cream-colored matte surface with subtle vintage warmth",
        "a soft pale-wood countertop near a window with morning light",
        "a warm light surface with a folded linen napkin to one side",
        "a pale ceramic tile surface with soft amber tones",
      ],
      styleSuffix: "",
      negativeAddition:
        "no parsley or savory herbs, no cast-iron pan, no industrial surfaces, no harsh studio lighting, no cool blue tones",
      cameraAesthetic:
        "natural unstaged food photograph, homemade-feeling, sweet polaroid character, no studio look",
      heroElementGuidance:
        "A complete English phrase describing the scene: 'a small ceramic bowl of the main ingredient (powdered sugar, cocoa, berries, or vanilla pods) sits softly in the background, behind the dish'. Sweet styling element.",
      defaultAngles: {
        flat: "from a high overhead angle looking down (about 75°, slightly tilted)",
        mixed: "from a high overhead angle looking down (about 75°, slightly tilted)",
        layered:
          "from a 30° three-quarter angle so the layers of the dessert are clearly visible",
        tall: "from a 45° eye-level angle that shows the full height of the cake or stack",
        liquid: "from a 30° three-quarter angle so the surface glaze shines",
      },
    },
  },

  // 3. VITAL FRESH — Healthy Bowls, Veggies, bright greens
  //    Passt fuer: Vegan, Vegetarian, Bowls, Salads, Volumen-Mahlzeiten
  {
    id: "vital-fresh",
    label: "Vital Fresh",
    description:
      "Bright clean light, fresh greens + herbs as styling, modern healthy bowls.",
    keywords: [
      "vegan",
      "vegetarian",
      "veggie",
      "salad",
      "salat",
      "bowl",
      "smoothie",
      "green",
      "vital",
      "volumen",
      "gemüse",
      "gemuese",
      "frisch",
    ],
    style: {
      lightingOptions: [
        "bright clean overhead daylight with minimal shadows",
        "fresh natural light from a wide window, vibrant and unfussy",
        "cool diffused daylight with crisp shadows on the surface",
        "bright morning light from above, fresh and energetic",
        "clean editorial daylight with subtle warm undertones",
      ],
      sceneOptions: [
        "a smooth pale-grey stone countertop with subtle natural texture",
        "a clean matte cream surface with a folded sage linen runner",
        "a soft warm-white kitchen counter near a window",
        "a light stone surface with a single fresh herb sprig nearby",
        "a clean modern surface with a hint of green plant softly out of focus behind",
      ],
      styleSuffix: "",
      negativeAddition:
        "no rustic wooden table, no dark vintage props, no heavy cookbook styling, no dim lighting, no industrial surfaces",
      cameraAesthetic:
        "natural unstaged food photograph, fresh modern styling, vibrant and clean, no studio look",
      heroElementGuidance:
        "A complete English phrase: 'fresh herbs, a halved citrus, or a small handful of greens placed loosely beside the bowl as a styling element'. Fresh, vibrant, never wilted.",
      defaultAngles: {
        flat: "from a high overhead angle looking down (about 85°, almost flat-lay)",
        mixed: "from a high overhead angle looking down (about 80°, slightly tilted)",
        layered: "from a 30° three-quarter angle so layers and toppings are visible",
        tall: "from a 45° eye-level angle showing the full vertical structure",
        liquid:
          "from a 30° three-quarter angle so the smoothie or soup surface catches light",
      },
    },
  },

  // 4. COOKBOOK RUSTIC — Jan's klassisches Magazine-Cookbook
  //    Passt fuer: Hausmannskost, traditionelle Rezepte, Sonntagsbraten,
  //    cosy comfort food
  {
    id: "cookbook-rustic",
    label: "Cookbook Rustic",
    description:
      "Warm walnut wood, golden amber light, classic cookbook magazine feel.",
    keywords: [
      "klassisch",
      "traditional",
      "hausmannskost",
      "comfort",
      "braten",
      "stew",
      "eintopf",
      "rustic",
      "cosy",
      "winter",
      "ofen",
      "schmoren",
    ],
    style: {
      lightingOptions: [
        "warm morning light streaming from the left with soft long shadows",
        "golden afternoon light from a side window with gentle warmth",
        "warm diffused daylight from above, honey-toned",
        "warm backlight glowing through a kitchen window, amber",
        "late afternoon amber light from the right with soft highlights",
      ],
      sceneOptions: [
        "a warm walnut wooden cutting board on a soft linen runner",
        "a weathered pale-oak countertop with a folded kitchen towel",
        "a warm rustic wooden table with soft stoneware suggested behind",
        "a warm farmhouse surface with a small leafy potted herb softly out of focus",
        "a warm-toned wooden kitchen counter near a window",
      ],
      styleSuffix: "cookbook-style modern food photograph",
      negativeAddition: "",
      cameraAesthetic:
        "Shot on Leica SL2 50mm lens at f/5.6, dish in sharp focus, background softly out of focus, cookbook-style instagram food photograph, homemade imperfect character",
      heroElementGuidance:
        "Small styling elements — a folded linen kitchen towel, fresh herbs in a tiny ceramic bowl, or a single ingredient (whole nuts, berries) loosely scattered beside the dish.",
      defaultAngles: {
        flat: "from a 30° three-quarter angle showing the surface and dish together",
        mixed: "from a 30° three-quarter angle, classic cookbook composition",
        layered: "from a 30° three-quarter angle so the layers read clearly",
        tall: "from a 45° eye-level angle showing the full presentation",
        liquid: "from a 30° three-quarter angle for surface shine",
      },
    },
  },

  // 5. EDITORIAL COOL — moderne Magazine, cleaner als modern-minimal,
  //    architektonischer Stil
  //    Passt fuer: High-end Food, Restaurant-style, Plating-fokussiert
  {
    id: "editorial-cool",
    label: "Editorial Cool",
    description:
      "White marble, slate, cool diffused daylight, restaurant-magazine feel.",
    keywords: [
      "editorial",
      "magazine",
      "restaurant",
      "fine dining",
      "gourmet",
      "plating",
      "premium",
      "modern european",
      "minimalist",
    ],
    style: {
      lightingOptions: [
        "cool diffused daylight from a wide window, neutral white balance",
        "soft overhead daylight with crisp shadows, editorial feel",
        "clean bright daylight from above with minimal warm tones",
        "soft natural light with cool undertones from a north-facing window",
        "bright clean daylight with sharp shadow definition",
      ],
      sceneOptions: [
        "a polished white marble surface with subtle grey veining",
        "a smooth pale slate countertop with cool undertones",
        "a clean concrete-look matte surface, modern editorial",
        "a soft cool-cream marble with minimal texture",
        "a brushed stone surface with crisp natural daylight",
      ],
      styleSuffix: "",
      negativeAddition:
        "no rustic wood, no warm vintage props, no dim moody lighting, no busy backgrounds",
      cameraAesthetic:
        "editorial food photograph, modern restaurant plating aesthetic, clean and intentional, no homemade-feeling",
      heroElementGuidance:
        "Minimal styling — a single architectural element like a folded napkin, an elegant utensil, or geometric ingredient placement. Plating-focused, never cluttered.",
      defaultAngles: {
        flat: "from a high overhead angle looking down (about 80°, slightly tilted)",
        mixed: "from a high overhead angle, editorial flat-lay composition",
        layered:
          "from a 25° three-quarter angle showing layers with architectural clarity",
        tall: "from a 35° eye-level angle showing height and structure",
        liquid: "from a 25° three-quarter angle, modern restaurant plating view",
      },
    },
  },

  // 6. DARK MOODY — Schokoladen-Desserts, Tiramisu, Winter-Comfort
  //    Passt fuer: dark food (Schoko, Kaffee, Wein), moody atmosphere
  {
    id: "dark-moody",
    label: "Dark Moody",
    description:
      "Dark slate, dramatic side-light, moody atmospheric food photography.",
    keywords: [
      "schokolade",
      "schoko",
      "chocolate",
      "tiramisu",
      "kaffee",
      "coffee",
      "dunkel",
      "dark",
      "moody",
      "espresso",
      "ganache",
    ],
    style: {
      lightingOptions: [
        "dramatic side-light from the left with deep shadows, moody atmosphere",
        "warm low-key window light with soft falloff into darkness",
        "single-source warm light from the side, atmospheric and intimate",
        "soft golden hour light raking across the dish from one side",
        "warm directional light with rich shadow contrast",
      ],
      sceneOptions: [
        "a dark slate surface with subtle texture",
        "a deep walnut wooden surface with warm undertones",
        "a black ceramic surface catching warm reflective highlights",
        "a dark stone countertop with intentional shadow play",
        "a deeply-toned wooden table with soft amber glow",
      ],
      styleSuffix: "",
      negativeAddition:
        "no bright overhead lighting, no clinical white surfaces, no flat overhead daylight, no harsh fluorescent",
      cameraAesthetic:
        "moody atmospheric food photograph, intentional dark styling, intimate and rich, cinematic feel",
      heroElementGuidance:
        "Atmospheric styling — a small lit candle softly out of focus behind, scattered cocoa powder or coffee beans, a vintage spoon. Rich and intimate, never cluttered.",
      defaultAngles: {
        flat: "from a 30° three-quarter angle, moody overhead view",
        mixed: "from a 30° three-quarter angle showing dish and atmosphere",
        layered: "from a 25° three-quarter angle so the layers catch the side-light",
        tall: "from a 35° eye-level angle showing height with dramatic shadows",
        liquid: "from a 25° three-quarter angle so the surface gleams in the side-light",
      },
    },
  },
];

export function getStyleTemplate(id: string): BrandStyleTemplate | undefined {
  return BRAND_STYLE_TEMPLATES.find((t) => t.id === id);
}

// Deterministic Fallback wenn Gemini Flash fail't oder kein klares
// Template matched: simple keyword-scoring auf Bio + Caption-Text.
export function suggestTemplateByKeywords(
  text: string
): BrandStyleTemplate {
  const normalized = text.toLowerCase();
  let bestScore = 0;
  let best: BrandStyleTemplate = BRAND_STYLE_TEMPLATES[0]; // modern-minimal als safe Default
  for (const template of BRAND_STYLE_TEMPLATES) {
    const score = template.keywords.reduce(
      (sum, kw) => sum + (normalized.includes(kw.toLowerCase()) ? 1 : 0),
      0
    );
    if (score > bestScore) {
      bestScore = score;
      best = template;
    }
  }
  return best;
}
