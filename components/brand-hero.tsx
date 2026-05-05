import Image from "next/image";
import Link from "next/link";
import type { Brand } from "@/lib/brands";

type BrandHeroProps = {
  brand: Brand;
};

export function BrandHero({ brand }: BrandHeroProps) {
  return (
    <section
      className="relative overflow-hidden border-b border-line"
      style={{ background: brand.tokens.background }}
    >
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-10 px-6 pt-10 pb-16 lg:grid-cols-[1.1fr_1fr] lg:items-end lg:gap-16 lg:px-10 lg:pt-14 lg:pb-20">
        <div className="flex flex-col gap-7">
          <Link
            href="/"
            className="inline-flex w-fit items-center gap-2 text-[13px] font-medium text-ink-muted transition-colors hover:text-ink"
            style={{ color: brand.tokens.inkMuted }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden
            >
              <path
                d="M11 7H3m0 0L6.5 3.5M3 7l3.5 3.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Alle Workspaces
          </Link>

          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span
                className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
                style={{
                  background: brand.tokens.signature + "22",
                  color: brand.tokens.ink,
                }}
              >
                <span
                  className="size-1.5 rounded-full"
                  style={{ background: brand.tokens.signature }}
                />
                Workspace · {brand.handle}
              </span>
              <span
                className="text-[12px]"
                style={{ color: brand.tokens.inkMuted }}
              >
                Eingerichtet auf Bienes Markenuniversum
              </span>
            </div>

            <h1
              className="font-display text-[68px] font-normal leading-[0.95] tracking-[-0.02em] sm:text-[88px] lg:text-[104px]"
              style={{ color: brand.tokens.ink }}
            >
              {brand.name}
            </h1>

            <p
              className="max-w-[44ch] text-[18px] leading-[1.55]"
              style={{ color: brand.tokens.inkMuted }}
            >
              {brand.bio}
            </p>
          </div>

          <div
            className="flex flex-wrap items-stretch gap-x-8 gap-y-4 border-t pt-6"
            style={{ borderColor: brand.tokens.line }}
          >
            <Stat
              label="Follower"
              value={brand.stats.followers}
              brand={brand}
            />
            <Divider brand={brand} />
            <Stat
              label="Recipe-Packs"
              value={String(brand.packCount)}
              brand={brand}
            />
            <Divider brand={brand} />
            <Stat
              label="Rezepte gesamt"
              value={String(brand.recipeCount)}
              brand={brand}
            />
            <Divider brand={brand} />
            <Stat
              label="Tagline"
              value={brand.tagline}
              brand={brand}
              compact
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <span
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium"
              style={{
                background: brand.tokens.ink,
                color: brand.tokens.background,
              }}
            >
              <span
                className="size-1.5 rounded-full"
                style={{ background: brand.tokens.signature }}
              />
              {brand.signature}
            </span>
            <span
              className="text-[12px]"
              style={{ color: brand.tokens.inkMuted }}
            >
              Signatur · taucht auf jeder Karte am Footer auf
            </span>
          </div>
        </div>

        <div className="relative">
          <div
            className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-card)] ring-1"
            style={{
              background: brand.tokens.surface,
              boxShadow:
                "0 1px 0 rgba(43,31,25,0.05), 0 30px 60px -30px rgba(43,31,25,0.35)",
            }}
          >
            <Image
              src={brand.avatar}
              alt={`${brand.name} – ${brand.fullName}`}
              fill
              sizes="(min-width: 1024px) 600px, 100vw"
              className="object-cover"
              priority
            />
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />

            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-7 text-white">
              <span className="text-[12px] font-medium uppercase tracking-[0.18em] opacity-85">
                {brand.fullName}
              </span>
              <span className="font-display text-[32px] leading-none italic">
                {brand.tagline}
              </span>
            </div>

            <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink shadow-soft backdrop-blur">
              <span
                className="size-1.5 rounded-full"
                style={{ background: brand.tokens.accent }}
              />
              {brand.stats.niche}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  brand,
  compact = false,
}: {
  label: string;
  value: string;
  brand: Brand;
  compact?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span
        className={`font-display ${
          compact ? "text-[18px]" : "text-[28px]"
        } leading-none`}
        style={{ color: brand.tokens.ink }}
      >
        {value}
      </span>
      <span
        className="text-[11px] font-medium uppercase tracking-[0.14em]"
        style={{ color: brand.tokens.inkMuted }}
      >
        {label}
      </span>
    </div>
  );
}

function Divider({ brand }: { brand: Brand }) {
  return (
    <span
      className="hidden h-10 w-px self-center sm:block"
      style={{ background: brand.tokens.line }}
    />
  );
}
