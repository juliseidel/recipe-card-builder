import type { SupabaseClient } from "@supabase/supabase-js";
import { generateImage, downloadImage } from "./bfl-flux";
import { generateImageSpec } from "./recipe-image-spec";
import { buildPrompt } from "./image-prompts";
import { getServerSupabase } from "@/lib/supabase-server";
import type { Recipe } from "@/lib/recipes";

// Hero-Pipeline v9 — zurueck zu Jan's Original-Workflow:
//   1) Apify scraped Caption + videoUrl + displayUrl
//   2) Wenn videoUrl: ffmpeg extrahiert ~14 Frames, Gemini Vision waehlt den
//      besten sauberen Keyframe (fertiges Gericht, kein Talking-Head, kein
//      Overlay). Dieser Keyframe geht als input_image an Flux 2 Pro.
//   3) Fallback wenn kein Video: displayUrl (Reel-Cover) als input_image.
//   4) Fallback wenn kein sourceUrl ODER alles failed: text-only Flux 2 Pro.
//
// Kritische Aenderung ggue v8:
// - Jan's Prompt #2 sagt explizit: "a reference image of the actual dish is
//   provided separately during generation, so do NOT describe what the dish
//   looks like". v8 hat zusaetzlich eine Gemini-Vision-Description vom Cover
//   in den Prompt eingebaut — das kollidiert mit der Reference und macht
//   Flux kreativ-interpretierend (Cups → Cupcakes). v9 entfernt die
//   Vision-Description aus dem Reference-Path.
// - Flux Kontext Pro ist BFL-seitig "legacy" — wir nutzen jetzt flux-2-pro
//   auch fuer Reference-Calls. flux-2-pro akzeptiert input_image und ist
//   das von BFL empfohlene Modell fuer Editing-Workflows.

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
  /** Welcher Pfad das Hero produziert hat. "keyframe" = bester Frame aus
   *  dem Reel-Video; "cover" = Reel-Cover-Thumbnail (Fallback wenn kein
   *  Video); "flux-text-only" = kein Reference-Image, reiner Text-Prompt. */
  source: "keyframe" | "cover" | "flux-text-only";
  /** Bei keyframe: Begruendung aus Gemini-Vision-Pick, sonst null. */
  keyframeReasoning?: string;
  /** Bei keyframe: gewaehlter Timestamp im Video. */
  keyframeTimestamp?: number;
};

/**
 * Top-Level Entry-Point. Returnt die public-URL des hochgeladenen JPEGs
 * oder null, wenn nichts klappt.
 *
 * Pipeline (v9 — zurueck zu Jan's Original):
 *
 *   IF sourceUrl vorhanden UND !forceFlux:
 *     1) Apify scraped Reel — liefert videoUrl + displayUrl + caption
 *     2a) IF videoUrl: ffmpeg extrahiert ~14 Frames, Gemini Vision waehlt
 *         den besten (fertiges Gericht, kein Talking-Head, scharf, echte
 *         Farben). Frame geht als input_image an Flux 2 Pro.
 *     2b) ELIF displayUrl: Reel-Cover als input_image. (Schlechter, weil
 *         Cover oft Talking-Head oder Werbe-Overlay zeigt — aber besser
 *         als keine Reference fuer Image-Posts ohne Video.)
 *     3) Flux 2 Pro rendert mit input_image + Brand-Style-Prompt. Prompt
 *        beschreibt NICHT das Gericht (Jan's Regel), nur Servier-Kontext,
 *        Scene, Lighting, heroElement. Das Gericht selbst kommt 1:1 aus
 *        der Reference.
 *
 *   ELSE (kein sourceUrl ODER forceFlux):
 *     → text-only Flux 2 Pro mit Brand-DNA-Prompt + Gemini-Vision-
 *       Description als Text-Anker (kein input_image, weil nichts da).
 */
export async function generateHeroForRecipe(
  opts: GenerateHeroOpts
): Promise<GenerateHeroResult | null> {
  // Reference-Path: nur wenn sourceUrl vorhanden UND nicht forceFlux gesetzt
  if (opts.recipe.sourceUrl && !opts.forceFlux) {
    const refResult = await tryReferenceBasedHero(opts);
    if (refResult) return refResult;
    console.warn(
      `[generate-hero] reference path failed for ${opts.recipeId}, falling back to text-only`
    );
  }

  // Text-Only-Fallback
  const heroUrl = await uploadTextOnlyFluxHero(
    opts.recipe,
    opts.recipeId,
    opts.brandSlug
  );
  if (!heroUrl) return null;
  return { heroUrl, source: "flux-text-only" };
}

// ─── Reference-Path: Keyframe (preferred) oder Cover (fallback) ────────────
async function tryReferenceBasedHero(
  opts: GenerateHeroOpts
): Promise<GenerateHeroResult | null> {
  if (!process.env.BFL_API_KEY) {
    console.warn("[generate-hero] BFL_API_KEY missing");
    return null;
  }
  if (!opts.recipe.sourceUrl) return null;

  try {
    const { scrapeInstagramPost, normalizeInstagramUrl } = await import(
      "@/lib/integrations/apify"
    );
    const normalized = normalizeInstagramUrl(opts.recipe.sourceUrl);
    if (!normalized) return null;
    const post = await scrapeInstagramPost(normalized);

    // 2a) Bevorzugt: Keyframe aus dem Video. Jan's Original-Approach.
    if (post.videoUrl) {
      const keyframeResult = await uploadKeyframeHero({
        recipe: opts.recipe,
        recipeId: opts.recipeId,
        brandSlug: opts.brandSlug,
        videoUrl: post.videoUrl,
        caption: post.caption,
      });
      if (keyframeResult) return keyframeResult;
      console.warn(
        `[generate-hero] keyframe path failed for ${opts.recipeId}, trying cover fallback`
      );
    }

    // 2b) Fallback: Reel-Cover (displayUrl). Image-Posts ohne Video, oder
    // wenn die Video-Pipeline gescheitert ist (ffmpeg crash, Vision-Pick
    // ungueltig).
    if (post.displayUrl) {
      const heroUrl = await uploadReferenceHero({
        recipe: opts.recipe,
        recipeId: opts.recipeId,
        brandSlug: opts.brandSlug,
        referenceImage: post.displayUrl,
      });
      if (heroUrl) return { heroUrl, source: "cover" };
    }

    return null;
  } catch (err) {
    console.warn(
      "[generate-hero] reference pipeline error:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

// ─── Keyframe-Pipeline: ffmpeg → Gemini-Pick → Flux 2 Pro ──────────────────
async function uploadKeyframeHero(opts: {
  recipe: Recipe;
  recipeId: string;
  brandSlug: string;
  videoUrl: string;
  caption: string;
}): Promise<GenerateHeroResult | null> {
  const { recipe, recipeId, brandSlug, videoUrl, caption } = opts;

  // 1) ffmpeg extrahiert Frames
  const { extractVideoFrames } = await import("./extract-video-frames");
  let frames;
  try {
    frames = await extractVideoFrames(videoUrl, {
      intervalSeconds: 1.5,
      maxFrames: 14,
    });
  } catch (err) {
    console.warn(
      `[generate-hero] frame extraction failed for ${recipeId}:`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
  if (frames.length === 0) {
    console.warn(`[generate-hero] no frames extracted for ${recipeId}`);
    return null;
  }

  // 2) Gemini Vision waehlt besten Frame
  const { selectBestKeyframe } = await import("./select-keyframe");
  const selection = await selectBestKeyframe({
    frames,
    recipeTitle: recipe.title,
    caption,
  });
  console.log(
    `[generate-hero] keyframe ${recipeId}: idx=${selection.index}, t=${selection.frame.timestampSeconds}s — ${selection.reasoning.slice(0, 120)}`
  );

  // 3) Flux 2 Pro mit Keyframe als input_image
  const heroUrl = await uploadReferenceHero({
    recipe,
    recipeId,
    brandSlug,
    referenceImage: selection.frame.dataUri,
  });
  if (!heroUrl) return null;

  return {
    heroUrl,
    source: "keyframe",
    keyframeReasoning: selection.reasoning,
    keyframeTimestamp: selection.frame.timestampSeconds,
  };
}

// ─── Flux 2 Pro Call mit Reference-Image ───────────────────────────────────
// Gemeinsamer Endpoint fuer Keyframe-Path und Cover-Path. Jan's Regel:
// Prompt beschreibt NICHT das Gericht — die Reference uebernimmt das.
async function uploadReferenceHero(opts: {
  recipe: Recipe;
  recipeId: string;
  brandSlug: string;
  referenceImage: string;
}): Promise<string | null> {
  const { recipe, recipeId, brandSlug, referenceImage } = opts;
  const spec = await generateImageSpec(recipe, brandSlug);
  const { prompt, negative } = buildPrompt(
    "hero",
    recipe,
    spec,
    brandSlug,
    null, // KEINE Vision-Description — Jan's "do NOT describe the dish"
    true // withReferenceImage
  );

  const result = await generateImage({
    prompt,
    negativePrompt: negative,
    // flux-2-pro statt flux-kontext-pro: BFL hat Kontext als "legacy"
    // markiert und empfiehlt flux-2-pro fuer Editing-Workflows mit
    // input_image. Akzeptiert beide Parameter (image_prompt + input_image)
    // dank Doppel-Set in bfl-flux.ts.
    model: "flux-2-pro",
    aspectRatio: "1:1",
    outputFormat: "jpeg",
    safetyTolerance: 2,
    referenceImage,
  });
  const buf = await downloadImage(result.imageUrl);

  const supabase = getServerSupabase();
  await ensureHeroBucket(supabase);
  return await uploadJpeg(supabase, recipeId, buf);
}

// ─── Text-Only-Fallback: kein sourceUrl oder forceFlux=true ────────────────
// Wenn keine Reference verfuegbar ist, baut der Prompt das Gericht aus
// Recipe-Title + Spec-Feldern + optional einer Gemini-Vision-Description.
// Die Description hilft hier (statt zu schaden, wie im Reference-Path),
// weil sie der einzige visuelle Anker ist, den Flux hat.
async function uploadTextOnlyFluxHero(
  recipe: Recipe,
  recipeId: string,
  brandSlug: string
): Promise<string | null> {
  if (!process.env.BFL_API_KEY) {
    console.warn("[generate-hero] BFL_API_KEY missing — skipping");
    return null;
  }

  // Vision-Description nur wenn sourceUrl vorhanden — sonst gibt's eh
  // nichts zu beschreiben. Best-effort: Failure stoppt den Fallback nicht.
  let dishDescription: string | null = null;
  if (recipe.sourceUrl) {
    try {
      const { scrapeInstagramPost, normalizeInstagramUrl } = await import(
        "@/lib/integrations/apify"
      );
      const normalized = normalizeInstagramUrl(recipe.sourceUrl);
      if (normalized) {
        const post = await scrapeInstagramPost(normalized);
        if (post.displayUrl) {
          const { describeInstagramDish } = await import(
            "./describe-instagram-dish"
          );
          dishDescription = await describeInstagramDish(post.displayUrl);
        }
      }
    } catch (err) {
      console.warn(
        "[generate-hero] vision description failed for text-only fallback:",
        err instanceof Error ? err.message : err
      );
    }
  }

  const spec = await generateImageSpec(recipe, brandSlug);
  const { prompt, negative } = buildPrompt(
    "hero",
    recipe,
    spec,
    brandSlug,
    dishDescription,
    false // withReferenceImage = false
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
  if (!data.publicUrl) return null;
  // Cache-Bust: jeder Re-Roll bekommt einen frischen ?t=<ms> Suffix. Sonst
  // sieht Vercel Image Optimization dieselbe URL und liefert das alte
  // optimierte Bild aus dem CDN-Cache, obwohl wir das underlying JPEG
  // gerade ueberschrieben haben (Supabase upsert behaelt den filePath).
  return `${data.publicUrl}?t=${Date.now()}`;
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
