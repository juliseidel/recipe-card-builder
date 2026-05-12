import { NextResponse } from "next/server";
import sharp from "sharp";
import {
  scrapeInstagramPost,
  normalizeInstagramUrl,
} from "@/lib/integrations/apify";
import { extractVideoFrames } from "@/lib/ai/extract-video-frames";
import { describeDishStructured } from "@/lib/ai/describe-dish-structured";
import { generateImageSpec } from "@/lib/ai/recipe-image-spec";
import { getBrandImageStyle } from "@/lib/ai/brand-image-style";
import { generateImage, downloadImage } from "@/lib/ai/bfl-flux";
import { recipes } from "@/lib/recipes";
import { getServerSupabase, hasServerSupabase } from "@/lib/supabase-server";

// V3 Test-Endpoint — Lighting + Color-Tone kommen DIREKT aus Vision (keine
// Mapping mehr auf Brand-DNA-Fixed-Set). Smartphone-Camera-Aesthetic statt
// Leica-Cookbook. Anti-Studio Negatives.
//
// Begründung V2-Fail: V2-Bild sah zu sehr nach Studio aus, Farben zu warm.
// Root Cause:
//   1. Jan's "Shot on Leica SL2 50mm f/5.6, cookbook-style" → Studio-Look
//   2. Bienes Brand-DNA hat NUR warm-amber Lighting-Optionen → falsche Wärme
//   3. dishColorTone "colorful" → toneWord "vibrant warm" → ungewollt warm
//
// V3-Fix: Vision liefert COMPLETE lightingDescription + colorToneWord direkt.
// Smartphone-Look statt Cookbook. Brand-DNA bleibt für heroElement + scene
// + angles + negativeAddition.

export const runtime = "nodejs";
export const maxDuration = 300;

const TEST_BUCKET = "test-vision-hero";

function steamSuffix(temp: string): string {
  return temp === "hot" ? ", with subtle steam rising" : "";
}

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = process.env.ADMIN_RESEED_TOKEN;
  if (!token || auth !== `Bearer ${token}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.BFL_API_KEY) {
    return NextResponse.json({ error: "BFL_API_KEY missing" }, { status: 500 });
  }
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY missing" },
      { status: 500 }
    );
  }
  if (!process.env.APIFY_TOKEN) {
    return NextResponse.json(
      { error: "APIFY_TOKEN missing" },
      { status: 500 }
    );
  }
  if (!hasServerSupabase()) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 500 }
    );
  }

  let body: { recipeSlug?: string; brandSlug?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.recipeSlug) {
    return NextResponse.json(
      { error: "recipeSlug missing in body" },
      { status: 400 }
    );
  }
  const brandSlug = body.brandSlug || "biene";

  const t0 = Date.now();
  const recipe = recipes.find((r) => r.slug === body.recipeSlug);
  if (!recipe) {
    return NextResponse.json(
      { error: `Recipe '${body.recipeSlug}' not found` },
      { status: 404 }
    );
  }
  if (!recipe.sourceUrl) {
    return NextResponse.json(
      { error: `Recipe '${body.recipeSlug}' has no sourceUrl` },
      { status: 422 }
    );
  }

  // ─── 1. Apify scrape ────────────────────────────────────────────────────
  const normalized = normalizeInstagramUrl(recipe.sourceUrl);
  if (!normalized) {
    return NextResponse.json(
      { error: "sourceUrl not normalizable" },
      { status: 422 }
    );
  }
  const tApify0 = Date.now();
  const post = await scrapeInstagramPost(normalized);
  const tApify = Date.now() - tApify0;

  if (!post.videoUrl) {
    return NextResponse.json(
      {
        error:
          "Reel has no videoUrl — test endpoint requires a video Reel for now",
      },
      { status: 422 }
    );
  }

  // ─── 2. ffmpeg 25 Frames @ 1.0s ─────────────────────────────────────────
  const tFrames0 = Date.now();
  const frames = await extractVideoFrames(post.videoUrl, {
    intervalSeconds: 1.0,
    maxFrames: 25,
  });
  const tFrames = Date.now() - tFrames0;

  if (frames.length === 0) {
    return NextResponse.json(
      { error: "No frames extracted from video" },
      { status: 500 }
    );
  }

  // ─── 3. Letzten 8 Frames an Gemini Pro ─────────────────────────────────
  const sampleFrames = frames.slice(-8);

  // ─── 4. Strukturierte Multi-Frame Vision-Description ────────────────────
  const tVision0 = Date.now();
  const dishDescription = await describeDishStructured({
    frames: sampleFrames,
    recipeTitle: recipe.title,
    caption: post.caption,
  });
  const tVision = Date.now() - tVision0;

  if (!dishDescription) {
    return NextResponse.json(
      { error: "Vision description failed" },
      { status: 500 }
    );
  }

  // ─── 5. Image-Spec für dishShape + heroElement + scene + steam ────────
  // NICHT mehr für vessel (V2-fix), NICHT mehr für lighting (V3-fix),
  // NICHT mehr für tone (V3-fix). Diese kommen direkt aus Vision.
  const tSpec0 = Date.now();
  const spec = await generateImageSpec(recipe, brandSlug);
  const tSpec = Date.now() - tSpec0;

  // ─── 6. Prompt bauen ────────────────────────────────────────────────────
  const style = await getBrandImageStyle(brandSlug);
  const angle =
    style.defaultAngles?.[spec.dishShape] ??
    (spec.dishShape === "flat"
      ? "top-down 90°"
      : spec.dishShape === "tall"
        ? "45° eye-level"
        : "30° three-quarter");
  const steam = steamSuffix(spec.servingTemperature);

  // V3-Kern: Vision liefert komplette Lighting + ColorTone-Phrase direkt.
  // Kein Mapping mehr auf Brand-Set. Fallback nur wenn Vision leer.
  const lightingPhrase =
    dishDescription.lightingDescription ||
    "bright natural daylight with soft even illumination";
  const toneWord = dishDescription.colorToneWord || "natural";

  // Smartphone-Aesthetic statt Leica-Cookbook. Jeder Recipe-Card-Builder-
  // Hero soll wie ein iPhone-Snapshot aussehen — das ist der echte Look
  // von Instagram-Reels, nicht durchgestyltes Studio.
  const cameraSpecs = [
    "Shot on iPhone 15 Pro, natural smartphone food photograph",
    "everything in sharp focus from edge to edge",
    "no shallow depth-of-field, no bokeh",
    "casual Instagram-Reel snapshot aesthetic",
    "slightly imperfect framing, homemade and unstaged",
  ].join(", ");

  // Prompt-Struktur:
  // 1. Scene Setup (winkel, surface, hero-element)
  // 2. Lighting aus Vision (direkt)
  // 3. Dish Description (alle 16 Vision-Felder)
  // 4. Camera Specs (smartphone)
  // 5. Tone aus Vision (direkt)
  const positivePrompt = [
    `A ${angle} view of ${recipe.title}, placed on ${spec.sceneContext}.`,
    `${spec.heroElement}, styled deliberately as part of the scene.`,
    `${lightingPhrase}.`,
    "",
    `The dish itself (render exactly as described — this IS the dish, do not improvise):`,
    `Form: ${dishDescription.form}`,
    `Colors: ${dishDescription.exactDishColors}`,
    `Vessel: ${dishDescription.vesselDescription}${dishDescription.vesselSize ? ` (${dishDescription.vesselSize})` : ""}.`,
    dishDescription.layering ? `Layering: ${dishDescription.layering}` : "",
    dishDescription.toppings && dishDescription.toppings !== "None visible"
      ? `Toppings: ${dishDescription.toppings}`
      : "",
    dishDescription.spatialArrangement
      ? `Arrangement: ${dishDescription.spatialArrangement}`
      : "",
    `Textures: ${dishDescription.textures}`,
    dishDescription.cuttingPlaneVisible
      ? `Cross-section: ${dishDescription.cuttingPlaneVisible}`
      : "",
    "",
    `Compose: ${dishDescription.compose}`,
    "",
    `${cameraSpecs}, ${toneWord} tones, true to life colors${steam}.`,
  ]
    .filter((s) => s.length > 0)
    .join("\n");

  // V3 Negatives: Jan's Original 18 Items + Anti-Studio + Anti-Cookbook
  // (gegen V2-Problem dass Bild zu professionell aussah)
  const antiStudio = [
    "no professional studio photography",
    "no cinematic depth-of-field",
    "no commercial cookbook styling",
    "no overly stylized food art",
    "no Leica look",
    "no DSLR aesthetic",
    "no bokeh",
    "no shallow focus",
    "no advertising photography",
  ].join(", ");
  const baseNegative =
    "no text, no labels, no logos, no packaging, no cartons, no bottles, no jars with labels, no bags, no brand names, no watermark, no hands, no people, no faces, no rigid centering, no plastic-looking sauce, no unnatural gloss, no white void background, no fluorescent lighting";
  const negativePrompt = [
    baseNegative,
    antiStudio,
    style.negativeAddition || "",
  ]
    .filter(Boolean)
    .join(", ");

  // ─── 7. Flux 2 Pro text-only call ───────────────────────────────────────
  const tFlux0 = Date.now();
  const result = await generateImage({
    prompt: positivePrompt,
    negativePrompt,
    model: "flux-2-pro",
    aspectRatio: "1:1",
    width: 2048,
    height: 2048,
    outputFormat: "jpeg",
    safetyTolerance: 2,
  });
  const tFlux = Date.now() - tFlux0;

  // ─── 8. Sharp Lanczos auf 3072, q=95 ────────────────────────────────────
  const buf = await downloadImage(result.imageUrl);
  const processed = await sharp(buf)
    .resize(3072, 3072, { kernel: sharp.kernel.lanczos3, fit: "fill" })
    .sharpen({ sigma: 0.5, m1: 0.6, m2: 0.4 })
    .jpeg({ quality: 95, mozjpeg: true, progressive: true })
    .toBuffer();

  // ─── 9. Upload ──────────────────────────────────────────────────────────
  const supabase = getServerSupabase();
  await supabase.storage.createBucket(TEST_BUCKET, {
    public: true,
    fileSizeLimit: 8 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg"],
  });
  const filePath = `${body.recipeSlug}-v3-${Date.now()}.jpg`;
  const upload = await supabase.storage
    .from(TEST_BUCKET)
    .upload(filePath, processed, {
      contentType: "image/jpeg",
      upsert: true,
      cacheControl: "31536000",
    });
  if (upload.error) {
    return NextResponse.json(
      { error: `Upload failed: ${upload.error.message}` },
      { status: 500 }
    );
  }
  const { data } = supabase.storage.from(TEST_BUCKET).getPublicUrl(filePath);
  const publicUrl = `${data.publicUrl}?t=${Date.now()}`;

  const tTotal = Date.now() - t0;

  return NextResponse.json({
    ok: true,
    version: "v3",
    generatedUrl: publicUrl,
    timings: {
      apifyMs: tApify,
      framesMs: tFrames,
      visionMs: tVision,
      specMs: tSpec,
      fluxMs: tFlux,
      totalMs: tTotal,
    },
    framesExtracted: frames.length,
    framesAnalyzedByVision: sampleFrames.length,
    fluxSeed: result.seed,
    promptInputs: {
      angle,
      sceneContext: spec.sceneContext,
      heroElement: spec.heroElement,
      lightingPhraseFromVision: lightingPhrase,
      toneWordFromVision: toneWord,
      cameraSpecs,
    },
    dishDescription,
    positivePrompt,
    negativePrompt,
  });
}
