// Local smoke test for the PDF renderer.
// Run: npx tsx --tsconfig ./tsconfig.json scripts/smoke-test-pdf.ts
//
// Renders one short recipe (3 ingredients), one long recipe (15+ ingredients),
// one of every layout, and one full pack — writes everything to /tmp/rcb-pdf/
// so we can open and visually verify before deploying.

import fs from "node:fs/promises";
import path from "node:path";
import { getBrand } from "../lib/brands";
import { getPack, packs } from "../lib/packs";
import { getRecipesForPack } from "../lib/recipes";
import { renderPackPdf, renderRecipePdf } from "../lib/pdf/render";

const OUT_DIR = "/tmp/rcb-pdf";

async function ensureDir() {
  await fs.mkdir(OUT_DIR, { recursive: true });
}

async function writePdf(name: string, buf: Buffer) {
  const p = path.join(OUT_DIR, name);
  await fs.writeFile(p, buf);
  // Confirm it's a real PDF (PDFs start with "%PDF-")
  const head = buf.subarray(0, 5).toString("utf8");
  const ok = head === "%PDF-";
  console.log(
    `  ${ok ? "✓" : "✗"} ${name}  ${buf.length.toLocaleString()} bytes  ${
      ok ? "(valid PDF)" : "INVALID — head=" + head
    }`
  );
  if (!ok) throw new Error(`Not a valid PDF: ${name}`);
}

async function main() {
  await ensureDir();
  const brand = getBrand("biene");
  if (!brand) throw new Error("Brand 'biene' not found");

  console.log(`\n→ Single recipe per layout (one card per pack)`);
  for (const pack of packs) {
    const recipes = getRecipesForPack(pack.slug);
    const recipe = recipes[0];
    if (!recipe) {
      console.warn(`  ! Pack ${pack.slug} has no recipes, skipping`);
      continue;
    }
    const buf = await renderRecipePdf({
      brand,
      pack,
      recipe,
      totalRecipes: recipes.length,
    });
    await writePdf(`${pack.cardLayout}__${pack.slug}__${recipe.slug}.pdf`, buf);
  }

  console.log(`\n→ Edge case — long recipe (find one with most ingredients)`);
  const allRecipes = packs.flatMap((p) =>
    getRecipesForPack(p.slug).map((r) => ({ pack: p, r }))
  );
  const longest = allRecipes.reduce((acc, cur) =>
    cur.r.ingredients.length > acc.r.ingredients.length ? cur : acc
  );
  console.log(
    `  Longest: "${longest.r.title}" — ${longest.r.ingredients.length} ingredients`
  );
  const longBuf = await renderRecipePdf({
    brand,
    pack: longest.pack,
    recipe: longest.r,
    totalRecipes: getRecipesForPack(longest.pack.slug).length,
  });
  await writePdf(`edge_long__${longest.pack.slug}__${longest.r.slug}.pdf`, longBuf);

  console.log(`\n→ Edge case — short recipe (fewest ingredients)`);
  const shortest = allRecipes.reduce((acc, cur) =>
    cur.r.ingredients.length < acc.r.ingredients.length ? cur : acc
  );
  console.log(
    `  Shortest: "${shortest.r.title}" — ${shortest.r.ingredients.length} ingredients`
  );
  const shortBuf = await renderRecipePdf({
    brand,
    pack: shortest.pack,
    recipe: shortest.r,
    totalRecipes: getRecipesForPack(shortest.pack.slug).length,
  });
  await writePdf(
    `edge_short__${shortest.pack.slug}__${shortest.r.slug}.pdf`,
    shortBuf
  );

  console.log(`\n→ Full pack (largest pack)`);
  const biggestPack = packs.reduce((a, b) =>
    getRecipesForPack(b.slug).length > getRecipesForPack(a.slug).length ? b : a
  );
  const packRecipes = getRecipesForPack(biggestPack.slug);
  console.log(
    `  Pack: ${biggestPack.title} — ${packRecipes.length} recipes (~${
      packRecipes.length + 4
    } pages)`
  );
  const packBuf = await renderPackPdf({
    brand,
    pack: biggestPack,
    recipes: packRecipes,
  });
  await writePdf(`PACK__${biggestPack.slug}.pdf`, packBuf);

  console.log(`\n✓ All PDFs rendered to ${OUT_DIR}`);
}

main().catch((e) => {
  console.error("\n✗ Smoke test failed:");
  console.error(e);
  process.exit(1);
});
