import Link from "next/link";
import { packs } from "@/data/packs";
import { getTheme } from "@/lib/themes";
import { ArrowUpRight, FileDown, ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Bienes Recipe-Packs · Editorial Cookbook",
};

export default function PacksPage() {
  return (
    <main className="min-h-screen bg-[var(--color-paper)] paper-grain">
      <div className="mx-auto max-w-[1280px] px-12 pt-10 pb-20">
        <header className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.32em]"
            style={{ color: "var(--color-ink-3)" }}
          >
            <ArrowLeft className="h-3 w-3" />
            zurück
          </Link>
          <p
            className="uppercase"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.32em",
              color: "var(--color-ink-4)",
            }}
          >
            Pflicht-Lieferung · @bienesfitlife
          </p>
        </header>

        {/* MASTHEAD */}
        <section className="mt-20 grid grid-cols-12 gap-x-10">
          <div className="col-span-12 lg:col-span-8">
            <h1
              className="text-balance"
              style={{
                fontFamily: "var(--font-fraunces)",
                fontSize: "clamp(56px, 7vw, 96px)",
                fontWeight: 500,
                lineHeight: 0.92,
                letterSpacing: "-0.024em",
              }}
            >
              <span className="block">Bienes</span>
              <span
                className="block italic"
                style={{ color: "var(--color-wine-600)" }}
              >
                fünf Recipe-Packs.
              </span>
            </h1>
          </div>
          <p
            className="col-span-12 mt-8 max-w-md text-pretty lg:col-span-4 lg:mt-12"
            style={{
              fontSize: 15.5,
              lineHeight: 1.65,
              color: "var(--color-ink-3)",
            }}
          >
            Fünf eigenständige Designwelten — jede mit eigenem typografischen
            System, eigener Farbsprache und eigener Layout-DNA. Eine Markenwelt,
            fünf Verlage. Jedes Pack als druckfertiges PDF mit Cover,
            Inhaltsverzeichnis und Nährwert-Tabelle.
          </p>
        </section>

        {/* PACKS — staggered editorial layout */}
        <section className="mt-28">
          <ul className="space-y-24">
            {packs.map((pack, idx) => {
              const theme = getTheme(pack.themeId);
              const flip = idx % 2 === 1;
              return (
                <li
                  key={pack.id}
                  className="grid grid-cols-12 gap-x-10 gap-y-6 items-center"
                >
                  <div
                    className={`col-span-12 lg:col-span-7 ${flip ? "lg:order-2" : ""}`}
                  >
                    <div
                      className="relative aspect-[4/3] overflow-hidden rounded-[2px]"
                      style={{
                        background: `linear-gradient(165deg, ${theme.palette.paper} 0%, ${theme.palette.paperDeep} 55%, ${theme.palette.accent} 130%)`,
                        boxShadow:
                          "0 1px 0 rgba(26,18,11,0.04), 0 28px 64px rgba(26,18,11,0.10), 0 60px 120px rgba(26,18,11,0.06)",
                      }}
                    >
                      <div
                        className="absolute inset-x-0 top-0 h-1.5"
                        style={{ background: theme.palette.accent }}
                      />
                      <div className="absolute inset-x-10 bottom-10 right-10 flex flex-col">
                        <p
                          className="uppercase"
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 9,
                            letterSpacing: "0.4em",
                            color: theme.palette.inkSoft,
                          }}
                        >
                          Pack {String(idx + 1).padStart(2, "0")} ·{" "}
                          {pack.recipes.length} Rezepte
                        </p>
                        <h2
                          className="mt-3 max-w-md"
                          style={{
                            fontFamily: theme.fonts.display,
                            fontSize: 56,
                            fontWeight:
                              theme.fonts.display.includes("inter") ? 700 : 500,
                            lineHeight: 0.94,
                            letterSpacing: "-0.022em",
                            color: theme.palette.ink,
                          }}
                        >
                          {pack.title}
                        </h2>
                        <p
                          className="mt-3 italic max-w-md"
                          style={{
                            fontFamily: theme.fonts.display.includes("inter")
                              ? "var(--font-fraunces)"
                              : theme.fonts.display,
                            fontSize: 18,
                            color: theme.palette.accentDeep,
                          }}
                        >
                          {pack.tagline}
                        </p>
                      </div>
                      {/* publishing-house tag top-right */}
                      <div
                        className="absolute right-8 top-8 px-3 py-1.5 uppercase"
                        style={{
                          background: theme.palette.ink,
                          color: theme.palette.paper,
                          fontFamily: "var(--font-mono)",
                          fontSize: 9,
                          letterSpacing: "0.28em",
                          borderRadius: 1,
                        }}
                      >
                        {theme.publishingHouse.split("·")[0]?.trim()}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`col-span-12 lg:col-span-5 ${flip ? "lg:order-1" : ""}`}
                  >
                    <p
                      className="uppercase"
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 10,
                        letterSpacing: "0.32em",
                        color: "var(--color-wine-600)",
                      }}
                    >
                      № {String(idx + 1).padStart(2, "0")} ·{" "}
                      {theme.publishingHouse.split("·")[1]?.trim() ?? ""}
                    </p>
                    <h3
                      className="mt-3"
                      style={{
                        fontFamily: "var(--font-fraunces)",
                        fontSize: 38,
                        fontWeight: 500,
                        lineHeight: 1,
                        letterSpacing: "-0.022em",
                      }}
                    >
                      {pack.title}
                    </h3>

                    <p
                      className="mt-5 text-pretty"
                      style={{
                        fontSize: 14.5,
                        lineHeight: 1.65,
                        color: "var(--color-ink-3)",
                      }}
                    >
                      {pack.description}
                    </p>

                    <ul className="mt-6 space-y-1.5">
                      {pack.recipes.slice(0, 5).map((r) => (
                        <li
                          key={r.id}
                          className="flex items-baseline justify-between gap-3 border-b py-2"
                          style={{
                            borderColor: "var(--color-builder-line-soft)",
                            fontSize: 13,
                            color: "var(--color-ink-2)",
                          }}
                        >
                          <span>{r.title}</span>
                          <span
                            className="font-feature-num"
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: 10.5,
                              letterSpacing: "0.12em",
                              color: "var(--color-ink-4)",
                              textTransform: "uppercase",
                            }}
                          >
                            {r.nutrition.kcal} kcal · {r.nutrition.protein}g P
                          </span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-7 flex flex-wrap items-center gap-3">
                      <a
                        href={`/api/pack/${pack.slug}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="group inline-flex h-11 items-center gap-2 rounded-full bg-[var(--color-ink)] px-5 text-[12px] font-medium uppercase tracking-[0.2em] text-[var(--color-paper)] transition hover:bg-[var(--color-wine-600)]"
                      >
                        <FileDown className="h-3.5 w-3.5" />
                        PDF öffnen
                      </a>
                      <Link
                        href={`/preview?theme=${theme.id}`}
                        className="inline-flex h-11 items-center gap-2 rounded-full border bg-white/40 px-5 text-[12px] font-medium uppercase tracking-[0.2em] transition hover:bg-white"
                        style={{
                          borderColor: "var(--color-builder-line)",
                          color: "var(--color-ink)",
                        }}
                      >
                        Vorschau
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* FOOTER */}
        <footer className="mt-32 border-t pt-7"
          style={{ borderColor: "var(--color-builder-line)" }}
        >
          <div className="flex items-center justify-between">
            <p
              className="uppercase"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                letterSpacing: "0.32em",
                color: "var(--color-ink-4)",
              }}
            >
              @bienesfitlife · Wolf Family Office · Mai 2026
            </p>
            <p
              style={{
                fontFamily: "var(--font-script)",
                fontSize: 22,
                color: "var(--color-wine-600)",
              }}
            >
              Deine Biene 🐝
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}
