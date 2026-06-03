/**
 * Rendert das komplette Pack-PDF lokal über die echte Pipeline (renderPackPdf),
 * exakt wie der Live-Job-Runner — inkl. Hidden-Filter + mergeAndRenumber.
 * Liest Stories/Titel direkt frisch aus der DB.
 *
 * Usage: tsx --tsconfig ./tsconfig.json scripts/perfektion/render-book.ts <brandSlug> <packSlug> <outPath>
 */
import { config } from "dotenv";
config({ path: ".env.local" });

// Node 20 hat kein natives WebSocket — supabase-js' Realtime-Client (den wir
// nicht nutzen) bricht sonst beim createClient ab. ws-Paket als Polyfill
// einhängen, bevor supabase-js geladen wird. Nur für dieses Standalone-Skript;
// im Next.js-Runtime ist WebSocket nativ vorhanden.
import ws from "ws";
// @ts-expect-error -- globalThis.WebSocket Typ
if (!globalThis.WebSocket) globalThis.WebSocket = ws;

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { loadBrand } from "@/lib/custom-brands-server";
import { getPack } from "@/lib/packs";
import { getCustomPackServer } from "@/lib/custom-packs-server";
import {
  getRecipesForPack,
  mergeAndRenumber,
  type MergeableCustom,
  type Recipe,
} from "@/lib/recipes";
import { getServerSupabase } from "@/lib/supabase-server";
import { renderPackPdf } from "@/lib/pdf/render";

async function loadCustomRecipesForPack(packSlug: string): Promise<MergeableCustom[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("recipes")
    .select("data, created_at")
    .eq("pack_slug", packSlug)
    .eq("is_custom", true);
  if (error) throw error;
  const out: MergeableCustom[] = [];
  for (const row of data ?? []) {
    const recipe = row.data as Recipe | undefined;
    if (!recipe) continue;
    out.push({ ...recipe, createdAt: new Date(row.created_at as string).getTime() });
  }
  return out;
}

async function loadHiddenSlugs(brandSlug: string, packSlug: string): Promise<Set<string>> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("hidden_recipes")
    .select("recipe_slug")
    .eq("brand_slug", brandSlug)
    .eq("pack_slug", packSlug);
  if (error) return new Set();
  return new Set((data ?? []).map((r) => r.recipe_slug as string).filter(Boolean));
}

async function main() {
  const [brandSlug, packSlug, outPath, ...flags] = process.argv.slice(2);
  if (!brandSlug || !packSlug || !outPath) {
    console.error("Usage: render-book.ts <brandSlug> <packSlug> <outPath> [--group-by-size]");
    process.exit(1);
  }
  // Mahlzeitengroessen-Gruppierung (Biene-Wunsch der Creatorin): Rezepte
  // nach kcal in "Kleine Mahlzeit" (< Schwelle) und "Grosse Mahlzeit"
  // sortieren, kleine zuerst. Schwelle 500 kcal faellt in Bienes natuerliche
  // Luecke (11 Rezepte 249-449, dann Sprung auf 573-747).
  const groupBySize = flags.includes("--group-by-size");
  const SIZE_THRESHOLD = 500;

  const brand = await loadBrand(brandSlug);
  const pack =
    getPack(brandSlug, packSlug) ?? (await getCustomPackServer(brandSlug, packSlug));
  if (!brand || !pack) {
    console.error(`Pack ${brandSlug}/${packSlug} nicht gefunden`);
    process.exit(1);
  }

  // getRecipesForPack nutzt Next.js unstable_cache → wirft außerhalb des
  // Next-Servers "incrementalCache missing". Im Standalone-Skript fangen wir
  // das ab und fallen auf leere statische Liste zurück. Für Custom-Packs
  // (alle Rezepte is_custom=true in der DB) ist das vollständig korrekt.
  let staticRecipes: Awaited<ReturnType<typeof getRecipesForPack>> = [];
  try {
    staticRecipes = await getRecipesForPack(packSlug);
  } catch (err) {
    console.warn(
      "[render-book] getRecipesForPack übersprungen (unstable_cache):",
      err instanceof Error ? err.message.slice(0, 80) : err
    );
  }
  const [customRecipes, hiddenSlugs] = await Promise.all([
    loadCustomRecipesForPack(packSlug),
    loadHiddenSlugs(brandSlug, packSlug),
  ]);
  const visibleStatic = staticRecipes.filter((r) => !hiddenSlugs.has(r.slug));
  let recipes = mergeAndRenumber(visibleStatic, customRecipes);

  if (groupBySize) {
    // Nach Groesse gruppieren: klein (aufsteigend kcal) zuerst, dann gross
    // (aufsteigend kcal). mealSize-Feld setzen (fuer Badge + Index-Sektionen)
    // und number neu 1..N vergeben, damit Karten-Reihenfolge + Footer + Index
    // konsistent sind.
    const withSize = recipes.map((r) => ({
      ...r,
      mealSize: (r.nutrition?.kcal ?? 0) < SIZE_THRESHOLD ? "klein" : "gross",
    }));
    withSize.sort((a, b) => {
      if (a.mealSize !== b.mealSize) return a.mealSize === "klein" ? -1 : 1;
      return (a.nutrition?.kcal ?? 0) - (b.nutrition?.kcal ?? 0);
    });
    recipes = withSize.map((r, i) => ({ ...r, number: i + 1 })) as typeof recipes;
    const nKlein = withSize.filter((r) => r.mealSize === "klein").length;
    console.log(`  Gruppierung: ${nKlein} kleine + ${withSize.length - nKlein} grosse Mahlzeiten`);
  }

  console.log(
    `Pack "${pack.title}" — ${recipes.length} Rezepte (custom=${customRecipes.length}, static=${visibleStatic.length}), Modus=${pack.packMode ?? "recipebook"}`
  );

  const pdf = await renderPackPdf({
    brand,
    pack,
    recipes,
    onProgress: (stage, pct) => console.log(`  [${pct}%] ${stage}`),
  });

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, Buffer.from(pdf));
  console.log(`✓ ${outPath} (${Math.round(pdf.length / 1024)} KB)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
