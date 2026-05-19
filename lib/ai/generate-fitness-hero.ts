import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { getServerSupabase } from "@/lib/supabase-server";
import { extractVideoFrames } from "./extract-video-frames";
import { selectBestExerciseKeyframe } from "./select-exercise-keyframe";
import type { FitnessCard } from "@/lib/fitness/types";

// Fitness-Hero-Pipeline (Schritt 4, 2026-05-19).
//
// Im Gegensatz zur Recipe-Hero-Pipeline (lib/ai/generate-hero.ts) NUTZEN wir
// fuer Personen-Karten KEIN Flux. Gruende:
//   - KI-generierte Personen, die so aussehen wie der echte Creator, sind
//     rechtlich + ethisch problematisch
//   - Flux ist auf Food/Product gut, auf Human-Anatomy/Action eher schwach
//   - Anatomie-Konsistenz (richtige Haltung/Form) wird von Image-Gens nicht
//     verlaesslich eingehalten
//
// Statt dessen:
//   1) Apify scraped das Reel — videoUrl + displayUrl + caption
//   2) ffmpeg extrahiert ~14 Frames
//   3) Gemini Vision waehlt den besten Frame (Person mid-execution, gute
//      Form sichtbar) — siehe lib/ai/select-exercise-keyframe.ts
//   4) Sharp upscaled 2400px long edge + Lanczos3 + JPEG q=95
//   5) Upload nach Supabase Storage (recipe-heroes Bucket, prefix "fitness/")
//
// Output: URL des hochgeladenen JPEGs oder null bei Fail.
//
// Equipment-Cards (Workout-Cover, Mindset, Wochenplan) sind ein separater
// Pfad — die nutzen Flux mit Equipment-/Setting-Prompt. Aktuell noch nicht
// implementiert, kommt bei Bedarf in einem spaeteren Schritt.

const HERO_BUCKET = "recipe-heroes";
const STORAGE_LONG_EDGE = 2400; // wir behalten den Original-Aspekt — kein 1:1-Crop
const STORAGE_JPEG_QUALITY = 95;

export type GenerateFitnessHeroOpts = {
  card: FitnessCard;
  /** UUID der DB-Row — gleichzeitig Teil des Storage-Pfads. */
  cardId: string;
  brandSlug: string;
};

export type GenerateFitnessHeroResult = {
  heroUrl: string;
  source: "keyframe" | "cover";
  keyframeReasoning?: string;
  keyframeTimestamp?: number;
};

export async function generateFitnessHeroForCard(
  opts: GenerateFitnessHeroOpts
): Promise<GenerateFitnessHeroResult | null> {
  const { card, cardId, brandSlug } = opts;

  // Ohne sourceUrl koennen wir nichts machen. Bei Fitness-Cards ohne
  // Quell-Reel muss der User entweder ein eigenes Bild hochladen oder eine
  // Equipment-Karte ohne Hero rendern (Layout muss damit umgehen koennen).
  if (!card.sourceUrl) {
    console.warn(
      `[fitness-hero] no sourceUrl for card ${cardId}, skipping`
    );
    return null;
  }

  // Apify scraped das Reel — gleicher Code-Pfad wie bei Recipe-Hero, weil
  // Hyrox-Creator (Simon) und Bodybuilder (Marvin/Johny) auf denselben
  // Plattformen posten.
  const { scrapeAnySocialPost } = await import(
    "@/lib/integrations/platform"
  );
  let scraped: Awaited<ReturnType<typeof scrapeAnySocialPost>>;
  try {
    scraped = await scrapeAnySocialPost(card.sourceUrl);
  } catch (err) {
    console.warn(
      `[fitness-hero] scrape failed for ${card.sourceUrl}:`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
  if (!scraped) return null;

  const { post } = scraped;

  // ── Pfad 1: Video vorhanden → Keyframe via Gemini Vision ────────────────
  if (post.videoUrl) {
    try {
      const frames = await extractVideoFrames(post.videoUrl, {
        intervalSeconds: 1.5,
        maxFrames: 14,
      });
      if (frames.length === 0) {
        throw new Error("no frames extracted");
      }
      const pick = await selectBestExerciseKeyframe({
        frames,
        exerciseTitle: card.title,
        caption: post.caption ?? "",
      });

      // Frame in Buffer wandeln (data:image/jpeg;base64,... → Buffer)
      const base64 = pick.frame.dataUri.split(",")[1] ?? "";
      const buf = Buffer.from(base64, "base64");

      const supabase = getServerSupabase();
      await ensureHeroBucket(supabase);
      const heroUrl = await uploadFitnessJpeg(supabase, cardId, buf);
      if (!heroUrl) return null;

      return {
        heroUrl,
        source: "keyframe",
        keyframeReasoning: pick.reasoning,
        keyframeTimestamp: pick.frame.timestampSeconds,
      };
    } catch (err) {
      console.warn(
        `[fitness-hero] keyframe pipeline failed for ${cardId}:`,
        err instanceof Error ? err.message : err
      );
      // Fall-through zum Cover-Fallback
    }
  }

  // ── Pfad 2: Fallback auf Reel-Cover (displayUrl) ─────────────────────────
  if (post.displayUrl) {
    try {
      const res = await fetch(post.displayUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
        },
      });
      if (!res.ok) {
        throw new Error(`cover download HTTP ${res.status}`);
      }
      const buf = Buffer.from(await res.arrayBuffer());

      const supabase = getServerSupabase();
      await ensureHeroBucket(supabase);
      const heroUrl = await uploadFitnessJpeg(supabase, cardId, buf);
      if (!heroUrl) return null;

      return { heroUrl, source: "cover" };
    } catch (err) {
      console.warn(
        `[fitness-hero] cover fallback failed for ${cardId}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  // Beide Pfade fehlgeschlagen
  console.warn(
    `[fitness-hero] no hero source found for ${cardId} (${card.sourceUrl})`
  );
  void brandSlug; // currently unused, future hook fuer Brand-Style-Tweaks
  return null;
}

// ─── Storage-Helpers ────────────────────────────────────────────────────────
async function uploadFitnessJpeg(
  supabase: SupabaseClient,
  cardId: string,
  buf: Buffer
): Promise<string | null> {
  // Prefix "fitness/" damit Recipe-Heroes + Fitness-Heroes im selben Bucket
  // sauber getrennt sind. Spart die Anlage eines zweiten Buckets, behaelt
  // aber semantische Trennung im Storage.
  const filePath = `fitness/${cardId}.jpg`;

  // Wir behalten den Original-Aspekt (kein Crop auf 1:1) — Fitness-Reels
  // sind oft Portrait (9:16) oder Square, und Action-Shots brauchen den
  // vollen vertikalen Raum. Sharp resized auf STORAGE_LONG_EDGE long-edge,
  // andere Seite proportional. Plus modesty Sharpening + JPEG q=95.
  const processed = await sharp(buf)
    .resize(STORAGE_LONG_EDGE, STORAGE_LONG_EDGE, {
      kernel: sharp.kernel.lanczos3,
      fit: "inside", // proportional, keine Verzerrung
      withoutEnlargement: false, // upscale ok wenn source kleiner
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
    console.error("[fitness-hero] upload failed:", upload.error.message);
    return null;
  }
  const { data } = supabase.storage.from(HERO_BUCKET).getPublicUrl(filePath);
  if (!data.publicUrl) return null;
  // Cache-Bust analog zur Recipe-Pipeline — verhindert dass Vercel Image
  // Optimization das alte CDN-optimierte JPEG ausliefert, wenn wir das
  // underlying File ueberschreiben (Re-Roll).
  return `${data.publicUrl}?t=${Date.now()}`;
}

async function ensureHeroBucket(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.storage.createBucket(HERO_BUCKET, {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg"],
  });
  if (error && !/already exists/i.test(error.message)) {
    console.warn("[fitness-hero] bucket create warning:", error.message);
  }
}
