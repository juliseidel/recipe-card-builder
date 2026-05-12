import { NextResponse } from "next/server";
import {
  ApifyError,
  normalizeInstagramUrl,
  scrapeInstagramPost,
  type InstagramPost,
} from "@/lib/integrations/apify";
import {
  normalizeTikTokUrl,
  scrapeTikTokPost,
} from "@/lib/integrations/apify-tiktok";
import { detectPlatformFromUrl } from "@/lib/integrations/platform";
import { parseRecipeFromCaption } from "@/lib/ai/parse-instagram";

// Recipe-Import via Social-Media-Link. Frueher Instagram-only — seit
// Mai 2026 erkennt der Endpoint auch TikTok-Links und routet automatisch
// zum passenden Apify-Actor.
//
// Route-Name bleibt /import-instagram aus Backward-Compat-Gruenden;
// semantisch ist es "import-social".
//
// Beide Calls (Apify + Gemini) sind I/O-bound, brauchen aber Node.js.
export const runtime = "nodejs";
// Apify (synchron) + Gemini (Schema-Parsing) zusammen: typischerweise 8-25 s,
// im Worst Case bis ~40 s. 60 s gibt uns Puffer für Vercel-Lambda.
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const rawUrl = body?.url;
  if (!rawUrl || typeof rawUrl !== "string") {
    return NextResponse.json(
      { error: "Bitte schick eine 'url' im Body mit." },
      { status: 400 }
    );
  }

  // ─── Plattform-Detection aus URL ─────────────────────────────────────────
  // Auto-Detection statt Tab-Switch: User wirft Link rein, wir routen.
  const platform = detectPlatformFromUrl(rawUrl);
  if (!platform) {
    return NextResponse.json(
      {
        error:
          "Das ist keine gueltige Instagram- oder TikTok-URL. Erwartet: instagram.com/p/... · instagram.com/reel/... · tiktok.com/@user/video/...",
      },
      { status: 400 }
    );
  }

  const normalized =
    platform === "tiktok"
      ? normalizeTikTokUrl(rawUrl)
      : normalizeInstagramUrl(rawUrl);
  if (!normalized) {
    return NextResponse.json(
      {
        error:
          platform === "tiktok"
            ? "Die TikTok-URL hat ein unbekanntes Format. Erwartet: tiktok.com/@user/video/... oder vm.tiktok.com/..."
            : "Die Instagram-URL hat ein unbekanntes Format. Erwartet: instagram.com/p/... oder /reel/...",
      },
      { status: 400 }
    );
  }

  // ─── 1. Post scrapen (plattform-spezifisch) ─────────────────────────────
  let post: InstagramPost;
  try {
    post =
      platform === "tiktok"
        ? await scrapeTikTokPost(normalized)
        : await scrapeInstagramPost(normalized);
  } catch (err) {
    const status =
      err instanceof ApifyError && err.status === 401
        ? 500 // Server-Config-Problem, nicht der User
        : 422;
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : `Konnte den ${platform === "tiktok" ? "TikTok" : "Instagram"}-Post nicht laden.`,
        stage: "scrape",
        platform,
      },
      { status }
    );
  }

  // ─── 2. Gemini: Caption → strukturiertes Rezept ────────────────────────
  const parsed = await parseRecipeFromCaption(post.caption, {
    username: post.ownerUsername,
  });

  if (!parsed.ok) {
    return NextResponse.json(
      {
        error: parsed.error,
        stage: "parse",
        platform,
        // Wir geben die Caption + Source-Info trotzdem zurück, damit das UI
        // dem User wenigstens Bild + Link anbieten kann statt komplett leer.
        source: {
          url: post.postUrl,
          username: post.ownerUsername,
          imageUrl: post.displayUrl,
          captionPreview: post.caption.slice(0, 280),
        },
      },
      { status: 422 }
    );
  }

  return NextResponse.json({
    ok: true,
    platform,
    recipe: parsed.recipe,
    // Hinweis aus dem Konsistenz-Pass — z. B. "1 unbenutzte Zutat entfernt
    // (MORE Zerup)." — null wenn nichts korrigiert werden musste.
    reconciliation: parsed.reconciliation,
    source: {
      url: post.postUrl,
      username: post.ownerUsername,
      imageUrl: post.displayUrl,
      type: post.type,
    },
  });
}
