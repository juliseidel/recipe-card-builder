import { NextResponse } from "next/server";
import {
  getSuggestionById,
  getReelsByIds,
} from "@/lib/creator-reels-server";

// Preview-Endpoint fuer einen Pack-Vorschlag. Liefert komplette Suggestion-
// Daten + die zugeordneten Reels mit allen Klassifikations-Feldern (Title,
// Cover, Engagement, Cuisine, etc.). Wird von der Pack-Suggestion-
// Preview-Page genutzt, damit der User VOR dem Akzeptieren sieht, was
// im Pack enthalten waere.

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params;
  const suggestion = await getSuggestionById(id);
  if (!suggestion) {
    return NextResponse.json(
      { error: "Vorschlag nicht gefunden." },
      { status: 404 }
    );
  }

  const reels = await getReelsByIds(suggestion.reel_ids);
  // Reihenfolge der suggestion.reel_ids respektieren (Top-Engagement zuerst).
  const reelMap = new Map(reels.map((r) => [r.id, r]));
  const orderedReels = suggestion.reel_ids
    .map((rid) => reelMap.get(rid))
    .filter((r): r is NonNullable<typeof r> => Boolean(r));

  return NextResponse.json({
    suggestion: {
      id: suggestion.id,
      brandSlug: suggestion.brand_slug,
      title: suggestion.title,
      subtitle: suggestion.subtitle,
      tagline: suggestion.tagline,
      description: suggestion.description,
      category: suggestion.category,
      reasoning: suggestion.reasoning,
      score: suggestion.score,
      status: suggestion.status,
      coverUrl: suggestion.cover_url,
      acceptedPackId: suggestion.accepted_pack_id,
    },
    reels: orderedReels.map((r) => ({
      id: r.id,
      igId: r.ig_id,
      postUrl: r.post_url,
      type: r.type,
      caption: r.caption,
      // cover_storage_url bevorzugt (permanent, Supabase) — display_url
      // ist Instagram-CDN mit ~1-3h Expiry.
      displayUrl: r.cover_storage_url ?? r.display_url,
      postedAt: r.posted_at,
      likeCount: r.like_count,
      viewCount: r.view_count,
      commentCount: r.comment_count,
      recipeTitle: r.recipe_title,
      mealType: r.meal_type,
      cuisine: r.cuisine,
      mainIngredient: r.main_ingredient,
      dietary: r.dietary,
      estimatedTimeMinutes: r.estimated_time_minutes,
    })),
  });
}
