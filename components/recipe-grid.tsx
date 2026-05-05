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
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const custom = await getCustomRecipesForPack(pack.slug);
      if (!active) return;
      setCustomRecipes(custom);
      setLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, [pack.slug]);

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <NewRecipeCard brand={brand} pack={pack} />

      {!loaded ? (
        <div
          className="flex aspect-[3/4] items-center justify-center rounded-[var(--radius-card)] border-2 border-dashed text-[12px] uppercase tracking-[0.18em]"
          style={{
            borderColor: pack.mood.ink + "20",
            color: pack.mood.inkSoft,
          }}
        >
          Lade eigene Karten…
        </div>
      ) : null}

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
    </div>
  );
}
