import { NextResponse, after } from "next/server";
import { getServerSupabase, hasServerSupabase } from "@/lib/supabase-server";
import { startReelBackfill } from "@/lib/integrations/apify";
import { startTikTokBackfill } from "@/lib/integrations/apify-tiktok";
import {
  createScrape,
  getLatestScrapeForBrand,
  getLatestPendingSuggestionAt,
  updateScrapeRunId,
  updateScrapeStatus,
} from "@/lib/creator-reels-server";
import { regenerateSuggestionsForBrand } from "@/lib/reel-library/classify-and-suggest";
import { brands as codeBrands, getCodeBrandsWithHandle, type Brand } from "@/lib/brands";
import type { SocialPlatform } from "@/lib/integrations/platform";

// Auto-Refresh-Cron. Vercel feuert das alle 4h (siehe vercel.json), wir
// scrapen pro Brand die letzten ~50 Posts der letzten 14 Tage. Dedup auf
// ig_id verhindert Duplikate; nur neue Reels landen in der Library.
// Apify-Webhook-Pipeline uebernimmt Klassifikation + Suggestions-Regen
// + Cover-Caching automatisch.
//
// Was sich vom alten Daily-Cron unterscheidet:
//   - Frequenz 24h → 4h (vercel.json)
//   - Auch Code-Brands (z.B. Biene) werden mitgescrapt — vorher nur DB-Brands
//   - Skip-Lock: Brands, deren letzte Aktualisierung < 2h alt ist, werden
//     uebersprungen. Verhindert Overlap mit manuellen Refreshes und spart
//     Apify-Credits bei sehr aktivem Cron.
//
// Authentifizierung: Vercel setzt automatisch den Header
// `authorization: Bearer <CRON_SECRET>`, wenn `CRON_SECRET` env-var
// gesetzt ist. Im Free-Tier ohne Secret laesst Vercel den Cron nur
// gegen Vercel-IP-Adressen zu. Wir checken den Authorization-Header
// explizit als Defense-in-Depth.

export const runtime = "nodejs";
export const maxDuration = 60;

// Wenn der letzte Scrape eines Brands juenger als dieses Fenster ist,
// ueberspringen wir. 2h Fenster = 30 Min Puffer auf den 4h-Cron-Takt.
const SKIP_IF_FRESHER_THAN_MIN = 120;

// Suggestion-Stale-Threshold: wenn die juengste pending-Suggestion aelter
// als das Fenster ist, regenerieren wir die Vorschlaege auch ohne neuen
// Scrape. Gemini sieht das aktuelle Datum im Prompt und passt monats-
// spezifische Packs an ("Top Reels Juni" statt Mai stehen lassen).
const SUGGESTIONS_STALE_AFTER_DAYS = 7;

// Helper: ist die Suggestion-Liste stale? Stale = aelter als X Tage ODER
// in einem anderen Kalendermonat als heute.
function isSuggestionsStale(latestCreatedAt: string | null): boolean {
  if (!latestCreatedAt) return true; // noch nie generiert
  const latest = new Date(latestCreatedAt);
  const now = new Date();
  const ageMs = now.getTime() - latest.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays > SUGGESTIONS_STALE_AFTER_DAYS) return true;
  // Monatswechsel = Jahr ODER Monat unterschiedlich
  if (
    latest.getUTCFullYear() !== now.getUTCFullYear() ||
    latest.getUTCMonth() !== now.getUTCMonth()
  ) {
    return true;
  }
  return false;
}

export async function GET(req: Request) {
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

  // ─── DB-Brands laden ──────────────────────────────────────────────────
  const { data: dbRows, error } = await supabase
    .from("brands")
    .select("slug, data");
  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
  const dbBrands: Brand[] = (dbRows ?? [])
    .map((row) => row.data as Brand)
    .filter((b) => Boolean(b?.slug));

  // ─── Code-Brands mit Handle ergaenzen ────────────────────────────────
  // Code-Brand Biene wurde vom alten Cron komplett ignoriert (select from
  // brands liefert nur DB-Rows). Wir fuegen alle Code-Brands mit gueltigem
  // Handle hinzu, deduplizieren falls Slug-Konflikt mit einem DB-Brand
  // (Code gewinnt).
  const codeBrandSlugs = new Set(codeBrands.map((b) => b.slug));
  const dedupedDbBrands = dbBrands.filter((b) => !codeBrandSlugs.has(b.slug));
  const allBrands: Brand[] = [...getCodeBrandsWithHandle(), ...dedupedDbBrands];

  const origin = new URL(req.url).origin;
  const webhookSecret = process.env.APIFY_WEBHOOK_SECRET;
  const webhookUrl = webhookSecret
    ? `${origin}/api/apify-webhook?secret=${encodeURIComponent(webhookSecret)}`
    : `${origin}/api/apify-webhook`;

  const results: Array<{
    brandSlug: string;
    status:
      | "started"
      | "skipped"
      | "skipped-fresh"
      | "skipped-running"
      | "failed";
    runId?: string;
    error?: string;
    skipReason?: string;
    /** True wenn wir trotz Scrape-Skip die Suggestions im Background
     *  regenerieren (stale-detection). */
    suggestionsRegenScheduled?: boolean;
  }> = [];

  for (const brand of allBrands) {
    const handle = brand.handle?.replace(/^@+/, "").trim();
    if (!handle || handle === "creator") {
      results.push({
        brandSlug: brand.slug,
        status: "skipped",
        skipReason: "no-handle",
      });
      continue;
    }

    // Skip-Lock 1: laeuft schon ein Scrape? Webhook erledigt Pipeline,
    // doppelt-anstossen waere Verschwendung.
    const latest = await getLatestScrapeForBrand(brand.slug);
    if (
      latest &&
      (latest.status === "running" || latest.status === "classifying")
    ) {
      results.push({
        brandSlug: brand.slug,
        status: "skipped-running",
        skipReason: `existing-scrape-${latest.status}`,
      });
      continue;
    }

    // Skip-Lock 2: war der letzte Refresh frisch? Verhindert Doppel-Run
    // mit manuell getriggertem Refresh.
    // ABER: Suggestions koennen trotzdem stale sein (z.B. "Top Reels Mai"
    // im Juni). Wir prüfen das separat und regenerieren ggf. NUR die
    // Suggestions ohne neuen Apify-Scrape — guenstig, kein Apify-Cost.
    if (latest && latest.status === "done" && latest.finished_at) {
      const ageMin =
        (Date.now() - new Date(latest.finished_at).getTime()) / 60_000;
      if (ageMin < SKIP_IF_FRESHER_THAN_MIN) {
        const latestSuggestionAt = await getLatestPendingSuggestionAt(
          brand.slug
        );
        const stale = isSuggestionsStale(latestSuggestionAt);
        if (stale) {
          // Background-Regen via after() — Response geht sofort raus,
          // Gemini macht den Suggestion-Regen-Call (~10-20s) im Lambda-
          // Tail. Cover-Gen ist fire-and-forget innerhalb der Funktion.
          after(async () => {
            try {
              await regenerateSuggestionsForBrand(brand.slug);
            } catch (err) {
              console.error(
                `[cron] suggestion-regen failed for ${brand.slug}:`,
                err
              );
            }
          });
        }
        results.push({
          brandSlug: brand.slug,
          status: "skipped-fresh",
          skipReason: `last-refresh-${Math.round(ageMin)}min-ago`,
          suggestionsRegenScheduled: stale,
        });
        continue;
      }
    }

    const platform: SocialPlatform = brand.platform ?? "instagram";
    const scrapeId = await createScrape(brand.slug, platform);
    if (!scrapeId) {
      results.push({
        brandSlug: brand.slug,
        status: "failed",
        error: "createScrape returned null",
      });
      continue;
    }

    try {
      // Delta-Backfill: 50 Posts, letzte 14 Tage. Beim 4h-Cron-Takt
      // reicht das fuer alle Creator (auch >5 Posts/Tag), Dedup macht
      // Rest.
      const { runId } =
        platform === "tiktok"
          ? await startTikTokBackfill({
              username: handle,
              webhookUrl,
              resultsLimit: 50,
              onlyPostsNewerThanDays: 14,
            })
          : await startReelBackfill({
              username: handle,
              webhookUrl,
              resultsLimit: 50,
              onlyPostsNewerThanDays: 14,
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
    brandCount: allBrands.length,
    codeBrandCount: getCodeBrandsWithHandle().length,
    dbBrandCount: dedupedDbBrands.length,
    results,
  });
}
