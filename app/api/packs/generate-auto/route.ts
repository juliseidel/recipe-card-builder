import { NextResponse } from "next/server";
import { queryReelsForBrand, type ReelRow } from "@/lib/creator-reels-server";
import { generatePackMeta } from "@/lib/ai/generate-pack-meta";
import { buildPackFromReels, pickMoodById } from "@/lib/reel-library/pack-builder";
import { loadBrand } from "@/lib/custom-brands-server";

// Auto-Pack-Generator. Wird vom Auto-Tab in /[brand]/new aufgerufen. User
// gibt Filter (Timeframe, MealTypes, Cuisines), Server:
//   1. Querie creator_reels mit den Filtern
//   2. Gemini Flash generiert Pack-Title/Description aus den Reels
//   3. buildPackFromReels macht die Recipe-Inserts + Hero-Trigger
//   4. Returnt packSlug fuer Client-Redirect

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  brandSlug: string;
  fromDate?: string;          // ISO yyyy-mm-dd inclusive
  toDate?: string;            // ISO yyyy-mm-dd inclusive
  mealTypes?: string[];
  cuisines?: string[];
  /** Welche Sortierung wenn mehr Reels passen als gewuenscht. Default 'engagement'
   *  (Likes+Views desc). Alternativ 'recent' (posted_at desc). */
  sortBy?: "engagement" | "recent";
  /** Wie viele Reels max ins Pack. Default 12, Hard-Limit 20. */
  limit?: number;
};

function sortReels(
  reels: ReelRow[],
  sortBy: "engagement" | "recent"
): ReelRow[] {
  if (sortBy === "recent") {
    return [...reels].sort(
      (a, b) =>
        new Date(b.posted_at ?? 0).getTime() -
        new Date(a.posted_at ?? 0).getTime()
    );
  }
  return [...reels].sort((a, b) => {
    const ea = (a.like_count ?? 0) + (a.view_count ?? 0) / 10;
    const eb = (b.like_count ?? 0) + (b.view_count ?? 0) / 10;
    return eb - ea;
  });
}

function slugifyPack(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.brandSlug) {
    return NextResponse.json(
      { error: "brandSlug ist erforderlich." },
      { status: 400 }
    );
  }

  const limit = Math.max(3, Math.min(body.limit ?? 12, 20));
  const sortBy = body.sortBy ?? "engagement";

  // Wir queryen mehr als wir brauchen (3× limit), sortieren clientseitig
  // und cutten — gibt uns saubere Top-Engagement-Selection unter den
  // gefilterten Reels.
  const allMatching = await queryReelsForBrand({
    brandSlug: body.brandSlug,
    fromDate: body.fromDate,
    toDate: body.toDate,
    mealTypes: body.mealTypes,
    cuisines: body.cuisines,
    limit: Math.max(50, limit * 3),
    onlyRecipes: true,
  });

  if (allMatching.length < 3) {
    return NextResponse.json(
      {
        error: `Nur ${allMatching.length} Rezepte matchen die Filter — Pack braucht mindestens 3. Lockere die Filter oder erweitere den Zeitraum.`,
        matchCount: allMatching.length,
      },
      { status: 422 }
    );
  }

  const selected = sortReels(allMatching, sortBy).slice(0, limit);

  // Meta-Generierung (Title, Description, Mood). Brand wird mitgegeben, damit
  // die Description in der Stimme der Creatorin geschrieben wird statt in
  // generischer Marketing-Sprache.
  const brand = await loadBrand(body.brandSlug);
  let meta;
  try {
    meta = await generatePackMeta(selected, brand);
  } catch (err) {
    console.error("[generate-auto] generatePackMeta failed", err);
    // Fallback: simple Default-Meta. Pack wird trotzdem erstellt.
    meta = {
      title: `${selected.length} Rezepte`,
      subtitle: "Eine kuratierte Auswahl",
      tagline: selected
        .slice(0, 3)
        .map((r) => r.recipe_title || "Rezept")
        .join(" · "),
      description: "Eine automatisch zusammengestellte Sammlung aus der Reel-Library des Creators.",
      category: "Auto-Pack",
      moodHint: "cream" as const,
    };
  }

  // Mood-Mapping von brand-presets-IDs auf pack-presets-IDs.
  const packMoodId = {
    cream: "honey",
    sage: "sage",
    linen: "sky",
    amber: "amber",
  }[meta.moodHint] ?? "honey";

  const cardLayout: import("@/lib/packs").CardLayout =
    meta.moodHint === "amber"
      ? "amber"
      : meta.moodHint === "sage"
        ? "vital"
        : meta.moodHint === "linen"
          ? "minimal"
          : "editorial";

  const baseSlug = slugifyPack(meta.title) || "auto-pack";
  const slug = `${baseSlug}-${Date.now().toString(36).slice(-4)}`;
  const origin = new URL(req.url).origin;

  const result = await buildPackFromReels({
    brandSlug: body.brandSlug,
    reelIds: selected.map((r) => r.id),
    pack: {
      slug,
      title: meta.title,
      subtitle: meta.subtitle,
      tagline: meta.tagline,
      description: meta.description,
      category: meta.category,
      mood: pickMoodById(packMoodId),
      displayFont: meta.moodHint === "linen" ? "inter-tight" : "fraunces",
      cardLayout,
    },
    origin,
  });

  if (!result) {
    return NextResponse.json(
      {
        error: "Pack konnte nicht erstellt werden.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    status: "created",
    packId: result.packId,
    packSlug: result.packSlug,
    recipeCount: result.recipeCount,
    parseFailures: result.parseFailures,
    meta,
  });
}
