import { callGeminiMultimodal } from "./gemini";

// Vision-Layer fuer die Hero-Pipeline: Gemini 2.5 Flash schaut sich das
// Reel-Cover-Bild von Instagram an und beschreibt NUR das Gericht — Form,
// Farbe, Textur, Garnish, Anrichtung. Bewusst NICHT: Text-Overlays,
// Talking-Heads, Hintergrund, Beleuchtung. Diese Beschreibung wird dann
// als Text-Hinweis in den Flux-Prompt eingebaut.
//
// Ingo-Feedback: aktuell sieht Gemini nie das echte Bild — Flux generiert
// "irgendeinen Kaiserschmarren", nicht den fluffig-goldgelben mit Erdbeer-
// Compote vom Reel. Dieser Vision-Call schliesst die Lücke.

const SYSTEM_INSTRUCTION = `Du bist ein Photograph, der einem Kollegen ein Reel-Cover-Bild in Worten beschreibt — fuer einen Image-Generator, der das Gericht spaeter im selben Look (aber clean, ohne Werbe-Elemente) nachstellen soll.

Schau dir das Bild an und schreib einen einzigen englischen Satz, in dem jemand, der das Reel nie gesehen hat, sich das Gericht trotzdem genau vorstellen kann — wie es aussieht, welche Farben, welche Textur, wie das Topping verteilt ist, in welchem Gefaess es liegt. Schreib es so, wie ein erfahrener Foodphotograph einer Kollegin schnell ein Bild erklaert: konkret, sinnlich, in einem Atemzug. Bei den Farben praezise sein — nicht "golden", sondern "pale eggshell-yellow with lightly caramelized edges". Nicht "creamy white", sondern "soft off-white with red strawberry marbling".

Wenn das Reel mehrere Anrichtungen zeigt — typisches Bienenfee-Pattern wie Backform plus plattiert daneben, oder ein ganzes Cup neben einem angeschnittenen Demo-Stueck — beschreibe NUR die fertige Servier-Variante, nicht beide. Wenn das Topping im Reel natuerlich verstreut ist (mal eine Beere hier, mal drei dort), schreib es genau so — nicht "one per piece", weil Generatoren das sonst symmetrisch nachstellen.

Ignoriere alles, was nicht das Gericht selbst ist: Text-Overlays, Sticker, Werbe-Stempel, Personen, Haende, Hintergrund-Kuechen-Setup, Lichtstimmung. Die Umgebung und das Licht werden neu gestagt — du beschreibst nur das Essen.

Antworte auf Englisch, EIN einzelner Satz, max 80 Woerter, fluessig formuliert (nicht als Stichpunkt-Liste). KEIN "I see..." oder "The image shows...", sondern direkt die Beschreibung als waere es eine Bildunterschrift fuer ein Kochbuch.

Falls das Bild kein Gericht zeigt (reiner Talking-Head, reines Werbe-Cover ohne Essen): gib einen leeren String zurueck.`;

const SCHEMA = {
  type: "object",
  properties: {
    dishDescription: {
      type: "string",
      description:
        "Ein einzelner englischer Satz, visuell praezise, max 60 Woerter, der NUR das Gericht beschreibt. Leer wenn das Bild kein Gericht zeigt.",
    },
  },
  required: ["dishDescription"],
};

export async function describeInstagramDish(
  imageUrl: string
): Promise<string | null> {
  // 1) Bild laden — Instagram-CDN braucht freundliche Headers
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

  // Content-Type: meistens image/jpeg von Instagram-CDN
  const mimeType = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";

  // 2) Gemini Vision Call
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
      temperature: 0.2,
      maxOutputTokens: 200,
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
