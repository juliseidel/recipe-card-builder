import { NextResponse } from "next/server";
import { getSuggestionsForBrand } from "@/lib/creator-reels-server";

// Listet pending Pack-Vorschlaege eines Brands fuer den Workspace.
// Returnt eine schlanke Repraesentation (kein reel_ids-Array — das
// laedt der Accept-Endpoint serverseitig nach).

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const { slug } = await params;
  const suggestions = await getSuggestionsForBrand(slug, "pending");
  return NextResponse.json({
    suggestions: suggestions.map((s) => ({
      id: s.id,
      title: s.title,
      subtitle: s.subtitle,
      tagline: s.tagline,
      description: s.description,
      category: s.category,
      reasoning: s.reasoning,
      reelCount: s.reel_ids.length,
      score: s.score,
    })),
  });
}
