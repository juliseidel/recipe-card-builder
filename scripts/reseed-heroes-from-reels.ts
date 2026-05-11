// Re-Seed Hero Images aus Instagram-Reel-Coverframes statt Flux-Generierung.
//
// Ingo-Feedback Phase 3: "Die Bilder vom Reel matchen nicht mit den Bildern
// vom Rezept." Vorher hat Flux 2 Pro brand-stil-Bilder generiert, die nicht
// dem echten Reel entsprachen (z. B. Frozen Coconut Cups wurden als
// aufgeschnittene Cups gerendert, das Original-Reel zeigt gestapelte rote
// Würfel-Cups).
//
// Dieses Script holt fuer jedes statische Bienes-Rezept das Reel-Cover-Frame
// vom Apify-Scraper, croppt mit sharp auf 1024×1024 (attention-Strategie),
// laedt das JPEG zu Supabase Storage hoch und updated `data.hero` im
// recipes-Row.
//
// Run:
//   npx tsx --tsconfig ./tsconfig.json scripts/reseed-heroes-from-reels.ts
//   npx tsx --tsconfig ./tsconfig.json scripts/reseed-heroes-from-reels.ts --pack blitz-snacks
//   npx tsx --tsconfig ./tsconfig.json scripts/reseed-heroes-from-reels.ts --slug protein-kaiserschmarren
//
// Kosten:  Apify Free Tier reicht; ~$0.01 pro Scrape bei Paid.
// Laufzeit: ~8-10 s pro Reel × 34 Rezepte ≈ 5 Min total.
// Idempotent: schreibt mit upsert=true; jeder Run produziert das identische
//             Bild fuer den gleichen Reel (Apify cached den Cover-Frame).

import path from "node:path";
import { config as loadEnv } from "dotenv";
loadEnv({ path: path.join(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";
import { extractReelHeroFromInstagram } from "../lib/ai/extract-reel-hero";

const HERO_BUCKET = "recipe-heroes";

async function main() {
  const args = process.argv.slice(2);
  const packFilter = arg(args, "--pack");
  const slugFilter = arg(args, "--slug");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error(
      "[reseed-heroes] NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY brauchen wir."
    );
    process.exit(1);
  }
  if (!process.env.APIFY_TOKEN) {
    console.error("[reseed-heroes] APIFY_TOKEN fehlt — Scraper kann nicht laufen.");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  // Statische Rezepte (is_custom=false) mit sourceUrl. Optional gefiltert.
  let query = supabase
    .from("recipes")
    .select("id, brand_slug, pack_slug, recipe_slug, data")
    .eq("is_custom", false);
  if (packFilter) query = query.eq("pack_slug", packFilter);
  if (slugFilter) query = query.eq("recipe_slug", slugFilter);

  const { data: rows, error } = await query;
  if (error) {
    console.error("[reseed-heroes] DB-Read failed:", error.message);
    process.exit(1);
  }
  if (!rows || rows.length === 0) {
    console.log("[reseed-heroes] Keine Rezepte gefunden.");
    return;
  }

  const candidates = rows
    .map((r) => ({
      ...r,
      sourceUrl: (r.data as { sourceUrl?: string }).sourceUrl,
    }))
    .filter((r) => r.sourceUrl && r.sourceUrl.length > 10);

  console.log(
    `[reseed-heroes] ${candidates.length} Rezepte mit sourceUrl gefunden (von ${rows.length} total).`
  );

  let done = 0;
  let skipped = 0;
  let failed = 0;
  for (const r of candidates) {
    const label = `${r.pack_slug}/${r.recipe_slug}`;
    try {
      console.log(`[reseed-heroes] (${done + skipped + failed + 1}/${candidates.length}) ${label} …`);
      const reel = await extractReelHeroFromInstagram(r.sourceUrl!);
      if (!reel) {
        console.warn(`[reseed-heroes]   ↳ Apify lieferte keinen displayUrl → skip`);
        skipped += 1;
        continue;
      }
      const filePath = `${r.id}.jpg`;
      const upload = await supabase.storage
        .from(HERO_BUCKET)
        .upload(filePath, reel.buffer, {
          contentType: "image/jpeg",
          upsert: true,
          cacheControl: "31536000",
        });
      if (upload.error) {
        console.error(
          `[reseed-heroes]   ↳ Storage-Upload failed: ${upload.error.message}`
        );
        failed += 1;
        continue;
      }
      const { data: pub } = supabase.storage
        .from(HERO_BUCKET)
        .getPublicUrl(filePath);
      const heroUrl = pub.publicUrl;
      if (!heroUrl) {
        console.error(`[reseed-heroes]   ↳ Keine Public-URL`);
        failed += 1;
        continue;
      }
      // Merge `hero` in das jsonb-data-Feld, ohne andere Felder zu verlieren.
      const updated = { ...(r.data as Record<string, unknown>), hero: heroUrl };
      const { error: updErr } = await supabase
        .from("recipes")
        .update({ data: updated })
        .eq("id", r.id);
      if (updErr) {
        console.error(`[reseed-heroes]   ↳ DB-Update failed: ${updErr.message}`);
        failed += 1;
        continue;
      }
      console.log(`[reseed-heroes]   ↳ OK: ${heroUrl}`);
      done += 1;
      // Kleiner Delay, damit Apify nicht im Rate-Limit landet
      await sleep(800);
    } catch (err) {
      console.error(
        `[reseed-heroes]   ↳ Fehler: ${err instanceof Error ? err.message : err}`
      );
      failed += 1;
    }
  }

  console.log("");
  console.log(`[reseed-heroes] Fertig.`);
  console.log(`  ✓ ${done} Heroes aktualisiert`);
  console.log(`  ↩ ${skipped} ohne displayUrl uebersprungen`);
  console.log(`  ✗ ${failed} fehlgeschlagen`);
}

function arg(args: string[], name: string): string | null {
  const idx = args.indexOf(name);
  if (idx < 0 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error("[reseed-heroes] fatal:", err);
  process.exit(1);
});
