import { renderToBuffer } from "@react-pdf/renderer";
import { PDFDocument } from "pdf-lib";
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

// Production-Garantie: jede Single-Recipe-PDF muss genau 1 Seite haben.
// Falls die Auto-Density-Heuristik mal danebenliegt (extrem lange Steps,
// monstroese Zutaten-Namen, riesige Story), greift dieser Render-Guard:
// 3-stufiges Retry-System mit progressiv aggressiveren Tweaks. Cleane
// Fallback-Reihenfolge:
//   Attempt 1 — Original Recipe, Auto-Density
//   Attempt 2 — densityOverride: "compact" + hideStory
//   Attempt 3 — Attempt 2 + hideMicros (Notbremse: Mikros-Block weg)
//   Final     — Hard-Fail mit eindeutiger Fehlermeldung
//
// Im Normal-Case rendert Attempt 1 sauber und der Guard ist transparent.
// Nur bei Edge-Cases (~0.5-1% der Recipes) tritt Retry ein.
async function getPageCount(buf: Buffer): Promise<number> {
  // pdf-lib parsed das PDF nur soweit dass die Page-Count im Trailer
  // ablesbar ist — sehr schnell (< 50ms typischerweise).
  const doc = await PDFDocument.load(buf);
  return doc.getPageCount();
}

const FALLBACK_TWEAKS: Array<{
  label: string;
  tweaks: NonNullable<Recipe["tweaks"]>;
}> = [
  {
    label: "compact + hideStory",
    tweaks: { densityOverride: "compact", hideStory: true },
  },
  {
    label: "compact + hideStory + hideMicros",
    tweaks: {
      densityOverride: "compact",
      hideStory: true,
      hideMicros: true,
    },
  },
];

// Renders a single-recipe PDF and returns the binary buffer.
// Production-Guard: bei Mehrseitigkeit wird automatisch mit aggressiveren
// Tweaks neu gerendert, sodass das finale PDF garantiert 1 Seite ist.
export async function renderRecipePdf(args: {
  brand: Brand;
  pack: Pack;
  recipe: Recipe;
  totalRecipes: number;
  onProgress?: RenderProgress;
}): Promise<Buffer> {
  ensureFontsRegistered();
  args.onProgress?.("loading-image", 15);
  const [heroDataUri, qrDataUri, avatarDataUri] = await Promise.all([
    loadImageAsDataUri(args.recipe.hero ?? args.pack.coverImage),
    generateQrDataUri(args.recipe.sourceUrl),
    loadImageAsDataUri(args.brand.avatar),
  ]);

  // Inner render-Funktion. Wird mit progressiv aggressiveren Tweaks
  // wiederholt aufgerufen wenn der Guard mehrere Seiten erkennt.
  const renderWithTweaks = async (
    overrideTweaks: Recipe["tweaks"] | undefined
  ): Promise<Buffer> => {
    const recipeForRender: Recipe = overrideTweaks
      ? {
          ...args.recipe,
          tweaks: {
            ...args.recipe.tweaks,
            ...overrideTweaks,
          },
        }
      : args.recipe;
    return await renderToBuffer(
      RecipePdfDocument({
        brand: args.brand,
        pack: args.pack,
        recipe: recipeForRender,
        totalRecipes: args.totalRecipes,
        heroDataUri,
        qrDataUri,
        avatarDataUri,
      })
    );
  };

  args.onProgress?.("rendering", 55);
  let buf = await renderWithTweaks(undefined);
  let pageCount = await getPageCount(buf);

  // Retry-Loop: falls Auto-Density das Recipe nicht auf 1 Seite kriegt,
  // greifen wir auf zunehmend striktere Tweak-Kombinationen zurueck.
  for (const { label, tweaks } of FALLBACK_TWEAKS) {
    if (pageCount === 1) break;
    console.warn(
      `[renderRecipePdf] ${args.recipe.slug} rendered ${pageCount} Seiten — Retry mit Fallback "${label}"`
    );
    args.onProgress?.("rendering-retry", 70);
    buf = await renderWithTweaks(tweaks);
    pageCount = await getPageCount(buf);
  }

  if (pageCount !== 1) {
    // Auch der finale Fallback hat es nicht geschafft. Hard-Fail mit klarer
    // Diagnose damit der Editor das Recipe nachjustieren kann (Step-Texte
    // kuerzen, Zutaten-Namen verkuerzen).
    throw new Error(
      `Recipe "${args.recipe.slug}" produziert ${pageCount} Seiten selbst mit maximaler Kompression. ` +
        `Step-Texte oder Zutaten-Namen sind zu lang. Bitte im Editor kuerzen oder hideStory/hideMicros manuell setzen.`
    );
  }

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
