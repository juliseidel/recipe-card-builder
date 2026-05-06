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
              /* White everywhere outside the card so any unused area at the
                 bottom (when auto-fit-scale is < 0.776) blends with the
                 white footer of the card — gives the document the
                 edge-to-edge "Recipe Card" feel of the original PDF, while
                 keeping the inside identical to the web component. */
              background: #ffffff;
            }
            *, *::before, *::after {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .print-canvas {
              width: 1024px;
              padding: 0;
              background: #ffffff;
              box-sizing: border-box;
            }
            /* Strip the outer card chrome — the rounded shell, drop shadow
               and border are what made the PDF look like "a card floating
               inside a page". On paper we want the card to BE the page. */
            .print-canvas article {
              max-width: 100% !important;
              border-radius: 0 !important;
              border: 0 !important;
              box-shadow: none !important;
            }
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
