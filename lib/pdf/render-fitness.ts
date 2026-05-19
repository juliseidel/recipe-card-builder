import { renderToBuffer } from "@react-pdf/renderer";
import type { Brand } from "@/lib/brands";
import type { Pack } from "@/lib/packs";
import type { FitnessCard } from "@/lib/fitness/types";
import { ensureFontsRegistered } from "./fonts";
import { loadImageAsDataUri } from "./assets";
import { generateQrDataUri } from "./qr";
import { FitnessCardPdfDocument } from "./fitness-card-pdf";

export type FitnessRenderProgress = (stage: string, percent: number) => void;

/**
 * Rendert eine einzelne Fitness-Card als A4 PDF-Buffer.
 *
 * Im Gegensatz zur Recipe-Pipeline (lib/pdf/render.ts renderRecipePdf):
 *   - Kein 5-stufiges Fallback-System fuer 1-Page-Fit. Die Studio-Performance-
 *     Layout-Spec ist statisch dimensioniert (Content-Spalte hat fixe Breite,
 *     6 Cues + 3 Mistakes als Max). Bei Bedarf kommt der Fallback spaeter.
 *   - Hero kann null sein — Layout hat Empty-State.
 *   - QR optional.
 *
 * Pack-PDF (Cover + alle Cards + Outro) kommt in einem spaeteren Schritt
 * wenn der Pilot mit Simon laeuft.
 */
export async function renderFitnessCardPdf(args: {
  brand: Brand;
  pack: Pack;
  card: FitnessCard;
  totalCards: number;
  onProgress?: FitnessRenderProgress;
}): Promise<Buffer> {
  ensureFontsRegistered();

  args.onProgress?.("loading-image", 15);
  // loadImageAsDataUri erwartet string — bei Karten ohne Hero (Layout
  // hat Empty-State) ueberspringen wir den Load.
  const [heroDataUri, qrDataUri] = await Promise.all([
    args.card.hero ? loadImageAsDataUri(args.card.hero) : Promise.resolve(null),
    generateQrDataUri(args.card.sourceUrl),
  ]);

  args.onProgress?.("rendering", 55);
  const buf = await renderToBuffer(
    FitnessCardPdfDocument({
      brand: args.brand,
      pack: args.pack,
      card: args.card,
      totalCards: args.totalCards,
      heroDataUri,
      qrDataUri,
    })
  );

  args.onProgress?.("done", 100);
  return buf;
}
