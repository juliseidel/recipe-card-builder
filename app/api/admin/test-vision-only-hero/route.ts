import { NextResponse } from "next/server";
import sharp from "sharp";
import {
  scrapeInstagramPost,
  normalizeInstagramUrl,
} from "@/lib/integrations/apify";
import { extractVideoFrames } from "@/lib/ai/extract-video-frames";
import { describeDishStructured } from "@/lib/ai/describe-dish-structured";
import {
  selectReferenceFrame,
  type CropMode,
} from "@/lib/ai/select-reference-frame";
import { generateImageSpec } from "@/lib/ai/recipe-image-spec";
import { getBrandImageStyle } from "@/lib/ai/brand-image-style";
import { generateImage, downloadImage } from "@/lib/ai/bfl-flux";
import { recipes } from "@/lib/recipes";
import { getServerSupabase, hasServerSupabase } from "@/lib/supabase-server";

// V7 — Hybrid: Vision-Description + Reference-Image (cropped) für echte
// Farbe. Reference-Pfad nur wenn ein cleaner Frame existiert; sonst
// V6-Fallback (Text-Only mit Vision-Description).
//
// Pipeline:
//   1. Apify scrape + 25 Frames extrahieren
//   2. PARALLEL: describeDishStructured (last 8) + selectReferenceFrame (last 15)
//   3. Wenn Frame-Selection cleanEnough=true:
//      a. Sharp crop basierend auf cropMode (center_square/top/bottom)
//      b. Safety-Check: Gemini Vision schaut cropped Frame nochmal
//      c. Wenn sauber → Flux mit input_image
//      d. Wenn schmutzig → V6-Fallback
//   4. Wenn Frame-Selection cleanEnough=false → V6-Fallback direkt
//
// V6-Fallback = identisch zu V6: nur Vision-compose + lightingDescription
// + minimaler smartphone hint. Kein Reference-Image.

export const runtime = "nodejs";
export const maxDuration = 300;

const TEST_BUCKET = "test-vision-hero";

function steamSuffix(temp: string): string {
  return temp === "hot" ? ", with subtle steam rising" : "";
}

// Sharp Crop: nimmt 9:16-Frame (1080x1920 typisch) und cropt 1:1.
async function cropFrame(
  dataUri: string,
  mode: CropMode
): Promise<string | null> {
  if (mode === "uncroppable") return null;
  const base64 = dataUri.split(",")[1] ?? "";
  if (!base64) return null;
  const buf = Buffer.from(base64, "base64");

  const img = sharp(buf);
  const meta = await img.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width === 0 || height === 0) return null;

  // Quadrat-Größe = kleinere Dimension (typically 1080 wenn 1080x1920)
  const sq = Math.min(width, height);

  let top = 0;
  const left = Math.floor((width - sq) / 2); // immer horizontal mittig

  if (height > sq) {
    // portrait — wir können vertikal cropen
    if (mode === "center_square") {
      top = Math.floor((height - sq) / 2);
    } else if (mode === "top_square") {
      top = 0;
    } else if (mode === "bottom_square") {
      top = height - sq;
    }
  }

  const cropped = await img
    .extract({ left, top, width: sq, height: sq })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
  return `data:image/jpeg;base64,${cropped.toString("base64")}`;
}

// Safety-Check: lade cropped frame als blob URL → temp upload → vision check.
// Einfacher: data URI direkt an describeInstagramDish — aber das Helper-File
// erwartet eine URL. Wir machen einen Inline-Vision-Call.
async function verifyCroppedFrameClean(dataUri: string): Promise<{
  clean: boolean;
  reason: string;
} | null> {
  const base64 = dataUri.split(",")[1] ?? "";
  if (!base64) return null;
  try {
    const { callGeminiMultimodal } = await import("@/lib/ai/gemini");
    const result = await callGeminiMultimodal<{
      clean: boolean;
      reason: string;
    }>({
      parts: [
        {
          text: "Prüfe ob dieses Bild als Reference-Image für ein KI-Bild-Generierungs-System taugt. Es muss SAUBER sein: kein sichtbarer Text/Buchstaben/Schrift/Banner/Sticker/Watermark, keine Hand/Finger/Personen/Körperteile, kein Logo. Wenn auch nur ein kleines Stück Text/Hand sichtbar ist → clean=false.",
        },
        {
          inlineData: { mimeType: "image/jpeg", data: base64 },
        },
      ],
      schema: {
        type: "object",
        properties: {
          clean: { type: "boolean" },
          reason: { type: "string" },
        },
        required: ["clean", "reason"],
      },
      systemInstruction:
        "Du bist ein strikter Quality-Auditor. Antworte ehrlich: ist dieses Bild komplett frei von Text, Schrift, Banner, Stickern, Watermarks, Logos, Händen, Personen, Körperteilen? Bei Zweifel: clean=false.",
      model: "flash",
      temperature: 0.1,
      maxOutputTokens: 256,
      thinkingBudget: 0,
      retries: 1,
    });
    return { clean: Boolean(result.clean), reason: (result.reason ?? "").trim() };
  } catch (err) {
    console.warn("[verifyCroppedFrameClean] failed:", err);
    return null;
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

  // ─── 3. Parallel: Description (last 8) + Reference-Selection (last 15) ─
  const visionSample = frames.slice(-8);
  const selectionSample = frames.slice(-15);
  const tVision0 = Date.now();
  const [dishDescription, refSelection] = await Promise.all([
    describeDishStructured({
      frames: visionSample,
      recipeTitle: recipe.title,
      caption: post.caption,
    }),
    selectReferenceFrame(selectionSample),
  ]);
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

  // ─── 5. Reference-Pfad-Entscheidung ─────────────────────────────────────
  let referenceImage: string | null = null;
  let referencePath: "cropped" | "fallback" | "no-selection" = "no-selection";
  let safetyReason = "";

  if (refSelection && refSelection.cleanEnough && refSelection.chosenIndex >= 0) {
    const sourceFrame = selectionSample[refSelection.chosenIndex];
    if (sourceFrame) {
      const cropped = await cropFrame(sourceFrame.dataUri, refSelection.cropMode);
      if (cropped) {
        // Safety-Check auf cropped Frame
        const verify = await verifyCroppedFrameClean(cropped);
        if (verify && verify.clean) {
          referenceImage = cropped;
          referencePath = "cropped";
          safetyReason = verify.reason;
        } else {
          referencePath = "fallback";
          safetyReason = verify
            ? `Safety-Check failed: ${verify.reason}`
            : "Safety-Check call failed";
        }
      }
    }
  } else {
    referencePath = "fallback";
    safetyReason = refSelection
      ? `Vision-Selector: cleanEnough=false (${refSelection.reasoning})`
      : "Vision-Selector returned null";
  }

  // ─── 6. Prompt bauen — identisch zu V6 ──────────────────────────────────
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

  const baseNegative =
    "no text, no labels, no logos, no packaging, no watermark, no hands, no people, no faces, no studio lighting, no white void background";
  const style = await getBrandImageStyle(brandSlug);
  const negativePrompt = style.negativeAddition
    ? `${baseNegative}, ${style.negativeAddition}`
    : baseNegative;

  // ─── 7. Flux 2 Pro Call (mit oder ohne Reference) ───────────────────────
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
    ...(referenceImage ? { referenceImage } : {}),
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
  const filePath = `${body.recipeSlug}-v7-${referencePath}-${Date.now()}.jpg`;
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

  // Optional: cropped reference auch hochladen für Debug-Inspektion
  let referenceImageUrl: string | null = null;
  if (referenceImage) {
    try {
      const refBase64 = referenceImage.split(",")[1] ?? "";
      const refBuf = Buffer.from(refBase64, "base64");
      const refPath = `${body.recipeSlug}-v7-REFERENCE-${Date.now()}.jpg`;
      const refUpload = await supabase.storage
        .from(TEST_BUCKET)
        .upload(refPath, refBuf, {
          contentType: "image/jpeg",
          upsert: true,
        });
      if (!refUpload.error) {
        const { data: refData } = supabase.storage
          .from(TEST_BUCKET)
          .getPublicUrl(refPath);
        referenceImageUrl = refData.publicUrl;
      }
    } catch (err) {
      console.warn("[V7] reference debug upload failed:", err);
    }
  }

  const tTotal = Date.now() - t0;

  return NextResponse.json({
    ok: true,
    version: "v7",
    generatedUrl: publicUrl,
    referenceImageUrl, // null wenn fallback path
    timings: {
      apifyMs: tApify,
      framesMs: tFrames,
      visionMs: tVision,
      specMs: tSpec,
      fluxMs: tFlux,
      totalMs: tTotal,
    },
    framesExtracted: frames.length,
    referencePath,
    referenceSelection: refSelection,
    safetyReason,
    fluxSeed: result.seed,
    dishDescription,
    positivePrompt,
    negativePrompt,
  });
}
