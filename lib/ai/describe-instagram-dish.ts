import { callGeminiMultimodal } from "./gemini";

// Vision-Layer fuer die Hero-Pipeline: Gemini 2.5 Flash schaut sich das
// Reel-Cover-Bild von Instagram an und liefert (a) eine Beschreibung des
// Gerichts und (b) zwei Risk-Flags: hat das Bild Text-Overlay oder eine
// Person/Hand drin?
//
// Die Flags sind essenziell fuer den Reference-First-Pfad. Wenn die
// Reference Text-Overlays hat (typischer Reel-Cover-Stil mit Recipe-Titel),
// dann uebernimmt Flux das in den Output — selbst mit verschaerftem
// Negative-Prompt. Loesung: bei hasTextOverlay/hasPerson skippen wir
// die Reference, gehen zu text-only Flux und nutzen die description als
// visuellen Anker.

export type DishVisionResult = {
  /** Fluessige englische Beschreibung des Gerichts (Cookbook-Stil).
   *  Leer wenn das Bild kein Gericht zeigt. */
  description: string;
  /** True wenn das Bild Text-Overlays, Recipe-Titel, Untertitel, Sticker
   *  oder ein Reel-Cover-Layout mit Schrift enthaelt. */
  hasTextOverlay: boolean;
  /** True wenn ein Mensch, Hand, Finger, Arm oder Gesicht im Bild ist. */
  hasPerson: boolean;
};

const SYSTEM_INSTRUCTION = `Du bist ein Food-Photograph + Image-Risk-Auditor. Vor dir liegt ein Reel-Cover-Bild und du lieferst dem nachgelagerten Image-Generator zwei Sachen:

(1) DISH-DESCRIPTION — eine ehrliche, detaillierte englische Beschreibung des Gerichts (so wie du es einem Kollegen beschreiben wuerdest, der das Bild nie gesehen hat und es trotzdem nachstellen koennen muss). Erwaehne genaue Farben, Form/Aufbau, Anzahl der Komponenten, Textur, Topping-Verteilung, Servier-Gefaess. Wie viel du schreibst entscheidest du selbst — was es zu sagen gibt, sag.

Sei besonders aufmerksam bei der FORM des Gerichts — Image-Generatoren neigen dazu, Recipe-Titel falsch zu interpretieren (z.B. "Cups" wird zu Cupcakes, "Bowl" wird zu Smoothie-Schale). Beschreibe deshalb sehr klar wie das Gericht im echten Bild aussieht. Wenn das Reel mehrere Anrichtungen zeigt, beschreibe NUR die fertige Servier-Variante.

Ignoriere alles, was nicht das Gericht selbst ist (Text-Overlays, Sticker, Personen, Haende, Hintergrund). Antworte auf Englisch, fluessig formuliert wie eine Kochbuch-Bildunterschrift, KEIN "I see..." oder "The image shows...". Wenn das Bild kein Gericht zeigt: leerer String.

(2) ZWEI RISK-FLAGS:

hasTextOverlay (boolean): true wenn das Bild text-artige Elemente enthaelt — Recipe-Titel als ueberlagerte Schrift, Caption-Banner, Sticker mit Worten, "Vorher/Nachher"-Labels, prominente Markennamen, Werbe-Stempel. Faustregel: wenn Image-Generatoren diese Schrift unbeabsichtigt nachstellen koennten, ist es true. Subtile Wasserzeichen oder ausgewogene Mini-Logos koennen false sein, aber sei lieber vorsichtig — true ist die sichere Wahl. Bei reinem Food-Shot ohne jede Schrift: false.

hasPerson (boolean): true wenn ein Mensch, ein Gesicht, eine Hand, ein Finger, ein Arm, eine Schulter oder ein Torso sichtbar ist (auch teilweise oder am Rand). Bei reinem Food-Shot ohne Koerper: false.

Antworte AUSSCHLIESSLICH im JSON-Schema.`;

const SCHEMA = {
  type: "object",
  properties: {
    dishDescription: {
      type: "string",
      description:
        "Englische Beschreibung des Gerichts (Cookbook-Stil) oder leer wenn kein Gericht erkennbar.",
    },
    hasTextOverlay: {
      type: "boolean",
      description:
        "true wenn das Bild Text-Overlays, Recipe-Titel, Sticker oder Caption-Banner enthaelt, die ein Image-Generator unbeabsichtigt nachstellen koennte.",
    },
    hasPerson: {
      type: "boolean",
      description:
        "true wenn Hand, Finger, Arm, Gesicht oder andere Koerperteile im Bild sichtbar sind.",
    },
  },
  required: ["dishDescription", "hasTextOverlay", "hasPerson"],
};

export async function describeInstagramDish(
  imageUrl: string
): Promise<DishVisionResult | null> {
  const res = await fetch(imageUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    },
  });
  if (!res.ok) {
    console.warn(
      `[describe-dish] image fetch failed: ${res.status} ${res.statusText}`
    );
    return null;
  }
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const mimeType =
    res.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";

  try {
    const raw = await callGeminiMultimodal<{
      dishDescription: string;
      hasTextOverlay: boolean;
      hasPerson: boolean;
    }>({
      parts: [
        {
          text: "Beschreibe das Gericht und liefere die Risk-Flags. Folge der System-Instruction strikt.",
        },
        {
          inlineData: {
            mimeType,
            data: buffer.toString("base64"),
          },
        },
      ],
      schema: SCHEMA,
      systemInstruction: SYSTEM_INSTRUCTION,
      // Bewusst Flash (nicht Pro) — Kosten + Speed. Pro brachte detail-
      // reichere Descriptions, aber die ueberforderten Flux Kontext und
      // machten Bilder schlechter, nicht besser.
      temperature: 0.2,
      thinkingBudget: 0,
      retries: 1,
    });
    return {
      description: (raw.dishDescription ?? "").trim(),
      hasTextOverlay: Boolean(raw.hasTextOverlay),
      hasPerson: Boolean(raw.hasPerson),
    };
  } catch (err) {
    console.warn(
      "[describe-dish] vision call failed:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}
