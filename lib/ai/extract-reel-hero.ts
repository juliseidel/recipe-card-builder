import sharp from "sharp";
import {
  normalizeInstagramUrl,
  scrapeInstagramPost,
} from "@/lib/integrations/apify";

// Ingo-Feedback Phase 3: "Die Bilder vom Reel matchen nicht mit den Bildern
// vom Rezept." Vorher hat Flux 2 Pro nach Brand-DNA-Prompt ein neues Bild
// gerendert — sah huebsch aus, aber nicht wie das echte Reel. Jetzt: wir
// nehmen direkt den Reel-Cover-Frame (displayUrl von Apify) als Hero,
// croppen ihn auf 1024×1024 und legen ihn als JPEG im Supabase-Storage ab.
//
// Vorteile:
//   - exakt was im Reel zu sehen ist (Frozen Coconut Cups bleiben Cups)
//   - keine Generierungs-Kosten (Apify reicht)
//   - schneller als Flux (~2 s vs. ~45-90 s)
//
// Limit:
//   - Reel-Cover ist meist 9:16 Portrait. Wir nutzen sharp's smart-crop
//     ("attention"-Strategie, basiert auf Sobel-Energie) auf 1024×1024 —
//     so landet das Essen i. d. R. zentriert. Bei Talking-Head-Frames
//     landet stattdessen das Gesicht zentriert; das ist nicht ideal,
//     aber besser als ein generiertes Bild, das nichts mit dem Reel zu
//     tun hat. Operator kann den Re-Roll-Button (Phase 2) druecken
//     um auf die Flux-Pipeline zurueckzufallen.

export type ReelHeroBuffer = {
  /** Quell-URL vom Apify-Cover (zur Provenance / Debugging). */
  sourceImageUrl: string;
  /** 1024×1024 JPEG-Buffer, bereit fuer Supabase-Upload. */
  buffer: Buffer;
};

const TARGET_SIZE = 1024;
const JPEG_QUALITY = 88;

/**
 * Aus einer Instagram-URL den Reel-Cover-Frame holen, auf 1024×1024 croppen
 * und als JPEG-Buffer zurueckgeben. Returnt null, wenn der Scraper keinen
 * displayUrl liefert (z. B. privater Post). Throws bei Netzwerk-/Apify-Fehlern.
 */
export async function extractReelHeroFromInstagram(
  instagramUrl: string
): Promise<ReelHeroBuffer | null> {
  const normalized = normalizeInstagramUrl(instagramUrl);
  if (!normalized) {
    throw new Error(`Keine gueltige Instagram-URL: ${instagramUrl}`);
  }

  const post = await scrapeInstagramPost(normalized);
  if (!post.displayUrl) {
    return null;
  }

  const buffer = await fetchAndCropImage(post.displayUrl);
  return { sourceImageUrl: post.displayUrl, buffer };
}

/**
 * Variante fuer Fälle, wo displayUrl schon bekannt ist (z. B. aus dem
 * /api/recipes/import-instagram Flow) und wir nicht nochmal scrapen wollen.
 */
export async function cropDisplayUrlToHero(
  displayUrl: string
): Promise<ReelHeroBuffer> {
  const buffer = await fetchAndCropImage(displayUrl);
  return { sourceImageUrl: displayUrl, buffer };
}

async function fetchAndCropImage(imageUrl: string): Promise<Buffer> {
  const res = await fetch(imageUrl, {
    headers: {
      // Instagram CDN ist freundlich gegenueber normalen Browser-UAs.
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    },
  });
  if (!res.ok) {
    throw new Error(
      `Bild konnte nicht geladen werden: HTTP ${res.status} ${res.statusText}`
    );
  }
  const arrayBuffer = await res.arrayBuffer();
  const input = Buffer.from(arrayBuffer);

  // sharp's attention-Crop ist energie-basiert (Sobel) und findet den
  // dichtesten Bildausschnitt — bei Food-Photos i. d. R. das Essen.
  return await sharp(input)
    .resize(TARGET_SIZE, TARGET_SIZE, {
      fit: "cover",
      position: sharp.strategy.attention,
    })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
}
