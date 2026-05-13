import { NextResponse } from "next/server";
import { queryReelsForBrand } from "@/lib/creator-reels-server";

// Reel-Query-Endpoint fuer den Auto-Tab. Frontend wechselt Filter,
// Endpoint liefert die matchenden Reels als Live-Preview-Grid. Wir
// liefern eine schlanke Repraesentation — keine vollen Captions, das
// spart Bandwidth.
//
// Filter-Dimensionen (alle optional, OR pro Dimension, AND zwischen
// Dimensionen):
//   - from / to                    Datumsbereich
//   - mealTypes (comma)            breakfast/lunch/dinner/snack/dessert/drink
//   - cuisines (comma)             italian/asian/german/...
//   - mainIngredients (comma)      chicken/oats/pasta/eggs/...
//   - dietaries (comma)            vegan/lowcarb/highprotein/...
//   - occasions (comma)            mealprep/brunch/cozy/...
//   - seasons (comma)              spring/summer/autumn/winter/year-round
//   - skillLevels (comma)          beginner/intermediate/advanced
//   - vessels (comma)              bowl/pan/sheet/airfryer/...
//   - maxMinutes (int)             Zubereitungszeit-Cap

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ slug: string }> };

function csv(value: string | null): string[] | undefined {
  if (!value) return undefined;
  const parts = value.split(",").map((s) => s.trim()).filter(Boolean);
  return parts.length > 0 ? parts : undefined;
}

export async function GET(req: Request, { params }: RouteParams) {
  const { slug } = await params;
  const url = new URL(req.url);
  const fromDate = url.searchParams.get("from") ?? undefined;
  const toDate = url.searchParams.get("to") ?? undefined;
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "60"), 100);
  const maxMinutesRaw = url.searchParams.get("maxMinutes");
  const maxTimeMinutes = maxMinutesRaw ? parseInt(maxMinutesRaw) : undefined;

  const reels = await queryReelsForBrand({
    brandSlug: slug,
    fromDate,
    toDate,
    mealTypes: csv(url.searchParams.get("mealTypes")),
    cuisines: csv(url.searchParams.get("cuisines")),
    mainIngredients: csv(url.searchParams.get("mainIngredients")),
    dietaries: csv(url.searchParams.get("dietaries")),
    occasions: csv(url.searchParams.get("occasions")),
    seasons: csv(url.searchParams.get("seasons")),
    skillLevels: csv(url.searchParams.get("skillLevels")),
    vessels: csv(url.searchParams.get("vessels")),
    maxTimeMinutes:
      typeof maxTimeMinutes === "number" && !Number.isNaN(maxTimeMinutes)
        ? maxTimeMinutes
        : undefined,
    limit,
    onlyRecipes: true,
  });

  return NextResponse.json({
    reels: reels.map((r) => ({
      id: r.id,
      title: r.recipe_title,
      displayUrl: r.cover_storage_url ?? r.display_url,
      postUrl: r.post_url,
      postedAt: r.posted_at,
      mealType: r.meal_type,
      cuisine: r.cuisine,
      mainIngredient: r.main_ingredient,
      dietary: r.dietary,
      occasion: r.occasion,
      season: r.season,
      skillLevel: r.skill_level,
      vessel: r.vessel,
      estimatedTimeMinutes: r.estimated_time_minutes,
      likeCount: r.like_count,
      viewCount: r.view_count,
    })),
  });
}
