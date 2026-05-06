import { notFound } from "next/navigation";
import Image from "next/image";
import { getBrand } from "@/lib/brands";
import { getPack } from "@/lib/packs";
import { getRecipesForPack } from "@/lib/recipes";
import { RecipeCardFull } from "@/components/recipe-card-full";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ brand: string; pack: string }>;
};

// Multi-page pack export. Cover → Index → one recipe card per page. CSS
// `break-before: page` puts each section on its own A4 sheet when Puppeteer
// captures the document.
export default async function PrintPackPage({ params }: Props) {
  const { brand: brandSlug, pack: packSlug } = await params;
  const brand = getBrand(brandSlug);
  const pack = getPack(brandSlug, packSlug);
  if (!brand || !pack) notFound();

  const recipes = await getRecipesForPack(packSlug);
  if (recipes.length === 0) notFound();

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @page { size: A4; margin: 0; }
            html, body {
              margin: 0;
              padding: 0;
              background: #ffffff;
            }
            *, *::before, *::after {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .pack-page {
              width: 1024px;
              padding: 0;
              background: #ffffff;
              box-sizing: border-box;
            }
            .pack-page + .pack-page { break-before: page; page-break-before: always; }
            /* Edge-to-edge: no rounded shell, no drop shadow on print. */
            .pack-page article {
              max-width: 100% !important;
              border-radius: 0 !important;
              border: 0 !important;
              box-shadow: none !important;
            }
            .pack-page a { color: inherit !important; text-decoration: none !important; }
          `,
        }}
      />

      {/* COVER */}
      <div className="pack-page">
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "1 / 1",
            borderRadius: 24,
            overflow: "hidden",
            boxShadow: "0 1px 0 rgba(43,31,25,0.05), 0 16px 32px -16px rgba(43,31,25,0.18)",
          }}
        >
          <Image
            src={pack.coverImage}
            alt={pack.title}
            fill
            sizes="1024px"
            style={{ objectFit: "cover" }}
            priority
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(180deg, transparent 30%, ${pack.mood.ink}cc 100%)`,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 48,
              right: 48,
              bottom: 48,
              color: "#fff",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-inter), Inter, sans-serif",
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                opacity: 0.85,
              }}
            >
              Pack {String(pack.number).padStart(2, "0")} · {brand.name}
            </div>
            <h1
              style={{
                fontFamily: "var(--font-fraunces), Fraunces, serif",
                fontSize: 88,
                lineHeight: 0.95,
                letterSpacing: "-0.02em",
                margin: "16px 0 0",
                fontStyle: pack.cardLayout === "patisserie" ? "italic" : "normal",
              }}
            >
              {pack.title}
            </h1>
            <p
              style={{
                fontFamily: "var(--font-fraunces), Fraunces, serif",
                fontSize: 24,
                fontStyle: "italic",
                opacity: 0.92,
                margin: "12px 0 0",
                maxWidth: "30ch",
              }}
            >
              {pack.subtitle}
            </p>
            <p
              style={{
                fontFamily: "var(--font-inter), Inter, sans-serif",
                fontSize: 13,
                opacity: 0.75,
                margin: "28px 0 0",
                letterSpacing: "0.16em",
                textTransform: "uppercase",
              }}
            >
              {recipes.length} Rezepte · {brand.handle}
            </p>
          </div>
        </div>
      </div>

      {/* INDEX */}
      <div className="pack-page">
        <div
          style={{
            background: "#fff",
            borderRadius: 24,
            padding: "56px 56px 48px",
            border: `1px solid ${brand.tokens.line}`,
            minHeight: 920,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: pack.mood.accent,
            }}
          >
            Inhalt
          </div>
          <h2
            style={{
              fontFamily: "var(--font-fraunces), Fraunces, serif",
              fontSize: 56,
              lineHeight: 1,
              letterSpacing: "-0.01em",
              color: pack.mood.ink,
              margin: "12px 0 36px",
              fontStyle: pack.cardLayout === "patisserie" ? "italic" : "normal",
            }}
          >
            Alle {recipes.length} Karten
          </h2>
          <ol
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: 0,
            }}
          >
            {recipes.map((r) => (
              <li
                key={r.slug}
                style={{
                  display: "grid",
                  gridTemplateColumns: "60px 1fr auto",
                  alignItems: "baseline",
                  gap: 20,
                  padding: "14px 0",
                  borderBottom: `1px solid ${brand.tokens.line}`,
                  color: pack.mood.ink,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-fraunces), Fraunces, serif",
                    fontSize: 22,
                    color: pack.mood.accent,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {String(r.number).padStart(2, "0")}
                </span>
                <span style={{ fontSize: 18, lineHeight: 1.3, color: pack.mood.ink }}>
                  {r.title}
                  <span
                    style={{
                      display: "block",
                      marginTop: 2,
                      fontSize: 12,
                      fontStyle: "italic",
                      color: pack.mood.inkSoft,
                    }}
                  >
                    {r.subtitle}
                  </span>
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-jetbrains-mono), monospace",
                    fontSize: 12,
                    fontVariantNumeric: "tabular-nums",
                    color: pack.mood.inkSoft,
                  }}
                >
                  {r.nutrition.kcal} kcal · {r.nutrition.protein}g E
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* RECIPE CARDS — each on its own page */}
      {recipes.map((recipe) => (
        <div key={recipe.slug} className="pack-page">
          <RecipeCardFull
            brand={brand}
            pack={pack}
            recipe={recipe}
            totalRecipes={recipes.length}
          />
        </div>
      ))}
    </>
  );
}
