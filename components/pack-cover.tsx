import Image from "next/image";
import Link from "next/link";
import type { Brand } from "@/lib/brands";
import type { Pack } from "@/lib/packs";

type PackCoverProps = {
  brand: Brand;
  pack: Pack;
  totalRecipes: number;
};

const fontClassMap: Record<Pack["displayFont"], string> = {
  fraunces: "font-display",
  "dm-serif": "font-display italic",
  "inter-tight": "font-sans font-bold tracking-[-0.02em]",
};

export function PackCover({ brand, pack, totalRecipes }: PackCoverProps) {
  const fontClass = fontClassMap[pack.displayFont];
  const orderLabel = String(pack.number).padStart(2, "0");

  return (
    <section
      className="relative overflow-hidden border-b"
      style={{
        background: pack.mood.background,
        color: pack.mood.ink,
        borderColor: pack.mood.ink + "1a",
      }}
    >
      <div className="mx-auto max-w-[1400px] px-6 pt-7 pb-14 lg:px-10 lg:pt-9 lg:pb-16">
        <Link
          href={`/${brand.slug}`}
          className="inline-flex w-fit items-center gap-1.5 text-[13px] font-medium opacity-75 transition-opacity hover:opacity-100"
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
          Bienes Workspace
        </Link>

        <div className="mt-8 grid grid-cols-1 gap-12 lg:grid-cols-[1.5fr_1fr] lg:items-center lg:gap-16">
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em]"
                style={{ color: pack.mood.inkSoft }}
              >
                Pack {orderLabel} · {pack.category}
              </span>
            </div>

            <div className="flex flex-col gap-3">
              <h1
                className={`${fontClass} text-[56px] leading-[0.96] tracking-[-0.01em] sm:text-[72px] lg:text-[88px]`}
              >
                {pack.title}
              </h1>
              <p
                className="font-display text-[22px] italic leading-snug sm:text-[26px]"
                style={{ color: pack.mood.inkSoft }}
              >
                {pack.subtitle}
              </p>
            </div>

            <p
              className="max-w-[52ch] text-[16px] leading-[1.6]"
              style={{ color: pack.mood.inkSoft }}
            >
              {pack.description}
            </p>

            {pack.edgeCase ? (
              <span
                className="inline-flex w-fit items-center gap-1.5 text-[13px] font-medium"
                style={{ color: pack.mood.inkSoft }}
              >
                <span
                  className="size-1 rounded-full"
                  style={{ background: pack.mood.accent }}
                />
                {pack.edgeCase}
              </span>
            ) : null}

            <div
              className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]"
              style={{ color: pack.mood.inkSoft }}
            >
              <span>{totalRecipes} Rezepte</span>
              <span style={{ opacity: 0.4 }}>·</span>
              <span>{brand.signature}</span>
              <span style={{ opacity: 0.4 }}>·</span>
              <span>{brand.handle}</span>
            </div>
          </div>

          <div className="relative">
            <div
              className="relative aspect-[3/4] overflow-hidden rounded-[var(--radius-card)] lg:aspect-[4/5]"
              style={{
                boxShadow:
                  "0 1px 0 rgba(0,0,0,0.05), 0 24px 48px -28px rgba(0,0,0,0.4)",
                maxWidth: "420px",
                marginLeft: "auto",
              }}
            >
              <Image
                src={pack.coverImage}
                alt={`${pack.title} – ${pack.tagline}`}
                fill
                sizes="(min-width: 1024px) 420px, 100vw"
                className="object-cover"
                priority
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
