import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

// Sister-Endpoint zu /api/packs/revalidate, fuer das Brand-Onboarding.
// Nach Brand-Create kapselt sich der Hub-Server-Render hinter dem Cache —
// ohne diesen Call wird der neu angelegte Creator erst nach Cache-TTL
// sichtbar. Optional auch /[brand] revalidate falls der Caller schon dorthin
// navigiert (passiert im Onboarding aktuell nicht, weil wir ueber
// /welcome?brand=... gehen — aber lassen wir es flexibel).

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { brandSlug?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  revalidatePath("/");
  if (body.brandSlug) {
    revalidatePath(`/${body.brandSlug}`);
  }
  return NextResponse.json({ revalidated: true });
}
