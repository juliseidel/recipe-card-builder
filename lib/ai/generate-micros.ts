import type { Recipe, Micronutrient } from "@/lib/recipes";
import { callGemini } from "./gemini";

// Schema mirrors `Micronutrient` from lib/recipes.ts. Gemini fills it freely:
// no fixed micro list — it picks whichever micros are nutritionally relevant
// for the given recipe and ranks them by % EU-NRV.
//
// Range absichtlich weit (1–12): bei einer 3-Zutaten-Eisbowl gibt es
// ehrlich vielleicht nur 3 nennenswerte Mikros (Vitamin C aus dem Obst,
// Calcium + B12 aus dem Quark/Sahne Protein) — das vorherige "5–10"
// zwang Gemini entweder zur Halluzination oder zu Empty-Array, beides
// hat den Mikros-Block fuer das ganze Rezept zerstoert. Mit "1–12"
// kann Gemini ehrlich antworten und die Karte zeigt das echte Profil.
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    micros: {
      type: "array",
      description:
        "Die ernährungsphysiologisch relevantesten Mikronährstoffe (Vitamine, Mineralien) pro Portion, sortiert absteigend nach %TBD. Liefere so viele wie das Rezept ehrlich hergibt — typisch 3–10, mindestens 1 wenn überhaupt etwas relevant ist, maximal 12. Erfinde nichts hinzu, nur um eine Mindestanzahl zu erreichen.",
      minItems: 1,
      maxItems: 12,
      items: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description:
              "Mikronährstoff-Name auf Deutsch (z. B. 'Vitamin C', 'Eisen', 'Magnesium', 'Vitamin B12', 'Omega-3', 'Folat')",
          },
          amount: {
            type: "string",
            description:
              "Geschätzte Menge pro Portion mit Einheit, z. B. '45 mg', '120 µg', '1,8 g'",
          },
          pctDaily: {
            type: "number",
            description:
              "Geschätzter Prozentsatz des EU-Tagesbedarfs (NRV) pro Portion. Ganze Zahl 0–500.",
          },
        },
        required: ["name", "amount", "pctDaily"],
      },
    },
  },
  required: ["micros"],
};

const SYSTEM_INSTRUCTION = `Du bist promovierter Ernährungswissenschaftler mit langjähriger Erfahrung in der Lebensmittelanalyse. Du berechnest Mikronährstoff-Profile für Rezepte sehr präzise — basierend auf den Zutaten, Mengen und Portionsgrößen.

Wichtig:
• Gehe von der Zutatenliste aus und schätze die enthaltenen Mikronährstoffe pro Portion. Nutze typische Nährwerttabellen (BLS, USDA) als Referenz.
• Identifiziere für jedes Rezept individuell, welche Mikronährstoffe ernährungsphysiologisch relevant sind — nicht jedes Rezept ist reich an Vitamin C, manche sind reich an Eisen, andere an Magnesium oder Calcium.
• Liefere die wirklich nennenswerten Mikronährstoffe (mindestens 8% der EU-Tagesbedarf-Empfehlung pro Portion). Typisch sind 3–10 Mikros pro Rezept; bei sehr kurzen Rezepten (3–4 Zutaten) können es auch nur 1–3 sein, bei sehr reichhaltigen Bowls bis zu 12. LIEBER 3 ehrliche als 5 erzwungene — fülle NIE mit Mikros auf, die das Rezept gar nicht nennenswert liefert.
• Sei realistisch: Wenn ein Rezept ein süßes Snack-Gebäck ist, dominiert vielleicht nur Calcium und ein bisschen Vitamin B2. Wenn es ein Hauptgericht mit Gemüse ist, werden mehr relevant.
• Ranking: absteigend nach % Tagesbedarf, der wertvollste Mikronährstoff zuerst.
• Beachte: MORE Sahne Protein liefert oft Calcium + Vitamin B12, Eier liefern Vitamin A/D/B12, grünes Gemüse liefert Folat + Eisen, Hülsenfrüchte liefern Eisen + Magnesium etc.
• Antworte IMMER strukturiert nach dem vorgegebenen JSON-Schema — keine Erklärungen außerhalb.`;

// Human-readable label for whatever basis the macros are reported in. Gemini
// uses this verbatim so the micros it derives stay on the same scale as the
// macros the user typed in (e.g. a muffin recipe enters macros "pro Stück"
// — micros must come back per Stück too, not per portion).
function basisLabelDe(basis: Recipe["nutritionBasis"]): string {
  switch (basis) {
    case "piece":
      return "pro Stück";
    case "per100g":
      return "pro 100 g";
    case "total":
      return "für das gesamte Rezept";
    case "portion":
    case undefined:
    default:
      return "pro Portion";
  }
}

function formatRecipeForPrompt(recipe: Recipe): string {
  const ingredients = recipe.ingredients
    .map((i) => `  • ${i.amount} ${i.name}${i.note ? ` (${i.note})` : ""}`)
    .join("\n");

  const basis = basisLabelDe(recipe.nutritionBasis);

  return [
    `Rezept: ${recipe.title}`,
    `Untertitel: ${recipe.subtitle}`,
    `Portionen: ${recipe.servings}`,
    ``,
    `Zutaten (für ${recipe.servings} Portion${recipe.servings === 1 ? "" : "en"}):`,
    ingredients,
    ``,
    `Bekannte Makros ${basis}: ${recipe.nutrition.kcal} kcal · ${recipe.nutrition.protein}g Eiweiß · ${recipe.nutrition.carbs}g KH · ${recipe.nutrition.fat}g Fett`,
  ].join("\n");
}

export async function generateMicros(recipe: Recipe): Promise<Micronutrient[]> {
  const basis = basisLabelDe(recipe.nutritionBasis);
  const prompt = [
    `Berechne die Mikronährstoffe für folgendes Rezept ${basis.toUpperCase()}.`,
    `WICHTIG: Die Werte müssen sich auf dieselbe Bezugsgröße (${basis}) beziehen wie die Makros oben.`,
    ``,
    formatRecipeForPrompt(recipe),
    ``,
    `Aufgabe: Liefere die wichtigsten Mikronährstoffe als JSON nach dem Schema.`,
  ].join("\n");

  const result = await callGemini<{ micros: Micronutrient[] }>({
    prompt,
    schema: RESPONSE_SCHEMA,
    systemInstruction: SYSTEM_INSTRUCTION,
    temperature: 0.3,
    // maxOutputTokens absichtlich NICHT gesetzt: bei kurzen Rezepten
    // hat ein 4096er-Cap Gemini vermutlich nicht direkt limitiert, aber
    // bei strukturiert-validiertem JSON-Output ist es sauberer, das
    // Modell selbst entscheiden zu lassen — wir wollen ja eher mehr
    // Detail-Notes als weniger. Keine bekannte Regression dadurch.
    // Thinking off: this is pure structured extraction, not reasoning.
    thinkingBudget: 0,
    retries: 3,
  });

  // Defensive: clamp pctDaily, normalize amount strings, dedupe by name, sort
  const seen = new Set<string>();
  const cleaned = (result.micros ?? [])
    .filter((m) => m.name && m.amount)
    .map((m) => ({
      name: m.name.trim(),
      amount: normalizeAmount(m.amount),
      pctDaily: Math.max(
        0,
        Math.min(999, Math.round(Number(m.pctDaily) || 0))
      ),
    }))
    .filter((m) => {
      const key = m.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => (b.pctDaily ?? 0) - (a.pctDaily ?? 0))
    // Schema erlaubt jetzt bis zu 12 — Cap matched. Bei kurzen Rezepten
    // kommt sowieso weniger zurueck (1–4); slice schneidet nur dann
    // wenn Gemini ueberzeugt war es gibt 10+ relevante.
    .slice(0, 12);

  return cleaned;
}

// Gemini's structured-JSON output occasionally garbles non-ASCII characters
// (notably µ → "," when echoed back). This restores the original units and
// normalises whitespace + decimal separators so the UI shows clean labels.
function normalizeAmount(raw: string): string {
  let s = raw.trim();
  // Strip Unicode BACKSPACE () — Gemini occasionally injects these in
  // front of µ when echoing back the response, leading to "\b\bµg" artefacts.
  s = s.replace(//g, "");
  // µg variants that came back broken: `,",g`, `","g`, `\",\"g`, `5g` etc.
  s = s.replace(/[",\\]+g\b/g, "µg");
  // mcg → µg for visual consistency (after the broken-µ fix)
  s = s.replace(/\bmcg\b/g, "µg");
  // Stray digit "5" or "6" before "g" where µ got mistyped (e.g. "1,5 5g µg")
  s = s.replace(/\b\d+g\s+µg\b/g, "µg");
  // Stray double-quotes inside the value
  s = s.replace(/"/g, "");
  // Collapse double spaces
  s = s.replace(/\s+/g, " ").trim();
  return s;
}
