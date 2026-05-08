/**
 * Generate foreword image (Flux 2 Pro) + foreword text (Gemini 2.5 Flash)
 * for one or all packs. Run locally only — needs BFL_API_KEY and
 * GEMINI_API_KEY from .env.local.
 *
 * Usage:
 *   npx tsx scripts/generate-foreword-assets.ts bienes-backwelt
 *   npx tsx scripts/generate-foreword-assets.ts --all
 *   npx tsx scripts/generate-foreword-assets.ts bienes-backwelt --image-only
 *   npx tsx scripts/generate-foreword-assets.ts bienes-backwelt --text-only
 *
 * Output:
 *   - Image:  public/brands/biene/forewords/<packSlug>.jpg  (1024×1024 JPEG)
 *   - Text:   merged into lib/pack-forewords.ts
 *
 * The script never overwrites text without --force; image always overwrites
 * because regenerating costs ~$0.05 and the user is doing it on purpose.
 */

import { config } from "dotenv";
import { promises as fs } from "fs";
import path from "path";
import { brands } from "../lib/brands";
import { packs } from "../lib/packs";
import { generateForewordImage } from "../lib/ai/generate-foreword-image";
import { generatePackForeword } from "../lib/ai/generate-foreword";
import type { PackForewordContent } from "../lib/ai/generate-foreword";
import { packForewords } from "../lib/pack-forewords";

config({ path: ".env.local" });

const args = process.argv.slice(2);
const wantAll = args.includes("--all");
const imageOnly = args.includes("--image-only");
const textOnly = args.includes("--text-only");
const force = args.includes("--force");
const positional = args.filter((a) => !a.startsWith("--"));
const targetSlugs = wantAll
  ? packs.map((p) => p.slug)
  : positional.length > 0
    ? positional
    : [];

if (targetSlugs.length === 0) {
  console.error(
    "Error: pass one or more pack slugs, or --all. Examples:\n" +
      "  npx tsx scripts/generate-foreword-assets.ts bienes-backwelt\n" +
      "  npx tsx scripts/generate-foreword-assets.ts --all"
  );
  process.exit(1);
}

const FOREWORDS_DIR = path.join(
  process.cwd(),
  "public",
  "brands",
  "biene",
  "forewords"
);
const FOREWORDS_FILE = path.join(process.cwd(), "lib", "pack-forewords.ts");

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function generateImage(packSlug: string): Promise<void> {
  const pack = packs.find((p) => p.slug === packSlug);
  if (!pack) {
    console.error(`  ! Pack "${packSlug}" not found, skipping image`);
    return;
  }
  console.log(`  → generating image for ${packSlug}…`);
  const buffer = await generateForewordImage(pack);
  await ensureDir(FOREWORDS_DIR);
  const outputPath = path.join(FOREWORDS_DIR, `${packSlug}.jpg`);
  await fs.writeFile(outputPath, buffer);
  console.log(
    `  ✓ wrote ${path.relative(process.cwd(), outputPath)} (${(buffer.length / 1024).toFixed(0)} KB)`
  );
}

async function generateText(
  packSlug: string,
  existing: Record<string, PackForewordContent>
): Promise<PackForewordContent | null> {
  const pack = packs.find((p) => p.slug === packSlug);
  if (!pack) {
    console.error(`  ! Pack "${packSlug}" not found, skipping text`);
    return null;
  }
  if (existing[packSlug] && !force) {
    console.log(
      `  · text already cached for ${packSlug} — pass --force to regenerate`
    );
    return existing[packSlug];
  }
  const brand = brands.find((b) => b.slug === pack.brandSlug);
  if (!brand) {
    console.error(`  ! Brand for pack "${packSlug}" not found`);
    return null;
  }
  console.log(`  → generating text for ${packSlug}…`);
  const content = await generatePackForeword(pack, brand);
  console.log(`  ✓ greeting: ${content.greeting}`);
  console.log(`  ✓ story:    ${content.story.slice(0, 80)}…`);
  console.log(`  ✓ signoff:  ${content.signoff}`);
  return content;
}

function renderForewordsFile(map: Record<string, PackForewordContent>): string {
  // Stable, alphabetic ordering keeps git diffs clean across re-runs.
  const entries = Object.keys(map)
    .sort()
    .map((slug) => {
      const c = map[slug];
      const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      return [
        `  "${slug}": {`,
        `    greeting: "${esc(c.greeting)}",`,
        `    story:`,
        `      "${esc(c.story)}",`,
        `    signoff: "${esc(c.signoff)}",`,
        `  },`,
      ].join("\n");
    })
    .join("\n");

  return [
    "// Cached pack-forewords. Mirrors the pattern of lib/recipe-micros.ts —",
    "// a static map keyed by pack slug, populated by a generation script and",
    "// committed to git. The render pipeline reads from this cache instead",
    "// of calling Gemini at render-time, so PDFs render in a few hundred",
    "// milliseconds rather than tens of seconds.",
    "//",
    "// Re-generieren: `npx tsx scripts/generate-foreword-assets.ts <packSlug>`",
    "// (single pack) oder `npx tsx scripts/generate-foreword-assets.ts --all`",
    "// (alle Packs neu). Die Re-generation ist nicht-destruktiv: bestehende",
    "// Einträge werden ueberschrieben (mit --force), andere bleiben unangetastet.",
    "//",
    "// Auto-generated content — manual edits are okay und werden erst beim",
    "// nächsten --force-Lauf des Skripts ueberschrieben.",
    "",
    'import type { PackForewordContent } from "./ai/generate-foreword";',
    "",
    "export const packForewords: Record<string, PackForewordContent> = {",
    entries,
    "};",
    "",
    "export function getPackForeword(packSlug: string): PackForewordContent | null {",
    "  return packForewords[packSlug] ?? null;",
    "}",
    "",
  ].join("\n");
}

async function main() {
  console.log(
    `Foreword-Assets-Generator: ${targetSlugs.length} pack(s), image=${!textOnly}, text=${!imageOnly}, force=${force}`
  );
  console.log("");

  const merged: Record<string, PackForewordContent> = { ...packForewords };

  for (const slug of targetSlugs) {
    console.log(`▸ ${slug}`);
    if (!textOnly) {
      try {
        await generateImage(slug);
      } catch (err) {
        console.error(`  ✗ image failed: ${(err as Error).message}`);
      }
    }
    if (!imageOnly) {
      try {
        const content = await generateText(slug, merged);
        if (content) merged[slug] = content;
      } catch (err) {
        console.error(`  ✗ text failed: ${(err as Error).message}`);
      }
    }
    console.log("");
  }

  if (!imageOnly) {
    const out = renderForewordsFile(merged);
    await fs.writeFile(FOREWORDS_FILE, out, "utf8");
    console.log(
      `✓ updated ${path.relative(process.cwd(), FOREWORDS_FILE)} (${Object.keys(merged).length} packs cached)`
    );
  }
}

main().catch((err) => {
  console.error("✗ generate-foreword-assets failed:");
  console.error(err);
  process.exit(1);
});
