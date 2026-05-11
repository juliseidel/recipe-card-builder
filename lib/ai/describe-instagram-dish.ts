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

═══════════════════════════════════════════════════════════════════════
KRITISCHE REGEL — EINE Anrichtung, KEINE Demo-Slice:
═══════════════════════════════════════════════════════════════════════
Bienenfee und aehnliche Creator zeigen ihre Gerichte oft in 2-3 Stagings
gleichzeitig im selben Cover:
  - Backform + plattiert daneben
  - Ganzes Stueck im Glas + angeschnittenes Demo-Stueck daneben
  - Pfanne mit gesamtem Inhalt + ein einzelnes Stueck auf Teller davor
  - Ein Cup ganz + ein Cup angeschnitten zur Schicht-Demonstration

In ALL diesen Faellen: beschreibe IMMER NUR EINE einzige Anrichtung.
Die "finale Servier-Variante" — wie man es serviert, nicht aufgeschnitten
zur Demo. Wenn das Bild beides zeigt, ignoriere die Demo-Slice / das
angeschnittene Vergleichs-Stueck komplett. Niemals "X im Y, daneben Z
angeschnitten" beschreiben — nur "X im Y".

═══════════════════════════════════════════════════════════════════════
FARB-PRAEZISION (sehr wichtig):
═══════════════════════════════════════════════════════════════════════
Statt generischer Adjektive ("golden", "creamy"):
  - "pale eggshell-yellow with light brown spots" statt "golden"
  - "creamy off-white with bright red marbling" statt "white and red"
  - "deep amber with darker caramelized edges" statt "brown"
  - "soft pastel pink throughout" statt "pink"
Beschreibe den HAUPTFARBTON sehr konkret — Image-Generatoren neigen
sonst zu "brauner gebacken" wenn Original "heller fluffig" war.

═══════════════════════════════════════════════════════════════════════
BESCHREIBE praezise und kompakt diese EINE Anrichtung:
═══════════════════════════════════════════════════════════════════════
- Form / Aufbau: z.B. "small fluffy ripped-up pieces", "a stack of round flat discs"
- HAUPTFARBE praezise (siehe oben): konkrete Farb-Adjektive
- Textur / Konsistenz: cremig, knusprig, fluffig, glaenzend, krustig, saftig
- Topping / Garnierung mit NATUERLICHEM Verteilungs-Pattern: z.B. "raspberries scattered irregularly across the pieces, not one per piece" — nicht "topped with one raspberry per piece" (das macht Flux ueberregelmaessig). Wenn das Reel die Frucht/Garnish in einer kleinen Schale daneben hat, sag das so.
- Serving-Vessel: das eine echte Servier-Gefaess (NICHT die Backform UND den Teller — entscheide dich)

IGNORIERE STRENG:
- Zweite/andere Anrichtungen im selben Bild (Backform vs. Teller — nur eine waehlen!)
- Demo-Slices, angeschnittene Stuecke fuer Querschnitt-Show
- Text-Overlays, Captions, Sticker, Kalorien-Stempel, Werbe-Headlines
- Personen, Haende, Gesichter
- Hintergrund / Kuechen-Setup (wird neu gestagt)
- Beleuchtung / Bildatmosphaere (wird neu gestagt)

ANTWORTE auf Englisch, ein einzelner Satz, max 70 Woerter, visuell praezise mit konkreten Farb-Adjektiven. KEIN "I see...", KEINE Meta-Kommentare. Direkt die Beschreibung der EINEN gewaehlten Anrichtung.

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
