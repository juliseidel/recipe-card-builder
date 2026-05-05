"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Brand } from "@/lib/brands";
import type { Pack } from "@/lib/packs";
import type { Recipe } from "@/lib/recipes";
import {
  getCustomRecipe,
  getCustomRecipesForPack,
} from "@/lib/custom-recipes";
import type { CustomRecipe } from "@/lib/custom-recipes";
import { SiteHeader } from "./site-header";
import { RecipeDetailLayout } from "./recipe-detail-layout";

type Props = {
  brand: Brand;
  pack: Pack;
  recipeSlug: string;
  staticRecipes: Recipe[];
};

export function CustomRecipeView({
  brand,
  pack,
  recipeSlug,
  staticRecipes,
}: Props) {
  const [recipe, setRecipe] = useState<CustomRecipe | null>(null);
  const [allRecipes, setAllRecipes] = useState<(Recipe | CustomRecipe)[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const found = getCustomRecipe(pack.slug, recipeSlug);
    setRecipe(found ?? null);

    const customRecipes = getCustomRecipesForPack(pack.slug);
    // Custom recipes appear first (newest first), then static
    setAllRecipes([...customRecipes, ...staticRecipes]);
    setLoaded(true);
  }, [pack.slug, recipeSlug, staticRecipes]);

  if (!loaded) {
    return (
      <div
        className="flex min-h-screen flex-col"
        style={{ background: pack.mood.background }}
      >
        <SiteHeader />
        <main className="flex flex-1 items-center justify-center">
          <div
            className="font-mono text-[12px] uppercase tracking-[0.18em]"
            style={{ color: pack.mood.inkSoft }}
          >
            Karte wird geladen…
          </div>
        </main>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div
        className="flex min-h-screen flex-col"
        style={{ background: pack.mood.background }}
      >
        <SiteHeader />
        <main className="flex flex-1 flex-col items-center justify-center gap-4">
          <span
            className="font-display text-[36px] italic"
            style={{ color: pack.mood.ink }}
          >
            Karte nicht gefunden
          </span>
          <p
            className="text-[14px]"
            style={{ color: pack.mood.inkSoft }}
          >
            Diese Karte gibt es in deinem Browser nicht (mehr).
          </p>
          <Link
            href={`/${brand.slug}/${pack.slug}`}
            className="mt-2 inline-flex items-center gap-2 rounded-full px-5 py-2 text-[13px] font-semibold"
            style={{
              background: pack.mood.ink,
              color: pack.mood.background,
            }}
          >
            Zurück zu {pack.title}
          </Link>
        </main>
      </div>
    );
  }

  const idx = allRecipes.findIndex((r) => r.slug === recipe.slug);
  const previous =
    idx > 0
      ? {
          href: `/${brand.slug}/${pack.slug}/${allRecipes[idx - 1].slug}`,
          title: allRecipes[idx - 1].title,
        }
      : null;
  const next =
    idx < allRecipes.length - 1
      ? {
          href: `/${brand.slug}/${pack.slug}/${allRecipes[idx + 1].slug}`,
          title: allRecipes[idx + 1].title,
        }
      : null;

  return (
    <RecipeDetailLayout
      brand={brand}
      pack={pack}
      recipe={recipe}
      totalRecipes={allRecipes.length}
      previous={previous}
      next={next}
      isCustom
    />
  );
}
