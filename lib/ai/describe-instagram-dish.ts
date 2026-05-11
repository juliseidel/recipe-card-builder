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

const SYSTEM_INSTRUCTION = `Du bist ein Vision-Analyst fuer Food-Photography. Du bekommst ein Reel-Cover-Bild und sollst NUR das fertige Gericht beschreiben — fuer einen Image-Generator, der das Gericht spaeter in einem cleanen Brand-Style nachstellen soll.

BESCHREIBE praezise und kompakt:
- Form / Aufbau: z.B. "small fluffy golden pieces", "a layered three-section cheesecake", "a stack of round red-and-white frozen cups"
- Farbe: Hauptfarben, Farbverlauf, Akzente
- Textur / Konsistenz: cremig, knusprig, fluffig, glaenzend, krustig, saftig
- Topping / Garnierung: z.B. "dusted with powdered sugar", "topped with fresh red strawberry pieces"
- Serving-Vessel (falls erkennbar): "in a black baking tray", "in a glass bowl", "on a white plate"

IGNORIERE STRENG:
- Text-Overlays, Captions, Sticker, Kalorien-Stempel, Werbe-Headlines
- Personen, Haende, Gesichter (auch wenn sie viel Bild einnehmen — beschreibe nur was vom Gericht zu sehen ist)
- Hintergrund / Kuechen-Setup (wird neu gestagt)
- Beleuchtung / Bildatmosphaere (wird neu gestagt)

ANTWORTE auf Englisch, ein einzelner Satz, max 60 Woerter, visuell praezise. KEIN "I see...", KEINE Meta-Kommentare. Direkt die Beschreibung.

Wenn das Bild das Gericht gar nicht zeigt (z.B. reines Talking-Head, reines Werbe-Cover ohne Essen): gib einen leeren String zurueck.`;

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
