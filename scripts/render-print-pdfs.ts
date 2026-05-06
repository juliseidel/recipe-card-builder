// Renders every Biene pack as a print-ready CMYK PDF and drops the result
// into out/print/. This is the *submission deliverable* — the live tool
// keeps shipping fast RGB PDFs because Vercel serverless has no Ghostscript,
// but for the email to Ingo we want the colour-managed, 300-DPI version.
//
// Run: npx tsx --tsconfig ./tsconfig.json scripts/render-print-pdfs.ts
//
// What this does, end to end:
//   1. Render each pack via @react-pdf/renderer            (RGB)
//   2. Pipe the result through Ghostscript with our ICC    (CMYK + embedded
//      output intent)
//   3. Verify the result actually came out CMYK            (sanity check —
//      a silent fallback to RGB would defeat the whole exercise)

import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";
import { getBrand } from "../lib/brands";
import { packs } from "../lib/packs";
import { getRecipesForPack } from "../lib/recipes";
import { renderPackPdf } from "../lib/pdf/render";
import { convertPdfToCmyk } from "../lib/pdf/cmyk-convert";

const OUT_DIR = path.join(process.cwd(), "out", "print");
const TMP_DIR = path.join(process.cwd(), "out", "tmp-rgb");

function safeFilename(input: string): string {
  return input
    .replace(/[\/\\:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

// Confirm the output PDF actually ended up in CMYK. Silently shipping an
// RGB PDF would be the worst possible failure: looks fine, prints wrong.
// We check two things: the file structure says DeviceCMYK, and there's no
// DeviceRGB ColorSpace block left over from the source.
function verifyCmyk(filePath: string): {
  cmyk: boolean;
  cmykHits: number;
  rgbHits: number;
  pages: number;
} {
  // Stream the raw PDF and count DeviceXXX colour-space declarations. We use
  // strings(1) because PDF objects can be compressed; strings finds the
  // human-readable tokens that ColorSpace dictionaries always emit.
  const cs = execSync(
    `strings "${filePath}" | grep -oE "Device(CMYK|RGB|Gray)" | sort | uniq -c`,
    { encoding: "utf8" }
  );
  const cmykHits = parseInt(
    cs.match(/(\d+)\s+DeviceCMYK/)?.[1] ?? "0",
    10
  );
  const rgbHits = parseInt(cs.match(/(\d+)\s+DeviceRGB/)?.[1] ?? "0", 10);

  // Use gs itself for an authoritative page count — works on compressed
  // streams where strings(1) misses /Type /Page. The correct invocation passes
  // the PDF as a positional argument; -sFile= silently no-ops.
  let pages = 0;
  try {
    const info = execSync(
      `gs -dQUIET -dNODISPLAY -dNOSAFER -dPDFINFO "${filePath}" 2>&1`,
      { encoding: "utf8" }
    );
    pages = parseInt(info.match(/File has (\d+) pages?/)?.[1] ?? "0", 10);
  } catch {
    /* PDFINFO is best-effort */
  }

  return {
    cmyk: cmykHits > 0 && rgbHits === 0,
    cmykHits,
    rgbHits,
    pages,
  };
}

async function main() {
  const brand = getBrand("biene");
  if (!brand) throw new Error("Brand 'biene' not found");

  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.mkdir(TMP_DIR, { recursive: true });

  console.log(
    `\n→ Rendering ${packs.length} pack PDFs · RGB → CMYK pipeline\n`
  );

  let allOk = true;

  for (const pack of packs) {
    console.log(`  Pack ${String(pack.number).padStart(2, "0")} · ${pack.title}`);
    const recipes = await getRecipesForPack(pack.slug);

    // 1. Render RGB version with the existing pipeline
    const t0 = Date.now();
    const rgbBuf = await renderPackPdf({ brand, pack, recipes });
    const rgbPath = path.join(TMP_DIR, `${pack.slug}__rgb.pdf`);
    await fs.writeFile(rgbPath, rgbBuf);
    const t1 = Date.now();
    console.log(
      `    ✓ RGB render          ${(rgbBuf.length / 1024).toFixed(0)} KB · ${t1 - t0} ms`
    );

    // 2. Convert to CMYK with embedded output intent
    const filename = `${String(pack.number).padStart(2, "0")} – ${safeFilename(
      pack.title
    )} – ${recipes.length} Rezepte von ${brand.name}.pdf`;
    const cmykPath = path.join(OUT_DIR, filename);
    const result = await convertPdfToCmyk({
      inputPath: rgbPath,
      outputPath: cmykPath,
      metadata: {
        title: `${pack.title} · ${brand.name}`,
        author: brand.fullName,
        subject: pack.tagline,
        keywords: `${brand.handle},${pack.category},Bienesfitlife,Rezepte,High-Protein`,
        creator: "Recipe Card Builder",
        producer: "Recipe Card Builder · CMYK Print Pipeline",
      },
    });
    const t2 = Date.now();
    if (!result.ok) {
      console.log(`    ✗ CMYK convert        FAILED: ${result.error}`);
      allOk = false;
      continue;
    }
    console.log(
      `    ✓ CMYK convert        ${(result.sizeBytes / 1024).toFixed(0)} KB · ${t2 - t1} ms`
    );

    // 3. Verify the result actually is CMYK — silently falling back to RGB
    //    would be the worst possible failure mode (looks fine, prints wrong)
    const verify = verifyCmyk(cmykPath);
    const expectedPages = recipes.length + 4; // cover + index + N + nutrition + outro
    const pagesOk = verify.pages === expectedPages;
    if (verify.cmyk && pagesOk) {
      console.log(
        `    ✓ CMYK verify         ${verify.cmykHits}× DeviceCMYK / ${verify.rgbHits}× DeviceRGB · ${verify.pages} Seiten`
      );
    } else {
      console.log(
        `    ✗ CMYK verify         FAILED  cmyk=${verify.cmyk}  pages=${verify.pages}/${expectedPages}  cmykHits=${verify.cmykHits}  rgbHits=${verify.rgbHits}`
      );
      allOk = false;
    }
    console.log("");
  }

  // Cleanup temp RGB files unless something failed (keep them for debugging)
  if (allOk) {
    await fs.rm(TMP_DIR, { recursive: true, force: true });
  } else {
    console.log(`  (kept temp RGB files in ${TMP_DIR} for debugging)`);
  }

  console.log(
    allOk
      ? `\n✓ All ${packs.length} packs ready in ${OUT_DIR}\n`
      : `\n❌ Some conversions failed — see logs above\n`
  );
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
