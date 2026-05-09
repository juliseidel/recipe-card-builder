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
  const [heroDataUri, qrDataUri, avatarDataUri] = await Promise.all([
    loadImageAsDataUri(args.recipe.hero ?? args.pack.coverImage),
    generateQrDataUri(args.recipe.sourceUrl),
    loadImageAsDataUri(args.brand.avatar),
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
      avatarDataUri,
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

  // Foreword sources, in priority order:
  //   1. Statischer Cache (lib/pack-forewords.ts) — die 5 kuratierten
  //      Bienen-Packs, hand-poliert + Stillleben auf der Disk unter
  //      public/brands/<brand>/forewords/<slug>.jpg
  //   2. Custom-Packs — pack.foreword (Gemini-generiert beim
  //      Anlegen) + pack.forewordImage (Flux 2 Pro, in Supabase
  //      Storage). Faellt zurueck wenn der statische Cache nichts hat.
  //
  // Wenn beides leer ist (z. B. enrich noch am Laufen), bleibt die
  // Legacy Cover→Index-Sequenz erhalten — die Vorwort-Seite wird
  // einfach uebersprungen, alles andere rendert normal.
  const cachedForeword = getPackForeword(args.pack.slug);
  const forewordContent = cachedForeword ?? args.pack.foreword ?? null;
  const forewordImagePath: string | null = cachedForeword
    ? `/brands/${args.brand.slug}/forewords/${args.pack.slug}.jpg`
    : forewordContent && args.pack.forewordImage
      ? args.pack.forewordImage
      : null;

  args.onProgress?.("loading-recipe-images", 20);
  // Hero images, QR codes, foreword image (optional), and brand avatar
  // (always loaded — Patisserie uses it inside its recipe-page footer
  // so the avatar is needed even when this pack has no foreword). All
  // fan out via Promise.all so total wall-clock stays close to the
  // slowest single asset.
  const [heroDataUris, qrDataUris, forewordImageDataUri, avatarDataUri] =
    await Promise.all([
      Promise.all(
        args.recipes.map((r) =>
          loadImageAsDataUri(r.hero ?? args.pack.coverImage)
        )
      ),
      Promise.all(args.recipes.map((r) => generateQrDataUri(r.sourceUrl))),
      forewordImagePath
        ? loadImageAsDataUri(forewordImagePath)
        : Promise.resolve(null),
      loadImageAsDataUri(args.brand.avatar),
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
