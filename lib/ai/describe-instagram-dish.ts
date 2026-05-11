import { callGeminiMultimodal } from "./gemini";

// Vision-Layer fuer die Hero-Pipeline: Gemini 2.5 Flash schaut sich das
// Reel-Cover-Bild von Instagram an und beschreibt das Gericht in einem
// fluessigen englischen Satz. Diese Beschreibung wird dann zusammen mit
// dem Reel-Cover als Reference-Image an Flux Kontext Pro gegeben.

const SYSTEM_INSTRUCTION = `Du bist ein Food-Photograph. Vor dir liegt ein Reel-Cover-Bild und du beschreibst es einem Image-Generator, der das gleiche Gericht spaeter clean (ohne Werbe-Elemente) nachstellen soll.

Schreib eine ehrliche, detaillierte englische Beschreibung des Gerichts — so wie du es einem Kollegen beschreiben wuerdest, der das Bild nie gesehen hat und es trotzdem genau nachstellen koennen muss. Erwaehne alles was relevant ist: die genauen Farben (welche Toene, wie viele, wo verteilt), Form und Aufbau, Anzahl der Komponenten, Textur, Topping und wie es verteilt ist, das Servier-Gefaess, alle visuellen Details die ein Foodphotograph einfangen wuerde. Wie viel du schreibst entscheidest du selbst — was es zu sagen gibt, sag.

Wenn das Reel mehrere Anrichtungen zeigt (typisches Pattern: Backform plus plattiert daneben, ganzes plus angeschnittenes Demo-Stueck), beschreibe NUR die fertige Servier-Variante, nie beide kombiniert. Wenn das Topping natuerlich verstreut ist, schreib das so — nicht "one per piece", weil Image-Generatoren das sonst symmetrisch nachstellen.

Ignoriere alles, was nicht das Gericht selbst ist: Text-Overlays, Sticker, Werbe-Stempel, Personen, Haende, Hintergrund-Kuechen-Setup, Lichtstimmung. Die Umgebung wird neu gestagt — du beschreibst nur das Essen.

Antworte auf Englisch, fluessig formuliert wie eine Kochbuch-Bildunterschrift, KEIN "I see..." oder "The image shows...".

Wenn das Bild kein Gericht zeigt (reiner Talking-Head, reines Werbe-Cover ohne Essen): gib einen leeren String zurueck.`;

const SCHEMA = {
  type: "object",
  properties: {
    dishDescription: {
      type: "string",
      description:
        "Eine fluessige englische Beschreibung des Gerichts — Laenge so wie du es brauchst um das Bild treu zu beschreiben (Farben, Form, Anzahl, Garnish, Vessel, alle relevanten Details). Leer wenn das Bild kein Gericht zeigt.",
    },
  },
  required: ["dishDescription"],
};

export async function describeInstagramDish(
  imageUrl: string
): Promise<string | null> {
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
    const raw = await callGeminiMultimodal<{ dishDescription: string }>({
      parts: [
        {
          text: "Beschreibe das Gericht auf diesem Reel-Cover-Bild. Folge der System-Instruction strikt.",
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
      temperature: 0.3,
      // Kein maxOutputTokens — Gemini entscheidet selbst, wie viel
      // Beschreibung das Bild braucht. Vorher 200 Tokens Limit war
      // selbst-imposed und zwang Gemini zu Verknappung.
      thinkingBudget: 0,
      retries: 1,
    });
    const desc = (raw.dishDescription ?? "").trim();
    if (!desc) return null;
    return desc;
  } catch (err) {
    console.warn(
      "[describe-dish] vision call failed:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}
