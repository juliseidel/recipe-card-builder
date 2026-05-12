import { NextResponse, after } from "next/server";
import {
  getLatestScrapeForBrand,
  countReelsForBrand,
  countRecipeReelsForBrand,
  countClassifiedReelsForBrand,
  getLatestClassifiedAt,
  updateScrapeStatus,
} from "@/lib/creator-reels-server";
import { getApifyRunStatus } from "@/lib/integrations/apify";
import {
  processSucceededRun,
  tryClaimScrapeProcessing,
} from "@/lib/reel-library/process-succeeded-run";
import { runClassificationAndSuggestions } from "@/lib/reel-library/classify-and-suggest";

// Status-Polling-Endpoint mit aggressivem Self-Healing.
//
// Vier Healing-Branches:
//
//   1. Apify SUCCEEDED + status='running' → Webhook-Pfad nachholen
//      (Dataset fetchen, Reels upserten, Klassifikation kicken)
//   2. Apify FAILED/TIMED_OUT/ABORTED + status='running' → status='failed'
//   3. status='classifying' + letzte Klassifikation >60s her UND noch
//      unklassifizierte Reels da → Klassifikations-Pipeline erneut
//      anstoßen (Lambda-Timeout-Recovery). Klassifikation laeuft mit
//      ~50 Reels/Aufruf parallel, bei 498 Reels brauchen wir 10 Aufrufe
//      = ca. 40 Sekunden Pure-Klassifikation-Zeit. Da der after()-Hook
//      nur die maxDuration der Caller-Route Headroom hat, brauchen wir
//      mehrere Polls fuer komplette Klassifikation.
//   4. RUNNING → weiter warten

export const runtime = "nodejs";
// maxDuration 60s: nach Response laufen wir noch in after() weiter um die
// Klassifikation in einem Lambda-Lifetime so weit wie moeglich zu treiben.
export const maxDuration = 60;

type RouteParams = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const { slug } = await params;
  const scrape = await getLatestScrapeForBrand(slug);

  if (!scrape) {
    return NextResponse.json({ status: "none" });
  }

  // ─── Healing-Branch 1+2: status='running' ────────────────────────────
  if (scrape.status === "running" && scrape.apify_run_id) {
    try {
      const apifyStatus = await getApifyRunStatus(scrape.apify_run_id);

      if (
        apifyStatus.status === "SUCCEEDED" &&
        apifyStatus.defaultDatasetId
      ) {
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
    } catch (err) {
      console.warn(
        "[library-status] Apify-Status-Check failed",
        err instanceof Error ? err.message : err
      );
    }
  }

  // ─── Healing-Branch 3: status='classifying' resume ───────────────────
  // Wenn Klassifikation stoppt (Lambda-Timeout im after-Hook), erkennen
  // wir das an einem stale `classified_at`. Wir triggern dann die Pipeline
  // erneut via after() — naechster Poll sieht weiteren Fortschritt.
  if (scrape.status === "classifying") {
    const totalReels = await countReelsForBrand(slug);
    const classified = await countClassifiedReelsForBrand(slug);
    if (classified < totalReels) {
      const latest = await getLatestClassifiedAt(slug);
      const lastMs = latest ? new Date(latest).getTime() : 0;
      const ageSec = lastMs ? (Date.now() - lastMs) / 1000 : Infinity;
      // >45s ohne neuen classified_at → Pipeline ist stuck. Resume.
      if (ageSec > 45) {
        console.log(
          `[library-status] resuming classification for brand=${slug} (${classified}/${totalReels} done, last classified ${Math.round(ageSec)}s ago)`
        );
        after(async () => {
          try {
            await runClassificationAndSuggestions({
              scrapeId: scrape.id,
              brandSlug: scrape.brand_slug,
            });
          } catch (err) {
            console.error(
              "[library-status] classification resume failed",
              err
            );
          }
        });
      }
    }
  }

  // Frische DB-Werte fuer die Response (kann durch Self-Healing oben
  // gerade geandert sein).
  const freshScrape = await getLatestScrapeForBrand(slug);
  const [totalReels, recipeReels, classifiedReels] = await Promise.all([
    countReelsForBrand(slug),
    countRecipeReelsForBrand(slug),
    countClassifiedReelsForBrand(slug),
  ]);

  return NextResponse.json({
    status: freshScrape?.status ?? scrape.status,
    scrapeId: freshScrape?.id ?? scrape.id,
    startedAt: freshScrape?.started_at ?? scrape.started_at,
    finishedAt: freshScrape?.finished_at ?? scrape.finished_at,
    reelCount: totalReels,
    recipeCount: recipeReels,
    classifiedCount: classifiedReels,
    suggestionCount:
      freshScrape?.suggestion_count ?? scrape.suggestion_count,
    error: freshScrape?.error ?? scrape.error,
    apifyRunId: scrape.apify_run_id,
    platform: scrape.platform ?? "instagram",
  });
}
