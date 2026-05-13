import { NextResponse, after } from "next/server";
import { detectAndTriggerEnrichGaps } from "@/lib/reel-library/pack-builder";

// Wird vom Client-Side PackAutoEnrichTrigger nach Pack-Detail-Mount
// aufgerufen. Checkt via detectAndTriggerEnrichGaps die DB auf Recipes
// ohne Hero/Mikros oder fehlendes Pack-Cover und triggert die
// entsprechenden enrich-Endpoints nach.
//
// User-Session-Cookies sind im Request → Auth-Middleware laesst durch
// (Stufe 3). Kein Internal-Token noetig fuer diesen Pfad.
//
// Lambda hat 60s — detect ist schnell (~1s DB-Query), trigger setzt
// fetch-Calls ab die ihrerseits eigene Lambdas spawnen. Wir wrappen in
// after() damit die parent-Lambda alive bleibt bis HTTP-Calls draussen
// sind.

export const runtime = "nodejs";
export const maxDuration = 30;

type Body = {
  brandSlug: string;
  packSlug: string;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body?.brandSlug || !body?.packSlug) {
    return NextResponse.json(
      { error: "brandSlug + packSlug erforderlich" },
      { status: 400 }
    );
  }

  const origin = new URL(req.url).origin;

  after(async () => {
    try {
      const result = await detectAndTriggerEnrichGaps(
        origin,
        body.brandSlug,
        body.packSlug
      );
      if (
        result.triggeredPackEnrich ||
        result.triggeredRecipeIds.length > 0
      ) {
        console.log(
          `[auto-trigger-enrich] ${body.brandSlug}/${body.packSlug}: ` +
            `pack=${result.triggeredPackEnrich}, recipes=${result.triggeredRecipeIds.length}`
        );
      }
    } catch (err) {
      console.error("[auto-trigger-enrich] failed", err);
    }
  });

  return NextResponse.json({ ok: true });
}
