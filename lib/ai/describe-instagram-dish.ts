import { callGeminiMultimodal } from "./gemini";

// Vision-Layer fuer die Hero-Pipeline: Gemini 2.5 Pro schaut sich das
// Reel-Cover-Bild von Instagram an und beschreibt das Gericht mit ALLEN
// DETAILS (Farbe, Form, Anzahl, Anordnung, Garnish, Vessel). Diese
// Beschreibung wird dann zusammen mit dem Reel-Cover als Reference-Image
// an Flux Kontext Max gegeben — drei zusammenpassende Signale fuer maximale
// Detail-Treue zum Original.

const SYSTEM_INSTRUCTION = `Du bist ein Food-Photograph, der einem Image-Generator ein Reel-Bild detailliert beschreibt — damit der Generator das Gericht spaeter im selben Look (clean, ohne Werbe-Elemente) und mit ALLEN ECHTEN DETAILS nachstellen kann. Detail-Treue ist hier kritisch: Farb-Paletten, Anordnung, Anzahl, Garnish — alles muss konkret sein.

Schau dir das Bild GENAU an und schreib eine fluessige Beschreibung (2-4 Saetze, max 150 Woerter) als waere es ein Kochbuch-Bildtext. Sei extrem praezise bei:

FARB-PALETTE — nicht "golden", sondern was du wirklich siehst: "warm honey-brown with light caramelized edges fading to pale ivory underneath"; "cool ice-cream-pink with bright crimson dots on chalk-white base"; "deep chocolate with espresso-dark crust". Gib mehrere Farben an, wenn das Bild mehrere hat. Sag explizit, ob die Farben warm, kuhl oder neutral wirken — Generatoren ziehen sonst standardmaeßig in Richtung warm-golden.

FORM & ANORDNUNG — wie ist das Gericht geschichtet/gestapelt/verteilt? "A neat 3×2 grid of round discs in a metal muffin tin"; "Loose pile of irregularly torn pieces on a deep plate"; "Three layers cleanly visible in a glass: white bottom, pink middle, white top, garnish floating on top".

ANZAHL — wie viele Einheiten/Stuecke/Schichten sind im Bild? Gib eine genaue Zahl wenn moeglich ("six round cups", "two stacked layers", "about eight torn pieces").

TOPPING & GARNISH — exakte Verteilung: "raspberries scattered organically across, some clustered, some single — not one-per-piece"; "powdered sugar dusted unevenly heavier on the left side"; "small bowl of jam sitting on the right edge of the plate, separate from the dish". Wenn etwas in einer kleinen Schale daneben liegt, sag das.

SERVING-VESSEL — was haellt das Gericht? "Black metal muffin tin", "white round ceramic plate with raised rim", "tall glass with vertical sides", "shallow dark stoneware bowl".

Wenn das Reel mehrere Anrichtungen zeigt (Backform + plattiert daneben, ganzes + angeschnittenes), beschreibe NUR die finale Servier-Variante. Nie beide kombinieren.

Ignoriere: Text-Overlays, Sticker, Werbe-Stempel, Personen, Hintergrund, Lichtstimmung. Nur das Gericht selbst.

Antworte auf Englisch, KEIN "I see..." oder "The image shows..." — direkt die Beschreibung wie eine Bildunterschrift fuer einen Bildband. Konkret, sinnlich, detail-dicht.

Wenn das Bild kein Gericht zeigt (Talking-Head, reines Werbe-Cover): leerer String.`;

const SCHEMA = {
  type: "object",
  properties: {
    dishDescription: {
      type: "string",
      description:
        "Eine fluessige Beschreibung (2-4 Saetze, max 150 Woerter), die das Gericht mit allen Details abdeckt: Farbpalette, Form, Anzahl, Anordnung, Topping, Vessel. Leer wenn kein Gericht im Bild.",
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
  const mimeType =
    res.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";

  try {
    const raw = await callGeminiMultimodal<{ dishDescription: string }>({
      parts: [
        {
          text: "Beschreibe das Gericht auf diesem Reel-Bild MIT ALLEN DETAILS (Farbe, Form, Anzahl, Anordnung, Garnish, Vessel). Folge der System-Instruction strikt.",
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
      // gemini-2.5-pro statt flash — deutlich detail-genauer bei Vision-
      // Calls, sieht Farb-Nuancen, raeumliche Anordnung, Anzahl der
      // Komponenten praeziser. Kostet ~5-10 s statt 2-3 s — der Wert fuer
      // die Hero-Pipeline ist es wert.
      model: "pro",
      temperature: 0.2,
      maxOutputTokens: 600,
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
