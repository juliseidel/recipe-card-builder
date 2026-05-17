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

// Kombinierter Loader: Code-Brand fuer Identity-Felder (Tokens, Fonts,
// Avatar, Name), DB fuer AI-computed Optional-Felder (voiceProfile,
// audienceAnalysis, imageStyle) wenn Code-Brand sie nicht hat.
//
// Warum mergen: Code-Brands (Biene, Julia) sollen ihre kuratierten
// Identity-Felder behalten, aber gleichzeitig vom Lazy-Backfill der
// Voice-Profile profitieren. Ohne Merge wuerde das in DB persistierte
// Profil eines Code-Brands beim Lookup ignoriert.
//
// `getBrand(slug)` aus lib/brands.ts bleibt sync und code-only fuer
// Backward-Compat (Client-Components, generateStaticParams, sync Helpers).
export async function loadBrand(slug: string): Promise<Brand | undefined> {
  const code = codeBrands.find((b) => b.slug === slug);
  const db = await getCustomBrandServer(slug);

  // Beide vorhanden → Code wins for Identity, DB fills optional AI-Felder
  if (code && db) {
    return {
      ...code,
      voiceProfile: code.voiceProfile ?? db.voiceProfile,
      audienceAnalysis: code.audienceAnalysis ?? db.audienceAnalysis,
      imageStyle: code.imageStyle ?? db.imageStyle,
    };
  }
  return code ?? db;
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

// ─── Field-Update-Helpers — fuer Lazy-Backfill und manuelle Edits ────────
// Patcht ein einzelnes Feld in brand.data (JSONB-Spalte) und macht ein
// UPSERT — falls der Brand noch keinen DB-Eintrag hat (Code-Brand), wird
// einer angelegt mit dem Code-Brand-Object als Basis + Patch. Damit
// funktioniert Persistenz von AI-Computed-Feldern (voiceProfile, etc.)
// auch fuer Code-Brands wie Biene, ohne ihre Identity-Felder zu duplizieren.
export async function upsertBrandData(
  slug: string,
  patch: Partial<Brand>
): Promise<void> {
  if (!hasServerSupabase()) {
    throw new Error("upsertBrandData: Supabase not configured");
  }
  const supabase = getServerSupabase();
  const { data: row, error: readErr } = await supabase
    .from("brands")
    .select("data")
    .eq("slug", slug)
    .maybeSingle();
  if (readErr) throw readErr;

  if (row) {
    // Bestehender DB-Eintrag → einfaches Update
    const merged = { ...(row.data as Brand), ...patch };
    const { error: writeErr } = await supabase
      .from("brands")
      .update({ data: merged })
      .eq("slug", slug);
    if (writeErr) throw writeErr;
    return;
  }

  // Kein DB-Eintrag → checken ob Code-Brand, dann Stub anlegen
  const code = codeBrands.find((b) => b.slug === slug);
  if (!code) {
    throw new Error(`upsertBrandData: brand '${slug}' not found (kein Code- noch DB-Brand)`);
  }
  // Stub mit Code-Brand-Object als Basis. Beim spaeteren loadBrand() gewinnt
  // der Code-Brand fuer Identity-Felder — der DB-Stub liefert nur die
  // AI-computed Optional-Felder ueber den Merge in loadBrand().
  const stub = { ...code, ...patch };
  const { error: insertErr } = await supabase
    .from("brands")
    .insert({ slug, data: stub });
  if (insertErr) throw insertErr;
}

/** Persistiert das Voice-Profil eines Brands. Funktioniert fuer DB-Brands
 *  und Code-Brands gleichermassen (legt ggf. DB-Stub fuer Code-Brands an). */
export async function updateBrandVoiceProfile(
  slug: string,
  voiceProfile: Brand["voiceProfile"]
): Promise<void> {
  await upsertBrandData(slug, { voiceProfile });
}
