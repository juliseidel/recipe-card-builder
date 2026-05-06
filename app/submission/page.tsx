import Image from "next/image";
import Link from "next/link";
import { brands } from "@/lib/brands";
import { packs } from "@/lib/packs";
import { recipes } from "@/lib/recipes";
import { SiteHeader } from "@/components/site-header";

export const metadata = {
  title: "Submission · Wolf Family Office Test Week",
  description:
    "Die fünf Recipe-Packs für Biene als druckfertige CMYK-PDFs (300 DPI, ICC-Profil eingebettet).",
};

// The five PDFs live in /public/submission/ — same filenames as render-print
// emits. Keep this map in sync with scripts/render-print-pdfs.ts.
function pdfHref(packNumber: number, packTitle: string, recipeCount: number, brandName: string) {
  return `/submission/${String(packNumber).padStart(2, "0")} – ${packTitle} – ${recipeCount} Rezepte von ${brandName}.pdf`;
}

export default function SubmissionPage() {
  const brand = brands[0]; // Biene
  const totalRecipes = recipes.length;
  const totalPages = packs.reduce(
    (sum, p) => sum + (recipes.filter((r) => r.packSlug === p.slug).length + 4),
    0
  );

  return (
    <div className="bg-paper flex min-h-screen flex-col">
      <SiteHeader />

      <main className="flex-1">
        <section className="mx-auto max-w-[1200px] px-6 pt-14 pb-10 lg:px-10 lg:pt-20 lg:pb-12">
          <div className="flex flex-col gap-5 max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted backdrop-blur">
                <span className="size-1.5 rounded-full bg-honey" />
                Test Week · Aufgabe 2 · Recipe Card Builder
              </span>
              <span className="text-[12px] text-ink-subtle">
                Abgabe 11. Mai 2026 · Live-Call 12. Mai
              </span>
            </div>

            <h1 className="font-display text-[44px] font-normal leading-[1.04] tracking-[-0.02em] text-ink sm:text-[56px] lg:text-[64px]">
              Fünf Recipe-Packs für Biene.
              <br />
              <span className="italic text-ink-muted">Druckfertig.</span>
            </h1>

            <p className="max-w-2xl text-[17px] leading-relaxed text-ink-muted">
              Jedes Pack als A4-PDF. CMYK-Farbraum, 300 DPI Bilder, ICC-Profil
              eingebettet, Schriftarten als Subset enthalten — bereit für
              Offset oder hochwertigen Inkjet-Druck.
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-[14px] text-ink-muted">
              <span className="inline-flex items-center gap-2">
                <span className="font-display text-[24px] leading-none text-ink">
                  {packs.length}
                </span>
                Packs
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="font-display text-[24px] leading-none text-ink">
                  {totalRecipes}
                </span>
                Rezepte
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="font-display text-[24px] leading-none text-ink">
                  {totalPages}
                </span>
                Seiten
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="font-display text-[24px] leading-none text-ink">
                  5
                </span>
                Layouts
              </span>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1200px] px-6 pb-20 lg:px-10 lg:pb-28">
          <div className="mb-7 flex items-end justify-between border-b border-line pb-5">
            <div className="flex flex-col gap-1.5">
              <h2 className="font-display text-[26px] leading-none text-ink">
                Die fünf Packs
              </h2>
              <p className="text-[14px] text-ink-muted">
                Klick auf eines, um das CMYK-PDF herunterzuladen.
              </p>
            </div>
            <Link
              href={`/${brand.slug}`}
              className="hidden items-center gap-1.5 text-[13px] font-medium text-ink transition-opacity hover:opacity-80 sm:inline-flex"
            >
              Live-Tool ansehen
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M3 7h8m0 0L7.5 3.5M11 7l-3.5 3.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </div>

          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {packs.map((pack) => {
              const recipeCount = recipes.filter(
                (r) => r.packSlug === pack.slug
              ).length;
              const pageCount = recipeCount + 4;
              const href = pdfHref(
                pack.number,
                pack.title,
                recipeCount,
                brand.name
              );
              return (
                <li key={pack.slug}>
                  <a
                    href={href}
                    download
                    className="group relative flex flex-col overflow-hidden rounded-[var(--radius-card)] transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[var(--shadow-card-hover)]"
                    style={{
                      background: pack.mood.background,
                      color: pack.mood.ink,
                      boxShadow: "var(--shadow-card)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-3 px-6 pt-5">
                      <span
                        className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em]"
                        style={{ color: pack.mood.inkSoft }}
                      >
                        Pack {String(pack.number).padStart(2, "0")}
                      </span>
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em]"
                        style={{ color: pack.mood.ink }}
                      >
                        {pageCount} Seiten · CMYK
                      </span>
                    </div>

                    <div className="relative mx-6 mt-4 aspect-[4/3.4] overflow-hidden rounded-2xl">
                      <Image
                        src={pack.coverImage}
                        alt={`${pack.title} – Cover`}
                        fill
                        sizes="(min-width: 1024px) 360px, 50vw"
                        className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
                      />
                    </div>

                    <div className="flex flex-1 flex-col gap-3 px-6 pt-6 pb-6">
                      <span
                        className="text-[12px] font-semibold uppercase tracking-[0.16em]"
                        style={{ color: pack.mood.inkSoft }}
                      >
                        {pack.category}
                      </span>
                      <h3 className="font-display text-[28px] leading-[0.98] tracking-[-0.01em]">
                        {pack.title}
                        <span
                          className="block text-[15px] font-normal italic opacity-80"
                          style={{ fontFamily: "var(--font-display)" }}
                        >
                          {pack.subtitle}
                        </span>
                      </h3>
                      <p
                        className="text-[13px] leading-[1.5]"
                        style={{ color: pack.mood.inkSoft }}
                      >
                        {pack.tagline}
                      </p>

                      <div
                        className="mt-2 flex items-center justify-between border-t pt-4"
                        style={{ borderColor: pack.mood.ink + "22" }}
                      >
                        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold transition-transform duration-300 group-hover:translate-x-0.5">
                          PDF herunterladen
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 14 14"
                            fill="none"
                            aria-hidden
                          >
                            <path
                              d="M7 1.5v8m0 0L4 6.5m3 3l3-3M2 11h10"
                              stroke="currentColor"
                              strokeWidth="1.6"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>
                        <span
                          className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em]"
                          style={{ color: pack.mood.inkSoft }}
                        >
                          {recipeCount} Rezepte
                        </span>
                      </div>
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="mx-auto max-w-[1200px] px-6 pb-24 lg:px-10 lg:pb-32">
          <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6 sm:p-8 lg:p-10">
            <h2 className="font-display text-[22px] leading-tight text-ink">
              Was diese Dateien zu &quot;druckfertig&quot; macht
            </h2>
            <ul className="mt-5 grid gap-4 sm:grid-cols-2 sm:gap-x-10 sm:gap-y-5">
              <PrintFact
                label="Farbraum"
                value="DeviceCMYK"
                detail="Vektoren und Bilder konvertiert via Ghostscript 10.07 mit eingebettetem ICC-Profil."
              />
              <PrintFact
                label="Bildauflösung"
                value="300 DPI"
                detail="Pack-Cover liegen in 1800 × 2400 px vor — entspricht 300 DPI bei A4-Größe und mehr."
              />
              <PrintFact
                label="Schriftarten"
                value="Subset embedded"
                detail="Fraunces (Display) + Inter (Body), jeweils nur die genutzten Glyphen — schlanke Files, exakter Print."
              />
              <PrintFact
                label="Format"
                value="A4 · 595 × 842 pt"
                detail="Standard-A4. Pro Pack: Cover · Index · Karten · Nährwert-Übersicht · Outro."
              />
              <PrintFact
                label="Pipeline"
                value="React-PDF → Ghostscript"
                detail="Live-Tool rendert RGB für Speed. Submission-Builds laufen lokal über die CMYK-Convert-Stage."
              />
              <PrintFact
                label="Tooling"
                value="Reproduzierbar"
                detail="`npx tsx scripts/render-print-pdfs.ts` rendert + verifiziert alle fünf Packs neu — siehe README."
              />
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-canvas/60">
        <div className="mx-auto flex max-w-[1200px] flex-col items-start justify-between gap-3 px-6 py-8 text-sm text-ink-subtle sm:flex-row sm:items-center lg:px-10">
          <p>
            Gebaut von Julian Seidel · Wolf Family Office Test Week · Mai 2026
          </p>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em]">
            Submission v1 · CMYK 300 DPI
          </p>
        </div>
      </footer>
    </div>
  );
}

function PrintFact({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <li className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
        {label}
      </span>
      <span className="font-display text-[20px] leading-tight text-ink">
        {value}
      </span>
      <span className="text-[13px] leading-relaxed text-ink-muted">
        {detail}
      </span>
    </li>
  );
}
