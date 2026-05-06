// One-shot seed: pushes every static recipe from lib/recipes.ts into the
// Supabase `recipes` table. Idempotent — uses upsert on (brand,pack,recipe).
//
// Existing micros from lib/recipe-micros.ts are merged so we don't lose
// already-generated nutrition data.
//
// Run: GEMINI_API_KEY irrelevant here, but you do need NEXT_PUBLIC_SUPABASE_URL
// and either SUPABASE_SERVICE_ROLE_KEY or the anon key in .env.local.
//
//   npx tsx --tsconfig ./tsconfig.json scripts/seed-recipes-to-db.ts

import path from "node:path";
import { config as loadEnv } from "dotenv";
loadEnv({ path: path.join(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";
// Node 20 doesn't ship native WebSocket — supabase-js's realtime client needs
// it. We don't use realtime here, but constructor still wants the transport.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ws = require("ws");
import { brands } from "../lib/brands";
import { recipes, type Recipe } from "../lib/recipes";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error("✗ Missing Supabase env vars");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws },
  });

  // Try to load already-generated micros to merge into the seed payload
  let micros: Record<string, Recipe["nutrition"]["micros"]> = {};
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m = require("../lib/recipe-micros") as {
      recipeMicros: Record<string, NonNullable<Recipe["nutrition"]["micros"]>>;
    };
    micros = m.recipeMicros;
  } catch {
    console.log("  (no recipe-micros.ts yet — seeding without micros)");
  }

  const brand = brands.find((b) => b.slug === "biene");
  if (!brand) {
    console.error("✗ Brand 'biene' not found");
    process.exit(1);
  }

  console.log(
    `\n→ Seeding ${recipes.length} recipes into public.recipes  (brand=${brand.slug})`
  );

  let inserted = 0;
  let updated = 0;
  let failed = 0;

  for (const recipe of recipes) {
    // Merge in any existing micros for this recipe
    const enriched: Recipe = micros[recipe.slug]
      ? {
          ...recipe,
          nutrition: { ...recipe.nutrition, micros: micros[recipe.slug] },
        }
      : recipe;

    // Was this slug already in the table?
    const { data: existing } = await supabase
      .from("recipes")
      .select("id")
      .eq("brand_slug", brand.slug)
      .eq("pack_slug", recipe.packSlug)
      .eq("recipe_slug", recipe.slug)
      .maybeSingle();

    const { error } = await supabase
      .from("recipes")
      .upsert(
        {
          brand_slug: brand.slug,
          pack_slug: recipe.packSlug,
          recipe_slug: recipe.slug,
          data: enriched,
          is_custom: false,
        },
        {
          onConflict: "brand_slug,pack_slug,recipe_slug",
        }
      );

    const microCount = enriched.nutrition.micros?.length ?? 0;
    if (error) {
      failed++;
      console.log(`  ✗ ${recipe.title}  →  ${error.message}`);
    } else if (existing) {
      updated++;
      console.log(`  ↻ ${recipe.title}  (${microCount} micros)`);
    } else {
      inserted++;
      console.log(`  + ${recipe.title}  (${microCount} micros)`);
    }
  }

  console.log(
    `\n✓ Done · inserted ${inserted} · updated ${updated} · failed ${failed}`
  );

  const { count } = await supabase
    .from("recipes")
    .select("*", { count: "exact", head: true })
    .eq("is_custom", false);
  console.log(`  Total static recipes in DB: ${count ?? "?"}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
