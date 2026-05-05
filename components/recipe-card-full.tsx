import type { Brand } from "@/lib/brands";
import type { Pack } from "@/lib/packs";
import type { Recipe } from "@/lib/recipes";

type RecipeCardFullProps = {
  brand: Brand;
  pack: Pack;
  recipe: Recipe;
  totalRecipes: number;
};

const fontClassMap: Record<Pack["displayFont"], string> = {
  fraunces: "font-display",
  "dm-serif": "font-display italic",
  "inter-tight": "font-sans font-bold tracking-[-0.02em]",
};

export function RecipeCardFull({
  brand,
  pack,
  recipe,
  totalRecipes,
}: RecipeCardFullProps) {
  const fontClass = fontClassMap[pack.displayFont];
  const totalTime = recipe.prepTime + (recipe.cookTime ?? 0);
  const cardLabel = String(recipe.number).padStart(2, "0");
  const totalLabel = String(totalRecipes).padStart(2, "0");

  return (
    <article
      className="mx-auto w-full max-w-[820px] overflow-hidden rounded-[var(--radius-card)] border bg-white"
      style={{
        borderColor: brand.tokens.line,
        boxShadow:
          "0 1px 0 rgba(43,31,25,0.05), 0 28px 60px -28px rgba(43,31,25,0.25)",
      }}
    >
      {/* Top color strip — Bienes "Akzentstreifen" pro Karte */}
      <div
        className="h-2 w-full"
        style={{ background: pack.mood.accent }}
      />

      {/* Header with pack info */}
      <div className="px-10 pt-8 pb-6 sm:px-14 sm:pt-12">
        <div className="flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.2em]">
          <span style={{ color: pack.mood.inkSoft }}>
            Pack {String(pack.number).padStart(2, "0")} · {pack.title}
          </span>
          <span
            className="font-mono"
            style={{ color: pack.mood.inkSoft }}
          >
            Karte {cardLabel} / {totalLabel}
          </span>
        </div>

        <h1
          className={`${fontClass} mt-7 text-[44px] leading-[0.98] tracking-[-0.01em] uppercase sm:text-[56px]`}
          style={{ color: pack.mood.ink }}
        >
          {recipe.title}
        </h1>
        <p
          className="mt-3 font-display text-[20px] italic leading-snug"
          style={{ color: pack.mood.inkSoft }}
        >
          {recipe.subtitle}
        </p>

        {/* Quick stats row */}
        <div
          className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-2 border-t border-b py-4 text-[12px] font-semibold uppercase tracking-[0.14em]"
          style={{
            borderColor: pack.mood.ink + "22",
            color: pack.mood.inkSoft,
          }}
        >
          <span className="inline-flex items-center gap-2">
            <Clock /> {totalTime} Min
          </span>
          <span className="inline-flex items-center gap-2">
            <Servings /> {recipe.servings} Portion{recipe.servings === 1 ? "" : "en"}
          </span>
          <span className="inline-flex items-center gap-2">
            <Difficulty /> {recipe.difficulty}
          </span>
          {recipe.tags.length ? (
            <span className="ml-auto inline-flex items-center gap-1.5 normal-case">
              {recipe.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{
                    background: pack.mood.background + "70",
                    color: pack.mood.ink,
                  }}
                >
                  {tag}
                </span>
              ))}
            </span>
          ) : null}
        </div>
      </div>

      {/* Body: ingredients + instructions */}
      <div className="grid grid-cols-1 gap-10 px-10 pb-8 sm:px-14 lg:grid-cols-[1fr_1.4fr] lg:gap-14">
        <div className="flex flex-col gap-4">
          <h2
            className="text-[12px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: pack.mood.accent }}
          >
            Man nehme
          </h2>
          <ul className="flex flex-col">
            {recipe.ingredients.map((ingredient, idx) => (
              <li
                key={`${ingredient.name}-${idx}`}
                className="grid grid-cols-[4.2rem_1fr] items-baseline gap-3 border-b py-2.5"
                style={{
                  borderColor: pack.mood.ink + "12",
                  color: pack.mood.ink,
                }}
              >
                <span
                  className="font-mono text-[12px] tabular-nums"
                  style={{ color: pack.mood.inkSoft }}
                >
                  {ingredient.amount}
                </span>
                <span className="text-[14px] leading-snug">
                  {ingredient.name}
                  {ingredient.note ? (
                    <span
                      className="block text-[11px] italic"
                      style={{ color: pack.mood.inkSoft }}
                    >
                      {ingredient.note}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-4">
          <h2
            className="text-[12px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: pack.mood.accent }}
          >
            Zubereitung
          </h2>
          <ol className="flex flex-col gap-4">
            {recipe.steps.map((step, idx) => (
              <li
                key={idx}
                className="grid grid-cols-[2.2rem_1fr] gap-3"
              >
                <span
                  className="font-display text-[28px] leading-none tabular-nums"
                  style={{ color: pack.mood.accent }}
                >
                  {idx + 1}
                </span>
                <span
                  className="text-[15px] leading-[1.55]"
                  style={{ color: pack.mood.ink }}
                >
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Nutrition block — Bienes prominenter Nährwert-Block */}
      <div
        className="mx-10 mb-8 overflow-hidden rounded-2xl sm:mx-14"
        style={{ background: pack.mood.background }}
      >
        <div
          className="flex items-center justify-between gap-3 border-b px-6 py-3"
          style={{ borderColor: pack.mood.ink + "1a" }}
        >
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.2em]"
            style={{ color: pack.mood.inkSoft }}
          >
            Nährwerte pro Portion
          </span>
          <span
            className="font-mono text-[10px] uppercase tracking-[0.16em]"
            style={{ color: pack.mood.inkSoft }}
          >
            ⭐
          </span>
        </div>
        <div className="grid grid-cols-4">
          <NutriCell
            label="Kalorien"
            value={`${recipe.nutrition.kcal}`}
            unit="kcal"
            highlight
            pack={pack}
          />
          <NutriCell
            label="Eiweiß"
            value={`${recipe.nutrition.protein}`}
            unit="g"
            pack={pack}
          />
          <NutriCell
            label="Kohlenhydrate"
            value={`${recipe.nutrition.carbs}`}
            unit="g"
            pack={pack}
          />
          <NutriCell
            label="Fett"
            value={`${recipe.nutrition.fat}`}
            unit="g"
            pack={pack}
          />
        </div>
      </div>

      {/* Bienes Signature footer */}
      <div
        className="flex items-center justify-between gap-3 border-t px-10 py-5 sm:px-14"
        style={{
          borderColor: brand.tokens.line,
          background: brand.tokens.surface,
        }}
      >
        <span
          className="font-display text-[20px] italic"
          style={{ color: brand.tokens.ink }}
        >
          {brand.signature}
        </span>
        <span
          className="text-[11px] font-medium uppercase tracking-[0.16em]"
          style={{ color: brand.tokens.inkMuted }}
        >
          {brand.handle} · {brand.tagline}
        </span>
      </div>
    </article>
  );
}

function NutriCell({
  label,
  value,
  unit,
  pack,
  highlight = false,
}: {
  label: string;
  value: string;
  unit: string;
  pack: Pack;
  highlight?: boolean;
}) {
  return (
    <div
      className="flex flex-col items-center gap-1 px-2 py-5"
      style={{
        background: highlight ? "rgba(255,255,255,0.6)" : "transparent",
      }}
    >
      <span
        className="flex items-baseline gap-1 font-display tabular-nums"
        style={{ color: pack.mood.ink }}
      >
        <span className="text-[34px] leading-none">{value}</span>
        <span
          className="text-[12px]"
          style={{ color: pack.mood.inkSoft }}
        >
          {unit}
        </span>
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

function Clock() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M6 3v3l1.8 1.2"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Servings() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M2 9c0-1.7 1.8-3 4-3s4 1.3 4 3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx="6" cy="3.5" r="1.7" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function Difficulty() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M2 9V7m3 2V5m3 4V3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
