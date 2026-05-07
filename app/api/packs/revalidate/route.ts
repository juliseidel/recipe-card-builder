import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

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
  return NextResponse.json({ revalidated: true });
}
