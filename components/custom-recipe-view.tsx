"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Brand } from "@/lib/brands";
import type { Pack } from "@/lib/packs";
import type { Recipe } from "@/lib/recipes";
import {
  getCustomRecipe,
  getCustomRecipesForPack,
  removeCustomRecipe,
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
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const confirmTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  useEffect(() => {
    let active = true;
    (async () => {
      const [found, customList] = await Promise.all([
        getCustomRecipe(pack.slug, recipeSlug),
        getCustomRecipesForPack(pack.slug),
      ]);
      if (!active) return;
      setRecipe(found ?? null);
      setAllRecipes([...customList, ...staticRecipes]);
      setLoaded(true);
    })();
    return () => {
      active = false;
    };
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
          <p className="text-[14px]" style={{ color: pack.mood.inkSoft }}>
            Diese Karte existiert nicht (mehr).
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

  const handleDeleteClick = async () => {
    if (!recipe) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      if (confirmTimeout.current) clearTimeout(confirmTimeout.current);
      confirmTimeout.current = setTimeout(
        () => setConfirmingDelete(false),
        3000
      );
      return;
    }
    setDeleting(true);
    await removeCustomRecipe(recipe.id);
    router.push(`/${brand.slug}/${pack.slug}`);
  };

  const deleteAction = (
    <button
      type="button"
      onClick={handleDeleteClick}
      onMouseLeave={() => {
        if (!deleting) setConfirmingDelete(false);
      }}
      disabled={deleting}
      className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-colors"
      style={
        confirmingDelete
          ? {
              borderColor: "transparent",
              background: "#dc2626",
              color: "white",
            }
          : {
              borderColor: pack.mood.ink + "20",
              color: pack.mood.inkSoft,
              background: "rgba(255,255,255,0.6)",
            }
      }
    >
      {deleting ? (
        <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
          <path
            d="M3 4h8m-7 0v7a1 1 0 001 1h4a1 1 0 001-1V4M5.5 4V2.5h3V4M6 6.5v3M8 6.5v3"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {deleting
        ? "Lösche…"
        : confirmingDelete
        ? "Wirklich löschen?"
        : "Löschen"}
    </button>
  );

  return (
    <RecipeDetailLayout
      brand={brand}
      pack={pack}
      recipe={recipe}
      totalRecipes={allRecipes.length}
      previous={previous}
      next={next}
      isCustom
      deleteAction={deleteAction}
    />
  );
}
