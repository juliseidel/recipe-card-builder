import type { Brand } from "@/lib/brands";
import type { Pack } from "@/lib/packs";
import type { Recipe } from "@/lib/recipes";

type NutritionOverviewProps = {
  brand: Brand;
  pack: Pack;
  recipes: Recipe[];
};

export function NutritionOverview({
  brand,
  pack,
  recipes,
}: NutritionOverviewProps) {
  const totals = recipes.reduce(
    (acc, recipe) => ({
      kcal: acc.kcal + recipe.nutrition.kcal,
      protein: acc.protein + recipe.nutrition.protein,
      carbs: acc.carbs + recipe.nutrition.carbs,
      fat: acc.fat + recipe.nutrition.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const averages = {
    kcal: Math.round(totals.kcal / recipes.length),
    protein: Math.round(totals.protein / recipes.length),
    carbs: Math.round(totals.carbs / recipes.length),
    fat: Math.round(totals.fat / recipes.length),
  };

  return (
    <section className="mx-auto max-w-[1400px] px-6 pt-14 pb-12 lg:px-10 lg:pt-20">
      <div
        className="overflow-hidden rounded-[var(--radius-card)] border"
        style={{
          borderColor: brand.tokens.line,
          background: brand.tokens.surface,
        }}
      >
        <div
          className="flex flex-col gap-1 border-b px-6 py-5 sm:flex-row sm:items-end sm:justify-between"
          style={{ borderColor: brand.tokens.line }}
        >
          <h2
            className="font-display text-[28px] leading-none tracking-[-0.01em]"
            style={{ color: brand.tokens.ink }}
          >
            Nährwerte im Überblick
          </h2>
          <span className="text-[13px]" style={{ color: brand.tokens.inkMuted }}>
            Ø {averages.kcal} kcal · Ø {averages.protein}g Eiweiß pro Portion
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr
                className="text-left text-[10px] font-semibold uppercase tracking-[0.16em]"
                style={{
                  color: brand.tokens.inkMuted,
                  background: pack.mood.background + "30",
                }}
              >
                <th className="px-6 py-3 font-semibold">Rezept</th>
                <th className="px-3 py-3 text-right font-semibold tabular-nums">
                  kcal
                </th>
                <th className="px-3 py-3 text-right font-semibold tabular-nums">
                  Eiweiß
                </th>
                <th className="px-3 py-3 text-right font-semibold tabular-nums">
                  Kohlenhydrate
                </th>
                <th className="px-6 py-3 text-right font-semibold tabular-nums">
                  Fett
                </th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: brand.tokens.line }}>
              {recipes.map((recipe) => (
                <tr
                  key={recipe.slug}
                  className="transition-colors hover:bg-[color:var(--hover-bg)]"
                  style={
                    {
                      borderColor: brand.tokens.line,
                      "--hover-bg": pack.mood.background + "40",
                    } as React.CSSProperties
                  }
                >
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <span
                        className="font-mono text-[10px] font-semibold tabular-nums"
                        style={{ color: brand.tokens.inkMuted }}
                      >
                        {String(recipe.number).padStart(2, "0")}
                      </span>
                      <span
                        className="font-medium"
                        style={{ color: brand.tokens.ink }}
                      >
                        {recipe.title}
                      </span>
                    </div>
                  </td>
                  <td
                    className="px-3 py-3.5 text-right tabular-nums"
                    style={{ color: brand.tokens.ink, fontWeight: 500 }}
                  >
                    {recipe.nutrition.kcal}
                  </td>
                  <td
                    className="px-3 py-3.5 text-right tabular-nums"
                    style={{ color: brand.tokens.ink }}
                  >
                    {recipe.nutrition.protein} g
                  </td>
                  <td
                    className="px-3 py-3.5 text-right tabular-nums"
                    style={{ color: brand.tokens.ink }}
                  >
                    {recipe.nutrition.carbs} g
                  </td>
                  <td
                    className="px-6 py-3.5 text-right tabular-nums"
                    style={{ color: brand.tokens.ink }}
                  >
                    {recipe.nutrition.fat} g
                  </td>
                </tr>
              ))}
              <tr
                style={{
                  background: pack.mood.background + "60",
                  color: pack.mood.ink,
                }}
              >
                <td className="px-6 py-3.5 text-[11px] font-semibold uppercase tracking-[0.14em]">
                  Pack-Total
                </td>
                <td className="px-3 py-3.5 text-right font-semibold tabular-nums">
                  {totals.kcal}
                </td>
                <td className="px-3 py-3.5 text-right font-semibold tabular-nums">
                  {totals.protein} g
                </td>
                <td className="px-3 py-3.5 text-right font-semibold tabular-nums">
                  {totals.carbs} g
                </td>
                <td className="px-6 py-3.5 text-right font-semibold tabular-nums">
                  {totals.fat} g
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
