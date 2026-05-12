import { NextResponse } from "next/server";
import sharp from "sharp";
import {
  scrapeInstagramPost,
  normalizeInstagramUrl,
} from "@/lib/integrations/apify";
import { extractVideoFrames } from "@/lib/ai/extract-video-frames";
import {
  describeDishStructured,
  pickLightingOption,
} from "@/lib/ai/describe-dish-structured";
import { generateImageSpec } from "@/lib/ai/recipe-image-spec";
import { getBrandImageStyle } from "@/lib/ai/brand-image-style";
import { generateImage, downloadImage } from "@/lib/ai/bfl-flux";
import { recipes } from "@/lib/recipes";
import { getServerSupabase, hasServerSupabase } from "@/lib/supabase-server";

// V2 Test-Endpoint — Vision bestimmt vessel + lighting-direction, Spec
// liefert nur noch dishShape + heroElement + scene-Backup. Erweitertes
// 16-Feld Vision-Schema + 8 Frames an Gemini Pro.

export const runtime = "nodejs";
export const maxDuration = 300;

const TEST_BUCKET = "test-vision-hero";

function steamSuffix(temp: string): string {
  return temp === "hot" ? ", with subtle steam rising" : "";
}

function toneWord(tone: string): string {
  switch (tone) {
    case "warm":
      return "warm golden";
    case "cool":
      return "cool muted";
    case "colorful":
      return "vibrant warm";
    case "neutral":
    default:
      return "warm neutral";
  }
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

  let body: { recipeSlug?: string };
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

  // ─── 2. ffmpeg 25 frames @ 1.0s ─────────────────────────────────────────
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

  // ─── 3. Letzten 8 Frames an Gemini Pro (statt 5) ────────────────────────
  // Reels zeigen am Ende das fertig angerichtete Gericht. Mehr Frames =
  // konsistentere Beschreibung, weniger Snapshot-Zufall.
  const sampleFrames = frames.slice(-8);

  // ─── 4. Strukturierte 16-Feld Multi-Frame Vision-Description ────────────
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

  // ─── 5. Image-Spec — aber WIR IGNORIEREN servingVessel! ─────────────────
  // Spec dient nur noch für: dishShape (für angle-lookup), dishColorTone
  // (toneWord), servingTemperature (steamSuffix), heroElement, sceneContext
  // als Backup. Vessel kommt AUSSCHLIESSLICH aus Vision.
  const tSpec0 = Date.now();
  const spec = await generateImageSpec(recipe, "biene");
  const tSpec = Date.now() - tSpec0;

  // ─── 6. Bauen des Prompts ────────────────────────────────────────────────
  const style = await getBrandImageStyle("biene");
  const angle =
    style.defaultAngles?.[spec.dishShape] ??
    (spec.dishShape === "flat"
      ? "top-down 90°"
      : spec.dishShape === "tall"
        ? "45° eye-level"
        : "30° three-quarter");
  const tone = toneWord(spec.dishColorTone);
  const steam = steamSuffix(spec.servingTemperature);

  // Lighting-Option: aus Bienes 5 Optionen die wählen, die zur Vision-
  // Licht-Richtung passt. So bekommen wir Brand-Konsistenz + Reel-Treue.
  const chosenLighting = pickLightingOption(
    dishDescription.lightDirection,
    style.lightingOptions
  );

  // Jan's Hero-Prompt #4 mit erweiterter Vision-Description. KEINE
  // Defensive-Klauseln im Positive-Prompt. Vessel kommt aus Vision.
  //
  // Reihenfolge: scene → hero element → light → DETAILLIERTE
  // Gericht-Beschreibung (das Herzstück) → camera-specs.
  const positivePrompt = [
    `A ${angle} view of ${recipe.title}, placed on ${spec.sceneContext}.`,
    `${spec.heroElement}, styled deliberately as part of the scene.`,
    `${chosenLighting}.`,
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
    `Shot on Leica SL2 50mm lens at f/5.6, dish in sharp focus from edge to edge, background softly out of focus, cookbook-style Instagram food photograph, ${tone} tones, homemade imperfect character${steam}.`,
  ]
    .filter((s) => s.length > 0)
    .join("\n");

  // Jan's Original-Negative-Set (~18 Items) + Brand-negativeAddition.
  const baseNegative =
    "no text, no labels, no logos, no packaging, no cartons, no bottles, no jars with labels, no bags, no brand names, no watermark, no hands, no people, no faces, no rigid centering, no plastic-looking sauce, no unnatural gloss, no studio lighting, no white void background, no cool blue tones, no fluorescent lighting";
  const negativePrompt = style.negativeAddition
    ? `${baseNegative}, ${style.negativeAddition}`
    : baseNegative;

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

  // ─── 9. Upload in test-Bucket ───────────────────────────────────────────
  const supabase = getServerSupabase();
  await supabase.storage.createBucket(TEST_BUCKET, {
    public: true,
    fileSizeLimit: 8 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg"],
  });
  const filePath = `${body.recipeSlug}-v2-${Date.now()}.jpg`;
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
    spec: {
      // Spec wird nur noch für scene/heroElement/angle/tone genutzt,
      // Vessel kommt ALLEINE aus Vision.
      heroElement: spec.heroElement,
      sceneContext: spec.sceneContext,
      dishShape: spec.dishShape,
      dishColorTone: spec.dishColorTone,
      angle,
      chosenLightingFromVision: chosenLighting,
      ignoredSpecVessel: spec.servingVessel,
    },
    dishDescription,
    positivePrompt,
    negativePrompt,
  });
}
