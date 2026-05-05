import { brands } from "@/lib/brands";
import { BrandCard } from "@/components/brand-card";
import { NewBrandCard } from "@/components/new-brand-card";
import { SiteHeader } from "@/components/site-header";

export default function Home() {
  const totalPacks = brands.reduce((sum, brand) => sum + brand.packCount, 0);
  const totalRecipes = brands.reduce((sum, brand) => sum + brand.recipeCount, 0);

  return (
    <div className="bg-paper flex min-h-screen flex-col">
      <SiteHeader />

      <main className="flex-1">
        <section className="mx-auto max-w-[1400px] px-6 pt-14 pb-8 lg:px-10 lg:pt-20 lg:pb-12">
          <div className="flex flex-col gap-5 max-w-3xl">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted backdrop-blur">
                <span className="size-1.5 rounded-full bg-honey" />
                Creator-Studio · Beta
              </span>
              <span className="text-[12px] text-ink-subtle">
                Heute aktiv: {brands.length} Workspace · {totalPacks} Packs · {totalRecipes} Rezepte
              </span>
            </div>

            <h1 className="font-display text-[52px] font-normal leading-[1.02] tracking-[-0.02em] text-ink sm:text-[64px] lg:text-[76px]">
              Bau dein nächstes
              <br />
              <span className="italic text-ink-muted">Recipe-Pack.</span>
            </h1>

            <p className="max-w-2xl text-[18px] leading-relaxed text-ink-muted">
              Wähle einen Workspace, lege ein neues Pack an, generiere deine
              Karten — fertig zum Posten oder Drucken. In deinem Look,
              mit deinen Nährwerten, in deiner Sprache.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-[1400px] px-6 pb-24 lg:px-10 lg:pb-32">
          <div className="mb-7 flex items-end justify-between border-b border-line pb-5">
            <div className="flex flex-col gap-1.5">
              <h2 className="font-display text-[26px] leading-none text-ink">
                Workspaces
              </h2>
              <p className="text-[14px] text-ink-muted">
                Jeder Creator hat ein eigenes Setup — eigene Farben, Schriften, Pack-Sammlung.
              </p>
            </div>
            <span className="hidden font-mono text-[12px] uppercase tracking-[0.12em] text-ink-subtle sm:block">
              {brands.length} Workspace{brands.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
            {brands.map((brand) => (
              <BrandCard key={brand.slug} brand={brand} />
            ))}
            <NewBrandCard />
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-canvas/60">
        <div className="mx-auto flex max-w-[1400px] flex-col items-start justify-between gap-3 px-6 py-8 text-sm text-ink-subtle sm:flex-row sm:items-center lg:px-10">
          <p>
            Gebaut von Julian Seidel · Wolf Family Office Test Week · Mai 2026
          </p>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em]">
            Recipe Card Builder · v0.1
          </p>
        </div>
      </footer>
    </div>
  );
}
