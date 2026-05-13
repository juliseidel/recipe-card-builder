"use client";

import { use, useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { RecipeEditor } from "@/components/recipe-editor";
import type { Recipe } from "@/lib/recipes";
import { getCustomRecipe } from "@/lib/custom-recipes";

// Edit-Route mounts the shared <RecipeEditor>. Two paths:
//
//  1. Existing custom recipe → load via getCustomRecipe(), pass {id, recipe}
//     to the editor. Save updates that row.
//
//  2. Static curated recipe (Bienen-Packs etc.) → no DB row to update, but
//     we still let the user edit. The editor mounts in "fork-on-save" mode:
//     editing.id is undefined, editing.recipe is the curated payload. On
//     save we INSERT a new custom row with the same slug. From then on
//     the lookup-resolver in getRecipesForPack / getRecipe prefers the
//     custom row over the curated one, so the user's edits become the
//     visible card without disturbing the rest of the pack.
//
//  3. Custom recipe override of a static one already exists → fall into
//     path (1) so the user keeps editing the same row rather than
//     re-forking.
//
// Three-state: undefined = pending, null = nothing found anywhere,
// { source: "custom" | "static", ... } = ready.
type EditState =
  | { kind: "loading" }
  | { kind: "not-found" }
  | { kind: "custom"; id: string; recipe: Recipe }
  | { kind: "static"; recipe: Recipe };

type EditRecipePageProps = {
  params: Promise<{ brand: string; pack: string; recipe: string }>;
};

export default function EditRecipePage({ params }: EditRecipePageProps) {
  const { brand: brandSlug, pack: packSlug, recipe: recipeSlug } = use(params);
  const [state, setState] = useState<EditState>({ kind: "loading" });

  useEffect(() => {
    let active = true;
    async function load() {
      // 1) Existing custom override? Use that.
      const custom = await getCustomRecipe(packSlug, recipeSlug);
      if (!active) return;
      if (custom) {
        setState({ kind: "custom", id: custom.id, recipe: custom });
        return;
      }
      // 2) Static curated recipe? Fetch it via the JSON API. We can't import
      // server-only getRecipe() into this client component — the route
      // /api/recipes/static-lookup returns the curated payload (or 404).
      try {
        const res = await fetch(
          `/api/recipes/static-lookup?pack=${encodeURIComponent(packSlug)}&recipe=${encodeURIComponent(recipeSlug)}`
        );
        if (!active) return;
        if (res.ok) {
          const data = (await res.json()) as { recipe: Recipe };
          setState({ kind: "static", recipe: data.recipe });
          return;
        }
      } catch {
        // network error — treat as not-found below
      }
      if (active) setState({ kind: "not-found" });
    }
    void load();
    return () => {
      active = false;
    };
  }, [packSlug, recipeSlug]);

  if (state.kind === "loading") {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex flex-1 items-center justify-center text-ink-muted">
          Karte wird geladen…
        </main>
      </div>
    );
  }

  if (state.kind === "not-found") {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <h2 className="font-display text-[22px] leading-tight">
            Karte nicht gefunden
          </h2>
          <p className="text-[14px] text-ink-muted">
            Diese Rezeptkarte konnten wir weder im Pack noch in deinen
            Bearbeitungen finden.
          </p>
          <a
            href={`/${brandSlug}/${packSlug}`}
            className="rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-canvas"
          >
            Zurück zum Pack
          </a>
        </main>
      </div>
    );
  }

  return (
    <RecipeEditor
      brandSlug={brandSlug}
      packSlug={packSlug}
      editing={
        state.kind === "custom"
          ? { id: state.id, recipe: state.recipe }
          : { recipe: state.recipe }
      }
    />
  );
}
