import Link from "next/link";
import { RecipeCard } from "@/components/cards/RecipeCard";
import { themeList } from "@/lib/themes";
import { sampleRecipes } from "@/data/sample-recipes";

export const metadata = {
  title: "Preview · Recipe Card Builder",
};

export default function PreviewPage() {
  return (
    <main className="min-h-screen bg-[var(--color-builder-bg)] py-16">
      <div className="mx-auto max-w-[1280px] px-8">
        <header className="mb-12 flex items-end justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.4em] text-[var(--color-builder-muted)]">
              Live preview
            </p>
            <h1 className="mt-2 font-display text-[44px] font-medium leading-tight tracking-tight">
              Alle 5 Themes — Bienes Recipe-Packs
            </h1>
            <p className="mt-3 max-w-2xl text-base text-[var(--color-builder-muted)]">
              Jedes der fünf Themes mit demselben Datensatz — so wird Edge-Case
              „kreative Bandbreite" sichtbar.
            </p>
          </div>
          <Link
            href="/"
            className="text-sm uppercase tracking-[0.2em] underline-offset-4 hover:underline"
          >
            ← Zurück
          </Link>
        </header>

        <div className="space-y-20">
          {themeList.map((theme, themeIdx) => {
            const recipe = sampleRecipes[themeIdx % sampleRecipes.length]!;
            return (
              <section key={theme.id}>
                <header className="mb-6 flex items-end justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.4em] text-[var(--color-builder-muted)]">
                      Theme {String(themeIdx + 1).padStart(2, "0")}
                    </p>
                    <h2 className="mt-1 font-display text-3xl font-medium tracking-tight">
                      {theme.name}
                    </h2>
                    <p className="text-sm text-[var(--color-builder-muted)]">
                      {theme.tagline} · Layout: {theme.layout}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {Object.entries(theme.palette)
                      .filter(([k]) =>
                        ["accent", "accentSoft", "ink", "highlight"].includes(
                          k,
                        ),
                      )
                      .map(([k, v]) => (
                        <div key={k} className="flex flex-col items-center">
                          <div
                            className="h-7 w-7 rounded-full border border-black/10"
                            style={{ background: v }}
                          />
                          <span className="mt-1 text-[9px] uppercase tracking-widest opacity-60">
                            {k.replace(/[A-Z]/g, (m) => ` ${m.toLowerCase()}`)}
                          </span>
                        </div>
                      ))}
                  </div>
                </header>

                <div className="origin-top-left scale-[0.62] sm:scale-[0.72] lg:scale-[0.85] xl:scale-100 transition">
                  <div className="print-shadow inline-block">
                    <RecipeCard recipe={recipe} themeId={theme.id} />
                  </div>
                </div>
              </section>
            );
          })}
        </div>

        <footer className="mt-24 border-t border-[var(--color-builder-line)] pt-8 text-center text-xs uppercase tracking-[0.32em] text-[var(--color-builder-muted)]">
          Wolf Family Office · Test Week · Aufgabe 2
        </footer>
      </div>
    </main>
  );
}
