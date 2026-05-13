// Zentrales Formatting fuer Ingredient-Amount-Strings. Muss in JEDEM
// Layout (Web + PDF) konsistent benutzt werden — sonst sieht die App
// auf einer Karte "n. A." und auf der naechsten "Nach Geschmack".
//
// Standardisierte Faelle:
//   "n. A." / "n.a." / "n.A." / "na" / "N.A." → "Nach Geschmack"
//   "nach geschmack" / "nach augenmaß" → "Nach Geschmack"
//   leerer String → leerer String
//
// Andere Abkuerzungen bleiben (EL, TL, ml, g, kg, Prise, Stk, Pck).
// Plus generelles Auto-Capitalize fuer den ersten Buchstaben — damit
// "nach Belieben" → "Nach Belieben" wird.

const NACH_GESCHMACK_PATTERNS = [
  /^n\.?\s*a\.?$/i,           // "n.a.", "n. a.", "na", "N.A."
  /^na$/i,                     // bare "na"
  /^nach\s+geschmack$/i,
  /^nach\s+augenma[ßss]+$/i,
  /^nach\s+belieben$/i,
  /^nach\s+bedarf$/i,
  /^je\s+nach\s+geschmack$/i,
  /^etwas$/i,
];

/**
 * Formatiert einen Ingredient-Amount-String fuer die UI:
 * - "n. A." → "Nach Geschmack"
 * - Capitalisiert ersten Buchstaben sonst
 * - Leerer String bleibt leer
 */
export function formatIngredientAmount(amount: string): string {
  if (!amount) return "";
  const trimmed = amount.trim();
  if (trimmed.length === 0) return "";

  for (const pattern of NACH_GESCHMACK_PATTERNS) {
    if (pattern.test(trimmed)) return "Nach Geschmack";
  }

  // Auto-Capitalize: "nach Belieben" → "Nach Belieben"
  // (lower-case ersten Buchstaben wenn nicht schon upper-case oder Zahl)
  const firstChar = trimmed.charAt(0);
  if (firstChar >= "a" && firstChar <= "z") {
    return firstChar.toUpperCase() + trimmed.slice(1);
  }
  return trimmed;
}

/**
 * True wenn der amount-String "lang" ist (> 10 Zeichen). Wird von Web +
 * PDF gleichermassen genutzt, um die Row-Alignment zu adjustieren
 * (alignItems: center vs flex-start bei wrapping amount).
 */
export function isLongAmount(formattedAmount: string): boolean {
  return formattedAmount.length > 10;
}
