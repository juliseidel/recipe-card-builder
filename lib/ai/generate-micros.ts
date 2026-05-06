import type { Recipe, Micronutrient } from "@/lib/recipes";
import { callGemini } from "./gemini";

// Schema mirrors `Micronutrient` from lib/recipes.ts. Gemini fills it freely:
// no fixed micro list — it picks whichever 5–10 micros are nutritionally
// relevant for the given recipe and ranks them by % EU-NRV.
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    micros: {
      type: "array",
      description:
        "Die 5–10 ernährungsphysiologisch relevantesten Mikronährstoffe (Vitamine, Mineralien) pro Portion, sortiert absteigend nach %TBD",
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
• Liefere 5 bis 10 Mikronährstoffe — nur diejenigen, bei denen das Rezept relevante Mengen liefert (mindestens 8% der EU-Tagesbedarf-Empfehlung).
• Sei realistisch: Wenn ein Rezept ein süßes Snack-Gebäck ist, dominiert vielleicht nur Calcium und ein bisschen Vitamin B2. Wenn es ein Hauptgericht mit Gemüse ist, werden mehr relevant.
• Ranking: absteigend nach % Tagesbedarf, der wertvollste Mikronährstoff zuerst.
• Beachte: MORE Sahne Protein liefert oft Calcium + Vitamin B12, Eier liefern Vitamin A/D/B12, grünes Gemüse liefert Folat + Eisen, Hülsenfrüchte liefern Eisen + Magnesium etc.
• Antworte IMMER strukturiert nach dem vorgegebenen JSON-Schema — keine Erklärungen außerhalb.`;

function formatRecipeForPrompt(recipe: Recipe): string {
  const ingredients = recipe.ingredients
    .map((i) => `  • ${i.amount} ${i.name}${i.note ? ` (${i.note})` : ""}`)
    .join("\n");

  return [
    `Rezept: ${recipe.title}`,
    `Untertitel: ${recipe.subtitle}`,
    `Portionen: ${recipe.servings}`,
    ``,
    `Zutaten (für ${recipe.servings} Portion${recipe.servings === 1 ? "" : "en"}):`,
    ingredients,
    ``,
    `Bekannte Makros pro Portion: ${recipe.nutrition.kcal} kcal · ${recipe.nutrition.protein}g Eiweiß · ${recipe.nutrition.carbs}g KH · ${recipe.nutrition.fat}g Fett`,
  ].join("\n");
}

export async function generateMicros(recipe: Recipe): Promise<Micronutrient[]> {
  const prompt = [
    `Berechne die Mikronährstoffe für folgendes Rezept PRO PORTION.`,
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
    // Sanity cap to prevent the rare "infinite \b" Gemini bug from looping
    // past the model's internal limit (we observed ~134KB of garbage on one
    // recipe). 4096 tokens is plenty for a 5–10 micros JSON list.
    maxOutputTokens: 4096,
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
    .slice(0, 10);

  return cleaned;
}

// Gemini's structured-JSON output occasionally garbles non-ASCII characters
// (notably µ → "," when echoed back). This restores the original units and
// normalises whitespace + decimal separators so the UI shows clean labels.
function normalizeAmount(raw: string): string {
  let s = raw.trim();
  // µg variants that came back broken: `,",g`, `","g`, `\",\"g` etc.
  s = s.replace(/[",\\]+g\b/g, "µg");
  // mcg → µg for visual consistency (after the broken-µ fix)
  s = s.replace(/\bmcg\b/g, "µg");
  // Stray double-quotes inside the value
  s = s.replace(/"/g, "");
  // Collapse double spaces
  s = s.replace(/\s+/g, " ").trim();
  return s;
}
