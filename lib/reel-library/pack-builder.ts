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
  /** IDs der frisch angelegten Recipe-Rows. Caller muss die enrich-Calls
   *  selbst in seinem after()-Hook triggern — sonst werden Hero/Story
   *  fire-and-forget-Calls beim Lambda-Terminate abgewuergt (siehe
   *  Lessons-Learned 2026-05-13). */
  insertedRecipeIds: string[];
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
    // Custom-pack baseline stays 0 — the live count is the recipes-table
    // row count, which the pack/brand pages add on top. Storing
    // successes.length here double-counted (pack showed ~2× its recipes).
    recipeCount: 0,
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
      sourceLabel: "Original-Reel",
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
  const insertedRecipeIds = (insertedRecipes ?? []).map((r) => r.id as string);

  // WICHTIG: Hier KEINE fire-and-forget-fetch fuer enrich mehr!
  // Vorher: `void fetch(...)` → Lambda terminate'd vor Send → Cover-Gen
  // + Hero-Gen lief unzuverlaessig. Der Caller muss jetzt die enrich-
  // Calls in seinem eigenen after()-Hook triggern (siehe
  // /api/packs/generate-auto und /api/pack-suggestions/[id]/accept).

  return {
    packId: packRow.id,
    packSlug: packRow.pack_slug,
    recipeCount,
    parseFailures: failures,
    insertedRecipeIds,
  };
}

// Erkennt fehlende Enrichments in einem existierenden Pack und triggert
// nur die noetigen Calls — Safety-Net fuer Packs die bei der Erstellung
// nicht vollstaendig durchgelaufen sind (z.B. Lambda-Timeout, transienter
// Fehler in Flux/Gemini). Wird vom Pack-Detail-Server-Component
// aufgerufen via after() — User-getriggert ist das "die Pack-Detail-Seite
// oeffnen", was ein robuster, billiger Trigger ist (skipped wenn alles
// schon enrich'd).
//
// Returnt das Trigger-Promise damit der Caller es awaiten kann in after().
export async function detectAndTriggerEnrichGaps(
  origin: string,
  brandSlug: string,
  packSlug: string
): Promise<{
  triggeredPackEnrich: boolean;
  triggeredRecipeIds: string[];
}> {
  if (!hasServerSupabase()) {
    return { triggeredPackEnrich: false, triggeredRecipeIds: [] };
  }
  const supabase = getServerSupabase();

  // Pack-Row mit cover/foreword-Status laden
  const { data: packRow } = await supabase
    .from("packs")
    .select("id, data")
    .eq("brand_slug", brandSlug)
    .eq("pack_slug", packSlug)
    .eq("is_custom", true)
    .maybeSingle();

  if (!packRow) {
    return { triggeredPackEnrich: false, triggeredRecipeIds: [] };
  }

  const pack = packRow.data as Pack;
  // hasCover: zeigt der pack-covers-Bucket-Pfad? Suggestion-Covers (aus
  // pack-suggestion-covers/) zaehlen auch als OK, das ist der Optimierung
  // beim Pack-Suggestion-Accept geschuldet.
  const cover = pack.coverImage ?? "";
  const hasCover =
    cover.includes("/pack-covers/") ||
    cover.includes("/pack-suggestion-covers/") ||
    cover.includes("/uploads/");
  const hasForeword = Boolean(pack.foreword);
  const hasForewordImage = Boolean(pack.forewordImage);
  // Foreword-Image-Upgrade-Trigger: wenn das Pack genug Brand-Heroes hat
  // aber das aktuelle Foreword-Image noch ein Flux-Stillleben ist (nicht
  // `-collage.jpg`), wollen wir das spaeter zu einer Collage upgraden.
  // Wir entscheiden das aber erst NACH dem Recipe-Hero-Check unten.
  const forewordIsCollage =
    hasForewordImage && pack.forewordImage!.includes("-collage.jpg");

  // Recipe-Rows mit hero/micros-Status laden
  const { data: recipeRows } = await supabase
    .from("recipes")
    .select("id, data")
    .eq("brand_slug", brandSlug)
    .eq("pack_slug", packSlug);

  const recipeIdsToEnrich: string[] = [];
  let brandHeroCount = 0;
  for (const row of recipeRows ?? []) {
    const recipe = row.data as Recipe;
    const hero = recipe.hero ?? "";
    const isPlaceholderHero =
      !hero ||
      /cdninstagram\.com|fbcdn\.net|tiktokcdn|tiktok-domain/i.test(hero) ||
      /\/reel-covers\//i.test(hero);
    if (!isPlaceholderHero && hero) brandHeroCount += 1;
    const microsEmpty =
      !recipe.nutrition?.micros || recipe.nutrition.micros.length === 0;
    const microsAttempted = Boolean(recipe.nutrition?.microsAttemptedAt);
    // Trigger wenn:
    //   - Hero fehlt/ist-Placeholder
    //   - Mikros leer UND kein Failure-Marker (sonst retry forever)
    if (isPlaceholderHero || (microsEmpty && !microsAttempted)) {
      recipeIdsToEnrich.push(row.id as string);
    }
  }

  // Foreword-Collage-Upgrade: wenn jetzt 3+ Brand-Heroes da sind und das
  // Foreword-Image noch ein Flux-Stillleben ist, regenerieren wir es als
  // Collage. forewordImage steht dann auf das alte Bild — wir triggern
  // /packs/enrich mit forceForewordImage=true.
  const needsForewordUpgrade =
    !forewordIsCollage && brandHeroCount >= 3 && hasForewordImage;

  const needsPackEnrich =
    !hasCover || !hasForeword || !hasForewordImage || needsForewordUpgrade;

  if (!needsPackEnrich && recipeIdsToEnrich.length === 0) {
    return { triggeredPackEnrich: false, triggeredRecipeIds: [] };
  }

  console.log(
    `[pack-builder] gap-trigger for ${brandSlug}/${packSlug}: ` +
      `pack-enrich=${needsPackEnrich}, recipe-enrich=${recipeIdsToEnrich.length}`
  );

  const internalToken = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const headers = {
    "Content-Type": "application/json",
    "x-internal-token": internalToken,
  };

  // fire-and-forget aber awaited damit die parent-Lambda alive bleibt bis
  // die HTTP-Calls initiiert sind. allSettled damit ein fail die anderen
  // nicht blockiert.
  const calls: Promise<unknown>[] = [];
  if (needsPackEnrich) {
    calls.push(
      fetch(`${origin}/api/packs/enrich`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          packId: packRow.id,
          // forceForewordImage wenn Upgrade von Flux-Stillleben zu Collage
          // gewuenscht ist (3+ Brand-Heroes verfuegbar)
          ...(needsForewordUpgrade ? { forceForewordImage: true } : {}),
        }),
      }).catch((err) =>
        console.warn("[pack-builder] gap pack-enrich failed", err)
      )
    );
  }
  for (const id of recipeIdsToEnrich) {
    calls.push(
      fetch(`${origin}/api/recipes/enrich`, {
        method: "POST",
        headers,
        body: JSON.stringify({ recipeId: id }),
      }).catch((err) =>
        console.warn("[pack-builder] gap recipe-enrich failed", err)
      )
    );
  }
  await Promise.allSettled(calls);

  return {
    triggeredPackEnrich: needsPackEnrich,
    triggeredRecipeIds: recipeIdsToEnrich,
  };
}

// Helper fuer die Caller-Routes: triggert /packs/enrich und /recipes/enrich
// in einem after()-Hook. Stellt sicher dass die Lambda alive bleibt bis
// alle fetch-Calls initiiert sind, NextJS terminate'd dann sauber.
//
// X-Internal-Token: Server-Side-fetch hat kein Session-Cookie und wird
// sonst von der Auth-Middleware zu /login redirected. Mit dem Header
// (= SUPABASE_SERVICE_ROLE_KEY) laesst die Middleware den Call durch.
export async function triggerEnrichForBuiltPack(
  origin: string,
  packId: string,
  recipeIds: string[]
): Promise<void> {
  const internalToken = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  console.log(
    `[pack-builder] triggering enrich for packId=${packId} + ${recipeIds.length} recipes (internal-token ${internalToken ? "set" : "MISSING"})`
  );
  const headers = {
    "Content-Type": "application/json",
    "x-internal-token": internalToken,
  };
  // Pack-Cover + Foreword parallel mit allen Recipe-Heroes. allSettled
  // damit ein failing Call die anderen nicht blockiert.
  const results = await Promise.allSettled([
    fetch(`${origin}/api/packs/enrich`, {
      method: "POST",
      headers,
      body: JSON.stringify({ packId }),
    }),
    ...recipeIds.map((id) =>
      fetch(`${origin}/api/recipes/enrich`, {
        method: "POST",
        headers,
        body: JSON.stringify({ recipeId: id }),
      })
    ),
  ]);
  results.forEach((r, idx) => {
    if (r.status === "rejected") {
      console.warn(
        `[pack-builder] enrich call ${idx} rejected:`,
        r.reason instanceof Error ? r.reason.message : r.reason
      );
    } else if (r.value && !r.value.ok) {
      console.warn(
        `[pack-builder] enrich call ${idx} returned HTTP ${r.value.status} ${r.value.statusText} (URL: ${r.value.url})`
      );
    }
  });
}
