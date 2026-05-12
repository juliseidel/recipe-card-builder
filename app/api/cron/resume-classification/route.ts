import { NextResponse, after } from "next/server";
import {
  getServerSupabase,
  hasServerSupabase,
} from "@/lib/supabase-server";
import { runClassificationAndSuggestions } from "@/lib/reel-library/classify-and-suggest";

// Public-getriggerter Endpoint, der die Klassifikations-Pipeline fuer einen
// Brand fortsetzt. Notwendig wenn:
//   - Frontend nicht mehr polled (Tab im Hintergrund, Browser geschlossen)
//   - Library-Status-Self-Healing wurde nicht getriggert
//   - Manueller Resume noetig fuer haengende classifying-Scrapes
//
// Auth: optionaler CRON_SECRET als Authorization-Header. Wenn nicht
// gesetzt, ist der Endpoint public — das ist OK, weil er nur idempotente
// Klassifikation triggert (kein Daten-Leak, kein finanzieller Schaden,
// max kostet er ein paar Gemini-Calls fuer einen bereits geladenen Brand).
//
// Aufruf: POST /api/cron/resume-classification?brand=christian
// oder:    GET (Cron-style)

export const runtime = "nodejs";
export const maxDuration = 60;

async function handle(req: Request) {
  // Optionaler Bearer-Token-Check.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
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

  // Aktive 'classifying'-Scrape finden. Wenn nicht da → no-op.
  const supabase = getServerSupabase();
  const { data: scrape, error } = await supabase
    .from("creator_scrapes")
    .select("id, status")
    .eq("brand_slug", brandSlug)
    .in("status", ["classifying", "running"])
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: `DB-Fetch fehlgeschlagen: ${error.message}` },
      { status: 500 }
    );
  }
  if (!scrape) {
    return NextResponse.json({
      ok: true,
      message: "Kein aktiver Scrape fuer diesen Brand — nichts zu tun.",
    });
  }

  // Klassifikation im Hintergrund (after) — Response kommt sofort.
  after(async () => {
    try {
      console.log(
        `[resume-classification] starting for brand=${brandSlug} scrapeId=${scrape.id}`
      );
      await runClassificationAndSuggestions({
        scrapeId: scrape.id,
        brandSlug,
      });
      console.log(
        `[resume-classification] finished for brand=${brandSlug}`
      );
    } catch (err) {
      console.error(
        "[resume-classification] failed",
        err instanceof Error ? err.message : err
      );
    }
  });

  return NextResponse.json({
    ok: true,
    brandSlug,
    scrapeId: scrape.id,
    status: scrape.status,
    message: "Klassifikation wurde fortgesetzt — laeuft im Hintergrund.",
  });
}

export async function POST(req: Request) {
  return handle(req);
}

export async function GET(req: Request) {
  return handle(req);
}
