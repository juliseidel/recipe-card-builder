import { renderToBuffer } from "@react-pdf/renderer";
import type { Brand } from "@/lib/brands";
import type { Pack } from "@/lib/packs";
import type { Recipe } from "@/lib/recipes";
import { ensureFontsRegistered } from "./fonts";
import { loadImageAsDataUri } from "./assets";
import { RecipePdfDocument } from "./recipe-pdf";
import { PackPdfDocument } from "./pack-pdf";

export type RenderProgress = (stage: string, percent: number) => void;

// Renders a single-recipe PDF and returns the binary buffer.
export async function renderRecipePdf(args: {
  brand: Brand;
  pack: Pack;
  recipe: Recipe;
  totalRecipes: number;
  onProgress?: RenderProgress;
}): Promise<Buffer> {
  ensureFontsRegistered();
  args.onProgress?.("loading-image", 20);
  const heroDataUri = await loadImageAsDataUri(
    args.recipe.hero ?? args.pack.coverImage
  );
  args.onProgress?.("rendering", 60);
  const buf = await renderToBuffer(
    RecipePdfDocument({
      brand: args.brand,
      pack: args.pack,
      recipe: args.recipe,
      totalRecipes: args.totalRecipes,
      heroDataUri,
    })
  );
  args.onProgress?.("done", 100);
  return buf;
}

// Renders a full pack PDF (cover + index + recipes + nutrition).
export async function renderPackPdf(args: {
  brand: Brand;
  pack: Pack;
  recipes: Recipe[];
  onProgress?: RenderProgress;
}): Promise<Buffer> {
  ensureFontsRegistered();

  args.onProgress?.("loading-cover", 8);
  const coverDataUri = await loadImageAsDataUri(args.pack.coverImage);

  args.onProgress?.("loading-recipe-images", 20);
  const heroDataUris = await Promise.all(
    args.recipes.map((r) =>
      loadImageAsDataUri(r.hero ?? args.pack.coverImage)
    )
  );

  args.onProgress?.("rendering", 55);
  const buf = await renderToBuffer(
    PackPdfDocument({
      brand: args.brand,
      pack: args.pack,
      recipes: args.recipes,
      coverDataUri,
      heroDataUris,
    })
  );
  args.onProgress?.("done", 100);
  return buf;
}
