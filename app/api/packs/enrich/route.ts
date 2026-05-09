import { NextResponse, after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generatePackCover } from "@/lib/ai/generate-pack-cover";
import { generatePackForeword } from "@/lib/ai/generate-foreword";
import { generateForewordImage } from "@/lib/ai/generate-foreword-image";
import { getBrand } from "@/lib/brands";
import { getServerSupabase, hasServerSupabase } from "@/lib/supabase-server";
import type { Pack } from "@/lib/packs";

// Async pack-enrichment — generates everything a freshly-created custom
// pack needs to look like one of the curated Bienen-Packs:
//   1. Pack-Cover via Flux 2 Pro (~20-30 s)
//   2. Vorwort-Text via Gemini 2.5 Flash (~5 s) — Booklet-Greeting + Story + Signoff
//   3. Vorwort-Stillleben via Flux 2 Pro (~20-30 s)
//
// All three run inside after() so the POST returns a 202 immediately.
// The pack editor fires this fire-and-forget after the user clicks Save.
// Each task is independent — a Gemini hiccup doesn't kill the cover, a
// cover failure doesn't kill the foreword. Tasks that already have results
// (e.g. user re-edits the pack and triggers enrich again) are skipped.

export const runtime = "nodejs";
// Cover + Foreword-Image (parallel) ~30 s, Foreword-Text ~5 s, plus
// Storage-Upload/DB-Write overhead. Cap at 120 s to leave headroom.
export const maxDuration = 120;

const COVER_BUCKET = "pack-covers";
const FOREWORD_BUCKET = "pack-forewords";

type Body = {
  packId: string;
};

export async function POST(req: Request) {
  if (!hasServerSupabase()) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 500 }
    );
  }
  if (!process.env.BFL_API_KEY) {
    return NextResponse.json(
      { error: "BFL API key not configured" },
      { status: 500 }
    );
  }
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "Gemini API key not configured" },
      { status: 500 }
    );
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body?.packId) {
    return NextResponse.json(
      { error: "packId is required" },
      { status: 400 }
    );
  }

  const supabase = getServerSupabase();
  const { data: row, error } = await supabase
    .from("packs")
    .select("id, brand_slug, data")
    .eq("id", body.packId)
    .maybeSingle();
  if (error || !row) {
    return NextResponse.json(
      { error: error?.message ?? "Pack not found" },
      { status: 404 }
    );
  }

  const pack = row.data as Pack;
  const brand = getBrand(row.brand_slug);
  if (!brand) {
    return NextResponse.json(
      { error: `Brand '${row.brand_slug}' not found` },
      { status: 404 }
    );
  }

  // Per-task skip checks — re-running enrich (e.g. user edits a field)
  // mustn't burn a fresh Flux/Gemini call for results we already have.
  // Cover counts as "done" when its URL points at our own bucket;
  // foreword counts as "done" when both fields are populated.
  const hasCover =
    (pack.coverImage ?? "").includes(
      `/storage/v1/object/public/${COVER_BUCKET}/`
    );
  const hasForewordText = !!pack.foreword;
  const hasForewordImage = !!pack.forewordImage;

  if (hasCover && hasForewordText && hasForewordImage) {
    return NextResponse.json({
      status: "already-enriched",
      packId: row.id,
    });
  }

  after(async () => {
    // Three independent enrichment tasks. We use Promise.allSettled so a
    // failure in one (Gemini overloaded, Flux timeout) doesn't drop the
    // others. Each settled value is processed individually below.
    const [coverSettled, forewordTextSettled, forewordImageSettled] =
      await Promise.allSettled([
        hasCover
          ? Promise.resolve(null)
          : generatePackCover({ pack }).then((r) => r.buffer),
        hasForewordText
          ? Promise.resolve(null)
          : generatePackForeword(pack, brand),
        hasForewordImage
          ? Promise.resolve(null)
          : generateForewordImage(pack),
      ]);

    // ─── Upload Pack-Cover ─────────────────────────────────────────────────
    let newCoverImage: string | null = null;
    if (coverSettled.status === "fulfilled" && coverSettled.value) {
      try {
        await ensureBucket(supabase, COVER_BUCKET);
        const filePath = `${row.id}.jpg`;
        const upload = await supabase.storage
          .from(COVER_BUCKET)
          .upload(filePath, coverSettled.value, {
            contentType: "image/jpeg",
            upsert: true,
            cacheControl: "31536000",
          });
        if (upload.error) {
          console.error(
            "[packs/enrich] cover upload failed:",
            upload.error.message
          );
        } else {
          const { data } = supabase.storage
            .from(COVER_BUCKET)
            .getPublicUrl(filePath);
          newCoverImage = data.publicUrl;
        }
      } catch (err) {
        console.error("[packs/enrich] cover upload threw:", err);
      }
    } else if (coverSettled.status === "rejected") {
      console.error(
        "[packs/enrich] cover generation failed:",
        coverSettled.reason
      );
    }

    // ─── Foreword-Text — kein Upload, geht direkt in pack.data ────────────
    const newForeword =
      forewordTextSettled.status === "fulfilled"
        ? forewordTextSettled.value
        : null;
    if (forewordTextSettled.status === "rejected") {
      console.error(
        "[packs/enrich] foreword text generation failed:",
        forewordTextSettled.reason
      );
    }

    // ─── Upload Foreword-Stillleben ───────────────────────────────────────
    let newForewordImage: string | null = null;
    if (
      forewordImageSettled.status === "fulfilled" &&
      forewordImageSettled.value
    ) {
      try {
        await ensureBucket(supabase, FOREWORD_BUCKET);
        const filePath = `${row.id}.jpg`;
        const upload = await supabase.storage
          .from(FOREWORD_BUCKET)
          .upload(filePath, forewordImageSettled.value, {
            contentType: "image/jpeg",
            upsert: true,
            cacheControl: "31536000",
          });
        if (upload.error) {
          console.error(
            "[packs/enrich] foreword image upload failed:",
            upload.error.message
          );
        } else {
          const { data } = supabase.storage
            .from(FOREWORD_BUCKET)
            .getPublicUrl(filePath);
          newForewordImage = data.publicUrl;
        }
      } catch (err) {
        console.error("[packs/enrich] foreword image upload threw:", err);
      }
    } else if (forewordImageSettled.status === "rejected") {
      console.error(
        "[packs/enrich] foreword image generation failed:",
        forewordImageSettled.reason
      );
    }

    // ─── Read-modify-write: alle Felder in einem Schreibvorgang merge ─────
    // Wenn nichts neu generiert wurde (alle Tasks failed oder schon
    // vorhanden), sparen wir den Round-Trip in die DB.
    if (!newCoverImage && !newForeword && !newForewordImage) return;

    const { data: latest } = await supabase
      .from("packs")
      .select("data")
      .eq("id", row.id)
      .maybeSingle();
    const current = (latest?.data as Pack | undefined) ?? pack;
    const merged: Pack = { ...current };
    if (newCoverImage) merged.coverImage = newCoverImage;
    if (newForeword) merged.foreword = newForeword;
    if (newForewordImage) merged.forewordImage = newForewordImage;

    await supabase.from("packs").update({ data: merged }).eq("id", row.id);
  });

  return NextResponse.json(
    { status: "enriching", packId: row.id },
    { status: 202 }
  );
}

async function ensureBucket(
  supabase: SupabaseClient,
  bucket: string
): Promise<void> {
  const { error } = await supabase.storage.createBucket(bucket, {
    public: true,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg"],
  });
  if (error && !/already exists/i.test(error.message)) {
    console.warn(
      `[packs/enrich] bucket '${bucket}' create warning:`,
      error.message
    );
  }
}
