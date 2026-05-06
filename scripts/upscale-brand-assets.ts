// Upscaled brand cover images so PDF renders hit 300 DPI at A4 print sizes.
//
// Originals are 1179×~1570 px → ~223 DPI when placed in a 380 pt (5.28") cover
// frame. Print-ready calls for ≥300 DPI, so we resample with sharp's Lanczos3
// kernel (industry standard for upscaling) and write the result back over the
// public assets. Originals are preserved in public/brands/biene/packs/originals/
// so we can roll back if the upscale ever looks worse than the source.
//
// Run: npx tsx --tsconfig ./tsconfig.json scripts/upscale-brand-assets.ts

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const PACKS_DIR = path.join(process.cwd(), "public", "brands", "biene", "packs");
const ORIGINALS_DIR = path.join(PACKS_DIR, "originals");

// 2400 px on the long edge → at 380 pt (5.28") cover frame the effective DPI
// is 454 (well over 300). At full A4 width (210 mm = 8.27") we still hit 290.
// We don't push to 3000+ because every doubling above 2× of the source adds
// noise without adding real detail.
const TARGET_LONG_EDGE = 2400;
const JPEG_QUALITY = 90;

async function main() {
  await fs.mkdir(ORIGINALS_DIR, { recursive: true });

  const files = (await fs.readdir(PACKS_DIR)).filter((f) =>
    /^pack-\d+\.jpg$/i.test(f)
  );
  if (files.length === 0) {
    console.error("✗ No pack-N.jpg files found in", PACKS_DIR);
    process.exit(1);
  }

  console.log(`\n→ Upscaling ${files.length} pack covers to ${TARGET_LONG_EDGE}px @ 300 DPI\n`);

  for (const file of files.sort()) {
    const src = path.join(PACKS_DIR, file);
    const backup = path.join(ORIGINALS_DIR, file);

    const meta = await sharp(src).metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    if (!w || !h) {
      console.log(`  ✗ ${file}  could not read dimensions, skipping`);
      continue;
    }

    // Always preserve the source. If the backup already exists we DON'T
    // overwrite it — that backup is the single source of truth.
    try {
      await fs.access(backup);
    } catch {
      await fs.copyFile(src, backup);
    }

    // Resample from the *original* every run, not from the previously upscaled
    // result. This avoids compounding compression artefacts on re-runs.
    const longEdge = Math.max(w, h);
    if (longEdge >= TARGET_LONG_EDGE && meta.density && meta.density >= 300) {
      console.log(
        `  ↻ ${file}  already ${w}×${h} @ ${meta.density} DPI, skipping`
      );
      continue;
    }

    const ratio = TARGET_LONG_EDGE / longEdge;
    const newW = Math.round(w * ratio);
    const newH = Math.round(h * ratio);

    const buf = await sharp(backup)
      .resize(newW, newH, {
        kernel: sharp.kernel.lanczos3,
        fit: "fill",
      })
      // Modest sharpening to recover detail lost in upscaling
      .sharpen({ sigma: 0.5, m1: 0.6, m2: 0.4 })
      .withMetadata({ density: 300 })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true, progressive: true })
      .toBuffer();

    await fs.writeFile(src, buf);
    const sizeKb = (buf.length / 1024).toFixed(0);
    console.log(
      `  ✓ ${file}  ${w}×${h} → ${newW}×${newH} @ 300 DPI  (${sizeKb} KB)`
    );
  }

  console.log(`\n✓ Done. Originals are in ${path.relative(process.cwd(), ORIGINALS_DIR)}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
