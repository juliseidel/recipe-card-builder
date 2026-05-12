import { NextResponse } from "next/server";
import {
  getLatestScrapeForBrand,
  countReelsForBrand,
  countRecipeReelsForBrand,
  updateScrapeStatus,
} from "@/lib/creator-reels-server";
import { getApifyRunStatus } from "@/lib/integrations/apify";
import {
  processSucceededRun,
  tryClaimScrapeProcessing,
} from "@/lib/reel-library/process-succeeded-run";

// Status-Polling-Endpoint mit aggressivem Self-Healing.
//
// Aufruf: Frontend pollt alle ~4s solange ein Backfill laeuft. Bei jedem
// Aufruf fragen wir aktiv bei Apify den Run-Status ab und reagieren:
//
//   - Apify SUCCEEDED + wir noch 'running' → Webhook ist verloren gegangen.
//     Wir machen den Webhook-Pfad selbst nach (atomares Lock via
//     tryClaimScrapeProcessing, dann processSucceededRun).
//   - Apify FAILED/TIMED_OUT/ABORTED + wir 'running' → status='failed'.
//   - Apify RUNNING → wir warten weiter.
//
// So funktioniert die Pipeline auch wenn der Apify-Webhook nie ankommt
// (Vercel-Cold-Start, Preview-URL-Authentication, Network-Hiccup, ...).
// Der einzige Trigger den wir wirklich brauchen ist UI-Polling.

export const runtime = "nodejs";
// 60s damit der Recovery-Pfad (Dataset-Fetch + Klassifikations-Kick-off
// im after()-Hook) genug Headroom hat. Klassifikation selbst laeuft
// weiter via after-Hook ueber die Response-Lifetime hinaus.
export const maxDuration = 60;

type RouteParams = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const { slug } = await params;
  const scrape = await getLatestScrapeForBrand(slug);

  if (!scrape) {
    return NextResponse.json({ status: "none" });
  }

  // ─── Self-Healing-Branch ────────────────────────────────────────────
  // Bei 'running' aktiv den Apify-Status abfragen — egal wie lange der
  // Run schon laeuft. Apify-Status-Call ist billig (~200ms), und wir
  // koennen den Webhook-Pfad selbst nachholen wenn noetig.
  if (scrape.status === "running" && scrape.apify_run_id) {
    try {
      const apifyStatus = await getApifyRunStatus(scrape.apify_run_id);

      if (
        apifyStatus.status === "SUCCEEDED" &&
        apifyStatus.defaultDatasetId
      ) {
        // Webhook ist nicht angekommen oder hatte einen Fehler. Wir
        // versuchen den Lock zu bekommen — gewinnt nur einer (Webhook
        // oder Status-Route). Beim Lock-Verlust nehmen wir an, der
        // Webhook ist gerade parallel dran und wir lassen ihn machen.
        const claimed = await tryClaimScrapeProcessing(scrape.id);
        if (claimed) {
          console.log(
            `[library-status] webhook-recovery for brand=${slug} runId=${scrape.apify_run_id}`
          );
          try {
            const { total } = await processSucceededRun({
              scrapeId: scrape.id,
              brandSlug: scrape.brand_slug,
              datasetId: apifyStatus.defaultDatasetId,
              platform: scrape.platform ?? "instagram",
            });
            await updateScrapeStatus(scrape.id, "classifying", {
              reelCount: total,
            });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(
              "[library-status] recovery processSucceededRun failed",
              msg
            );
            await updateScrapeStatus(scrape.id, "failed", {
              error: `Recovery-Fetch: ${msg}`,
            });
          }
        }
      } else if (
        apifyStatus.status === "FAILED" ||
        apifyStatus.status === "TIMED-OUT" ||
        apifyStatus.status === "ABORTED"
      ) {
        await updateScrapeStatus(scrape.id, "failed", {
          error: `Apify-Run-Status: ${apifyStatus.status}`,
        });
      }
      // RUNNING → keine Aktion, naechster Poll versucht's wieder.
    } catch (err) {
      // Apify-Check failed — non-fatal, nur loggen. Wir antworten mit
      // dem aktuellen DB-Status und der naechste Poll kann's nochmal
      // probieren.
      console.warn(
        "[library-status] Apify-Status-Check failed",
        err instanceof Error ? err.message : err
      );
    }
  }

  // Frische DB-Werte fuer die Response (kann durch Self-Healing oben
  // gerade geandert sein).
  const freshScrape = await getLatestScrapeForBrand(slug);
  const [totalReels, recipeReels] = await Promise.all([
    countReelsForBrand(slug),
    countRecipeReelsForBrand(slug),
  ]);

  return NextResponse.json({
    status: freshScrape?.status ?? scrape.status,
    scrapeId: freshScrape?.id ?? scrape.id,
    startedAt: freshScrape?.started_at ?? scrape.started_at,
    finishedAt: freshScrape?.finished_at ?? scrape.finished_at,
    reelCount: totalReels,
    recipeCount: recipeReels,
    suggestionCount:
      freshScrape?.suggestion_count ?? scrape.suggestion_count,
    error: freshScrape?.error ?? scrape.error,
    apifyRunId: scrape.apify_run_id,
    platform: scrape.platform ?? "instagram",
  });
}
