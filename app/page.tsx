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
        {/* HERO ────────────────────────────────────────────────────────── */}
        <section className="relative mx-auto max-w-[1400px] px-6 pt-20 pb-16 lg:px-10 lg:pt-28 lg:pb-24">
          {/* Subtle inline ornament — pulls the page toward editorial cookbook
              vibe and away from saas dashboard. Pure CSS, no asset weight. */}
          <span
            aria-hidden
            className="pointer-events-none absolute right-10 top-24 hidden h-px w-24 bg-line-strong/60 lg:block"
          />

          <div className="flex max-w-3xl flex-col gap-8">
            <div className="inline-flex items-center gap-2.5 self-start rounded-full border border-line bg-surface/90 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted shadow-soft backdrop-blur">
              <span className="size-1.5 rounded-full bg-honey" />
              Studio für Rezept-Creator
            </div>

            <h1 className="font-display text-[56px] font-normal leading-[0.96] tracking-[-0.02em] text-ink sm:text-[76px] lg:text-[92px]">
              Schöne Rezeptkarten,
              <br />
              <span className="italic text-ink-muted">die nach dir aussehen.</span>
            </h1>

            <p className="max-w-[58ch] text-[18px] leading-[1.6] text-ink-muted">
              Lade deine Rezepte rein, wähle ein Layout — du bekommst ein
              komplettes Pack zurück. Cover, Karten, Nährwerte, druckfertig.
              In deiner Sprache, mit deinen Werten, in deinem Look.
            </p>

            {/* Stats: less prominent than before — these are a quiet "what's
                inside" line, not the hero's main job. */}
            <dl className="mt-2 flex flex-wrap items-baseline gap-x-10 gap-y-3 text-ink-muted">
              <Stat value={brands.length} label={brands.length === 1 ? "Workspace" : "Workspaces"} />
              <Divider />
              <Stat value={totalPacks} label="Packs" />
              <Divider />
              <Stat value={totalRecipes} label="Rezepte" />
              <Divider />
              <Stat value={5} label="Layout-Stile" />
            </dl>
          </div>
        </section>

        {/* WORKSPACES ─────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-[1400px] px-6 pb-24 lg:px-10 lg:pb-32">
          <div className="mb-8 flex flex-col gap-3 border-t border-line pt-8 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-subtle">
                Deine Creator
              </span>
              <h2 className="font-display text-[32px] leading-none tracking-[-0.01em] text-ink">
                Wähle einen Workspace.
              </h2>
              <p className="mt-0.5 text-[14px] text-ink-muted">
                Jeder Creator bekommt eigene Farben, Schriften und Pack-Sammlung —
                damit jedes Pack nach der Person aussieht, nicht nach generischer Vorlage.
              </p>
            </div>
          </div>

          <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
            {brands.map((brand) => (
              <BrandCard key={brand.slug} brand={brand} />
            ))}
            <NewBrandCard />
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-surface/40">
        <div className="mx-auto flex max-w-[1400px] flex-col items-start justify-between gap-3 px-6 py-8 text-[13px] text-ink-muted sm:flex-row sm:items-center lg:px-10">
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
    <div className="flex items-baseline gap-2">
      <dt className="font-display text-[28px] leading-none text-ink">
        {value}
      </dt>
      <dd className="text-[12px] font-medium uppercase tracking-[0.14em] text-ink-subtle">
        {label}
      </dd>
    </div>
  );
}

function Divider() {
  return (
    <span aria-hidden className="hidden h-4 w-px bg-line-strong/60 sm:inline-block" />
  );
}
