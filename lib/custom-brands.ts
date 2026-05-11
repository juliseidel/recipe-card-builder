"use client";

import { brands as codeBrands, type Brand } from "./brands";
import { getSupabase } from "./supabase";

// Client-side Counterpart zu lib/custom-brands-server.ts. Wird vom
// Brand-Switcher (Header-Dropdown) benoetigt: die Component laeuft im
// Browser und muss alle Brands listen koennen, ohne dass die Pages sie
// als Prop reinreichen muessen. Pattern matched lib/custom-packs.ts /
// lib/custom-recipes.ts (Public-Read RLS, direkte Supabase-Abfrage).

export async function getAllBrandsClient(): Promise<Brand[]> {
  const supabase = getSupabase();
  if (!supabase) return [...codeBrands];
  const { data, error } = await supabase
    .from("brands")
    .select("data")
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[brands] client load failed", error);
    return [...codeBrands];
  }
  const dbBrands = (data ?? [])
    .map((row) => row.data as Brand | undefined)
    .filter((b): b is Brand => Boolean(b));
  return [...codeBrands, ...dbBrands];
}
