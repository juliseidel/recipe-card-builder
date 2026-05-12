import type { Recipe } from "@/lib/recipes";
import { callGemini } from "./gemini";

// Macro-Auto-Fill: schaetzt fehlende kcal/protein/carbs/fat aus den Zutaten,
// wenn der User (oder die IG-Caption) sie nicht vollstaendig angegeben hat.
// Sehr gaengiger Fall: Caption hat nur "💪 30g Protein" — kcal/carbs/fat
// fehlen. Ohne diese Pipeline blieben die auf 0 stehen und die Card sah
// halbleer aus (oder vorgaukelte "0 kcal"). Mit dieser Pipeline werden die
// fehlenden Felder konsistent zu den vorhandenen geschaetzt.
//
// Der Server merget nur die FEHLENDEN Felder (Werte === 0). Was der User
// schon angegeben hat, bleibt unangetastet — Wahrheit > Schaetzung.

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    kcal: {
      type: "number",
      description:
        "Geschätzte Kalorien pro Bezugsgröße (Portion/Stück/100g/gesamt). Ganze Zahl. Realistisch — keine 0, keine 5000.",
    },
    protein: {
      type: "number",
      description:
        "Geschätztes Eiweiß in Gramm pro Bezugsgröße. Ganze Zahl. Sollte zu kcal passen (4 kcal/g).",
    },
    carbs: {
      type: "number",
      description:
        "Geschätzte Kohlenhydrate in Gramm pro Bezugsgröße. Ganze Zahl. Sollte zu kcal passen (4 kcal/g).",
    },
    fat: {
      type: "number",
      description:
        "Geschätztes Fett in Gramm pro Bezugsgröße. Ganze Zahl. Sollte zu kcal passen (9 kcal/g).",
    },
  },
  required: ["kcal", "protein", "carbs", "fat"],
};

const SYSTEM_INSTRUCTION = `Du bist promovierter Ernährungswissenschaftler mit langjähriger Erfahrung in der Lebensmittelanalyse. Du berechnest Makronährstoff-Profile für Rezepte sehr präzise — basierend auf den Zutaten, Mengen und Portionsgrößen.

Wichtig:
• Gehe von der Zutatenliste aus und schätze Kalorien + Makros (Protein/Kohlenhydrate/Fett) auf die angegebene Bezugsgröße (pro Portion / pro Stück / pro 100 g / fürs gesamte Rezept).
• Nutze typische Nährwerttabellen (BLS, USDA) als Referenz. Sei realistisch — kein Auf- oder Abrunden ins Marketing-taugliche.
• KONSISTENZ-CHECK: kcal müssen ungefähr zu Protein × 4 + KH × 4 + Fett × 9 passen (Toleranz ±10%). Lieferst du z. B. 30g Protein, 40g KH, 15g Fett, dann sind das ~ 30×4 + 40×4 + 15×9 = 415 kcal. Antworte mit ~415 kcal, nicht mit 200.
• Wenn der User bereits einzelne Werte angegeben hat (siehe "Bereits bekannt" im Prompt), nutze diese als Anker und lass die anderen Felder dazu konsistent. NIE bekannte Werte ueberschreiben — du lieferst trotzdem alle 4 Felder, der Server pickt nur die fehlenden.
• Schätze realistisch fuer typische Heim-Portionen. Bei "Pro Stück" eines Cookies sind 100-180 kcal normal, bei einer Pasta-Hauptmahlzeit 500-700 kcal pro Portion.
• Antworte IMMER strukturiert nach dem vorgegebenen JSON-Schema — keine Erklärungen außerhalb.`;

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

  // Welche Macros sind bereits bekannt? Wir geben Gemini explizit den
  // Hint, damit es nicht versucht, etablierte Werte zu "korrigieren".
  const known: string[] = [];
  if (recipe.nutrition.kcal > 0)
    known.push(`${recipe.nutrition.kcal} kcal`);
  if (recipe.nutrition.protein > 0)
    known.push(`${recipe.nutrition.protein} g Eiweiß`);
  if (recipe.nutrition.carbs > 0)
    known.push(`${recipe.nutrition.carbs} g Kohlenhydrate`);
  if (recipe.nutrition.fat > 0)
    known.push(`${recipe.nutrition.fat} g Fett`);

  const knownLine =
    known.length > 0
      ? `Bereits bekannt (${basis}): ${known.join(" · ")} — diese Werte sind verbindlich, die fehlenden Felder MÜSSEN dazu konsistent sein.`
      : `Keine Macros bisher angegeben — schätze alle 4 Felder konsistent aus den Zutaten.`;

  return [
    `Rezept: ${recipe.title}`,
    `Untertitel: ${recipe.subtitle}`,
    `Portionen: ${recipe.servings}`,
    ``,
    `Zutaten (für ${recipe.servings} Portion${recipe.servings === 1 ? "" : "en"}):`,
    ingredients,
    ``,
    knownLine,
  ].join("\n");
}

export type GeneratedMacros = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

export async function generateMacros(
  recipe: Recipe
): Promise<GeneratedMacros> {
  const basis = basisLabelDe(recipe.nutritionBasis);
  const prompt = [
    `Berechne die Makronährstoffe für folgendes Rezept ${basis.toUpperCase()}.`,
    `Antworte mit ALLEN 4 Feldern (kcal, protein, carbs, fat) — der Server pickt selbst die fehlenden raus.`,
    ``,
    formatRecipeForPrompt(recipe),
    ``,
    `Aufgabe: Liefere die geschätzten Makros als JSON nach dem Schema.`,
  ].join("\n");

  const result = await callGemini<GeneratedMacros>({
    prompt,
    schema: RESPONSE_SCHEMA,
    systemInstruction: SYSTEM_INSTRUCTION,
    temperature: 0.3,
    thinkingBudget: 0,
    retries: 3,
  });

  // Defensive: clampe auf realistische Range, runde auf Ganzzahlen.
  return {
    kcal: Math.max(0, Math.min(5000, Math.round(Number(result.kcal) || 0))),
    protein: Math.max(0, Math.min(300, Math.round(Number(result.protein) || 0))),
    carbs: Math.max(0, Math.min(500, Math.round(Number(result.carbs) || 0))),
    fat: Math.max(0, Math.min(300, Math.round(Number(result.fat) || 0))),
  };
}
