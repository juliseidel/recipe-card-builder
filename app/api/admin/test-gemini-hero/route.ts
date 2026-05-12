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
import { generateImageGemini } from "@/lib/ai/gemini-image-generation";
import { recipes } from "@/lib/recipes";
import { getServerSupabase, hasServerSupabase } from "@/lib/supabase-server";

// GEMINI-Test-Endpoint — identische V6-Pipeline (Apify, Frames, Vision-
// Description), aber finaler Renderer ist Gemini 2.5 Flash Image statt
// Flux 2 Pro. Vergleich gegen V6 zeigt ob Gemini bei den Farben besser
// trifft (anderer Trainings-Bias).

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
      { error: "Reel has no videoUrl" },
      { status: 422 }
    );
  }

  // ─── 2. ffmpeg 25 Frames ────────────────────────────────────────────────
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

  // ─── 3. Vision-Description (letzte 8 Frames) ────────────────────────────
  const tVision0 = Date.now();
  const dishDescription = await describeDishStructured({
    frames: frames.slice(-8),
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

  // ─── 4. Spec für steam ──────────────────────────────────────────────────
  const tSpec0 = Date.now();
  const spec = await generateImageSpec(recipe, brandSlug);
  const tSpec = Date.now() - tSpec0;
  const steam = steamSuffix(spec.servingTemperature);

  // ─── 5. V6-identischer Prompt ───────────────────────────────────────────
  const positivePrompt = [
    `${recipe.title}, a casual home-cooking snapshot.`,
    "",
    dishDescription.compose,
    "",
    dishDescription.lightingDescription,
    "",
    `Shot on iPhone, natural smartphone photograph, everything in sharp focus, slightly imperfect framing${steam}.`,
    "",
    "No text, no labels, no logos, no watermarks, no hands, no people, no body parts visible in the image.",
  ]
    .filter((s) => s.length > 0)
    .join("\n");

  // ─── 6. Gemini Image Generation ─────────────────────────────────────────
  const tGen0 = Date.now();
  const result = await generateImageGemini({
    prompt: positivePrompt,
    aspectRatio: "1:1",
  });
  const tGen = Date.now() - tGen0;

  // ─── 7. Sharp Lanczos auf 3072, q=95 — identisch zu Flux-Pipeline ──────
  const processed = await sharp(result.buffer)
    .resize(3072, 3072, { kernel: sharp.kernel.lanczos3, fit: "fill" })
    .sharpen({ sigma: 0.5, m1: 0.6, m2: 0.4 })
    .jpeg({ quality: 95, mozjpeg: true, progressive: true })
    .toBuffer();

  // ─── 8. Upload ──────────────────────────────────────────────────────────
  const supabase = getServerSupabase();
  await supabase.storage.createBucket(TEST_BUCKET, {
    public: true,
    fileSizeLimit: 8 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg"],
  });
  const filePath = `${body.recipeSlug}-gemini-${Date.now()}.jpg`;
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

  // style ist nur in Response für Debug — wir haben kein style.negativeAddition
  // bei Gemini benutzt, da Gemini keinen separaten negative_prompt-Parameter
  // hat (Negatives müssen Teil des Haupt-Prompts sein, siehe oben).
  const style = await getBrandImageStyle(brandSlug);

  return NextResponse.json({
    ok: true,
    model: "gemini-2.5-flash-image",
    generatedUrl: publicUrl,
    timings: {
      apifyMs: tApify,
      framesMs: tFrames,
      visionMs: tVision,
      specMs: tSpec,
      geminiImageMs: tGen,
      totalMs: tTotal,
    },
    framesExtracted: frames.length,
    framesAnalyzedByVision: 8,
    dishDescription,
    positivePrompt,
    brandSlug: style.brandSlug,
  });
}
