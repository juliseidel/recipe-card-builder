import type { Recipe } from "@/lib/recipes";

export type IngredientItem = {
  amount: string;
  name: string;
  note?: string;
};

export type IngredientGroup = {
  name: string | null;
  items: IngredientItem[];
};

// Mirrors the web component's logic so the PDF respects the same
// "für die Mayo / Teig / Topping" subgrouping the cards already use.
function detectGroup(
  note?: string
): { group: string | null; remainingNote?: string } {
  if (!note) return { group: null };
  const fuer = note.match(/^für (?:die|den|das)\s+(.+?)(?:\s·\s*(.*))?$/i);
  if (fuer) {
    return {
      group: fuer[1].trim(),
      remainingNote: fuer[2]?.trim() || undefined,
    };
  }
  const keyword = note.match(
    /^(Teig|Topping|Sauce|Belag|Glasur|Streusel|Füllung|Boden|Creme|Krem)(?:\s·\s*(.*))?$/i
  );
  if (keyword) {
    return {
      group: keyword[1],
      remainingNote: keyword[2]?.trim() || undefined,
    };
  }
  return { group: null };
}

export function groupIngredients(
  ingredients: Recipe["ingredients"]
): IngredientGroup[] {
  const main: IngredientGroup = { name: null, items: [] };
  const groups = new Map<string, IngredientGroup>();

  ingredients.forEach((ing) => {
    const { group, remainingNote } = detectGroup(ing.note);
    const item: IngredientItem = {
      amount: ing.amount,
      name: ing.name,
      note: remainingNote,
    };
    if (group) {
      if (!groups.has(group)) groups.set(group, { name: group, items: [] });
      groups.get(group)!.items.push(item);
    } else {
      main.items.push(item);
    }
  });

  const result: IngredientGroup[] = [];
  if (main.items.length > 0) result.push(main);
  groups.forEach((g) => result.push(g));
  return result;
}

export function totalTime(recipe: Recipe): number {
  return recipe.prepTime + (recipe.cookTime ?? 0);
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function portionsLabel(servings: number): string {
  return servings === 1 ? "Portion" : "Portionen";
}
