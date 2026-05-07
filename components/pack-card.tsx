import Link from "next/link";
import type { Brand } from "@/lib/brands";
import type { Pack } from "@/lib/packs";
import { PackCardCoverImage } from "./pack-cover-image";

type PackCardProps = {
  pack: Pack;
  brand: Brand;
};

const fontClassMap: Record<Pack["displayFont"], string> = {
  fraunces: "font-display",
  "dm-serif": "font-display italic",
  "inter-tight": "font-sans font-bold tracking-[-0.02em]",
};

export function PackCard({ pack, brand }: PackCardProps) {
  const fontClass = fontClassMap[pack.displayFont];
  const orderLabel = String(pack.number).padStart(2, "0");

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
      {/* Top row: Pack number + edge case badge */}
      <div className="flex items-start justify-between gap-3 px-6 pt-5">
        <span
          className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em]"
          style={{ color: pack.mood.inkSoft }}
        >
          Pack {orderLabel}
        </span>
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
