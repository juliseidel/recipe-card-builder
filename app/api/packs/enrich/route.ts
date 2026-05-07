import { NextResponse, after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generatePackCover } from "@/lib/ai/generate-pack-cover";
import { getServerSupabase, hasServerSupabase } from "@/lib/supabase-server";
import { getBrand } from "@/lib/brands";
import type { Pack } from "@/lib/packs";

// Async pack-cover generation — analogous to /api/recipes/enrich but for
// custom packs the user just created. Triggered fire-and-forget by the
// pack editor after a save. Generates a Flux 2 Pro cover image, uploads
// to Supabase Storage, and writes the URL back into packs.data.coverImage.

export const runtime = "nodejs";
// Cover render is a single Flux call — typically 15-25 s, occasionally up
// to 60 s under load.
export const maxDuration = 90;

const COVER_BUCKET = "pack-covers";

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
  const brandSlug = (row.brand_slug as string) || "biene";
  const brand = getBrand(brandSlug);

  if (!brand) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  // Skip if cover already looks AI-generated (URL points at our bucket) — the
  // user might re-trigger by editing, we don't want to burn another Flux
  // call if we already have one.
  const existing = pack.coverImage ?? "";
  const alreadyAi =
    existing.includes(`/storage/v1/object/public/${COVER_BUCKET}/`);
  if (alreadyAi) {
    return NextResponse.json({
      status: "already-enriched",
      packId: row.id,
    });
  }

  after(async () => {
    try {
      const { buffer } = await generatePackCover({ pack, brand });
      await ensureCoverBucket(supabase);
      const filePath = `${row.id}.jpg`;
      const upload = await supabase.storage
        .from(COVER_BUCKET)
        .upload(filePath, buffer, {
          contentType: "image/jpeg",
          upsert: true,
          cacheControl: "31536000",
        });
      if (upload.error) {
        console.error(
          "[packs/enrich] cover upload failed:",
          upload.error.message
        );
        return;
      }
      const { data } = supabase.storage
        .from(COVER_BUCKET)
        .getPublicUrl(filePath);
      const coverImage = data.publicUrl;
      if (!coverImage) return;

      // Read-modify-write: keep all other pack fields intact while only
      // updating coverImage. Other tasks (none yet) could write here too.
      const { data: latest } = await supabase
        .from("packs")
        .select("data")
        .eq("id", row.id)
        .maybeSingle();
      const current = (latest?.data as Pack | undefined) ?? pack;
      const merged: Pack = { ...current, coverImage };
      await supabase
        .from("packs")
        .update({ data: merged })
        .eq("id", row.id);
    } catch (err) {
      console.error("[packs/enrich] failed for", body.packId, err);
    }
  });

  return NextResponse.json(
    { status: "enriching", packId: row.id },
    { status: 202 }
  );
}

async function ensureCoverBucket(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.storage.createBucket(COVER_BUCKET, {
    public: true,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg"],
  });
  if (error && !/already exists/i.test(error.message)) {
    console.warn("[packs/enrich] bucket create warning:", error.message);
  }
}
