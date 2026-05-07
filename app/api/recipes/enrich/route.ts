import { NextResponse, after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateMicros } from "@/lib/ai/generate-micros";
import { generateStory } from "@/lib/ai/generate-story";
import { generateImageSpec } from "@/lib/ai/recipe-image-spec";
import { buildPrompt } from "@/lib/ai/image-prompts";
import { generateImage, downloadImage } from "@/lib/ai/bfl-flux";
import { getServerSupabase, hasServerSupabase } from "@/lib/supabase-server";
import { getBrand } from "@/lib/brands";
import { getPack } from "@/lib/packs";
import { getCustomPackServer } from "@/lib/custom-packs-server";
import type { Recipe } from "@/lib/recipes";

// Server route that fills in Gemini-derived micros AND a Flux 2 Pro hero
// image for a single saved custom recipe. Triggered fire-and-forget by the
// editor after a save. Both run in parallel in the background, single DB
// update at the end.
export const runtime = "nodejs";
// Hero generation is the long pole — Flux 2 Pro takes 15-25s, occasionally
// up to 90s under load. 90s gives us margin.
export const maxDuration = 90;

const HERO_BUCKET = "recipe-heroes";

type Body = {
  recipeId: string;
};

export async function POST(req: Request) {
  if (!hasServerSupabase()) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 500 }
    );
  }
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "Gemini API key not configured" },
      { status: 500 }
    );
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body?.recipeId) {
    return NextResponse.json(
      { error: "recipeId is required" },
      { status: 400 }
    );
  }

  const supabase = getServerSupabase();
  const { data: row, error } = await supabase
    .from("recipes")
    .select("id, brand_slug, pack_slug, data")
    .eq("id", body.recipeId)
    .maybeSingle();
  if (error || !row) {
    return NextResponse.json(
      { error: error?.message ?? "Recipe not found" },
      { status: 404 }
    );
  }

  const recipe = row.data as Recipe;
  const brandSlug = (row.brand_slug as string) || "biene";
  const packSlug = (row.pack_slug as string) || recipe.packSlug;
  const brand = getBrand(brandSlug);
  const pack =
    getPack(brandSlug, packSlug) ??
    (await getCustomPackServer(brandSlug, packSlug));

  const needsMicros =
    !recipe.nutrition?.micros || recipe.nutrition.micros.length === 0;
  const needsHero = !recipe.hero;
  // Story is "needed" if the description is empty or still equals the
  // pack-level fallback we wrote at save time. Once the user types their
  // own description (or a previous AI-Story has run), we leave it alone.
  const needsStory =
    Boolean(brand && pack) &&
    (!recipe.description ||
      recipe.description.trim() === "" ||
      recipe.description.trim() === pack?.description.trim());

  if (!needsMicros && !needsHero && !needsStory) {
    return NextResponse.json({
      status: "already-enriched",
      recipeId: row.id,
    });
  }

  // ─── MIKROS: SYNC vor der Response ──────────────────────────────────
  // Frueher lief das in after() parallel zu Hero + Story. Das hatte
  // zwei Probleme auf Vercel:
  //   1. Wenn der Editor-Trigger als fire-and-forget (kurz vor router.push)
  //      lief, hat der Browser den Fetch beim Navigieren manchmal abgebrochen
  //      — die Lambda startete in dem Fall gar nicht erst.
  //   2. Wenn die Hero-Pipeline (Flux 2 Pro) 60s+ brauchte und das Lambda-
  //      Limit erreicht war, wurden alle after()-Tasks abgewuergt — auch
  //      Mikros, die eigentlich nach 5s laengst durch gewesen waeren.
  // Fix: Mikros laufen synchron VOR der Response. Wenn der Endpoint 200
  // returnt, sind die Mikros garantiert in der DB. Das Detail-Polling
  // sieht sie beim ersten Refetch.
  if (needsMicros) {
    try {
      const micros = await generateMicros(recipe);
      await mergeRecipeData(row.id, (current) => ({
        nutrition: { ...current.nutrition, micros },
      }));
    } catch (err) {
      console.error("[enrich] micros failed sync for", body.recipeId, err);
      // Wir failen nicht hart — Hero + Story sollen trotzdem laufen.
    }
  }

  // ─── HERO + STORY: ASYNC nach der Response ──────────────────────────
  // Hero ist der lange Pol (Flux 2 Pro, 15-90s), Story braucht ~3-5s
  // bei Gemini. Beide laufen in after() weiter, nachdem die Response
  // schon raus ist. Das Detail-Polling holt die Werte ab, sobald sie
  // in der DB stehen.
  if (needsHero) {
    after(async () => {
      try {
        const heroUrl = await generateAndUploadHero(
          recipe,
          row.id,
          brandSlug
        );
        if (heroUrl) {
          await mergeRecipeData(row.id, () => ({ hero: heroUrl }));
        }
      } catch (err) {
        console.error("[enrich] hero failed for", body.recipeId, err);
      }
    });
  }

  if (needsStory && brand && pack) {
    after(async () => {
      try {
        const story = await generateStory(recipe, pack, brand);
        if (story && story.length > 20) {
          // Only overwrite if the user hasn't typed their own copy in the
          // meantime. mergeRecipeData re-reads the row inside the merge.
          await mergeRecipeData(row.id, (current) => {
            const userTouched =
              current.description &&
              current.description.trim() !== "" &&
              current.description.trim() !== pack.description.trim();
            if (userTouched) return {};
            return { description: story };
          });
        }
      } catch (err) {
        console.error("[enrich] story failed for", body.recipeId, err);
      }
    });
  }

  return NextResponse.json(
    {
      status: "enriching",
      recipeId: row.id,
      micros: needsMicros,
      hero: needsHero,
      story: needsStory,
    },
    { status: 202 }
  );
}

// Generate the recipe hero via the same pipeline used for the static 37
// recipes (Gemini Stage 2 → Brand-DNA override → Flux 2 Pro), then upload to
// Supabase Storage and return the public URL. Returns null if BFL is not
// configured (graceful skip — micros still run).
async function generateAndUploadHero(
  recipe: Recipe,
  recipeId: string,
  brandSlug: string
): Promise<string | null> {
  if (!process.env.BFL_API_KEY) {
    console.warn("[enrich] BFL_API_KEY missing — skipping hero generation");
    return null;
  }

  const spec = await generateImageSpec(recipe, brandSlug);
  const { prompt, negative } = buildPrompt("hero", recipe, spec, brandSlug);
  const result = await generateImage({
    prompt,
    negativePrompt: negative,
    model: "flux-2-pro",
    aspectRatio: "1:1",
    outputFormat: "jpeg",
    safetyTolerance: 2,
  });
  const buf = await downloadImage(result.imageUrl);

  const supabase = getServerSupabase();
  await ensureHeroBucket(supabase);

  const filePath = `${recipeId}.jpg`;
  const upload = await supabase.storage
    .from(HERO_BUCKET)
    .upload(filePath, buf, {
      contentType: "image/jpeg",
      upsert: true,
      cacheControl: "31536000", // 1 year — file path is recipeId-keyed, never reused
    });
  if (upload.error) {
    console.error("[enrich] hero upload failed:", upload.error.message);
    return null;
  }

  const { data } = supabase.storage.from(HERO_BUCKET).getPublicUrl(filePath);
  return data.publicUrl ?? null;
}

// First-call: create the public bucket. Subsequent calls hit the
// "already exists" branch and no-op. Idempotent — safe to call every time.
async function ensureHeroBucket(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.storage.createBucket(HERO_BUCKET, {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg"],
  });
  if (error && !/already exists/i.test(error.message)) {
    console.warn("[enrich] bucket create warning:", error.message);
  }
}

// Read-modify-write merge into recipes.data. Used when independent
// background tasks (micros + hero) write into the same row but at
// different times — without this, the slower task would clobber whatever
// the faster task already persisted. The `partial` callback gets the
// current row data so it can compose nested fields (e.g. nutrition.micros
// without losing nutrition.kcal).
async function mergeRecipeData(
  id: string,
  partial: (current: Recipe) => Partial<Recipe>
): Promise<void> {
  const supabase = getServerSupabase();
  const { data: latest, error: readErr } = await supabase
    .from("recipes")
    .select("data")
    .eq("id", id)
    .maybeSingle();
  if (readErr || !latest) {
    console.error("[enrich] mergeRecipeData read failed", id, readErr);
    return;
  }
  const current = latest.data as Recipe;
  const merged = { ...current, ...partial(current) };
  const { error: writeErr } = await supabase
    .from("recipes")
    .update({ data: merged })
    .eq("id", id);
  if (writeErr) {
    console.error("[enrich] mergeRecipeData write failed", id, writeErr);
  }
}
