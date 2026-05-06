import path from "node:path";
import fs from "node:fs/promises";

// react-pdf's <Image> accepts a Buffer, but it works most reliably with a
// data-URI string. Read once per render and inline.
const cache = new Map<string, string>();

export async function loadImageAsDataUri(
  publicPath: string
): Promise<string | null> {
  // Strip leading slash, resolve from /public
  const clean = publicPath.replace(/^\//, "");
  if (cache.has(clean)) return cache.get(clean)!;

  const fullPath = path.join(process.cwd(), "public", clean);
  try {
    const buf = await fs.readFile(fullPath);
    const ext = path.extname(clean).toLowerCase();
    const mime =
      ext === ".png"
        ? "image/png"
        : ext === ".webp"
          ? "image/webp"
          : "image/jpeg";
    const dataUri = `data:${mime};base64,${buf.toString("base64")}`;
    cache.set(clean, dataUri);
    return dataUri;
  } catch (err) {
    console.warn("[pdf-assets] failed to load image", clean, err);
    return null;
  }
}
