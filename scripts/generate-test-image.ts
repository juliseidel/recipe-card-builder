// Test the full image-generation pipeline on a single recipe.
//
// Run: npx tsx --tsconfig ./tsconfig.json scripts/generate-test-image.ts [recipe-slug]
//
// Without an argument, generates for the first recipe of Pack 1. With an
// argument, generates for that specific recipe slug.
//
// Output:
//   /tmp/rcb-image-test/<recipe-slug>__hero.jpg
// Plus a sidecar .json with the Gemini spec and the final prompt — so we
// can debug if the image looks off without re-running the whole pipeline.

import path from "node:path";
import fs from "node:fs/promises";
import { config as loadEnv } from "dotenv";
loadEnv({ path: path.join(process.cwd(), ".env.local") });

import { recipes } from "../lib/recipes";
import { generateImageSpec } from "../lib/ai/recipe-image-spec";
import { buildPrompt } from "../lib/ai/image-prompts";
import { generateImage, downloadImage } from "../lib/ai/bfl-flux";

const OUT_DIR = "/tmp/rcb-image-test";

async function main() {
  if (!process.env.BFL_API_KEY) {
    console.error("✗ BFL_API_KEY missing in .env.local");
    process.exit(1);
  }
  if (!process.env.GEMINI_API_KEY) {
    console.error("✗ GEMINI_API_KEY missing in .env.local");
    process.exit(1);
  }

  const slugArg = process.argv[2];
  const recipe = slugArg
    ? recipes.find((r) => r.slug === slugArg)
    : recipes[0];
  if (!recipe) {
    console.error(`✗ Recipe not found: ${slugArg}`);
    console.error(`Available slugs:`);
    recipes.forEach((r) => console.error(`  - ${r.slug}  (${r.title})`));
    process.exit(1);
  }

  await fs.mkdir(OUT_DIR, { recursive: true });

  console.log(`\n━━━ Test Image Generation ━━━`);
  console.log(`Recipe: ${recipe.title}  (${recipe.slug})`);
  console.log(`Pack:   ${recipe.packSlug}\n`);

  // Stage 2: Gemini extracts cinematography spec
  console.log(`[1/3] Gemini → cinematography spec (brand=${recipe.packSlug.split("-")[0] || "biene"})…`);
  const t0 = Date.now();
  // For now every recipe in this catalogue is Bienes; later this becomes
  // dynamic from the recipe's owning brand.
  const brandSlug = "biene";
  const spec = await generateImageSpec(recipe, brandSlug);
  console.log(`      ✓ ${Date.now() - t0} ms`);
  console.log(`      heroElement:    ${spec.heroElement}`);
  console.log(`      servingVessel:  ${spec.servingVessel}`);
  console.log(`      dishShape:      ${spec.dishShape}`);
  console.log(`      textureFocus:   ${spec.textureFocus}`);
  console.log(`      colorTone:      ${spec.dishColorTone}`);
  console.log(`      utensil:        ${spec.primaryUtensil}`);
  console.log(`      lighting:       ${spec.lightingMood.slice(0, 60)}…`);
  console.log(`      scene:          ${spec.sceneContext.slice(0, 60)}…\n`);

  // Stage 4: assemble the hero prompt
  const { prompt, negative } = await buildPrompt("hero", recipe, spec, brandSlug);
  console.log(`[2/3] Prompt assembled (${prompt.length} chars)`);
  console.log(`──────────────────────────────────────────────────────────`);
  console.log(prompt);
  console.log(`──────────────────────────────────────────────────────────\n`);

  // Stage 5: BFL Flux 2 Pro generates the image (newest model, recommended
  // by Jan; flux-pro-1.1 was producing magazine-shoot composition, Flux 2
  // Pro reads identity-style prompts more like a real reel scene.)
  console.log(`[3/3] BFL Flux 2 Pro → image…`);
  const t1 = Date.now();
  const result = await generateImage({
    prompt,
    negativePrompt: negative,
    model: "flux-2-pro",
    aspectRatio: "1:1",
    outputFormat: "jpeg",
    safetyTolerance: 2,
  });
  console.log(`      ✓ ${Date.now() - t1} ms`);
  console.log(`      seed:    ${result.seed}`);
  console.log(`      flagged: ${result.flagged}`);
  console.log(`      url:     ${result.imageUrl.slice(0, 80)}…\n`);

  // Download and persist
  const buf = await downloadImage(result.imageUrl);
  const imgPath = path.join(OUT_DIR, `${recipe.slug}__hero.jpg`);
  const metaPath = path.join(OUT_DIR, `${recipe.slug}__hero.json`);
  await fs.writeFile(imgPath, buf);
  await fs.writeFile(
    metaPath,
    JSON.stringify(
      { recipe: recipe.title, slug: recipe.slug, spec, prompt, negative, seed: result.seed },
      null,
      2
    )
  );

  console.log(`✓ Saved`);
  console.log(`  Image: ${imgPath}  (${(buf.length / 1024).toFixed(0)} KB)`);
  console.log(`  Meta:  ${metaPath}\n`);
  console.log(`→ open "${imgPath}"  to inspect.\n`);
}

main().catch((e) => {
  console.error("\n✗ Test failed:");
  console.error(e);
  process.exit(1);
});
