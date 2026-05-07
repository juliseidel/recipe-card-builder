"use client";

import type { Pack } from "./packs";
import { getSupabase } from "./supabase";

// Stored in Supabase. We persist the whole Pack shape (minus auto fields)
// in a single jsonb column so adding pack fields later doesn't require a
// migration — same pattern recipes use.
export type CustomPack = Pack & {
  id: string;
  isCustom: true;
  createdAt: number;
};

type PackRow = {
  id: string;
  brand_slug: string;
  pack_slug: string;
  data: Pack;
  is_custom: boolean;
  created_at: string;
};

function rowToCustomPack(row: PackRow): CustomPack {
  return {
    ...row.data,
    slug: row.pack_slug,
    brandSlug: row.brand_slug,
    id: row.id,
    isCustom: true,
    createdAt: new Date(row.created_at).getTime(),
  };
}

export async function getCustomPacksForBrand(
  brandSlug: string
): Promise<CustomPack[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("packs")
    .select("*")
    .eq("brand_slug", brandSlug)
    .eq("is_custom", true)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[packs-db] getCustomPacksForBrand", error);
    return [];
  }
  return (data ?? []).map(rowToCustomPack);
}

export async function getCustomPack(
  brandSlug: string,
  packSlug: string
): Promise<CustomPack | undefined> {
  const supabase = getSupabase();
  if (!supabase) return undefined;
  const { data, error } = await supabase
    .from("packs")
    .select("*")
    .eq("brand_slug", brandSlug)
    .eq("pack_slug", packSlug)
    .eq("is_custom", true)
    .maybeSingle();
  if (error) {
    console.error("[packs-db] getCustomPack", error);
    return undefined;
  }
  return data ? rowToCustomPack(data) : undefined;
}

export async function addCustomPack(input: {
  brandSlug: string;
  staticPackCount: number; // for auto pack.number = staticCount + customCount + 1
  pack: Omit<Pack, "number" | "recipeCount" | "brandSlug" | "slug"> & {
    slug: string;
  };
}): Promise<CustomPack | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  // Count existing custom packs to assign the next sequential number.
  const { count } = await supabase
    .from("packs")
    .select("*", { count: "exact", head: true })
    .eq("brand_slug", input.brandSlug)
    .eq("is_custom", true);

  const number = input.staticPackCount + (count ?? 0) + 1;

  const dataPayload: Pack = {
    ...input.pack,
    brandSlug: input.brandSlug,
    number,
    recipeCount: 0, // grows as the user saves cards into this pack
  };

  const { data, error } = await supabase
    .from("packs")
    .insert({
      brand_slug: input.brandSlug,
      pack_slug: input.pack.slug,
      data: dataPayload,
      is_custom: true,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[packs-db] addCustomPack", error);
    return null;
  }
  return rowToCustomPack(data);
}

export async function removeCustomPack(id: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase.from("packs").delete().eq("id", id);
  if (error) {
    console.error("[packs-db] removeCustomPack", error);
    return false;
  }
  return true;
}

// Mirror addCustomPack's slugifier so the pack-editor can build a slug
// optimistically before the insert.
export function slugifyPack(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}
