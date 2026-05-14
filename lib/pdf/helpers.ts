import { normalizeStep, type Recipe } from "@/lib/recipes";

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
    // Explicit ing.group (set by editor) wins over note-based detection
    // (which exists for the curated 37 recipes that ship as text).
    let groupName: string | null = ing.group?.trim() || null;
    let cleanedNote: string | undefined = ing.note;
    if (!groupName) {
      const detected = detectGroup(ing.note);
      groupName = detected.group;
      cleanedNote = detected.remainingNote;
    }
    const item: IngredientItem = {
      amount: ing.amount,
      name: ing.name,
      note: cleanedNote,
    };
    if (groupName) {
      if (!groups.has(groupName))
        groups.set(groupName, { name: groupName, items: [] });
      groups.get(groupName)!.items.push(item);
    } else {
      main.items.push(item);
    }
  });

  const result: IngredientGroup[] = [];
  if (main.items.length > 0) result.push(main);
  groups.forEach((g) => result.push(g));
  return result;
}

export type StepItem = {
  text: string;
  /** Original index in recipe.steps — used to keep numbering continuous
   *  across the whole list, not restart per group. */
  index: number;
};

export type StepGroup = {
  name: string | null;
  items: StepItem[];
};

// Group steps the same way ingredients are grouped: a step's optional
// `group` field means "this step belongs to the [group] section". Steps
// without a group go into the main (unnamed) group. Numbering in the
// returned items stays globally continuous so renderers don't restart.
//
// Used by every layout that wants to render "Für den Teig: 1, 2 / Für die
// Glasur: 3, 4" sectioning. Backwards-compatible with steps that ship as
// plain strings (those just don't have a group, so everything lands in
// main).
export function groupSteps(steps: Recipe["steps"]): StepGroup[] {
  const main: StepGroup = { name: null, items: [] };
  const groups = new Map<string, StepGroup>();

  steps.forEach((raw, idx) => {
    const step = normalizeStep(raw);
    const item: StepItem = { text: step.text, index: idx };
    if (step.group) {
      if (!groups.has(step.group)) {
        groups.set(step.group, { name: step.group, items: [] });
      }
      groups.get(step.group)!.items.push(item);
    } else {
      main.items.push(item);
    }
  });

  const result: StepGroup[] = [];
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

// Count + unit noun for spec-strips ("6 Stücke", "2 Portionen", "1 Portion").
// Follows nutritionBasis, not servings alone — a piece-based recipe must read
// "Stück", never "Portion" (PDF design rule: spec-strip labels follow basis).
export function servingsCountLabel(recipe: Recipe): string {
  const n = recipe.servings;
  if (recipe.nutritionBasis === "piece") {
    return n === 1 ? "1 Stück" : `${n} Stücke`;
  }
  return n === 1 ? "1 Portion" : `${n} Portionen`;
}
