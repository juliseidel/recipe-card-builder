import { NextResponse } from "next/server";
import { updateSuggestionStatus } from "@/lib/creator-reels-server";

// Verwirft einen Pack-Vorschlag (Status -> 'dismissed'). Erscheint nicht
// mehr im Workspace, bleibt aber als History stehen.

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: RouteParams) {
  const { id } = await params;
  await updateSuggestionStatus(id, "dismissed");
  return NextResponse.json({ status: "dismissed" });
}
