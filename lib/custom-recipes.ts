"use client";

import type { Recipe } from "./recipes";
import { recipes as staticRecipes } from "./recipes";
import { getSupabase } from "./supabase";
import { triggerPackMetaSync } from "./pack-meta-sync";

export type CustomRecipe = Recipe & {
  id: string;
  isCustom: true;
  createdAt: number;
};

type RecipeRow = {
  id: string;
  brand_slug: string;
  pack_slug: string;
  recipe_slug: string;
  data: Recipe;
  is_custom: boolean;
  created_at: string;
};

function rowToCustomRecipe(row: RecipeRow): CustomRecipe {
  return {
    ...row.data,
    slug: row.recipe_slug,
    packSlug: row.pack_slug,
    id: row.id,
    isCustom: true,
    createdAt: new Date(row.created_at).getTime(),
  };
}

// Both loaders explicitly filter is_custom=true. Without this filter we'd
// pull the seeded curated recipes too — those are loaded server-side via
// lib/recipes.ts#getRecipesForPack already, so re-fetching them client-side
// caused every card to appear twice in the grid.
export async function getCustomRecipesForPack(
  packSlug: string
): Promise<CustomRecipe[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .eq("pack_slug", packSlug)
    .eq("is_custom", true)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[recipes-db] getCustomRecipesForPack", error);
    return [];
  }
  // Static-Override-Rows (is_custom=true MIT slug-match in staticRecipes)
  // werden bereits vom Server-Side getRecipesForPack() als Ersatz für das
  // curated Recipe geliefert. Hier filtern wir sie raus damit das UI nicht
  // doppelt rendert (Server-Liste + Client-Liste).
  const staticSlugsInPack = new Set(
    staticRecipes.filter((r) => r.packSlug === packSlug).map((r) => r.slug)
  );
  return ((data ?? []) as RecipeRow[])
    .filter((row) => !staticSlugsInPack.has(row.recipe_slug))
    .map(rowToCustomRecipe);
}

export async function getCustomRecipe(
  packSlug: string,
  recipeSlug: string
): Promise<CustomRecipe | undefined> {
  const supabase = getSupabase();
  if (!supabase) return undefined;
  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .eq("pack_slug", packSlug)
    .eq("recipe_slug", recipeSlug)
    .eq("is_custom", true)
    .maybeSingle();
  if (error) {
    console.error("[recipes-db] getCustomRecipe", error);
    return undefined;
  }
  return data ? rowToCustomRecipe(data) : undefined;
}

// Counts existing custom recipes for a pack — used to auto-assign sequential
// recipe.number values to new custom cards. Cheap (head=true), no row fetch.
export async function countCustomRecipesForPack(
  packSlug: string
): Promise<number> {
  const supabase = getSupabase();
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from("recipes")
    .select("*", { count: "exact", head: true })
    .eq("pack_slug", packSlug)
    .eq("is_custom", true);
  if (error) {
    console.error("[recipes-db] countCustomRecipesForPack", error);
    return 0;
  }
  return count ?? 0;
}

export async function addCustomRecipe(
  recipe: Omit<CustomRecipe, "id" | "isCustom" | "createdAt" | "number"> & {
    brandSlug: string;
    // Curated-recipe count for this pack — passed in by the editor so we can
    // assign the next sequential number without a second roundtrip to read
    // static-recipe metadata. Custom cards land at baseRecipeCount + customCount
    // + 1 so the Mega-Number in the Minimal layout reads naturally instead of
    // showing a placeholder "99".
    baseRecipeCount: number;
  }
): Promise<CustomRecipe | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { brandSlug, slug: recipeSlug, packSlug, baseRecipeCount, ...rest } =
    recipe;

  const customCount = await countCustomRecipesForPack(packSlug);
  const number = baseRecipeCount + customCount + 1;

  const dataPayload: Recipe = {
    ...rest,
    slug: recipeSlug,
    packSlug,
    number,
  };

  const { data, error } = await supabase
    .from("recipes")
    .insert({
      brand_slug: brandSlug,
      pack_slug: packSlug,
      recipe_slug: recipeSlug,
      data: dataPayload,
      is_custom: true,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[recipes-db] addCustomRecipe", error);
    return null;
  }
  // Pack-Meta-Auto-Sync mit force=true: neuer Recipe -> Vorwort/Meta
  // MUSS aktualisiert werden, auch wenn der User vorher manuell editiert
  // hat. Sonst koennte ein "Meine 7 liebsten Rezepte"-Vorwort hartnaeckig
  // stehen bleiben obwohl jetzt 8 Rezepte im Pack sind, oder umgekehrt
  // veraltete namentliche Erwaehnungen bei Delete.
  triggerPackMetaSync(brandSlug, packSlug, { force: true });
  return rowToCustomRecipe(data);
}

export async function removeCustomRecipe(id: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  // Vor dem Delete brandSlug+packSlug ermitteln, damit wir nach erfolgreichem
  // Delete den Auto-Sync triggern koennen.
  const { data: row } = await supabase
    .from("recipes")
    .select("brand_slug, pack_slug")
    .eq("id", id)
    .maybeSingle();
  const { error } = await supabase.from("recipes").delete().eq("id", id);
  if (error) {
    console.error("[recipes-db] removeCustomRecipe", error);
    return false;
  }
  if (row?.brand_slug && row?.pack_slug) {
    // force=true: ein geloeschtes Rezept darf NIEMALS im Vorwort
    // namentlich stehen bleiben, auch wenn der User vorher manuell am
    // Vorwort editiert hat. Sonst "Luegen-Vorwort" im Druck-PDF.
    triggerPackMetaSync(row.brand_slug, row.pack_slug, { force: true });
  }
  return true;
}

// Update an existing custom recipe by id. The full Recipe object is written
// to the `data` JSONB column (in-place replace, not partial-merge — the
// editor always sends the full payload). slug + packSlug stay inside data
// so the existing reader code keeps working unchanged. recipe.number is
// preserved from the existing row to avoid renumbering side-effects (e.g.
// the Minimal-Layout's mega-number jumping around when titles change).
export async function updateCustomRecipe(
  id: string,
  recipe: Omit<CustomRecipe, "id" | "isCustom" | "createdAt">
): Promise<CustomRecipe | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("recipes")
    .update({
      recipe_slug: recipe.slug,
      data: {
        ...recipe,
      } as Recipe,
    })
    .eq("id", id)
    .eq("is_custom", true)
    .select("*")
    .single();

  if (error) {
    console.error("[recipes-db] updateCustomRecipe", error);
    return null;
  }
  const result = rowToCustomRecipe(data);
  // Auch Title/Inhalt-Edits eines bestehenden Recipes triggern Auto-Sync,
  // weil die Pack-Tagline/Description konkrete Rezeptnamen referenzieren kann.
  triggerPackMetaSync(data.brand_slug, data.pack_slug);
  return result;
}

// Fetch a single custom recipe by id — needed for the edit-page's initial
// state hydration (the route has the recipe-slug but the editor wants the
// db id for the UPDATE call).
export async function getCustomRecipeById(
  id: string
): Promise<CustomRecipe | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .eq("id", id)
    .eq("is_custom", true)
    .maybeSingle();
  if (error) {
    console.error("[recipes-db] getCustomRecipeById", error);
    return null;
  }
  return data ? rowToCustomRecipe(data) : null;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}
