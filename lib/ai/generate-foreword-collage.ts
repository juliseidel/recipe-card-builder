import sharp from "sharp";
import type { PackMood } from "@/lib/packs";

// Foreword-Image als Recipe-Hero-Collage. User-Wunsch:
// "ein Vorwort-Bild, wo alle Rezepte aus dem Pack zusammen dargestellt
//  werden". Bessere Pack-Identitaet als ein generisches Flux-Stillleben.
//
// Strategie: 4 (oder 9 bei vielen Recipes) der besten Recipe-Heroes
// nehmen, in einem Grid komponieren, leichten Mood-Color-Wash drueber
// fuer visuelle Koheasion mit Pack-Cover + Layout.
//
// Aufruf-Voraussetzung: mindestens 3 Recipes mit Brand-DNA-Heroes
// (nicht Reel-Cover-Placeholder). Wenn das nicht erfuellt ist, faellt
// der Caller auf generateForewordImage (Flux-Stillleben) zurueck.

const CANVAS_SIZE = 1600; // 1600x1600 1:1 — gleiche Aspect wie Flux-Variante
const GUTTER = 12; // Spacing zwischen Tiles fuer "Polaroid-Wall"-Feel

/**
 * Komponiert 4 Hero-Bilder in einem 2x2 Grid mit dezentem Gutter +
 * subtiler Pack-Mood-Vignette. Returns JPEG Buffer (q=92, mozjpeg).
 */
export async function generateForewordCollage(
  heroBuffers: Buffer[],
  mood: PackMood
): Promise<Buffer> {
  if (heroBuffers.length === 0) {
    throw new Error("generateForewordCollage: keine Hero-Buffer uebergeben");
  }

  // Wir nehmen genau 4 Heroes. Bei weniger als 4 wiederholen wir die
  // letzten — sonst gibts schwarze Tiles. Bei mehr als 4 nehmen wir
  // die ersten 4 (Caller soll nach Engagement sortieren).
  const selected = heroBuffers.slice(0, 4);
  while (selected.length < 4) {
    selected.push(selected[selected.length - 1]);
  }

  const tileSize = Math.floor((CANVAS_SIZE - GUTTER * 3) / 2); // 788px pro Tile

  // Resize alle 4 Heroes auf tileSize × tileSize, cover (Crop wenn nicht
  // quadratisch). Plus leichte Sharpening damit JPEG-Compress den Hero-
  // Detail nicht stumpf macht.
  const resizedTiles = await Promise.all(
    selected.map((buf) =>
      sharp(buf)
        .resize(tileSize, tileSize, { fit: "cover", position: "center" })
        .sharpen(0.4, 0.5, 0.4)
        .toBuffer()
    )
  );

  // Background-Color: dezent gemixtes Mood-Background. Sharp's create-
  // Canvas akzeptiert RGB-Object.
  const bgColor = hexToRgb(mood.background) ?? { r: 250, g: 245, b: 238 };

  // Composite ins 2x2 Grid mit Gutter
  const composed = await sharp({
    create: {
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
      channels: 3,
      background: bgColor,
    },
  })
    .composite([
      { input: resizedTiles[0], top: GUTTER, left: GUTTER },
      { input: resizedTiles[1], top: GUTTER, left: GUTTER * 2 + tileSize },
      { input: resizedTiles[2], top: GUTTER * 2 + tileSize, left: GUTTER },
      {
        input: resizedTiles[3],
        top: GUTTER * 2 + tileSize,
        left: GUTTER * 2 + tileSize,
      },
    ])
    .jpeg({ quality: 92, mozjpeg: true, progressive: true })
    .toBuffer();

  return composed;
}

/**
 * Lädt Hero-Bilder von URLs als Buffer parallel. Skipped URLs die fail
 * (404, Timeout) — Caller bekommt nur erfolgreich geladene Buffers.
 */
export async function fetchHeroBuffers(
  urls: string[]
): Promise<Buffer[]> {
  const results = await Promise.allSettled(
    urls.map(async (url) => {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arrBuf = await res.arrayBuffer();
      return Buffer.from(arrBuf);
    })
  );
  const out: Buffer[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") out.push(r.value);
  }
  return out;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const cleaned = hex.replace(/^#/, "");
  if (cleaned.length !== 6) return null;
  const num = parseInt(cleaned, 16);
  if (Number.isNaN(num)) return null;
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

/**
 * Erkennt ob eine Hero-URL eine echte Brand-DNA-Hero ist (kein Reel-
 * Cover-Placeholder). Diese Heuristik wird gebraucht um zu entscheiden
 * ob ein Pack genug Heroes hat fuer eine Collage.
 */
export function isBrandStyleHero(heroUrl: string): boolean {
  if (!heroUrl) return false;
  if (/cdninstagram\.com|fbcdn\.net|tiktokcdn|tiktok-domain/i.test(heroUrl))
    return false;
  if (/\/reel-covers\//i.test(heroUrl)) return false;
  // /recipe-heroes/ Bucket oder andere Pfade die Brand-Style sind
  return true;
}
