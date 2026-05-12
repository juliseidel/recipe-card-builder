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

// Manueller Retry-Endpoint fuer den Reel-Backfill. Wird vom Library-
// Status-Banner aufgerufen, wenn:
//   - status='failed' → User klickt "Erneut versuchen"
//   - status='running' seit >5 Min → User klickt "Neu starten"
//
// Was passiert:
//   1. Aktuelle laufende Scrape-Row (falls eine existiert) wird auf
//      'failed' gemarkt (Apify-Run lassen wir einfach laufen, der Webhook
//      findet bei nicht-mehr-existenter Row "unknown-run" und ignoriert)
//   2. Frischer createScrape + Apify-Run mit gleicher Plattform
//   3. Frontend pollt weiter — Self-Healing in library-status-route
//      kuemmert sich um Recovery, falls Webhook diesmal auch verloren geht

export const runtime = "nodejs";
export const maxDuration = 30;

type RouteParams = { params: Promise<{ slug: string }> };

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
          "Brand hat keinen Handle gesetzt. Bitte im Brand-Setup nachpflegen.",
      },
      { status: 422 }
    );
  }
  const platform: SocialPlatform = brand.platform ?? "instagram";

  // 1. Alte Row (falls hangend) als 'failed' markieren — Status-Banner
  // zeigt waehrend des Retries den neuen Scrape-Run.
  const existing = await getLatestScrapeForBrand(slug);
  if (existing && (existing.status === "running" || existing.status === "classifying")) {
    await updateScrapeStatus(existing.id, "failed", {
      error: "Manuell durch Retry abgebrochen.",
    });
  }

  // 2. Frischer Scrape-Job.
  const scrapeId = await createScrape(slug, platform);
  if (!scrapeId) {
    return NextResponse.json(
      {
        error:
          "Konnte neuen Scrape-Job nicht anlegen — vermutlich fehlt eine SQL-Migration.",
        needsSetup: true,
      },
      { status: 503 }
    );
  }

  const origin = new URL(req.url).origin;
  const webhookSecret = process.env.APIFY_WEBHOOK_SECRET;
  const webhookUrl = webhookSecret
    ? `${origin}/api/apify-webhook?secret=${encodeURIComponent(webhookSecret)}`
    : `${origin}/api/apify-webhook`;

  try {
    const { runId } =
      platform === "tiktok"
        ? await startTikTokBackfill({
            username,
            webhookUrl,
            resultsLimit: 200,
          })
        : await startReelBackfill({
            username,
            webhookUrl,
            resultsLimit: 200,
          });
    await updateScrapeRunId(scrapeId, runId);
    return NextResponse.json({
      status: "restarted",
      scrapeId,
      runId,
      platform,
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
