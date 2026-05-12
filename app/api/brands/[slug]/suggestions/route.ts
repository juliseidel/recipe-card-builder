import { NextResponse } from "next/server";
import {
  getSuggestionsForBrand,
  getReelsByIds,
} from "@/lib/creator-reels-server";

// Listet pending Pack-Vorschlaege eines Brands fuer den Workspace.
// Returnt eine schlanke Repraesentation + preview_images (bis zu 3
// display_url's der zugeordneten Reels) — werden vom Workspace als
// Background-Image / Mosaik im Pack-Suggestion-Card gerendert, damit
// jeder Vorschlag schon vor dem Klick visuell andockbar ist.

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const { slug } = await params;
  const suggestions = await getSuggestionsForBrand(slug, "pending");

  // Sammle alle Reel-IDs ueber alle Suggestions in einem Batch — ein
  // einziger DB-Roundtrip statt N. Map zurueck pro suggestion fuer das
  // preview_images-Array.
  const allReelIds = Array.from(
    new Set(suggestions.flatMap((s) => s.reel_ids))
  );
  const reelMap = new Map<string, string | null>();
  if (allReelIds.length > 0) {
    const reels = await getReelsByIds(allReelIds);
    for (const r of reels) {
      // cover_storage_url bevorzugt (permanent, Supabase Storage),
      // display_url als Fallback (Instagram-CDN, kurzlebig).
      reelMap.set(r.id, r.cover_storage_url ?? r.display_url);
    }
  }

  return NextResponse.json({
    suggestions: suggestions.map((s) => {
      // Top 3 preview_images aus den ersten Reels — wenn display_url
      // fehlt (selten, aber moeglich), uebersprungen.
      const previewImages = s.reel_ids
        .map((id) => reelMap.get(id))
        .filter((url): url is string => Boolean(url))
        .slice(0, 3);
      return {
        id: s.id,
        title: s.title,
        subtitle: s.subtitle,
        tagline: s.tagline,
        description: s.description,
        category: s.category,
        reasoning: s.reasoning,
        reelCount: s.reel_ids.length,
        score: s.score,
        // KI-generiertes Pack-Cover (Flux). Wenn null, faellt das UI auf
        // Reel-Cover (previewImages[0]) als Background zurueck.
        coverUrl: s.cover_url,
        previewImages,
      };
    }),
  });
}
