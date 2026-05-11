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
  /** Bei flux-text-only mit sourceUrl: was Gemini Vision auf dem Reel-
   *  Cover gesehen hat (kompakte englische Gericht-Beschreibung). */
  dishDescription?: string;
};

/**
 * Top-Level Entry-Point. Returnt die public-URL des hochgeladenen JPEGs
 * oder null, wenn nichts klappt.
 *
 * Pipeline (v5 — Jan's Hybrid-Approach):
 *
 *   IF sourceUrl vorhanden UND !forceFlux:
 *     1) Apify scraped Reel-Cover (displayUrl)
 *     2) Gemini 2.5 Flash Vision beschreibt NUR das Gericht in einem
 *        natuerlichen englischen Satz (holistic, kein Stichpunkt-Check)
 *     3) Flux Kontext Pro generiert mit:
 *        - Reference-Image: displayUrl (1:1 das echte Reel-Bild)
 *        - Text-Prompt: Brand-Style + Vision-Description + Jan's
 *          "preserve dish shape and color and garnish placement matching
 *          the reference image" Wording
 *     → Das Gericht wird visuell vom Reference-Bild uebernommen,
 *       Umgebung und Licht werden im Brand-Style neu gestagt.
 *
 *   ELSE (kein sourceUrl ODER forceFlux):
 *     → text-only Flux 2 Pro mit Brand-DNA-Prompt (kein Reel-Match,
 *       Flux interpretiert das Gericht aus dem Recipe-Text).
 */
export async function generateHeroForRecipe(
  opts: GenerateHeroOpts
): Promise<GenerateHeroResult | null> {
  const reelData = await maybeDescribeDishFromReel(opts);

  if (reelData && reelData.displayUrl) {
    const heroUrl = await uploadKontextHero({
      recipe: opts.recipe,
      recipeId: opts.recipeId,
      brandSlug: opts.brandSlug,
      dishDescription: reelData.description,
      referenceImageUrl: reelData.displayUrl,
    });
    if (heroUrl) {
      return {
        heroUrl,
        source: "flux-text-only",
        dishDescription: reelData.description ?? undefined,
      };
    }
    // Wenn Kontext failt, weiter mit text-only Fallback
    console.warn("[generate-hero] kontext failed, falling back to text-only");
  }

  const heroUrl = await uploadTextOnlyFluxHero(
    opts.recipe,
    opts.recipeId,
    opts.brandSlug,
    reelData?.description ?? null
  );
  if (!heroUrl) return null;
  return {
    heroUrl,
    source: "flux-text-only",
    dishDescription: reelData?.description ?? undefined,
  };
}

// Optional-Step vor Flux: wenn das Rezept aus Instagram stammt, Reel-Cover
// laden + Gemini Vision das Gericht beschreiben lassen. Returnt sowohl
// die Description als auch die displayUrl, damit der Aufrufer beides
// nutzen kann (description fuer text-prompt, displayUrl als reference).
async function maybeDescribeDishFromReel(
  opts: GenerateHeroOpts
): Promise<{ description: string | null; displayUrl: string | null } | null> {
  if (opts.forceFlux) return null;
  if (!opts.recipe.sourceUrl) return null;

  try {
    const { scrapeInstagramPost, normalizeInstagramUrl } = await import(
      "@/lib/integrations/apify"
    );
    const normalized = normalizeInstagramUrl(opts.recipe.sourceUrl);
    if (!normalized) return null;
    const post = await scrapeInstagramPost(normalized);
    if (!post.displayUrl) return null;

    const { describeInstagramDish } = await import("./describe-instagram-dish");
    const desc = await describeInstagramDish(post.displayUrl);
    if (desc) {
      console.log(
        `[generate-hero] vision-desc ${opts.recipeId}: ${desc.slice(0, 140)}`
      );
    }
    return { description: desc, displayUrl: post.displayUrl };
  } catch (err) {
    console.warn(
      "[generate-hero] vision pre-step failed, continuing without:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

// ─── Path A (v5 default): Flux Kontext Pro mit Reference-Image ─────────────
// Reel-Cover-URL geht als image_prompt direkt an BFL — das Gericht wird
// 1:1 vom Reference uebernommen, Umgebung und Licht werden neu gestagt.
async function uploadKontextHero(opts: {
  recipe: Recipe;
  recipeId: string;
  brandSlug: string;
  dishDescription: string | null;
  referenceImageUrl: string;
}): Promise<string | null> {
  if (!process.env.BFL_API_KEY) {
    console.warn("[generate-hero] BFL_API_KEY missing");
    return null;
  }
  const { recipe, recipeId, brandSlug, dishDescription, referenceImageUrl } =
    opts;

  const spec = await generateImageSpec(recipe, brandSlug);
  const { prompt, negative } = buildPrompt(
    "hero",
    recipe,
    spec,
    brandSlug,
    dishDescription,
    true // withReferenceImage — aktiviert Jan's "preserve reference" Wording
  );

  const result = await generateImage({
    prompt,
    negativePrompt: negative,
    model: "flux-kontext-pro",
    aspectRatio: "1:1",
    outputFormat: "jpeg",
    safetyTolerance: 2,
    referenceImage: referenceImageUrl,
  });
  const buf = await downloadImage(result.imageUrl);

  const supabase = getServerSupabase();
  await ensureHeroBucket(supabase);
  return await uploadJpeg(supabase, recipeId, buf);
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

// ─── Path B: text-only Flux 2 Pro ──────────────────────────────────────────
// Hauptpfad seit dem Vision-Description-Patch: Flux 2 Pro mit Brand-DNA-
// Prompt + (optional) Gemini-Vision-Description vom Reel-Cover prominent
// drin. Kein Reference-Image — wir geben Flux nur Text, das Bild im Prompt-
// Text. Funktioniert deutlich besser als Flux Kontext Pro, weil Flux 2 Pro
// spezifischen visuellen Beschreibungen treu folgt, statt sie kreativ zu
// interpretieren.
async function uploadTextOnlyFluxHero(
  recipe: Recipe,
  recipeId: string,
  brandSlug: string,
  dishDescription?: string | null
): Promise<string | null> {
  if (!process.env.BFL_API_KEY) {
    console.warn("[generate-hero] BFL_API_KEY missing — skipping");
    return null;
  }
  const spec = await generateImageSpec(recipe, brandSlug);
  const { prompt, negative } = buildPrompt(
    "hero",
    recipe,
    spec,
    brandSlug,
    dishDescription
  );
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
