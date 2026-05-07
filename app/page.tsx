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
        {/* HERO + WORKSPACES on one screen ─────────────────────────────────
            On large screens the whole thing fits above the fold:
            left = headline + stats, right = the brand card itself. No more
            scrolling past a 92-pt headline before the user sees the actual
            tool. */}
        <section className="mx-auto max-w-[1400px] px-6 pt-10 pb-16 lg:px-10 lg:pt-14 lg:pb-20">
          <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
            {/* LEFT — copy column */}
            <div className="flex flex-col gap-6 lg:pt-4">
              <div className="inline-flex items-center gap-2.5 self-start rounded-full border border-line bg-surface/90 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted shadow-soft backdrop-blur">
                <span className="size-1.5 rounded-full bg-honey" />
                Studio für Rezept-Creator
              </div>

              <h1 className="font-display text-[40px] font-normal leading-[0.98] tracking-[-0.02em] text-ink sm:text-[52px] lg:text-[60px]">
                Schöne Rezeptkarten,
                <br />
                <span className="italic text-ink-muted">die nach dir aussehen.</span>
              </h1>

              <p className="max-w-[48ch] text-[15.5px] leading-[1.6] text-ink-muted">
                Lade deine Rezepte rein, wähle ein Layout — du bekommst ein
                komplettes Pack zurück. Cover, Karten, Nährwerte, druckfertig.
                In deiner Sprache, mit deinen Werten, in deinem Look.
              </p>

              <dl className="mt-1 flex flex-wrap items-baseline gap-x-7 gap-y-2.5 text-ink-muted">
                <Stat value={brands.length} label={brands.length === 1 ? "Workspace" : "Workspaces"} />
                <Divider />
                <Stat value={totalPacks} label="Packs" />
                <Divider />
                <Stat value={totalRecipes} label="Rezepte" />
                <Divider />
                <Stat value={5} label="Layouts" />
              </dl>
            </div>

            {/* RIGHT — workspaces column. Single brand → simple stack of
                BrandCard + NewBrandCard. If brands.length grows past two we
                fall back to a 2-col grid so we don't ship infinite-tall
                stacks on Desktop. */}
            <div
              className={
                brands.length <= 1
                  ? "flex flex-col gap-5 sm:grid sm:grid-cols-2 sm:gap-5 lg:flex lg:flex-col"
                  : "grid grid-cols-1 gap-5 sm:grid-cols-2"
              }
            >
              {brands.map((brand) => (
                <BrandCard key={brand.slug} brand={brand} />
              ))}
              <NewBrandCard />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-surface/40">
        <div className="mx-auto flex max-w-[1400px] flex-col items-start justify-between gap-3 px-6 py-7 text-[13px] text-ink-muted sm:flex-row sm:items-center lg:px-10">
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

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="font-display text-[24px] leading-none text-ink">
        {value}
      </dt>
      <dd className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-subtle">
        {label}
      </dd>
    </div>
  );
}

function Divider() {
  return (
    <span aria-hidden className="hidden h-3.5 w-px bg-line-strong/60 sm:inline-block" />
  );
}
