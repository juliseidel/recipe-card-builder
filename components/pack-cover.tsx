import Image from "next/image";
import Link from "next/link";
import type { Brand } from "@/lib/brands";
import type { Pack } from "@/lib/packs";

type PackCoverProps = {
  brand: Brand;
  pack: Pack;
  totalRecipes: number;
  totalKcal: number;
  totalProtein: number;
};

const fontClassMap: Record<Pack["displayFont"], string> = {
  fraunces: "font-display",
  "dm-serif": "font-display italic",
  "inter-tight": "font-sans font-bold tracking-[-0.02em]",
};

export function PackCover({
  brand,
  pack,
  totalRecipes,
  totalKcal,
  totalProtein,
}: PackCoverProps) {
  const fontClass = fontClassMap[pack.displayFont];
  const orderLabel = String(pack.number).padStart(2, "0");
  const avgKcal = Math.round(totalKcal / totalRecipes);
  const avgProtein = Math.round(totalProtein / totalRecipes);

  return (
    <section
      className="relative overflow-hidden border-b"
      style={{
        background: pack.mood.background,
        color: pack.mood.ink,
        borderColor: pack.mood.ink + "1a",
      }}
    >
      <div className="mx-auto max-w-[1400px] px-6 pt-7 pb-10 lg:px-10 lg:pt-9 lg:pb-14">
        <Link
          href={`/${brand.slug}`}
          className="inline-flex w-fit items-center gap-1.5 text-[13px] font-medium opacity-80 transition-opacity hover:opacity-100"
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
          Bienes Workspace · Alle Packs
        </Link>

        <div className="mt-7 grid grid-cols-1 gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-end lg:gap-14">
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: pack.mood.inkSoft }}
              >
                Pack {orderLabel}
              </span>
              <span
                className="size-1 rounded-full"
                style={{ background: pack.mood.inkSoft }}
              />
              <span
                className="text-[12px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: pack.mood.inkSoft }}
              >
                {pack.category}
              </span>
              <span
                className="size-1 rounded-full"
                style={{ background: pack.mood.inkSoft }}
              />
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em]"
                style={{
                  background: "rgba(255,255,255,0.7)",
                  color: pack.mood.ink,
                }}
              >
                <span
                  className="size-1.5 rounded-full"
                  style={{ background: pack.mood.accent }}
                />
                {totalRecipes} Rezepte
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <h1
                className={`${fontClass} text-[56px] leading-[0.96] tracking-[-0.01em] sm:text-[72px] lg:text-[84px]`}
              >
                {pack.title}
              </h1>
              <p
                className="font-display text-[24px] italic leading-snug sm:text-[28px]"
                style={{ color: pack.mood.inkSoft }}
              >
                {pack.subtitle}
              </p>
            </div>

            <p
              className="max-w-[52ch] text-[16px] leading-[1.55]"
              style={{ color: pack.mood.inkSoft }}
            >
              {pack.description}
            </p>

            {pack.edgeCase ? (
              <span
                className="inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]"
                style={{
                  background: pack.mood.accent + "25",
                  color: pack.mood.accent,
                }}
              >
                ★ {pack.edgeCase}
              </span>
            ) : null}

            <div
              className="mt-2 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border"
              style={{
                background: pack.mood.ink + "10",
                borderColor: pack.mood.ink + "20",
              }}
            >
              <CoverStat
                label="Ø Kalorien"
                value={`${avgKcal} kcal`}
                pack={pack}
              />
              <CoverStat
                label="Ø Eiweiß"
                value={`${avgProtein} g`}
                pack={pack}
              />
              <CoverStat
                label="Output"
                value="PDF · 300 DPI"
                pack={pack}
              />
            </div>
          </div>

          <div className="relative">
            <div
              className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-card)]"
              style={{
                boxShadow:
                  "0 1px 0 rgba(0,0,0,0.05), 0 30px 60px -25px rgba(0,0,0,0.45)",
              }}
            >
              <Image
                src={pack.coverImage}
                alt={`${pack.title} – ${pack.tagline}`}
                fill
                sizes="(min-width: 1024px) 600px, 100vw"
                className="object-cover"
                priority
              />

              <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />

              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 text-white">
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-80">
                    Cover-Motiv
                  </span>
                  <span className="font-display text-[20px] leading-tight italic">
                    {pack.tagline}
                  </span>
                </div>
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-80">
                  {brand.handle}
                </span>
              </div>

              <span
                className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] backdrop-blur"
                style={{
                  background: "rgba(255,255,255,0.92)",
                  color: pack.mood.ink,
                }}
              >
                <span
                  className="size-1.5 rounded-full"
                  style={{ background: pack.mood.accent }}
                />
                {brand.signature}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CoverStat({
  label,
  value,
  pack,
}: {
  label: string;
  value: string;
  pack: Pack;
}) {
  return (
    <div
      className="flex flex-col gap-1 px-5 py-4"
      style={{ background: pack.mood.background }}
    >
      <span
        className="font-display text-[22px] leading-none"
        style={{ color: pack.mood.ink }}
      >
        {value}
      </span>
      <span
        className="text-[10px] font-semibold uppercase tracking-[0.16em]"
        style={{ color: pack.mood.inkSoft }}
      >
        {label}
      </span>
    </div>
  );
}
