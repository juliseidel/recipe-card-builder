import { NextResponse } from "next/server";
import { getBrand } from "@/lib/brands";
import { loadBrand } from "@/lib/custom-brands-server";

// Liefert die Brand-Daten (Tokens, Stats, Meta) eines bestimmten Brands.
// Code-Brand (Biene) zuerst, dann DB-Brand. Wird vom Client-Side fetcher
// in der Suggestion-Preview-Page genutzt, damit das Page-Layout in den
// Brand-Tokens (Mood-Farbe, Akzent) rendert.

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const { slug } = await params;
  const code = getBrand(slug);
  if (code) {
    return NextResponse.json({ brand: code });
  }
  const db = await loadBrand(slug);
  if (db) {
    return NextResponse.json({ brand: db });
  }
  return NextResponse.json({ brand: null }, { status: 404 });
}
