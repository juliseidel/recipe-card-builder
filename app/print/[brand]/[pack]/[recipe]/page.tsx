import { notFound } from "next/navigation";
import { getBrand } from "@/lib/brands";
import { getPack } from "@/lib/packs";
import { getRecipe, getRecipesForPack } from "@/lib/recipes";
import { RecipeCardFull } from "@/components/recipe-card-full";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ brand: string; pack: string; recipe: string }>;
};

// Print-only route. Renders ONE recipe card on a single A4-sized canvas with
// no navigation chrome. The headless-Chromium renderer (lib/pdf/puppeteer.ts)
// hits this URL and captures it as a PDF. Visiting it directly in a browser
// also works — useful for previewing the PDF look without the export step.
export default async function PrintRecipePage({ params }: Props) {
  const { brand: brandSlug, pack: packSlug, recipe: recipeSlug } = await params;
  const brand = getBrand(brandSlug);
  const pack = getPack(brandSlug, packSlug);
  if (!brand || !pack) notFound();

  const [recipe, allRecipes] = await Promise.all([
    getRecipe(packSlug, recipeSlug),
    getRecipesForPack(packSlug),
  ]);
  if (!recipe) notFound();

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @page { size: A4; margin: 0; }
            html, body {
              margin: 0;
              padding: 0;
              background: ${brand.tokens.background};
            }
            *, *::before, *::after {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .print-canvas {
              width: 1024px;
              padding: 36px 32px;
              background: ${brand.tokens.background};
              box-sizing: border-box;
            }
            .print-canvas article {
              max-width: 100% !important;
              box-shadow:
                0 1px 0 rgba(43,31,25,0.05),
                0 16px 32px -16px rgba(43,31,25,0.18) !important;
            }
            /* Hide elements that exist in the web view but should never
               make it into the printable card (e.g. external links open
               in a new tab — meaningless on paper). */
            .print-canvas a { color: inherit !important; text-decoration: none !important; }
          `,
        }}
      />
      <div className="print-canvas">
        <RecipeCardFull
          brand={brand}
          pack={pack}
          recipe={recipe}
          totalRecipes={allRecipes.length}
        />
      </div>
    </>
  );
}
