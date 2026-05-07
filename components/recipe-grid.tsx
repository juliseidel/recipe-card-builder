"use client";

import { useEffect, useState } from "react";
import type { Brand } from "@/lib/brands";
import type { Pack } from "@/lib/packs";
import type { Recipe } from "@/lib/recipes";
import {
  getCustomRecipesForPack,
  removeCustomRecipe,
} from "@/lib/custom-recipes";
import type { CustomRecipe } from "@/lib/custom-recipes";
import {
  getHiddenKeys,
  hideRecipe,
  makeHiddenKey,
} from "@/lib/hidden-recipes";
import type { HiddenKey } from "@/lib/hidden-recipes";
import { NewRecipeCard } from "./new-recipe-card";
import { RecipeCardPreview } from "./recipe-card-preview";

type RecipeGridProps = {
  brand: Brand;
  pack: Pack;
  staticRecipes: Recipe[];
};

export function RecipeGrid({ brand, pack, staticRecipes }: RecipeGridProps) {
  const [customRecipes, setCustomRecipes] = useState<CustomRecipe[]>([]);
  const [hiddenKeys, setHiddenKeys] = useState<Set<HiddenKey>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const [custom, hidden] = await Promise.all([
        getCustomRecipesForPack(pack.slug),
        getHiddenKeys(),
      ]);
      if (!active) return;
      setCustomRecipes(custom);
      setHiddenKeys(hidden);
      setLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, [pack.slug]);

  const visibleStaticRecipes = staticRecipes.filter(
    (r) => !hiddenKeys.has(makeHiddenKey(brand.slug, pack.slug, r.slug))
  );

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
          onDelete={async (id) => {
            setCustomRecipes((prev) => prev.filter((r) => r.id !== id));
            const ok = await removeCustomRecipe(id);
            if (!ok) {
              const fresh = await getCustomRecipesForPack(pack.slug);
              setCustomRecipes(fresh);
              return;
            }
            // Drop the workspace cache so the pack-card recipe-count badge
            // ticks down on back-navigation. Pack-detail is fine — this
            // component already reflects the change in local state.
            void revalidateWorkspace(brand.slug, pack.slug);
          }}
        />
      ))}

      {visibleStaticRecipes.map((recipe) => (
        <RecipeCardPreview
          key={recipe.slug}
          brand={brand}
          pack={pack}
          recipe={recipe}
          onDelete={async () => {
            // Hide static recipe (mark in DB, removable later)
            const key = makeHiddenKey(brand.slug, pack.slug, recipe.slug);
            setHiddenKeys((prev) => new Set([...prev, key]));
            const ok = await hideRecipe(brand.slug, pack.slug, recipe.slug);
            if (!ok) {
              setHiddenKeys((prev) => {
                const next = new Set(prev);
                next.delete(key);
                return next;
              });
              return;
            }
            // Same revalidate as above — keeps the workspace badge truthful
            // when the user hides a curated card.
            void revalidateWorkspace(brand.slug, pack.slug);
          }}
        />
      ))}
    </div>
  );
}

// Fire-and-forget cache invalidation for the workspace + pack-detail server
// renders after a delete/hide. Pack-detail mostly mirrors local state already
// (this component re-renders), but a back-navigation to /[brand] would
// otherwise show a stale recipe-count badge for ~30 s.
async function revalidateWorkspace(brandSlug: string, packSlug: string) {
  await fetch("/api/packs/revalidate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ brandSlug, packSlug }),
  }).catch(() => {});
}
