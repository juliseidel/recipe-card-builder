import { Document } from "@react-pdf/renderer";
import type { Brand } from "@/lib/brands";
import type { Pack } from "@/lib/packs";
import type { Recipe } from "@/lib/recipes";
import { RecipeCardPdfPage } from "./recipe-card-pdf";

export type RecipePdfProps = {
  brand: Brand;
  pack: Pack;
  recipe: Recipe;
  totalRecipes: number;
  heroDataUri: string | null;
  qrDataUri: string | null;
  // Brand avatar for layouts that anchor the brand visually inside the
  // recipe page (e.g. Patisserie's footer signature with Bienes face).
  avatarDataUri: string | null;
};

// Single-recipe PDF wrapper. The recipe layout fills exactly one A4 page.
// hideRecipeIndex=true: bei einem Single-Recipe-PDF ist die "01 / 07"-Anzeige
// kontextlos (die anderen 6 Karten sind nicht im File), wir blenden sie aus.
// Pack-PDFs (PackPdfDocument) zeigen sie weiter, weil dort durch den Pack
// geblaettert wird.
export function RecipePdfDocument(props: RecipePdfProps) {
  return (
    <Document
      title={`${props.recipe.title} · ${props.pack.title}`}
      author={props.brand.fullName}
      subject={props.recipe.subtitle}
      keywords={`${props.brand.handle},${props.pack.category},${props.recipe.title}`}
      creator="Recipe Card Builder"
      producer="Recipe Card Builder · Wolf Family Office Test Week"
    >
      <RecipeCardPdfPage {...props} hideRecipeIndex />
    </Document>
  );
}
