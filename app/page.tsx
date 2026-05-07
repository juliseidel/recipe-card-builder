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
        {/* Tool-style page header — clear, calm, no marketing hero. The job
            here is "pick a workspace and start building", not "convince you
            to use the product". One eyebrow, a small headline, a one-liner. */}
        <section className="mx-auto max-w-[1280px] px-6 pt-10 pb-7 lg:px-10 lg:pt-12">
          <div className="flex flex-col gap-2.5">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-subtle">
              Studio · für Rezept-Creator
            </span>
            <h1 className="font-display text-[34px] leading-[1.05] tracking-[-0.01em] text-ink sm:text-[40px]">
              Workspaces
            </h1>
            <p className="max-w-[60ch] text-[14.5px] leading-[1.55] text-ink-muted">
              Wähle einen Creator-Workspace, um seine Pack-Sammlung zu öffnen.
              Jeder Workspace bringt eigene Farben, Schriften und ein
              Pack-Set mit — fertig zum Posten oder Drucken.
            </p>
          </div>
        </section>

        {/* Card grid — 1/2/3 cols. Cards themselves are deliberately mid-sized
            (aspect-[5/4] image, compact body) so 3 of them fit in a row at
            lg without dominating the viewport. */}
        <section className="mx-auto max-w-[1280px] px-6 pb-16 lg:px-10 lg:pb-20">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {brands.map((brand) => (
              <BrandCard key={brand.slug} brand={brand} />
            ))}
            <NewBrandCard />
          </div>

          {/* Quiet stats line at the bottom — gives Ingo a sense of the
              tool's content without front-loading the page with marketing
              numbers. */}
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-5 text-[12px] text-ink-subtle">
            <span className="font-mono uppercase tracking-[0.16em]">
              In Studio
            </span>
            <span>
              <span className="font-display text-[15px] text-ink">
                {brands.length}
              </span>{" "}
              {brands.length === 1 ? "Workspace" : "Workspaces"}
            </span>
            <span aria-hidden className="text-line-strong">·</span>
            <span>
              <span className="font-display text-[15px] text-ink">
                {totalPacks}
              </span>{" "}
              Packs
            </span>
            <span aria-hidden className="text-line-strong">·</span>
            <span>
              <span className="font-display text-[15px] text-ink">
                {totalRecipes}
              </span>{" "}
              Rezepte
            </span>
            <span aria-hidden className="text-line-strong">·</span>
            <span>
              <span className="font-display text-[15px] text-ink">5</span>{" "}
              Layout-Stile
            </span>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-surface/40">
        <div className="mx-auto flex max-w-[1280px] flex-col items-start justify-between gap-3 px-6 py-7 text-[13px] text-ink-muted sm:flex-row sm:items-center lg:px-10">
          <p>
            Recipe Card Builder —{" "}
            <span className="text-ink">druckfertige Karten in Minuten.</span>
          </p>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-subtle">
            v0.1 · Studio
          </p>
        </div>
      </footer>
    </div>
  );
}
