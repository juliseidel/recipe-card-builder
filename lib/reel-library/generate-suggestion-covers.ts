import { generatePackCover } from "@/lib/ai/generate-pack-cover";
import {
  getServerSupabase,
  hasServerSupabase,
} from "@/lib/supabase-server";
import { updateSuggestionCover } from "@/lib/creator-reels-server";
import { loadBrand } from "@/lib/custom-brands-server";
import { getBrand } from "@/lib/brands";

// Generiert KI-Pack-Covers fuer alle pending Pack-Suggestions eines
// Brands. Wird am Ende von runClassificationAndSuggestions fire-and-
// forget aufgerufen — die Suggestion-Liste ist schon in der DB, die
// Cover-URLs werden nachgeschoben (UI polled die Liste).
//
// Parallelisierung: max 3 gleichzeitig, damit BFL Flux Rate-Limits nicht
// gerissen werden. Bei 6-10 Suggestions: 2-4 Rounds × ~12s = ~25-50s
// total. Fire-and-forget im after()-Hook der Caller-Lambda — wenn die
// Lambda timed out, ist die naechste Status-Route-Poll-Welle als Resume
// vorhanden.

const COVER_BUCKET = "pack-suggestion-covers";
const MAX_PARALLEL = 3;

type SuggestionCoverInput = {
  id: string;
  title: string;
  tagline: string;
};

export async function generateSuggestionCovers(opts: {
  brandSlug: string;
  suggestions: SuggestionCoverInput[];
}): Promise<{ generated: number; failed: number }> {
  if (!hasServerSupabase()) return { generated: 0, failed: 0 };
  if (opts.suggestions.length === 0) return { generated: 0, failed: 0 };
  if (!process.env.BFL_API_KEY) {
    console.warn(
      "[suggestion-covers] BFL_API_KEY fehlt — Cover-Generation uebersprungen."
    );
    return { generated: 0, failed: opts.suggestions.length };
  }

  // Brand-Background-Hex fuer die Cover-Backdrop-Color. Code-Brand
  // (Biene) hat die Farbe in lib/brands.ts hardcoded; DB-Brand laedt
  // sie aus dem Supabase-brands-Record.
  const bgHex = await getBrandBackground(opts.brandSlug);

  const supabase = getServerSupabase();
  await ensureBucket(supabase);

  let generated = 0;
  let failed = 0;

  // Chunked-parallel: MAX_PARALLEL Suggestions gleichzeitig.
  for (let i = 0; i < opts.suggestions.length; i += MAX_PARALLEL) {
    const chunk = opts.suggestions.slice(i, i + MAX_PARALLEL);
    const results = await Promise.allSettled(
      chunk.map(async (s) => {
        try {
          const { buffer } = await generatePackCover({
            title: s.title,
            tagline: s.tagline,
            bgHex,
          });
          const filePath = `${s.id}.jpg`;
          const upload = await supabase.storage
            .from(COVER_BUCKET)
            .upload(filePath, buffer, {
              contentType: "image/jpeg",
              upsert: true,
              cacheControl: "31536000",
            });
          if (upload.error) throw new Error(upload.error.message);
          const { data } = supabase.storage
            .from(COVER_BUCKET)
            .getPublicUrl(filePath);
          // Cache-Bust-Query-Param damit UI den frischen Upload sieht
          // statt einer evtl. gecachten alten Version (upsert=true).
          const url = `${data.publicUrl}?t=${Date.now()}`;
          await updateSuggestionCover(s.id, url);
          return url;
        } catch (err) {
          console.error(
            `[suggestion-covers] failed for "${s.title}":`,
            err instanceof Error ? err.message : err
          );
          throw err;
        }
      })
    );
    for (const r of results) {
      if (r.status === "fulfilled") generated++;
      else failed++;
    }
  }

  console.log(
    `[suggestion-covers] brand=${opts.brandSlug} generated=${generated} failed=${failed}`
  );
  return { generated, failed };
}

async function getBrandBackground(brandSlug: string): Promise<string> {
  // Code-Brand-Map zuerst — Biene & Co.
  const code = getBrand(brandSlug);
  if (code) return code.tokens.background;
  // DB-Brand: aus brands-Tabelle laden.
  const db = await loadBrand(brandSlug);
  if (db) return db.tokens.background;
  // Fallback: warm cream-honey aus dem Default-Brand-Preset.
  return "#f4d88d";
}

async function ensureBucket(
  supabase: ReturnType<typeof getServerSupabase>
): Promise<void> {
  try {
    await supabase.storage.createBucket(COVER_BUCKET, {
      public: true,
      fileSizeLimit: 12 * 1024 * 1024,
      allowedMimeTypes: ["image/jpeg"],
    });
  } catch {
    // Bucket existiert bereits — Standard-Fall, kein Fehler.
  }
}
