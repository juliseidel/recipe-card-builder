import { callGeminiMultimodal } from "./gemini";
import type { ExtractedFrame } from "./extract-video-frames";

// Multi-Frame strukturierte Vision-Description fuer den text-only Hero-Path.
//
// V2 (2026-05-12): Schema deutlich erweitert auf 16 Felder, damit Flux 2 Pro
// genug Prompt-Substanz hat. Lessons aus V1-Test:
//   - "muffin tin" aus Spec vs "ceramic plate" aus Vision = Konflikt → Vision
//     muss das Vessel ALLEINE bestimmen, keine Spec-Konkurrenz
//   - Counter war zu generisch → Surface-Material + Farbton + Textur einzeln
//   - Wärme-Mismatch zum Reel → Licht-Richtung + Wärme-Level aus Vision
//   - Garnish wurde übersehen → eigenes präzises Feld
//
// Ziel: Flux soll aus dieser Description ein Bild rendern, das auch ohne
// Reference-Image visuell stimmig zum Original-Reel-Look ist — gleicher
// Vessel-Typ, gleiche Plating-Anordnung, gleiche Schichten/Farben, gleiche
// Licht-Stimmung. Brand-DNA (Counter-Stil, Hero-Element) bleibt darüber
// liegen für den eigenen Look.

export type StructuredDishDescription = {
  /** Grundform / Geometrie. Beispiel: "Five small circular frozen dessert
   *  cups in a loose row, each about 4cm wide and 5cm tall." */
  form: string;
  /** Konkrete dominante Farbtöne, nicht abstrakt. */
  dominantColors: string;
  /** Spezifische dish-Farbe(n) mit Nuancen. Beispiel: "Bright magenta-pink
   *  top fading to deeper red at the edges, creamy off-white pure coconut base." */
  exactDishColors: string;
  /** Vessel-Material (ceramic / stoneware / glass / wood / metal / none). */
  vesselMaterial: string;
  /** Vessel-Form + Farbe + visuelle Eigenschaften, ein Satz. */
  vesselDescription: string;
  /** Vessel-Größe relativ zum Gericht. Beispiel: "The plate extends about
   *  3cm beyond the cups on each side." Leer wenn nicht ableitbar. */
  vesselSize: string;
  /** Aufbau / Schichten von unten nach oben. Leer wenn nicht relevant. */
  layering: string;
  /** Toppings + Garnitur, einzeln aufgezählt mit Anordnung. Beispiel:
   *  "Three whole strawberry slices fanned on top, scattered chia seeds,
   *  a sprig of mint to one side." 'None visible' wenn nichts. */
  toppings: string;
  /** Texturen + Oberflächen-Qualität. */
  textures: string;
  /** Anzahl Komponenten wenn relevant. Format: "five [items]". */
  componentCount: string;
  /** Sichtbarer Schnitt / Querschnitt? Beispiel: "Cross-section visible
   *  showing clean layer separation." Leer wenn nicht. */
  cuttingPlaneVisible: string;
  /** Licht-Richtung. Beispiele: "from the left", "from above", "from
   *  behind", "from the right side". */
  lightDirection: string;
  /** Licht-Wärme: "very warm" | "warm" | "neutral" | "cool". */
  lightWarmth: string;
  /** KOMPLETTE englische Lighting-Beschreibung, ready to use im Flux-Prompt.
   *  Vision liefert das direkt — KEIN Mapping mehr auf ein fixes Brand-Set
   *  (das hat in V2 zu falscher Wärme geführt: Reel war neutral, aber Bienes
   *  Brand-DNA hatte nur warm-amber-Optionen → Output war zu honey-toned).
   *  Beispiele:
   *    "bright natural daylight from above with soft even illumination, neutral white balance"
   *    "warm morning light streaming from the left with golden honey tones"
   *    "cool diffused daylight from a north-facing window, neutral colors" */
  lightingDescription: string;
  /** Color-Tone-Word für den finalen Prompt-Tail. Maßgeschneidert für das
   *  Reel-Aussehen, NICHT aus dem festen ["warm golden"|"cool muted"|...]
   *  Set abgeleitet (das hat in V2 immer "vibrant warm" gegeben, auch wenn
   *  Vision-Wärme neutral war). Beispiele:
   *    "bright natural"
   *    "vibrant fresh and true to life"
   *    "warm golden"
   *    "cool clean"
   *    "rich amber"
   *  1-3 Worte, English. */
  colorToneWord: string;
  /** Counter / Surface-Material im Reel. Hint nur, Brand-DNA kann das
   *  überschreiben. */
  surfaceMaterial: string;
  /** Spatial Arrangement — wie sind mehrere Komponenten angeordnet?
   *  Beispiel: "Cups arranged in a loose triangular cluster, slightly
   *  off-center to the right." Leer wenn nur 1 Komponente. */
  spatialArrangement: string;
  /** Fließende englische Cookbook-Beschreibung des FERTIGEN Gerichts,
   *  8-10 dichte Sätze. Integriert alle obigen Aspekte. Cookbook-Stil,
   *  kein "I see" oder "The image shows". Diese Beschreibung fließt 1:1
   *  in den Flux-Prompt — sie ist der zentrale Anker für die Generation. */
  compose: string;
};

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    form: {
      type: "string",
      description:
        "Grundform/Geometrie des fertigen Gerichts in einem englischen Satz mit konkreten Maß-Angaben wenn ableitbar. Beispiele: 'Five small circular frozen dessert cups in a loose row, each about 4cm wide', 'A circular layered cake about 18cm in diameter, 6cm tall'.",
    },
    dominantColors: {
      type: "string",
      description:
        "Dominante Farben des Gerichts auf Englisch, knapp und konkret. Maximal 2 Sätze. Nicht abstrakt ('warm') sondern konkret ('bright pink-red top, creamy off-white bottom').",
    },
    exactDishColors: {
      type: "string",
      description:
        "PRÄZISE Farbnuancen mit Adjektiven wie magenta-pink, charcoal-grey, golden-amber, deep-burgundy. Englisch, 1-2 Sätze. Wenn das Gericht aus mehreren Komponenten besteht, nenne sie einzeln.",
    },
    vesselMaterial: {
      type: "string",
      description:
        "Material des Servier-Gefäßes: ceramic, stoneware, glass, wood, metal, none. WICHTIG: das SERVIER-Gefäß, nicht die Backform aus der Zubereitung. Wenn das Gericht ohne Vessel auf der Surface liegt: 'none'.",
    },
    vesselDescription: {
      type: "string",
      description:
        "Englische Beschreibung des Servier-Gefäßes in einem Satz: Form + Farbe + visuelle Eigenschaften. Beispiele: 'a dark charcoal-grey matte ceramic plate with a slightly raised uneven rim', 'small clear smooth glass cups, no pattern', 'a deep rustic stoneware bowl with subtle blue glaze'.",
    },
    vesselSize: {
      type: "string",
      description:
        "Größe des Vessels relativ zum Gericht oder Maß. Englisch, knapp. Leer wenn nicht ableitbar.",
    },
    layering: {
      type: "string",
      description:
        "Schichten/Aufbau von unten nach oben in einem Satz auf Englisch — nur für Gerichte mit klaren Schichten (Cups, Lasagne, Parfaits, Torten). Bei Bowls/Salaten: 'No layering, ingredients mixed together'. Bei einfachen Gerichten: leer.",
    },
    toppings: {
      type: "string",
      description:
        "Toppings + Garnitur EINZELN aufgezählt mit Anordnung. Englisch. Beispiele: 'Three whole strawberry slices fanned on top, scattered chia seeds, a sprig of mint to one side', 'Drizzled chocolate sauce and toasted slivered almonds'. 'None visible' wenn nichts.",
    },
    textures: {
      type: "string",
      description:
        "Sichtbare Texturen + Oberflächen-Qualitäten auf Englisch. Beispiele: 'Frozen with slight frost, glossy seam where layers meet', 'Crispy golden crust, soft creamy interior visible at edges'.",
    },
    componentCount: {
      type: "string",
      description:
        "Anzahl Komponenten wenn relevant. Format: 'five cups', 'four pancakes', 'twelve cookies'. Leer wenn nur ein Stück (Kuchen, Auflauf).",
    },
    cuttingPlaneVisible: {
      type: "string",
      description:
        "Englisch beschreiben wenn ein Schnitt/Querschnitt zu sehen ist (clean layer separation, raw cut edges). Leer wenn nicht sichtbar.",
    },
    lightDirection: {
      type: "string",
      description:
        "Aus welcher Richtung kommt das Licht im Bild? 'from the left', 'from the right', 'from above', 'from behind', 'from the right and above', 'diffuse from multiple directions'.",
    },
    lightWarmth: {
      type: "string",
      enum: ["very warm", "warm", "neutral", "cool"],
      description:
        "Wärme-Charakteristik des Lichts. 'very warm' = goldene Stunde / amber. 'warm' = morgendliches gelbes Licht. 'neutral' = mittags / ausgeglichen. 'cool' = bedeckter Tag / bläulich.",
    },
    lightingDescription: {
      type: "string",
      description:
        "KOMPLETTE englische Lighting-Phrase, fertig für den Flux-Prompt. Maßgeschneidert für DIESES Reel. Beispiele: 'bright natural daylight from above with soft even illumination, neutral white balance, true colors', 'warm morning light streaming from the left with long gentle shadows and golden honey tones', 'cool diffused daylight from a side window, neutral white balance, clean editorial feel'. KEINE generischen Phrases — beschreibe was du WIRKLICH im Reel siehst.",
    },
    colorToneWord: {
      type: "string",
      description:
        "1-3 englische Adjektive für den Farbton des Bildes. Maßgeschneidert für das Reel-Aussehen. Beispiele: 'bright natural', 'vibrant fresh and true to life', 'warm golden', 'cool clean', 'rich amber', 'soft pastel'. KEINE Generic-Defaults — wenn das Reel hell/neutral aussieht: 'bright natural'. Wenn warm-golden: 'warm golden'. Wenn kühl: 'cool clean'.",
    },
    surfaceMaterial: {
      type: "string",
      description:
        "Material der Surface/des Counters im Reel auf Englisch: 'pale grey concrete', 'warm walnut wood', 'white marble', 'dark slate', 'matte cream stone'. Leer wenn keine Surface sichtbar (Closeup auf Vessel).",
    },
    spatialArrangement: {
      type: "string",
      description:
        "Englisch beschreiben wie mehrere Komponenten angeordnet sind: 'Cups arranged in a loose triangular cluster slightly off-center', 'pancakes stacked vertically with maple syrup running down', 'salad ingredients tossed loosely'. Leer wenn nur 1 Komponente.",
    },
    compose: {
      type: "string",
      description:
        "Fließende englische Cookbook-Beschreibung des FERTIGEN Gerichts als 8-10 dichte Sätze. Integriert ALLE obigen Aspekte: form + colors + vessel + layering + toppings + textures + count + arrangement. Diese Beschreibung fließt 1:1 in den Flux-Prompt. Konzentriert, kein 'I see' oder 'The image shows'.",
    },
  },
  required: [
    "form",
    "dominantColors",
    "exactDishColors",
    "vesselMaterial",
    "vesselDescription",
    "vesselSize",
    "layering",
    "toppings",
    "textures",
    "componentCount",
    "cuttingPlaneVisible",
    "lightDirection",
    "lightWarmth",
    "lightingDescription",
    "colorToneWord",
    "surfaceMaterial",
    "spatialArrangement",
    "compose",
  ],
};

const SYSTEM_INSTRUCTION = `Du bekommst mehrere Frames aus einem Cooking-Reel und beschreibst das FERTIG ANGERICHTETE GERICHT strukturiert auf Englisch.

Ziel: deine Beschreibung wird DIREKT an Flux 2 Pro gegeben. Flux soll daraus — ohne das Reel selbst zu sehen — ein neues Bild rendern, das visuell stimmig zum Original-Reel ist. Du bist die einzige Informationsquelle über das Gericht.

KRITISCH wichtig:
- Fokussiere auf Frames mit dem FERTIG angerichteten Gericht (typically gegen Ende). Ignoriere Zubereitungs-Stadien (Schneiden, Mixen, In-Form-Füllen).
- Beschreibe das SERVIER-Vessel, nicht das Preparation-Vessel. Wenn Cups in Förmchen gefroren werden und dann auf einen Teller kommen → der Teller ist das Vessel.
- Sei MULTI-FRAME-KONSISTENT: was über alle Frames stabil ist, nicht ein zufälliger Snapshot.
- Sei KONKRET: nenne Farben mit Nuancen (magenta-pink, charcoal-grey), Maße in cm wenn ableitbar, Plating-Details einzeln.
- Cookbook-Stil. Kein "I see" oder "The image shows" oder "In the video". Direkt beschreibend.

Was du IGNORIEREN musst:
- Text-Overlays, POV-Untertitel, Recipe-Step-Banner, Sticker, Watermarks
- Hände, Finger, Arme, Personen — keine Body-Parts beschreiben, sie kommen ins neue Bild NICHT rein
- Kamera-Bewegung, Schnitte zwischen Frames
- Wenn das Reel-Cover Werbe-Elemente hat, ignoriere diese komplett

Was du ZUSÄTZLICH zum Gericht beschreibst (als Mood-Hint, nicht als Hard-Constraint):
- Licht-Richtung im Reel
- Licht-Wärme im Reel
- Surface/Counter-Material im Reel
Diese Felder helfen dem nachgelagerten System einen kohärenten Look zu wählen — der finale Hintergrund kommt aber von der Brand-DNA, nicht von dir.

Antworte AUSSCHLIESSLICH im JSON-Schema mit ALLEN Feldern befüllt.`;

export type DescribeDishOptions = {
  /** 5-10 Frames mit dem fertig angerichteten Gericht. */
  frames: ExtractedFrame[];
  recipeTitle: string;
  /** Optionaler Caption-Auszug für Kontext. */
  caption?: string;
};

export async function describeDishStructured(
  opts: DescribeDishOptions
): Promise<StructuredDishDescription | null> {
  if (opts.frames.length === 0) return null;

  const userText = [
    `Recipe title: ${opts.recipeTitle}`,
    "",
    opts.caption
      ? `Caption excerpt (context only, do not copy from this):\n${opts.caption.slice(0, 800)}`
      : "",
    "",
    `${opts.frames.length} frame(s) from the cooking reel follow, in time order. Focus on frames showing the finished plated dish:`,
  ]
    .filter(Boolean)
    .join("\n");

  const parts: Array<
    { text: string } | { inlineData: { mimeType: string; data: string } }
  > = [{ text: userText }];
  for (const frame of opts.frames) {
    const base64 = frame.dataUri.split(",")[1] ?? "";
    parts.push({
      inlineData: { mimeType: "image/jpeg", data: base64 },
    });
  }

  try {
    const result = await callGeminiMultimodal<StructuredDishDescription>({
      parts,
      schema: RESPONSE_SCHEMA,
      systemInstruction: SYSTEM_INSTRUCTION,
      model: "pro",
      temperature: 0.3,
      maxOutputTokens: 4096,
      retries: 1,
    });

    return {
      form: (result.form ?? "").trim(),
      dominantColors: (result.dominantColors ?? "").trim(),
      exactDishColors: (result.exactDishColors ?? "").trim(),
      vesselMaterial: (result.vesselMaterial ?? "").trim(),
      vesselDescription: (result.vesselDescription ?? "").trim(),
      vesselSize: (result.vesselSize ?? "").trim(),
      layering: (result.layering ?? "").trim(),
      toppings: (result.toppings ?? "").trim(),
      textures: (result.textures ?? "").trim(),
      componentCount: (result.componentCount ?? "").trim(),
      cuttingPlaneVisible: (result.cuttingPlaneVisible ?? "").trim(),
      lightDirection: (result.lightDirection ?? "").trim(),
      lightWarmth: (result.lightWarmth ?? "").trim(),
      lightingDescription: (result.lightingDescription ?? "").trim(),
      colorToneWord: (result.colorToneWord ?? "").trim(),
      surfaceMaterial: (result.surfaceMaterial ?? "").trim(),
      spatialArrangement: (result.spatialArrangement ?? "").trim(),
      compose: (result.compose ?? "").trim(),
    };
  } catch (err) {
    console.warn(
      "[describe-dish-structured] failed:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

// Map Vision-Light-Direction + Brand-Lighting-Options → die passendste
// Brand-Option. Bienes 5 Optionen sind alle warm — wir matchen primär
// auf RICHTUNG (left/right/above/back). Wenn keine matched, nimm Index 0
// (default morning light).
export function pickLightingOption(
  visionDirection: string,
  brandLightingOptions: string[]
): string {
  if (brandLightingOptions.length === 0) {
    return "warm morning light streaming from the left with soft shadows";
  }
  const dir = visionDirection.toLowerCase();
  const scored = brandLightingOptions.map((opt) => {
    const o = opt.toLowerCase();
    let score = 0;
    if (dir.includes("left") && o.includes("left")) score += 3;
    if (dir.includes("right") && o.includes("right")) score += 3;
    if (dir.includes("above") && o.includes("above")) score += 3;
    if (dir.includes("behind") && (o.includes("backlight") || o.includes("behind")))
      score += 3;
    if (dir.includes("diffuse") && (o.includes("diffused") || o.includes("soft")))
      score += 2;
    return { opt, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0].score > 0 ? scored[0].opt : brandLightingOptions[0];
}
