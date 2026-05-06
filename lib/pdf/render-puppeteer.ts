// PDF rendering via headless Chromium. Hits the public /print/* routes on the
// same Vercel deployment, lets the real Web component render, then captures
// the page as A4 PDF. Replaces the @react-pdf/renderer pipeline so that PDF
// output is pixel-equivalent to the web view.

import type { Brand } from "@/lib/brands";
import type { Pack } from "@/lib/packs";
import type { Recipe } from "@/lib/recipes";
import { getBrowser, getOrigin } from "./puppeteer";

export type RenderProgress = (stage: string, percent: number) => void;

// Viewport width that triggers Tailwind's `lg:` (≥1024px) breakpoints. The
// recipe-card-full layouts use lg-only grids for the side-by-side ingredients
// + steps; keeping the viewport wide ensures the print render gets the
// premium two-column treatment, then we scale down to fit A4.
const PRINT_VIEWPORT_WIDTH = 1024;
const PRINT_VIEWPORT_HEIGHT = 1500;
// A4 portrait at 96 DPI in viewport pixels. The PDF "scale" param shrinks
// the rendered content by this much to match A4.
const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;
const WIDTH_FIT_SCALE = A4_WIDTH_PX / PRINT_VIEWPORT_WIDTH; // ~0.776
// Hard floor — below this fonts get unreadable. Recipes that need more
// aggressive shrinking probably should be split into two pages by hand
// rather than rendered at 35% size.
const MIN_SCALE = 0.5;

// Computes a PDF scale factor that ALWAYS keeps the rendered page on one
// A4 sheet. Width is fixed at WIDTH_FIT_SCALE; if the content overflows the
// vertical budget, we scale further so it fits. Single-page guarantee was
// the original design promise of the @react-pdf renderer; this preserves it
// in the new headless-Chromium pipeline.
function computeFitScale(contentHeightPx: number): number {
  const heightFitScale = A4_HEIGHT_PX / contentHeightPx;
  const fit = Math.min(WIDTH_FIT_SCALE, heightFitScale);
  return Math.max(MIN_SCALE, fit);
}

export async function renderRecipePdf(args: {
  brand: Brand;
  pack: Pack;
  recipe: Recipe;
  totalRecipes: number;
  onProgress?: RenderProgress;
}): Promise<Buffer> {
  args.onProgress?.("loading-browser", 10);
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({
      width: PRINT_VIEWPORT_WIDTH,
      height: PRINT_VIEWPORT_HEIGHT,
      deviceScaleFactor: 2,
    });

    args.onProgress?.("loading-page", 35);
    const url = `${getOrigin()}/print/${args.brand.slug}/${args.pack.slug}/${args.recipe.slug}`;
    await page.goto(url, { waitUntil: "networkidle0", timeout: 45_000 });

    // Belt-and-braces: wait for fonts to settle in case `networkidle0` raced.
    await page.evaluate(() => document.fonts.ready);

    // Measure the actual rendered card so we can compute a fit-scale. Long
    // recipes (14+ ingredients) overflow the default 0.776× scale and would
    // spill onto a second page; this brings them back to one.
    const contentHeight = await page.evaluate(() => {
      const wrapper = document.querySelector(".print-canvas");
      return wrapper ? (wrapper as HTMLElement).scrollHeight : 0;
    });
    const scale = computeFitScale(contentHeight || PRINT_VIEWPORT_HEIGHT);

    args.onProgress?.("rendering", 70);
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
      scale,
    });

    args.onProgress?.("done", 100);
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}

export async function renderPackPdf(args: {
  brand: Brand;
  pack: Pack;
  recipes: Recipe[];
  onProgress?: RenderProgress;
}): Promise<Buffer> {
  args.onProgress?.("loading-browser", 8);
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({
      width: PRINT_VIEWPORT_WIDTH,
      height: PRINT_VIEWPORT_HEIGHT,
      deviceScaleFactor: 2,
    });

    args.onProgress?.("loading-page", 30);
    const url = `${getOrigin()}/print/${args.brand.slug}/${args.pack.slug}`;
    // Pack PDFs are heavier — they pull all recipe images. Give the browser
    // up to 90 s to finish loading.
    await page.goto(url, { waitUntil: "networkidle0", timeout: 90_000 });
    await page.evaluate(() => document.fonts.ready);

    args.onProgress?.("rendering", 70);
    // Pack PDFs span multiple pages by design (one card per A4 sheet), so we
    // stick with the width-fit scale rather than measuring total height.
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
      scale: WIDTH_FIT_SCALE,
    });

    args.onProgress?.("done", 100);
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}
