import { NextResponse } from "next/server";
import { startReelBackfill, ApifyError } from "@/lib/integrations/apify";
import { startTikTokBackfill } from "@/lib/integrations/apify-tiktok";
import {
  createScrape,
  getLatestScrapeForBrand,
  updateScrapeRunId,
  updateScrapeStatus,
} from "@/lib/creator-reels-server";
import { loadBrand } from "@/lib/custom-brands-server";
import type { SocialPlatform } from "@/lib/integrations/platform";

// Manueller Refresh-Endpoint fuer die Reel-Library. User-getriggert vom
// "Reel-Library aktualisieren"-Button auf der Brand-Seite.
//
// Unterschied zu /retry-backfill:
//   - Limit kleiner (80 Posts statt 200) — wir wollen Delta, nicht Re-Backfill
//   - Time-Range begrenzt (60 Tage) — alles davor ist schon in der Library
//   - Bricht KEINE existing 'done'-Scrapes ab (kein Status-Reset)
//   - Verhindert Doppel-Start wenn schon 'running'/'classifying' laeuft
//
// Pipeline (identisch zum Onboarding-Backfill, voll wiederverwendet):
//   1. createScrape → DB-Row mit status='running'
//   2. startReelBackfill / startTikTokBackfill → async Apify-Run mit Webhook
//   3. Apify-Webhook (/api/apify-webhook) → processSucceededRun
//      → upsertReels (ON CONFLICT ig_id DO NOTHING, also Dedup automatisch)
//      → runClassificationAndSuggestions (Gemini-Klassifikation, neue Pack-
//         Vorschlaege, Cover-Caching)
//   4. Frontend pollt /api/brands/[slug]/library-status fuer Fortschritt.
//      Bei Webhook-Loss greift Self-Healing in der Status-Route.

export const runtime = "nodejs";
export const maxDuration = 30;

type RouteParams = { params: Promise<{ slug: string }> };

// Wenn der letzte Refresh innerhalb dieses Fensters lief, ueberspringen
// wir — kein doppeltes Apify-Run-Trigger fuer denselben Brand. User-
// Friendly-Fehler erklaert wann naechste Aktualisierung sinnvoll ist.
const MIN_REFRESH_INTERVAL_MIN = 5;

export async function POST(req: Request, { params }: RouteParams) {
  const { slug } = await params;

  if (!process.env.APIFY_TOKEN) {
    return NextResponse.json(
      { error: "APIFY_TOKEN ist nicht gesetzt." },
      { status: 500 }
    );
  }

  const brand = await loadBrand(slug);
  if (!brand) {
    return NextResponse.json(
      { error: "Brand nicht gefunden." },
      { status: 404 }
    );
  }
  const username = brand.handle?.replace(/^@+/, "").trim();
  if (!username || username === "creator") {
    return NextResponse.json(
      {
        error:
          "Dieser Brand hat keinen Social-Handle hinterlegt. Bitte zuerst im Brand-Setup nachpflegen.",
      },
      { status: 422 }
    );
  }
  const platform: SocialPlatform = brand.platform ?? "instagram";

  // 1. Lock-Check: schon ein Scrape am Laufen?
  const existing = await getLatestScrapeForBrand(slug);
  if (
    existing &&
    (existing.status === "running" || existing.status === "classifying")
  ) {
    return NextResponse.json(
      {
        error:
          "Es laeuft bereits eine Aktualisierung. Bitte warte, bis sie fertig ist.",
        existingScrapeId: existing.id,
        existingStatus: existing.status,
      },
      { status: 409 }
    );
  }

  // 2. Throttle: wenn letzter erfolgreicher Refresh < MIN_REFRESH_INTERVAL_MIN
  // her ist, ablehnen mit Hinweis. Verhindert versehentliches Re-Klicken
  // sowie Apify-Cost-Explosion.
  if (existing && existing.status === "done" && existing.finished_at) {
    const finishedMs = new Date(existing.finished_at).getTime();
    const ageMin = (Date.now() - finishedMs) / 60_000;
    if (ageMin < MIN_REFRESH_INTERVAL_MIN) {
      const waitMin = Math.ceil(MIN_REFRESH_INTERVAL_MIN - ageMin);
      return NextResponse.json(
        {
          error: `Letzte Aktualisierung ist erst ${Math.round(ageMin)} Min her. Bitte ${waitMin} Min warten.`,
          throttled: true,
        },
        { status: 429 }
      );
    }
  }

  // 3. Frischer Scrape-Job in der DB.
  const scrapeId = await createScrape(slug, platform);
  if (!scrapeId) {
    return NextResponse.json(
      {
        error:
          "Konnte neuen Scrape-Job nicht anlegen — vermutlich fehlt eine SQL-Migration (sql/creator-reels-table.sql).",
        needsSetup: true,
      },
      { status: 503 }
    );
  }

  // 4. Webhook-URL aus dem Request-Origin ableiten — gleicher Pattern
  // wie retry-backfill und cron. Funktioniert in Production, Preview-
  // Deployments und sogar lokal mit Tunnel ohne extra env-Setup. Bei
  // Webhook-Loss greift Self-Healing in /api/brands/[slug]/library-status.
  const origin = new URL(req.url).origin;
  const webhookSecret = process.env.APIFY_WEBHOOK_SECRET;
  const webhookUrl = webhookSecret
    ? `${origin}/api/apify-webhook?secret=${encodeURIComponent(webhookSecret)}`
    : `${origin}/api/apify-webhook`;

  // 5. Async Apify-Run starten. Delta-Parameter: 80 Posts max, letzte 60
  // Tage. Reicht selbst fuer sehr aktive Creator (>1 Post/Tag), kostet
  // ~1/3 eines Full-Backfills. Dedup macht upsertReels automatisch.
  try {
    const { runId } =
      platform === "tiktok"
        ? await startTikTokBackfill({
            username,
            webhookUrl,
            resultsLimit: 80,
            onlyPostsNewerThanDays: 60,
          })
        : await startReelBackfill({
            username,
            webhookUrl,
            resultsLimit: 80,
            onlyPostsNewerThanDays: 60,
          });
    await updateScrapeRunId(scrapeId, runId);
    return NextResponse.json({
      status: "started",
      scrapeId,
      runId,
      platform,
      message:
        "Aktualisierung laeuft. Neue Reels werden klassifiziert, neue Pack-Vorschlaege generiert.",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateScrapeStatus(scrapeId, "failed", { error: msg });
    return NextResponse.json(
      { error: msg, stage: "apify-start", platform },
      {
        status: err instanceof ApifyError && err.status === 401 ? 500 : 422,
      }
    );
  }
}
