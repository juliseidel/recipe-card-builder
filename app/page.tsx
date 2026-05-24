import Link from "next/link";
import { ArrowUpRight, Sparkles, Layers, FileDown } from "lucide-react";

export const metadata = {
  title: "Recipe Card Builder · Bienenfee",
  description:
    "Wunderschöne Recipe-Cards in fünf typografischen Welten — Pflicht-Lieferung für @bienesfitlife, Wolf Family Office.",
};

const entries = [
  {
    href: "/builder",
    label: "Builder",
    title: "Rezept-Editor",
    body: "Eigenes Rezept eingeben, Theme wählen, KI-Bild generieren und live in der Karte sehen.",
    icon: Sparkles,
  },
  {
    href: "/packs",
    label: "Packs",
    title: "Bienes fünf Recipe-Packs",
    body: "Die fünf druckfertigen Packs der Pflicht-Lieferung — jedes mit Cover, Index, Nährwert-Übersicht und PDF-Download.",
    icon: FileDown,
  },
  {
    href: "/preview",
    label: "Preview",
    title: "Alle fünf Themes",
    body: "Vergleichsansicht: derselbe Datensatz, fünf eigenständige typografische Welten nebeneinander.",
    icon: Layers,
  },
] as const;

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[var(--color-paper)] paper-grain text-[var(--color-ink)]">
      <div className="mx-auto max-w-[1100px] px-12 pt-20 pb-24">
        <header className="flex items-baseline justify-between">
          <p
            className="uppercase"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.32em",
              color: "var(--color-ink-4)",
            }}
          >
            Recipe Card Builder · @bienesfitlife
          </p>
          <p
            className="uppercase"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.32em",
              color: "var(--color-ink-4)",
            }}
          >
            Wolf Family Office · Mai 2026
          </p>
        </header>

        <section className="mt-24 grid grid-cols-12 gap-x-10">
          <div className="col-span-12 lg:col-span-8">
            <h1
              className="text-balance"
              style={{
                fontFamily: "var(--font-fraunces)",
                fontSize: "clamp(56px, 7.2vw, 104px)",
                fontWeight: 500,
                lineHeight: 0.92,
                letterSpacing: "-0.024em",
              }}
            >
              <span className="block">Eine Markenwelt,</span>
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
              fontSize: 16,
              lineHeight: 1.65,
              color: "var(--color-ink-3)",
              fontFamily: "var(--font-inter)",
            }}
          >
            Fünf eigenständige Designwelten — jede mit eigenem typografischen
            System, eigener Farbsprache, eigener Layout-DNA. Alles für
            @bienesfitlife gebaut. Jedes Pack als druckfertiges PDF.
          </p>
        </section>

        <nav className="mt-24 grid grid-cols-1 gap-5 md:grid-cols-3">
          {entries.map(({ href, label, title, body, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex flex-col justify-between rounded-[2px] border bg-white/55 p-7 transition hover:bg-white"
              style={{ borderColor: "var(--color-builder-line)" }}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span
                    className="uppercase"
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 9.5,
                      letterSpacing: "0.32em",
                      color: "var(--color-wine-600)",
                    }}
                  >
                    {label}
                  </span>
                  <Icon
                    className="h-3.5 w-3.5"
                    style={{ color: "var(--color-ink-4)" }}
                  />
                </div>
                <h2
                  className="mt-4"
                  style={{
                    fontFamily: "var(--font-fraunces)",
                    fontSize: 28,
                    fontWeight: 500,
                    lineHeight: 1.05,
                    letterSpacing: "-0.018em",
                  }}
                >
                  {title}
                </h2>
                <p
                  className="mt-3 text-pretty"
                  style={{
                    fontSize: 14,
                    lineHeight: 1.55,
                    color: "var(--color-ink-3)",
                  }}
                >
                  {body}
                </p>
              </div>
              <span
                className="mt-7 inline-flex items-center gap-1.5 uppercase"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: "0.24em",
                  color: "var(--color-ink)",
                }}
              >
                Öffnen
                <ArrowUpRight className="h-3 w-3 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
            </Link>
          ))}
        </nav>

        <footer
          className="mt-28 border-t pt-7"
          style={{ borderColor: "var(--color-builder-line)" }}
        >
          <p
            className="uppercase"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              letterSpacing: "0.32em",
              color: "var(--color-ink-4)",
            }}
          >
            Editorial Cookbook · Swiss Editorial · Patisserie Romantic · Rustic
            Spread · Modern Planner
          </p>
        </footer>
      </div>
    </main>
  );
}
