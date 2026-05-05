"use client";

import { getSupabase } from "./supabase";

export type HiddenKey = `${string}|${string}|${string}`;

export function makeHiddenKey(
  brandSlug: string,
  packSlug: string,
  recipeSlug: string
): HiddenKey {
  return `${brandSlug}|${packSlug}|${recipeSlug}`;
}

export async function getHiddenKeys(): Promise<Set<HiddenKey>> {
  const supabase = getSupabase();
  if (!supabase) return new Set();
  const { data, error } = await supabase
    .from("hidden_recipes")
    .select("brand_slug,pack_slug,recipe_slug");
  if (error) {
    console.error("[hidden-recipes] getHiddenKeys", error);
    return new Set();
  }
  return new Set(
    (data ?? []).map((r) => makeHiddenKey(r.brand_slug, r.pack_slug, r.recipe_slug))
  );
}

export async function hideRecipe(
  brandSlug: string,
  packSlug: string,
  recipeSlug: string
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase
    .from("hidden_recipes")
    .upsert(
      {
        brand_slug: brandSlug,
        pack_slug: packSlug,
        recipe_slug: recipeSlug,
      },
      { onConflict: "brand_slug,pack_slug,recipe_slug" }
    );
  if (error) {
    console.error("[hidden-recipes] hideRecipe", error);
    return false;
  }
  return true;
}

export async function restoreRecipe(
  brandSlug: string,
  packSlug: string,
  recipeSlug: string
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase
    .from("hidden_recipes")
    .delete()
    .eq("brand_slug", brandSlug)
    .eq("pack_slug", packSlug)
    .eq("recipe_slug", recipeSlug);
  if (error) {
    console.error("[hidden-recipes] restoreRecipe", error);
    return false;
  }
  return true;
}
