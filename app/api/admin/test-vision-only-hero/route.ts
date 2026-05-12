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

  // ─── 5. Image-Spec NUR für steam-Hint (servingTemperature) ──────────────
  // V6: Spec liefert NICHT mehr scene/heroElement/angle/tone. Alles aus
  // Vision. Spec wird nur noch für den steamSuffix gebraucht (hot dish =
  // Steam-Aufstieg, Jan-Übernahme).
  const tSpec0 = Date.now();
  const spec = await generateImageSpec(recipe, brandSlug);
  const tSpec = Date.now() - tSpec0;
  const steam = steamSuffix(spec.servingTemperature);

  // ─── 6. V6-Prompt: Vision ist BOSS ──────────────────────────────────────
  // Alle Wärme-/HDR-/Lived-in-Filter raus. Brand-DNA sceneContext +
  // heroElement raus (Vision compose deckt das ab). Tone-Tail raus.
  //
  // Das einzige was wir adden: smartphone-hint (sonst rendert Flux
  // Cookbook-Default) + steam für hot dishes (Jan).
  //
  // Vision compose = der zentrale Anker. lightingDescription = Licht-Wahrheit.
  const positivePrompt = [
    `${recipe.title}, a casual home-cooking snapshot.`,
    "",
    dishDescription.compose,
    "",
    dishDescription.lightingDescription,
    "",
    `Shot on iPhone, natural smartphone photograph, everything in sharp focus, slightly imperfect framing${steam}.`,
  ]
    .filter((s) => s.length > 0)
    .join("\n");

  // V6-Negatives: minimal. Nur die essentiellen 10 Items. Brand-
  // negativeAddition wenn vorhanden (für sehr brand-spezifische no-
  // gos wie "no parsley" für Biene).
  const baseNegative =
    "no text, no labels, no logos, no packaging, no watermark, no hands, no people, no faces, no studio lighting, no white void background";
  const style = await getBrandImageStyle(brandSlug);
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

  // ─── 9. Upload ──────────────────────────────────────────────────────────
  const supabase = getServerSupabase();
  await supabase.storage.createBucket(TEST_BUCKET, {
    public: true,
    fileSizeLimit: 8 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg"],
  });
  const filePath = `${body.recipeSlug}-v6-${Date.now()}.jpg`;
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
    version: "v6",
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
      steamFromSpec: steam,
      visionIsBoss: true,
    },
    dishDescription,
    positivePrompt,
    negativePrompt,
  });
}
