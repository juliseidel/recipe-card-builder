// Batch-generate hero images for every static recipe via the full pipeline:
//
//   recipe → Gemini cinematography spec (Stage 2) → Flux 2 Pro hero (Stage 4)
//   → JPEG saved to public/brands/<brand>/heroes/<slug>.jpg
//   → public URL committed to lib/recipe-heroes.ts
//
// Idempotent — recipes whose JPEG already exists on disk are skipped. Use
// --force to regenerate all, or pass a single slug to regenerate one recipe.
//
// Run:
//   npx tsx --tsconfig ./tsconfig.json scripts/generate-recipe-heroes.ts
//   npx tsx --tsconfig ./tsconfig.json scripts/generate-recipe-heroes.ts --force
//   npx tsx --tsconfig ./tsconfig.json scripts/generate-recipe-heroes.ts kaese-nudeln
//
// Cost: ~$0.05 per image via BFL Flux 2 Pro. 37 recipes ≈ $2.
// Time:  ~15-20 s per recipe (Gemini ~1-2 s + Flux ~15-20 s).

import path from "node:path";
import fs from "node:fs/promises";
import { config as loadEnv } from "dotenv";
loadEnv({ path: path.join(process.cwd(), ".env.local") });

import { recipes, type Recipe } from "../lib/recipes";
import { generateImageSpec } from "../lib/ai/recipe-image-spec";
import { buildPrompt } from "../lib/ai/image-prompts";
import { generateImage, downloadImage } from "../lib/ai/bfl-flux";

const BRAND_SLUG = "biene";
const PUBLIC_HEROES_DIR = path.join(
  process.cwd(),
  "public",
  "brands",
  BRAND_SLUG,
  "heroes"
);
const HEROES_TS_PATH = path.join(process.cwd(), "lib", "recipe-heroes.ts");

async function main() {
  if (!process.env.BFL_API_KEY) {
    console.error("✗ BFL_API_KEY missing in .env.local");
    process.exit(1);
  }
  if (!process.env.GEMINI_API_KEY) {
    console.error("✗ GEMINI_API_KEY missing in .env.local");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const slugFilter = args.find((a) => !a.startsWith("--"));

  const targets: Recipe[] = slugFilter
    ? recipes.filter((r) => r.slug === slugFilter)
    : recipes;

  if (slugFilter && targets.length === 0) {
    console.error(`✗ Recipe not found: ${slugFilter}`);
    console.error(`Available slugs:`);
    recipes.forEach((r) => console.error(`  - ${r.slug}  (${r.title})`));
    process.exit(1);
  }

  await fs.mkdir(PUBLIC_HEROES_DIR, { recursive: true });

  const existing = await loadExistingMap();
  const map: Record<string, string> = { ...existing };

  console.log(`\n━━━ Recipe Hero Batch (Flux 2 Pro · brand=${BRAND_SLUG}) ━━━`);
  console.log(`Recipes: ${targets.length}${force ? " (forced)" : ""}`);
  console.log(`Output:  ${path.relative(process.cwd(), PUBLIC_HEROES_DIR)}/`);
  console.log(`Map:     ${path.relative(process.cwd(), HEROES_TS_PATH)}\n`);

  let ok = 0;
  let skipped = 0;
  let failed = 0;
  const startMs = Date.now();

  for (const [idx, recipe] of targets.entries()) {
    const fileName = `${recipe.slug}.jpg`;
    const filePath = path.join(PUBLIC_HEROES_DIR, fileName);
    const publicUrl = `/brands/${BRAND_SLUG}/heroes/${fileName}`;
    const tag = `[${idx + 1}/${targets.length}]`;

    console.log(`${tag} ${recipe.slug}  (${recipe.title})`);

    // Idempotent skip — if the file exists and we're not forcing, just record
    // the URL and move on. Cheap recovery if the script dies mid-run.
    if (!force) {
      try {
        const stat = await fs.stat(filePath);
        if (stat.size > 0) {
          map[recipe.slug] = publicUrl;
          skipped++;
          console.log(
            `  ↩ already exists (${(stat.size / 1024).toFixed(0)} KB), skipping`
          );
          continue;
        }
      } catch {
        /* not exists, fall through to generate */
      }
    }

    const t0 = Date.now();
    try {
      // Stage 2 — Gemini cinematography spec
      const spec = await generateImageSpec(recipe, BRAND_SLUG);
      // Stage 4 — assemble hero prompt with brand-DNA overrides
      const { prompt, negative } = buildPrompt(
        "hero",
        recipe,
        spec,
        BRAND_SLUG
      );
      // Stage 5 — Flux 2 Pro
      const result = await generateImage({
        prompt,
        negativePrompt: negative,
        model: "flux-2-pro",
        aspectRatio: "1:1",
        outputFormat: "jpeg",
        safetyTolerance: 2,
      });
      const buf = await downloadImage(result.imageUrl);
      await fs.writeFile(filePath, buf);

      map[recipe.slug] = publicUrl;
      ok++;
      console.log(
        `  ✓ ${(buf.length / 1024).toFixed(0)} KB · ${Math.round((Date.now() - t0) / 1000)} s · seed ${result.seed}`
      );
      console.log(
        `    spec: vessel=${spec.servingVessel} · shape=${spec.dishShape} · temp=${spec.servingTemperature}`
      );
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ failed: ${msg.slice(0, 200)}`);
    }

    // Persist the map after each recipe so a crash mid-batch doesn't lose
    // progress. Cheap (~37 lines of TS, instant write).
    await writeHeroesMapFile(map);
  }

  const elapsed = Math.round((Date.now() - startMs) / 1000);
  console.log(`\n━━━ DONE in ${elapsed} s ━━━`);
  console.log(`✓ ${ok} generated  ·  ↩ ${skipped} skipped  ·  ✗ ${failed} failed`);
  console.log(`Map: ${HEROES_TS_PATH} (${Object.keys(map).length} entries)\n`);

  if (failed > 0) {
    process.exit(2);
  }
}

async function loadExistingMap(): Promise<Record<string, string>> {
  try {
    const src = await fs.readFile(HEROES_TS_PATH, "utf8");
    const out: Record<string, string> = {};
    for (const line of src.split("\n")) {
      const m = line.match(/^\s*"([a-z0-9-]+)":\s*"([^"]+)",?\s*$/);
      if (m) out[m[1]] = m[2];
    }
    return out;
  } catch {
    return {};
  }
}

async function writeHeroesMapFile(
  map: Record<string, string>
): Promise<void> {
  const sorted = Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  const body = sorted.map(([k, v]) => `  "${k}": "${v}",`).join("\n");
  const content = `// Auto-generated by scripts/generate-recipe-heroes.ts.
// Hero image URL per recipe slug. JPEG files live in
// public/brands/<brand>/heroes/<slug>.jpg and are served as static assets.
// Manual edits will be overwritten on the next batch run.
//
// Re-generate (one recipe):  npx tsx scripts/generate-recipe-heroes.ts <slug>
// Re-generate (all):          npx tsx scripts/generate-recipe-heroes.ts --force

export const recipeHeroes: Record<string, string> = {
${body}
};

// Helper that returns the hero URL for a recipe slug, or undefined if no
// image has been generated yet (custom recipes from the editor before the
// async enrichment kicks in).
export function getRecipeHero(slug: string): string | undefined {
  return recipeHeroes[slug];
}
`;
  await fs.writeFile(HEROES_TS_PATH, content, "utf8");
}

main().catch((e) => {
  console.error("\n✗ Batch failed:");
  console.error(e);
  process.exit(1);
});
