import { after } from "next/server";
import { fetchApifyDataset } from "@/lib/integrations/apify";
import { fetchTikTokDataset } from "@/lib/integrations/apify-tiktok";
import {
  getServerSupabase,
  hasServerSupabase,
} from "@/lib/supabase-server";
import {
  countReelsForBrand,
  updateScrapeStatus,
  upsertReels,
} from "@/lib/creator-reels-server";
import { runClassificationAndSuggestions } from "./classify-and-suggest";
import { cacheReelCovers } from "./cache-reel-covers";
import type { SocialPlatform } from "@/lib/integrations/platform";

// Gemeinsamer Helper, der einen erfolgreich gelaufenen Apify-Run in die
// Reel-Library uebernimmt: Dataset laden, Reels persistieren, Status auf
// 'classifying', und im after()-Hook die KI-Klassifikation + Pack-
// Vorschlaege durchziehen.
//
// Wird von zwei Pfaden aufgerufen:
//   1. /api/apify-webhook — wenn Apify den Webhook erfolgreich an uns
//      schickt (Standard-Pfad)
//   2. /api/brands/[slug]/library-status — Self-Healing fuer den Fall,
//      dass der Webhook verloren ging (Vercel-Cold-Start, Preview-URL-
//      Authentication, Network-Hiccup). Die Status-Route polled Apify
//      bei jedem Status-Check und kann den Webhook-Pfad selbst nachholen.
//
// Lock-Mechanismus: vor dem Aufruf MUSS der Caller status='running' →
// status='classifying' atomar geupdated haben (mit WHERE status='running').
// So gewinnt nur ein Pfad das Lock, der andere sieht 'classifying' und
// laesst die Finger weg. Damit haben wir keine Doppel-Klassifikation
// wenn Webhook + Self-Healing parallel triggern.

export async function processSucceededRun(opts: {
  scrapeId: string;
  brandSlug: string;
  datasetId: string;
  platform: SocialPlatform;
}): Promise<{ inserted: number; total: number }> {
  const { scrapeId, brandSlug, datasetId, platform } = opts;

  // 1. Dataset laden (plattform-spezifisch). fetchApifyDataset =
  // Instagram-Scraper-Schema, fetchTikTokDataset = TikTok-Schema. Beide
  // liefern den shared BackfillReel-Shape.
  const reels =
    platform === "tiktok"
      ? await fetchTikTokDataset(datasetId)
      : await fetchApifyDataset(datasetId);

  // 2. Reels upserten. ON CONFLICT (brand_slug, ig_id) DO NOTHING — Re-
  // Runs duplizieren nichts, ein zweiter Lauf bleibt idempotent.
  const inserted = await upsertReels(brandSlug, reels, platform);
  const total = await countReelsForBrand(brandSlug);

  console.log(
    `[process-succeeded-run] brand=${brandSlug} platform=${platform} datasetId=${datasetId} fetched=${reels.length} inserted=${inserted} total=${total}`
  );

  // 3a. Cover-Caching im Hintergrund — Instagram/TikTok-CDN-URLs sind
  // ~1-3h gueltig, danach 403. Wir downloaden die Cover JETZT (noch
  // gueltig) und legen sie in Supabase Storage ab. Spaeter zeigt das
  // UI cover_storage_url (permanent) statt display_url (expired).
  after(async () => {
    try {
      await cacheReelCovers({ brandSlug });
    } catch (err) {
      console.error(
        "[process-succeeded-run] cache-reel-covers failed (non-fatal)",
        err
      );
    }
  });

  // 3b. Klassifikation + Vorschlaege async via after() — der Caller-
  // Endpoint kann sofort antworten, die Pipeline laeuft im Background
  // bis maxDuration der Caller-Route. Bei Library-Status-Route ist das
  // 60s, das reicht fuer Klassifikation 50-100 Reels + Pack-Vorschlaege.
  // Fuer ganz grosse Backfills (500 Reels) wird der Cron oder ein
  // erneuter Status-Poll den Rest erledigen — die while-Schleife in
  // runClassificationAndSuggestions ist robust gegen Resume.
  after(async () => {
    try {
      await runClassificationAndSuggestions({ scrapeId, brandSlug });
    } catch (err) {
      console.error(
        "[process-succeeded-run] classify-and-suggest failed",
        err
      );
      await updateScrapeStatus(scrapeId, "failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  return { inserted, total };
}

// Atomares Update von 'running' → 'classifying'. Returnt true wenn der
// Caller das Lock bekommen hat (und damit den Webhook-Pfad nachholen
// soll). Returnt false wenn die Row nicht mehr 'running' war — dann hat
// ein anderer Pfad (Webhook oder paralleler Status-Poll) das schon
// uebernommen.
export async function tryClaimScrapeProcessing(
  scrapeId: string
): Promise<boolean> {
  if (!hasServerSupabase()) return false;
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("creator_scrapes")
    .update({ status: "classifying" })
    .eq("id", scrapeId)
    .eq("status", "running")
    .select("id")
    .maybeSingle();
  if (error) {
    console.warn(
      "[process-succeeded-run] tryClaim failed:",
      error.message
    );
    return false;
  }
  return data !== null;
}
