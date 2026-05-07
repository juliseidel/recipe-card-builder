import Image from "next/image";
import Link from "next/link";
import type { Brand } from "@/lib/brands";

type BrandCardProps = {
  brand: Brand;
};

export function BrandCard({ brand }: BrandCardProps) {
  return (
    <Link
      href={`/${brand.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-[var(--radius-card)] bg-surface ring-1 ring-line shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[var(--shadow-card-hover)] hover:ring-line-strong"
      style={{ background: brand.tokens.surface }}
    >
      <div
        // 5/4 (wider than tall) keeps the card compact in a 3-col grid —
        // square pushed the card height past 500 px which dominated the
        // viewport. The source photo is near-square, so the 5/4 crop
        // shaves the top/bottom slightly; object-position keeps her face
        // centred.
        className="relative aspect-[5/4] overflow-hidden"
        style={{ background: brand.tokens.background }}
      >
        <Image
          src={brand.avatar}
          alt={`${brand.name} – ${brand.fullName}`}
          fill
          sizes="(min-width: 1280px) 480px, (min-width: 768px) 50vw, 100vw"
          // object-position: keep her face in frame after the 5/4 crop.
          // Source is near-square, so the wider crop trims top + bottom;
          // pulling focus up to ~32% from the top keeps face + dish visible.
          className="object-cover object-[50%_32%] transition-transform duration-300 ease-out group-hover:scale-[1.04]"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-black/10" />

        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3.5">
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink shadow-soft backdrop-blur"
          >
            <span
              className="size-1.5 animate-pulse rounded-full"
              style={{ background: brand.tokens.accent }}
            />
            Aktiv
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white backdrop-blur">
            {brand.stats.followers}
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 p-4 text-white">
          <span className="text-[10.5px] font-medium uppercase tracking-[0.16em] opacity-85">
            {brand.handle}
          </span>
          <h3 className="font-display text-[26px] leading-[0.94] tracking-[-0.015em]">
            {brand.name}
          </h3>
        </div>
      </div>

      <div className="flex items-center gap-3 px-4 py-3.5 text-sm">
        <span className="flex items-baseline gap-1">
          <span className="font-display text-[18px] leading-none text-ink">
            {brand.packCount}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
            Packs
          </span>
        </span>
        <span aria-hidden className="text-ink-subtle">·</span>
        <span className="flex items-baseline gap-1">
          <span className="font-display text-[18px] leading-none text-ink">
            {brand.recipeCount}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
            Rezepte
          </span>
        </span>
        <span className="ml-auto inline-flex items-center gap-1 text-[12px] font-semibold text-ink transition-transform duration-300 group-hover:translate-x-0.5">
          Öffnen
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
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
    </Link>
  );
}
