import { getServerSupabase, hasServerSupabase } from "@/lib/supabase-server";
import { getReelsByIds, type ReelRow } from "@/lib/creator-reels-server";
import { parseRecipeFromCaption } from "@/lib/ai/parse-instagram";
import { moodPresets } from "@/lib/pack-presets";
import type { Pack, PackMood, CardLayout } from "@/lib/packs";
import type { Recipe } from "@/lib/recipes";

// Gemeinsame Logik fuer das Anlegen eines Packs aus einer Reel-Auswahl.
// Wird von zwei Endpoints genutzt:
//   - /api/pack-suggestions/[id]/accept (KI-Vorschlag annehmen)
//   - /api/packs/generate-auto (User-Filter im Auto-Pack-Modus)
//
// Flow:
//   1. Reels per ID laden
//   2. Captions parallel via Gemini Flash parsen → Recipes
//   3. Pack-Row anlegen (mit auto pack-number)
//   4. Recipe-Rows anlegen (mit sourceUrl auf den Reel → Reference-First-Hero)
//   5. Pack-Enrich fire-and-forget (Cover-Image-Generierung)
//   6. Recipe-Enrich fire-and-forget pro Recipe (Hero-Generierung, Story)
//
// Returnt das frisch angelegte Pack + Anzahl erfolgreicher Recipes.

export type BuildPackOptions = {
  brandSlug: string;
  reelIds: string[];
  pack: {
    slug: string;
    title: string;
    subtitle: string;
    tagline: string;
    description: string;
    category: string;
    mood: PackMood;
    displayFont: Pack["displayFont"];
    cardLayout: CardLayout;
  };
  /** Origin fuer interne Enrich-Lambda-Calls. Wir bekommen das aus dem
   *  einkommenden Request, damit der Trigger sowohl auf Vercel-Prod als
   *  auch Preview-URLs funktioniert. */
  origin: string;
  /** Optional: bereits existierende Cover-URL — wird von Pack-Suggestions
   *  durchgereicht (cover_url wurde beim Onboarding via Flux generiert).
   *  Verhindert doppelte Cover-Generierung beim Pack-Akzeptieren. */
  presetCoverImage?: string;
};

export type BuildPackResult = {
  packId: string;
  packSlug: string;
  recipeCount: number;
  parseFailures: number;
};

function slugifyRecipe(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

// Pickt einen Mood von label-id oder fallback auf cream.
export function pickMoodById(id: string): PackMood {
  return (
    moodPresets.find((m) => m.id === id)?.mood ?? moodPresets[0].mood
  );
}

export async function buildPackFromReels(
  opts: BuildPackOptions
): Promise<BuildPackResult | null> {
  if (!hasServerSupabase()) return null;
  if (opts.reelIds.length === 0) return null;

  const reels = await getReelsByIds(opts.reelIds);
  if (reels.length === 0) return null;

  // 1. Parse alle Captions parallel. Promise.allSettled — wir tolerieren
  // einzelne Fails (zu kurze Caption, KI fail't), kappen aber bei <3
  // Erfolgen (zu wenig fuer ein sinnvolles Pack).
  const parsedSettled = await Promise.allSettled(
    reels.map((r) => parseRecipeFromCaption(r.caption))
  );

  type ParsedEntry = {
    reel: ReelRow;
    parsed: import("@/lib/ai/parse-instagram").ParsedInstagramRecipe;
  };
  const successes: ParsedEntry[] = [];
  let failures = 0;
  parsedSettled.forEach((res, idx) => {
    if (res.status === "fulfilled" && res.value.ok) {
      successes.push({ reel: reels[idx], parsed: res.value.recipe });
    } else {
      failures += 1;
      const errMsg =
        res.status === "rejected"
          ? res.reason instanceof Error
            ? res.reason.message
            : String(res.reason)
          : (res as { value: { ok: false; error: string } }).value.error;
      console.warn(
        `[pack-builder] parse failed for reel ${reels[idx].ig_id}: ${errMsg}`
      );
    }
  });

  if (successes.length < 3) {
    console.warn(
      `[pack-builder] only ${successes.length} of ${reels.length} reels parsed — aborting`
    );
    return null;
  }

  const supabase = getServerSupabase();

  // 2. Pack-Number ableiten: static count waere fuer Code-Brand (Biene) =
  // packs.length, fuer DB-Brand = 0. Wir berechnen ueber den DB-pack-count
  // robust, weil der Pack-Builder Brand-agnostic ist.
  const { count: customCount } = await supabase
    .from("packs")
    .select("*", { count: "exact", head: true })
    .eq("brand_slug", opts.brandSlug)
    .eq("is_custom", true);

  // Best-effort Static-Count: lib/packs.ts ist code-only, importieren wir
  // server-side ohne Probleme.
  const { packs: codePacks } = await import("@/lib/packs");
  const staticCount = codePacks.filter((p) => p.brandSlug === opts.brandSlug)
    .length;
  const packNumber = staticCount + (customCount ?? 0) + 1;

  // 3. Pack-Row anlegen. coverImage entweder das vom Caller mitgegebene
  // Preset (Pack-Suggestion-Cover) ODER leer (dann generiert /packs/enrich
  // ein frisches Flux 2 Pro Cookbook-Cover).
  const packData: Pack = {
    slug: opts.pack.slug,
    brandSlug: opts.brandSlug,
    number: packNumber,
    title: opts.pack.title,
    subtitle: opts.pack.subtitle,
    category: opts.pack.category,
    tagline: opts.pack.tagline,
    description: opts.pack.description,
    recipeCount: successes.length,
    coverImage: opts.presetCoverImage ?? "",
    mood: opts.pack.mood,
    displayFont: opts.pack.displayFont,
    cardLayout: opts.pack.cardLayout,
  };

  const { data: packRow, error: packErr } = await supabase
    .from("packs")
    .insert({
      brand_slug: opts.brandSlug,
      pack_slug: opts.pack.slug,
      data: packData,
      is_custom: true,
    })
    .select("id, pack_slug")
    .single();

  if (packErr || !packRow) {
    console.error("[pack-builder] pack insert failed", packErr);
    return null;
  }

  // 4. Recipe-Rows anlegen. Slug-Conflict-Resolution mit Counter-Suffix.
  const recipeRows: Array<{
    brand_slug: string;
    pack_slug: string;
    recipe_slug: string;
    data: Recipe;
    is_custom: boolean;
  }> = [];

  const seenSlugs = new Set<string>();
  successes.forEach((entry, idx) => {
    const baseSlug =
      slugifyRecipe(entry.parsed.title) ||
      `rezept-${idx + 1}-${entry.reel.ig_id.slice(0, 6)}`;
    let slug = baseSlug;
    let counter = 2;
    while (seenSlugs.has(slug)) {
      slug = `${baseSlug}-${counter++}`;
    }
    seenSlugs.add(slug);

    // Hero-Placeholder: gecachte Reel-Cover-URL aus dem reel-covers
    // Supabase-Storage-Bucket. Permanent verfuegbar (im Gegensatz zur
    // display_url die nach ~1-3h expired). Wenn das Caching noch nicht
    // durch ist (cover_storage_url ist null), nehmen wir die display_url
    // als letzte Ausweg-Fallback. /api/recipes/enrich erkennt beide als
    // Platzhalter und triggert die Flux-Hero-Generation.
    const heroPlaceholder =
      (entry.reel as { cover_storage_url?: string | null }).cover_storage_url ??
      entry.reel.display_url ??
      "";

    const recipe: Recipe = {
      slug,
      packSlug: opts.pack.slug,
      number: idx + 1,
      title: entry.parsed.title || entry.reel.recipe_title || "Neues Rezept",
      subtitle: entry.parsed.subtitle,
      description: entry.parsed.description,
      prepTime: entry.parsed.prepTime,
      cookTime:
        entry.parsed.cookTime && entry.parsed.cookTime > 0
          ? entry.parsed.cookTime
          : undefined,
      difficulty: entry.parsed.difficulty,
      servings: entry.parsed.servings,
      tags: entry.parsed.tags,
      ingredients: entry.parsed.ingredients,
      steps: entry.parsed.steps,
      nutrition: {
        kcal: entry.parsed.nutrition.kcal,
        protein: entry.parsed.nutrition.protein,
        carbs: entry.parsed.nutrition.carbs,
        fat: entry.parsed.nutrition.fat,
      },
      nutritionBasis: entry.parsed.nutritionBasis,
      sourceUrl: entry.reel.post_url,
      sourceLabel: `Instagram · ${new URL(entry.reel.post_url).pathname.split("/").slice(0, 4).join("/")}`,
      hero: heroPlaceholder,
    };

    recipeRows.push({
      brand_slug: opts.brandSlug,
      pack_slug: opts.pack.slug,
      recipe_slug: slug,
      data: recipe,
      is_custom: true,
    });
  });

  const { data: insertedRecipes, error: recErr } = await supabase
    .from("recipes")
    .insert(recipeRows)
    .select("id");

  if (recErr) {
    console.error("[pack-builder] recipe inserts failed", recErr);
    // Pack steht schon — wir fahren mit dem fort, was wir haben.
  }

  const recipeCount = insertedRecipes?.length ?? recipeRows.length;

  // 5. Pack-Cover fire-and-forget. Existierender Endpoint /api/packs/enrich
  // erwartet { packId } und macht Cover + Foreword.
  void fetch(`${opts.origin}/api/packs/enrich`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ packId: packRow.id }),
  }).catch(() => {
    /* swallow — best-effort */
  });

  // 6. Recipe-Enrich fire-and-forget pro Recipe. Jeder eigener Lambda-Spawn
  // → Hero-Generation laeuft parallel und nicht hintereinander.
  if (insertedRecipes) {
    for (const row of insertedRecipes) {
      void fetch(`${opts.origin}/api/recipes/enrich`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipeId: row.id }),
      }).catch(() => {
        /* swallow */
      });
    }
  }

  return {
    packId: packRow.id,
    packSlug: packRow.pack_slug,
    recipeCount,
    parseFailures: failures,
  };
}
