import Link from "next/link";
import type { Brand } from "@/lib/brands";
import type { Pack } from "@/lib/packs";

type PackCardProps = {
  pack: Pack;
  brand: Brand;
  index: number;
};

const fontClassMap: Record<Pack["displayFont"], string> = {
  fraunces: "font-display",
  "dm-serif": "font-display italic",
  "inter-tight": "font-sans font-semibold tracking-[-0.02em]",
};

export function PackCard({ pack, brand, index }: PackCardProps) {
  const fontClass = fontClassMap[pack.displayFont];
  const orderLabel = String(index + 1).padStart(2, "0");

  return (
    <Link
      href={`/${brand.slug}/${pack.slug}`}
      className="group relative flex aspect-[4/5] flex-col justify-between overflow-hidden rounded-[var(--radius-card)] p-7 ring-1 transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[var(--shadow-card-hover)]"
      style={{
        background: pack.mood.background,
        color: pack.mood.ink,
        boxShadow: "var(--shadow-card)",
        ["--tw-ring-color" as never]: pack.mood.accent + "40",
      }}
    >
      <div className="flex items-start justify-between">
        <span
          className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] opacity-60"
        >
          Pack {orderLabel}
        </span>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] backdrop-blur"
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
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute -right-4 top-1/2 -translate-y-1/2 select-none text-[180px] leading-none opacity-15 transition-transform duration-700 ease-out group-hover:scale-110 group-hover:rotate-6"
      >
        {pack.coverEmoji}
      </div>

      <div className="relative flex flex-col gap-3">
        <span
          className="text-[12px] font-medium uppercase tracking-[0.14em] opacity-70"
        >
          {pack.tagline}
        </span>
        <h3
          className={`${fontClass} text-[34px] leading-[0.96] tracking-[-0.01em]`}
        >
          {pack.title}
        </h3>
        <p className="max-w-[28ch] text-[14px] leading-[1.55] opacity-80">
          {pack.description}
        </p>

        <div className="mt-4 flex items-center justify-between">
          <span
            className="inline-flex items-center gap-1.5 text-[13px] font-medium transition-transform duration-300 group-hover:translate-x-0.5"
          >
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
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span
            className="size-9 rounded-full transition-transform duration-500 group-hover:scale-110"
            style={{ background: pack.mood.accent + "30" }}
          />
        </div>
      </div>
    </Link>
  );
}
