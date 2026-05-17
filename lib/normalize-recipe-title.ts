// Normalisiert Recipe-Titel fuer Verwendung in Foreword-Prose.
//
// Problem: User schreiben Rezept-Titel oft in ALL-CAPS ("SPAGHETTI
// PROTEIN EIS", "HOMEMADE DOENER") weil das auf der Recipe-Card visuell
// gut aussieht. Wenn diese ALL-CAPS-Titel aber im Fliesstext des
// Vorworts erwaehnt werden ("Das SPAGHETTI PROTEIN EIS ist ein
// Knaller…"), wirkt es schreiend und unleserlich. Plus: ALL-CAPS-Woerter
// triggern haeufiger Char-Level-Wraps in react-pdf weil sie visuell
// breiter sind.
//
// Loesung: vor Uebergabe an Gemini's Foreword-Generator die Titel in
// Title-Case ueberfuehren WENN sie ueberwiegend ALL-CAPS sind. Recipe-
// Cards selbst behalten ihre Original-Schreibweise — die Normalisierung
// passiert nur fuer die Foreword-Prose-Erwaehnung.

const GERMAN_LOWERCASE_WORDS = new Set([
  "und",
  "oder",
  "mit",
  "ohne",
  "von",
  "vom",
  "zum",
  "zur",
  "im",
  "in",
  "auf",
  "am",
  "an",
  "der",
  "die",
  "das",
  "den",
  "dem",
  "des",
  "ein",
  "eine",
  "einer",
  "eines",
  "einem",
  "einen",
  "auch",
  "fuer",
  "für",
  "à",
]);

/**
 * Normalisiert einen Recipe-Titel fuer Verwendung in Fliesstext.
 *
 * - Wenn der Titel weniger als 70% ALL-CAPS-Buchstaben hat → unveraendert
 *   (also "Cremiges Protein Porridge" bleibt, "Banana Bread" bleibt)
 * - Wenn der Titel hauptsaechlich ALL-CAPS ist ("SPAGHETTI PROTEIN EIS",
 *   "HOMEMADE DOENER") → Title-Case-Konvertierung mit deutschen
 *   Stop-Word-Ausnahmen ("und", "mit" bleiben klein)
 */
export function normalizeRecipeTitleForProse(title: string): string {
  if (!title) return title;
  const trimmed = title.trim();
  if (trimmed.length === 0) return trimmed;

  // Wieviel Prozent der Buchstaben sind uppercase?
  const letters = trimmed.replace(/[^a-zA-ZäöüÄÖÜß]/g, "");
  if (letters.length < 3) return trimmed;
  const upperCount = (letters.match(/[A-ZÄÖÜ]/g) ?? []).length;
  const upperRatio = upperCount / letters.length;

  // Threshold 0.7: weniger als 70% uppercase → schon normaler Mixed-Case,
  // nicht antasten. "Banana Bread Baked Oats" hat ~25% uppercase (nur
  // Wortanfaenge) → bleibt. "SPAGHETTI PROTEIN EIS" hat 100% → wird
  // konvertiert.
  if (upperRatio < 0.7) return trimmed;

  // Title-Case mit deutschen Stop-Word-Ausnahmen (außer am Wortanfang).
  return trimmed
    .toLowerCase()
    .split(/(\s+)/) // split mit Whitespace-Capture damit Original-Spacing erhalten bleibt
    .map((token, idx, arr) => {
      if (!/\S/.test(token)) return token; // pures Whitespace bleibt
      // Erstes Wort wird immer kapitalisiert
      const isFirstWord = arr.slice(0, idx).every((t) => !/\S/.test(t));
      if (!isFirstWord && GERMAN_LOWERCASE_WORDS.has(token)) {
        return token;
      }
      return token.charAt(0).toUpperCase() + token.slice(1);
    })
    .join("");
}
