import Link from "next/link";
import { notFound } from "next/navigation";
import { getBrand } from "@/lib/brands";
import { getPack } from "@/lib/packs";
import { getRecipe, getRecipesForPack } from "@/lib/recipes";
import { SiteHeader } from "@/components/site-header";
import { RecipeCardFull } from "@/components/recipe-card-full";

type RecipePageProps = {
  params: Promise<{ brand: string; pack: string; recipe: string }>;
};

export async function generateMetadata({ params }: RecipePageProps) {
  const { brand: brandSlug, pack: packSlug, recipe: recipeSlug } = await params;
  const brand = getBrand(brandSlug);
  const pack = getPack(brandSlug, packSlug);
  const recipe = getRecipe(packSlug, recipeSlug);

  if (!brand || !pack || !recipe) {
    return { title: "Karte nicht gefunden · Recipe Card Builder" };
  }

  return {
    title: `${recipe.title} · ${pack.title} · ${brand.name}`,
    description: `${recipe.description} ${recipe.nutrition.kcal} kcal · ${recipe.nutrition.protein}g Eiweiß.`,
  };
}

export default async function RecipePage({ params }: RecipePageProps) {
  const { brand: brandSlug, pack: packSlug, recipe: recipeSlug } = await params;
  const brand = getBrand(brandSlug);
  const pack = getPack(brandSlug, packSlug);
  const recipe = getRecipe(packSlug, recipeSlug);

  if (!brand || !pack || !recipe) {
    notFound();
  }

  const recipes = getRecipesForPack(pack.slug);
  const currentIndex = recipes.findIndex((r) => r.slug === recipe.slug);
  const previousRecipe = currentIndex > 0 ? recipes[currentIndex - 1] : null;
  const nextRecipe =
    currentIndex < recipes.length - 1 ? recipes[currentIndex + 1] : null;

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ background: pack.mood.background }}
    >
      <SiteHeader />

      {/* Breadcrumb + Action bar */}
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

          <div className="flex items-center gap-2">
            <Link
              href={`/${brand.slug}/${pack.slug}/${recipe.slug}/edit`}
              className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-colors"
              style={{
                borderColor: pack.mood.ink + "20",
                color: pack.mood.ink,
                background: "rgba(255,255,255,0.6)",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <path
                  d="M2 12V9.5L9.5 2L12 4.5L4.5 12H2Z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
              </svg>
              Karte bearbeiten
            </Link>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[12px] font-semibold transition-transform hover:scale-[1.02]"
              style={{
                background: pack.mood.ink,
                color: pack.mood.background,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <path
                  d="M7 1.5v8m0 0L4 6.5m3 3l3-3M2 11h10"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Karte als PDF
            </button>
          </div>
        </div>
      </section>

      <main className="flex-1">
        <div className="mx-auto max-w-[1200px] px-6 py-12 lg:px-10 lg:py-16">
          <RecipeCardFull
            brand={brand}
            pack={pack}
            recipe={recipe}
            totalRecipes={recipes.length}
          />

          {/* Recipe navigation */}
          <nav className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {previousRecipe ? (
              <RecipeNavLink
                direction="prev"
                href={`/${brand.slug}/${pack.slug}/${previousRecipe.slug}`}
                label="Vorherige Karte"
                title={previousRecipe.title}
                pack={pack}
              />
            ) : (
              <span />
            )}
            {nextRecipe ? (
              <RecipeNavLink
                direction="next"
                href={`/${brand.slug}/${pack.slug}/${nextRecipe.slug}`}
                label="Nächste Karte"
                title={nextRecipe.title}
                pack={pack}
              />
            ) : (
              <Link
                href={`/${brand.slug}/${pack.slug}`}
                className="group flex items-center justify-end gap-3 rounded-2xl border px-5 py-4 text-right transition-colors"
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

function Crumb({ pack }: { pack: ReturnType<typeof getPack> }) {
  return (
    <span
      style={{ color: pack?.mood.inkSoft, opacity: 0.5 }}
      aria-hidden
    >
      ›
    </span>
  );
}

function RecipeNavLink({
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
  pack: NonNullable<ReturnType<typeof getPack>>;
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
