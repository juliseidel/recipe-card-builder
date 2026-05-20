"use client";

import type { Pack } from "@/lib/packs";

// ════════════════════════════════════════════════
// HERO SKELETON
// Replaces the recipe-hero <Image> while the Flux render is in flight.
// Cream-gradient base + slow shimmer sweep + breathing transform.
// In-frame italic caption signals what is happening — a still-empty
// frame would be ambiguous against a card that already has content.
// ════════════════════════════════════════════════
type HeroSkeletonProps = {
  pack: Pack;
  shape?: "square" | "polaroid" | "tall";
  caption?: string;
};

export function HeroSkeleton({
  pack,
  shape = "square",
  caption = "Bild entsteht",
}: HeroSkeletonProps) {
  return (
    <div
      className="relative h-full w-full overflow-hidden hero-breathe"
      style={
        {
          background: `linear-gradient(135deg, ${pack.mood.background} 0%, ${pack.mood.accent}22 100%)`,
          "--shimmer-base": `${pack.mood.background}`,
          "--shimmer-glow": `${pack.mood.accent}26`,
        } as React.CSSProperties
      }
    >
      <div className="absolute inset-0 skeleton-shimmer" aria-hidden />

      {/* Soft vignette to give depth, mirrors the photo it replaces */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at center, transparent 40%, ${pack.mood.ink}10 100%)`,
        }}
        aria-hidden
      />

      {/* Caption — Fraunces italic, like a captioned photo waiting to develop */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
        <BeeIcon color={pack.mood.accent} brandSlug={pack.brandSlug} />
        <span
          className="font-display text-[14px] italic leading-tight"
          style={{ color: pack.mood.ink }}
        >
          {caption}
        </span>
        <span
          className="font-mono text-[9.5px] uppercase tracking-[0.22em]"
          style={{ color: pack.mood.inkSoft, opacity: 0.7 }}
        >
          AI rendert
        </span>
      </div>

      {/* Polaroid: extra "developing" hint at the bottom */}
      {shape === "polaroid" ? (
        <div
          className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full px-2 py-0.5 backdrop-blur-sm"
          style={{ background: "rgba(255,255,255,0.8)" }}
          aria-hidden
        >
          <span
            className="size-1.5 rounded-full pending-dot"
            style={{ background: pack.mood.accent }}
          />
          <span
            className="font-mono text-[8.5px] uppercase tracking-[0.18em]"
            style={{ color: pack.mood.ink }}
          >
            belichtung
          </span>
        </div>
      ) : null}
    </div>
  );
}

// ════════════════════════════════════════════════
// MICROS SKELETON — Pill-strip variant (Packs 1-4)
// Mirrors MicrosPanel layout: header + flexbox of pill placeholders.
// Six pills feels right; not too sparse, not so dense the user thinks
// they need to scroll. Pack-tinted shimmer keeps it on-brand.
// ════════════════════════════════════════════════
export function MicrosSkeletonStrip({ pack }: { pack: Pack }) {
  return (
    <div
      className="border-t px-8 py-5 sm:px-10"
      style={{
        borderColor: pack.mood.ink + "20",
        background: pack.mood.background + "26",
      }}
    >
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3
          className="text-[12px] font-semibold uppercase tracking-[0.22em] flex items-center gap-2"
          style={{ color: pack.mood.accent }}
        >
          <span
            className="size-1.5 rounded-full pending-dot"
            style={{ background: pack.mood.accent }}
          />
          Mikronährstoffe analysieren
        </h3>
        <span
          className="font-mono text-[10px] uppercase tracking-[0.14em]"
          style={{ color: pack.mood.inkSoft }}
        >
          Wird analysiert · ~5 Sek
        </span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {SKELETON_PILL_WIDTHS.map((width, idx) => (
          <PillSkeleton key={idx} width={width} pack={pack} delay={idx} />
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// MICROS SKELETON — Banner variant (Pack 5 / Editorial)
// Mirrors EditorialNutrientBanner: 6 cells in a 3-col grid with bar fills.
// Bars sit at a partial fill with shimmer to suggest "data incoming".
// ════════════════════════════════════════════════
export function MicrosSkeletonBanner({ pack }: { pack: Pack }) {
  return (
    <div
      className="border-b px-8 py-6 sm:px-12 sm:py-7"
      style={{
        borderColor: pack.mood.ink + "1f",
        background: pack.mood.background + "55",
      }}
    >
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h3
          className="text-[12px] font-semibold uppercase tracking-[0.22em] flex items-center gap-2"
          style={{ color: pack.mood.accent }}
        >
          <span
            className="size-1.5 rounded-full pending-dot"
            style={{ background: pack.mood.accent }}
          />
          Reich an
        </h3>
        <span
          className="font-mono text-[10px] uppercase tracking-[0.14em]"
          style={{ color: pack.mood.inkSoft }}
        >
          Mikronährstoffe werden analysiert · ~5 Sek
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, idx) => (
          <BannerRowSkeleton key={idx} pack={pack} delay={idx} />
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// Internals
// ════════════════════════════════════════════════
const SKELETON_PILL_WIDTHS = [104, 86, 118, 96, 110, 88];

function PillSkeleton({
  width,
  pack,
  delay,
}: {
  width: number;
  pack: Pack;
  delay: number;
}) {
  return (
    <div
      className="relative inline-flex h-[30px] items-center overflow-hidden rounded-full border skeleton-shimmer"
      style={
        {
          width,
          borderColor: pack.mood.ink + "1f",
          "--shimmer-base": "rgba(255,255,255,0.55)",
          "--shimmer-glow": `${pack.mood.accent}26`,
          animationDelay: `${delay * 0.18}s`,
        } as React.CSSProperties
      }
      aria-hidden
    />
  );
}

function BannerRowSkeleton({ pack, delay }: { pack: Pack; delay: number }) {
  return (
    <div className="flex flex-col gap-1" aria-hidden>
      <div className="flex items-baseline justify-between gap-2">
        <span
          className="h-3 w-20 rounded-full skeleton-shimmer"
          style={
            {
              "--shimmer-base": pack.mood.ink + "12",
              "--shimmer-glow": pack.mood.ink + "20",
              animationDelay: `${delay * 0.12}s`,
            } as React.CSSProperties
          }
        />
        <span
          className="h-2.5 w-10 rounded-full skeleton-shimmer"
          style={
            {
              "--shimmer-base": pack.mood.ink + "10",
              "--shimmer-glow": pack.mood.ink + "18",
              animationDelay: `${delay * 0.12 + 0.06}s`,
            } as React.CSSProperties
          }
        />
      </div>
      <div
        className="relative h-1.5 overflow-hidden rounded-full"
        style={{ background: pack.mood.ink + "10" }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full skeleton-shimmer"
          style={
            {
              width: `${30 + delay * 8}%`,
              "--shimmer-base": pack.mood.accent + "44",
              "--shimmer-glow": pack.mood.accent + "88",
              animationDelay: `${delay * 0.18}s`,
            } as React.CSSProperties
          }
        />
      </div>
      <span
        className="self-end h-2.5 w-12 rounded-full skeleton-shimmer"
        style={
          {
            "--shimmer-base": pack.mood.accent + "20",
            "--shimmer-glow": pack.mood.accent + "44",
            animationDelay: `${delay * 0.12 + 0.1}s`,
          } as React.CSSProperties
        }
      />
    </div>
  );
}

// User-Feedback 2026-05-19: Bienen-Icon ueberall entfernt (wirkte "billig").
// Auch dieser Loading-Indicator rendert jetzt nichts mehr — der Skeleton +
// die Caption reichen als Lade-Anzeige fuer alle Brands inkl. Biene.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function BeeIcon(_props: { color: string; brandSlug: string }) {
  return null;
}
