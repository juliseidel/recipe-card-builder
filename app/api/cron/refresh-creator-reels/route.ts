import { NextResponse } from "next/server";
import { getServerSupabase, hasServerSupabase } from "@/lib/supabase-server";
import { startReelBackfill } from "@/lib/integrations/apify";
import {
  createScrape,
  updateScrapeRunId,
  updateScrapeStatus,
} from "@/lib/creator-reels-server";
import type { Brand } from "@/lib/brands";

// Daily-Refresh-Cron. Vercel feuert das alle 24h (siehe vercel.json),
// dann scrapen wir fuer jeden DB-Brand die neuesten ~50 Posts der letzten
// 30 Tage. Existing Apify-Webhook-Pipeline uebernimmt Dedup + Klassifikation
// + Suggestions-Regen — der Refresh nutzt sie 1:1 wieder.
//
// Authentifizierung: Vercel setzt automatisch den Header
// `authorization: Bearer <CRON_SECRET>`, wenn `CRON_SECRET` env-var
// gesetzt ist. Im Free-Tier ohne Secret laesst Vercel den Cron nur
// gegen Vercel-IP-Adressen zu. Wir checken den Authorization-Header
// explizit als Defense-in-Depth.

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  // Auth-Check: nur Vercel-Cron darf das aufrufen.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  if (!hasServerSupabase()) {
    return NextResponse.json(
      { error: "Supabase nicht konfiguriert" },
      { status: 500 }
    );
  }
  if (!process.env.APIFY_TOKEN) {
    return NextResponse.json(
      { error: "APIFY_TOKEN nicht gesetzt" },
      { status: 500 }
    );
  }

  const supabase = getServerSupabase();
  const { data: rows, error } = await supabase
    .from("brands")
    .select("slug, data");
  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  const origin = new URL(req.url).origin;
  const webhookUrl = `${origin}/api/apify-webhook`;

  const results: Array<{
    brandSlug: string;
    status: "started" | "skipped" | "failed";
    runId?: string;
    error?: string;
  }> = [];

  for (const row of rows ?? []) {
    const brand = row.data as Brand;
    const handle = brand.handle?.replace(/^@+/, "").trim();
    if (!handle || handle === "creator") {
      results.push({ brandSlug: brand.slug, status: "skipped" });
      continue;
    }

    const scrapeId = await createScrape(brand.slug);
    if (!scrapeId) {
      results.push({
        brandSlug: brand.slug,
        status: "failed",
        error: "createScrape returned null",
      });
      continue;
    }

    try {
      const { runId } = await startReelBackfill({
        username: handle,
        webhookUrl,
        resultsLimit: 50,
        onlyPostsNewerThanDays: 30,
      });
      await updateScrapeRunId(scrapeId, runId);
      results.push({ brandSlug: brand.slug, status: "started", runId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await updateScrapeStatus(scrapeId, "failed", { error: msg });
      results.push({ brandSlug: brand.slug, status: "failed", error: msg });
    }
  }

  return NextResponse.json({
    ranAt: new Date().toISOString(),
    brandCount: rows?.length ?? 0,
    results,
  });
}
