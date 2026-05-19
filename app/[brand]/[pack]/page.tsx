import { notFound } from "next/navigation";
import { loadBrand } from "@/lib/custom-brands-server";
import { PackAutoEnrichTrigger } from "@/components/pack-auto-enrich-trigger";
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
import { resolvePackType } from "@/lib/fitness/types";
import { getFitnessCardCountsForBrand } from "@/lib/fitness/custom-cards-server";
import { SiteHeader } from "@/components/site-header";
import { PackCover } from "@/components/pack-cover";
import { PackActions } from "@/components/pack-actions";
import { RecipeGrid } from "@/components/recipe-grid";
import { FitnessCardGrid } from "@/components/fitness-card-grid";
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
  // Bei Fitness-Packs gibt's keine kuratierten Karten — Live-Count = nur DB.
  const packType = resolvePackType(pack, brand);
  let liveCount = 0;
  if (packType === "fitness") {
    const fitnessCounts = await getFitnessCardCountsForBrand(brandSlug);
    liveCount = fitnessCounts[packSlug] ?? 0;
  } else {
    const [customCounts, hiddenCounts] = await Promise.all([
      getCustomRecipeCountsForBrand(brandSlug),
      getHiddenRecipeCountsForBrand(brandSlug),
    ]);
    liveCount = Math.max(
      0,
      pack.recipeCount +
        (customCounts[packSlug] ?? 0) -
        (hiddenCounts[packSlug] ?? 0)
    );
  }

  const label = packType === "fitness" ? "Trainingskarten" : "Rezeptkarten";
  return {
    title: `${pack.title} · ${brand.name} · Recipe Card Builder`,
    description: `${pack.description} ${liveCount} ${label} — druckfertig.`,
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

  // Pack-Type-Discriminator: 'recipe' (Default) oder 'fitness'. Steuert
  // welcher Loader laeuft + welcher Grid gerendert wird.
  const packType = resolvePackType(pack, brand);

  // Recipe-Pipeline-Daten nur laden wenn Recipe-Pack. Bei Fitness-Pack
  // sparen wir uns den DB-Roundtrip + die Curated-Recipes komplett.
  const recipes =
    packType === "recipe" ? await getRecipesForPack(pack.slug) : [];

  // Safety-Net: bei Pack-Detail-Visit wird ein Client-Component-Trigger
  // gemountet, der nach dem Render einen POST an /api/packs/auto-trigger-
  // enrich macht. Dieser Endpoint laeuft mit User-Session-Cookies (kein
  // Internal-Token noetig) und prueft via detectAndTriggerEnrichGaps ob
  // Recipes ohne Hero/Mikros oder Pack-Cover-Lueck existieren. Wenn ja:
  // triggert /packs/enrich + /recipes/enrich nach. Skipped fuer kuratierte
  // Bienen-Packs (kein customRow). Bei Fitness-Packs noch nicht aktiv —
  // eigener Fitness-Enrichment-Endpoint kommt in einem spaeteren Schritt.
  const enrichTriggerCustomPackId =
    packType === "recipe" ? customRow?.id ?? null : null;

  // Live count fuer Cover-Hero + Header. Bei Recipe-Pack: kuratiert +
  // custom − hidden. Bei Fitness-Pack: nur DB-Count (keine kuratierten
  // Fitness-Karten existieren, alles liegt in fitness_cards-Tabelle).
  let liveRecipeCount = 0;
  if (packType === "fitness") {
    const fitnessCounts = await getFitnessCardCountsForBrand(brandSlug);
    liveRecipeCount = fitnessCounts[pack.slug] ?? 0;
  } else {
    const [customCountsForBrand, hiddenCountsForBrand] = await Promise.all([
      getCustomRecipeCountsForBrand(brandSlug),
      getHiddenRecipeCountsForBrand(brandSlug),
    ]);
    liveRecipeCount = Math.max(
      0,
      pack.recipeCount +
        (customCountsForBrand[pack.slug] ?? 0) -
        (hiddenCountsForBrand[pack.slug] ?? 0)
    );
  }

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ background: brand.tokens.background }}
    >
      <SiteHeader />
      {enrichTriggerCustomPackId ? (
        <PackAutoEnrichTrigger
          brandSlug={brandSlug}
          packSlug={pack.slug}
        />
      ) : null}
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
              {packType === "fitness" ? "Alle Trainingskarten" : "Alle Rezeptkarten"}
            </h2>
            <span
              className="text-[13px]"
              style={{ color: brand.tokens.inkMuted }}
            >
              {liveRecipeCount} {liveRecipeCount === 1 ? "Karte" : "Karten"} · klick für die Vollansicht
            </span>
          </div>

          {packType === "fitness" ? (
            <FitnessCardGrid brand={brand} pack={pack} />
          ) : (
            <RecipeGrid brand={brand} pack={pack} staticRecipes={recipes} />
          )}
        </section>

        {packType === "recipe" ? (
          <NutritionOverview brand={brand} pack={pack} recipes={recipes} />
        ) : null}
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
