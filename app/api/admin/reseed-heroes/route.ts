import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import { generateHeroForRecipe } from "@/lib/ai/generate-hero";
import { getBrand } from "@/lib/brands";
import type { Recipe } from "@/lib/recipes";

// Admin-Endpoint: Reseed Hero Images mit der neuen Phase-3-Pipeline
// (Apify video → ffmpeg frames → Gemini Vision pick → Flux Kontext Pro
// mit Keyframe-Reference). Wird einmalig nach dem Pipeline-Rebuild
// aufgerufen, damit die bereits geseedeten Bienes-Rezepte neue Heroes
// bekommen — diesmal saubere Brand-Style-Bilder, die das echte Reel-
// Gericht matchen statt das Cover-Thumbnail mit Werbe-Overlays.
//
// Auth: Bearer-Token mit ADMIN_RESEED_TOKEN. Middleware via PUBLIC_PATHS
// erweitert um "/api/admin".
//
// Body (optional):
//   { packSlug?: string, slug?: string, limit?: number }
// — leerer Body iteriert ueber alle statischen Rezepte mit sourceUrl.

export const runtime = "nodejs";
// Pro Rezept ~60-90 s (Apify + ffmpeg + Vision + Flux Kontext Pro).
// Vercel Pro maxDuration = 300 s → batches von max 3-4 Rezepten.
export const maxDuration = 300;

export async function POST(req: Request) {
  // Auth via dedicated ADMIN_RESEED_TOKEN
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
      recipeData: r.data as Recipe,
      sourceUrl: (r.data as { sourceUrl?: string }).sourceUrl,
    }))
    .filter((r) => r.sourceUrl && r.sourceUrl.length > 10);

  const limit = body.limit && body.limit > 0 ? body.limit : candidates.length;
  const batch = candidates.slice(0, limit);

  const items: Array<{
    recipeSlug: string;
    status: "ok" | "skipped" | "failed";
    heroUrl?: string;
    source?: "keyframe" | "cover" | "flux-text-only";
    keyframeReasoning?: string;
    keyframeTimestamp?: number;
    error?: string;
  }> = [];
  let done = 0;
  let skipped = 0;
  let failed = 0;

  for (const r of batch) {
    try {
      const brand = getBrand(r.brand_slug);
      if (!brand) {
        items.push({
          recipeSlug: r.recipe_slug,
          status: "failed",
          error: `Unknown brand: ${r.brand_slug}`,
        });
        failed += 1;
        continue;
      }

      const result = await generateHeroForRecipe({
        recipe: r.recipeData,
        recipeId: r.id,
        brandSlug: r.brand_slug,
        forceFlux: false, // wir wollen den Keyframe-Pfad
      });

      if (!result?.heroUrl) {
        items.push({ recipeSlug: r.recipe_slug, status: "skipped" });
        skipped += 1;
        continue;
      }

      // DB-Row aktualisieren: data.hero auf neue URL setzen
      const updated = {
        ...(r.data as Record<string, unknown>),
        hero: result.heroUrl,
      };
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

      items.push({
        recipeSlug: r.recipe_slug,
        status: "ok",
        heroUrl: result.heroUrl,
        source: result.source,
        keyframeReasoning: result.keyframeReasoning,
        keyframeTimestamp: result.keyframeTimestamp,
      });
      done += 1;
      // Server-Cache der Pack-DB-Reads invalidieren — sonst sieht die
      // App den neuen Hero erst nach Cache-TTL-Tick (30s).
      const { revalidatePath } = await import("next/cache");
      revalidatePath(`/${r.brand_slug}/${r.pack_slug}`);
      revalidatePath(`/${r.brand_slug}/${r.pack_slug}/${r.recipe_slug}`);
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
