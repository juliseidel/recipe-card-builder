import { callGeminiMultimodal } from "./gemini";
import type { ExtractedFrame } from "./extract-video-frames";

// Multi-Frame strukturierte Vision-Description fuer den text-only Hero-Path.
//
// Ziel: aus 3-5 sauberen Frames eine ausreichend detaillierte Beschreibung
// des fertigen Gerichts bauen, damit Flux 2 Pro **ohne** Reference-Image
// trotzdem dasselbe Gericht rendert. Vorteile gegenueber Image-to-Image:
//   - keine Text/Hand/Watermark-Uebernahme aus dem Reel
//   - voller Style-Kontrolle (Brand-DNA setzt sich durch)
//   - kein "Reel-Cover-Look" — eigenes Bild im eigenen Stil
//
// Trade-off: keine 1:1 Pixel-Treue. Die Description ist verlustbehaftet —
// Flux interpretiert sie. Form/Farbe/Vessel/Layering/Toppings kommen sehr
// gut rueber; sehr originelle Twists und exakte Komponenten-Zahlen sind
// 70-85% Trefferquote.
//
// Multi-Frame statt Single-Frame: Gemini sieht das Gericht in mehreren
// Stadien/Winkeln und konvergiert auf eine konsistente Beschreibung,
// nicht eine "Frame-Snapshot"-Interpretation.

export type StructuredDishDescription = {
  /** Grundform / Geometrie. Ein Satz. Beispiel: "Five small clear glass cups
   *  in a loose row, each about 4cm wide and 5cm tall." */
  form: string;
  /** Dominante Farbtoene. Konkret, nicht abstrakt. Beispiel: "Bright pink-red
   *  strawberry top, creamy off-white coconut base." */
  dominantColors: string;
  /** Vessel/Behaelter (Material, Form, Groesse). Beispiel: "Clear smooth
   *  glass cups, no pattern, no rim." */
  vessel: string;
  /** Schichten oder Aufbau von unten nach oben. Leer wenn nicht zutreffend.
   *  Beispiel: "Bottom two-thirds creamy white coconut, top third strawberry
   *  puree, finely chopped strawberry pieces scattered on top." */
  layering: string;
  /** Garnitur und Toppings. Beispiel: "Chopped fresh strawberry pieces
   *  scattered on the surface. No herbs." */
  toppings: string;
  /** Texturen. Beispiel: "Frozen, slight frost on surface, glossy seam
   *  where strawberry meets coconut." */
  textures: string;
  /** Optionaler Komponenten-Count wenn relevant (5 Cups, 4 Pancakes, 1
   *  Cake). Leerer String wenn nicht relevant. */
  componentCount: string;
  /** Fluessige englische Cookbook-Beschreibung des Gerichts, die direkt in
   *  den Flux-Prompt einfliessen kann. Konzentriertes Compose-Feld — alle
   *  obigen Aspekte in einem schoenen Absatz. Cookbook-Stil, kein "I see"
   *  oder "The image shows". */
  compose: string;
};

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    form: {
      type: "string",
      description:
        "Grundform/Geometrie des fertigen Gerichts in EINEM englischen Satz mit konkreten Mass-Angaben wenn moeglich. Beispiele: 'Five small clear glass cups in a loose row, each about 4cm wide', 'A circular layered cake about 18cm in diameter, 6cm tall', 'A large shallow bowl filled with mixed salad ingredients'.",
    },
    dominantColors: {
      type: "string",
      description:
        "Konkrete dominante Farben des Gerichts auf Englisch, knapp und praezise. Nicht abstrakt ('warm'), sondern konkret ('bright pink-red on top, creamy off-white below'). Maximal 2 Saetze.",
    },
    vessel: {
      type: "string",
      description:
        "Vessel/Behaelter: Material, Form, optional Groesse. Englisch, knapp. Beispiele: 'clear smooth glass cups, no pattern', 'a deep rustic ceramic bowl with subtle blue glaze', 'a round white porcelain plate with raised rim'.",
    },
    layering: {
      type: "string",
      description:
        "Aufbau/Schichten von unten nach oben in einem Satz auf Englisch — nur fuer Gerichte mit klaren Schichten (Kuchen, Cups, Lasagne, Parfaits). Bei Bowls/Salaten: 'No layering, ingredients mixed together'. Bei einfachen Gerichten: leer.",
    },
    toppings: {
      type: "string",
      description:
        "Toppings + Garnitur. Englisch, knapp. Beispiele: 'Chopped fresh strawberry pieces scattered on the surface', 'Drizzled chocolate sauce and toasted almonds', 'A sprig of fresh basil and grated parmesan'. 'None visible' wenn nichts.",
    },
    textures: {
      type: "string",
      description:
        "Sichtbare Texturen + Oberflaechen-Qualitaeten auf Englisch. Beispiele: 'Frozen with slight frost, glossy seam between layers', 'Crispy golden crust, soft creamy interior', 'Fluffy moist crumb, slightly caramelized top'.",
    },
    componentCount: {
      type: "string",
      description:
        "Anzahl Komponenten wenn relevant (z.B. 5 Cups, 4 Pancakes, 12 Cookies). Format: 'five [items]'. Leer wenn nicht zutreffend (einzelne Schale, ein Kuchen).",
    },
    compose: {
      type: "string",
      description:
        "Fluessige englische Cookbook-Beschreibung des Gerichts als 3-4 Saetze, die alle obigen Aspekte zusammenfuehren. Konzentriert, kein 'I see' oder 'The image shows'. Diese Beschreibung fliesst direkt in den Flux-Prompt — sie muss Flux genug Information geben um das Gericht aus dem Nichts zu rendern.",
    },
  },
  required: [
    "form",
    "dominantColors",
    "vessel",
    "layering",
    "toppings",
    "textures",
    "componentCount",
    "compose",
  ],
};

const SYSTEM_INSTRUCTION = `Du bekommst mehrere Frames aus einem Cooking-Reel und beschreibst das FERTIGE GERICHT (nicht die Zubereitungs-Stadien) strukturiert auf Englisch.

Ziel: deine Beschreibung wird direkt an ein Bild-Generierungs-Modell (Flux 2 Pro) gegeben. Das Modell soll aus deiner Beschreibung ALLEIN — ohne das Reel zu sehen — ein neues Bild des Gerichts rendern, das visuell stimmig zum Original ist.

Was du tun musst:
- Konzentriere dich auf die Frames mit dem FERTIG angerichteten Gericht (typischerweise gegen Ende des Reels). Ignoriere Zubereitungs-Stadien.
- Sei KONKRET: nenne genaue Farben, Formen, Schichten, Mass-Angaben (in cm wenn ableitbar).
- Sei MULTI-FRAME-KONSISTENT: wenn das Gericht in mehreren Frames erscheint, beschreibe was UEBER ALLE Frames konsistent ist (nicht ein zufaelliger Snapshot-Moment).
- Cookbook-Stil, kein "I see" oder "The image shows" oder "In the video".

Was du IGNORIEREN musst:
- Text-Overlays, POV-Untertitel, Recipe-Step-Banner, Sticker, Watermarks
- Haende, Finger, Arme, Personen — die kommen ins neue Bild NICHT rein
- Hintergrund/Counter/Vessel-Position — der NEUE Hintergrund kommt von der Brand-DNA, nicht vom Reel. Du beschreibst NUR das GERICHT selbst.

Antworte AUSSCHLIESSLICH im JSON-Schema mit allen Feldern befuellt.`;

export type DescribeDishOptions = {
  /** 3-5 Frames mit dem fertig angerichteten Gericht (oder so nah wie
   *  moeglich). Caller waehlt sie aus dem Frame-Stream. */
  frames: ExtractedFrame[];
  recipeTitle: string;
  /** Optionaler Caption-Auszug fuer Kontext. */
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
      // Pro statt Flash: dish-detail-treue ist hier entscheidend. Pro
      // erkennt Farb-Nuancen und Layering deutlich besser als Flash.
      // Speed-Trade-off (~5-10s statt ~3s) ist akzeptabel weil das nur
      // einmal pro Hero passiert.
      model: "pro",
      temperature: 0.3,
      maxOutputTokens: 2048,
      retries: 1,
    });

    return {
      form: (result.form ?? "").trim(),
      dominantColors: (result.dominantColors ?? "").trim(),
      vessel: (result.vessel ?? "").trim(),
      layering: (result.layering ?? "").trim(),
      toppings: (result.toppings ?? "").trim(),
      textures: (result.textures ?? "").trim(),
      componentCount: (result.componentCount ?? "").trim(),
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
