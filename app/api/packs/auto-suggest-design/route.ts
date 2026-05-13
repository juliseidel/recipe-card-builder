import { NextResponse } from "next/server";
import { queryReelsForBrand, type ReelRow } from "@/lib/creator-reels-server";
import { suggestPackDesign } from "@/lib/ai/suggest-pack-design";
import { loadBrand } from "@/lib/custom-brands-server";

// Liefert KI-Design-Vorschlaege fuer den Auto-Pack-Builder. User klickt
// "✨ KI-Auto-Setup" oder einzelne "Vorschlagen"-Buttons — wir queryen
// die matchenden Reels mit den aktuellen Filtern und lassen Gemini Flash
// 5 Title-Optionen + Layout + Mood + Font + Subtitle/Tagline/Description
// vorschlagen.
//
// Wir queryen genau die Reels die auch beim "Pack generieren"-Call rein
// gehen wuerden — gleiche Filter-Parameter wie /api/packs/generate-auto.

export const runtime = "nodejs";
export const maxDuration = 30;

type Body = {
  brandSlug: string;
  fromDate?: string;
  toDate?: string;
  mealTypes?: string[];
  cuisines?: string[];
  mainIngredients?: string[];
  dietaries?: string[];
  occasions?: string[];
  seasons?: string[];
  skillLevels?: string[];
  vessels?: string[];
  maxTimeMinutes?: number;
  sortBy?: "engagement" | "recent";
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

  const allMatching = await queryReelsForBrand({
    brandSlug: body.brandSlug,
    fromDate: body.fromDate,
    toDate: body.toDate,
    mealTypes: body.mealTypes,
    cuisines: body.cuisines,
    mainIngredients: body.mainIngredients,
    dietaries: body.dietaries,
    occasions: body.occasions,
    seasons: body.seasons,
    skillLevels: body.skillLevels,
    vessels: body.vessels,
    maxTimeMinutes: body.maxTimeMinutes,
    limit: Math.max(50, limit * 3),
    onlyRecipes: true,
  });

  if (allMatching.length < 3) {
    return NextResponse.json(
      {
        error: `Nur ${allMatching.length} Rezepte matchen die Filter — fuer Design-Vorschlaege brauchen wir mindestens 3. Lockere die Filter oder erweitere den Zeitraum.`,
        matchCount: allMatching.length,
      },
      { status: 422 }
    );
  }

  const selected = sortReels(allMatching, sortBy).slice(0, limit);
  const brand = await loadBrand(body.brandSlug);

  try {
    const suggestion = await suggestPackDesign(selected, brand);
    return NextResponse.json({
      ok: true,
      reelCount: selected.length,
      suggestion,
    });
  } catch (err) {
    console.error("[auto-suggest-design] failed", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Design-Vorschlaege konnten nicht generiert werden.",
      },
      { status: 500 }
    );
  }
}
