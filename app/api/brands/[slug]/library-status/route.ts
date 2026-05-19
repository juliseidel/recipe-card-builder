import { NextResponse, after } from "next/server";
import {
  getLatestScrapeForBrand,
  countReelsForBrand,
  countRecipeReelsForBrand,
  countClassifiedReelsForBrand,
  getLatestClassifiedAt,
  getSuggestionsForBrand,
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
// Fuenf Healing-Branches:
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
//   4. status='classifying' + ALLE Reels klassifiziert + 0 pending
//      Suggestions + letzte Klassifikation >60s her → Suggester-Phase
//      ist nicht durchgelaufen (Lambda-Timeout im after() von Schritt 2
//      in runClassificationAndSuggestions, oder Gemini-Hang). Resume
//      triggert die ganze Pipeline neu — Schritt 1 ist no-op weil alle
//      Reels schon classified_at!=null haben, Schritt 2 generiert die
//      Suggestions, Schritt 3 setzt status='done'. Ohne diesen Branch
//      bleibt der Scrape fuer immer auf 'classifying' haengen (siehe
//      Kristina-Incident 2026-05-19).
//   5. RUNNING → weiter warten

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

  // ─── Healing-Branch 3+4: status='classifying' resume ─────────────────
  // Branch 3: Klassifikation noch nicht durch + stale → Pipeline neu
  //           anstossen, naechster Poll sieht weiteren Fortschritt.
  // Branch 4: Klassifikation 100% durch, aber Status haengt noch auf
  //           'classifying' weil der Suggester-Schritt (Schritt 2 in
  //           runClassificationAndSuggestions) nicht durchgelaufen ist
  //           → Pipeline neu anstossen. Schritt 1 wird no-op (alle
  //           classified_at!=null), Schritt 2 generiert die Suggestions,
  //           Schritt 3 setzt status='done'.
  //
  // Race-Eigenschaft: zwei parallele Polls innerhalb des Stale-Windows
  // koennten beide den Resume triggern. Im Worst-Case laeuft suggestPacks
  // doppelt (~$0.05 extra Gemini-Costs), aber clearPendingSuggestions +
  // insertSuggestions stellen sicher dass nicht beide Resultate
  // dupliziert in der DB landen — am Ende gewinnt eins, kein Datenschaden.
  if (scrape.status === "classifying") {
    const totalReels = await countReelsForBrand(slug);
    const classified = await countClassifiedReelsForBrand(slug);
    const latest = await getLatestClassifiedAt(slug);
    const lastMs = latest ? new Date(latest).getTime() : 0;
    const ageSec = lastMs ? (Date.now() - lastMs) / 1000 : Infinity;

    const isClassifyStale = classified < totalReels && ageSec > 45;
    // Branch 4: Suggester haengt. Hoeherer Threshold (90s) weil der
    // Suggester selbst 30-60s laufen darf — bei <90s noch im normalen
    // Fenster, kein Resume noetig.
    const hasAnyPending =
      classified === totalReels && classified > 0
        ? (await getSuggestionsForBrand(slug, "pending")).length > 0
        : true; // bei Schritt-3-Branch nicht relevant
    const isSuggesterStuck =
      classified === totalReels &&
      classified > 0 &&
      !hasAnyPending &&
      ageSec > 90;

    if (isClassifyStale || isSuggesterStuck) {
      const reason = isClassifyStale
        ? `classify-stale (${classified}/${totalReels} done, last ${Math.round(ageSec)}s ago)`
        : `suggester-stuck (all ${totalReels} classified, 0 pending suggestions, last classified ${Math.round(ageSec)}s ago)`;
      console.log(
        `[library-status] resuming pipeline for brand=${slug}: ${reason}`
      );
      after(async () => {
        try {
          await runClassificationAndSuggestions({
            scrapeId: scrape.id,
            brandSlug: scrape.brand_slug,
          });
        } catch (err) {
          console.error(
            "[library-status] pipeline resume failed",
            err
          );
        }
      });
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
