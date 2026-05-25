import { NextResponse } from "next/server";
import { getServerSupabase, hasServerSupabase } from "@/lib/supabase-server";
import { updateCustomPackData } from "@/lib/custom-packs-server";
import { loadBrand } from "@/lib/custom-brands-server";
import { generateStoryPages } from "@/lib/ai/generate-story-pages";
import { loadVisibleRecipesForPack } from "@/lib/recipes";
import type { Pack, StoryPage } from "@/lib/packs";

// Story-Page-Replace/Add-Endpoint. Generiert genau EINE Page, statt aller 3
// (wie generate/route.ts). Zwei Modi:
//
//   POST { mode: "replace", index: N, kind?: StoryPageKind }
//     → ersetzt pack.storyPages[N] durch neu generierte Page. Wenn kind
//       nicht uebergeben, wird das bestehende Kind beibehalten. Mit kind
//       wechselt die Page Thema (z.B. von "personal-story" zu "custom").
//
//   POST { mode: "add", kind: StoryPageKind }
//     → fuegt eine neue Page am Ende von pack.storyPages an.
//
// Auth wie /update (App-Session via Middleware).

export const runtime = "nodejs";
// 1 Gemini-Pro-Call + Banned-Check + ggf. Retry. ~30-60s typisch.
export const maxDuration = 90;

type RouteParams = { params: Promise<{ id: string }> };

type StoryKind = StoryPage["kind"];

type Body = {
  mode: "replace" | "add";
  index?: number;
  kind?: StoryKind;
};

const VALID_KINDS: ReadonlySet<StoryKind> = new Set<StoryKind>([
  "personal-story",
  "philosophy",
  "what-you-find",
  "custom",
]);

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
  if (body.mode !== "replace" && body.mode !== "add") {
    return NextResponse.json(
      { error: "mode muss 'replace' oder 'add' sein." },
      { status: 400 }
    );
  }
  if (body.kind && !VALID_KINDS.has(body.kind)) {
    return NextResponse.json(
      { error: `kind muss eines von ${[...VALID_KINDS].join(", ")} sein.` },
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
  const currentPages = pack.storyPages ?? [];

  // Welchen Kind generieren wir? Im replace-Mode: explicit body.kind ODER
  // existierendes Kind an Index. Im add-Mode: body.kind erforderlich.
  let targetKind: StoryKind;
  if (body.mode === "replace") {
    if (typeof body.index !== "number" || body.index < 0 || body.index >= currentPages.length) {
      return NextResponse.json(
        { error: `index muss zwischen 0 und ${currentPages.length - 1} liegen.` },
        { status: 400 }
      );
    }
    targetKind = body.kind ?? currentPages[body.index].kind;
  } else {
    if (!body.kind) {
      return NextResponse.json(
        { error: "add-Mode braucht kind im Body." },
        { status: 400 }
      );
    }
    targetKind = body.kind;
  }

  const brand = await loadBrand(brandSlug);
  if (!brand) {
    return NextResponse.json(
      { error: `Brand '${brandSlug}' nicht gefunden.` },
      { status: 404 }
    );
  }

  const recipes = await loadVisibleRecipesForPack(brandSlug, pack.slug);
  const recipeTitles = recipes.map((r) => r.title).filter(Boolean);

  let generated: StoryPage[];
  try {
    generated = await generateStoryPages(pack, brand, {
      kinds: [targetKind],
      recipeTitles,
    });
  } catch (err) {
    console.error("[story-pages/regenerate-one] failed:", err);
    return NextResponse.json(
      {
        error: `Story-Page-Generation fehlgeschlagen: ${
          err instanceof Error ? err.message : err
        }`,
      },
      { status: 500 }
    );
  }
  if (generated.length === 0) {
    return NextResponse.json(
      { error: "Generator returnte keine Page." },
      { status: 500 }
    );
  }

  const newPage = generated[0];

  // Merge zurueck ins Array
  let nextPages: StoryPage[];
  if (body.mode === "replace") {
    nextPages = [...currentPages];
    nextPages[body.index!] = newPage;
  } else {
    nextPages = [...currentPages, newPage];
  }

  // Persist + setze packMode auf 'guide' falls noch nicht
  const patch: Partial<Pack> = { storyPages: nextPages };
  if (pack.packMode !== "guide") patch.packMode = "guide";
  const updated = await updateCustomPackData(id, patch);

  return NextResponse.json({
    ok: true,
    pack: updated,
    newPage,
    mode: body.mode,
  });
}
