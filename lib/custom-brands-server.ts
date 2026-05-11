import type { SupabaseClient } from "@supabase/supabase-js";
import { brands as codeBrands, type Brand } from "./brands";
import { getServerSupabase, hasServerSupabase } from "./supabase-server";

// Hybrid Brand-Layer: code-defined Brands (currently only Biene in
// lib/brands.ts) leben weiterhin als Single Source of Truth fuer Curated
// Creators. Neue Team-onboardete Creators landen in der Supabase `brands`-
// Tabelle und werden hier eingelesen + mit den Code-Brands gemergt.
//
// Architektur-Entscheidung: Wir migrieren Biene NICHT in die DB. Bienes
// kuratierte 5 Packs + 37 Rezepte sind tief mit dem Code verwoben
// (lib/packs.ts, lib/recipes.ts, public/brands/biene/* fuer Avatar +
// Pack-Cover) und bleiben dort. Sync `getBrand(slug)` aus lib/brands.ts
// funktioniert nur fuer Code-Brands; fuer DB-Brands gibt es die async
// Variante `loadBrand(slug)` hier.

export type CustomBrandRow = {
  id: string;
  slug: string;
  data: Brand;
  created_at: string;
};

// Liest alle Custom-Brands aus der DB, neueste zuerst. Wird vom Workspace-
// Hub aufgerufen und mit den Code-Brands gemergt — Reihenfolge im Hub:
// Code-Brands zuerst (Biene als Pilot oben), dann Custom-Brands in
// Erstellungs-Reihenfolge.
export async function getCustomBrandsServer(): Promise<Brand[]> {
  if (!hasServerSupabase()) return [];
  const supabase: SupabaseClient = getServerSupabase();
  const { data, error } = await supabase
    .from("brands")
    .select("data")
    .order("created_at", { ascending: true });
  if (error) {
    console.warn("[brands-server] getCustomBrandsServer", error);
    return [];
  }
  return (data ?? [])
    .map((row) => row.data as Brand | undefined)
    .filter((b): b is Brand => Boolean(b));
}

// Einzelner DB-Lookup nach Slug. Fuer /[brand]/page.tsx + Variants —
// findet Biene NICHT (Biene kommt aus lib/brands.ts), nur DB-Brands.
export async function getCustomBrandServer(
  slug: string
): Promise<Brand | undefined> {
  if (!hasServerSupabase()) return undefined;
  const supabase: SupabaseClient = getServerSupabase();
  const { data, error } = await supabase
    .from("brands")
    .select("data")
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    console.warn("[brands-server] getCustomBrandServer", error);
    return undefined;
  }
  return (data?.data as Brand | undefined) ?? undefined;
}

// Kombinierter Loader: Code-Brand zuerst (sync, ohne DB-Roundtrip), sonst
// DB-Lookup. Diese Funktion sollten alle async Server-Components benutzen,
// die mit Brand-URLs umgehen — sie deckt beide Quellen ab.
//
// `getBrand(slug)` aus lib/brands.ts bleibt sync und code-only fuer
// Backward-Compat (Client-Components, generateStaticParams, sync
// Helpers). Die kombinieren wir nur dort, wo nötig.
export async function loadBrand(slug: string): Promise<Brand | undefined> {
  const code = codeBrands.find((b) => b.slug === slug);
  if (code) return code;
  return await getCustomBrandServer(slug);
}

// Alle Brands fuer den Workspace-Hub. Code-Brands first (Biene oben als
// Anker), dann Custom-Brands in Erstellungs-Reihenfolge. Hub-Page zeigt
// das Ergebnis 1:1 im Grid.
export async function loadAllBrands(): Promise<Brand[]> {
  const custom = await getCustomBrandsServer();
  return [...codeBrands, ...custom];
}

// Helper fuer die Routing-Logik: existiert ein Slug ueberhaupt? Wird im
// Hub-Klick-Handler genutzt, um defensiv abzubrechen falls ein Brand
// zwischenzeitlich geloescht wurde.
export async function brandExists(slug: string): Promise<boolean> {
  const b = await loadBrand(slug);
  return Boolean(b);
}
