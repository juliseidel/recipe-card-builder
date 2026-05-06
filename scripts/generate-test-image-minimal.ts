// Minimal-prompt test using Flux 2 Pro. Skips Gemini's Stage 2 entirely;
// the prompt is identity-first: who is Biene + which recipe, then we let
// the model handle composition, lighting, props, angle, all of it.
//
// Run: npx tsx --tsconfig ./tsconfig.json scripts/generate-test-image-minimal.ts [recipe-slug]
//
// Output: /tmp/rcb-image-test/<recipe-slug>__minimal.jpg

import path from "node:path";
import fs from "node:fs/promises";
import { config as loadEnv } from "dotenv";
loadEnv({ path: path.join(process.cwd(), ".env.local") });

import { recipes, type Recipe } from "../lib/recipes";
import { generateImage, downloadImage } from "../lib/ai/bfl-flux";

const OUT_DIR = "/tmp/rcb-image-test";

// Per-recipe scene derivation. Deliberately tiny: the only thing we
// derive is whether the dish is hot (drives the steam line). Everything
// else — vessel, garnish, framing — Flux 2 Pro decides from `recipe.title`.
// Iter-8 proved that approach works: "Käse-Nudeln" → Parmesan + Frischkäse
// in two ingredient bowls on the cutting board, completely unprompted.
//
// We *don't* dictate the vessel per pack; vessel-by-pack hard-coding broke
// for edge cases (a soup in Pack 5 isn't a "rustic plate", a smoothie in
// Pack 3 isn't a "ramekin"). Instead we subtract the one wrong default
// (cast-iron pan) via the negative prompt and let Flux pick what fits.
function deriveSceneHints(recipe: Recipe): { isHot: boolean } {
  return { isHot: (recipe.cookTime ?? 0) > 0 };
}

async function main() {
  if (!process.env.BFL_API_KEY) {
    console.error("✗ BFL_API_KEY missing");
    process.exit(1);
  }

  const slugArg = process.argv[2];
  const recipe = slugArg
    ? recipes.find((r) => r.slug === slugArg)
    : recipes[0];
  if (!recipe) {
    console.error(`✗ Recipe not found: ${slugArg}`);
    process.exit(1);
  }

  await fs.mkdir(OUT_DIR, { recursive: true });

  // Iteration 10: vessel choice fully delegated to Flux 2 Pro (no per-pack
  // hard-coding). The prompt only describes Biene's *world* (counter,
  // background board with ingredient bowl, scattered parsley) and lets the
  // recipe title decide what gets plated and how. Cast-iron pan is pushed
  // out of the default via the negative prompt, not via a positive override.
  const { isHot } = deriveSceneHints(recipe);
  const steamLine = isHot
    ? "Subtle steam rises gently from the warm dish."
    : "";

  const prompt = [
    `A still-life overhead food photograph of ${recipe.title}, on a smooth pale-grey concrete kitchen counter with bright natural daylight.`,
    `In the soft upper background a small wooden cutting board holds a tiny ceramic bowl with one of the recipe's key ingredients, and a few sprigs of fresh parsley are scattered loosely across the cutting board and the counter near the dish.`,
    steamLine,
  ]
    .filter(Boolean)
    .join(" ");

  // Negative: subtract the wrong defaults rather than dictate the right ones.
  // Typography negatives (the iter-8 text-overlay problem). Cast-iron pan
  // negatives because Flux 2 Pro's default for "Käse-Nudeln" is otherwise a
  // skillet — Biene plates up.
  const negative =
    "text, words, letters, headlines, captions, recipe title overlay, large letters at bottom of image, instagram caption, typography, watermark, logo, brand name, nutrition info box, calorie banner, packaging, supplement container, hands, faces, multiple plates of the same dish, second portion in background, cast-iron pan, frying pan, skillet, cream-coloured counter, oak wood counter, marble counter, beige countertop, dark moody lighting, vintage farmhouse style";

  console.log(`\n━━━ Minimal-Prompt Test (Flux 2 Pro) ━━━`);
  console.log(`Recipe: ${recipe.title}`);
  console.log(`Prompt (${prompt.length} chars):`);
  console.log(`──────────────────────────────────────────`);
  console.log(prompt);
  console.log(`──────────────────────────────────────────\n`);

  const t0 = Date.now();
  const result = await generateImage({
    prompt,
    negativePrompt: negative,
    model: "flux-2-pro",
    aspectRatio: "1:1",
    outputFormat: "jpeg",
    safetyTolerance: 2,
  });
  console.log(`✓ ${Date.now() - t0} ms · seed ${result.seed}\n`);

  const buf = await downloadImage(result.imageUrl);
  const imgPath = path.join(OUT_DIR, `${recipe.slug}__minimal.jpg`);
  await fs.writeFile(imgPath, buf);
  console.log(`Saved: ${imgPath}  (${(buf.length / 1024).toFixed(0)} KB)`);
  console.log(`→ open "${imgPath}"\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
