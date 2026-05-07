"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Brand } from "@/lib/brands";
import type { Pack } from "@/lib/packs";
import { PackCardCoverImage } from "./pack-cover-image";
import { removeCustomPack } from "@/lib/custom-packs";

type PackCardProps = {
  pack: Pack;
  brand: Brand;
  /** Custom-pack metadata used for the delete action. Curated packs leave
   *  this undefined and don't show a delete button. */
  customPackId?: string;
};

const fontClassMap: Record<Pack["displayFont"], string> = {
  fraunces: "font-display",
  "dm-serif": "font-display italic",
  "inter-tight": "font-sans font-bold tracking-[-0.02em]",
};

export function PackCard({ pack, brand, customPackId }: PackCardProps) {
  const fontClass = fontClassMap[pack.displayFont];
  const orderLabel = String(pack.number).padStart(2, "0");
  const router = useRouter();

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const confirmTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Two-stage delete (matches the recipe-card pattern): first click arms
  // the button (red, "Wirklich löschen?") for 3s, second click commits.
  // Stops Link navigation via stopPropagation since the whole card is a
  // big <Link>.
  const handleDeleteClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!customPackId) return;
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
    await removeCustomPack(customPackId);
    // refresh() pulls a fresh server-render of the workspace so the deleted
    // pack disappears from the grid without a hard reload.
    router.refresh();
  };

  return (
    <Link
      href={`/${brand.slug}/${pack.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-[var(--radius-card)] transition-all duration-300 hover:-translate-y-2 hover:shadow-[var(--shadow-card-hover)]"
      style={{
        background: pack.mood.background,
        color: pack.mood.ink,
        boxShadow: "var(--shadow-card)",
      }}
    >
      {/* Top row: pack number + recipe-count badge + optional delete */}
      <div className="flex items-start justify-between gap-3 px-6 pt-5">
        <span
          className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em]"
          style={{ color: pack.mood.inkSoft }}
        >
          Pack {orderLabel}
        </span>
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em]"
            style={{
              background: "rgba(255,255,255,0.7)",
              color: pack.mood.ink,
            }}
          >
            <span
              className="size-1.5 rounded-full"
              style={{ background: pack.mood.accent }}
            />
            {pack.recipeCount} Rezepte
          </span>
          {customPackId ? (
            <button
              type="button"
              onClick={handleDeleteClick}
              onMouseLeave={() => {
                if (!deleting) setConfirmingDelete(false);
              }}
              disabled={deleting}
              aria-label={
                confirmingDelete
                  ? "Pack wirklich löschen — nochmal klicken"
                  : "Pack löschen"
              }
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors"
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
                      background: "rgba(255,255,255,0.7)",
                    }
              }
            >
              {deleting ? (
                <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <svg width="11" height="11" viewBox="0 0 14 14" fill="none" aria-hidden>
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
                ? "Wirklich?"
                : "Löschen"}
            </button>
          ) : null}
        </div>
      </div>

      {/* Hero image — falls back to a shimmer skeleton while a custom pack
          waits for its Flux-generated cover. The client-side image polls
          Supabase every 4s until the cover lands, then fades in. */}
      <div className="relative mx-6 mt-4 aspect-[4/3.4] overflow-hidden rounded-2xl">
        <PackCardCoverImage
          pack={pack}
          brandSlug={brand.slug}
          alt={`${pack.title} – ${pack.tagline}`}
          sizes="(min-width: 1280px) 420px, (min-width: 768px) 50vw, 100vw"
          pollWhenEmpty={!pack.coverImage}
        />
      </div>

      {/* Text body */}
      <div className="flex flex-1 flex-col gap-3 px-6 pt-6 pb-6">
        <span
          className="text-[12px] font-semibold uppercase tracking-[0.16em]"
          style={{ color: pack.mood.inkSoft }}
        >
          {pack.category}
        </span>
        <h3
          className={`${fontClass} text-[34px] leading-[0.96] tracking-[-0.01em]`}
        >
          {pack.title}
          <span
            className="block text-[18px] font-normal italic opacity-80"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {pack.subtitle}
          </span>
        </h3>
        <p
          className="text-[14px] leading-[1.55]"
          style={{ color: pack.mood.inkSoft }}
        >
          {pack.tagline}
        </p>

        {pack.edgeCase ? (
          <span
            className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
            style={{
              background: pack.mood.accent + "20",
              color: pack.mood.accent,
            }}
          >
            ★ {pack.edgeCase}
          </span>
        ) : null}

        <div
          className="mt-3 flex items-center justify-between border-t pt-4"
          style={{ borderColor: pack.mood.ink + "1a" }}
        >
          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold transition-transform duration-300 group-hover:translate-x-0.5">
            Pack öffnen
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden
            >
              <path
                d="M3 7h8m0 0L7.5 3.5M11 7l-3.5 3.5"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span
            className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: pack.mood.inkSoft }}
          >
            druckfertig
          </span>
        </div>
      </div>
    </Link>
  );
}
