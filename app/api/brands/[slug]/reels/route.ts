import { NextResponse } from "next/server";
import { queryReelsForBrand } from "@/lib/creator-reels-server";

// Reel-Query-Endpoint fuer den Auto-Tab. Frontend wechselt Filter,
// Endpoint liefert die matchenden Reels als Live-Preview-Grid. Wir
// liefern eine schlanke Repraesentation (id, title, displayUrl,
// posted_at, meal_type, like_count) — keine vollen Captions, das spart
// Bandwidth.

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ slug: string }> };

export async function GET(req: Request, { params }: RouteParams) {
  const { slug } = await params;
  const url = new URL(req.url);
  const fromDate = url.searchParams.get("from") ?? undefined;
  const toDate = url.searchParams.get("to") ?? undefined;
  const mealTypesParam = url.searchParams.get("mealTypes") ?? "";
  const cuisinesParam = url.searchParams.get("cuisines") ?? "";
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "60"), 100);

  const reels = await queryReelsForBrand({
    brandSlug: slug,
    fromDate,
    toDate,
    mealTypes: mealTypesParam ? mealTypesParam.split(",").filter(Boolean) : undefined,
    cuisines: cuisinesParam ? cuisinesParam.split(",").filter(Boolean) : undefined,
    limit,
    onlyRecipes: true,
  });

  return NextResponse.json({
    reels: reels.map((r) => ({
      id: r.id,
      title: r.recipe_title,
      displayUrl: r.display_url,
      postUrl: r.post_url,
      postedAt: r.posted_at,
      mealType: r.meal_type,
      cuisine: r.cuisine,
      likeCount: r.like_count,
      viewCount: r.view_count,
    })),
  });
}
