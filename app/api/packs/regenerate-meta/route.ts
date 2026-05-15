import { NextResponse } from "next/server";
import { getServerSupabase, hasServerSupabase } from "@/lib/supabase-server";
import { updateCustomPackData, findCustomPackIdBySlug } from "@/lib/custom-packs-server";
import { loadBrand } from "@/lib/custom-brands-server";
import { generatePackMeta } from "@/lib/ai/generate-pack-meta";
import { generatePackForeword } from "@/lib/ai/generate-foreword";
import { getRecipesForPack } from "@/lib/recipes";
import type { Pack } from "@/lib/packs";
import type { ReelRow } from "@/lib/creator-reels-server";

// Auto-Sync-Endpoint: wird nach jeder Recipe-Mutation (Add/Delete/Edit/
// Hide) gerufen. Re-generiert die Pack-Texte basierend auf den AKTUELLEN
// Recipes im Pack. RESPEKTIERT pack.editedFields[] — jedes Feld das der
// User manuell editiert hat, wird hier NICHT mehr ueberschrieben.
//
// Body (eine der zwei Varianten):
//   { brandSlug, packSlug }   — typisch fuer Auto-Sync-Hooks
//   { packId }                 — typisch fuer manuellen Refresh
//
// Felder die hier regeneriert werden (wenn nicht in editedFields):
//   - title, subtitle, tagline, description, category (via generatePackMeta)
//   - foreword.greeting/story/signoff/outro (via generatePackForeword)
//
// NICHT regeneriert: coverImage, forewordImage, mood, displayFont, cardLayout.
// Diese bleiben vom Cover-Reroll-Button oder Manual-Edit kontrolliert.

export const runtime = "nodejs";
export const maxDuration = 90;

type Body = {
  brandSlug?: string;
  packSlug?: string;
  packId?: string;
  /** Wenn true: ignoriert editedFields und regeneriert alles. Default false. */
  force?: boolean;
};

async function loadPack(opts: Body): Promise<{
  pack: Pack;
  packId: string;
  brandSlug: string;
} | null> {
  if (!hasServerSupabase()) return null;
  const supabase = getServerSupabase();

  let packId = opts.packId ?? null;
  if (!packId && opts.brandSlug && opts.packSlug) {
    packId = await findCustomPackIdBySlug(opts.brandSlug, opts.packSlug);
  }
  if (!packId) return null;

  const { data, error } = await supabase
    .from("packs")
    .select("id, brand_slug, data")
    .eq("id", packId)
    .maybeSingle();
  if (error || !data) return null;

  return {
    packId: data.id as string,
    brandSlug: data.brand_slug as string,
    pack: data.data as Pack,
  };
}

async function recipesAsReelInputs(
  brandSlug: string,
  packSlug: string
): Promise<ReelRow[]> {
  const recipes = await getRecipesForPack(packSlug);
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

const TEXT_FIELDS: (keyof Pack)[] = [
  "title",
  "subtitle",
  "tagline",
  "description",
  "category",
];

const FOREWORD_FIELDS = [
  "foreword.greeting",
  "foreword.story",
  "foreword.signoff",
  "foreword.outro",
] as const;

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const ctx = await loadPack(body);
  if (!ctx) {
    return NextResponse.json(
      { error: "Pack nicht gefunden (oder kein Custom-Pack)." },
      { status: 404 }
    );
  }

  const brand = await loadBrand(ctx.brandSlug);
  if (!brand) {
    return NextResponse.json({ error: "Brand nicht gefunden." }, { status: 404 });
  }

  const lockedFields = new Set(body.force ? [] : (ctx.pack.editedFields ?? []));

  // Welche Text-Felder muss regeneriert werden? Wenn ALLE locked sind,
  // sparen wir den Gemini-Call.
  const textFieldsToUpdate = TEXT_FIELDS.filter((f) => !lockedFields.has(f));
  const forewordFieldsToUpdate = FOREWORD_FIELDS.filter((f) => !lockedFields.has(f));

  const patch: Partial<Pack> = {};
  const summary: { skipped: string[]; updated: string[] } = {
    skipped: [...lockedFields],
    updated: [],
  };

  // ─── Pack-Meta (title/subtitle/tagline/description/category) ─────────────
  if (textFieldsToUpdate.length > 0) {
    try {
      const reels = await recipesAsReelInputs(ctx.brandSlug, ctx.pack.slug);
      if (reels.length >= 1) {
        const meta = await generatePackMeta(reels, brand);
        for (const f of textFieldsToUpdate) {
          if (f === "title") patch.title = meta.title;
          else if (f === "subtitle") patch.subtitle = meta.subtitle;
          else if (f === "tagline") patch.tagline = meta.tagline;
          else if (f === "description") patch.description = meta.description;
          else if (f === "category") patch.category = meta.category;
          summary.updated.push(f);
        }
      }
    } catch (err) {
      console.warn(
        "[packs/regenerate-meta] generatePackMeta failed (non-fatal):",
        err instanceof Error ? err.message : err
      );
    }
  }

  // ─── Foreword-Block ──────────────────────────────────────────────────────
  // Nur regenerieren wenn mindestens EIN Foreword-Subfield un-locked ist UND
  // der Pack einen Foreword hat (oder einen bekommen soll).
  if (forewordFieldsToUpdate.length > 0 && ctx.pack.foreword) {
    try {
      const recipes = await getRecipesForPack(ctx.pack.slug);
      const recipeTitles = recipes.map((r) => r.title);
      const newForeword = await generatePackForeword(ctx.pack, brand, recipeTitles);
      // Merge: nur un-locked Subfields uebernehmen, locked behalten
      const merged: NonNullable<Pack["foreword"]> = {
        greeting: lockedFields.has("foreword.greeting")
          ? ctx.pack.foreword.greeting
          : newForeword.greeting,
        story: lockedFields.has("foreword.story")
          ? ctx.pack.foreword.story
          : newForeword.story,
        signoff: lockedFields.has("foreword.signoff")
          ? ctx.pack.foreword.signoff
          : newForeword.signoff,
        ...(newForeword.outro || ctx.pack.foreword.outro
          ? {
              outro: lockedFields.has("foreword.outro")
                ? ctx.pack.foreword.outro
                : newForeword.outro,
            }
          : {}),
      };
      patch.foreword = merged;
      for (const f of forewordFieldsToUpdate) summary.updated.push(f);
    } catch (err) {
      console.warn(
        "[packs/regenerate-meta] generatePackForeword failed (non-fatal):",
        err instanceof Error ? err.message : err
      );
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({
      ok: true,
      message: "Nichts zu regenerieren — alle Felder sind manuell-editiert oder Generation fehlgeschlagen.",
      summary,
    });
  }

  const updated = await updateCustomPackData(ctx.packId, patch);
  return NextResponse.json({
    ok: true,
    pack: updated,
    summary,
  });
}
