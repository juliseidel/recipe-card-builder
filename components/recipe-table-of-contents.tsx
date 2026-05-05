import type { Brand } from "@/lib/brands";
import type { Pack } from "@/lib/packs";
import type { Recipe } from "@/lib/recipes";

type RecipeTableOfContentsProps = {
  brand: Brand;
  pack: Pack;
  recipes: Recipe[];
};

export function RecipeTableOfContents({
  brand,
  pack,
  recipes,
}: RecipeTableOfContentsProps) {
  return (
    <section className="mx-auto max-w-[1400px] px-6 pt-12 pb-2 lg:px-10 lg:pt-16">
      <div
        className="overflow-hidden rounded-[var(--radius-card)] border"
        style={{
          borderColor: brand.tokens.line,
          background: brand.tokens.surface,
        }}
      >
        <div
          className="flex items-end justify-between gap-3 border-b px-6 py-5"
          style={{ borderColor: brand.tokens.line }}
        >
          <h2
            className="font-display text-[28px] leading-none tracking-[-0.01em]"
            style={{ color: brand.tokens.ink }}
          >
            Inhaltsverzeichnis
          </h2>
          <span
            className="text-[13px]"
            style={{ color: brand.tokens.inkMuted }}
          >
            {recipes.length} Karten
          </span>
        </div>

        <ul className="divide-y" style={{ borderColor: brand.tokens.line }}>
          {recipes.map((recipe) => (
            <li
              key={recipe.slug}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-6 py-4 text-[14px] transition-colors hover:bg-[color:var(--hover-bg)] sm:grid-cols-[auto_1.4fr_1fr_auto]"
              style={
                {
                  borderColor: brand.tokens.line,
                  "--hover-bg": pack.mood.background + "60",
                } as React.CSSProperties
              }
            >
              <span
                className="font-mono text-[11px] font-semibold tabular-nums"
                style={{ color: brand.tokens.inkMuted }}
              >
                {String(recipe.number).padStart(2, "0")}
              </span>

              <div className="flex flex-col gap-0.5">
                <span
                  className="font-display text-[18px] leading-tight tracking-[-0.005em]"
                  style={{ color: brand.tokens.ink }}
                >
                  {recipe.title}
                </span>
                <span
                  className="text-[12px]"
                  style={{ color: brand.tokens.inkMuted }}
                >
                  {recipe.subtitle}
                </span>
              </div>

              <div
                className="hidden flex-wrap items-center gap-3 text-[12px] sm:flex"
                style={{ color: brand.tokens.inkMuted }}
              >
                <span className="inline-flex items-center gap-1">
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <circle
                      cx="5.5"
                      cy="5.5"
                      r="4.5"
                      stroke="currentColor"
                      strokeWidth="1"
                    />
                    <path
                      d="M5.5 3v2.7l1.6 1.1"
                      stroke="currentColor"
                      strokeWidth="1"
                      strokeLinecap="round"
                    />
                  </svg>
                  {recipe.prepTime + (recipe.cookTime ?? 0)} Min
                </span>
                <span>{recipe.difficulty}</span>
                <span>{recipe.servings} Portion{recipe.servings === 1 ? "" : "en"}</span>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums"
                  style={{
                    background: pack.mood.background + "70",
                    color: pack.mood.ink,
                  }}
                >
                  {recipe.nutrition.kcal} kcal
                </span>
                <span
                  className="hidden font-mono text-[11px] tabular-nums sm:inline"
                  style={{ color: brand.tokens.inkMuted }}
                >
                  P {recipe.nutrition.protein}g
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
