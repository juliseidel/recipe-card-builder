import { NextResponse } from "next/server";
import { getServerSupabase, hasServerSupabase } from "@/lib/supabase-server";
import { updateCustomPackData } from "@/lib/custom-packs-server";
import { loadBrand } from "@/lib/custom-brands-server";
import { generateStoryPages } from "@/lib/ai/generate-story-pages";
import { loadVisibleRecipesForPack } from "@/lib/recipes";
import type { Pack } from "@/lib/packs";

// Story-Pages-Generator-Endpoint fuer den Guide-Modus.
//
// POST /api/packs/[id]/story-pages/generate
// Body (optional): { kinds?: StoryPageKind[], replace?: boolean }
//   - kinds: welche Kinds generieren (default: alle 3 Standard-Kinds)
//   - replace: true ueberschreibt existierende storyPages. Default false →
//     wenn pack.storyPages bereits gefuellt ist, returnt 200 ohne Aktion.
//
// Setzt automatisch pack.packMode = "guide" wenn nicht bereits gesetzt.

export const runtime = "nodejs";
// Story-Pages = 1 Gemini-Pro-Call (alle 3 Pages auf einmal), Backoff +
// Retry-Pass ~2x60s. 120s Headroom.
export const maxDuration = 120;

type RouteParams = { params: Promise<{ id: string }> };

type Body = {
  kinds?: Array<"personal-story" | "philosophy" | "what-you-find">;
  replace?: boolean;
};

export async function POST(req: Request, { params }: RouteParams) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Pack-ID fehlt." }, { status: 400 });
  }
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
    body = await req.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const supabase = getServerSupabase();
  const { data: row, error: readErr } = await supabase
    .from("packs")
    .select("id, brand_slug, data")
    .eq("id", id)
    .maybeSingle();
  if (readErr || !row) {
    return NextResponse.json(
      { error: "Pack nicht gefunden." },
      { status: 404 }
    );
  }

  const pack = row.data as Pack;
  const brandSlug = row.brand_slug as string;

  // Defensive: wenn schon Pages da + nicht replace → no-op
  if (
    !body.replace &&
    pack.storyPages &&
    pack.storyPages.length > 0
  ) {
    return NextResponse.json({
      ok: true,
      pack,
      message: "Story-Pages bereits vorhanden. ?replace=true zum Ueberschreiben.",
    });
  }

  const brand = await loadBrand(brandSlug);
  if (!brand) {
    return NextResponse.json(
      { error: `Brand '${brandSlug}' nicht gefunden.` },
      { status: 404 }
    );
  }

  // Recipe-Titel fuer what-you-find-Page laden.
  const recipes = await loadVisibleRecipesForPack(brandSlug, pack.slug);
  const recipeTitles = recipes.map((r) => r.title).filter(Boolean);

  let storyPages;
  try {
    storyPages = await generateStoryPages(pack, brand, {
      kinds: body.kinds,
      recipeTitles,
    });
  } catch (err) {
    console.error("[story-pages/generate] failed:", err);
    return NextResponse.json(
      {
        error: `Story-Pages-Generation fehlgeschlagen: ${
          err instanceof Error ? err.message : err
        }`,
      },
      { status: 500 }
    );
  }

  // Persist: storyPages + packMode='guide' (falls noch recipebook).
  const patch: Partial<Pack> = { storyPages };
  if (pack.packMode !== "guide") patch.packMode = "guide";
  const updated = await updateCustomPackData(id, patch);

  return NextResponse.json({
    ok: true,
    pack: updated,
    storyPagesCount: storyPages.length,
  });
}
