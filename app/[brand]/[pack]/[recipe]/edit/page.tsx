"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { RecipeEditor } from "@/components/recipe-editor";
import {
  getCustomRecipe,
  type CustomRecipe,
} from "@/lib/custom-recipes";

// Edit-Route mounts the shared <RecipeEditor> with the hydrated custom
// recipe so every field starts pre-filled. The recipe lookup happens
// client-side (Supabase RLS reads run in the browser) — same pattern the
// detail page uses. Three-state loading: undefined = pending, null = not
// found / static recipe, CustomRecipe = ready.
type EditRecipePageProps = {
  params: Promise<{ brand: string; pack: string; recipe: string }>;
};

export default function EditRecipePage({ params }: EditRecipePageProps) {
  const { brand: brandSlug, pack: packSlug, recipe: recipeSlug } = use(params);
  const [recipe, setRecipe] = useState<CustomRecipe | null | undefined>(
    undefined
  );

  useEffect(() => {
    let active = true;
    void getCustomRecipe(packSlug, recipeSlug).then((r) => {
      if (active) setRecipe(r ?? null);
    });
    return () => {
      active = false;
    };
  }, [packSlug, recipeSlug]);

  if (recipe === undefined) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex flex-1 items-center justify-center text-ink-muted">
          Karte wird geladen…
        </main>
      </div>
    );
  }

  if (recipe === null) {
    // Static / curated recipes aren't editable yet (Phase 3 will add a
    // "copy-on-edit" override flow). For now we show a clear message and
    // a way back instead of an empty editor.
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <h2 className="font-display text-[22px] leading-tight">
            Diese Karte ist (noch) nicht editierbar
          </h2>
          <p className="text-[14px] text-ink-muted">
            Kuratierte Karten lassen sich gerade nur lesen. Karten, die du
            selbst angelegt hast, kannst du jederzeit bearbeiten.
          </p>
          <Link
            href={`/${brandSlug}/${packSlug}/${recipeSlug}`}
            className="rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-canvas"
          >
            Zurück zur Karte
          </Link>
        </main>
      </div>
    );
  }

  return (
    <RecipeEditor
      brandSlug={brandSlug}
      packSlug={packSlug}
      editing={{ id: recipe.id, recipe }}
    />
  );
}
