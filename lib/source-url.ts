// Pure URL-helpers — used by both the server (PDF render pipeline) and
// the client (editor). Kept separate from `lib/pdf/qr.ts` so the client
// bundle doesn't pull in the `qrcode` server dependency just to read a
// label out of a hostname.

// Derives a short German label from the URL's host. The label is shown
// next to the QR strip in the recipe-card footer ("Reel scannen", "TikTok
// scannen") and as a subtle text-only credit when no QR is rendered.
// Returns "Original ansehen" for hosts we don't recognise.
export function sourceLabelForUrl(url: string | undefined | null): string {
  if (!url) return "Original ansehen";
  try {
    const host = new URL(url).host.toLowerCase().replace(/^www\./, "");
    if (host.includes("instagram.com")) return "Original-Reel";
    if (host.includes("tiktok.com")) return "TikTok-Video";
    if (host.includes("youtube.com") || host.includes("youtu.be"))
      return "YouTube-Video";
    if (host.includes("pinterest")) return "Pinterest-Pin";
    return "Original-Link";
  } catch {
    return "Original-Link";
  }
}

// Lightweight URL validation for editor inputs. We only require an http(s)
// scheme and a host with a dot — enough to catch obvious typos without
// being so strict that it refuses tiktok.com/@user style links.
export function isLikelyUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    const u = new URL(trimmed);
    return (
      (u.protocol === "https:" || u.protocol === "http:") &&
      u.host.includes(".")
    );
  } catch {
    return false;
  }
}
