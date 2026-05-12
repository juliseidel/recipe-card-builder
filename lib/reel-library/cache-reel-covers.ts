import {
  getServerSupabase,
  hasServerSupabase,
} from "@/lib/supabase-server";

// Cacht die Reel-Cover (Instagram-display_url / TikTok-coverUrl) als
// JPEGs in Supabase Storage. Wird vom Webhook-Receiver nach upsertReels
// im Hintergrund gefeuert + von einem Recovery-Endpoint, falls bestehende
// Brands noch keine cover_storage_url haben.
//
// Warum?
// Instagram/Facebook-CDN-URLs haben eingebaute Signaturen mit ~1-3 Stunden
// Expiry. Nach Ablauf gibt der CDN 403, auch mit Browser-User-Agent +
// Referrer. Folge: die display_url-Werte in unserer DB sind nach kurzer
// Zeit nicht mehr nutzbar fuer UI-Rendering.
//
// Loesung: wir downloaden die Cover frisch beim Backfill (URLs sind dann
// noch gueltig) + uploaden sie in unseren eigenen Storage-Bucket. Die
// resultierende URL ist permanent.
//
// Cost-Calc:
// - 200 Reels × ~80-200 KB JPEG = ~20-40 MB Storage pro Brand
// - Download-Time: parallel × 10 concurrent = ~20s fuer 200 Reels
// - Bei Cron-Refresh (30 Tage / 50 Reels): ~5s extra, ~5 MB extra

const COVER_BUCKET = "reel-covers";
const PARALLEL_DOWNLOADS = 10;
const TIMEOUT_MS = 10_000;

type ReelToCache = {
  id: string;
  ig_id: string;
  display_url: string | null;
  cover_storage_url: string | null;
};

export async function cacheReelCovers(opts: {
  brandSlug: string;
}): Promise<{ cached: number; failed: number; skipped: number }> {
  if (!hasServerSupabase()) {
    return { cached: 0, failed: 0, skipped: 0 };
  }
  const supabase = getServerSupabase();

  // Bucket idempotent anlegen.
  try {
    await supabase.storage.createBucket(COVER_BUCKET, {
      public: true,
      fileSizeLimit: 4 * 1024 * 1024,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    });
  } catch {
    /* bucket existiert bereits */
  }

  // Hole alle Reels die noch nicht gecached sind + display_url haben.
  const { data, error } = await supabase
    .from("creator_reels")
    .select("id, ig_id, display_url, cover_storage_url")
    .eq("brand_slug", opts.brandSlug)
    .not("display_url", "is", null)
    .is("cover_storage_url", null);

  if (error) {
    console.error(
      "[cache-reel-covers] select failed:",
      error.message
    );
    return { cached: 0, failed: 0, skipped: 0 };
  }

  const todo = (data ?? []) as ReelToCache[];
  if (todo.length === 0) {
    return { cached: 0, failed: 0, skipped: 0 };
  }

  let cached = 0;
  let failed = 0;
  let skipped = 0;

  // Chunked parallel — vermeidet zu viele parallele Fetches gegen Instagram.
  for (let i = 0; i < todo.length; i += PARALLEL_DOWNLOADS) {
    const chunk = todo.slice(i, i + PARALLEL_DOWNLOADS);
    const results = await Promise.allSettled(
      chunk.map(async (reel) => {
        if (!reel.display_url) {
          skipped++;
          return null;
        }
        try {
          const controller = new AbortController();
          const timeout = setTimeout(
            () => controller.abort(),
            TIMEOUT_MS
          );

          // Instagram-CDN ist freundlich gegenueber Browser-User-Agents +
          // Referrer. Wenn die URL noch nicht expired ist, kriegen wir
          // das JPEG. Wenn expired (403): catch, mark als failed.
          const res = await fetch(reel.display_url, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
              Referer: "https://www.instagram.com/",
              Accept: "image/avif,image/webp,image/jpeg,image/png,*/*",
            },
            signal: controller.signal,
          });
          clearTimeout(timeout);

          if (!res.ok) {
            console.warn(
              `[cache-reel-covers] fetch failed for ${reel.ig_id}: HTTP ${res.status}`
            );
            failed++;
            return null;
          }

          const contentType =
            res.headers.get("content-type")?.split(";")[0]?.trim() ??
            "image/jpeg";
          const buffer = Buffer.from(await res.arrayBuffer());

          // Path: {brand}/{ig_id}.jpg — Brand-Namespace damit beim Brand-
          // Delete der ganze Folder gecleaned werden kann (zukuenftig).
          const ext =
            contentType === "image/png"
              ? "png"
              : contentType === "image/webp"
                ? "webp"
                : "jpg";
          const path = `${opts.brandSlug}/${reel.ig_id}.${ext}`;

          const upload = await supabase.storage
            .from(COVER_BUCKET)
            .upload(path, buffer, {
              contentType,
              upsert: true,
              cacheControl: "31536000",
            });
          if (upload.error) {
            console.warn(
              `[cache-reel-covers] upload failed for ${reel.ig_id}:`,
              upload.error.message
            );
            failed++;
            return null;
          }

          const { data: urlData } = supabase.storage
            .from(COVER_BUCKET)
            .getPublicUrl(path);
          const publicUrl = urlData.publicUrl;

          // DB-Update.
          const updateRes = await supabase
            .from("creator_reels")
            .update({ cover_storage_url: publicUrl })
            .eq("id", reel.id);
          if (updateRes.error) {
            console.warn(
              `[cache-reel-covers] db-update failed for ${reel.ig_id}:`,
              updateRes.error.message
            );
            failed++;
            return null;
          }

          cached++;
          return publicUrl;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(
            `[cache-reel-covers] error for ${reel.ig_id}:`,
            msg
          );
          failed++;
          return null;
        }
      })
    );
    // results gibt's, wir haben oben die Counter schon gesetzt. (Hier
    // nur Sicherheitsnetz falls eine Promise-Wrapper-Exception kommt.)
    void results;
  }

  console.log(
    `[cache-reel-covers] brand=${opts.brandSlug} cached=${cached} failed=${failed} skipped=${skipped} todo=${todo.length}`
  );
  return { cached, failed, skipped };
}
