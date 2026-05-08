import { renderToBuffer } from "@react-pdf/renderer";
import type { Brand } from "@/lib/brands";
import type { Pack } from "@/lib/packs";
import type { Recipe } from "@/lib/recipes";
import { ensureFontsRegistered } from "./fonts";
import { loadImageAsDataUri } from "./assets";
import { generateQrDataUri } from "./qr";
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
  const [heroDataUri, qrDataUri] = await Promise.all([
    loadImageAsDataUri(args.recipe.hero ?? args.pack.coverImage),
    generateQrDataUri(args.recipe.sourceUrl),
  ]);
  args.onProgress?.("rendering", 60);
  const buf = await renderToBuffer(
    RecipePdfDocument({
      brand: args.brand,
      pack: args.pack,
      recipe: args.recipe,
      totalRecipes: args.totalRecipes,
      heroDataUri,
      qrDataUri,
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
  // Hero images and QR codes are independent — fan them out together so the
  // total wall-clock is `max(slowest hero, slowest QR)` rather than their
  // sum. QRs are CPU-bound (a few ms each); heroes are I/O-bound (storage
  // fetch + base64). At 10 recipes the difference is ~80 ms saved.
  const [heroDataUris, qrDataUris] = await Promise.all([
    Promise.all(
      args.recipes.map((r) =>
        loadImageAsDataUri(r.hero ?? args.pack.coverImage)
      )
    ),
    Promise.all(args.recipes.map((r) => generateQrDataUri(r.sourceUrl))),
  ]);

  args.onProgress?.("rendering", 55);
  const buf = await renderToBuffer(
    PackPdfDocument({
      brand: args.brand,
      pack: args.pack,
      recipes: args.recipes,
      coverDataUri,
      heroDataUris,
      qrDataUris,
    })
  );
  args.onProgress?.("done", 100);
  return buf;
}
