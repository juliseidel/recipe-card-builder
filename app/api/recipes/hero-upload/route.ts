import { NextResponse } from "next/server";
import sharp from "sharp";
import { revalidateTag } from "next/cache";
import { getServerSupabase, hasServerSupabase } from "@/lib/supabase-server";
import type { Recipe } from "@/lib/recipes";

// Manuelles Bild-Upload fuer eine einzelne Rezeptkarte. Pendant zum
// HeroRerollButton (KI-Pipeline) — der User schickt ein eigenes Foto, wir
// schreiben es in denselben recipe-heroes Bucket und denselben data.hero
// Spaltenpfad, sodass Web-Card und PDF-Renderer das Bild ohne weitere
// Anpassungen aufnehmen.
//
// Pipeline-Schritte sind bewusst identisch zu lib/ai/generate-hero.ts
// uploadJpeg() — Lanczos-Upscale auf 3072, q=95 mozjpeg, Cache-Bust per
// ?t=<ms>. So gibt es im PDF keinen Look-Bruch zwischen KI-Hero und
// manuellem Upload (gleiches Korn, gleiche Schaerfe).

export const runtime = "nodejs";
export const maxDuration = 60;

const HERO_BUCKET = "recipe-heroes";
const STORAGE_LONG_EDGE = 3072;
const STORAGE_JPEG_QUALITY = 95;
const MAX_BYTES = 12 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/heic"];

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
  const recipeId = String(form.get("recipeId") ?? "");
  if (!recipeId) {
    return NextResponse.json({ error: "recipeId required" }, { status: 400 });
  }
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

  // DB-Row holen — wir brauchen die data-Spalte, um nur das hero-Feld zu
  // mergen (nicht alle anderen Felder zu clobbern).
  const { data: row, error: readErr } = await supabase
    .from("recipes")
    .select("id, data")
    .eq("id", recipeId)
    .maybeSingle();
  if (readErr || !row) {
    return NextResponse.json(
      { error: "Rezept nicht gefunden" },
      { status: 404 }
    );
  }

  // Sharp-Pipeline 1:1 zu generate-hero.ts. HEIC kommt von iPhone-Uploads
  // — sharp dekodiert das ueber libvips, falls die Plattform es kennt.
  let processed: Buffer;
  try {
    const raw = Buffer.from(await file.arrayBuffer());
    processed = await sharp(raw)
      .rotate() // EXIF-orientation auflösen (iPhone-Bilder kommen oft gedreht)
      .resize(STORAGE_LONG_EDGE, STORAGE_LONG_EDGE, {
        kernel: sharp.kernel.lanczos3,
        fit: "cover",
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

  // Bucket sicherstellen (idempotent).
  await supabase.storage.createBucket(HERO_BUCKET, {
    public: true,
    fileSizeLimit: 8 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg"],
  });

  const filePath = `${recipeId}.jpg`;
  const upload = await supabase.storage
    .from(HERO_BUCKET)
    .upload(filePath, processed, {
      contentType: "image/jpeg",
      upsert: true,
      cacheControl: "31536000",
    });
  if (upload.error) {
    return NextResponse.json(
      { error: `Upload fehlgeschlagen: ${upload.error.message}` },
      { status: 500 }
    );
  }

  const { data: publicData } = supabase.storage
    .from(HERO_BUCKET)
    .getPublicUrl(filePath);
  if (!publicData.publicUrl) {
    return NextResponse.json(
      { error: "Public-URL konnte nicht ermittelt werden" },
      { status: 500 }
    );
  }
  // Cache-Bust analog uploadJpeg() in generate-hero.ts.
  const heroUrl = `${publicData.publicUrl}?t=${Date.now()}`;

  // Merge in data-JSONB. Wir clobbern hero NICHT in einem partial-Update,
  // sondern lesen-merge-schreiben — sonst kollidiert ein paralleler Micros-
  // Write der Enrich-Pipeline (Pattern aus enrich/route.ts mergeRecipeData).
  const current = (row.data ?? {}) as Recipe;
  const merged: Recipe = { ...current, hero: heroUrl };
  const { error: writeErr } = await supabase
    .from("recipes")
    .update({ data: merged })
    .eq("id", recipeId);
  if (writeErr) {
    return NextResponse.json(
      { error: `DB-Update fehlgeschlagen: ${writeErr.message}` },
      { status: 500 }
    );
  }

  // Cache fuer Pack/Recipe-Reads droppen, damit Detail-Page und PDF beim
  // naechsten Read das neue Bild sehen (sonst bleibt der unstable_cache
  // bis zu 30 s mit der alten hero-URL).
  revalidateTag("pack-db-rows", { expire: 0 });

  return NextResponse.json({ url: heroUrl });
}
