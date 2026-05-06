"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Brand } from "@/lib/brands";
import type { Pack } from "@/lib/packs";
import type { Recipe } from "@/lib/recipes";
import type { CustomRecipe } from "@/lib/custom-recipes";

type RecipeCardPreviewProps = {
  brand: Brand;
  pack: Pack;
  recipe: Recipe | CustomRecipe;
  onDelete?: (id: string) => void | Promise<void>;
};

// Subtle position variation so identical pack-cover images don't look identical
const positions = [
  "object-center",
  "object-top",
  "object-[center_30%]",
  "object-[center_70%]",
  "object-[35%_center]",
  "object-[65%_center]",
  "object-[40%_30%]",
  "object-[60%_70%]",
];

export function RecipeCardPreview({
  brand,
  pack,
  recipe,
  onDelete,
}: RecipeCardPreviewProps) {
  const totalTime = recipe.prepTime + (recipe.cookTime ?? 0);
  const positionClass = positions[(recipe.number - 1) % positions.length];
  const isCustom = "isCustom" in recipe && recipe.isCustom;
  // Use customId for custom recipes, slug as fallback identifier for static
  const deleteId = isCustom ? (recipe as CustomRecipe).id : recipe.slug;

  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const confirmTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (confirmTimeout.current) clearTimeout(confirmTimeout.current);
    };
  }, []);

  const handleDeleteClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onDelete) return;
    if (!confirming) {
      setConfirming(true);
      if (confirmTimeout.current) clearTimeout(confirmTimeout.current);
      confirmTimeout.current = setTimeout(() => setConfirming(false), 3000);
      return;
    }
    setDeleting(true);
    await onDelete(deleteId);
  };

  return (
    <Link
      href={`/${brand.slug}/${pack.slug}/${recipe.slug}`}
      className="group relative flex aspect-[3/4] flex-col justify-between overflow-hidden rounded-[var(--radius-card)] text-white transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[var(--shadow-card-hover)]"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <Image
        src={pack.coverImage}
        alt={recipe.title}
        fill
        sizes="(min-width: 1280px) 420px, (min-width: 768px) 50vw, 100vw"
        className={`${positionClass} object-cover transition-transform duration-300 group-hover:scale-[1.06]`}
      />

      {/* Pack-mood color overlay — gives every pack its own atmosphere */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, ${pack.mood.ink}cc 0%, ${pack.mood.ink}88 55%, ${pack.mood.accent}80 100%)`,
        }}
      />

      <div className="relative z-10 flex items-start justify-between p-5">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-white/85">
          {isCustom ? (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
              style={{
                background: pack.mood.accent + "60",
                color: "white",
              }}
            >
              Eigene Karte
            </span>
          ) : (
            <>
              Pack {String(pack.number).padStart(2, "0")} · Karte{" "}
              {String(recipe.number).padStart(2, "0")}
            </>
          )}
        </span>

        <div className="flex items-center gap-2">
          {onDelete ? (
            <button
              type="button"
              onClick={handleDeleteClick}
              onMouseLeave={() => {
                if (!deleting) setConfirming(false);
              }}
              disabled={deleting}
              aria-label={confirming ? "Löschen bestätigen" : "Karte löschen"}
              className={`inline-flex items-center justify-center gap-1.5 rounded-full font-semibold uppercase tracking-[0.12em] backdrop-blur transition-all duration-200 ${
                confirming
                  ? "bg-red-500/95 px-3 py-1 text-[10px] text-white opacity-100"
                  : "size-7 bg-black/35 text-white opacity-0 group-hover:opacity-100 hover:bg-black/55"
              } ${deleting ? "opacity-60" : ""}`}
            >
              {deleting ? (
                <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : confirming ? (
                <>Wirklich löschen?</>
              ) : (
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 14 14"
                  fill="none"
                  aria-hidden
                >
                  <path
                    d="M3 4h8m-7 0v7a1 1 0 001 1h4a1 1 0 001-1V4M5.5 4V2.5h3V4M6 6.5v3M8 6.5v3"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          ) : null}

          <span
            className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]"
            style={{ color: pack.mood.ink }}
          >
            {totalTime} Min
          </span>
        </div>
      </div>

      <div className="relative z-10 flex flex-col gap-3 px-5 pb-6">
        {/* kcal as trophy */}
        <div className="flex items-baseline gap-2">
          <span className="font-sans text-[64px] font-bold leading-none tracking-[-0.03em] tabular-nums">
            {recipe.nutrition.kcal}
          </span>
          <span className="text-[14px] font-semibold uppercase tracking-[0.16em] text-white/85">
            kcal
          </span>
        </div>
        <h3 className="font-sans text-[24px] font-bold uppercase leading-[0.96] tracking-[-0.02em]">
          {recipe.title}
        </h3>
        <div className="flex items-center gap-2 border-t border-white/30 pt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/85">
          <span>{recipe.nutrition.protein}g Eiweiß</span>
          <span>·</span>
          <span>
            {recipe.servings}× Portion{recipe.servings === 1 ? "" : "en"}
          </span>
        </div>
      </div>
    </Link>
  );
}
