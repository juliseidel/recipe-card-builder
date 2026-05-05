import Link from "next/link";
import type { Brand } from "@/lib/brands";
import type { Pack } from "@/lib/packs";
import type { Recipe } from "@/lib/recipes";

type RecipeCardPreviewProps = {
  brand: Brand;
  pack: Pack;
  recipe: Recipe;
};

export function RecipeCardPreview({
  brand,
  pack,
  recipe,
}: RecipeCardPreviewProps) {
  const totalTime = recipe.prepTime + (recipe.cookTime ?? 0);
  const topIngredients = recipe.ingredients.slice(0, 4);

  return (
    <Link
      href={`/${brand.slug}/${pack.slug}/${recipe.slug}`}
      className="group flex flex-col overflow-hidden rounded-[var(--radius-card)] border transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[var(--shadow-card-hover)]"
      style={{
        borderColor: brand.tokens.line,
        background: brand.tokens.surface,
        boxShadow: "var(--shadow-card)",
      }}
    >
      {/* Recipe header strip */}
      <div
        className="flex items-center justify-between gap-3 border-b px-5 py-3"
        style={{
          borderColor: brand.tokens.line,
          background: pack.mood.background + "40",
        }}
      >
        <span
          className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: pack.mood.ink }}
        >
          Karte {String(recipe.number).padStart(2, "0")}
        </span>
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: pack.mood.ink }}
        >
          {recipe.difficulty} · {totalTime} Min
        </span>
      </div>

      {/* Title block */}
      <div className="flex flex-col gap-2 px-5 pt-5 pb-4">
        <h3
          className="font-display text-[24px] leading-[1.05] tracking-[-0.005em]"
          style={{ color: brand.tokens.ink }}
        >
          {recipe.title}
        </h3>
        <p
          className="text-[13px] leading-snug"
          style={{ color: brand.tokens.inkMuted }}
        >
          {recipe.subtitle}
        </p>
      </div>

      {/* Ingredients preview */}
      <div className="flex flex-col gap-2 px-5 pb-5">
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.16em]"
          style={{ color: brand.tokens.inkMuted }}
        >
          Man nehme · {recipe.ingredients.length} Zutaten
        </span>
        <ul className="flex flex-col gap-1 text-[13px]">
          {topIngredients.map((ingredient, idx) => (
            <li
              key={`${ingredient.name}-${idx}`}
              className="flex items-baseline gap-2"
              style={{ color: brand.tokens.ink }}
            >
              <span
                className="font-mono text-[11px] tabular-nums"
                style={{ color: brand.tokens.inkMuted, minWidth: "3.5rem" }}
              >
                {ingredient.amount}
              </span>
              <span>{ingredient.name}</span>
            </li>
          ))}
          {recipe.ingredients.length > 4 ? (
            <li
              className="text-[12px] italic"
              style={{ color: brand.tokens.inkMuted }}
            >
              … + {recipe.ingredients.length - 4} weitere
            </li>
          ) : null}
        </ul>
      </div>

      {/* Macros strip */}
      <div
        className="mt-auto grid grid-cols-4 gap-px"
        style={{ background: brand.tokens.line }}
      >
        <Macro
          label="kcal"
          value={recipe.nutrition.kcal}
          accent={pack.mood.accent}
          brand={brand}
          highlight
        />
        <Macro label="P" value={`${recipe.nutrition.protein}g`} brand={brand} />
        <Macro label="K" value={`${recipe.nutrition.carbs}g`} brand={brand} />
        <Macro label="F" value={`${recipe.nutrition.fat}g`} brand={brand} />
      </div>

      {/* Tags + CTA */}
      <div
        className="flex items-center justify-between gap-2 border-t px-5 py-3"
        style={{
          borderColor: brand.tokens.line,
          background: brand.tokens.surface,
        }}
      >
        <div className="flex flex-wrap gap-1">
          {recipe.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{
                background: pack.mood.background + "60",
                color: pack.mood.ink,
              }}
            >
              {tag}
            </span>
          ))}
        </div>
        <span
          className="inline-flex items-center gap-1 text-[12px] font-semibold transition-transform duration-300 group-hover:translate-x-0.5"
          style={{ color: brand.tokens.ink }}
        >
          Karte ansehen
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
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
    </Link>
  );
}

function Macro({
  label,
  value,
  accent,
  brand,
  highlight = false,
}: {
  label: string;
  value: string | number;
  accent?: string;
  brand: Brand;
  highlight?: boolean;
}) {
  return (
    <div
      className="flex flex-col items-center gap-0.5 px-1 py-2.5"
      style={{ background: brand.tokens.surface }}
    >
      <span
        className="font-display text-[16px] leading-none tabular-nums"
        style={{
          color: highlight && accent ? accent : brand.tokens.ink,
          fontWeight: highlight ? 600 : 500,
        }}
      >
        {value}
      </span>
      <span
        className="text-[9px] font-semibold uppercase tracking-[0.18em]"
        style={{ color: brand.tokens.inkMuted }}
      >
        {label}
      </span>
    </div>
  );
}
