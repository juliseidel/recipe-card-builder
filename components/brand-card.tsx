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
        className="relative aspect-[4/5] overflow-hidden"
        style={{ background: brand.tokens.background }}
      >
        <Image
          src={brand.avatar}
          alt={`${brand.name} – ${brand.fullName}`}
          fill
          sizes="(min-width: 1280px) 480px, (min-width: 768px) 50vw, 100vw"
          // object-position: keep her face in frame even after the 4:5 crop.
          // The source is near-square, so the default centre crop loses the
          // top of her head; pulling the focus up to ~30% from the top keeps
          // face + dish + hands all visible in the card.
          className="object-cover object-[50%_28%] transition-transform duration-300 ease-out group-hover:scale-[1.04]"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-black/10" />

        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-5">
          <span
            className="inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink shadow-soft backdrop-blur"
          >
            <span
              className="size-1.5 animate-pulse rounded-full"
              style={{ background: brand.tokens.accent }}
            />
            Aktiv
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white backdrop-blur">
            {brand.stats.followers} Follower
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-6 text-white">
          <span className="text-[12.5px] font-medium uppercase tracking-[0.16em] opacity-85">
            {brand.handle}
          </span>
          <h3 className="font-display text-[48px] leading-[0.94] tracking-[-0.015em]">
            {brand.name}
          </h3>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="flex flex-col gap-1">
          <span className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
            {brand.fullName}
          </span>
          <p className="text-[15px] leading-relaxed text-ink-muted">
            {brand.tagline}
          </p>
        </div>

        <div className="flex items-center gap-4 border-t border-line pt-4 text-sm">
          <span className="flex flex-col gap-0.5">
            <span className="font-display text-[26px] leading-none text-ink">
              {brand.packCount}
            </span>
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
              Packs
            </span>
          </span>
          <span className="h-8 w-px bg-line" />
          <span className="flex flex-col gap-0.5">
            <span className="font-display text-[26px] leading-none text-ink">
              {brand.recipeCount}
            </span>
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
              Rezepte
            </span>
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink transition-transform duration-300 group-hover:translate-x-0.5">
            Workspace öffnen
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
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
}
