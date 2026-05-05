"use client";

import { useEffect, useState } from "react";
import type { Brand } from "@/lib/brands";
import type { Pack } from "@/lib/packs";
import type { Recipe } from "@/lib/recipes";
import { getCustomRecipesForPack } from "@/lib/custom-recipes";
import type { CustomRecipe } from "@/lib/custom-recipes";
import { NewRecipeCard } from "./new-recipe-card";
import { RecipeCardPreview } from "./recipe-card-preview";

type RecipeGridProps = {
  brand: Brand;
  pack: Pack;
  staticRecipes: Recipe[];
};

export function RecipeGrid({ brand, pack, staticRecipes }: RecipeGridProps) {
  const [customRecipes, setCustomRecipes] = useState<CustomRecipe[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setCustomRecipes(getCustomRecipesForPack(pack.slug));
    setHydrated(true);

    // Listen for storage changes from other tabs
    const onStorage = (e: StorageEvent) => {
      if (e.key === "rcb:custom-recipes:v1") {
        setCustomRecipes(getCustomRecipesForPack(pack.slug));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [pack.slug]);

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <NewRecipeCard brand={brand} pack={pack} />

      {customRecipes.map((recipe) => (
        <RecipeCardPreview
          key={recipe.id}
          brand={brand}
          pack={pack}
          recipe={recipe}
        />
      ))}

      {staticRecipes.map((recipe) => (
        <RecipeCardPreview
          key={recipe.slug}
          brand={brand}
          pack={pack}
          recipe={recipe}
        />
      ))}

      {!hydrated ? null : null}
    </div>
  );
}
