import { notFound } from "next/navigation";
import { getBrand } from "@/lib/brands";
import { getPacksForBrand } from "@/lib/packs";
import { SiteHeader } from "@/components/site-header";
import { BrandHero } from "@/components/brand-hero";
import { PackCard } from "@/components/pack-card";
import { NewPackCard } from "@/components/new-pack-card";

type BrandPageProps = {
  params: Promise<{ brand: string }>;
};

export async function generateMetadata({ params }: BrandPageProps) {
  const { brand: brandSlug } = await params;
  const brand = getBrand(brandSlug);

  if (!brand) {
    return { title: "Workspace nicht gefunden · Recipe Card Builder" };
  }

  return {
    title: `${brand.name} · Workspace · Recipe Card Builder`,
    description: `${brand.bio} — ${brand.packCount} Recipe-Packs, ${brand.recipeCount} Rezepte.`,
  };
}

export default async function BrandPage({ params }: BrandPageProps) {
  const { brand: brandSlug } = await params;
  const brand = getBrand(brandSlug);

  if (!brand) {
    notFound();
  }

  const packs = getPacksForBrand(brand.slug);

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ background: brand.tokens.background }}
    >
      <SiteHeader />
      <BrandHero brand={brand} />

      <main className="flex-1">
        <section className="mx-auto max-w-[1400px] px-6 pt-14 pb-24 lg:px-10 lg:pt-20 lg:pb-32">
          <div
            className="mb-8 flex items-end justify-between border-b pb-5"
            style={{ borderColor: brand.tokens.line }}
          >
            <div className="flex flex-col gap-1.5">
              <span
                className="text-[12px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: brand.tokens.inkMuted }}
              >
                {brand.handle} · Pack-Sammlung
              </span>
              <h2
                className="font-display text-[36px] leading-none tracking-[-0.01em]"
                style={{ color: brand.tokens.ink }}
              >
                Bienes Recipe-Packs
              </h2>
              <p
                className="mt-1 text-[14px]"
                style={{ color: brand.tokens.inkMuted }}
              >
                Jedes Pack ist eine eigene Welt — eigene Stimmung, eigenes Layout, eigene Akzente.
                Klick auf ein Pack, um die Karten zu sehen oder zu bearbeiten.
              </p>
            </div>
            <div
              className="hidden flex-col items-end gap-1 font-mono text-[11px] uppercase tracking-[0.14em] sm:flex"
              style={{ color: brand.tokens.inkMuted }}
            >
              <span>{packs.length} Packs aktiv</span>
              <span>
                {packs.reduce((sum, p) => sum + p.recipeCount, 0)} Rezepte
              </span>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {packs.map((pack, index) => (
              <PackCard
                key={pack.slug}
                pack={pack}
                brand={brand}
                index={index}
              />
            ))}
            <NewPackCard brand={brand} />
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
        <div className="mx-auto flex max-w-[1400px] flex-col items-start justify-between gap-3 px-6 py-8 text-[13px] sm:flex-row sm:items-center lg:px-10">
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
