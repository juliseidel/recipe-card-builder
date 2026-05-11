import type { SupabaseClient } from "@supabase/supabase-js";
import { generateImage, downloadImage } from "./bfl-flux";
import { generateImageSpec } from "./recipe-image-spec";
import { buildPrompt } from "./image-prompts";
import { getServerSupabase } from "@/lib/supabase-server";
import type { Recipe } from "@/lib/recipes";

// Zentrale Hero-Pipeline (Phase-3-Rebuild — Jan's korrekter Workflow):
//   1) Apify scraped Caption + videoUrl
//   2) ffmpeg extrahiert ~14 Frames aus dem Reel-Video
//   3) Gemini Vision waehlt den besten sauberen Keyframe
//   4) Flux Kontext Pro rendert ein brand-style Bild mit dem Keyframe als
//      Reference — sauber, kein Text, kein Talking-Head, matched aber das
//      echte Reel-Gericht.
// Fallback (forceFlux oder Pipeline-Failure): klassischer text-only Flux
// 2 Pro mit Brand-DNA-Prompt, ohne Reference.

const HERO_BUCKET = "recipe-heroes";

export type GenerateHeroOpts = {
  recipe: Recipe;
  /** UUID der DB-Row — gleichzeitig der Storage-Pfad ({uuid}.jpg). */
  recipeId: string;
  brandSlug: string;
  /** True erzwingt text-only Flux 2 Pro — fuer den "KI-Alternative"-Button,
   *  wenn der Operator das Reel-Frame-basierte Bild nicht mag. */
  forceFlux?: boolean;
};

export type GenerateHeroResult = {
  heroUrl: string;
  source: "keyframe" | "flux-text-only";
  /** Bei keyframe: Begruendung aus Gemini-Vision-Pick, sonst null. */
  keyframeReasoning?: string;
  /** Bei keyframe: gewaehlter Timestamp im Video. */
  keyframeTimestamp?: number;
};

/**
 * Top-Level Entry-Point. Returnt die public-URL des hochgeladenen JPEGs
 * oder null, wenn nichts klappt.
 *
 * ROLLBACK 2026-05-11 nachmittags: die Keyframe-Pipeline (Apify videoUrl →
 * ffmpeg → Gemini Vision → Flux Kontext Pro mit Reference) lieferte
 * Bilder, die das Original-Reel nicht ausreichend matchten — Flux Kontext
 * Pro interpretierte die Reference zu kreativ. Bis der Prompt-Bug gefixt
 * ist (heroPrompt fehlt Jan's "dish shape and color and garnish placement
 * matching the reference"-Wording), fallen wir auf die alte text-only
 * Flux-2-Pro-Pipeline zurueck, die schon die 37 statischen Bienes-Heroes
 * generiert hat — brand-style Bilder, die zum Rezept passen.
 *
 * Die uploadKeyframeBasedHero-Funktion bleibt im Code (s. u.), wird aber
 * nicht aufgerufen, bis der Prompt-Fix verifiziert ist.
 */
export async function generateHeroForRecipe(
  opts: GenerateHeroOpts
): Promise<GenerateHeroResult | null> {
  const heroUrl = await uploadTextOnlyFluxHero(
    opts.recipe,
    opts.recipeId,
    opts.brandSlug
  );
  if (!heroUrl) return null;
  return { heroUrl, source: "flux-text-only" };
}

// ─── Path A: Keyframe-basiert ──────────────────────────────────────────────
async function uploadKeyframeBasedHero(opts: {
  sourceUrl: string;
  recipe: Recipe;
  recipeId: string;
  brandSlug: string;
}): Promise<GenerateHeroResult | null> {
  if (!process.env.BFL_API_KEY) {
    console.warn("[generate-hero] BFL_API_KEY missing");
    return null;
  }
  const { sourceUrl, recipe, recipeId, brandSlug } = opts;

  // 1) Apify scraped Video-URL
  const { scrapeInstagramPost, normalizeInstagramUrl } = await import(
    "@/lib/integrations/apify"
  );
  const normalized = normalizeInstagramUrl(sourceUrl);
  if (!normalized) return null;
  const post = await scrapeInstagramPost(normalized);
  if (!post.videoUrl) {
    console.warn(
      `[generate-hero] post ${recipeId} hat keinen videoUrl — fallback`
    );
    return null;
  }

  // 2) ffmpeg extrahiert Frames
  const { extractVideoFrames } = await import("./extract-video-frames");
  const frames = await extractVideoFrames(post.videoUrl, {
    intervalSeconds: 1.5,
    maxFrames: 14,
  });
  if (frames.length === 0) {
    console.warn(`[generate-hero] keine Frames extrahiert fuer ${recipeId}`);
    return null;
  }

  // 3) Gemini Vision waehlt
  const { selectBestKeyframe } = await import("./select-keyframe");
  const selection = await selectBestKeyframe({
    frames,
    recipeTitle: recipe.title,
    caption: post.caption,
  });
  console.log(
    `[generate-hero] keyframe ${recipeId}: idx=${selection.index}, t=${selection.frame.timestampSeconds}s — ${selection.reasoning.slice(0, 120)}`
  );

  // 4) Spec + Prompt
  const spec = await generateImageSpec(recipe, brandSlug);
  const { prompt, negative } = buildPrompt("hero", recipe, spec, brandSlug);

  // 5) Flux Kontext Pro mit Reference
  const result = await generateImage({
    prompt,
    negativePrompt: negative,
    model: "flux-kontext-pro",
    aspectRatio: "1:1",
    outputFormat: "jpeg",
    safetyTolerance: 2,
    referenceImage: selection.frame.dataUri,
  });
  const buf = await downloadImage(result.imageUrl);

  // 6) Upload
  const supabase = getServerSupabase();
  await ensureHeroBucket(supabase);
  const heroUrl = await uploadJpeg(supabase, recipeId, buf);
  if (!heroUrl) return null;

  return {
    heroUrl,
    source: "keyframe",
    keyframeReasoning: selection.reasoning,
    keyframeTimestamp: selection.frame.timestampSeconds,
  };
}

// ─── Path B: text-only Flux 2 Pro (Fallback) ───────────────────────────────
async function uploadTextOnlyFluxHero(
  recipe: Recipe,
  recipeId: string,
  brandSlug: string
): Promise<string | null> {
  if (!process.env.BFL_API_KEY) {
    console.warn("[generate-hero] BFL_API_KEY missing — skipping fallback");
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
  return await uploadJpeg(supabase, recipeId, buf);
}

// ─── Storage-Helpers ───────────────────────────────────────────────────────
async function uploadJpeg(
  supabase: SupabaseClient,
  recipeId: string,
  buf: Buffer
): Promise<string | null> {
  const filePath = `${recipeId}.jpg`;
  const upload = await supabase.storage
    .from(HERO_BUCKET)
    .upload(filePath, buf, {
      contentType: "image/jpeg",
      upsert: true,
      cacheControl: "31536000",
    });
  if (upload.error) {
    console.error("[generate-hero] upload failed:", upload.error.message);
    return null;
  }
  const { data } = supabase.storage.from(HERO_BUCKET).getPublicUrl(filePath);
  return data.publicUrl ?? null;
}

async function ensureHeroBucket(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.storage.createBucket(HERO_BUCKET, {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg"],
  });
  if (error && !/already exists/i.test(error.message)) {
    console.warn("[generate-hero] bucket create warning:", error.message);
  }
}
