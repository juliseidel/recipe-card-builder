import { NextResponse, after } from "next/server";
import { getServerSupabase, hasServerSupabase } from "@/lib/supabase-server";

// Bulk-Re-Enrich-Endpoint fuer existing Packs deren Cover/Hero nicht
// generiert wurden (Bug-2026-05-13: Auth-Middleware blockte interne
// fetch-Calls, Heroes blieben Reel-Cover-Placeholder).
//
// Auth: Bearer-Token via ADMIN_RESEED_TOKEN — kein Internal-Token-Header
// noetig, weil das eine User-getriggerte Operation ist.
//
// Aufruf:
//   curl -X POST -H "Authorization: Bearer $TOKEN" \
//     "https://clever-satoshi-22bf41.vercel.app/api/admin/reenrich-pack?packId=XYZ"
//
// Effekt: triggert /api/packs/enrich (Cover + Foreword) + /api/recipes/enrich
// fuer alle Recipes des Packs. Force=true fuer alles. Lambda-Lifetime ist
// durch after() abgesichert, alle Calls laufen parallel in eigenen
// Lambdas mit dem X-Internal-Token-Header.

export const runtime = "nodejs";
export const maxDuration = 60;

async function handle(req: Request) {
  const expected = process.env.ADMIN_RESEED_TOKEN;
  if (expected) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }
  if (!hasServerSupabase()) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 500 }
    );
  }

  const url = new URL(req.url);
  const packId = url.searchParams.get("packId");
  if (!packId) {
    return NextResponse.json(
      { error: "?packId=<uuid> ist erforderlich" },
      { status: 400 }
    );
  }

  const supabase = getServerSupabase();
  const { data: packRow } = await supabase
    .from("packs")
    .select("id, brand_slug, pack_slug")
    .eq("id", packId)
    .maybeSingle();
  if (!packRow) {
    return NextResponse.json({ error: "Pack not found" }, { status: 404 });
  }
  const { data: recipeRows } = await supabase
    .from("recipes")
    .select("id, recipe_slug")
    .eq("pack_slug", packRow.pack_slug)
    .eq("brand_slug", packRow.brand_slug);

  const recipeIds = (recipeRows ?? []).map((r) => r.id as string);
  const origin = url.origin;

  // Query-Params: which parts to force-regenerate (default alle on, sodass
  // ein nackter Aufruf "ALLES neu" macht — User-Wunsch beim Bulk-Repair).
  const forceAll = url.searchParams.get("forceAll") !== "false";
  const forceCover = forceAll || url.searchParams.get("cover") === "true";
  const forceForewordText =
    forceAll || url.searchParams.get("forewordText") === "true";
  const forceForewordImage =
    forceAll || url.searchParams.get("forewordImage") === "true";
  const forceHero =
    forceAll || url.searchParams.get("hero") === "true";

  const internalToken = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const headers = {
    "Content-Type": "application/json",
    "x-internal-token": internalToken,
  };

  after(async () => {
    try {
      // Pack-Enrich mit force-Flags
      await fetch(`${origin}/api/packs/enrich`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          packId,
          forceCover,
          forceForewordText,
          forceForewordImage,
        }),
      }).catch((err) =>
        console.warn("[reenrich-pack] pack-enrich failed", err)
      );

      // Recipe-Enrich pro Recipe mit forceHero
      await Promise.allSettled(
        recipeIds.map((id) =>
          fetch(`${origin}/api/recipes/enrich`, {
            method: "POST",
            headers,
            body: JSON.stringify({ recipeId: id, forceHero }),
          })
        )
      );
      console.log(
        `[reenrich-pack] triggered ${recipeIds.length} recipes + pack-enrich for packId=${packId} (force: cover=${forceCover}, forewordText=${forceForewordText}, forewordImage=${forceForewordImage}, hero=${forceHero})`
      );
    } catch (err) {
      console.error("[reenrich-pack] failed", err);
    }
  });

  return NextResponse.json({
    ok: true,
    packId,
    brandSlug: packRow.brand_slug,
    packSlug: packRow.pack_slug,
    recipeCount: recipeIds.length,
    message:
      "Pack-Cover + alle Recipe-Heroes werden im Hintergrund neu generiert. Dauer ~30-90s pro Hero.",
  });
}

export async function POST(req: Request) {
  return handle(req);
}

export async function GET(req: Request) {
  return handle(req);
}
