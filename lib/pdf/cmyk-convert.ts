// Post-process step that turns the @react-pdf RGB output into a CMYK PDF
// suitable for offset / inkjet print. We shell out to Ghostscript because
// react-pdf has no CMYK path of its own and writing a colour-managed PDF
// converter from scratch is not on the table.
//
// Output is "DeviceCMYK with embedded ICC output intent" — the colour-
// managed standard for German print houses. Works with the bundled
// default_cmyk.icc; swap to FOGRA39 / ISOcoated_v2 once you have the
// licensed profile.

import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs/promises";
import { PDFDocument } from "pdf-lib";

export type CmykConvertOptions = {
  /** Path to the source RGB PDF */
  inputPath: string;
  /** Where to write the CMYK result */
  outputPath: string;
  /** Output ICC profile (CMYK). Defaults to the bundled generic CMYK. */
  outputIccProfile?: string;
  /** Source ICC profile (RGB). Defaults to the bundled sRGB. */
  sourceRgbProfile?: string;
  /** Target image resolution. Ghostscript will downsample (never up) anything
   *  above this. Default 300 — print standard. */
  imageDpi?: number;
  /** Optional document metadata to re-write after gs runs. Ghostscript
   *  occasionally garbles UTF-16-encoded title/author strings; setting these
   *  lets us restore them with pdf-lib so PDF readers display them correctly. */
  metadata?: {
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string;
    creator?: string;
    producer?: string;
  };
};

const DEFAULT_OUTPUT_ICC = path.join(
  process.cwd(),
  "lib",
  "pdf",
  "icc",
  "default_cmyk.icc"
);
const DEFAULT_SOURCE_ICC = path.join(
  process.cwd(),
  "lib",
  "pdf",
  "icc",
  "srgb.icc"
);

export async function convertPdfToCmyk(
  opts: CmykConvertOptions
): Promise<{ ok: true; sizeBytes: number } | { ok: false; error: string }> {
  const outputIcc = opts.outputIccProfile ?? DEFAULT_OUTPUT_ICC;
  const sourceIcc = opts.sourceRgbProfile ?? DEFAULT_SOURCE_ICC;
  const dpi = opts.imageDpi ?? 300;

  // Sanity check: ICC profiles must exist before we hand them to Ghostscript,
  // otherwise gs silently falls back to its built-ins and the resulting PDF
  // is RGB despite the flags.
  for (const p of [outputIcc, sourceIcc]) {
    try {
      await fs.access(p);
    } catch {
      return {
        ok: false,
        error: `ICC profile not found: ${p}`,
      };
    }
  }

  await fs.mkdir(path.dirname(opts.outputPath), { recursive: true });

  // Ghostscript flags are fragile — order matters and a typo silently no-ops.
  // The full command line, annotated:
  const args: string[] = [
    "-dBATCH",
    "-dNOPAUSE",
    "-dQUIET",
    // SAFER blocks reads of our ICC profile in gs 10.x (which has SAFER on by
    // default). NOSAFER lifts the sandbox; that's safe here because we control
    // every input path — no user-supplied filenames hit gs.
    "-dNOSAFER",
    "-sDEVICE=pdfwrite",
    "-dCompatibilityLevel=1.7",
    // Use the high-quality print preset, then override the bits we care about
    "-dPDFSETTINGS=/printer",
    // Force the entire pipeline to think in CMYK
    "-sProcessColorModel=DeviceCMYK",
    "-sColorConversionStrategy=CMYK",
    "-sColorConversionStrategyForImages=CMYK",
    // Tell gs which ICC profiles to use for the conversion
    `-sOutputICCProfile=${outputIcc}`,
    `-sDefaultRGBProfile=${sourceIcc}`,
    // Keep all glyphs accurate (and embedded) on print
    "-dEmbedAllFonts=true",
    "-dSubsetFonts=true",
    "-dPrinted=true",
    // Image handling — preserve resolution at print quality
    "-dColorImageResolution=" + dpi,
    "-dGrayImageResolution=" + dpi,
    "-dMonoImageResolution=" + dpi * 4, // monochrome (line-art) is sharper
    "-dColorImageDownsampleType=/Bicubic",
    "-dGrayImageDownsampleType=/Bicubic",
    "-dDownsampleColorImages=false", // never downsample below source DPI
    "-dDownsampleGrayImages=false",
    "-dAutoFilterColorImages=false",
    "-dAutoFilterGrayImages=false",
    "-dColorImageFilter=/DCTEncode", // JPEG (smaller files, perceptually fine)
    "-dGrayImageFilter=/DCTEncode",
    `-sOutputFile=${opts.outputPath}`,
    opts.inputPath,
  ];

  return new Promise((resolve) => {
    const proc = spawn("gs", args, { stdio: ["ignore", "pipe", "pipe"] });
    const errChunks: Buffer[] = [];
    proc.stderr.on("data", (c: Buffer) => errChunks.push(c));
    proc.on("error", (err) =>
      resolve({ ok: false, error: `Ghostscript spawn failed: ${err.message}` })
    );
    proc.on("close", async (code) => {
      if (code !== 0) {
        const err = Buffer.concat(errChunks).toString("utf8");
        resolve({
          ok: false,
          error: `Ghostscript exited with ${code}: ${err.slice(0, 800)}`,
        });
        return;
      }
      try {
        if (opts.metadata) {
          await rewriteMetadata(opts.outputPath, opts.metadata);
        }
        const stat = await fs.stat(opts.outputPath);
        resolve({ ok: true, sizeBytes: stat.size });
      } catch (err) {
        resolve({
          ok: false,
          error: `Output not found after gs run: ${
            (err as Error).message
          }`,
        });
      }
    });
  });
}

// Re-write the document info dictionary in place using pdf-lib. Ghostscript's
// pdfwrite device occasionally turns UTF-16BE-encoded strings (which are
// what react-pdf emits for non-ASCII titles) into garbage when it round-trips
// through its info-dict handler. pdf-lib writes them back correctly.
async function rewriteMetadata(
  filePath: string,
  meta: NonNullable<CmykConvertOptions["metadata"]>
): Promise<void> {
  const bytes = await fs.readFile(filePath);
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
  if (meta.title !== undefined) pdf.setTitle(meta.title);
  if (meta.author !== undefined) pdf.setAuthor(meta.author);
  if (meta.subject !== undefined) pdf.setSubject(meta.subject);
  if (meta.keywords !== undefined)
    pdf.setKeywords(meta.keywords.split(/\s*,\s*/));
  if (meta.creator !== undefined) pdf.setCreator(meta.creator);
  if (meta.producer !== undefined) pdf.setProducer(meta.producer);
  const out = await pdf.save({ useObjectStreams: false });
  await fs.writeFile(filePath, out);
}
