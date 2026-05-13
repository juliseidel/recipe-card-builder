import { NextResponse } from "next/server";
import { getReelTagAggregates } from "@/lib/creator-reels-server";

// Tag-Aggregates fuer den Auto-Pack-Builder. Wird beim Mount der UI
// einmal geladen, damit Smart-Hide-Chips nur Werte zeigen die wirklich
// in der Reel-Library des Brands vorkommen. Counter pro Wert ("Asia (12)")
// hilft dem User einzuschaetzen welche Filter sinnvoll sind.
//
// Beispiel-Response:
// {
//   "total": 184,
//   "mealType": [{ "value": "breakfast", "count": 42 }, ...],
//   "cuisine": [...], "occasion": [...], ...
// }

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const { slug } = await params;
  const aggregates = await getReelTagAggregates(slug);
  return NextResponse.json(aggregates);
}
