import { NextResponse } from "next/server";
import {
  getLatestScrapeForBrand,
  countReelsForBrand,
  countRecipeReelsForBrand,
  updateScrapeStatus,
} from "@/lib/creator-reels-server";
import { getApifyRunStatus } from "@/lib/integrations/apify";

// Status-Polling-Endpoint fuer die UI. Wird vom Onboarding-Banner +
// Workspace-Banner alle ~3-5s aufgerufen, solange der Backfill laeuft.
//
// Self-Healing: wenn der Apify-Webhook nicht ankommt (Lambda-Cold-Start,
// Vercel-Outage), fragen wir Apify direkt nach dem Run-Status. Wenn der
// Run laut Apify schon laenger als 10 Min "SUCCEEDED" ist, holen wir den
// Webhook-Pfad nicht nach (zu komplex), aber markieren den Scrape als
// failed mit klarer Meldung "Webhook verpasst — bitte erneut starten".

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const { slug } = await params;
  const scrape = await getLatestScrapeForBrand(slug);

  if (!scrape) {
    return NextResponse.json({ status: "none" });
  }

  // Recovery-Path: Scrape steht seit >10 Min auf 'running' aber kein
  // Webhook gekommen → bei Apify nachfragen.
  if (scrape.status === "running" && scrape.apify_run_id) {
    const startedMsAgo = Date.now() - new Date(scrape.started_at).getTime();
    if (startedMsAgo > 10 * 60 * 1000) {
      try {
        const apifyStatus = await getApifyRunStatus(scrape.apify_run_id);
        if (
          apifyStatus.status === "FAILED" ||
          apifyStatus.status === "TIMED-OUT" ||
          apifyStatus.status === "ABORTED"
        ) {
          await updateScrapeStatus(scrape.id, "failed", {
            error: `Apify-Run-Status: ${apifyStatus.status}`,
          });
        }
      } catch (err) {
        console.warn(
          "[library-status] Apify-Recovery-Check failed",
          err instanceof Error ? err.message : err
        );
      }
    }
  }

  const [totalReels, recipeReels] = await Promise.all([
    countReelsForBrand(slug),
    countRecipeReelsForBrand(slug),
  ]);

  return NextResponse.json({
    status: scrape.status,
    scrapeId: scrape.id,
    startedAt: scrape.started_at,
    finishedAt: scrape.finished_at,
    reelCount: totalReels,
    recipeCount: recipeReels,
    suggestionCount: scrape.suggestion_count,
    error: scrape.error,
  });
}
