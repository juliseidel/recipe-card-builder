import { NextResponse } from "next/server";
import { quickScrapeReels, ApifyError } from "@/lib/integrations/apify";
import { quickScrapeTikTokReels } from "@/lib/integrations/apify-tiktok";
import {
  upsertReels,
  getUnclassifiedReels,
  updateReelClassification,
} from "@/lib/creator-reels-server";
import { classifyReels } from "@/lib/ai/classify-reels";
import { loadBrand } from "@/lib/custom-brands-server";
import type { SocialPlatform } from "@/lib/integrations/platform";

// Quick-Scrape: holt SOFORT die letzten ~30 Posts eines Creators, klassi-
// fiziert sie, und persistiert sie. Wird vom Auto-Pack-Tab genutzt, wenn:
//   - Library noch leer ist (Backfill noch nicht durch oder gescheitert)
//   - User explizit "frisch von Instagram laden" klickt
//
// Synchron, weil das in 30-50s passt und der User auf das Resultat wartet
// (Live-Preview im Auto-Tab refreshed direkt danach).

export const runtime = "nodejs";
export const maxDuration = 90;

type RouteParams = { params: Promise<{ slug: string }> };

type Body = {
  /** Optional: anzahl Tage zurueck. Default 30. */
  days?: number;
  /** Optional: resultsLimit. Default 30. */
  limit?: number;
};

export async function POST(req: Request, { params }: RouteParams) {
  if (!process.env.APIFY_TOKEN) {
    return NextResponse.json(
      { error: "APIFY_TOKEN ist nicht gesetzt." },
      { status: 500 }
    );
  }
  const { slug } = await params;

  let body: Body = {};
  try {
    body = await req.json();
  } catch {
    // Body optional — Defaults nutzen.
  }

  const brand = await loadBrand(slug);
  if (!brand) {
    return NextResponse.json(
      { error: "Brand nicht gefunden." },
      { status: 404 }
    );
  }
  const username = brand.handle?.replace(/^@+/, "").trim();
  if (!username || username === "creator") {
    return NextResponse.json(
      {
        error:
          "Brand hat keinen Handle gesetzt. Bitte im Brand-Setup nachpflegen.",
      },
      { status: 422 }
    );
  }
  const platform: SocialPlatform = brand.platform ?? "instagram";

  // 1. Apify synchron pingen (plattform-spezifisch)
  let reels;
  try {
    reels =
      platform === "tiktok"
        ? await quickScrapeTikTokReels({
            username,
            resultsLimit: Math.max(10, Math.min(body.limit ?? 30, 60)),
            onlyPostsNewerThanDays: Math.max(7, Math.min(body.days ?? 30, 90)),
          })
        : await quickScrapeReels({
            username,
            resultsLimit: Math.max(10, Math.min(body.limit ?? 30, 60)),
            onlyPostsNewerThanDays: Math.max(7, Math.min(body.days ?? 30, 90)),
          });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Apify-Scrape fehlgeschlagen.",
        stage: "scrape",
        platform,
      },
      {
        status: err instanceof ApifyError && err.status === 401 ? 500 : 422,
      }
    );
  }

  // 2. Reels in DB persistieren (Upsert mit ig_id-Dedup → nur neue Rows).
  let inserted = 0;
  try {
    inserted = await upsertReels(slug, reels, platform);
  } catch (err) {
    // Hochwahrscheinlich: SQL-Migration fehlt.
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error:
          "Konnte Reels nicht speichern — vermutlich fehlt die SQL-Migration. Bitte sql/creator-reels-table.sql in Supabase ausfuehren.",
        detail: msg,
        needsSetup: true,
      },
      { status: 503 }
    );
  }

  // 3. Klassifikation der neuen Reels. Wenn upsertReels nur Duplikate
  // gefunden hat (inserted=0), gibt es u.U. trotzdem schon unklassifizierte
  // Reels von einem fruheren teilweisen Backfill — also lieber komplett
  // re-querien.
  let classified = 0;
  try {
    // In einem Schub bis max 60 Reels klassifizieren (ist genug fuer
    // Quick-Scrape und passt in unsere maxDuration=90s).
    const unclassified = await getUnclassifiedReels(slug, 60);
    if (unclassified.length > 0) {
      const { CLASSIFICATION_FAILED } = await import("@/lib/ai/classify-reels");
      const results = await classifyReels(unclassified);
      let successCount = 0;
      await Promise.all(
        unclassified.map((reel) => {
          const c = results.get(reel.id);
          if (c === undefined || c === CLASSIFICATION_FAILED) {
            return Promise.resolve();
          }
          // c is narrowed to ReelClassification here
          successCount += 1;
          return updateReelClassification(reel.id, c as Exclude<typeof c, typeof CLASSIFICATION_FAILED>);
        })
      );
      classified = successCount;
    }
  } catch (err) {
    // Klassifikation nicht-kritisch: Reels sind in der DB, koennen
    // spaeter klassifiziert werden. Wir loggen und liefern Erfolg zurueck.
    console.warn(
      "[quick-scrape] classification failed (non-fatal):",
      err instanceof Error ? err.message : err
    );
  }

  return NextResponse.json({
    status: "done",
    scraped: reels.length,
    inserted,
    classified,
  });
}
