import { getServerSupabase, hasServerSupabase } from "@/lib/supabase-server";
import { updateCustomPackData, findCustomPackIdBySlug } from "@/lib/custom-packs-server";
import { loadBrand } from "@/lib/custom-brands-server";
import { generatePackMeta } from "@/lib/ai/generate-pack-meta";
import { generatePackForeword } from "@/lib/ai/generate-foreword";
import { loadVisibleRecipesForPack, type Recipe } from "@/lib/recipes";
import type { Pack } from "@/lib/packs";
import type { ReelRow } from "@/lib/creator-reels-server";

// Shared Kern-Logik für Pack-Meta + Foreword Re-Generation.
//
// Wird genutzt von:
//   - /api/packs/regenerate-meta (HTTP-Trigger nach Recipe-Mutation)
//   - lib/pdf/job-runner.ts (synchroner Pre-Render-Sync, blockt PDF bis
//     Foreword frisch ist — verhindert Race-Condition wenn User direkt
//     nach Recipe-Delete Pack-PDF downloadet)
//
// Felder die regeneriert werden (wenn nicht in pack.editedFields):
//   - title, subtitle, tagline, description, category
//   - foreword.greeting/story/signoff/outro
// NICHT regeneriert: coverImage, forewordImage, mood, displayFont, cardLayout.

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

export type RegenerateOptions = {
  /** Wenn true: ignoriert pack.editedFields[] und regeneriert alles. */
  force?: boolean;
  /** Wenn true: regeneriert NUR das Foreword, laesst Title/Subtitle/
   *  Tagline/Description/Category komplett in Ruhe.
   *
   *  Use-Case: PDF-Pre-Render-Sync (job-runner). Das Foreword referenziert
   *  die konkrete Recipe-Liste ("diese 15 Rezepte...") und MUSS bei einem
   *  Download frisch sein, damit geloeschte Rezepte nicht im Vorwort
   *  stehen. Der Title hingegen ist ein stabiles Identitaets-Feld — er
   *  darf NICHT bei jedem Download neu (und durch Gemini-Varianz jedes Mal
   *  anders) generiert werden. Vorher lief hier force=true und der Title
   *  driftete bei jedem PDF-Download ("Cheesecake-Traeume" →
   *  "Meine liebsten Cheesecakes" → "...High Protein Cheesecakes"). */
  forewordOnly?: boolean;
};

export type RegenerateResult = {
  ok: boolean;
  /** Felder die wegen Lock nicht regeneriert wurden. */
  skipped: string[];
  /** Felder die neu geschrieben wurden. */
  updated: string[];
  /** Pack-Daten nach dem Write (oder null wenn nichts gemacht). */
  pack: Pack | null;
  /** Wenn Generation oder Write geschehen ist, sonst false. */
  changed: boolean;
};

function recipesAsReelInputs(
  recipes: Recipe[],
  brandSlug: string
): ReelRow[] {
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

/**
 * Re-generiert Pack-Meta + Foreword fuer einen Custom-Pack basierend auf
 * den AKTUELLEN Recipes im Pack.
 *
 * Returnt early wenn:
 *   - Supabase nicht konfiguriert
 *   - Pack nicht gefunden
 *   - Brand nicht gefunden
 *   - alle Felder gelocked (editedFields voll) UND force=false
 */
export async function regeneratePackMeta(
  brandSlug: string,
  packSlug: string,
  opts: RegenerateOptions = {}
): Promise<RegenerateResult> {
  const empty: RegenerateResult = {
    ok: false,
    skipped: [],
    updated: [],
    pack: null,
    changed: false,
  };

  if (!hasServerSupabase()) return empty;
  const supabase = getServerSupabase();

  const packId = await findCustomPackIdBySlug(brandSlug, packSlug);
  if (!packId) return empty;

  const { data: packRow, error: packErr } = await supabase
    .from("packs")
    .select("id, brand_slug, data")
    .eq("id", packId)
    .maybeSingle();
  if (packErr || !packRow) return empty;

  const pack = packRow.data as Pack;
  const brand = await loadBrand(brandSlug);
  if (!brand) return empty;

  const lockedFields = new Set(opts.force ? [] : (pack.editedFields ?? []));

  // forewordOnly: Title/Subtitle/Tagline/Description/Category komplett
  // ueberspringen — nur das Foreword wird frisch gezogen. Verhindert den
  // Title-Drift bei jedem PDF-Download.
  const textFieldsToUpdate = opts.forewordOnly
    ? []
    : TEXT_FIELDS.filter((f) => !lockedFields.has(f));
  const forewordFieldsToUpdate = FOREWORD_FIELDS.filter(
    (f) => !lockedFields.has(f)
  );

  const patch: Partial<Pack> = {};
  const result: RegenerateResult = {
    ok: true,
    skipped: [...lockedFields],
    updated: [],
    pack: null,
    changed: false,
  };

  // Recipes EINMAL laden — wird sowohl von generatePackMeta (als ReelRow-
  // Adapter) als auch von generatePackForeword (als Titel-Liste) gebraucht.
  // loadVisibleRecipesForPack mischt static + custom + hidden-Filter, exakt
  // wie der Pack-PDF-Renderer es macht — damit sieht die KI dieselbe Liste,
  // die im finalen PDF landet.
  const needsRecipes =
    textFieldsToUpdate.length > 0 ||
    (forewordFieldsToUpdate.length > 0 && !!pack.foreword);
  const recipes = needsRecipes
    ? await loadVisibleRecipesForPack(brandSlug, packSlug)
    : [];

  // ─── Pack-Meta (title/subtitle/tagline/description/category) ──────────
  if (textFieldsToUpdate.length > 0) {
    try {
      const reels = recipesAsReelInputs(recipes, brandSlug);
      if (reels.length >= 1) {
        const meta = await generatePackMeta(reels, brand);
        for (const f of textFieldsToUpdate) {
          if (f === "title") patch.title = meta.title;
          else if (f === "subtitle") patch.subtitle = meta.subtitle;
          else if (f === "tagline") patch.tagline = meta.tagline;
          else if (f === "description") patch.description = meta.description;
          else if (f === "category") patch.category = meta.category;
          result.updated.push(f);
        }
      }
    } catch (err) {
      console.warn(
        "[regenerate-pack-meta] generatePackMeta failed (non-fatal):",
        err instanceof Error ? err.message : err
      );
    }
  }

  // ─── Foreword-Block ──────────────────────────────────────────────────
  if (forewordFieldsToUpdate.length > 0 && pack.foreword) {
    try {
      const recipeTitles = recipes.map((r) => r.title);
      const newForeword = await generatePackForeword(pack, brand, recipeTitles);
      const merged: NonNullable<Pack["foreword"]> = {
        greeting: lockedFields.has("foreword.greeting")
          ? pack.foreword.greeting
          : newForeword.greeting,
        story: lockedFields.has("foreword.story")
          ? pack.foreword.story
          : newForeword.story,
        signoff: lockedFields.has("foreword.signoff")
          ? pack.foreword.signoff
          : newForeword.signoff,
        ...(newForeword.outro || pack.foreword.outro
          ? {
              outro: lockedFields.has("foreword.outro")
                ? pack.foreword.outro
                : newForeword.outro,
            }
          : {}),
      };
      patch.foreword = merged;
      for (const f of forewordFieldsToUpdate) result.updated.push(f);
    } catch (err) {
      console.warn(
        "[regenerate-pack-meta] generatePackForeword failed (non-fatal):",
        err instanceof Error ? err.message : err
      );
    }
  }

  if (Object.keys(patch).length === 0) {
    return result;
  }

  const updated = await updateCustomPackData(packId, patch);
  result.pack = updated;
  result.changed = updated !== null;
  return result;
}
