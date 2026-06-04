import { renderToBuffer } from "@react-pdf/renderer";
import { PDFDocument } from "pdf-lib";
import type { Brand } from "@/lib/brands";
import type { Pack } from "@/lib/packs";
import { groupRecipesBySize, type Recipe } from "@/lib/recipes";
import { ensureFontsRegistered } from "./fonts";
import { loadImageAsDataUri } from "./assets";
import { generateQrDataUri } from "./qr";
import { getPackForeword } from "@/lib/pack-forewords";
import { RecipePdfDocument } from "./recipe-pdf";
import { PackPdfDocument } from "./pack-pdf";

export type RenderProgress = (stage: string, percent: number) => void;

// Production-Garantie: jede Recipe-Card muss genau 1 Seite haben — egal ob
// als Single-Recipe-PDF exportiert oder als eine von N Karten im Pack-PDF.
// Falls die Auto-Density-Heuristik mal danebenliegt (extrem lange Steps,
// monstroese Zutaten-Namen, riesige Story), greift dieser Render-Guard:
// 5-stufiges Retry-System mit progressiv aggressiveren Massnahmen. Cleane
// Fallback-Reihenfolge:
//   Attempt 1 — Original Recipe, Auto-Density
//   Attempt 2 — densityOverride: "compact" + hideStory
//   Attempt 3 — Attempt 2 + hideMicros (Notbremse: Mikros-Block weg)
//   Attempt 4 — Attempt 3 + titleScale -2 (kleinere Titel-Reserve)
//   Attempt 5 — Layout-Switch zu "feature" (Pixel-Estimation +
//               Smart-Truncation in feature-fit.ts, garantierte 1-Seite
//               weil Story + Subtitle notfalls automatisch weggelassen)
//   Final     — Hard-Fail (sollte praktisch nie auftreten)
//
// Im Normal-Case rendert Attempt 1 sauber und der Guard ist transparent.
// Stufen 2-3 greifen bei ~0.5% (lange Step-Texte). Stufen 4-5 sind
// Edge-Case-Notbremsen, die <0.1% der Recipes brauchen. Jede angewandte
// Fallback-Stufe wird per console.warn geloggt, sodass die betroffenen
// Karten in den Vercel-Logs sichtbar sind und nachjustiert werden koennen.
async function getPageCount(buf: Buffer): Promise<number> {
  // pdf-lib parsed das PDF nur soweit dass die Page-Count im Trailer
  // ablesbar ist — sehr schnell (< 50ms typischerweise).
  const doc = await PDFDocument.load(buf);
  return doc.getPageCount();
}

// Eine Fallback-Stufe transformiert das Original-Recipe in eine engere
// Variante. Jede Stufe greift auf das ORIGINAL zu (nicht kumulativ auf
// die vorherige Stufe) — so bleibt die Semantik klar lesbar: jede Stufe
// ist eine vollstaendige, alleinstehende Konfiguration.
type FallbackAttempt = {
  label: string;
  apply: (recipe: Recipe) => Recipe;
};

const FALLBACK_ATTEMPTS: FallbackAttempt[] = [
  {
    label: "compact + hideStory",
    apply: (r) => ({
      ...r,
      tweaks: { ...r.tweaks, densityOverride: "compact", hideStory: true },
    }),
  },
  {
    label: "compact + hideStory + hideMicros",
    apply: (r) => ({
      ...r,
      tweaks: {
        ...r.tweaks,
        densityOverride: "compact",
        hideStory: true,
        hideMicros: true,
      },
    }),
  },
  {
    label: "compact + hideStory + hideMicros + titleScale -2",
    apply: (r) => ({
      ...r,
      tweaks: {
        ...r.tweaks,
        densityOverride: "compact",
        hideStory: true,
        hideMicros: true,
        titleScale: -2,
      },
    }),
  },
  {
    // Letzter Safety-Net: Layout-Switch zu feature. Das Feature-Layout
    // hat als einziges eine echte Pixel-Estimation + Smart-Truncation
    // in lib/pdf/feature-fit.ts eingebaut — pickFeatureDensity iteriert
    // spacious -> extreme und gibt im worst case extreme + truncateStory
    // + truncateSubtitle zurueck, was Story und Subtitle automatisch
    // weglaesst. Dadurch ist 1-Page-Output bei JEDEM Recipe-Inhalt
    // garantiert.
    //
    // Trade-off: Diese eine Karte sieht im Pack visuell anders aus als
    // die anderen (anderes Layout). Das ist akzeptabel weil:
    // (a) extrem selten (<0.1% der Recipes)
    // (b) besser als gar kein PDF / Hard-Fail
    // (c) ein klarer console.warn loggt es, sodass der Editor das
    //     Recipe nachtraeglich kuerzen kann
    label: "layout-switch zu feature (Pixel-Estimation + Smart-Truncation)",
    apply: (r) => ({
      ...r,
      cardLayout: "feature",
      tweaks: {
        ...r.tweaks,
        // Kein densityOverride — pickFeatureDensity arbeitet mit
        // Pixel-Estimation und waehlt selbst extreme + truncate.
        hideStory: true,
        hideMicros: true,
        titleScale: -2,
      },
    }),
  },
];

// Findet die schwaechste Fallback-Kombination, mit der ein einzelnes
// Recipe garantiert auf 1 A4-Seite passt. Rendert dafuer das Recipe als
// Single-Page-Document via RecipePdfDocument — genau die Page-Komponente
// (RecipeCardPdfPage), die spaeter auch im Pack-PDF-Pfad verwendet wird,
// sodass das Ergebnis WYSIWYG ist: passt es als Single, passt es im Pack.
//
// Returnt das modifizierte Recipe + den finalen Buffer (den der
// Single-Recipe-Export wiederverwendet, sodass kein Doppel-Render noetig
// ist). Wirft bei Hard-Fail mit eindeutiger Fehlermeldung — sollte aber
// praktisch nie auftreten weil Stufe 5 (feature-switch) eine
// quasi-Garantie ist.
async function fitRecipeToOnePage(args: {
  brand: Brand;
  pack: Pack;
  recipe: Recipe;
  totalRecipes: number;
  heroDataUri: string | null;
  qrDataUri: string | null;
  avatarDataUri: string | null;
}): Promise<{ recipe: Recipe; buffer: Buffer }> {
  const renderWithRecipe = async (recipeForRender: Recipe): Promise<Buffer> => {
    return await renderToBuffer(
      RecipePdfDocument({
        brand: args.brand,
        pack: args.pack,
        recipe: recipeForRender,
        totalRecipes: args.totalRecipes,
        heroDataUri: args.heroDataUri,
        qrDataUri: args.qrDataUri,
        avatarDataUri: args.avatarDataUri,
      })
    );
  };

  // Attempt 1: Auto-Density (Original Recipe, kein Override).
  let currentRecipe = args.recipe;
  let buf = await renderWithRecipe(currentRecipe);
  let pageCount = await getPageCount(buf);

  // Attempts 2-5: progressive Fallbacks. Jede Stufe wird auf das
  // ORIGINAL angewandt (nicht kumulativ), damit jede Stufe alleinstehend
  // sauber konfiguriert ist.
  for (const { label, apply } of FALLBACK_ATTEMPTS) {
    if (pageCount === 1) break;
    console.warn(
      `[pdf-fit] ${args.recipe.slug} rendered ${pageCount} Seiten — Retry mit Fallback "${label}"`
    );
    currentRecipe = apply(args.recipe);
    buf = await renderWithRecipe(currentRecipe);
    pageCount = await getPageCount(buf);
  }

  if (pageCount !== 1) {
    // Sollte praktisch nie auftreten — Stufe 5 (feature-switch) hat
    // eingebaute Smart-Truncation in feature-fit.ts, die selbst extreme
    // Recipes auf 1 Seite drueckt. Wenn diese Meldung doch erscheint, ist
    // das Recipe pathologisch (z.B. 30+ Steps mit je 300+ Zeichen) und
    // sollte im Editor radikal gekuerzt werden.
    throw new Error(
      `Recipe "${args.recipe.slug}" produziert ${pageCount} Seiten selbst nach Layout-Switch zu feature mit Smart-Truncation. ` +
        `Dieser Fall ist sehr selten — typischerweise nur bei 30+ Steps mit jeweils 300+ Zeichen. Bitte Step-Texte im Editor kuerzen.`
    );
  }

  return { recipe: currentRecipe, buffer: buf };
}

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

  args.onProgress?.("rendering", 55);
  const fit = await fitRecipeToOnePage({
    brand: args.brand,
    pack: args.pack,
    recipe: args.recipe,
    totalRecipes: args.totalRecipes,
    heroDataUri,
    qrDataUri,
    avatarDataUri,
  });
  args.onProgress?.("done", 100);
  return fit.buffer;
}

// Renders a full pack PDF (cover + index + recipes + nutrition).
export async function renderPackPdf(args: {
  brand: Brand;
  pack: Pack;
  recipes: Recipe[];
  onProgress?: RenderProgress;
}): Promise<Buffer> {
  ensureFontsRegistered();

  // Mahlzeitengröße-Gruppierung pro Pack (pack.groupByMealSize). Muss GANZ
  // am Anfang passieren, weil sie Reihenfolge + number der Rezepte aendert
  // und alle folgenden Arrays (heroDataUris, qrDataUris, fittedRecipes)
  // parallel-indiziert zu dieser Liste aufgebaut werden. So zeigt auch der
  // Web-Download (Job-Runner → renderPackPdf) die gruppierte MacroIndexPage +
  // Badges, ohne dass mealSize in der DB stehen muss. Idempotent (siehe
  // groupRecipesBySize), daher unschaedlich falls die Liste schon gruppiert
  // reinkommt (lokaler render-book-Script).
  const recipes = args.pack.groupByMealSize
    ? groupRecipesBySize(args.recipes)
    : args.recipes;

  // Premium-Buch-Bilder (pack.premiumBook) haben Vorrang vor den normalen
  // pack-Bild-Feldern. Grund: der Editor-Pfad "Cover/Bild neu generieren"
  // (app/api/packs/[id]/regenerate-field) ueberschreibt pack.coverImage/
  // forewordImage/outroImage jederzeit mit frischen Gemini-Bildern
  // (coverStyle="creator") — ein finalisiertes Premium-Buch soll davon NICHT
  // betroffen sein. Die Buch-Bilder liegen separat in premiumBook und sind so
  // gegen Cover-Regen immun. Fallback auf die pack-Felder, wenn nicht gesetzt.
  const premiumImages = args.pack.premiumBook;
  const outroImageSrc = premiumImages?.outroImage ?? args.pack.outroImage;

  args.onProgress?.("loading-cover", 8);
  const coverDataUri = await loadImageAsDataUri(
    premiumImages?.coverImage ?? args.pack.coverImage
  );

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
  const forewordImagePath: string | null =
    premiumImages?.forewordImage ??
    (cachedForeword
      ? `/brands/${args.brand.slug}/forewords/${args.pack.slug}.jpg`
      : forewordContent && args.pack.forewordImage
        ? args.pack.forewordImage
        : null);

  args.onProgress?.("loading-recipe-images", 20);
  // Hero images, QR codes, foreword image (optional), outro image
  // (optional), brand avatar (always loaded — Patisserie uses it inside its
  // recipe-page footer), plus Guide-Modus story-page images. All fan out
  // via Promise.all so total wall-clock stays close to the slowest asset.
  const guideStoryPages =
    args.pack.packMode === "guide" && args.pack.storyPages
      ? args.pack.storyPages
      : [];
  const [
    heroDataUris,
    qrDataUris,
    forewordImageDataUri,
    outroImageDataUri,
    avatarDataUri,
    storyImageDataUris,
  ] = await Promise.all([
    Promise.all(
      recipes.map((r) => loadImageAsDataUri(r.hero ?? args.pack.coverImage))
    ),
    Promise.all(recipes.map((r) => generateQrDataUri(r.sourceUrl))),
    forewordImagePath
      ? loadImageAsDataUri(forewordImagePath)
      : Promise.resolve(null),
    outroImageSrc
      ? loadImageAsDataUri(outroImageSrc)
      : Promise.resolve(null),
    loadImageAsDataUri(args.brand.avatar),
    Promise.all(
      guideStoryPages.map((p) =>
        p.imageUrl ? loadImageAsDataUri(p.imageUrl) : Promise.resolve(null)
      )
    ),
  ]);

  // Pre-Render-Verifikation: jede Recipe-Card einzeln rendern und
  // notfalls mit Tweaks neu rendern bis sie auf 1 Seite passt. Das
  // Ergebnis sind Recipes mit ggf. zusaetzlich gesetzten Tweaks
  // (densityOverride/hideStory/hideMicros), die wir gleich in
  // PackPdfDocument einspeisen. So ist garantiert dass im finalen
  // Pack-PDF keine einzelne Karte auf 2 Seiten umbricht — die gleiche
  // RecipeCardPdfPage-Komponente wird hier zur Pruefung und spaeter
  // im Pack-Render verwendet, also WYSIWYG.
  //
  // Sequenziell, nicht parallel: react-pdf ist CPU-bound, parallel
  // bringt auf einem Lambda-Worker nichts und erzeugt Memory-Spikes.
  // Bei 14 Karten ~30-45s extra im Background-Job; akzeptabel weil
  // der Job-Runner ohnehin asynchron laeuft.
  args.onProgress?.("verifying-recipes", 35);
  const fittedRecipes: Recipe[] = [];
  for (let i = 0; i < recipes.length; i++) {
    const fit = await fitRecipeToOnePage({
      brand: args.brand,
      pack: args.pack,
      recipe: recipes[i],
      totalRecipes: recipes.length,
      heroDataUri: heroDataUris[i] ?? null,
      qrDataUri: qrDataUris[i] ?? null,
      avatarDataUri,
    });
    fittedRecipes.push(fit.recipe);
    const verifyPct = 35 + Math.round(((i + 1) / recipes.length) * 20);
    args.onProgress?.("verifying-recipes", verifyPct);
  }

  args.onProgress?.("rendering", 55);
  const buf = await renderToBuffer(
    PackPdfDocument({
      brand: args.brand,
      pack: args.pack,
      recipes: fittedRecipes,
      coverDataUri,
      heroDataUris,
      qrDataUris,
      forewordContent,
      forewordImageDataUri,
      avatarDataUri,
      storyImageDataUris,
      outroImageDataUri,
    })
  );
  args.onProgress?.("done", 100);
  return buf;
}
