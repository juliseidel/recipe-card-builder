import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";

// Tiny endpoint the pack editor calls right after a save to drop the
// workspace's cached server render. Without this, a freshly-created pack
// only surfaces in the workspace grid once the (already-shortened, 30 s)
// revalidate window ticks over — feels broken to the user who expected
// instant feedback.

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { brandSlug?: string; packSlug?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.brandSlug) {
    return NextResponse.json({ error: "brandSlug required" }, { status: 400 });
  }
  // Brand workspace is the page that lists packs.
  revalidatePath(`/${body.brandSlug}`);
  // Pack-detail page if one was just created (so navigations there see
  // the freshest data, including any AI-cover update written into the row).
  if (body.packSlug) {
    revalidatePath(`/${body.brandSlug}/${body.packSlug}`);
  }
  // Wirft den unstable_cache "pack-db-rows" (lib/recipes.ts getPackDbRows)
  // weg. Ohne diese Invalidation las jeder Konsument (Detail-Page, Pack-PDF,
  // Single-Recipe-PDF) bis zu 30 s lang das alte JSONB-data — heißt z. B.
  // editierte Story/Title/Steps tauchten im PDF-Download nicht auf, obwohl
  // sie längst in der DB standen.
  //
  // expire:0 statt "max" weil wir read-after-write Garantie wollen: der
  // nächste Read holt blocking frische Daten. "max" wäre stale-while-
  // revalidate und würde im schlimmsten Fall noch ein PDF mit alter Story
  // rendern.
  revalidateTag("pack-db-rows", { expire: 0 });
  return NextResponse.json({ revalidated: true });
}
