import { notFound } from "next/navigation";
import { brands, getBrand } from "@/lib/brands";
import { getPacksForBrand, mergeAndRenumberPacks } from "@/lib/packs";
import {
  getCustomPacksWithIdsForBrandServer,
  getCustomRecipeCountsForBrand,
  getHiddenRecipeCountsForBrand,
} from "@/lib/custom-packs-server";
import { SiteHeader } from "@/components/site-header";
import { BrandHero } from "@/components/brand-hero";
import { PackCard } from "@/components/pack-card";
import { NewPackCard } from "@/components/new-pack-card";

// Pre-render every brand at build time. The brand+pack catalogue is fully
// static (lib/brands.ts, lib/packs.ts) so we can hand Vercel a finished HTML
// page instead of running the renderer on every request.
export async function generateStaticParams() {
  return brands.map((b) => ({ brand: b.slug }));
}

// Short revalidate window (30s) so newly-created custom packs surface
// quickly in the workspace grid without the user needing a hard reload.
// Curated content is identical across requests, so the cache hit ratio is
// still high even with the lower window.
export const revalidate = 30;

type BrandPageProps = {
  params: Promise<{ brand: string }>;
};

export async function generateMetadata({ params }: BrandPageProps) {
  const { brand: brandSlug } = await params;
  const brand = getBrand(brandSlug);

  if (!brand) {
    return { title: "Workspace nicht gefunden · Recipe Card Builder" };
  }

  // Live counts for the SEO description so the meta tag never lies after
  // a user adds/deletes packs or cards. Same merge formula the page body
  // uses below.
  const staticPacksMeta = getPacksForBrand(brand.slug);
  const [customPacksMeta, customRecipeCountsMeta, hiddenRecipeCountsMeta] =
    await Promise.all([
      getCustomPacksWithIdsForBrandServer(brand.slug),
      getCustomRecipeCountsForBrand(brand.slug),
      getHiddenRecipeCountsForBrand(brand.slug),
    ]);
  const livePackCount = staticPacksMeta.length + customPacksMeta.length;
  const liveRecipeCountMeta = mergeAndRenumberPacks(
    staticPacksMeta,
    customPacksMeta.map((c) => c.pack)
  ).reduce(
    (sum, p) =>
      sum +
      Math.max(
        0,
        p.recipeCount +
          (customRecipeCountsMeta[p.slug] ?? 0) -
          (hiddenRecipeCountsMeta[p.slug] ?? 0)
      ),
    0
  );

  return {
    title: `${brand.name} · Workspace · Recipe Card Builder`,
    description: `${brand.bio} — ${livePackCount} Rezept-Packs, ${liveRecipeCountMeta} Rezepte.`,
  };
}

export default async function BrandPage({ params }: BrandPageProps) {
  const { brand: brandSlug } = await params;
  const brand = getBrand(brandSlug);

  if (!brand) {
    notFound();
  }

  const staticPacks = getPacksForBrand(brand.slug);
  const [customPacksWithIds, customRecipeCounts, hiddenRecipeCounts] =
    await Promise.all([
      getCustomPacksWithIdsForBrandServer(brand.slug),
      // One aggregate query for ALL custom recipes across the brand → keyed
      // by pack slug. Used right below to add live custom-recipe totals to
      // each pack's count badge.
      getCustomRecipeCountsForBrand(brand.slug),
      // Same pattern for hidden curated recipes — subtracted from the count
      // so a user who hides cards sees the badge tick down.
      getHiddenRecipeCountsForBrand(brand.slug),
    ]);
  // Curated packs first (1..5), then custom packs in creation order
  // (oldest → 6, next → 7, …). Numbers get rewritten to position-in-array
  // so deleting position 6 promotes 7 → 6 on the next render.
  const customPacks = customPacksWithIds.map((c) => c.pack);
  const customIdBySlug = new Map(
    customPacksWithIds.map((c) => [c.pack.slug, c.id])
  );
  // Override each pack's stored recipeCount with the LIVE total:
  //   curated stored count
  // + any custom recipes the user dropped into this pack
  // − any curated recipes the user hid from this pack
  // Custom packs start at recipeCount=0 (they have no curated baseline) so
  // the formula reduces to the custom-recipe total for them, which is what
  // the badge should show.
  const packs = mergeAndRenumberPacks(staticPacks, customPacks).map((p) => ({
    ...p,
    recipeCount: Math.max(
      0,
      p.recipeCount +
        (customRecipeCounts[p.slug] ?? 0) -
        (hiddenRecipeCounts[p.slug] ?? 0)
    ),
  }));
  const totalRecipes = packs.reduce((sum, p) => sum + p.recipeCount, 0);
  const nextPackNumber = packs.length + 1;

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ background: brand.tokens.background }}
    >
      <SiteHeader />
      <BrandHero
        brand={brand}
        livePackCount={packs.length}
        liveRecipeCount={totalRecipes}
      />

      <main className="flex-1">
        <section className="mx-auto max-w-[1400px] px-6 pt-10 pb-24 lg:px-10 lg:pt-12 lg:pb-32">
          <div
            className="mb-7 flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between"
            style={{ borderColor: brand.tokens.line }}
          >
            <div className="flex flex-col gap-1.5">
              <span
                className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: brand.tokens.inkMuted }}
              >
                Workspace · Pack-Sammlung
              </span>
              <h2
                className="font-display text-[32px] leading-none tracking-[-0.01em]"
                style={{ color: brand.tokens.ink }}
              >
                Deine Packs
              </h2>
              <p
                className="mt-1 text-[14px]"
                style={{ color: brand.tokens.inkMuted }}
              >
                {packs.length} Konzepte · {totalRecipes} Rezepte · alle druckfertig.
                Klick auf ein Pack, um die Karten zu sehen, zu bearbeiten oder als PDF zu exportieren.
              </p>
            </div>

            <div
              className="flex items-center gap-5 rounded-xl border px-4 py-2.5 text-[12px]"
              style={{
                borderColor: brand.tokens.line,
                background: brand.tokens.surface,
                color: brand.tokens.inkMuted,
              }}
            >
              <span className="flex items-center gap-2">
                <span
                  className="size-1.5 rounded-full"
                  style={{ background: brand.tokens.accent }}
                />
                Zuletzt bearbeitet
              </span>
              <span style={{ color: brand.tokens.ink }}>Heute, 14:32</span>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* New-pack card sits at the top so the call-to-action is the
                first thing the user sees in the grid. */}
            <NewPackCard brand={brand} nextNumber={nextPackNumber} />
            {packs.map((pack) => (
              <PackCard
                key={pack.slug}
                pack={pack}
                brand={brand}
                customPackId={customIdBySlug.get(pack.slug)}
              />
            ))}
          </div>
        </section>
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
            · Workspace gebaut mit Recipe Card Builder
          </p>
          <p
            className="font-mono text-[11px] uppercase tracking-[0.14em]"
            style={{ color: brand.tokens.inkMuted }}
          >
            {brand.handle} · {brand.stats.niche}
          </p>
        </div>
      </footer>
    </div>
  );
}
