import Image from "next/image";
import Link from "next/link";
import type { Brand } from "@/lib/brands";
import type { Pack } from "@/lib/packs";
import type { Recipe } from "@/lib/recipes";

type RecipeCardPreviewProps = {
  brand: Brand;
  pack: Pack;
  recipe: Recipe;
};

// Subtle variation in image position so cards don't look identical
const positions = [
  "object-center",
  "object-top",
  "object-[center_30%]",
  "object-[center_70%]",
  "object-[35%_center]",
  "object-[65%_center]",
  "object-[40%_30%]",
  "object-[60%_70%]",
];

export function RecipeCardPreview({
  brand,
  pack,
  recipe,
}: RecipeCardPreviewProps) {
  const totalTime = recipe.prepTime + (recipe.cookTime ?? 0);
  const heroImage = recipe.hero ?? pack.coverImage;
  const positionClass = positions[(recipe.number - 1) % positions.length];

  return (
    <Link
      href={`/${brand.slug}/${pack.slug}/${recipe.slug}`}
      className="group relative flex aspect-[3/4] flex-col justify-between overflow-hidden rounded-[var(--radius-card)] p-6 text-white transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[var(--shadow-card-hover)]"
      style={{
        boxShadow: "var(--shadow-card)",
      }}
    >
      {/* Background image */}
      <Image
        src={heroImage}
        alt={`${recipe.title} – ${recipe.subtitle}`}
        fill
        sizes="(min-width: 1280px) 420px, (min-width: 768px) 50vw, 100vw"
        className={`${positionClass} object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]`}
      />

      {/* Pack-mood color overlay (semi-transparent) */}
      <div
        className="absolute inset-0 mix-blend-multiply"
        style={{
          background: pack.mood.background,
          opacity: 0.78,
        }}
      />

      {/* Dark gradient bottom for legibility */}
      <div
        className="absolute inset-x-0 bottom-0 h-3/5"
        style={{
          background:
            "linear-gradient(to top, rgba(15,12,8,0.7) 0%, rgba(15,12,8,0.35) 35%, rgba(15,12,8,0) 100%)",
        }}
      />

      {/* Top label */}
      <div className="relative z-10 flex items-center justify-between">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-white/85">
          Karte {String(recipe.number).padStart(2, "0")}
        </span>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] backdrop-blur"
          style={{ background: "rgba(255,255,255,0.92)", color: pack.mood.ink }}
        >
          <span
            className="size-1.5 rounded-full"
            style={{ background: pack.mood.accent }}
          />
          {totalTime} Min
        </span>
      </div>

      {/* Bottom content */}
      <div className="relative z-10 flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <h3 className="font-display text-[30px] uppercase leading-[0.96] tracking-[-0.005em] text-white">
            {recipe.title}
          </h3>
          <p className="font-display text-[15px] italic leading-tight text-white/80">
            {recipe.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-3 border-t border-white/25 pt-3 text-[12px] text-white/85">
          <span className="font-display text-[18px] tabular-nums text-white">
            {recipe.nutrition.kcal}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em]">
            kcal
          </span>
          <span className="opacity-50">·</span>
          <span className="font-display text-[18px] tabular-nums text-white">
            {recipe.nutrition.protein}g
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em]">
            Eiweiß
          </span>
          <span className="ml-auto inline-flex items-center gap-1 text-[12px] font-semibold transition-transform duration-300 group-hover:translate-x-0.5">
            Karte
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path
                d="M2.5 6h7m0 0L6.5 3m3 3l-3 3"
                stroke="currentColor"
                strokeWidth="1.5"
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
