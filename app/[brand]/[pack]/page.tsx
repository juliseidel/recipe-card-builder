import { notFound } from "next/navigation";
import { getBrand } from "@/lib/brands";
import { getPack, packs } from "@/lib/packs";
import { getCustomPackServer } from "@/lib/custom-packs-server";
import { getRecipesForPack } from "@/lib/recipes";
import { SiteHeader } from "@/components/site-header";
import { PackCover } from "@/components/pack-cover";
import { PackActions } from "@/components/pack-actions";
import { RecipeGrid } from "@/components/recipe-grid";
import { NutritionOverview } from "@/components/nutrition-overview";

// Static generation per curated pack. Custom packs aren't pre-rendered (they
// don't exist at build time); Next falls back to on-demand rendering for
// any slug not in this list, which is exactly what we want for user-created
// concepts.
export async function generateStaticParams() {
  return packs.map((p) => ({ brand: p.brandSlug, pack: p.slug }));
}

// Custom packs change as the user works in them — disable static caching for
// dynamic-param requests so a freshly-created pack is reachable immediately.
export const dynamicParams = true;
export const revalidate = 60;

type PackPageProps = {
  params: Promise<{ brand: string; pack: string }>;
};

export async function generateMetadata({ params }: PackPageProps) {
  const { brand: brandSlug, pack: packSlug } = await params;
  const brand = getBrand(brandSlug);
  const pack =
    getPack(brandSlug, packSlug) ??
    (await getCustomPackServer(brandSlug, packSlug));

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
  // Try curated packs first, fall back to user-created custom packs in
  // Supabase. The rest of the page is layout-agnostic so both work the same.
  const pack =
    getPack(brandSlug, packSlug) ??
    (await getCustomPackServer(brandSlug, packSlug));

  if (!brand || !pack) {
    notFound();
  }

  const recipes = await getRecipesForPack(pack.slug);

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ background: brand.tokens.background }}
    >
      <SiteHeader />
      <PackCover brand={brand} pack={pack} totalRecipes={recipes.length} />
      <PackActions brand={brand} pack={pack} />

      <main className="flex-1">
        <section className="mx-auto max-w-[1400px] px-6 pt-12 pb-2 lg:px-10 lg:pt-16">
          <div
            className="mb-7 flex items-end justify-between gap-3 border-b pb-5"
            style={{ borderColor: brand.tokens.line }}
          >
            <h2
              className="font-display text-[28px] leading-none tracking-[-0.01em]"
              style={{ color: brand.tokens.ink }}
            >
              Alle Rezeptkarten
            </h2>
            <span
              className="text-[13px]"
              style={{ color: brand.tokens.inkMuted }}
            >
              {recipes.length} Karten · klick für die Vollansicht
            </span>
          </div>

          <RecipeGrid brand={brand} pack={pack} staticRecipes={recipes} />
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
            className="text-[12px]"
            style={{ color: brand.tokens.inkMuted }}
          >
            {brand.handle}
          </p>
        </div>
      </footer>
    </div>
  );
}
