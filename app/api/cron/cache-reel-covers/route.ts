import { NextResponse, after } from "next/server";
import { cacheReelCovers } from "@/lib/reel-library/cache-reel-covers";

// Public-Endpoint zum Nachholen des Reel-Cover-Caching. Wird im normalen
// Backfill via processSucceededRun automatisch aufgerufen — dieser hier
// ist für:
//   1. Bestands-Brands die VOR Einführung des Caching angelegt wurden
//   2. Manuelles Re-Caching wenn URLs trotzdem expired sind
//
// Aufruf: POST /api/cron/cache-reel-covers?brand=<slug>
// Auth via /api/cron-Pattern in der Middleware-Whitelist (cookie-frei).
// Optional CRON_SECRET-Bearer-Auth.

export const runtime = "nodejs";
export const maxDuration = 60;

async function handle(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const url = new URL(req.url);
  const brandSlug = url.searchParams.get("brand");
  if (!brandSlug) {
    return NextResponse.json(
      { error: "?brand=<slug> ist erforderlich" },
      { status: 400 }
    );
  }

  after(async () => {
    try {
      const result = await cacheReelCovers({ brandSlug });
      console.log(
        `[cron/cache-reel-covers] brand=${brandSlug} result=${JSON.stringify(result)}`
      );
    } catch (err) {
      console.error(
        "[cron/cache-reel-covers] failed",
        err instanceof Error ? err.message : err
      );
    }
  });

  return NextResponse.json({
    ok: true,
    brandSlug,
    message: "Cover-Caching laeuft im Hintergrund — frische CDN-URLs aus Apify sind nur ~1-3h gueltig.",
  });
}

export async function POST(req: Request) {
  return handle(req);
}

export async function GET(req: Request) {
  return handle(req);
}
