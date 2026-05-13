import { NextResponse, after } from "next/server";
import {
  getServerSupabase,
  hasServerSupabase,
} from "@/lib/supabase-server";
import { createScrape } from "@/lib/creator-reels-server";
import { runClassificationAndSuggestions } from "@/lib/reel-library/classify-and-suggest";

// Admin-Endpoint zum Force-Reclassify aller Reels eines Brands. Wird
// gebraucht nachdem der Klassifikator-Schema erweitert wurde (neue
// Tag-Dimensionen wie occasion/season/skill/vessel), damit existierende
// Reels die neuen Felder auch befuellt bekommen.
//
// Funktion:
//   1. UPDATE creator_reels SET classified_at = NULL fuer brand_slug
//   2. Neuen 'classifying' Scrape anlegen (fuer Status-Tracking)
//   3. runClassificationAndSuggestions im after()-Hook starten
//
// Auth: Bearer-Token via ADMIN_RECLASSIFY_TOKEN oder ADMIN_RESEED_TOKEN.
// Wenn kein Token gesetzt ist: oeffentlich (Dev-Setup). Idempotent — kann
// mehrfach aufgerufen werden, aber je Brand ~$0.01-0.05 Gemini-Kosten.
//
// Aufruf:
//   curl -X POST -H "Authorization: Bearer $TOKEN" \
//     "https://clever-satoshi-22bf41.vercel.app/api/admin/reclassify-reels?brand=julia"

export const runtime = "nodejs";
export const maxDuration = 60;

async function handle(req: Request) {
  const expectedToken =
    process.env.ADMIN_RECLASSIFY_TOKEN ?? process.env.ADMIN_RESEED_TOKEN;
  if (expectedToken) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const url = new URL(req.url);
  const brandSlug = url.searchParams.get("brand");
  if (!brandSlug) {
    return NextResponse.json(
      { error: "?brand=<slug> ist erforderlich" },
      { status: 400 }
    );
  }

  if (!hasServerSupabase()) {
    return NextResponse.json(
      { error: "Supabase nicht konfiguriert." },
      { status: 500 }
    );
  }

  const supabase = getServerSupabase();

  // Schritt 1: classified_at auf NULL setzen fuer alle Reels des Brands.
  // Damit picken sie die naechste getUnclassifiedReels-Loop wieder auf.
  // Wir setzen NICHT is_recipe = null — wir wollen die Klassifikation
  // einfach erneut anstossen und Gemini ueberschreibt alle Felder.
  const { error: resetError, count } = await supabase
    .from("creator_reels")
    .update({ classified_at: null }, { count: "exact" })
    .eq("brand_slug", brandSlug);
  if (resetError) {
    return NextResponse.json(
      { error: `Reset failed: ${resetError.message}` },
      { status: 500 }
    );
  }
  const reelsToReclassify = count ?? 0;

  if (reelsToReclassify === 0) {
    return NextResponse.json({
      ok: true,
      brandSlug,
      message: "Keine Reels fuer diesen Brand in der DB.",
      reelsReset: 0,
    });
  }

  // Schritt 2: Scrape-Row als Status-Tracker. Wir nutzen createScrape und
  // setzen den Status danach auf 'classifying' (skip 'running' weil kein
  // Apify-Run noetig). Wenn der Helper failed, ist das nicht fatal — die
  // Klassifikation laueft trotzdem, nur ohne UI-Status-Banner.
  const scrapeId = await createScrape(brandSlug);
  if (scrapeId) {
    await supabase
      .from("creator_scrapes")
      .update({ status: "classifying" })
      .eq("id", scrapeId);
  }

  // Schritt 3: Hintergrund-Klassifikation. Browser bekommt sofort eine
  // Antwort, Klassifikation laueft via Vercel's after().
  if (scrapeId) {
    after(async () => {
      try {
        console.log(
          `[reclassify-reels] starting for brand=${brandSlug} scrapeId=${scrapeId} reels=${reelsToReclassify}`
        );
        await runClassificationAndSuggestions({ scrapeId, brandSlug });
        console.log(
          `[reclassify-reels] finished for brand=${brandSlug}`
        );
      } catch (err) {
        console.error(
          "[reclassify-reels] failed",
          err instanceof Error ? err.message : err
        );
      }
    });
  }

  return NextResponse.json({
    ok: true,
    brandSlug,
    scrapeId,
    reelsReset: reelsToReclassify,
    message: `${reelsToReclassify} Reels werden im Hintergrund neu klassifiziert. UI-Banner zeigt Fortschritt.`,
  });
}

export async function POST(req: Request) {
  return handle(req);
}

export async function GET(req: Request) {
  return handle(req);
}
