import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import { extractReelHeroFromInstagram } from "@/lib/ai/extract-reel-hero";

// Admin-Endpoint: Reseed Hero Images aus Instagram-Reel-Coverframes statt
// Flux-generierter Bilder. Wird einmalig nach dem Phase-3-Switch aufgerufen,
// damit die 37 bereits geseedeten Bienes-Rezepte (data.hero zeigt aktuell
// auf Flux-Bilder) neue Reel-Cover-Heroes bekommen.
//
// Auth: Bearer-Token mit ADMIN_RESEED_TOKEN (dedicated, kann nach dem
// einmaligen Reseed-Lauf wieder geloescht werden — geringerer Blast-
// Radius als der Service-Role-Key, der DB-Superuser-Privilegien hat).
// Middleware ist via PUBLIC_PATHS-Erweiterung freigeschaltet ("/api/admin").
//
// Body (optional):
//   { packSlug?: string, slug?: string, limit?: number }
// — leerer Body iteriert ueber alle statischen Rezepte mit sourceUrl.
//
// Response: Streaming-NDJSON pro Recipe-Processing-Result. Letzte Zeile
// ist ein Summary-Object.

export const runtime = "nodejs";
// Apify-Synchron-Call (~10 s) × 34 Rezepte = ~6 Min. Vercel Free-Tier
// max 60 s, Pro 300 s. Wir nutzen kleine Batches: max 6 pro Call (=60 s).
export const maxDuration = 300;

const HERO_BUCKET = "recipe-heroes";

export async function POST(req: Request) {
  // Auth via dedicated ADMIN_RESEED_TOKEN — siehe Header-Kommentar.
  const auth = req.headers.get("authorization") ?? "";
  const token = process.env.ADMIN_RESEED_TOKEN;
  if (!token || auth !== `Bearer ${token}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { packSlug?: string; slug?: string; limit?: number } = {};
  try {
    body = await req.json();
  } catch {
    // Empty body → process all
  }

  const supabase = getServerSupabase();
  let query = supabase
    .from("recipes")
    .select("id, brand_slug, pack_slug, recipe_slug, data")
    .eq("is_custom", false);
  if (body.packSlug) query = query.eq("pack_slug", body.packSlug);
  if (body.slug) query = query.eq("recipe_slug", body.slug);

  const { data: rows, error } = await query;
  if (error) {
    return NextResponse.json(
      { error: `DB-Read failed: ${error.message}` },
      { status: 500 }
    );
  }
  if (!rows || rows.length === 0) {
    return NextResponse.json({ done: 0, skipped: 0, failed: 0, items: [] });
  }

  const candidates = rows
    .map((r) => ({
      ...r,
      sourceUrl: (r.data as { sourceUrl?: string }).sourceUrl,
    }))
    .filter((r) => r.sourceUrl && r.sourceUrl.length > 10);

  const limit = body.limit && body.limit > 0 ? body.limit : candidates.length;
  const batch = candidates.slice(0, limit);

  const items: Array<{
    recipeSlug: string;
    status: "ok" | "skipped" | "failed";
    heroUrl?: string;
    error?: string;
  }> = [];
  let done = 0;
  let skipped = 0;
  let failed = 0;

  for (const r of batch) {
    try {
      const reel = await extractReelHeroFromInstagram(r.sourceUrl!);
      if (!reel) {
        items.push({ recipeSlug: r.recipe_slug, status: "skipped" });
        skipped += 1;
        continue;
      }
      const filePath = `${r.id}.jpg`;
      const upload = await supabase.storage
        .from(HERO_BUCKET)
        .upload(filePath, reel.buffer, {
          contentType: "image/jpeg",
          upsert: true,
          cacheControl: "31536000",
        });
      if (upload.error) {
        items.push({
          recipeSlug: r.recipe_slug,
          status: "failed",
          error: upload.error.message,
        });
        failed += 1;
        continue;
      }
      const { data: pub } = supabase.storage
        .from(HERO_BUCKET)
        .getPublicUrl(filePath);
      const heroUrl = pub.publicUrl;
      const updated = { ...(r.data as Record<string, unknown>), hero: heroUrl };
      const { error: updErr } = await supabase
        .from("recipes")
        .update({ data: updated })
        .eq("id", r.id);
      if (updErr) {
        items.push({
          recipeSlug: r.recipe_slug,
          status: "failed",
          error: updErr.message,
        });
        failed += 1;
        continue;
      }
      items.push({ recipeSlug: r.recipe_slug, status: "ok", heroUrl });
      done += 1;
      // Rate-Limit-Schutz fuer Apify
      await new Promise((r) => setTimeout(r, 600));
    } catch (err) {
      items.push({
        recipeSlug: r.recipe_slug,
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      });
      failed += 1;
    }
  }

  return NextResponse.json({
    total: candidates.length,
    processed: batch.length,
    done,
    skipped,
    failed,
    items,
  });
}
