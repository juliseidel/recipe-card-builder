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

// Cinematic-Look-Parameter — heben Reel-Frame-Aufnahme auf Magazin-Niveau.
// Werte sind subtil gehalten: Ziel ist "Foto sieht professionell aus", nicht
// "Foto ist offensichtlich gefiltert". Bei zu aggressivem Boost werden
// Hauttoene unnatuerlich.
const CINEMATIC_SATURATION = 1.08;   // +8% Saettigung (Farben kraftvoller)
const CINEMATIC_BRIGHTNESS = 0.97;   // -3% Brightness (mehr Tiefe in Shadows)
const CINEMATIC_SHARPEN_SIGMA = 0.7; // etwas mehr als Recipe-Pipeline (0.5)
const VIGNETTE_INTENSITY = 0.35;     // 0..1 — Staerke des dunklen Edges-Rings

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

  // Cinematic-Pipeline:
  //   1) Resize auf STORAGE_LONG_EDGE long-edge (proportional, kein Crop)
  //   2) modulate — Saettigung leicht hoch, Brightness leicht runter (mehr
  //      Tiefe in Shadows, kraftvolle Farben — typischer Magazin-Look)
  //   3) sharpen — etwas aggressiver als Recipe-Pipeline weil Reel-Source
  //      oft weicher ist als Studio-Photos
  //   4) Vignette composite (SVG-radial-gradient, dark edges) — subtiler
  //      cinematic frame ohne dass es nach "Photoshop-Vignette" aussieht
  //   5) JPEG q=95 mit mozjpeg + progressive
  const base = await sharp(buf)
    .resize(STORAGE_LONG_EDGE, STORAGE_LONG_EDGE, {
      kernel: sharp.kernel.lanczos3,
      fit: "inside",
      withoutEnlargement: false,
    })
    .modulate({
      saturation: CINEMATIC_SATURATION,
      brightness: CINEMATIC_BRIGHTNESS,
    })
    .sharpen({ sigma: CINEMATIC_SHARPEN_SIGMA, m1: 0.7, m2: 0.4 })
    .toBuffer({ resolveWithObject: true });

  const { width: outWidth, height: outHeight } = base.info;
  const vignette = buildVignetteSvg(outWidth, outHeight, VIGNETTE_INTENSITY);

  const processed = await sharp(base.data)
    .composite([{ input: vignette, blend: "multiply" }])
    .jpeg({
      quality: STORAGE_JPEG_QUALITY,
      mozjpeg: true,
      progressive: true,
      // chromaSubsampling 4:4:4 statt default 4:2:0 — feinere Farb-Details
      // besonders an Hautton-Kanten, lohnt sich bei q=95.
      chromaSubsampling: "4:4:4",
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

// Generiert ein SVG-Buffer mit radial-Gradient (transparent in der Mitte,
// dunkel an den Edges). Sharp composited das mit multiply-blend auf das
// Hero-Bild → subtile cinematic Vignette. SVG statt PNG damit es exakt zur
// Bildgroesse passt ohne Resize-Artefakte.
//
// intensity 0..1:
//   0 = keine Vignette (alpha 0 ueberall, Multiply = unveraendert)
//   1 = harte Vignette (alpha 1 an den Edges, Multiply = schwarz)
// 0.35 = sehr subtil, etwa "professional editorial photo finish"
function buildVignetteSvg(
  width: number,
  height: number,
  intensity: number
): Buffer {
  const cx = width / 2;
  const cy = height / 2;
  // Radius bis zur Ecke (Pythagoras)
  const rOuter = Math.hypot(cx, cy);
  // Inner-Stop bei ~50% Radius — bis dort transparent, dann linear zur Ecke
  // hin dunkler werdend
  const rInner = rOuter * 0.5;
  // Edge-Alpha aus intensity (0..1) — 0.35 → alpha ~0.35 an den Ecken
  const alpha = Math.max(0, Math.min(1, intensity));
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <radialGradient id="vignette" cx="${cx}" cy="${cy}" r="${rOuter}" fx="${cx}" fy="${cy}" gradientUnits="userSpaceOnUse">
          <stop offset="${(rInner / rOuter).toFixed(4)}" stop-color="rgb(255,255,255)" stop-opacity="1" />
          <stop offset="1" stop-color="rgb(0,0,0)" stop-opacity="${alpha.toFixed(3)}" />
        </radialGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#vignette)" />
    </svg>
  `;
  return Buffer.from(svg);
}
