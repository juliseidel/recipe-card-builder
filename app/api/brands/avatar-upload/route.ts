import { NextResponse } from "next/server";
import { getServerSupabase, hasServerSupabase } from "@/lib/supabase-server";

// Server-Endpoint fuer das Brand-Onboarding (/new-brand). Der Client postet
// ein multipart/form-data mit `file` und `brandSlug`. Das Avatar landet im
// `brand-avatars`-Bucket unter `uploads/{slug}-{ts}-{rand}.{ext}`; die URL
// kommt zurueck in der Response und wird beim Brand-Insert in
// `brand.avatar` gespeichert. Spiegelt /api/packs/cover-upload — nur anderer
// Bucket, anderer Slug-Prefix.

export const runtime = "nodejs";
export const maxDuration = 30;

const AVATAR_BUCKET = "brand-avatars";
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB — fuer Profilbilder mehr als ausreichend
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
  const brandSlug = String(form.get("brandSlug") ?? "brand");
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
      { error: `Format nicht unterstuetzt: ${file.type}` },
      { status: 400 }
    );
  }

  const supabase = getServerSupabase();

  // Bucket idempotent anlegen — zweiter Call landet bei "already exists".
  await supabase.storage.createBucket(AVATAR_BUCKET, {
    public: true,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: ACCEPTED,
  });

  const ext = extensionFor(file.type);
  const path = `uploads/${brandSlug}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const upload = await supabase.storage
    .from(AVATAR_BUCKET)
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

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
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
