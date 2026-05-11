import Link from "next/link";
import type { Brand } from "@/lib/brands";
import type { Pack } from "@/lib/packs";
import type { Recipe } from "@/lib/recipes";
import { SiteHeader } from "./site-header";
import { RecipeCardFull, type EnrichingState } from "./recipe-card-full";
import { PdfExportButton } from "./pdf-export-button";
import { HeroRerollButton } from "./hero-reroll-button";

type NavTarget = {
  href: string;
  title: string;
} | null;

type Props = {
  brand: Brand;
  pack: Pack;
  recipe: Recipe;
  totalRecipes: number;
  previous: NavTarget;
  next: NavTarget;
  isCustom?: boolean;
  deleteAction?: React.ReactNode;
  // Set while a custom recipe waits for Gemini micros + Flux hero. The card
  // swaps the matching slots for skeletons so the gap is visible.
  enriching?: EnrichingState;
  // DB-Row-ID des Rezepts. Wenn vorhanden, zeigt der Toolbar den
  // "Bild neu generieren"-Button. Statische Rezepte aus lib/recipes.ts
  // haben kein id-Feld auf dem Recipe-Type — die ID kommt aus der DB-Row
  // und wird vom Caller separat reingereicht.
  recipeId?: string;
};

export function RecipeDetailLayout({
  brand,
  pack,
  recipe,
  totalRecipes,
  previous,
  next,
  isCustom = false,
  deleteAction,
  enriching,
  recipeId,
}: Props) {
  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ background: pack.mood.background }}
    >
      <SiteHeader />

      <section
        className="border-b"
        style={{
          borderColor: pack.mood.ink + "15",
          background: pack.mood.background,
        }}
      >
        <div className="mx-auto flex max-w-[1200px] flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-10">
          <nav
            className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]"
            style={{ color: pack.mood.inkSoft }}
          >
            <Link
              href={`/${brand.slug}`}
              className="transition-opacity hover:opacity-100"
              style={{ opacity: 0.75 }}
            >
              {brand.name}
            </Link>
            <Crumb pack={pack} />
            <Link
              href={`/${brand.slug}/${pack.slug}`}
              className="transition-opacity hover:opacity-100"
              style={{ opacity: 0.75 }}
            >
              {pack.title}
            </Link>
            <Crumb pack={pack} />
            <span style={{ color: pack.mood.ink, fontWeight: 500 }}>
              {recipe.title}
            </span>
          </nav>

          <div className="flex flex-wrap items-center gap-2">
            {deleteAction}
            {recipeId ? (
              <HeroRerollButton
                recipeId={recipeId}
                tint={{
                  bg: pack.mood.background,
                  ink: pack.mood.ink,
                  accent: pack.mood.accent,
                }}
              />
            ) : null}
            <PdfExportButton
              type="recipe"
              brandSlug={brand.slug}
              packSlug={pack.slug}
              recipeSlug={recipe.slug}
              variant="subtle"
              label="Karte als PDF"
              tint={{
                bg: pack.mood.background,
                ink: pack.mood.ink,
                accent: pack.mood.accent,
              }}
            />
          </div>
        </div>
      </section>

      <main className="flex-1">
        <div
          className="content-fade-in mx-auto max-w-[1200px] px-6 py-12 lg:px-10 lg:py-16"
          style={{ animationDuration: "0.55s" }}
        >
          <RecipeCardFull
            brand={brand}
            pack={pack}
            recipe={recipe}
            totalRecipes={totalRecipes}
            enriching={enriching}
          />

          <nav
            className="content-fade-in mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2"
            style={{ animationDelay: "180ms", animationDuration: "0.5s" }}
          >
            {previous ? (
              <NavLink
                direction="prev"
                href={previous.href}
                label="Vorherige Karte"
                title={previous.title}
                pack={pack}
              />
            ) : (
              <span />
            )}
            {next ? (
              <NavLink
                direction="next"
                href={next.href}
                label="Nächste Karte"
                title={next.title}
                pack={pack}
              />
            ) : (
              <Link
                href={`/${brand.slug}/${pack.slug}`}
                className="group flex items-center justify-end gap-3 rounded-2xl border px-5 py-4 text-right transition-colors sm:col-start-2"
                style={{
                  borderColor: pack.mood.ink + "20",
                  background: "rgba(255,255,255,0.5)",
                }}
              >
                <div className="flex flex-col">
                  <span
                    className="text-[11px] font-semibold uppercase tracking-[0.16em]"
                    style={{ color: pack.mood.inkSoft }}
                  >
                    Zurück zum Pack
                  </span>
                  <span
                    className="text-[14px] font-medium"
                    style={{ color: pack.mood.ink }}
                  >
                    Alle Karten ansehen
                  </span>
                </div>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  className="transition-transform group-hover:translate-x-0.5"
                >
                  <path
                    d="M3 7h8m0 0L7.5 3.5M11 7l-3.5 3.5"
                    stroke={pack.mood.ink}
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
            )}
          </nav>
        </div>
      </main>

      <footer
        className="border-t"
        style={{
          borderColor: pack.mood.ink + "15",
          background: brand.tokens.surface,
        }}
      >
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-6 text-[12px] lg:px-10">
          <span style={{ color: brand.tokens.inkMuted }}>
            <span style={{ color: brand.tokens.ink, fontWeight: 500 }}>
              {brand.signature}
            </span>{" "}
            · Diese Karte ist Teil von &quot;{pack.title}&quot;
          </span>
          <span style={{ color: brand.tokens.inkMuted }}>{brand.handle}</span>
        </div>
      </footer>
    </div>
  );
}

function Crumb({ pack }: { pack: Pack }) {
  return (
    <span style={{ color: pack.mood.inkSoft, opacity: 0.5 }} aria-hidden>
      ›
    </span>
  );
}

function NavLink({
  direction,
  href,
  label,
  title,
  pack,
}: {
  direction: "prev" | "next";
  href: string;
  label: string;
  title: string;
  pack: Pack;
}) {
  const isPrev = direction === "prev";
  return (
    <Link
      href={href}
      className={`group flex items-center gap-3 rounded-2xl border px-5 py-4 transition-colors ${
        isPrev ? "" : "justify-end text-right sm:col-start-2"
      }`}
      style={{
        borderColor: pack.mood.ink + "20",
        background: "rgba(255,255,255,0.5)",
      }}
    >
      {isPrev ? (
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          className="transition-transform group-hover:-translate-x-0.5"
        >
          <path
            d="M11 7H3m0 0L6.5 3.5M3 7l3.5 3.5"
            stroke={pack.mood.ink}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}

      <div className={`flex flex-col ${isPrev ? "" : "items-end"}`}>
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.16em]"
          style={{ color: pack.mood.inkSoft }}
        >
          {label}
        </span>
        <span
          className="text-[14px] font-medium"
          style={{ color: pack.mood.ink }}
        >
          {title}
        </span>
      </div>

      {!isPrev ? (
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          className="transition-transform group-hover:translate-x-0.5"
        >
          <path
            d="M3 7h8m0 0L7.5 3.5M11 7l-3.5 3.5"
            stroke={pack.mood.ink}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </Link>
  );
}
