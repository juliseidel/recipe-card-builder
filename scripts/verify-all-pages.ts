// Verify EVERY recipe in EVERY pack renders to exactly one page,
// and every pack PDF has the expected page count
// (1 cover + 1 index + N recipes + 1 nutrition + 1 outro = N + 4).

import fs from "node:fs/promises";
import { execSync } from "node:child_process";
import { getBrand } from "../lib/brands";
import { packs, type Pack } from "../lib/packs";
import { getRecipesForPack } from "../lib/recipes";
import { renderPackPdf, renderRecipePdf } from "../lib/pdf/render";

const OUT = "/tmp/rcb-verify";

function pages(filePath: string): number {
  const out = execSync(`strings "${filePath}" | grep -c "/Type /Page$" || true`, {
    encoding: "utf8",
  });
  return parseInt(out.trim(), 10);
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const brand = getBrand("biene")!;
  let allGood = true;

  console.log("\n→ Single-recipe PDFs (every recipe in every pack)");
  for (const pack of packs) {
    const recipes = await getRecipesForPack(pack.slug);
    console.log(`\n  ${pack.title} · ${pack.cardLayout} layout`);
    for (const recipe of recipes) {
      const buf = await renderRecipePdf({
        brand,
        pack,
        recipe,
        totalRecipes: recipes.length,
      });
      const out = `${OUT}/${pack.slug}__${recipe.slug}.pdf`;
      await fs.writeFile(out, buf);
      const pg = pages(out);
      const ok = pg === 1;
      if (!ok) allGood = false;
      const sym = ok ? "✓" : "❌";
      console.log(
        `    ${sym} ${recipe.title}  (${recipe.ingredients.length} ing, ${recipe.steps.length} steps)  → ${pg} page(s)`
      );
    }
  }

  console.log("\n→ Pack PDFs");
  for (const pack of packs as Pack[]) {
    const recipes = await getRecipesForPack(pack.slug);
    const buf = await renderPackPdf({ brand, pack, recipes });
    const out = `${OUT}/PACK__${pack.slug}.pdf`;
    await fs.writeFile(out, buf);
    const pg = pages(out);
    const expected = recipes.length + 4;
    const ok = pg === expected;
    if (!ok) allGood = false;
    const sym = ok ? "✓" : "❌";
    console.log(
      `  ${sym} ${pack.title}  ${recipes.length} recipes → ${pg} pages (expected ${expected})`
    );
  }

  console.log(
    allGood
      ? "\n✓ ALL PDFs verified: every recipe = 1 page"
      : "\n❌ Some recipes overflow!"
  );
  process.exit(allGood ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
