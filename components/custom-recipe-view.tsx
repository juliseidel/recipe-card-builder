"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Brand } from "@/lib/brands";
import type { Pack } from "@/lib/packs";
import { mergeAndRenumber, type Recipe } from "@/lib/recipes";
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
  // What's still being generated in the background. We track each piece
  // independently so the UI can show "Mikros ✓ · Bild noch …" once the
  // faster Gemini call returns and the slow Flux call is still running.
  const [pending, setPending] = useState<{ micros: boolean; hero: boolean }>({
    micros: false,
    hero: false,
  });
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const confirmTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  useEffect(() => {
    let active = true;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    const fetchOnce = async () => {
      const [found, customList] = await Promise.all([
        getCustomRecipe(pack.slug, recipeSlug),
        getCustomRecipesForPack(pack.slug),
      ]);
      if (!active) return;
      const merged = mergeAndRenumber(staticRecipes, customList);
      // Re-pull the current recipe from the merged list so its number/index
      // matches what nutrition table + pack PDF show. Falls back to the raw
      // DB row if the slug somehow doesn't appear in the merge (deleted
      // mid-fetch, etc).
      const fromMerged = found
        ? merged.find((r) => r.slug === found.slug)
        : undefined;
      setRecipe(
        fromMerged
          ? ({ ...(found as CustomRecipe), number: fromMerged.number } as CustomRecipe)
          : (found ?? null)
      );
      setAllRecipes(merged);
      setLoaded(true);
      // Poll until both Gemini micros AND the Flux hero are written back to
      // the DB. Hero is the long pole (~15-25 s, occasionally 60-90 s under
      // load), so we wait for both before stopping.
      const hasMicros = (found?.nutrition?.micros?.length ?? 0) > 0;
      const hasHero = Boolean(found?.hero);
      setPending({ micros: !hasMicros, hero: !hasHero });
      return hasMicros && hasHero;
    };

    let attempts = 0;
    const tick = async () => {
      const done = await fetchOnce();
      if (!active || done) return;
      // 50 attempts × 2.5 s ≈ 125 s — covers a slow Flux render.
      if (attempts++ < 50) {
        pollTimer = setTimeout(tick, 2500);
      } else {
        // Timeout: stop showing "is generating" to avoid lying to the user.
        // The hero / micros may still arrive on a later refresh.
        setPending({ micros: false, hero: false });
      }
    };

    void tick();

    return () => {
      active = false;
      if (pollTimer) clearTimeout(pollTimer);
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
    <>
      <RecipeDetailLayout
        brand={brand}
        pack={pack}
        recipe={recipe}
        totalRecipes={allRecipes.length}
        previous={previous}
        next={next}
        isCustom
        deleteAction={deleteAction}
        enriching={pending.hero || pending.micros ? pending : undefined}
      />
      <EnrichmentToast pending={pending} pack={pack} />
    </>
  );
}

// ════════════════════════════════════════════════
// EnrichmentToast — top-center, prominent, stage-aware.
//
// Three stages: (1) both pending, (2) only hero pending (micros came back
// fast from Gemini), (3) "complete" celebration card that auto-dismisses
// after 2.5 s so the user gets explicit closure when the slow Flux render
// lands.
//
// `previousState` lets us hold the toast in a "✓ done" state for a beat
// before fading out, instead of vanishing the moment polling stops.
// ════════════════════════════════════════════════
function EnrichmentToast({
  pending,
  pack,
}: {
  pending: { micros: boolean; hero: boolean };
  pack: Pack;
}) {
  const [showCompleted, setShowCompleted] = useState(false);
  const wasPendingRef = useRef(false);

  useEffect(() => {
    const isPending = pending.micros || pending.hero;
    if (wasPendingRef.current && !isPending) {
      // Just finished — celebrate for 2.5 s
      setShowCompleted(true);
      const t = setTimeout(() => setShowCompleted(false), 2500);
      return () => clearTimeout(t);
    }
    wasPendingRef.current = isPending;
  }, [pending.micros, pending.hero]);

  const visible = pending.micros || pending.hero || showCompleted;
  if (!visible) return null;

  // Pick stage label, mode and progress duration. Progress fills at a slow
  // rate that roughly matches the actual remaining wait, never reaching
  // 100 % because that would imply we're done before we are.
  let mode: "both" | "hero" | "micros" | "done";
  if (showCompleted) mode = "done";
  else if (pending.micros && pending.hero) mode = "both";
  else if (pending.hero) mode = "hero";
  else mode = "micros";

  return (
    <div
      className={`fixed left-1/2 top-6 z-50 flex w-[min(94vw,520px)] flex-col gap-2.5 rounded-2xl border bg-white/95 px-5 py-4 shadow-[0_18px_48px_-16px_rgba(26,18,11,0.32)] backdrop-blur-xl ${
        showCompleted ? "toast-fade-out" : "toast-slide-down"
      }`}
      style={{
        borderColor: pack.mood.ink + "1f",
      }}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        {mode === "done" ? (
          <CheckBadge color={pack.mood.accent} />
        ) : (
          <span
            className="relative flex size-5 items-center justify-center"
            aria-hidden
          >
            <span
              className="absolute inset-0 rounded-full pending-dot"
              style={{ background: pack.mood.accent + "30" }}
            />
            <span
              className="relative size-2 rounded-full"
              style={{ background: pack.mood.accent }}
            />
          </span>
        )}
        <div className="flex flex-1 flex-col gap-0.5">
          <span
            className="text-[12.5px] font-semibold leading-tight"
            style={{ color: pack.mood.ink }}
          >
            {mode === "done"
              ? "Karte komplett — Mikros & Bild sind drin"
              : mode === "both"
              ? "Bienes Küche zaubert deine Karte"
              : mode === "hero"
              ? "KI rendert dein Hero-Bild"
              : "Mikronährstoffe werden analysiert"}
          </span>
          <span
            className="font-mono text-[10.5px] uppercase tracking-[0.14em]"
            style={{ color: pack.mood.inkSoft }}
          >
            {mode === "done"
              ? "Fertig"
              : mode === "both"
              ? "Gemini schreibt Story + Mikros · Flux rendert · ~30–60 Sek"
              : mode === "hero"
              ? "Flux 2 Pro · noch ~15–25 Sek · Story & Mikros sind bereits drin"
              : "Gemini 2.5 Flash · noch ~5 Sek · Bild ist bereits drin"}
          </span>
        </div>
      </div>

      {/* Stage chips — ✓ for done, pulsing dot for active */}
      <div className="flex items-center gap-2 pt-0.5">
        <StageChip
          label="Mikros"
          state={pending.micros ? "active" : "done"}
          accent={pack.mood.accent}
          inkSoft={pack.mood.inkSoft}
          ink={pack.mood.ink}
        />
        <StageChip
          label="Hero-Bild"
          state={pending.hero ? "active" : "done"}
          accent={pack.mood.accent}
          inkSoft={pack.mood.inkSoft}
          ink={pack.mood.ink}
        />
      </div>

      {/* Progress creep — visual hint that work is happening, never reaches
          100 % so the user doesn't feel cheated when reality lags */}
      {mode !== "done" ? (
        <div
          className="relative h-0.5 w-full overflow-hidden rounded-full"
          style={{ background: pack.mood.ink + "10" }}
          aria-hidden
        >
          <div
            key={mode}
            className="absolute inset-y-0 left-0 right-0 origin-left rounded-full progress-creep"
            style={
              {
                background: pack.mood.accent,
                "--progress-from": mode === "both" ? "0" : "0.5",
                "--progress-duration": mode === "both" ? "45s" : "20s",
              } as React.CSSProperties
            }
          />
        </div>
      ) : null}
    </div>
  );
}

function StageChip({
  label,
  state,
  accent,
  inkSoft,
  ink,
}: {
  label: string;
  state: "active" | "done";
  accent: string;
  inkSoft: string;
  ink: string;
}) {
  const isDone = state === "done";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] transition-all"
      style={{
        borderColor: isDone ? accent + "55" : ink + "1a",
        background: isDone ? accent + "12" : "transparent",
        color: isDone ? accent : inkSoft,
      }}
    >
      {isDone ? (
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path
            d="M2 6.5L4.5 9L10 3.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <span
          className="size-1.5 rounded-full pending-dot"
          style={{ background: accent }}
        />
      )}
      {label}
    </span>
  );
}

function CheckBadge({ color }: { color: string }) {
  return (
    <span
      className="flex size-5 items-center justify-center rounded-full"
      style={{ background: color + "1a", color }}
      aria-hidden
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path
          d="M2 6.5L4.5 9L10 3.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
