"use client";

import type { FitnessCard, FitnessCardType } from "./types";
import { getSupabase } from "../supabase";

// Client-side Fitness-Card-Loader. Spiegel zu lib/custom-recipes.ts. Wird
// vom Editor + Grid-Components (Client) genutzt fuer Insert/Update/Delete.
// Lese-Ops mit Anon-Key — RLS erlaubt public read, das ist konsistent zu
// allen anderen DB-Tabellen.

export type CustomFitnessCard = FitnessCard & {
  id: string;
  isCustom: true;
  createdAt: number;
  updatedAt: number;
};

type FitnessCardRow = {
  id: string;
  brand_slug: string;
  pack_slug: string;
  card_slug: string;
  type: string;
  data: FitnessCard;
  is_custom: boolean;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
};

function rowToCustomCard(row: FitnessCardRow): CustomFitnessCard {
  return {
    ...row.data,
    slug: row.card_slug,
    packSlug: row.pack_slug,
    brandSlug: row.brand_slug,
    id: row.id,
    isCustom: true,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  } as CustomFitnessCard;
}

export async function getCustomFitnessCardsForPack(
  brandSlug: string,
  packSlug: string
): Promise<CustomFitnessCard[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("fitness_cards")
    .select("*")
    .eq("brand_slug", brandSlug)
    .eq("pack_slug", packSlug)
    .eq("is_hidden", false)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[fitness-cards-db] getCustomFitnessCardsForPack", error);
    return [];
  }
  return (data ?? []).map((row) => rowToCustomCard(row as FitnessCardRow));
}

export async function getCustomFitnessCard(
  brandSlug: string,
  packSlug: string,
  cardSlug: string
): Promise<CustomFitnessCard | undefined> {
  const supabase = getSupabase();
  if (!supabase) return undefined;
  const { data, error } = await supabase
    .from("fitness_cards")
    .select("*")
    .eq("brand_slug", brandSlug)
    .eq("pack_slug", packSlug)
    .eq("card_slug", cardSlug)
    .maybeSingle();
  if (error) {
    console.error("[fitness-cards-db] getCustomFitnessCard", error);
    return undefined;
  }
  return data ? rowToCustomCard(data as FitnessCardRow) : undefined;
}

export async function countCustomFitnessCardsForPack(
  brandSlug: string,
  packSlug: string
): Promise<number> {
  const supabase = getSupabase();
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from("fitness_cards")
    .select("*", { count: "exact", head: true })
    .eq("brand_slug", brandSlug)
    .eq("pack_slug", packSlug);
  if (error) {
    console.error("[fitness-cards-db] countCustomFitnessCardsForPack", error);
    return 0;
  }
  return count ?? 0;
}

export async function addCustomFitnessCard(input: {
  brandSlug: string;
  packSlug: string;
  card: Omit<FitnessCard, "number" | "brandSlug" | "packSlug">;
}): Promise<CustomFitnessCard | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  // Auto-Nummer: count + 1. Sequenziell pro Pack.
  const count = await countCustomFitnessCardsForPack(
    input.brandSlug,
    input.packSlug
  );
  const number = count + 1;

  const dataPayload = {
    ...input.card,
    brandSlug: input.brandSlug,
    packSlug: input.packSlug,
    number,
  } as FitnessCard;

  const { data, error } = await supabase
    .from("fitness_cards")
    .insert({
      brand_slug: input.brandSlug,
      pack_slug: input.packSlug,
      card_slug: input.card.slug,
      type: input.card.type,
      data: dataPayload,
      is_custom: true,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[fitness-cards-db] addCustomFitnessCard", error);
    return null;
  }
  return rowToCustomCard(data as FitnessCardRow);
}

export async function updateCustomFitnessCard(
  id: string,
  card: Omit<FitnessCard, "brandSlug" | "packSlug"> & {
    brandSlug: string;
    packSlug: string;
  }
): Promise<CustomFitnessCard | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("fitness_cards")
    .update({
      card_slug: card.slug,
      type: card.type,
      data: card as FitnessCard,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) {
    console.error("[fitness-cards-db] updateCustomFitnessCard", error);
    return null;
  }
  return rowToCustomCard(data as FitnessCardRow);
}

export async function removeCustomFitnessCard(id: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase
    .from("fitness_cards")
    .delete()
    .eq("id", id);
  if (error) {
    console.error("[fitness-cards-db] removeCustomFitnessCard", error);
    return false;
  }
  return true;
}

/** Slugifier fuer Card-Slugs — analog zu lib/custom-recipes.ts#slugify. */
export function slugifyFitnessCard(input: string): string {
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
    .slice(0, 60);
}

/** Type-Counts client-side, fuer Live-UI-Updates. */
export function countFitnessCardsByType(
  cards: CustomFitnessCard[]
): Record<FitnessCardType, number> {
  const counts: Record<FitnessCardType, number> = {
    exercise: 0,
    workout: 0,
    weekplan: 0,
    mindset: 0,
    progress: 0,
    "nutrition-tip": 0,
  };
  for (const c of cards) {
    if (c.type in counts) counts[c.type]++;
  }
  return counts;
}
