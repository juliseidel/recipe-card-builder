import { NextResponse } from "next/server";
import { getServerSupabase, hasServerSupabase } from "@/lib/supabase-server";

// Server route for the pack-editor's "Eigenes Bild hochladen" feature. The
// client posts a multipart form with a single `file` field and a `packSlug`
// (used only as part of the storage path so the URL stays human-readable).
// The image lands in the `pack-covers` bucket under a temp/ prefix; it gets
// promoted to its final {packId}.jpg path once the pack itself is saved.

export const runtime = "nodejs";
export const maxDuration = 30;

const COVER_BUCKET = "pack-covers";
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB — generous for raw camera shots
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

export async function POST(req: Request) {
  if (!hasServerSupabase()) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 500 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  const packSlug = String(form.get("packSlug") ?? "pack");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `Datei zu groß (max. ${MAX_BYTES / 1024 / 1024} MB)` },
      { status: 400 }
    );
  }
  if (!ACCEPTED.includes(file.type)) {
    return NextResponse.json(
      { error: `Format nicht unterstützt: ${file.type}` },
      { status: 400 }
    );
  }

  const supabase = getServerSupabase();

  // Make sure the bucket exists. Idempotent — second call hits "already
  // exists" and is a no-op.
  await supabase.storage.createBucket(COVER_BUCKET, {
    public: true,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: ACCEPTED,
  });

  const ext = extensionFor(file.type);
  const path = `uploads/${packSlug}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const upload = await supabase.storage
    .from(COVER_BUCKET)
    .upload(path, buffer, {
      contentType: file.type,
      upsert: false,
      cacheControl: "31536000",
    });

  if (upload.error) {
    return NextResponse.json(
      { error: `Upload fehlgeschlagen: ${upload.error.message}` },
      { status: 500 }
    );
  }

  const { data } = supabase.storage.from(COVER_BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}

function extensionFor(mime: string): string {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/jpeg":
    default:
      return "jpg";
  }
}
