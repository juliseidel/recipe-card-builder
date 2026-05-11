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
 * Pipeline (2026-05-11 nachmittags v2):
 *
 *   IF sourceUrl vorhanden UND !forceFlux:
 *     1) Apify scraped Reel-Cover (displayUrl)
 *     2) Gemini 2.5 Flash Vision beschreibt NUR das Gericht
 *        ("a stack of fluffy golden Kaiserschmarren pieces dusted with
 *         powdered sugar, served with red strawberry compote alongside")
 *     3) heroPrompt baut diese Beschreibung prominent in den Flux-Prompt
 *     4) Flux 2 Pro text-only generiert: Brand-Style-Staging plus das
 *        spezifische Gericht
 *
 *   ELSE (kein sourceUrl ODER forceFlux ODER Vision failt):
 *     → wie bisher: nur Recipe-Text → Spec → text-only Flux
 *
 * Loest Ingo-Feedback: "die Bilder vom Reel matchen nicht mit den Bildern
 * vom Rezept". Vorher generierte Flux "irgendeinen Kaiserschmarren";
 * jetzt sieht Gemini erst das echte Reel und gibt Flux einen konkreten
 * visuellen Anker. Brand-Style (Steinplatte, Holzunterlage, Hero-Element)
 * bleibt aus dem Image-Spec.
 *
 * Die uploadKeyframeBasedHero-Funktion (Image-to-Image mit Flux Kontext)
 * bleibt im Code als dead code, falls wir spaeter doch Reference-Image
 * brauchen — z. B. fuer Komposition-treue. Aktuell ist Text-Description
 * der bessere Ansatz, weil Flux Kontext zu kreativ interpretiert.
 */
export async function generateHeroForRecipe(
  opts: GenerateHeroOpts
): Promise<GenerateHeroResult | null> {
  const dishDescription = await maybeDescribeDishFromReel(opts);
  const heroUrl = await uploadTextOnlyFluxHero(
    opts.recipe,
    opts.recipeId,
    opts.brandSlug,
    dishDescription
  );
  if (!heroUrl) return null;
  return {
    heroUrl,
    source: "flux-text-only",
    dishDescription: dishDescription ?? undefined,
  };
}

// Optional-Step vor Flux: wenn das Rezept aus Instagram stammt, Reel-Cover
// laden und Gemini Vision das Gericht beschreiben lassen. Bei jedem Fehler
// (Apify down, Bild nicht ladbar, Vision schweigt) graceful auf null.
async function maybeDescribeDishFromReel(
  opts: GenerateHeroOpts
): Promise<string | null> {
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
    return desc;
  } catch (err) {
    console.warn(
      "[generate-hero] vision pre-step failed, continuing without:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
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
