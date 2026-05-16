import { NextResponse } from "next/server";
import { getServerSupabase, hasServerSupabase } from "@/lib/supabase-server";
import { updateCustomPackData } from "@/lib/custom-packs-server";
import { loadBrand } from "@/lib/custom-brands-server";
import { generatePackMeta } from "@/lib/ai/generate-pack-meta";
import { generatePackForeword } from "@/lib/ai/generate-foreword";
import { generatePackCover } from "@/lib/ai/generate-pack-cover";
import { generateForewordImage } from "@/lib/ai/generate-foreword-image";
import { loadVisibleRecipesForPack, type Recipe } from "@/lib/recipes";
import type { Pack } from "@/lib/packs";
import type { ReelRow } from "@/lib/creator-reels-server";

// Re-Roll EINES Pack-Feldes via Brand-Voice-Pipeline.
//
// Body:
//   { field: 'title' | 'subtitle' | 'tagline' | 'description' | 'category'
//          | 'foreword' | 'coverImage' | 'forewordImage' }
//
// Triggert die passende KI-Pipeline, persistiert das neue Feld, returnt
// das Update. Bewusst eingesetzt vom Pack-Editor pro-Feld-Re-Roll-Button
// — das geaenderte Feld wird NICHT in editedFields[] aufgenommen, damit
// es weiter Auto-Sync-faehig bleibt (wenn der User explizit selber tippt,
// landet das Feld via /update mit editedFields gesetzt → eingefroren).

export const runtime = "nodejs";
export const maxDuration = 90;

type RouteParams = { params: Promise<{ id: string }> };

type Body = {
  field: string;
};

const ALL_TEXT_FIELDS = new Set([
  "title",
  "subtitle",
  "tagline",
  "description",
  "category",
]);

async function loadPackAndContext(id: string): Promise<{
  pack: Pack;
  packId: string;
  brandSlug: string;
} | null> {
  if (!hasServerSupabase()) return null;
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("packs")
    .select("id, brand_slug, data")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return {
    packId: data.id as string,
    brandSlug: data.brand_slug as string,
    pack: data.data as Pack,
  };
}

// Re-Generate-Hilfe: lade die Recipes des Packs als "Reel-aehnliche" Inputs
// fuer generatePackMeta. Generierte/Custom-Rezepte haben keine Reel-Row, also
// adaptieren wir die Recipe-Daten in das vom Generator erwartete Schema.
// loadVisibleRecipesForPack mischt static + custom + hidden-Filter, damit
// auch Custom-Packs (komplett vom User erstellt) eine korrekte Recipe-Liste
// liefern. Vorher nutzte das hier getRecipesForPack direkt, was bei
// Custom-Packs eine leere Liste lieferte und die Gemini-Generation blind
// machte (User-Report: "Re-Roll Vorwort zeigt immer noch geloeschtes Rezept").
async function recipesAsReelInputs(
  brandSlug: string,
  packSlug: string
): Promise<ReelRow[]> {
  const recipes = await loadVisibleRecipesForPack(brandSlug, packSlug);
  // Adapter: Recipe → ReelRow-Subset (nur Felder die generatePackMeta nutzt:
  // recipe_title, caption, meal_type, cuisine, main_ingredient).
  return recipes.map((r, idx) => ({
    id: `recipe-${idx}-${r.slug}`,
    brand_slug: brandSlug,
    ig_id: r.slug,
    post_url: r.sourceUrl ?? null,
    type: "Video",
    caption: r.description ?? r.title,
    display_url: r.hero ?? null,
    video_url: null,
    posted_at: null,
    like_count: null,
    view_count: null,
    comment_count: null,
    hashtags: null,
    is_recipe: true,
    recipe_confidence: 1,
    recipe_title: r.title,
    meal_type: null,
    cuisine: null,
    main_ingredient: null,
    dietary: null,
    estimated_time_minutes: r.prepTime ?? null,
    occasion: null,
    season: null,
    skill_level: null,
    vessel: null,
    classified_at: null,
    scraped_at: null,
    raw: null,
    cover_storage_url: null,
    platform: "instagram" as const,
  })) as unknown as ReelRow[];
}

export async function POST(req: Request, { params }: RouteParams) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Pack-ID fehlt." }, { status: 400 });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const ctx = await loadPackAndContext(id);
  if (!ctx) {
    return NextResponse.json({ error: "Pack nicht gefunden." }, { status: 404 });
  }

  const brand = await loadBrand(ctx.brandSlug);
  if (!brand) {
    return NextResponse.json({ error: "Brand nicht gefunden." }, { status: 404 });
  }

  const field = body.field;

  // ─── Text-Felder (title/subtitle/tagline/description/category) ──────────
  if (ALL_TEXT_FIELDS.has(field)) {
    const reels = await recipesAsReelInputs(ctx.brandSlug, ctx.pack.slug);
    if (reels.length < 1) {
      return NextResponse.json(
        { error: "Pack hat keine Rezepte — keine Grundlage fuer Re-Generate." },
        { status: 422 }
      );
    }
    try {
      const meta = await generatePackMeta(reels, brand);
      // Nur das angefragte Feld in den Patch packen — andere Felder
      // bleiben unangetastet.
      const patch: Partial<Pack> = {};
      if (field === "title") patch.title = meta.title;
      else if (field === "subtitle") patch.subtitle = meta.subtitle;
      else if (field === "tagline") patch.tagline = meta.tagline;
      else if (field === "description") patch.description = meta.description;
      else if (field === "category") patch.category = meta.category;
      const updated = await updateCustomPackData(id, patch);
      return NextResponse.json({ ok: true, pack: updated, field, value: patch[field as keyof Pack] });
    } catch (err) {
      return NextResponse.json(
        { error: `Text-Re-Generate fehlgeschlagen: ${(err as Error).message}` },
        { status: 500 }
      );
    }
  }

  // ─── Foreword-Text (komplett: greeting+story+signoff+outro) ─────────────
  if (field === "foreword") {
    // loadVisibleRecipesForPack: static + custom + hidden-Filter. Vorher
    // nutzte das hier getRecipesForPack direkt, was bei Custom-Packs
    // (komplett vom User erstellt) eine leere Liste zurueckgab — der
    // Re-Roll-Button hatte damit denselben Bug wie der Auto-Sync.
    const recipes = await loadVisibleRecipesForPack(ctx.brandSlug, ctx.pack.slug);
    const recipeTitles = recipes.map((r) => r.title);
    try {
      const foreword = await generatePackForeword(ctx.pack, brand, recipeTitles);
      const updated = await updateCustomPackData(id, { foreword });
      return NextResponse.json({ ok: true, pack: updated, field, value: foreword });
    } catch (err) {
      return NextResponse.json(
        { error: `Foreword-Re-Generate fehlgeschlagen: ${(err as Error).message}` },
        { status: 500 }
      );
    }
  }

  // ─── Cover-Bild (Flux 2 Pro) ─────────────────────────────────────────────
  if (field === "coverImage") {
    try {
      const result = await generatePackCover({ pack: ctx.pack });
      const buffer = result.buffer;
      // Upload zu Supabase Storage
      const supabase = getServerSupabase();
      const path = `${ctx.brandSlug}/${ctx.pack.slug}-${Date.now().toString(36)}.jpg`;
      // Bucket idempotent erstellen
      await supabase.storage.createBucket("pack-covers", {
        public: true,
        fileSizeLimit: 8 * 1024 * 1024,
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
      });
      const up = await supabase.storage.from("pack-covers").upload(path, buffer, {
        contentType: "image/jpeg",
        cacheControl: "31536000",
        upsert: false,
      });
      if (up.error) throw new Error(up.error.message);
      const { data: pub } = supabase.storage.from("pack-covers").getPublicUrl(path);
      const coverImage = pub.publicUrl;
      const updated = await updateCustomPackData(id, { coverImage });
      return NextResponse.json({ ok: true, pack: updated, field, value: coverImage });
    } catch (err) {
      return NextResponse.json(
        { error: `Cover-Re-Generate fehlgeschlagen: ${(err as Error).message}` },
        { status: 500 }
      );
    }
  }

  // ─── Foreword-Bild (Flux 2 Pro Still-Life) ──────────────────────────────
  if (field === "forewordImage") {
    try {
      const buffer = await generateForewordImage(ctx.pack);
      const supabase = getServerSupabase();
      const path = `${ctx.brandSlug}/${ctx.pack.slug}-foreword-${Date.now().toString(36)}.jpg`;
      await supabase.storage.createBucket("pack-forewords", {
        public: true,
        fileSizeLimit: 8 * 1024 * 1024,
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
      });
      const up = await supabase.storage.from("pack-forewords").upload(path, buffer, {
        contentType: "image/jpeg",
        cacheControl: "31536000",
        upsert: false,
      });
      if (up.error) throw new Error(up.error.message);
      const { data: pub } = supabase.storage.from("pack-forewords").getPublicUrl(path);
      const forewordImage = pub.publicUrl;
      const updated = await updateCustomPackData(id, { forewordImage });
      return NextResponse.json({ ok: true, pack: updated, field, value: forewordImage });
    } catch (err) {
      return NextResponse.json(
        { error: `Foreword-Bild-Re-Generate fehlgeschlagen: ${(err as Error).message}` },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(
    { error: `Feld '${field}' kann nicht regeneriert werden. Erlaubt: title, subtitle, tagline, description, category, foreword, coverImage, forewordImage.` },
    { status: 400 }
  );
}
