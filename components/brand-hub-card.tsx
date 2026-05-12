"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { Brand } from "@/lib/brands";
import { isCodeBrand } from "@/lib/brands";

// Hub-Card fuer den Workspace-Uebersichtsraster. Eine Karte pro Creator.
// Klick: Navigations-Flow ueber /welcome?brand=<slug> — die Welcome-
// Animation laeuft mit den Brand-Tokens (Avatar, Farben, Tagline) ab und
// landet dann im jeweiligen /[brand] Workspace.
//
// Outer ist ein <div role="button"> (statt nativer <button>), damit der
// innere Delete-<button> valides HTML ist (kein button-in-button). Klick-/
// Keyboard-Handler imitieren native button-Semantik.
//
// Delete-Button ist nur fuer DB-Brands sichtbar (Code-Brand Biene = nicht
// loeschbar, weil hardcoded in lib/brands.ts). Bestaetigt via In-Card-
// Overlay statt window.confirm — der Hub bleibt im Look, kein OS-Dialog.

type Props = {
  brand: Brand;
  /** Optional: Live-Count aus dem ueblichen Packs+Custom-Merge. Wenn
   *  unbekannt (z. B. brand-frisch in der DB), wird der Slot ausgeblendet
   *  und stattdessen "Workspace bereit" gezeigt. */
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Verhindert mehrfaches Prefetchen — User-Hover ist schon ein klares
  // Signal "ich klicke gleich", Re-Calls bei Re-Renders sind unnoetig.
  const prefetchedRef = useRef(false);

  const canDelete = !isCodeBrand(brand.slug);
  const interactive = !entering && !deleting && !confirmDelete;

  // Welcome-Page bei Hover prefetchen. Beseitigt den weissen Flash zwischen
  // Card-Fade-out und Welcome-Animation-Start.
  const handlePrefetch = () => {
    if (prefetchedRef.current) return;
    prefetchedRef.current = true;
    router.prefetch(`/welcome?brand=${encodeURIComponent(brand.slug)}`);
    router.prefetch(`/${brand.slug}`);
  };

  const handleClick = () => {
    if (!interactive) return;
    setEntering(true);
    setTimeout(() => {
      router.push(`/welcome?brand=${encodeURIComponent(brand.slug)}`);
    }, 80);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!interactive) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  const handleAskDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDelete(true);
    setDeleteError(null);
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDelete(false);
    setDeleteError(null);
  };

  const handleConfirmDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/brands/${encodeURIComponent(brand.slug)}/delete`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error ?? "Löschen fehlgeschlagen.");
      }
      // Erfolg → Hub neu laden, die Karte verschwindet dann mit.
      router.refresh();
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Löschen fehlgeschlagen."
      );
      setDeleting(false);
    }
  };

  const hasStats =
    typeof packCount === "number" && typeof recipeCount === "number";

  return (
    <div
      role="button"
      tabIndex={interactive ? 0 : -1}
      aria-label={`${brand.name}-Workspace öffnen`}
      aria-disabled={!interactive}
      onClick={interactive ? handleClick : undefined}
      onKeyDown={handleKeyDown}
      onMouseEnter={handlePrefetch}
      onFocus={handlePrefetch}
      className={`group relative flex flex-col gap-5 overflow-hidden rounded-[28px] border p-7 text-left transition-all duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
        interactive
          ? "cursor-pointer hover:-translate-y-1.5 hover:shadow-[0_24px_60px_-30px_rgba(0,0,0,0.35)] active:translate-y-0 active:scale-[0.99] active:duration-150"
          : "cursor-default"
      } ${entering ? "scale-[1.02] opacity-0" : ""}`}
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

      {/* Delete-Trigger — Trash-Icon oben rechts, nur bei Hover sichtbar.
          Nur fuer DB-Brands (Code-Brands wie Biene haben canDelete=false). */}
      {canDelete && interactive ? (
        <button
          type="button"
          onClick={handleAskDelete}
          aria-label={`Workspace „${brand.name}" löschen`}
          className="absolute right-4 top-4 z-10 grid size-8 place-items-center rounded-full opacity-0 transition-all duration-200 hover:scale-110 group-hover:opacity-100 focus-visible:opacity-100"
          style={{
            background: "rgba(255, 255, 255, 0.75)",
            backdropFilter: "blur(6px)",
            color: brand.tokens.inkMuted,
            border: `1px solid ${brand.tokens.line}`,
          }}
        >
          <TrashIcon />
        </button>
      ) : null}

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
        className="relative line-clamp-2 text-[14px] leading-relaxed"
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
            "Workspace bereit"
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

      {/* Confirm-Overlay — wird vor das Card-Content gelegt wenn der User
          den Trash-Button geklickt hat. Card-Click ist disabled (interactive=false),
          die Overlay-Buttons handhaben Cancel + Confirm. */}
      {confirmDelete || deleting ? (
        <div
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-[28px] p-6 text-center"
          style={{
            background: "rgba(255, 255, 255, 0.96)",
            backdropFilter: "blur(8px)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {deleting ? (
            <>
              <span
                className="inline-block size-6 animate-spin rounded-full border-2 border-current border-t-transparent"
                style={{ color: brand.tokens.ink }}
                aria-hidden
              />
              <span
                className="text-[13px] font-medium"
                style={{ color: brand.tokens.ink }}
              >
                Lösche Workspace…
              </span>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <span
                  className="font-display text-[18px] leading-tight tracking-[-0.01em]"
                  style={{ color: brand.tokens.ink }}
                >
                  „{brand.name}" wirklich löschen?
                </span>
                <span
                  className="max-w-[28ch] text-[12.5px] leading-snug"
                  style={{ color: brand.tokens.inkMuted }}
                >
                  Alle Packs, Rezepte und die Reel-Library werden dauerhaft entfernt.
                </span>
              </div>
              {deleteError ? (
                <span
                  className="max-w-[32ch] text-[11.5px] leading-snug"
                  style={{ color: "#b91c1c" }}
                >
                  {deleteError}
                </span>
              ) : null}
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={handleCancelDelete}
                  className="rounded-full border px-4 py-1.5 text-[12px] font-semibold transition-colors hover:bg-canvas-alt"
                  style={{
                    borderColor: brand.tokens.line,
                    color: brand.tokens.inkMuted,
                  }}
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="rounded-full px-4 py-1.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
                  style={{
                    background: "#b91c1c",
                  }}
                >
                  Endgültig löschen
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3 4.5h10M6.5 4.5V3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1.5M5 4.5l.5 8a1 1 0 0 0 1 .92h3a1 1 0 0 0 1-.92l.5-8M7 7v4M9 7v4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
