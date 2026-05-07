import type { SupabaseClient } from "@supabase/supabase-js";
import type { Pack } from "./packs";
import { getServerSupabase, hasServerSupabase } from "./supabase-server";

// Server-side custom-pack lookup. Mirrors lib/custom-packs.ts but uses the
// service-role client so the PDF job-runner and server components can hit
// it. Returns plain Pack objects so callers can treat custom and curated
// packs uniformly.
export async function getCustomPackServer(
  brandSlug: string,
  packSlug: string
): Promise<Pack | undefined> {
  if (!hasServerSupabase()) return undefined;
  const supabase: SupabaseClient = getServerSupabase();
  const { data, error } = await supabase
    .from("packs")
    .select("data")
    .eq("brand_slug", brandSlug)
    .eq("pack_slug", packSlug)
    .eq("is_custom", true)
    .maybeSingle();
  if (error) {
    console.warn("[packs-server] getCustomPackServer", error);
    return undefined;
  }
  return (data?.data as Pack | undefined) ?? undefined;
}

// Lists custom packs for a brand, newest first. Used by server components
// to merge with the curated `packs` constant.
export async function getCustomPacksForBrandServer(
  brandSlug: string
): Promise<Pack[]> {
  if (!hasServerSupabase()) return [];
  const supabase: SupabaseClient = getServerSupabase();
  const { data, error } = await supabase
    .from("packs")
    .select("data, created_at")
    .eq("brand_slug", brandSlug)
    .eq("is_custom", true)
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("[packs-server] getCustomPacksForBrandServer", error);
    return [];
  }
  return (data ?? [])
    .map((row) => row.data as Pack | undefined)
    .filter((p): p is Pack => Boolean(p));
}

// Single-row variant — returns the matching custom pack plus its row id
// so the pack-detail page can wire up its delete button.
export async function getCustomPackByIdServer(
  brandSlug: string,
  packSlug: string
): Promise<{ pack: Pack; id: string } | null> {
  if (!hasServerSupabase()) return null;
  const supabase: SupabaseClient = getServerSupabase();
  const { data, error } = await supabase
    .from("packs")
    .select("id, data")
    .eq("brand_slug", brandSlug)
    .eq("pack_slug", packSlug)
    .eq("is_custom", true)
    .maybeSingle();
  if (error) {
    console.warn("[packs-server] getCustomPackByIdServer", error);
    return null;
  }
  if (!data) return null;
  const pack = data.data as Pack | undefined;
  if (!pack) return null;
  return { pack, id: data.id as string };
}

// Same as above but also returns the row IDs so the workspace grid can
// wire up per-pack delete buttons. Carries createdAt onto the pack so
// mergeAndRenumberPacks can sort custom packs in creation order
// (oldest → lowest number).
export async function getCustomPacksWithIdsForBrandServer(
  brandSlug: string
): Promise<
  Array<{ pack: Pack & { createdAt: number }; id: string }>
> {
  if (!hasServerSupabase()) return [];
  const supabase: SupabaseClient = getServerSupabase();
  const { data, error } = await supabase
    .from("packs")
    .select("id, data, created_at")
    .eq("brand_slug", brandSlug)
    .eq("is_custom", true)
    .order("created_at", { ascending: true });
  if (error) {
    console.warn(
      "[packs-server] getCustomPacksWithIdsForBrandServer",
      error
    );
    return [];
  }
  const out: Array<{ pack: Pack & { createdAt: number }; id: string }> = [];
  for (const row of data ?? []) {
    const pack = row.data as Pack | undefined;
    if (!pack) continue;
    out.push({
      pack: { ...pack, createdAt: new Date(row.created_at as string).getTime() },
      id: row.id as string,
    });
  }
  return out;
}
