"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Pack } from "@/lib/packs";
import { hideRecipe } from "@/lib/hidden-recipes";

type Props = {
  brandSlug: string;
  packSlug: string;
  recipeSlug: string;
  pack: Pack;
};

export function StaticRecipeDeleteButton({
  brandSlug,
  packSlug,
  recipeSlug,
  pack,
}: Props) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const confirmTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  useEffect(() => {
    return () => {
      if (confirmTimeout.current) clearTimeout(confirmTimeout.current);
    };
  }, []);

  const handleClick = async () => {
    if (!confirming) {
      setConfirming(true);
      if (confirmTimeout.current) clearTimeout(confirmTimeout.current);
      confirmTimeout.current = setTimeout(() => setConfirming(false), 3000);
      return;
    }
    setDeleting(true);
    await hideRecipe(brandSlug, packSlug, recipeSlug);
    // Drop the workspace + pack-detail caches so the recipe-count badge and
    // the recipe grid reflect the hide on back-navigation. Without this the
    // user would see the just-deleted card flash back into view for ~30 s.
    await fetch("/api/packs/revalidate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandSlug, packSlug }),
    }).catch(() => {});
    router.push(`/${brandSlug}/${packSlug}`);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseLeave={() => {
        if (!deleting) setConfirming(false);
      }}
      disabled={deleting}
      className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-colors"
      style={
        confirming
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
        : confirming
        ? "Wirklich löschen?"
        : "Löschen"}
    </button>
  );
}
