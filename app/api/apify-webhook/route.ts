import { NextResponse } from "next/server";
import { ApifyError } from "@/lib/integrations/apify";
import {
  getScrapeByRunId,
  updateScrapeStatus,
} from "@/lib/creator-reels-server";
import {
  processSucceededRun,
  tryClaimScrapeProcessing,
} from "@/lib/reel-library/process-succeeded-run";

// Apify-Webhook-Receiver. Apify ruft uns auf, sobald ein gestarteter
// Backfill-Run fertig ist (SUCCEEDED / FAILED / TIMED_OUT / ABORTED).
//
// Sicherheit:
//   Wir validieren NICHT direkt die Signatur (Apify-Webhooks haben kein
//   Standard-HMAC). Stattdessen matchen wir die apify_run_id aus dem
//   Payload gegen unsere creator_scrapes-Tabelle. Wer eine gueltige
//   Run-ID rate't, hat das Apify-System schon kompromittiert. Defense-
//   in-depth: optionaler APIFY_WEBHOOK_SECRET als ?secret=... Query-Param,
//   wenn die env-var gesetzt ist.
//
// Pipeline:
//   1. Webhook-Payload parsen, eventType + resource extrahieren
//   2. Run-ID gegen creator_scrapes matchen (sonst 404)
//   3. Bei SUCCEEDED: Apify-Dataset laden, Reels in DB upserten,
//      Klassifikation + Suggestion-Generierung async in after() starten
//   4. Bei FAILED/TIMED_OUT/ABORTED: status='failed' mit Error-Message

export const runtime = "nodejs";
// Klassifikation 500 Reels ~150s + Pack-Suggestions ~15s + Apify-Dataset-
// Fetch ~5s = ~170s worst case. Vercel-Pro max ist 300s, das passt.
export const maxDuration = 300;

type ApifyWebhookPayload = {
  eventType?: string;
  resource?: {
    id?: string;
    status?: string;
    defaultDatasetId?: string;
    statusMessage?: string;
  };
};

export async function POST(req: Request) {
  // Optionaler Secret-Check via Query-Param.
  const webhookSecret = process.env.APIFY_WEBHOOK_SECRET;
  if (webhookSecret) {
    const provided = new URL(req.url).searchParams.get("secret");
    if (provided !== webhookSecret) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  let payload: ApifyWebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const runId = payload.resource?.id;
  if (!runId) {
    return NextResponse.json(
      { error: "Payload ohne resource.id" },
      { status: 400 }
    );
  }

  const scrape = await getScrapeByRunId(runId);
  if (!scrape) {
    // Unknown Run — keine Action. 200 statt 404 sonst retried Apify endlos.
    console.warn("[apify-webhook] unknown runId, ignoring:", runId);
    return NextResponse.json({ status: "unknown-run" });
  }

  const status = (payload.resource?.status ?? payload.eventType ?? "").toUpperCase();
  const datasetId = payload.resource?.defaultDatasetId;

  // FAILED / TIMED_OUT / ABORTED → status='failed', Frontend zeigt
  // Hinweis "Reel-Library konnte nicht geladen werden, bitte erneut
  // versuchen".
  if (
    status.includes("FAILED") ||
    status.includes("TIMED_OUT") ||
    status.includes("ABORTED")
  ) {
    await updateScrapeStatus(scrape.id, "failed", {
      error: payload.resource?.statusMessage || `Apify-Run-Status: ${status}`,
    });
    return NextResponse.json({ status: "marked-failed" });
  }

  // SUCCEEDED: Dataset abrufen, Reels persistieren, Klassifikation kicken.
  // Lock via tryClaimScrapeProcessing — falls die Status-Route gerade
  // parallel Self-Healing macht (gleicher Webhook-Pfad), gewinnt nur ein
  // Caller. Der andere sieht status='classifying' und gibt 200 zurueck.
  if (status.includes("SUCCEEDED") && datasetId) {
    const platform = scrape.platform ?? "instagram";

    const claimed = await tryClaimScrapeProcessing(scrape.id);
    if (!claimed) {
      // Status war nicht mehr 'running' — andere Pipeline ist schon dran.
      return NextResponse.json({ status: "already-processing" });
    }

    try {
      const { inserted, total } = await processSucceededRun({
        scrapeId: scrape.id,
        brandSlug: scrape.brand_slug,
        datasetId,
        platform,
      });
      await updateScrapeStatus(scrape.id, "classifying", { reelCount: total });
      return NextResponse.json({ status: "processing", inserted });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await updateScrapeStatus(scrape.id, "failed", {
        error: `Dataset-Fetch: ${msg}`,
      });
      if (err instanceof ApifyError) {
        return NextResponse.json(
          { error: msg, stage: "dataset-fetch" },
          { status: 500 }
        );
      }
      throw err;
    }
  }

  // Andere eventTypes (z.B. RUN.STARTED) ignorieren — wir subscriben die
  // nicht, aber falls Apify mal eines durchschickt, geben wir 200 zurueck.
  return NextResponse.json({ status: "ignored", eventType: status });
}
