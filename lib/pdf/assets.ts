import path from "node:path";
import fs from "node:fs/promises";

// react-pdf's <Image> accepts a Buffer, but it works most reliably with a
// data-URI string. Read once per render and inline.
//
// Two source types are supported:
//   - Local public paths ("/brands/biene/heroes/foo.jpg") — read from disk.
//     Used by the 37 static recipes (committed images in the repo).
//   - External HTTP(S) URLs ("https://xxx.supabase.co/storage/...") —
//     fetched. Used by custom recipes whose heroes are uploaded by the
//     enrich endpoint to Supabase Storage.
const cache = new Map<string, string>();

function mimeFromExt(ext: string): string {
  const e = ext.toLowerCase().replace(/^\./, "");
  if (e === "png") return "image/png";
  if (e === "webp") return "image/webp";
  return "image/jpeg";
}

export async function loadImageAsDataUri(
  pathOrUrl: string
): Promise<string | null> {
  if (cache.has(pathOrUrl)) return cache.get(pathOrUrl)!;

  // External URL — fetch it. Custom-recipe heroes live in Supabase Storage
  // and won't exist on disk in the Vercel build output.
  if (/^https?:\/\//i.test(pathOrUrl)) {
    try {
      const res = await fetch(pathOrUrl);
      if (!res.ok) {
        console.warn(
          "[pdf-assets] external image fetch failed",
          pathOrUrl,
          res.status
        );
        return null;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      // Pull the extension from the URL path, ignoring any query string.
      const extMatch = pathOrUrl.match(/\.(jpe?g|png|webp)(?:[?#]|$)/i);
      const mime = mimeFromExt(extMatch?.[1] ?? "jpeg");
      const dataUri = `data:${mime};base64,${buf.toString("base64")}`;
      cache.set(pathOrUrl, dataUri);
      return dataUri;
    } catch (err) {
      console.warn(
        "[pdf-assets] external image fetch threw",
        pathOrUrl,
        err
      );
      return null;
    }
  }

  // Local public path — strip leading slash, resolve from /public
  const clean = pathOrUrl.replace(/^\//, "");
  const fullPath = path.join(process.cwd(), "public", clean);
  try {
    const buf = await fs.readFile(fullPath);
    const dataUri = `data:${mimeFromExt(path.extname(clean))};base64,${buf.toString("base64")}`;
    cache.set(pathOrUrl, dataUri);
    return dataUri;
  } catch (err) {
    console.warn("[pdf-assets] failed to load image", clean, err);
    return null;
  }
}
