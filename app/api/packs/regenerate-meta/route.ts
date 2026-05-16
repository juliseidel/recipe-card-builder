import { NextResponse } from "next/server";
import { regeneratePackMeta } from "@/lib/ai/regenerate-pack-meta";
import { findCustomPackIdBySlug } from "@/lib/custom-packs-server";
import { getServerSupabase, hasServerSupabase } from "@/lib/supabase-server";

// Auto-Sync-Endpoint: wird nach jeder Recipe-Mutation (Add/Delete/Edit/
// Hide) gerufen. Die eigentliche Re-Generation-Logik lebt im shared
// Helper lib/ai/regenerate-pack-meta.ts — diese Route ist nur ein
// dünner HTTP-Wrapper. Damit kann der gleiche Helper auch vom
// PDF-Job-Runner synchron aufgerufen werden (Block-on-Sync vor Render).
//
// Body (eine der zwei Varianten):
//   { brandSlug, packSlug, force? }   — typisch für Auto-Sync-Hooks
//   { packId, force? }                — typisch für manuellen Refresh

export const runtime = "nodejs";
export const maxDuration = 90;

type Body = {
  brandSlug?: string;
  packSlug?: string;
  packId?: string;
  force?: boolean;
};

async function resolveBrandPackSlugs(
  body: Body
): Promise<{ brandSlug: string; packSlug: string } | null> {
  if (body.brandSlug && body.packSlug) {
    return { brandSlug: body.brandSlug, packSlug: body.packSlug };
  }
  if (!body.packId || !hasServerSupabase()) return null;
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("packs")
    .select("brand_slug, pack_slug")
    .eq("id", body.packId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    brandSlug: data.brand_slug as string,
    packSlug: data.pack_slug as string,
  };
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const slugs = await resolveBrandPackSlugs(body);
  if (!slugs) {
    return NextResponse.json(
      { error: "Pack nicht gefunden (oder kein Custom-Pack)." },
      { status: 404 }
    );
  }

  const packId = await findCustomPackIdBySlug(slugs.brandSlug, slugs.packSlug);
  if (!packId) {
    return NextResponse.json(
      { error: "Pack nicht gefunden." },
      { status: 404 }
    );
  }

  const result = await regeneratePackMeta(slugs.brandSlug, slugs.packSlug, {
    force: body.force,
  });

  return NextResponse.json({
    ok: result.ok,
    summary: {
      skipped: result.skipped,
      updated: result.updated,
      changed: result.changed,
    },
    pack: result.pack,
  });
}
