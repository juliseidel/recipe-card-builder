import QRCode from "qrcode";

// Generates a square QR code PNG as a data URI, sized for embedding in
// the recipe-card footer of every PDF layout. We render at 256 px source
// even though the PDF places it at ~32 pt — extra pixel density keeps the
// QR scannable on print and on phone-camera capture from a screen.
//
// Error correction at level "M" (15 %) is the right balance: the QR sits
// against the white card-footer band, so we don't need the heavy "H"
// level (30 %) that's reserved for QRs printed over busy artwork.
//
// Returns null if the URL is empty/whitespace — caller renders the plain
// text-footer fallback in that case (3 of the 37 curated recipes don't
// have a sourceUrl, and faking one with the brand profile would be worse
// than just hiding the code).
export async function generateQrDataUri(
  url: string | undefined | null
): Promise<string | null> {
  if (!url || !url.trim()) return null;
  try {
    return await QRCode.toDataURL(url.trim(), {
      errorCorrectionLevel: "M",
      type: "image/png",
      margin: 0,
      width: 256,
      color: { dark: "#000000", light: "#FFFFFF" },
    });
  } catch (err) {
    console.error("[qr] generation failed for", url, err);
    return null;
  }
}

// Re-export so the PDF render-pipeline can keep importing from one place.
// The actual implementation is in lib/source-url.ts (client-safe, no
// qrcode dependency) — used by the editor too.
export { sourceLabelForUrl } from "../source-url";
