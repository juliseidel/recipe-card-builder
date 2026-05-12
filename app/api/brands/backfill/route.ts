import { NextResponse } from "next/server";
import { startReelBackfill, ApifyError } from "@/lib/integrations/apify";
import { startTikTokBackfill } from "@/lib/integrations/apify-tiktok";
import {
  createScrape,
  updateScrapeRunId,
  updateScrapeStatus,
} from "@/lib/creator-reels-server";
import type { SocialPlatform } from "@/lib/integrations/platform";

// Startet den 2-Jahres-Reel-Backfill fuer einen Brand. Wird vom Onboarding
// nach erfolgreichem addCustomBrand() aufgerufen — fire-and-forget vom
// Client, der User landet sofort im Workspace, der Banner zeigt den
// Fortschritt.
//
// Plattform-aware: Body akzeptiert platform 'instagram' | 'tiktok'.
// Default 'instagram' aus Backward-Compat. Wird in creator_scrapes.platform
// persistiert, damit der Webhook-Receiver den richtigen Dataset-Parser
// + die richtige Folge-Pipeline ansprechen kann.
//
// Flow:
//   1. creator_scrapes-Row anlegen (status='running', platform=...)
//   2. Apify-Run async starten (Instagram-Actor ODER TikTok-Actor) mit
//      Webhook → unser /api/apify-webhook
//   3. apify_run_id in die Scrape-Row schreiben
//   4. Sofort 202 zurueck — der Webhook macht den Rest
//
// Frontend polled danach /api/brands/[slug]/library-status alle ~3-5s.

export const runtime = "nodejs";
export const maxDuration = 30;

type Body = {
  /** Slug des Brands, fuer den der Backfill laeuft (DB-Brand, kein Code-Brand). */
  brandSlug: string;
  /** Handle des Creators ohne @ (Instagram-Username oder TikTok-Username). */
  username: string;
  /** Optional: max Posts. Default 500 fuer ~2 Jahre. */
  resultsLimit?: number;
  /** Plattform — default 'instagram' fuer Backward-Compat. */
  platform?: SocialPlatform;
};

export async function POST(req: Request) {
  if (!process.env.APIFY_TOKEN) {
    return NextResponse.json(
      { error: "APIFY_TOKEN ist nicht gesetzt." },
      { status: 500 }
    );
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.brandSlug || !body.username) {
    return NextResponse.json(
      { error: "brandSlug und username sind erforderlich." },
      { status: 400 }
    );
  }

  if (
    body.platform !== undefined &&
    body.platform !== "instagram" &&
    body.platform !== "tiktok"
  ) {
    return NextResponse.json(
      { error: "platform muss 'instagram' oder 'tiktok' sein." },
      { status: 400 }
    );
  }
  const platform: SocialPlatform = body.platform ?? "instagram";

  // 1. Scrape-Row anlegen, damit wir eine ID haben fuer Failure-Marker.
  // Wenn das null returnt, ist mit hoher Wahrscheinlichkeit die SQL-
  // Migration (sql/creator-reels-table.sql + sql/platform-extension.sql)
  // nicht ausgefuehrt worden.
  const scrapeId = await createScrape(body.brandSlug, platform);
  if (!scrapeId) {
    return NextResponse.json(
      {
        error:
          "Reel-Library-Tabellen fehlen in Supabase oder die platform-Spalte ist nicht angelegt. Bitte sql/creator-reels-table.sql und sql/platform-extension.sql im Supabase-SQL-Editor ausführen.",
        needsSetup: true,
      },
      { status: 503 }
    );
  }

  // 2. Apify-Run starten. Webhook-URL aus der eingehenden Request ableiten
  // (Origin), damit es sowohl auf Vercel-Prod als auch auf Preview-URLs
  // automatisch passt. Localhost wuerde Apify natuerlich nicht erreichen
  // — fuer lokale Tests muesste man ngrok nutzen.
  //
  // APIFY_WEBHOOK_SECRET: optionaler Defense-in-Depth-Check. Wenn gesetzt,
  // bauen wir den Secret als Query-Param in die Webhook-URL ein, sodass
  // Apify ihn beim Callback mitschickt. Endpoint validiert das.
  const origin = new URL(req.url).origin;
  const webhookSecret = process.env.APIFY_WEBHOOK_SECRET;
  const webhookUrl = webhookSecret
    ? `${origin}/api/apify-webhook?secret=${encodeURIComponent(webhookSecret)}`
    : `${origin}/api/apify-webhook`;

  try {
    // Route zum richtigen Apify-Actor je nach Plattform. Beide setzen
    // Webhook auf den gleichen Endpoint; der Webhook liest die Plattform
    // aus creator_scrapes.platform (NICHT aus dem Webhook-Payload — Apify
    // hat keinen Custom-Metadata-Channel im Webhook-Body).
    const { runId } =
      platform === "tiktok"
        ? await startTikTokBackfill({
            username: body.username,
            webhookUrl,
            resultsLimit: body.resultsLimit ?? 500,
          })
        : await startReelBackfill({
            username: body.username,
            webhookUrl,
            resultsLimit: body.resultsLimit ?? 500,
          });
    await updateScrapeRunId(scrapeId, runId);
    return NextResponse.json(
      { status: "started", scrapeId, runId, platform },
      { status: 202 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateScrapeStatus(scrapeId, "failed", { error: msg });
    return NextResponse.json(
      {
        error: msg,
        stage: "apify-start",
        platform,
      },
      {
        status: err instanceof ApifyError && err.status === 401 ? 500 : 422,
      }
    );
  }
}
