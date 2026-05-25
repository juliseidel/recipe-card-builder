import { NextResponse } from "next/server";
import { getServerSupabase, hasServerSupabase } from "@/lib/supabase-server";
import { updateCustomPackData } from "@/lib/custom-packs-server";
import { generateStoryPageImage } from "@/lib/ai/generate-story-page-image";
import { isBrandStyleHero } from "@/lib/ai/generate-foreword-collage";
import { loadVisibleRecipesForPack } from "@/lib/recipes";
import type { Pack, StoryPage } from "@/lib/packs";

// Story-Page-Bild-Generator-Endpoint (Inkrement 2 Stufe 2).
//
// POST /api/packs/[id]/story-pages/regenerate-image
// Body: { index: number }
//
// Generiert ein neues Lifestyle-Bild (Nano Banana) fuer pack.storyPages[index],
// laedt es nach Supabase Storage hoch und schreibt die URL zurueck ans
// pack.storyPages[index].imageUrl. Bestehende imageUrl wird ueberschrieben
// (Cache-Bust via Timestamp im Pfad).

export const runtime = "nodejs";
export const maxDuration = 90;

const BUCKET = "pack-story-images";

type RouteParams = { params: Promise<{ id: string }> };

type Body = {
  index?: number;
};

export async function POST(req: Request, { params }: RouteParams) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Pack-ID fehlt." }, { status: 400 });
  if (!hasServerSupabase()) {
    return NextResponse.json(
      { error: "Supabase nicht konfiguriert." },
      { status: 500 }
    );
  }
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY nicht gesetzt." },
      { status: 500 }
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
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

  if (
    typeof body.index !== "number" ||
    body.index < 0 ||
    body.index >= storyPages.length
  ) {
    return NextResponse.json(
      { error: `index muss zwischen 0 und ${storyPages.length - 1} liegen.` },
      { status: 400 }
    );
  }

  const story = storyPages[body.index];

  // Recipe-Heroes als Style-Anchor laden — gleicher Mechanismus wie beim
  // Foreword-Bild.
  const recipes = await loadVisibleRecipesForPack(brandSlug, pack.slug);
  const heroUrls: string[] = [];
  for (const recipe of recipes) {
    if (recipe.hero && isBrandStyleHero(recipe.hero)) {
      heroUrls.push(recipe.hero);
      if (heroUrls.length >= 3) break;
    }
  }

  let buffer: Buffer;
  let contentType: string;
  try {
    const result = await generateStoryPageImage(pack, story, { heroUrls });
    buffer = result.buffer;
    contentType = result.contentType;
  } catch (err) {
    console.error("[story-pages/regenerate-image] generation failed:", err);
    return NextResponse.json(
      {
        error: `Story-Bild-Generation fehlgeschlagen: ${
          err instanceof Error ? err.message : err
        }`,
      },
      { status: 500 }
    );
  }

  // Bucket idempotent erstellen
  await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 8 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  });

  const ext = contentType.includes("png") ? "png" : "jpg";
  const path = `${brandSlug}/${pack.slug}/${story.id}-${Date.now().toString(36)}.${ext}`;
  const up = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType,
    cacheControl: "31536000",
    upsert: false,
  });
  if (up.error) {
    return NextResponse.json(
      { error: `Upload fehlgeschlagen: ${up.error.message}` },
      { status: 500 }
    );
  }
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const imageUrl = pub.publicUrl;

  // storyPages-Array updaten
  const nextPages: StoryPage[] = storyPages.map((p, i) =>
    i === body.index ? { ...p, imageUrl } : p
  );
  const updated = await updateCustomPackData(id, { storyPages: nextPages });

  return NextResponse.json({
    ok: true,
    pack: updated,
    imageUrl,
    index: body.index,
  });
}
