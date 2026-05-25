import { NextResponse } from "next/server";
import sharp from "sharp";
import { getServerSupabase, hasServerSupabase } from "@/lib/supabase-server";
import { updateCustomPackData } from "@/lib/custom-packs-server";
import type { Pack, StoryPage } from "@/lib/packs";

// Manuelles Bild-Upload fuer eine einzelne Story-Seite. Pendant zum
// regenerate-image-Endpoint (KI-Pipeline) — User schickt eigenes Foto,
// wir schreiben es in den pack-story-images Bucket und setzen die
// imageUrl an der richtigen Story-Page.
//
// Sharp-Pipeline analog zu hero-upload: Lanczos auf 2048 (story-Bilder
// sind 16:9, kleineres Long-Edge reicht), q=92 mozjpeg.

export const runtime = "nodejs";
export const maxDuration = 60;

const BUCKET = "pack-story-images";
const STORAGE_LONG_EDGE = 2048;
const STORAGE_JPEG_QUALITY = 92;
const MAX_BYTES = 12 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/heic"];

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: RouteParams) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Pack-ID fehlt." }, { status: 400 });
  if (!hasServerSupabase()) {
    return NextResponse.json(
      { error: "Supabase nicht konfiguriert." },
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
  const indexStr = String(form.get("index") ?? "");
  const index = Number.parseInt(indexStr, 10);
  if (!Number.isFinite(index) || index < 0) {
    return NextResponse.json({ error: "index required" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `Datei zu gross (max. ${MAX_BYTES / 1024 / 1024} MB)` },
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
  const { data: row, error: readErr } = await supabase
    .from("packs")
    .select("id, brand_slug, data")
    .eq("id", id)
    .maybeSingle();
  if (readErr || !row) {
    return NextResponse.json({ error: "Pack nicht gefunden." }, { status: 404 });
  }
  const pack = row.data as Pack;
  const brandSlug = row.brand_slug as string;
  const storyPages = pack.storyPages ?? [];
  if (index >= storyPages.length) {
    return NextResponse.json(
      { error: `index ${index} ausserhalb storyPages-Bereich.` },
      { status: 400 }
    );
  }
  const story = storyPages[index];

  // Sharp-Pipeline — wir konvertieren immer zu JPEG fuer einheitlichen
  // Output (PDF-Renderer + Web-Hub erwarten konsistentes Format).
  let processed: Buffer;
  try {
    const raw = Buffer.from(await file.arrayBuffer());
    processed = await sharp(raw)
      .rotate()
      .resize(STORAGE_LONG_EDGE, STORAGE_LONG_EDGE, {
        kernel: sharp.kernel.lanczos3,
        fit: "inside",
      })
      .sharpen({ sigma: 0.5, m1: 0.6, m2: 0.4 })
      .jpeg({
        quality: STORAGE_JPEG_QUALITY,
        mozjpeg: true,
        progressive: true,
      })
      .toBuffer();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Bild konnte nicht verarbeitet werden: ${msg}` },
      { status: 400 }
    );
  }

  await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 8 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  });

  const path = `${brandSlug}/${pack.slug}/${story.id}-${Date.now().toString(36)}.jpg`;
  const upload = await supabase.storage.from(BUCKET).upload(path, processed, {
    contentType: "image/jpeg",
    cacheControl: "31536000",
    upsert: false,
  });
  if (upload.error) {
    return NextResponse.json(
      { error: `Upload fehlgeschlagen: ${upload.error.message}` },
      { status: 500 }
    );
  }
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const imageUrl = `${pub.publicUrl}?t=${Date.now()}`;

  const nextPages: StoryPage[] = storyPages.map((p, i) =>
    i === index ? { ...p, imageUrl } : p
  );
  const updated = await updateCustomPackData(id, { storyPages: nextPages });

  return NextResponse.json({ ok: true, pack: updated, imageUrl, index });
}
