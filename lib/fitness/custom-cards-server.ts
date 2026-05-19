import type { SupabaseClient } from "@supabase/supabase-js";
import type { FitnessCard, FitnessCardType } from "./types";
import { getServerSupabase, hasServerSupabase } from "../supabase-server";

// Server-side Fitness-Card-Loader. Spiegel zu lib/custom-packs-server.ts +
// lib/custom-recipes.ts, aber liest aus der `fitness_cards`-Tabelle. Wird
// von der Pack-Detail-Page (Server Component) genutzt, wenn der Pack
// packType='fitness' hat.
//
// Es gibt KEINE statischen Fitness-Cards (im Gegensatz zu Recipes, wo
// lib/recipes.ts curated Bienen-Cards haelt) — alle Fitness-Cards leben
// in der DB. Loader kann also direkt returnen, kein Merge-noetig.

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

function rowToCard(row: FitnessCardRow): FitnessCard {
  return {
    ...row.data,
    slug: row.card_slug,
    packSlug: row.pack_slug,
    brandSlug: row.brand_slug,
  } as FitnessCard;
}

/** Alle Fitness-Cards eines Packs, sortiert nach data.number asc.
 *  Versteckte (is_hidden=true) werden rausgefiltert. */
export async function getFitnessCardsForPackServer(
  brandSlug: string,
  packSlug: string
): Promise<FitnessCard[]> {
  if (!hasServerSupabase()) return [];
  const supabase: SupabaseClient = getServerSupabase();
  const { data, error } = await supabase
    .from("fitness_cards")
    .select("*")
    .eq("brand_slug", brandSlug)
    .eq("pack_slug", packSlug)
    .eq("is_hidden", false)
    .order("created_at", { ascending: true });
  if (error) {
    console.warn("[fitness-cards-server] getFitnessCardsForPackServer", error);
    return [];
  }
  const cards = (data ?? []).map((row) => rowToCard(row as FitnessCardRow));
  // Numerische Sortierung nach data.number (sicherer als reine DB-Order,
  // falls Karten umsortiert wurden). Stabil bei Gleichstand → created_at.
  cards.sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
  return cards;
}

/** Eine einzelne Card per (brandSlug, packSlug, cardSlug). */
export async function getFitnessCardServer(
  brandSlug: string,
  packSlug: string,
  cardSlug: string
): Promise<FitnessCard | undefined> {
  if (!hasServerSupabase()) return undefined;
  const supabase: SupabaseClient = getServerSupabase();
  const { data, error } = await supabase
    .from("fitness_cards")
    .select("*")
    .eq("brand_slug", brandSlug)
    .eq("pack_slug", packSlug)
    .eq("card_slug", cardSlug)
    .maybeSingle();
  if (error) {
    console.warn("[fitness-cards-server] getFitnessCardServer", error);
    return undefined;
  }
  if (!data) return undefined;
  return rowToCard(data as FitnessCardRow);
}

/** Aggregate-Count pro Pack fuer einen Brand (analog zu
 *  getCustomRecipeCountsForBrand). Wird im Workspace-Grid genutzt damit
 *  der Counter auf einem Fitness-Pack-Cover live mitzaehlt. */
export async function getFitnessCardCountsForBrand(
  brandSlug: string
): Promise<Record<string, number>> {
  if (!hasServerSupabase()) return {};
  const supabase: SupabaseClient = getServerSupabase();
  const { data, error } = await supabase
    .from("fitness_cards")
    .select("pack_slug")
    .eq("brand_slug", brandSlug)
    .eq("is_hidden", false);
  if (error) {
    console.warn("[fitness-cards-server] getFitnessCardCountsForBrand", error);
    return {};
  }
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as Array<{ pack_slug: string | null }>) {
    const slug = row.pack_slug;
    if (!slug) continue;
    counts[slug] = (counts[slug] ?? 0) + 1;
  }
  return counts;
}

/** Type-Counts pro Pack — fuer UI die zeigen will "8 Uebungen + 1 Wochenplan
 *  + 1 Mindset". Nur ungefilterte (is_hidden=false) Cards. */
export async function getFitnessCardTypeBreakdown(
  brandSlug: string,
  packSlug: string
): Promise<Record<FitnessCardType, number>> {
  const empty: Record<FitnessCardType, number> = {
    exercise: 0,
    workout: 0,
    weekplan: 0,
    mindset: 0,
    progress: 0,
    "nutrition-tip": 0,
  };
  if (!hasServerSupabase()) return empty;
  const supabase: SupabaseClient = getServerSupabase();
  const { data, error } = await supabase
    .from("fitness_cards")
    .select("type")
    .eq("brand_slug", brandSlug)
    .eq("pack_slug", packSlug)
    .eq("is_hidden", false);
  if (error) {
    console.warn("[fitness-cards-server] getFitnessCardTypeBreakdown", error);
    return empty;
  }
  const counts = { ...empty };
  for (const row of (data ?? []) as Array<{ type: string }>) {
    const t = row.type as FitnessCardType;
    if (t in counts) counts[t]++;
  }
  return counts;
}
