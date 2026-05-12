"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { Brand } from "@/lib/brands";

// Hub-Card fuer den Workspace-Uebersichtsraster. Eine Karte pro Creator.
// Klick: Navigations-Flow ueber /welcome?brand=<slug> — die Welcome-
// Animation laeuft mit den Brand-Tokens (Avatar, Farben, Tagline) ab und
// landet dann im jeweiligen /[brand] Workspace. Das matched genau das
// "geile Eintritts-Gefuehl", das bisher der Biene-Direct-Login hatte —
// nur jetzt fuer jeden Creator, den das Team in der DB anlegt.

type Props = {
  brand: Brand;
  /** Optional: Live-Count aus dem ueblichen Packs+Custom-Merge. Wenn
   *  unbekannt (z. B. brand-frisch in der DB), wird der Slot ausgeblendet
   *  und stattdessen "Frischer Workspace" gezeigt. */
  packCount?: number;
  recipeCount?: number;
  /** Hub markiert Biene als "Pilot Workspace" — das ist der Anker, an
   *  dem der Brand-DNA-Look kalibriert wurde. Andere Creators kriegen
   *  diesen Badge nicht. */
  badge?: string;
};

export function BrandHubCard({ brand, packCount, recipeCount, badge }: Props) {
  const router = useRouter();
  const [entering, setEntering] = useState(false);
  // Verhindert mehrfaches Prefetchen — User-Hover ist schon ein klares
  // Signal "ich klicke gleich", Re-Calls bei Re-Renders sind unnoetig.
  const prefetchedRef = useRef(false);

  // Welcome-Page bei Hover prefetchen. Beseitigt den weissen Flash zwischen
  // Card-Fade-out und Welcome-Animation-Start. Die Page hat `force-dynamic`,
  // daher cached Next nur das Bundle — aber das reicht: ohne Prefetch
  // startet das Server-Rendering erst beim Click, mit Prefetch ist es
  // schon warm.
  const handlePrefetch = () => {
    if (prefetchedRef.current) return;
    prefetchedRef.current = true;
    router.prefetch(`/welcome?brand=${encodeURIComponent(brand.slug)}`);
    router.prefetch(`/${brand.slug}`);
  };

  const handleClick = () => {
    if (entering) return;
    setEntering(true);
    // 80 ms statt 180 ms: die Hover-Card hat seinen "Hover-out"-Moment
    // bereits im transition (entering → opacity 0). 80 ms reicht, damit
    // der User die Click-Confirmation sieht — und Welcome-Page ist
    // dank Prefetch sofort da, ohne weisse Flash-Phase.
    setTimeout(() => {
      router.push(`/welcome?brand=${encodeURIComponent(brand.slug)}`);
    }, 80);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  const hasStats =
    typeof packCount === "number" && typeof recipeCount === "number";

  return (
    <button
      type="button"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={handlePrefetch}
      onFocus={handlePrefetch}
      disabled={entering}
      aria-label={`${brand.name}-Workspace öffnen`}
      className={`group relative flex flex-col gap-5 overflow-hidden rounded-[28px] border p-7 text-left transition-all duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1.5 hover:shadow-[0_24px_60px_-30px_rgba(0,0,0,0.35)] active:translate-y-0 active:scale-[0.99] active:duration-150 disabled:cursor-default ${
        entering ? "scale-[1.02] opacity-0" : ""
      }`}
      style={{
        background: brand.tokens.background,
        borderColor: brand.tokens.line,
        color: brand.tokens.ink,
        transitionProperty:
          "transform, box-shadow, opacity, background, border-color",
      }}
    >
      {/* Subtle accent glow on hover — uses pack-style accent so each card
          has its own atmosphere. */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background: `radial-gradient(circle at 100% 0%, ${brand.tokens.accent}1a 0%, transparent 55%)`,
        }}
        aria-hidden
      />

      <div className="relative flex items-start gap-5">
        <div
          className="relative size-[88px] shrink-0 overflow-hidden rounded-full border-2"
          style={{
            borderColor: brand.tokens.surface,
            background: brand.tokens.surface,
            boxShadow: `0 8px 24px -12px ${brand.tokens.ink}40`,
          }}
        >
          {brand.avatar ? (
            <Image
              src={brand.avatar}
              alt={brand.name}
              fill
              sizes="88px"
              className="object-cover transition-transform duration-[600ms] group-hover:scale-[1.06]"
              quality={95}
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center font-display text-[34px] font-semibold"
              style={{ color: brand.tokens.ink }}
            >
              {brand.name.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-1.5 pt-1">
          {badge ? (
            <span
              className="self-start rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em]"
              style={{
                background: brand.tokens.accent + "20",
                color: brand.tokens.accent,
              }}
            >
              {badge}
            </span>
          ) : null}
          <h3
            className="font-display text-[26px] leading-[1.05] tracking-[-0.01em]"
            style={{ color: brand.tokens.ink }}
          >
            {brand.name}
          </h3>
          <span
            className="font-mono text-[12px] uppercase tracking-[0.14em]"
            style={{ color: brand.tokens.inkMuted }}
          >
            {brand.handle}
          </span>
        </div>
      </div>

      <p
        className="relative line-clamp-3 text-[14px] leading-relaxed"
        style={{ color: brand.tokens.inkMuted }}
      >
        {brand.bio}
      </p>

      <div
        className="relative mt-auto flex items-center justify-between border-t pt-4 text-[12px]"
        style={{ borderColor: brand.tokens.line }}
      >
        <span
          className="font-medium tabular-nums"
          style={{ color: brand.tokens.ink }}
        >
          {hasStats ? (
            <>
              {packCount} {packCount === 1 ? "Pack" : "Packs"} ·{" "}
              {recipeCount}{" "}
              {recipeCount === 1 ? "Rezept" : "Rezepte"}
            </>
          ) : (
            "Frischer Workspace"
          )}
        </span>
        <span
          className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] transition-transform group-hover:translate-x-0.5"
          style={{ color: brand.tokens.accent }}
        >
          {entering ? "Öffne…" : "Öffnen"}
          <svg
            width="12"
            height="12"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden
          >
            <path
              d="M3 7h8m0 0L7.5 3.5M11 7l-3.5 3.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
    </button>
  );
}
