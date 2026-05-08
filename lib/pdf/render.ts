import { renderToBuffer } from "@react-pdf/renderer";
import type { Brand } from "@/lib/brands";
import type { Pack } from "@/lib/packs";
import type { Recipe } from "@/lib/recipes";
import { ensureFontsRegistered } from "./fonts";
import { loadImageAsDataUri } from "./assets";
import { generateQrDataUri } from "./qr";
import { getPackForeword } from "@/lib/pack-forewords";
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

  // Foreword assets: only loaded when the pack has a cached foreword.
  // The other four packs (no foreword cached yet) skip loading entirely
  // and render exactly as they did before — same image fetches, same
  // page sequence, no behaviour change.
  const forewordContent = getPackForeword(args.pack.slug);
  const forewordPaths = forewordContent
    ? {
        image: `/brands/${args.brand.slug}/forewords/${args.pack.slug}.jpg`,
        avatar: args.brand.avatar,
      }
    : null;

  args.onProgress?.("loading-recipe-images", 20);
  // Hero images, QR codes, and (optionally) foreword assets fan out
  // together. Doing them in parallel keeps total wall-clock time as
  // close as possible to the slowest single load.
  const [heroDataUris, qrDataUris, forewordImageDataUri, avatarDataUri] =
    await Promise.all([
      Promise.all(
        args.recipes.map((r) =>
          loadImageAsDataUri(r.hero ?? args.pack.coverImage)
        )
      ),
      Promise.all(args.recipes.map((r) => generateQrDataUri(r.sourceUrl))),
      forewordPaths
        ? loadImageAsDataUri(forewordPaths.image)
        : Promise.resolve(null),
      forewordPaths
        ? loadImageAsDataUri(forewordPaths.avatar)
        : Promise.resolve(null),
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
      forewordContent,
      forewordImageDataUri,
      avatarDataUri,
    })
  );
  args.onProgress?.("done", 100);
  return buf;
}
