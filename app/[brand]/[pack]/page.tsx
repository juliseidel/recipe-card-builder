import { notFound } from "next/navigation";
import { getBrand } from "@/lib/brands";
import { getPack } from "@/lib/packs";
import { getRecipesForPack } from "@/lib/recipes";
import { SiteHeader } from "@/components/site-header";
import { PackCover } from "@/components/pack-cover";
import { PackActions } from "@/components/pack-actions";
import { RecipeTableOfContents } from "@/components/recipe-table-of-contents";
import { RecipeCardPreview } from "@/components/recipe-card-preview";
import { NutritionOverview } from "@/components/nutrition-overview";

type PackPageProps = {
  params: Promise<{ brand: string; pack: string }>;
};

export async function generateMetadata({ params }: PackPageProps) {
  const { brand: brandSlug, pack: packSlug } = await params;
  const brand = getBrand(brandSlug);
  const pack = getPack(brandSlug, packSlug);

  if (!brand || !pack) {
    return { title: "Pack nicht gefunden · Recipe Card Builder" };
  }

  return {
    title: `${pack.title} · ${brand.name} · Recipe Card Builder`,
    description: `${pack.description} ${pack.recipeCount} Rezeptkarten — druckfertig.`,
  };
}

export default async function PackPage({ params }: PackPageProps) {
  const { brand: brandSlug, pack: packSlug } = await params;
  const brand = getBrand(brandSlug);
  const pack = getPack(brandSlug, packSlug);

  if (!brand || !pack) {
    notFound();
  }

  const recipes = getRecipesForPack(pack.slug);
  const totalKcal = recipes.reduce((sum, r) => sum + r.nutrition.kcal, 0);
  const totalProtein = recipes.reduce((sum, r) => sum + r.nutrition.protein, 0);

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ background: brand.tokens.background }}
    >
      <SiteHeader />
      <PackCover
        brand={brand}
        pack={pack}
        totalRecipes={recipes.length}
        totalKcal={totalKcal}
        totalProtein={totalProtein}
      />
      <PackActions brand={brand} pack={pack} />

      <main className="flex-1">
        <RecipeTableOfContents brand={brand} pack={pack} recipes={recipes} />

        <section className="mx-auto max-w-[1400px] px-6 pt-12 pb-2 lg:px-10 lg:pt-16">
          <div
            className="mb-6 flex flex-col gap-2 border-b pb-5 sm:flex-row sm:items-end sm:justify-between"
            style={{ borderColor: brand.tokens.line }}
          >
            <div className="flex flex-col gap-1.5">
              <span
                className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: brand.tokens.inkMuted }}
              >
                Pack-Inhalt · Alle Karten
              </span>
              <h2
                className="font-display text-[32px] leading-none tracking-[-0.01em]"
                style={{ color: brand.tokens.ink }}
              >
                Rezeptkarten
              </h2>
              <p
                className="mt-1 text-[14px]"
                style={{ color: brand.tokens.inkMuted }}
              >
                Vorschau jeder Karte mit Zutaten, Makros und Zubereitungszeit.
                Klick auf eine Karte für die Vollansicht.
              </p>
            </div>
            <span
              className="font-mono text-[11px] uppercase tracking-[0.14em]"
              style={{ color: brand.tokens.inkMuted }}
            >
              {recipes.length} Karten · {pack.mood.accent}
            </span>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {recipes.map((recipe) => (
              <RecipeCardPreview
                key={recipe.slug}
                brand={brand}
                pack={pack}
                recipe={recipe}
              />
            ))}
          </div>
        </section>

        <NutritionOverview brand={brand} pack={pack} recipes={recipes} />
      </main>

      <footer
        className="border-t"
        style={{
          borderColor: brand.tokens.line,
          background: brand.tokens.surface,
        }}
      >
        <div className="mx-auto flex max-w-[1400px] flex-col items-start justify-between gap-3 px-6 py-7 text-[13px] sm:flex-row sm:items-center lg:px-10">
          <p style={{ color: brand.tokens.inkMuted }}>
            <span style={{ color: brand.tokens.ink, fontWeight: 500 }}>
              {brand.signature}
            </span>{" "}
            · Pack &quot;{pack.title}&quot; · gebaut mit Recipe Card Builder
          </p>
          <p
            className="font-mono text-[11px] uppercase tracking-[0.14em]"
            style={{ color: brand.tokens.inkMuted }}
          >
            {brand.handle} · {pack.category}
          </p>
        </div>
      </footer>
    </div>
  );
}
