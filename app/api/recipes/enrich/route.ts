import { NextResponse, after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateMicros } from "@/lib/ai/generate-micros";
import { generateImageSpec } from "@/lib/ai/recipe-image-spec";
import { buildPrompt } from "@/lib/ai/image-prompts";
import { generateImage, downloadImage } from "@/lib/ai/bfl-flux";
import { getServerSupabase, hasServerSupabase } from "@/lib/supabase-server";
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
    .select("id, brand_slug, data")
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

  const needsMicros =
    !recipe.nutrition?.micros || recipe.nutrition.micros.length === 0;
  const needsHero = !recipe.hero;

  if (!needsMicros && !needsHero) {
    return NextResponse.json({
      status: "already-enriched",
      recipeId: row.id,
    });
  }

  // Two independent background tasks. Earlier we ran both inside one
  // Promise.allSettled and wrote to the DB at the end — that meant micros
  // (≈ 2-3 s with Gemini) had to wait for the hero render (15-90 s with
  // Flux 2 Pro under load), so the detail-view polling timed out before
  // anything appeared in the DB. Now each task writes its own field via
  // a fetch-merge-write helper as soon as it's ready. Polling sees micros
  // within seconds and the hero whenever Flux is done.
  if (needsMicros) {
    after(async () => {
      try {
        const micros = await generateMicros(recipe);
        await mergeRecipeData(row.id, (current) => ({
          nutrition: { ...current.nutrition, micros },
        }));
      } catch (err) {
        console.error("[enrich] micros failed for", body.recipeId, err);
      }
    });
  }

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

  return NextResponse.json(
    {
      status: "enriching",
      recipeId: row.id,
      micros: needsMicros,
      hero: needsHero,
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
