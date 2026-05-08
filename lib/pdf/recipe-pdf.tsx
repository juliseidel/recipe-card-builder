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
};

// Single-recipe PDF wrapper. The recipe layout fills exactly one A4 page.
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
      <RecipeCardPdfPage {...props} />
    </Document>
  );
}
