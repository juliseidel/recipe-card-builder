import { NextResponse } from "next/server";
import { startReelBackfill, ApifyError } from "@/lib/integrations/apify";
import {
  createScrape,
  updateScrapeRunId,
  updateScrapeStatus,
} from "@/lib/creator-reels-server";

// Startet den 2-Jahres-Reel-Backfill fuer einen Brand. Wird vom Onboarding
// nach erfolgreichem addCustomBrand() aufgerufen — fire-and-forget vom
// Client, der User landet sofort im Workspace, der Banner zeigt den
// Fortschritt.
//
// Flow:
//   1. creator_scrapes-Row anlegen (status='running')
//   2. Apify-Run async starten mit Webhook → unser /api/apify-webhook
//   3. apify_run_id in die Scrape-Row schreiben
//   4. Sofort 202 zurueck — der Webhook macht den Rest
//
// Frontend polled danach /api/brands/[slug]/library-status alle ~3-5s.

export const runtime = "nodejs";
export const maxDuration = 30;

type Body = {
  /** Slug des Brands, fuer den der Backfill laeuft (DB-Brand, kein Code-Brand). */
  brandSlug: string;
  /** Instagram-Handle des Creators ohne @. */
  username: string;
  /** Optional: max Posts. Default 500 fuer ~2 Jahre. */
  resultsLimit?: number;
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

  // 1. Scrape-Row anlegen, damit wir eine ID haben fuer Failure-Marker.
  // Wenn das null returnt, ist mit hoher Wahrscheinlichkeit die SQL-
  // Migration (sql/creator-reels-table.sql) nicht ausgefuehrt worden.
  // Wir geben dem Frontend einen klar erkennbaren `needsSetup`-Marker,
  // damit der Banner eine konkrete Anweisung zeigen kann statt stumm
  // zu failen.
  const scrapeId = await createScrape(body.brandSlug);
  if (!scrapeId) {
    return NextResponse.json(
      {
        error:
          "Reel-Library-Tabellen fehlen in Supabase. Bitte sql/creator-reels-table.sql einmal im Supabase-SQL-Editor ausfuehren.",
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
    const { runId } = await startReelBackfill({
      username: body.username,
      webhookUrl,
      resultsLimit: body.resultsLimit ?? 500,
    });
    await updateScrapeRunId(scrapeId, runId);
    return NextResponse.json(
      { status: "started", scrapeId, runId },
      { status: 202 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateScrapeStatus(scrapeId, "failed", { error: msg });
    return NextResponse.json(
      {
        error: msg,
        stage: "apify-start",
      },
      {
        status: err instanceof ApifyError && err.status === 401 ? 500 : 422,
      }
    );
  }
}
