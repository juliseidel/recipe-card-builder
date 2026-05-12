import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { generateImage, downloadImage } from "./bfl-flux";
import { generateImageSpec } from "./recipe-image-spec";
import { buildPrompt } from "./image-prompts";
import {
  withBrandImageStyleOverride,
} from "./brand-image-style";
import {
  analyzeKeyframeStyle,
  buildStyleFromReel,
} from "./analyze-keyframe-style";
import { getServerSupabase } from "@/lib/supabase-server";
import { isCodeBrand } from "@/lib/brands";
import type { Recipe } from "@/lib/recipes";

// Render-Aufloesung: Flux 2 Pro rendert nativ bei 1440x1440 (User-Feedback
// 2026-05-12: Speed war wichtiger als die letzten 5-10% Detail-Schaerfe).
// 2048 nativ (PR #58) kostete 15-25s pro Generation — bei 12 Heroes nach
// Pack-Annahme = ~5 Min wartezeit. 1440 nativ kostet 8-15s, ~50% schneller.
//
// Detail-Schaerfe: Sharp upscaled von 1440 auf 3072 mit Lanczos3 (2.13x
// Resize statt 1.5x). Lanczos3 holt fast die gleiche Schaerfe wie ein
// 2048er-Source raus — bei normaler Display-Skalierung (1840 Retina-px im
// Detail-View) kaum sichtbar.
//
// Trade-off-Schalter: hier auf 2048 zurueckdrehen falls das 1440-Bild als
// "matschig" wahrgenommen wird. flux-2-pro bleibt das Modell — wechseln
// auf flux-pro-1.1 wuerde Reference-Fidelity opfern.
const FLUX_RENDER_WIDTH = 1440;
const FLUX_RENDER_HEIGHT = 1440;

// Storage-Aufloesung: Sharp upscaled das Flux-Bild von 1440 auf 3072 mit
// Lanczos3 + modesty Sharpening. Bei 3072er-Source hat Vercel Image
// Optimization Headroom fuer Display-Skalierung + PDF-Print (300 dpi @ ~26cm).
const STORAGE_LONG_EDGE = 3072;
const STORAGE_JPEG_QUALITY = 95;

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

    // Stufe 2: displayUrl-Reference mit Vision-Pre-Check.
    // Image-Posts haben oft Recipe-Titel als Cover-Overlay (Bienes Hummus-
    // DIP hatte z.B. "Der genialste Hummus DIP!" als Schrift im Cover).
    // Ohne Pre-Check uebernimmt Flux das. Loesung: Gemini Vision
    // klassifiziert hasTextOverlay + hasPerson, bei Risiko skippen wir
    // die Reference und gehen direkt zu text-only mit Vision-Description
    // als visuellem Anker.
    if (post.displayUrl) {
      const { describeInstagramDish } = await import("./describe-instagram-dish");
      const vision = await describeInstagramDish(post.displayUrl);

      if (vision && !vision.hasTextOverlay && !vision.hasPerson) {
        // Sauberes displayUrl → Reference-Pfad
        const heroUrl = await uploadReferenceHero({
          recipe: opts.recipe,
          recipeId: opts.recipeId,
          brandSlug: opts.brandSlug,
          referenceImage: post.displayUrl,
        });
        if (heroUrl) return { heroUrl, source: "cover" };
      } else if (vision) {
        // Risiko-Bild (Text-Overlay oder Person sichtbar) → text-only
        // Flux mit description als Anker statt Reference-Pfad.
        console.log(
          `[generate-hero] displayUrl risky for ${opts.recipeId}: hasTextOverlay=${vision.hasTextOverlay} hasPerson=${vision.hasPerson} → text-only with vision description`
        );
        const heroUrl = await uploadTextOnlyFluxHeroWithDescription(
          opts.recipe,
          opts.recipeId,
          opts.brandSlug,
          vision.description || null
        );
        if (heroUrl) return { heroUrl, source: "flux-text-only" };
      }
      // Vision-Call failed komplett → faellt durch zum default text-only
      // im main entry-point (uploadTextOnlyFluxHero).
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

  // 2) Gemini Vision waehlt besten Frame. Returnt null wenn ALLE Frames
  // Text-Overlays oder Personen drin haben — dann Fallback zur naechsten
  // Stufe (displayUrl mit Vision-Pre-Check oder text-only).
  const { selectBestKeyframe } = await import("./select-keyframe");
  const selection = await selectBestKeyframe({
    frames,
    recipeTitle: recipe.title,
    caption,
  });
  if (!selection) {
    console.log(
      `[generate-hero] keyframe ${recipeId}: no clean frame available, falling back`
    );
    return null;
  }
  console.log(
    `[generate-hero] keyframe ${recipeId}: idx=${selection.index}, t=${selection.frame.timestampSeconds}s — ${selection.reasoning.slice(0, 120)}`
  );

  // 3) Pro DB-Brand: aus dem GEWAEHLTEN Keyframe per Vision den visuellen
  // Stil ableiten (Counter, Lighting, Camera). Diese Tokens werden als
  // Per-Run-Override eingespeist — getBrandImageStyle picksauber den
  // Override fuer diesen einen Hero-Run. Bienes Pfad bleibt davon
  // unangetastet (isCodeBrand-Check).
  const runReferenceHero = () =>
    uploadReferenceHero({
      recipe,
      recipeId,
      brandSlug,
      referenceImage: selection.frame.dataUri,
    });

  let heroUrl: string | null;
  if (!isCodeBrand(brandSlug)) {
    const reelStyle = await analyzeKeyframeStyle(selection.frame.dataUri);
    if (reelStyle) {
      console.log(
        `[generate-hero] reel-style ${recipeId}: scene=${reelStyle.sceneContext.slice(0, 60)}, lighting=${reelStyle.lightingMood.slice(0, 50)}`
      );
      const dynamicStyle = buildStyleFromReel(reelStyle, brandSlug);
      heroUrl = await withBrandImageStyleOverride(
        dynamicStyle,
        runReferenceHero
      );
    } else {
      // Vision-Fail → existing brand.imageStyle aus dem Onboarding nutzen
      // (oder Fallback). Pipeline laeuft normal weiter.
      heroUrl = await runReferenceHero();
    }
  } else {
    // Code-Brand (Biene) — kein Override, der hardcoded BIENE_STYLE greift
    heroUrl = await runReferenceHero();
  }
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
  const { prompt, negative } = await buildPrompt(
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
    width: FLUX_RENDER_WIDTH,
    height: FLUX_RENDER_HEIGHT,
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
          const vision = await describeInstagramDish(post.displayUrl);
          dishDescription = vision?.description || null;
        }
      }
    } catch (err) {
      console.warn(
        "[generate-hero] vision description failed for text-only fallback:",
        err instanceof Error ? err.message : err
      );
    }
  }

  return await uploadTextOnlyFluxHeroWithDescription(
    recipe,
    recipeId,
    brandSlug,
    dishDescription
  );
}

// Variante, der die description schon mitgegeben wird (zB vom Vision-
// Pre-Check in tryReferenceBasedHero, wo wir bereits Gemini fuer die
// Risk-Flags angerufen haben — den Apify-Roundtrip wiederholen waere
// pure Verschwendung).
async function uploadTextOnlyFluxHeroWithDescription(
  recipe: Recipe,
  recipeId: string,
  brandSlug: string,
  dishDescription: string | null
): Promise<string | null> {
  if (!process.env.BFL_API_KEY) {
    console.warn("[generate-hero] BFL_API_KEY missing — skipping");
    return null;
  }

  const spec = await generateImageSpec(recipe, brandSlug);
  const { prompt, negative } = await buildPrompt(
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
    width: FLUX_RENDER_WIDTH,
    height: FLUX_RENDER_HEIGHT,
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

  // Sharp-Pass: 2048 → 3072 Lanczos3-Upscale + modestes Sharpening
  // (sigma=0.5 holt feine Details zurueck, die der Resampler weichzeichnet,
  // ohne Halo-Ringe). JPEG q=95 mit mozjpeg + progressive — Web-Render
  // startet frueher, Print-Workflow hat genug Kompressions-Reserve.
  // Pattern aus scripts/upscale-brand-assets.ts uebernommen, der das fuer
  // statische Pack-Cover schon erprobt hat.
  const processed = await sharp(buf)
    .resize(STORAGE_LONG_EDGE, STORAGE_LONG_EDGE, {
      kernel: sharp.kernel.lanczos3,
      fit: "fill",
    })
    .sharpen({ sigma: 0.5, m1: 0.6, m2: 0.4 })
    .jpeg({
      quality: STORAGE_JPEG_QUALITY,
      mozjpeg: true,
      progressive: true,
    })
    .toBuffer();

  const upload = await supabase.storage
    .from(HERO_BUCKET)
    .upload(filePath, processed, {
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
