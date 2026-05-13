import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { after } from "next/server";
import { loadBrand } from "@/lib/custom-brands-server";
import { detectAndTriggerEnrichGaps } from "@/lib/reel-library/pack-builder";
import {
  getPack,
  getPacksForBrand,
  mergeAndRenumberPacks,
  packs,
} from "@/lib/packs";
import {
  getCustomPackByIdServer,
  getCustomPackServer,
  getCustomPacksWithIdsForBrandServer,
  getCustomRecipeCountsForBrand,
  getHiddenRecipeCountsForBrand,
} from "@/lib/custom-packs-server";
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
  const brand = await loadBrand(brandSlug);
  const pack =
    getPack(brandSlug, packSlug) ??
    (await getCustomPackServer(brandSlug, packSlug));

  if (!brand || !pack) {
    return { title: "Pack nicht gefunden · Recipe Card Builder" };
  }

  // Live count for SEO description: curated baseline + custom adds − hidden.
  // Same formula the page body uses below — kept in sync so the meta tag
  // never disagrees with what the visitor sees.
  const [customCounts, hiddenCounts] = await Promise.all([
    getCustomRecipeCountsForBrand(brandSlug),
    getHiddenRecipeCountsForBrand(brandSlug),
  ]);
  const liveRecipeCount = Math.max(
    0,
    pack.recipeCount +
      (customCounts[packSlug] ?? 0) -
      (hiddenCounts[packSlug] ?? 0)
  );

  return {
    title: `${pack.title} · ${brand.name} · Recipe Card Builder`,
    description: `${pack.description} ${liveRecipeCount} Rezeptkarten — druckfertig.`,
  };
}

export default async function PackPage({ params }: PackPageProps) {
  const { brand: brandSlug, pack: packSlug } = await params;
  const brand = await loadBrand(brandSlug);
  // Try curated packs first, fall back to user-created custom packs in
  // Supabase. We track whether the pack came from the custom table so we
  // can wire up its delete button on the actions bar.
  const staticPack = getPack(brandSlug, packSlug);
  const customRow = staticPack
    ? null
    : await getCustomPackByIdServer(brandSlug, packSlug);
  const rawPack = staticPack ?? customRow?.pack;

  if (!brand || !rawPack) {
    notFound();
  }

  // Look up the pack's display number from the same merged+renumbered
  // list the workspace uses, so "Pack 06" stays consistent across the
  // two pages and shifts down after a delete (Pack 7 → Pack 6, etc).
  const allStatic = getPacksForBrand(brandSlug);
  const allCustom = await getCustomPacksWithIdsForBrandServer(brandSlug);
  const merged = mergeAndRenumberPacks(
    allStatic,
    allCustom.map((c) => c.pack)
  );
  const pack = merged.find((p) => p.slug === packSlug) ?? rawPack;

  const recipes = await getRecipesForPack(pack.slug);

  // Safety-Net: bei jedem Pack-Detail-Visit pruefen wir ob Recipes ohne
  // Hero/Mikros existieren oder das Pack-Cover fehlt — und triggern dann
  // /packs/enrich + /recipes/enrich nach. Macht den Pack robust gegen
  // Lambda-Timeouts oder transiente Flux/Gemini-Fails bei der initialen
  // Erstellung. Sicheres "skip wenn schon enrich'd"-Verhalten ist in den
  // Endpoints selbst (hasCover/needsHero/needsMicros). Custom-Packs only —
  // statische Bienen-Packs sind code-only und haben ihren Content
  // committed, brauchen keinen Enrich-Trigger.
  if (customRow) {
    const hdrs = await headers();
    const origin =
      hdrs.get("x-forwarded-proto") && hdrs.get("host")
        ? `${hdrs.get("x-forwarded-proto")}://${hdrs.get("host")}`
        : `https://${hdrs.get("host") ?? "clever-satoshi-22bf41.vercel.app"}`;
    after(async () => {
      try {
        await detectAndTriggerEnrichGaps(origin, brandSlug, pack.slug);
      } catch (err) {
        console.error("[pack-detail] gap-trigger failed", err);
      }
    });
  }

  // Live recipe count for the cover hero + the "Alle Rezeptkarten" badge:
  //   curated cards visible
  // + custom cards the user dropped into THIS pack
  // − curated cards the user hid from THIS pack
  // Same formula the workspace pack-card uses, scoped to one pack. We use
  // pack.recipeCount as the curated baseline (instead of recipes.length)
  // so a custom pack — which has no curated rows — starts from 0 and the
  // count then equals exactly the number of custom cards added.
  const [customCountsForBrand, hiddenCountsForBrand] = await Promise.all([
    getCustomRecipeCountsForBrand(brandSlug),
    getHiddenRecipeCountsForBrand(brandSlug),
  ]);
  const liveRecipeCount = Math.max(
    0,
    pack.recipeCount +
      (customCountsForBrand[pack.slug] ?? 0) -
      (hiddenCountsForBrand[pack.slug] ?? 0)
  );

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ background: brand.tokens.background }}
    >
      <SiteHeader />
      <PackCover brand={brand} pack={pack} totalRecipes={liveRecipeCount} />
      <PackActions
        brand={brand}
        pack={pack}
        customPackId={customRow?.id}
      />

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
              {liveRecipeCount} {liveRecipeCount === 1 ? "Karte" : "Karten"} · klick für die Vollansicht
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
