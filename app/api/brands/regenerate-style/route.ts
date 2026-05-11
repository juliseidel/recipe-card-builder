import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  ApifyError,
  scrapeInstagramProfile,
} from "@/lib/integrations/apify";
import { analyzeCreatorStyleFromText } from "@/lib/ai/analyze-creator-style";
import { getServerSupabase, hasServerSupabase } from "@/lib/supabase-server";
import type { Brand } from "@/lib/brands";

// Regenerate-Endpoint fuer die Brand-DNA. Wird vom Workspace-Header-Button
// "Brand-Style aktualisieren" getriggert. Anwendungsfall:
//   - Vision-Analyse beim Onboarding hat keinen brauchbaren Style erkannt
//     (zu wenige saubere Dish-Shots in den Reel-Covers)
//   - Creator hat seinen Look geaendert und die Bilder sollen dem folgen
//   - Manueller "Versuch's nochmal"-Button nach einem nicht-zufrieden-
//     stellenden Hero-Bild
//
// Setzt brand.imageStyle in der DB neu. Hero-Pipeline laedt es beim
// naechsten Hero-Generate automatisch via getBrandImageStyle (DB-Lookup).
//
// Eingaben:
//   { brandSlug: string }
//
// Schritte:
//   1. Brand-Row aus DB laden (nur DB-Brands — Code-Brands wie Biene
//      sollen NICHT ueberschrieben werden, deren Style ist Code)
//   2. Apify scraped Profil neu (latestPosts)
//   3. Vision-Analyzer laeuft auf den frischen displayUrls
//   4. Wenn Style erkennbar → update brand.data.imageStyle
//   5. revalidate Workspace + Hub

export const runtime = "nodejs";
// PR 11: Text-basierter Style-Selector statt Vision. Apify ~15s +
// Gemini Flash Text ~3-5s = ~20s typisch. 60s gibt Headroom.
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!process.env.APIFY_TOKEN) {
    return NextResponse.json(
      { error: "Apify-Token ist nicht konfiguriert." },
      { status: 500 }
    );
  }
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "Gemini-API-Key ist nicht konfiguriert." },
      { status: 500 }
    );
  }
  if (!hasServerSupabase()) {
    return NextResponse.json(
      { error: "Supabase ist nicht konfiguriert." },
      { status: 500 }
    );
  }

  let body: { brandSlug?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.brandSlug || typeof body.brandSlug !== "string") {
    return NextResponse.json(
      { error: "brandSlug fehlt im Body." },
      { status: 400 }
    );
  }

  const supabase = getServerSupabase();

  // ─── 1. Brand-Row aus DB laden ──────────────────────────────────────────
  // Nur DB-Brands — Code-Brands (Biene) haben ihren Style im Code und
  // duerfen NICHT ueberschrieben werden.
  const { data: row, error: readErr } = await supabase
    .from("brands")
    .select("id, slug, data")
    .eq("slug", body.brandSlug)
    .maybeSingle();
  if (readErr) {
    return NextResponse.json(
      { error: `DB-Read failed: ${readErr.message}` },
      { status: 500 }
    );
  }
  if (!row) {
    return NextResponse.json(
      {
        error:
          "Brand nicht in der DB gefunden. Code-Brands (z. B. Biene) koennen ueber diesen Endpoint nicht regeneriert werden — deren Style liegt im Code.",
      },
      { status: 404 }
    );
  }

  const brand = row.data as Brand;
  const handle = brand.handle?.replace(/^@/, "").trim();
  if (!handle) {
    return NextResponse.json(
      { error: "Brand hat keinen Instagram-Handle gespeichert." },
      { status: 422 }
    );
  }

  // ─── 2. Apify scraped Profil neu ────────────────────────────────────────
  let profile;
  try {
    profile = await scrapeInstagramProfile(handle);
  } catch (err) {
    const status =
      err instanceof ApifyError && err.status === 401 ? 500 : 422;
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Konnte Instagram nicht laden.",
        stage: "scrape",
      },
      { status }
    );
  }

  console.log(
    `[regenerate-style] @${handle}: ${profile.latestPosts.length} posts vom Apify`
  );

  // ─── 3. Text-basierter Style-Selector (PR 11) ───────────────────────────
  // Pivot weg von Gemini Pro Vision (das reliable 400 INVALID_ARGUMENT
  // warf). Gemini Flash waehlt aus 6 vorgefertigten Brand-Style-Templates,
  // bei Fail deterministic keyword-match. Returnt IMMER einen Style —
  // kein 422 mehr.
  const styleResult = await analyzeCreatorStyleFromText({ profile });
  const imageStyle = styleResult.style;
  console.log(
    `[regenerate-style] @${handle} picked "${styleResult.templateId}" via ${styleResult.source}: ${styleResult.reasoning.slice(0, 200)}`
  );

  // ─── 4. Brand-Row updaten ───────────────────────────────────────────────
  // Defensive: read-modify-write damit wir andere Felder (Stats etc.) nicht
  // versehentlich abscheideen. Pattern aus mergeRecipeData in
  // /api/recipes/enrich uebernommen.
  const { data: latest } = await supabase
    .from("brands")
    .select("data")
    .eq("id", row.id)
    .maybeSingle();
  const current = (latest?.data as Brand | undefined) ?? brand;
  const merged: Brand = { ...current, imageStyle };
  const { error: writeErr } = await supabase
    .from("brands")
    .update({ data: merged })
    .eq("id", row.id);
  if (writeErr) {
    return NextResponse.json(
      { error: `DB-Update failed: ${writeErr.message}` },
      { status: 500 }
    );
  }

  // ─── 5. Cache invalidieren ──────────────────────────────────────────────
  // Hub + Brand-Workspace re-rendern, damit alle Stellen die neue Brand-
  // Daten sehen (technisch braucht der Workspace das nicht direkt, aber
  // wenn der Hero-Pipeline-Cache irgendwo hineingreift, hilft das).
  revalidatePath("/");
  revalidatePath(`/${brand.slug}`);

  return NextResponse.json({
    ok: true,
    brandSlug: brand.slug,
    templateId: styleResult.templateId,
    source: styleResult.source,
    reasoning: styleResult.reasoning,
    lightingCount: imageStyle.lightingOptions.length,
    sceneCount: imageStyle.sceneOptions.length,
  });
}
