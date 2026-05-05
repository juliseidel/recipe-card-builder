import Image from "next/image";
import Link from "next/link";
import type { Brand } from "@/lib/brands";

type BrandHeroProps = {
  brand: Brand;
};

export function BrandHero({ brand }: BrandHeroProps) {
  return (
    <section
      className="relative border-b"
      style={{
        background: brand.tokens.background,
        borderColor: brand.tokens.line,
      }}
    >
      <div className="mx-auto max-w-[1400px] px-6 pt-7 pb-8 lg:px-10">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-1.5 text-[13px] font-medium transition-colors"
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

        <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
          <div className="flex items-center gap-5">
            <div
              className="relative size-[88px] shrink-0 overflow-hidden rounded-2xl ring-2"
              style={{
                background: brand.tokens.surface,
                boxShadow:
                  "0 1px 0 rgba(43,31,25,0.05), 0 12px 24px -10px rgba(43,31,25,0.18)",
              }}
            >
              <Image
                src={brand.avatar}
                alt={`${brand.name} – ${brand.fullName}`}
                fill
                sizes="88px"
                className="object-cover"
                priority
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline gap-3">
                <h1
                  className="font-display text-[40px] leading-none tracking-[-0.01em] sm:text-[48px]"
                  style={{ color: brand.tokens.ink }}
                >
                  {brand.name}
                </h1>
                <span
                  className="text-[14px] font-medium"
                  style={{ color: brand.tokens.inkMuted }}
                >
                  {brand.handle}
                </span>
              </div>
              <p
                className="text-[14px] leading-snug"
                style={{ color: brand.tokens.inkMuted }}
              >
                {brand.fullName} · {brand.tagline}
              </p>
              <span
                className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                style={{
                  background: brand.tokens.signature + "30",
                  color: brand.tokens.ink,
                }}
              >
                <span
                  className="size-1.5 rounded-full"
                  style={{ background: brand.tokens.signature }}
                />
                Signatur · {brand.signature}
              </span>
            </div>
          </div>

          <div
            className="flex items-stretch gap-6 rounded-2xl border px-5 py-4"
            style={{
              borderColor: brand.tokens.line,
              background: brand.tokens.surface,
            }}
          >
            <Stat label="Follower" value={brand.stats.followers} brand={brand} />
            <Divider brand={brand} />
            <Stat
              label="Packs"
              value={String(brand.packCount)}
              brand={brand}
            />
            <Divider brand={brand} />
            <Stat
              label="Rezepte"
              value={String(brand.recipeCount)}
              brand={brand}
            />
            <Divider brand={brand} />
            <Stat
              label="Status"
              value="Live"
              brand={brand}
              valueColor={brand.tokens.accent}
            />
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
  valueColor,
}: {
  label: string;
  value: string;
  brand: Brand;
  valueColor?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span
        className="font-display text-[24px] leading-none"
        style={{ color: valueColor ?? brand.tokens.ink }}
      >
        {value}
      </span>
      <span
        className="text-[10px] font-semibold uppercase tracking-[0.16em]"
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
      className="h-9 w-px self-center"
      style={{ background: brand.tokens.line }}
    />
  );
}
