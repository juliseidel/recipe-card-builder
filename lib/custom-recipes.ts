"use client";

import type { Recipe } from "./recipes";
import { getSupabase } from "./supabase";

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
  return (data ?? []).map(rowToCustomRecipe);
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
  return rowToCustomRecipe(data);
}

export async function removeCustomRecipe(id: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase.from("recipes").delete().eq("id", id);
  if (error) {
    console.error("[recipes-db] removeCustomRecipe", error);
    return false;
  }
  return true;
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
