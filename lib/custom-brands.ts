"use client";

import { brands as codeBrands, type Brand } from "./brands";
import { getSupabase } from "./supabase";

// Client-side Counterpart zu lib/custom-brands-server.ts. Wird vom
// Brand-Switcher (Header-Dropdown), Onboarding-Form (/new-brand) und
// von den Brand-Page-Editoren benoetigt: alle laufen im Browser und
// muessen sowohl Code- als auch DB-Brands sehen koennen.
//
// Pattern matched lib/custom-packs.ts / lib/custom-recipes.ts
// (Public-Read RLS, direkte Supabase-Abfrage).

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

// Einzel-Lookup: Code-Brand zuerst, dann DB. Wird von den Editor-Pages
// (/[brand]/new + /[brand]/[pack]/new) benoetigt, die als Client-
// Components laufen und Brand-Daten ohne Server-Wrapper laden muessen.
export async function getBrandClient(
  slug: string
): Promise<Brand | undefined> {
  const code = codeBrands.find((b) => b.slug === slug);
  if (code) return code;
  const supabase = getSupabase();
  if (!supabase) return undefined;
  const { data, error } = await supabase
    .from("brands")
    .select("data")
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    console.error("[brands] getBrandClient", error);
    return undefined;
  }
  return (data?.data as Brand | undefined) ?? undefined;
}

// Slug aus Brand-Name herleiten. Spiegelt slugifyPack aus custom-packs.ts —
// gleiche Umlaut-Behandlung, gleiches Max-Length. So bleiben Brand-URLs
// (z. B. /linas-kueche) konsistent mit Pack-URLs.
export function slugifyBrand(input: string): string {
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

// Insert einer neuen DB-Brand-Row. Returnt die persistierte Brand oder
// null bei Fehler. Caller (Onboarding-Form) macht danach revalidatePath
// fuer Hub + redirected zur Welcome-Animation des neuen Brands.
export async function addCustomBrand(brand: Brand): Promise<Brand | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("brands")
    .insert({
      slug: brand.slug,
      data: brand,
    })
    .select("data")
    .single();
  if (error) {
    console.error("[brands] addCustomBrand", error);
    return null;
  }
  return (data?.data as Brand) ?? null;
}

// Hilfs-Check fuer das Form: existiert der Slug bereits (Code oder DB)?
// Verhindert Insert-Conflict + duplicate URLs.
export async function brandSlugTaken(slug: string): Promise<boolean> {
  if (codeBrands.some((b) => b.slug === slug)) return true;
  const supabase = getSupabase();
  if (!supabase) return false;
  const { data, error } = await supabase
    .from("brands")
    .select("slug")
    .eq("slug", slug)
    .maybeSingle();
  if (error) return false;
  return Boolean(data);
}
