import { getServerSupabase, hasServerSupabase } from "./supabase-server";
import type { BackfillReel } from "./integrations/apify";
import type { SocialPlatform } from "./integrations/platform";

// Server-Side DB-Access fuer die Reel-Library + Scrape-Tracker +
// Pack-Suggestions. Alle Schreibzugriffe gehen ueber den Service-Role-
// Client (Bypass RLS), Reads sind ueber Public-Read-Policy auch ohne
// Auth moeglich, aber wir bleiben konsistent server-side.

// ─── Types ─────────────────────────────────────────────────────────────────

export type ScrapeStatus = "running" | "classifying" | "done" | "failed";

export type ScrapeRow = {
  id: string;
  brand_slug: string;
  apify_run_id: string | null;
  status: ScrapeStatus;
  started_at: string;
  finished_at: string | null;
  reel_count: number;
  recipe_count: number;
  suggestion_count: number;
  error: string | null;
  platform: SocialPlatform;
};

export type ReelClassification = {
  isRecipe: boolean;
  recipeConfidence: number;
  recipeTitle: string | null;
  mealType: string | null;
  cuisine: string | null;
  mainIngredient: string | null;
  dietary: string[];
  estimatedTimeMinutes: number | null;
  /** Phase 2b: erweiterte Klassifikation fuer Filter-Reichtum im Auto-Pack-
   *  Builder. Alle nullable, Gemini fuellt nach bestem Wissen. */
  occasion: string | null;
  season: string | null;
  skillLevel: string | null;
  vessel: string | null;
};

export type ReelRow = {
  id: string;
  brand_slug: string;
  ig_id: string;
  post_url: string;
  type: string;
  caption: string;
  display_url: string | null;
  video_url: string | null;
  posted_at: string | null;
  like_count: number | null;
  view_count: number | null;
  comment_count: number | null;
  hashtags: string[];
  is_recipe: boolean | null;
  recipe_confidence: number | null;
  recipe_title: string | null;
  meal_type: string | null;
  cuisine: string | null;
  main_ingredient: string | null;
  dietary: string[];
  estimated_time_minutes: number | null;
  occasion: string | null;
  season: string | null;
  skill_level: string | null;
  vessel: string | null;
  classified_at: string | null;
  scraped_at: string;
  /** Quelle des Reels — gleicher Wert wie creator_scrapes.platform beim
   *  ersten Insert. Default 'instagram' fuer Bestands-Rows. */
  platform: SocialPlatform;
  /** Permanente Cover-URL im Supabase Storage (reel-covers Bucket).
   *  display_url ist Instagram-CDN mit ~1-3h Expiry, daher cachen wir
   *  die Cover beim Backfill. null = noch nicht gecached. UI nutzt
   *  cover_storage_url bevorzugt vor display_url. */
  cover_storage_url: string | null;
};

export type SuggestionStatus = "pending" | "accepted" | "dismissed";

export type SuggestionRow = {
  id: string;
  brand_slug: string;
  title: string;
  subtitle: string;
  tagline: string;
  description: string;
  category: string;
  reel_ids: string[];
  reasoning: string;
  score: number | null;
  status: SuggestionStatus;
  accepted_pack_id: string | null;
  created_at: string;
  updated_at: string;
  /** KI-generiertes Pack-Cover (Flux 2 Pro), wird im Hintergrund nach
   *  Suggestions-Generation gerendert. null = noch nicht fertig oder
   *  Cover-Generation failed. UI faellt dann auf Reel-Cover-Background
   *  zurueck. */
  cover_url: string | null;
};

// ─── Scrapes ───────────────────────────────────────────────────────────────

// Legt einen neuen Scrape-Job an (Status 'running'). Returnt die DB-id, die
// der Caller fuer subsequent Updates braucht. apify_run_id wird gleich
// danach via updateScrapeRunId gesetzt — wir splitten das, damit wir die
// DB-Row schon haben, wenn der Apify-Call selber fehlschlaegt.
export async function createScrape(
  brandSlug: string,
  platform: SocialPlatform = "instagram"
): Promise<string | null> {
  if (!hasServerSupabase()) return null;
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("creator_scrapes")
    .insert({ brand_slug: brandSlug, status: "running", platform })
    .select("id")
    .single();
  if (error) {
    console.error("[creator-reels] createScrape failed", error);
    return null;
  }
  return data.id as string;
}

export async function updateScrapeRunId(
  scrapeId: string,
  apifyRunId: string
): Promise<void> {
  const supabase = getServerSupabase();
  const { error } = await supabase
    .from("creator_scrapes")
    .update({ apify_run_id: apifyRunId })
    .eq("id", scrapeId);
  if (error) console.error("[creator-reels] updateScrapeRunId failed", error);
}

export async function updateScrapeStatus(
  scrapeId: string,
  status: ScrapeStatus,
  opts: {
    reelCount?: number;
    recipeCount?: number;
    suggestionCount?: number;
    error?: string;
  } = {}
): Promise<void> {
  const supabase = getServerSupabase();
  const patch: Record<string, unknown> = { status };
  if (status === "done" || status === "failed") {
    patch.finished_at = new Date().toISOString();
  }
  if (typeof opts.reelCount === "number") patch.reel_count = opts.reelCount;
  if (typeof opts.recipeCount === "number")
    patch.recipe_count = opts.recipeCount;
  if (typeof opts.suggestionCount === "number")
    patch.suggestion_count = opts.suggestionCount;
  if (opts.error) patch.error = opts.error.slice(0, 1000);
  const { error } = await supabase
    .from("creator_scrapes")
    .update(patch)
    .eq("id", scrapeId);
  if (error) console.error("[creator-reels] updateScrapeStatus failed", error);
}

export async function getScrapeByRunId(
  apifyRunId: string
): Promise<ScrapeRow | null> {
  if (!hasServerSupabase()) return null;
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("creator_scrapes")
    .select("*")
    .eq("apify_run_id", apifyRunId)
    .maybeSingle();
  if (error) {
    console.error("[creator-reels] getScrapeByRunId failed", error);
    return null;
  }
  return (data as ScrapeRow) ?? null;
}

export async function getLatestScrapeForBrand(
  brandSlug: string
): Promise<ScrapeRow | null> {
  if (!hasServerSupabase()) return null;
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("creator_scrapes")
    .select("*")
    .eq("brand_slug", brandSlug)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[creator-reels] getLatestScrapeForBrand failed", error);
    return null;
  }
  return (data as ScrapeRow) ?? null;
}

// ─── Reels ─────────────────────────────────────────────────────────────────

// Batch-Insert mit Upsert (ON CONFLICT brand_slug+ig_id → DO NOTHING).
// So koennen wir periodisch re-scrapen ohne Duplikate. Returnt die Anzahl
// tatsaechlich eingefuegter Rows (also der NEUEN Reels).
export async function upsertReels(
  brandSlug: string,
  reels: BackfillReel[],
  platform: SocialPlatform = "instagram"
): Promise<number> {
  if (!hasServerSupabase()) return 0;
  if (reels.length === 0) return 0;
  const supabase = getServerSupabase();

  // Chunk auf 100 Rows pro Insert — bei 500 Reels x ~3 KB raw-jsonb sind
  // wir sonst bei 1.5 MB Body, was Supabase serverseitig nicht moegen
  // koennte (Postgres-Row-Insert-Limits).
  const CHUNK = 100;
  let inserted = 0;
  for (let i = 0; i < reels.length; i += CHUNK) {
    const chunk = reels.slice(i, i + CHUNK).map((r) => ({
      brand_slug: brandSlug,
      ig_id: r.igId,
      post_url: r.postUrl,
      type: r.type,
      caption: r.caption,
      display_url: r.displayUrl,
      video_url: r.videoUrl,
      posted_at: r.postedAt,
      like_count: r.likeCount,
      view_count: r.viewCount,
      comment_count: r.commentCount,
      hashtags: r.hashtags,
      raw: r.raw,
      platform,
    }));
    const { data, error } = await supabase
      .from("creator_reels")
      .upsert(chunk, {
        onConflict: "brand_slug,ig_id",
        ignoreDuplicates: true,
      })
      .select("id");
    if (error) {
      console.error("[creator-reels] upsertReels chunk failed", error);
      continue;
    }
    inserted += data?.length ?? 0;
  }
  return inserted;
}

export async function countReelsForBrand(brandSlug: string): Promise<number> {
  if (!hasServerSupabase()) return 0;
  const supabase = getServerSupabase();
  const { count } = await supabase
    .from("creator_reels")
    .select("*", { count: "exact", head: true })
    .eq("brand_slug", brandSlug);
  return count ?? 0;
}

export async function countRecipeReelsForBrand(
  brandSlug: string
): Promise<number> {
  if (!hasServerSupabase()) return 0;
  const supabase = getServerSupabase();
  const { count } = await supabase
    .from("creator_reels")
    .select("*", { count: "exact", head: true })
    .eq("brand_slug", brandSlug)
    .eq("is_recipe", true);
  return count ?? 0;
}

// Zaehlt alle Reels mit classified_at != null fuer einen Brand. Wird vom
// Library-Status-Banner genutzt, um den Klassifikations-Fortschritt
// anzuzeigen ("150 von 498 klassifiziert"). Plus: Self-Healing-Trigger
// in library-status route — wenn classifiedCount sich >60s nicht geaendert
// hat, starten wir die Klassifikations-Pipeline erneut.
export async function countClassifiedReelsForBrand(
  brandSlug: string
): Promise<number> {
  if (!hasServerSupabase()) return 0;
  const supabase = getServerSupabase();
  const { count } = await supabase
    .from("creator_reels")
    .select("*", { count: "exact", head: true })
    .eq("brand_slug", brandSlug)
    .not("classified_at", "is", null);
  return count ?? 0;
}

// Jüngster classified_at-Zeitstempel fuer einen Brand. Self-Healing-
// Heuristik: wenn das Maximum >60s alt ist UND es noch unklassifizierte
// Reels gibt, gehen wir davon aus dass die letzte Klassifikation-Lambda
// terminated wurde, und triggern den Helper erneut. Returnt null wenn
// noch nichts klassifiziert ist.
export async function getLatestClassifiedAt(
  brandSlug: string
): Promise<string | null> {
  if (!hasServerSupabase()) return null;
  const supabase = getServerSupabase();
  const { data } = await supabase
    .from("creator_reels")
    .select("classified_at")
    .eq("brand_slug", brandSlug)
    .not("classified_at", "is", null)
    .order("classified_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.classified_at as string | null) ?? null;
}

// Holt unklassifizierte Reels eines Brands. Wird vom Klassifikations-
// Worker im Webhook-Handler aufgerufen. limit=auf 50 default damit ein
// Lambda das in einer Runde durchziehen kann.
export async function getUnclassifiedReels(
  brandSlug: string,
  limit = 50
): Promise<ReelRow[]> {
  if (!hasServerSupabase()) return [];
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("creator_reels")
    .select("*")
    .eq("brand_slug", brandSlug)
    .is("classified_at", null)
    .order("posted_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) {
    console.error("[creator-reels] getUnclassifiedReels failed", error);
    return [];
  }
  return (data as ReelRow[]) ?? [];
}

// Bulk-Read aller klassifizierten Rezept-Reels eines Brands. Wird vom
// Pack-Suggestions-Generator gebraucht (gibt alles an Gemini Pro).
export async function getRecipeReelsForBrand(
  brandSlug: string
): Promise<ReelRow[]> {
  if (!hasServerSupabase()) return [];
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("creator_reels")
    .select("*")
    .eq("brand_slug", brandSlug)
    .eq("is_recipe", true)
    .order("posted_at", { ascending: false, nullsFirst: false });
  if (error) {
    console.error("[creator-reels] getRecipeReelsForBrand failed", error);
    return [];
  }
  return (data as ReelRow[]) ?? [];
}

// Holt mehrere Reels anhand ihrer DB-UUIDs. Wird beim Annehmen eines
// Pack-Vorschlags genutzt: aus den reel_ids des Vorschlags die echten
// Reels laden um daraus Recipe-Rows zu bauen.
export async function getReelsByIds(ids: string[]): Promise<ReelRow[]> {
  if (!hasServerSupabase() || ids.length === 0) return [];
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("creator_reels")
    .select("*")
    .in("id", ids);
  if (error) {
    console.error("[creator-reels] getReelsByIds failed", error);
    return [];
  }
  return (data as ReelRow[]) ?? [];
}

// Filter-Query fuer den Auto-Pack-Builder. Multi-Select-OR-Match pro
// Dimension, AND-Match zwischen Dimensionen. dietaries ist ein Array-
// overlap (DB-Feld ist text[]), alles andere ist scalar IN-Match. maxTime
// filtert auf estimated_time_minutes<=N (null wird excluded).
export async function queryReelsForBrand(opts: {
  brandSlug: string;
  fromDate?: string;
  toDate?: string;
  mealTypes?: string[];
  cuisines?: string[];
  mainIngredients?: string[];
  dietaries?: string[];
  maxTimeMinutes?: number;
  occasions?: string[];
  seasons?: string[];
  skillLevels?: string[];
  vessels?: string[];
  limit?: number;
  onlyRecipes?: boolean;
}): Promise<ReelRow[]> {
  if (!hasServerSupabase()) return [];
  const supabase = getServerSupabase();
  let q = supabase
    .from("creator_reels")
    .select("*")
    .eq("brand_slug", opts.brandSlug);
  if (opts.onlyRecipes !== false) q = q.eq("is_recipe", true);
  if (opts.fromDate) q = q.gte("posted_at", opts.fromDate);
  if (opts.toDate) q = q.lte("posted_at", opts.toDate);
  if (opts.mealTypes && opts.mealTypes.length > 0) {
    q = q.in("meal_type", opts.mealTypes);
  }
  if (opts.cuisines && opts.cuisines.length > 0) {
    q = q.in("cuisine", opts.cuisines);
  }
  if (opts.mainIngredients && opts.mainIngredients.length > 0) {
    q = q.in("main_ingredient", opts.mainIngredients);
  }
  if (opts.occasions && opts.occasions.length > 0) {
    q = q.in("occasion", opts.occasions);
  }
  if (opts.seasons && opts.seasons.length > 0) {
    q = q.in("season", opts.seasons);
  }
  if (opts.skillLevels && opts.skillLevels.length > 0) {
    q = q.in("skill_level", opts.skillLevels);
  }
  if (opts.vessels && opts.vessels.length > 0) {
    q = q.in("vessel", opts.vessels);
  }
  if (opts.dietaries && opts.dietaries.length > 0) {
    // text[] overlap: matches wenn EINER der Tags im Array enthalten ist.
    // Wir bauen "{vegan,lowcarb}" als Postgres-array-literal.
    q = q.overlaps("dietary", opts.dietaries);
  }
  if (typeof opts.maxTimeMinutes === "number" && opts.maxTimeMinutes > 0) {
    q = q.lte("estimated_time_minutes", opts.maxTimeMinutes);
    q = q.gt("estimated_time_minutes", 0); // null/0 ausschliessen
  }
  q = q
    .order("like_count", { ascending: false, nullsFirst: false })
    .limit(opts.limit ?? 50);
  const { data, error } = await q;
  if (error) {
    console.error("[creator-reels] queryReelsForBrand failed", error);
    return [];
  }
  return (data as ReelRow[]) ?? [];
}

// ─── Tag-Aggregator (Smart-Hide-UI) ────────────────────────────────────────

export type TagBucket = { value: string; count: number };

export type ReelTagAggregates = {
  total: number;
  mealType: TagBucket[];
  cuisine: TagBucket[];
  mainIngredient: TagBucket[];
  dietary: TagBucket[];
  occasion: TagBucket[];
  season: TagBucket[];
  skillLevel: TagBucket[];
  vessel: TagBucket[];
  timeBuckets: TagBucket[]; // "<=15", "<=30", "<=60", ">60"
};

// Zaehlt pro Dimension die vorkommenden Werte + Anzahl Reels. Wird beim
// Mounten des Auto-Pack-Forms einmal geladen, damit die UI nur die
// wirklich vorkommenden Filter-Chips anzeigt (Smart-Hide). Server-side
// Aggregation ware schoener (PG GROUP BY) — wir machen es client-side
// per JS, weil Supabase's PostgREST keinen sauberen GROUP BY hat. Bei
// ~500 Reels pro Brand ist das problemlos.
export async function getReelTagAggregates(
  brandSlug: string
): Promise<ReelTagAggregates> {
  const empty: ReelTagAggregates = {
    total: 0,
    mealType: [],
    cuisine: [],
    mainIngredient: [],
    dietary: [],
    occasion: [],
    season: [],
    skillLevel: [],
    vessel: [],
    timeBuckets: [],
  };
  if (!hasServerSupabase()) return empty;
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("creator_reels")
    .select(
      "meal_type, cuisine, main_ingredient, dietary, estimated_time_minutes, occasion, season, skill_level, vessel"
    )
    .eq("brand_slug", brandSlug)
    .eq("is_recipe", true);
  if (error) {
    console.error("[creator-reels] getReelTagAggregates failed", error);
    return empty;
  }
  type Row = {
    meal_type: string | null;
    cuisine: string | null;
    main_ingredient: string | null;
    dietary: string[] | null;
    estimated_time_minutes: number | null;
    occasion: string | null;
    season: string | null;
    skill_level: string | null;
    vessel: string | null;
  };
  const rows = (data as Row[]) ?? [];

  const counts = {
    mealType: new Map<string, number>(),
    cuisine: new Map<string, number>(),
    mainIngredient: new Map<string, number>(),
    dietary: new Map<string, number>(),
    occasion: new Map<string, number>(),
    season: new Map<string, number>(),
    skillLevel: new Map<string, number>(),
    vessel: new Map<string, number>(),
    time: new Map<string, number>(),
  };

  const bump = (m: Map<string, number>, key: string | null | undefined) => {
    if (!key) return;
    m.set(key, (m.get(key) ?? 0) + 1);
  };

  for (const r of rows) {
    bump(counts.mealType, r.meal_type);
    bump(counts.cuisine, r.cuisine);
    bump(counts.mainIngredient, r.main_ingredient);
    bump(counts.occasion, r.occasion);
    bump(counts.season, r.season);
    bump(counts.skillLevel, r.skill_level);
    bump(counts.vessel, r.vessel);
    if (Array.isArray(r.dietary)) {
      for (const d of r.dietary) if (d) bump(counts.dietary, d);
    }
    const t = r.estimated_time_minutes;
    if (typeof t === "number" && t > 0) {
      if (t <= 15) bump(counts.time, "<=15");
      else if (t <= 30) bump(counts.time, "<=30");
      else if (t <= 60) bump(counts.time, "<=60");
      else bump(counts.time, ">60");
    }
  }

  const toBuckets = (m: Map<string, number>): TagBucket[] =>
    [...m.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);

  return {
    total: rows.length,
    mealType: toBuckets(counts.mealType),
    cuisine: toBuckets(counts.cuisine),
    mainIngredient: toBuckets(counts.mainIngredient),
    dietary: toBuckets(counts.dietary),
    occasion: toBuckets(counts.occasion),
    season: toBuckets(counts.season),
    skillLevel: toBuckets(counts.skillLevel),
    vessel: toBuckets(counts.vessel),
    timeBuckets: toBuckets(counts.time),
  };
}

// Schreibt die Klassifikations-Felder eines einzelnen Reels in die DB.
// Wird vom Klassifikations-Worker pro Reel aufgerufen (oder batched
// nach jedem Gemini-Batch).
export async function updateReelClassification(
  id: string,
  c: ReelClassification
): Promise<void> {
  const supabase = getServerSupabase();
  const { error } = await supabase
    .from("creator_reels")
    .update({
      is_recipe: c.isRecipe,
      recipe_confidence: c.recipeConfidence,
      recipe_title: c.recipeTitle,
      meal_type: c.mealType,
      cuisine: c.cuisine,
      main_ingredient: c.mainIngredient,
      dietary: c.dietary,
      estimated_time_minutes: c.estimatedTimeMinutes,
      occasion: c.occasion,
      season: c.season,
      skill_level: c.skillLevel,
      vessel: c.vessel,
      classified_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    console.error("[creator-reels] updateReelClassification failed", error);
  }
}

// ─── Pack-Suggestions ──────────────────────────────────────────────────────

export type NewSuggestion = {
  brandSlug: string;
  title: string;
  subtitle?: string;
  tagline?: string;
  description?: string;
  category?: string;
  reelIds: string[];
  reasoning: string;
  score?: number;
};

export async function insertSuggestions(
  suggestions: NewSuggestion[]
): Promise<number> {
  if (!hasServerSupabase() || suggestions.length === 0) return 0;
  const supabase = getServerSupabase();
  const rows = suggestions.map((s) => ({
    brand_slug: s.brandSlug,
    title: s.title,
    subtitle: s.subtitle ?? "",
    tagline: s.tagline ?? "",
    description: s.description ?? "",
    category: s.category ?? "",
    reel_ids: s.reelIds,
    reasoning: s.reasoning,
    score: typeof s.score === "number" ? s.score : null,
  }));
  const { data, error } = await supabase
    .from("pack_suggestions")
    .insert(rows)
    .select("id");
  if (error) {
    console.error("[creator-reels] insertSuggestions failed", error);
    return 0;
  }
  return data?.length ?? 0;
}

export async function getSuggestionsForBrand(
  brandSlug: string,
  status: SuggestionStatus = "pending"
): Promise<SuggestionRow[]> {
  if (!hasServerSupabase()) return [];
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("pack_suggestions")
    .select("*")
    .eq("brand_slug", brandSlug)
    .eq("status", status)
    .order("score", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[creator-reels] getSuggestionsForBrand failed", error);
    return [];
  }
  return (data as SuggestionRow[]) ?? [];
}

// Juengster created_at-Zeitstempel der pending Suggestions eines Brands.
// Wird vom Cron benutzt, um Stale-Suggestions zu erkennen — wenn die
// Vorschlaege > 7 Tage alt sind ODER Monatswechsel war, regenerieren wir
// sie auch ohne neuen Scrape (sonst bleiben monats-spezifische Packs wie
// "Top Reels Mai" im Juni stehen).
export async function getLatestPendingSuggestionAt(
  brandSlug: string
): Promise<string | null> {
  if (!hasServerSupabase()) return null;
  const supabase = getServerSupabase();
  const { data } = await supabase
    .from("pack_suggestions")
    .select("created_at")
    .eq("brand_slug", brandSlug)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.created_at as string | null) ?? null;
}

export async function getSuggestionById(
  id: string
): Promise<SuggestionRow | null> {
  if (!hasServerSupabase()) return null;
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("pack_suggestions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[creator-reels] getSuggestionById failed", error);
    return null;
  }
  return (data as SuggestionRow) ?? null;
}

export async function updateSuggestionStatus(
  id: string,
  status: SuggestionStatus,
  acceptedPackId?: string
): Promise<void> {
  const supabase = getServerSupabase();
  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (acceptedPackId) patch.accepted_pack_id = acceptedPackId;
  const { error } = await supabase
    .from("pack_suggestions")
    .update(patch)
    .eq("id", id);
  if (error) console.error("[creator-reels] updateSuggestionStatus failed", error);
}

// Clear vor frischer Generierung: alle 'pending' Suggestions eines Brands
// loeschen (accepted/dismissed bleiben als History stehen).
export async function clearPendingSuggestions(
  brandSlug: string
): Promise<void> {
  if (!hasServerSupabase()) return;
  const supabase = getServerSupabase();
  const { error } = await supabase
    .from("pack_suggestions")
    .delete()
    .eq("brand_slug", brandSlug)
    .eq("status", "pending");
  if (error) console.error("[creator-reels] clearPendingSuggestions failed", error);
}

// Cover-URL fuer eine Suggestion setzen. Wird vom Suggestion-Cover-
// Generator aufgerufen nachdem das Flux-Bild in Supabase Storage liegt.
export async function updateSuggestionCover(
  suggestionId: string,
  coverUrl: string
): Promise<void> {
  if (!hasServerSupabase()) return;
  const supabase = getServerSupabase();
  const { error } = await supabase
    .from("pack_suggestions")
    .update({ cover_url: coverUrl, updated_at: new Date().toISOString() })
    .eq("id", suggestionId);
  if (error) {
    console.error("[creator-reels] updateSuggestionCover failed", error);
  }
}
