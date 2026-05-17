import { callGemini } from "./gemini";

// Semantischer Umlaut-Korrektor via Gemini-Mini-Call.
//
// Ersetzt die alte Whitelist-Logik (lib/restore-umlauts.ts) durch einen
// kurzen Gemini-Pass der semantisch entscheidet welche oe/ue/ae/ss-Stellen
// echte deutsche Umlaute sind (→ ö/ü/ä/ß ersetzen) und welche NICHT (z.B.
// englische Woerter, Eigennamen, Markennamen — diese bleiben unveraendert).
//
// Vorteil gegenueber Whitelist:
//   - vollstaendig (kein "fehlendes Wort"-Risiko bei neuem Vokabular)
//   - semantisch korrekt (unterscheidet deutsche Woerter von Eigennamen)
//   - wartungsfrei (keine Liste pflegen)
//
// Cost: 1 Gemini-Flash-Call pro Foreword-Generation (~1s, ~$0.0001).
// Marginal gegenueber der Haupt-Generation (~5-10s + Self-Critique).

// Schema fuer batched Korrektur — alle 4 Foreword-Felder in einem Call.
// Generic-genug auch fuer andere Text-Pipelines verwendbar wenn noetig.
const CORRECT_TEXT_SCHEMA = {
  type: "object",
  properties: {
    corrected: {
      type: "string",
      description:
        "Der korrigierte Text. Identisch zum Input ausser dass ae/oe/ue/ss in deutschen Woertern durch ä/ö/ü/ß ersetzt sind. Eigennamen, englische Woerter und Markennamen UNVERAENDERT lassen.",
    },
  },
  required: ["corrected"],
};

type CorrectionResponse = {
  corrected: string;
};

const SYSTEM_INSTRUCTION = `Du bist ein deutscher Lektor. Deine einzige Aufgabe: in einem deutschen Text die Umlaute korrigieren.

REGEL:
- ae → ä (z.B. "Saetze" → "Sätze", "spaeter" → "später")
- oe → ö (z.B. "koennen" → "können", "moeglich" → "möglich")
- ue → ü (z.B. "fuer" → "für", "ueber" → "über")
- ss → ß (NUR bei langem Vokal: "süß", "heiß", "Maß". NICHT bei kurzem Vokal: "muss", "Schloss", "Wasser")

AUSNAHMEN (NICHT korrigieren):
- Eigennamen: "Mueller" als Familienname BLEIBT (auch wenn theoretisch "Müller" korrekt waere)
- Englische Woerter: "queer", "house", "Suite", "Foundation", "true", "blue" — BLEIBEN
- Markennamen: "Coca-Cola", "Boeing", "AirBnB" — BLEIBEN
- Abkuerzungen / Codes: "UEFA", "GmbH" — BLEIBEN
- Wenn du unsicher bist: NICHT aendern (besser unveraendert als falsch korrigiert)

WICHTIG: aendere AUSSCHLIESSLICH Umlaute. Kein Wort hinzufuegen, weglassen oder umstellen. Keine Stilaenderung. Keine Korrektur von Tippfehlern oder Grammatik. Der korrigierte Text ist 1:1 der Original-Text mit korrekten Umlauten.

Antworte AUSSCHLIESSLICH im JSON-Schema mit { "corrected": "..." }.`;

/**
 * Korrigiert Umlaute in einem deutschen Text via Gemini.
 *
 * Returnt den korrigierten Text. Wenn die Korrektur fehlschlaegt
 * (Gemini-Outage, ungueltige Response, leeres Ergebnis), wird der
 * Original-Text zurueckgegeben — fail-safe statt fail-loud.
 */
export async function correctGermanUmlautsViaGemini(
  text: string
): Promise<string> {
  if (!text || text.length < 3) return text;
  // Wenn der Text gar keine verdaechtigen Patterns hat, sparen wir den
  // Call. \b ist wichtig damit "Sue" als ganzes Wort matcht, nicht
  // "Sues" als Substring von "Suesse".
  if (!/\b\w*(?:oe|ue|ae|ss)\w*\b/i.test(text)) {
    return text;
  }

  try {
    const result = await callGemini<CorrectionResponse>({
      prompt: `Korrigiere die Umlaute in diesem deutschen Text:\n\n${text}`,
      schema: CORRECT_TEXT_SCHEMA,
      systemInstruction: SYSTEM_INSTRUCTION,
      // Sehr niedrige Temp — wir wollen deterministisches Ersetzen, keine
      // kreative Variation. Korrektur soll vorhersagbar sein.
      temperature: 0.1,
      maxOutputTokens: 1024,
      thinkingBudget: 0,
      retries: 1,
      model: "flash",
    });
    const corrected = result.corrected?.trim();
    if (!corrected) return text;
    // Sanity-Check: der korrigierte Text darf nicht drastisch laenger oder
    // kuerzer sein als das Original — sonst hat Gemini halluziniert.
    if (
      corrected.length < text.length * 0.7 ||
      corrected.length > text.length * 1.3
    ) {
      console.warn(
        "[correct-german-umlauts] korrigierter Text-Laenge weicht stark vom Original ab — verwerfe und gebe Original zurueck"
      );
      return text;
    }
    return corrected;
  } catch (err) {
    console.warn(
      "[correct-german-umlauts] Gemini-Korrektur fehlgeschlagen, gebe Original zurueck:",
      err instanceof Error ? err.message : err
    );
    return text;
  }
}

/**
 * Korrigiert mehrere Text-Felder in einem einzigen Gemini-Call.
 * Effizienter als pro-Feld-Calls weil eine Round-Trip-Latenz statt N.
 *
 * Sentinel-basierte Trennung: wir joinen die Felder mit einem eindeutigen
 * Marker und splitten danach wieder. Gemini sieht alle Felder als einen
 * zusammenhaengenden Text und kann konsistent korrigieren.
 */
export async function correctGermanUmlautsBatch<K extends string>(
  fields: Record<K, string>
): Promise<Record<K, string>> {
  const keys = Object.keys(fields) as K[];
  if (keys.length === 0) return fields;

  const SEPARATOR = "\n\n===FELD-TRENNER===\n\n";
  const combined = keys.map((k) => fields[k] ?? "").join(SEPARATOR);

  // Wenn keine verdaechtigen Patterns in keinem Feld, skip Gemini.
  if (!/\b\w*(?:oe|ue|ae|ss)\w*\b/i.test(combined)) {
    return fields;
  }

  const correctedCombined = await correctGermanUmlautsViaGemini(combined);
  const parts = correctedCombined.split(SEPARATOR);

  // Wenn Gemini den Separator zerstoert hat (anders viele Teile als erwartet),
  // fallback auf pro-Feld-Korrektur.
  if (parts.length !== keys.length) {
    console.warn(
      `[correct-german-umlauts] Batch-Korrektur Separator-Mismatch (expected ${keys.length}, got ${parts.length}) — fallback auf pro-Feld`
    );
    const result = { ...fields };
    for (const k of keys) {
      result[k] = await correctGermanUmlautsViaGemini(fields[k] ?? "");
    }
    return result;
  }

  const result = {} as Record<K, string>;
  for (let i = 0; i < keys.length; i++) {
    result[keys[i]] = parts[i].trim();
  }
  return result;
}
