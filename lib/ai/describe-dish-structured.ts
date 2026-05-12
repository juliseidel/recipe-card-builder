import { callGeminiMultimodal } from "./gemini";
import type { ExtractedFrame } from "./extract-video-frames";

// V4: Schema entschlackt + Konsistenz-Pflicht.
//
// V3-Problem: 16 Felder mit teilweise überlappender Bedeutung
// (dominantColors + exactDishColors + compose alle reden über Farbe).
// Gemini variiert Wortwahl pro Feld — "red" hier, "magenta-pink" dort —
// Flux sieht alle drei Signale und mischt zu einem Mittelwert.
//
// V4-Lösung: ~10 Felder, keine Überlappung, System-Instruction zwingt
// Konsistenz. Im finalen Flux-Prompt wird NUR `compose` genutzt — die
// Einzel-Felder dienen Gemini als Strukturierungs-Stützen, kommen aber
// NICHT in den Prompt (verhindert doppelte Farb-Signals).

export type StructuredDishDescription = {
  /** EINE präzise englische Farb-Phrase mit Haupt-Ton + max. 1 Akzent.
   *  Beispiele:
   *  - "vibrant fuchsia-pink with subtle hints of darker red pulp"
   *  - "deep amber-brown with golden highlights"
   *  - "pale cream-white with no other color"
   *  Diese Phrase muss in compose 1:1 wiederverwendet werden — keine
   *  Variation. */
  dishColorPhrase: string;
  /** Vessel-Material (ceramic / stoneware / glass / wood / metal / none). */
  vesselMaterial: string;
  /** Vessel-Form + Farbe + visuelle Eigenschaften in einem Satz. */
  vesselDescription: string;
  /** Aufbau / Schichten von unten nach oben. Leer wenn nicht relevant. */
  layering: string;
  /** Toppings + Garnitur EINZELN aufgezählt. 'None visible' wenn nichts. */
  toppings: string;
  /** Texturen + Oberflächen-Qualität. */
  textures: string;
  /** Anzahl Komponenten wenn relevant. Format: "five [items]". */
  componentCount: string;
  /** Spatial Arrangement bei mehreren Komponenten. Leer bei einem Stück. */
  spatialArrangement: string;
  /** KOMPLETTE englische Lighting-Phrase, fertig für den Flux-Prompt. */
  lightingDescription: string;
  /** 1-3 Adjektive für den Farbton des Bildes, fertig für Prompt-Tail. */
  colorToneWord: string;
  /** Compose-Feld — die EINZIGE Quelle die in den Flux-Prompt fliesst.
   *  8-12 dichte Sätze, alle obigen Aspekte konsistent integriert.
   *  KRITISCH: die Farbe aus `dishColorPhrase` MUSS hier 1:1 wieder
   *  auftauchen — keine andere Farbwortwahl. */
  compose: string;
};

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    dishColorPhrase: {
      type: "string",
      description:
        "EINE präzise englische Farb-Phrase. Format: '[base color] [with subtle hints of [accent color]]'. Beispiele: 'vibrant fuchsia-pink with subtle hints of darker red pulp', 'deep amber-brown with golden highlights', 'creamy off-white with no other color'. Verwende möglichst spezifische Farbwörter: fuchsia-pink, magenta-pink, cherry-red, burgundy, amber, honey, ivory, charcoal-grey. Diese Phrase WIRD WORTGLEICH in compose vorkommen.",
    },
    vesselMaterial: {
      type: "string",
      description:
        "Material des Servier-Gefässes: ceramic, stoneware, glass, wood, metal, none. SERVIER-Gefäss, nicht Preparation-Vessel. Wenn das Gericht ohne Vessel auf der Surface liegt: 'none'.",
    },
    vesselDescription: {
      type: "string",
      description:
        "Englische Beschreibung des Servier-Gefässes in einem Satz: Form + Farbe + visuelle Eigenschaften. Beispiele: 'a large matte charcoal-grey stoneware plate with a slightly raised, subtly uneven rim, about 25cm diameter', 'small clear smooth glass cups, no pattern, about 4cm wide'.",
    },
    layering: {
      type: "string",
      description:
        "Schichten/Aufbau von unten nach oben in einem Satz auf Englisch. Bei klaren Schichten (Cups, Lasagne, Parfaits): nennen. Bei Bowls/Salaten: 'No layering, ingredients mixed together'. Bei einfachen Gerichten: leer.",
    },
    toppings: {
      type: "string",
      description:
        "Toppings + Garnitur EINZELN aufgezählt mit Anordnung. Beispiele: 'three whole strawberry slices fanned on top, scattered chia seeds', 'drizzled chocolate sauce and toasted slivered almonds'. 'None visible' wenn nichts.",
    },
    textures: {
      type: "string",
      description:
        "Sichtbare Texturen + Oberflächen-Qualitäten auf Englisch. Beispiele: 'frozen with slight frost, glossy seam where layers meet', 'crispy golden crust, soft creamy interior visible at edges'.",
    },
    componentCount: {
      type: "string",
      description:
        "Anzahl Komponenten wenn relevant. Format: 'five cups', 'four pancakes'. Leer wenn nur ein Stück (Kuchen, Auflauf).",
    },
    spatialArrangement: {
      type: "string",
      description:
        "Englisch beschreiben wie mehrere Komponenten angeordnet sind. Beispiele: 'arranged in a loose row across the plate', 'stacked in a small pile with two cut in half showing cross-section', 'tossed loosely in the bowl'. Leer wenn nur 1 Komponente.",
    },
    lightingDescription: {
      type: "string",
      description:
        "KOMPLETTE englische Lighting-Phrase, fertig für den Flux-Prompt. Maßgeschneidert für DIESES Reel. Beispiele: 'bright natural daylight from a side window with neutral white balance and true colors', 'warm morning light streaming from the left with golden honey tones', 'cool diffused daylight from above with clean editorial feel'.",
    },
    colorToneWord: {
      type: "string",
      description:
        "1-3 englische Adjektive für den GESAMT-Farbton des Bildes (Stimmung, nicht das Gericht). Beispiele: 'bright natural', 'warm golden', 'cool clean', 'rich amber', 'soft pastel'. KEINE Generic-Defaults — wenn das Reel hell/neutral aussieht: 'bright natural'. Wenn warm-golden: 'warm golden'.",
    },
    compose: {
      type: "string",
      description:
        "Fließende englische Cookbook-Beschreibung des FERTIGEN Gerichts als 8-12 dichte Sätze. KRITISCH-WICHTIG: die Farb-Phrase aus dishColorPhrase MUSS hier wortgleich auftauchen — keine andere Farbwortwahl. Wenn dishColorPhrase 'vibrant fuchsia-pink' sagt, dann darfst du HIER NICHT 'red' oder 'magenta' schreiben — nur 'vibrant fuchsia-pink'. Diese Compose-Phrase ist die einzige Quelle für den Flux-Prompt.",
    },
  },
  required: [
    "dishColorPhrase",
    "vesselMaterial",
    "vesselDescription",
    "layering",
    "toppings",
    "textures",
    "componentCount",
    "spatialArrangement",
    "lightingDescription",
    "colorToneWord",
    "compose",
  ],
};

const SYSTEM_INSTRUCTION = `Du bekommst mehrere Frames aus einem Cooking-Reel und beschreibst das FERTIG ANGERICHTETE GERICHT strukturiert auf Englisch.

Ziel: deine Beschreibung wird DIREKT an Flux 2 Pro gegeben. Flux soll daraus — ohne das Reel selbst zu sehen — ein neues Bild rendern, das visuell stimmig zum Original-Reel ist.

KONSISTENZ-PFLICHT (kritisch):
Du wählst EIN Haupt-Farbwort für das Gericht (z.B. 'vibrant fuchsia-pink', 'deep amber-brown'). Dieses Wort MUSST du in dishColorPhrase UND in compose IDENTISCH verwenden. KEINE Variation zwischen den Feldern. Wenn das Gericht fuchsia-pink ist, beschreibe es überall als fuchsia-pink — nicht in einem Feld als 'red' und im anderen als 'pink'. Das ist die häufigste Fehlerquelle: leicht unterschiedliche Wortwahl in mehreren Feldern → das Bild-Modell mischt die Farbtöne zu einem Mittelwert. Vermeide das durch identische Wortwahl.

Bei mehreren Farb-Aspekten: ein Haupt-Ton + max. EIN Akzent.
Format: '[hauptton] with subtle hints of [akzent]'
NICHT: '[hauptton] and [akzent]' (das gibt gleichwertige Signale).

FOKUS:
- Beschreibe das FERTIG ANGERICHTETE Gericht (Frames gegen Ende des Reels).
- Beschreibe das SERVIER-Vessel, nicht das Preparation-Vessel.
- Sei MULTI-FRAME-KONSISTENT: was über alle Frames stabil ist, nicht ein zufälliger Snapshot.

IGNORIEREN (kommen ins neue Bild NICHT rein):
- Text-Overlays, POV-Untertitel, Recipe-Step-Banner, Sticker, Watermarks
- Hände, Finger, Arme, Personen, Körperteile
- Kamera-Bewegung, Schnitte zwischen Frames

LIGHTING:
- Beschreibe was du WIRKLICH im Reel siehst — Direction + Wärme + Atmosphäre.
- KEINE generischen 'warm golden' Defaults wenn das Reel hell-neutral ist.
- Wenn neutral: 'bright natural daylight, neutral white balance, true colors'.
- Wenn warm: 'warm morning light with golden tones'.
- Wenn kühl: 'cool diffused daylight, clean editorial feel'.

Antworte AUSSCHLIESSLICH im JSON-Schema mit ALLEN Feldern befüllt.`;

export type DescribeDishOptions = {
  frames: ExtractedFrame[];
  recipeTitle: string;
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
      ? `Caption excerpt (context only):\n${opts.caption.slice(0, 800)}`
      : "",
    "",
    `${opts.frames.length} frame(s) from the cooking reel follow, in time order:`,
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
      dishColorPhrase: (result.dishColorPhrase ?? "").trim(),
      vesselMaterial: (result.vesselMaterial ?? "").trim(),
      vesselDescription: (result.vesselDescription ?? "").trim(),
      layering: (result.layering ?? "").trim(),
      toppings: (result.toppings ?? "").trim(),
      textures: (result.textures ?? "").trim(),
      componentCount: (result.componentCount ?? "").trim(),
      spatialArrangement: (result.spatialArrangement ?? "").trim(),
      lightingDescription: (result.lightingDescription ?? "").trim(),
      colorToneWord: (result.colorToneWord ?? "").trim(),
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
