import type { Pack } from "@/lib/packs";
import type { Brand } from "@/lib/brands";
import { generateImage, downloadImage } from "./bfl-flux";

// Pack-cover prompts are simpler than per-recipe heroes: we don't have a
// dish to photograph, just a "mood image" that captures the pack's category.
// Editorial cookbook aesthetic, soft natural light, props that hint at the
// pack's category without spelling it out.
//
// We pass the pack title + tagline + category to Flux through the prompt and
// rely on its text-grounded model to compose a still life that reads like a
// magazine cover. Mood colour + biene-style backdrop come from the pack
// metadata so each generated cover sits inside the pack's own palette.

type PackCoverInput = {
  pack: Pack;
  brand: Brand;
};

function paletteHint(pack: Pack): string {
  // Flux responds well to literal hex codes plus a colloquial colour word.
  // The more specific the hint, the closer the result lands to the rest of
  // the pack — a generic "warm tones" prompt drifts a lot.
  const hex = pack.mood.background;
  const word = colourWord(hex);
  return `dominant palette: ${hex} (${word}), soft cream highlights, muted natural tones`;
}

function colourWord(hex: string): string {
  // Tiny lookup keyed off Biene's preset palette. Falls back to "warm" so we
  // never leave the prompt empty for custom-mood packs with arbitrary hex.
  const map: Record<string, string> = {
    "#ddc9e8": "lavender",
    "#c8e2a8": "sage green",
    "#b8dcc9": "mint",
    "#b4cde4": "sky blue",
    "#f4d88d": "honey",
    "#f3cdd3": "soft rose",
    "#f7d4b8": "apricot",
    "#e0cdb6": "cocoa cream",
  };
  return map[hex.toLowerCase()] ?? "warm pastel";
}

function categoryProps(pack: Pack): string {
  // Pack category → still-life prop hint. Generic enough to not constrain
  // composition, specific enough to read on the cover.
  const cat = pack.category.toLowerCase();
  if (cat.includes("back") || cat.includes("dessert"))
    return "a wooden cake stand with one elegant slice, fresh berries, dusted icing sugar, vintage pastry fork";
  if (cat.includes("snack"))
    return "small ceramic bowls with bite-sized treats, cocoa nibs scattered, linen napkin";
  if (cat.includes("haupt") || cat.includes("klassik"))
    return "a generous plated main on a stoneware plate, fresh herbs scattered, a worn linen napkin";
  if (cat.includes("meal") || cat.includes("woche") || cat.includes("prep"))
    return "neat glass meal-prep containers in a row, mixed proteins and vegetables, planner notebook in soft focus";
  if (cat.includes("diät") || cat.includes("volumen") || cat.includes("fitness"))
    return "a generous bowl of vibrant salad with grilled chicken and avocado, lemon halves, kitchen towel";
  if (cat.includes("frühstück"))
    return "an overnight-oats glass with berries, a wooden spoon, sliced banana, soft morning light";
  return "a styled flat-lay of ingredients suggesting the dish, herbs and a linen napkin";
}

export async function generatePackCover(input: PackCoverInput): Promise<{
  buffer: Buffer;
  contentType: "image/jpeg";
}> {
  const { pack, brand } = input;
  const prompt = [
    `Editorial cookbook cover photography, magazine still life style.`,
    `Subject: ${categoryProps(pack)}.`,
    `Mood: ${pack.tagline || pack.title}, captures the spirit of "${pack.title}" by ${brand.name}.`,
    `${paletteHint(pack)}.`,
    `Soft diffused natural daylight from upper left, gentle shadows, no harsh highlights.`,
    `Composition: vertical 4:5 frame, generous negative space at the top for a future title overlay, dish slightly off-center for editorial feel.`,
    `Texture: real food, real props, slight imperfection, no plastic look. Shot on a 50mm, shallow depth of field, slight grain.`,
    `Style: Bon Appétit + Kinfolk cookbook aesthetic, warm and inviting, NOT clinical, NOT studio harsh.`,
  ].join(" ");

  const negative = [
    `text, watermark, logo, signage, written words, captions`,
    `cartoon, illustration, 3D render, CGI, AI artifacts`,
    `harsh studio lighting, overexposed highlights, clipped shadows`,
    `plastic-looking food, fake gloss, oversaturated colours`,
    `multiple plates fighting for attention, cluttered composition`,
    `dirty surfaces, untidy props, messy backgrounds`,
    `human hands, faces, body parts`,
  ].join(", ");

  const result = await generateImage({
    prompt,
    negativePrompt: negative,
    model: "flux-2-pro",
    // 4:5 portrait — matches the pack-cover aspect on the workspace + cover
    // page. Falls back to 3:4 if BFL doesn't accept 4:5 in this revision.
    aspectRatio: "3:4",
    outputFormat: "jpeg",
    safetyTolerance: 2,
  });

  const buffer = await downloadImage(result.imageUrl);
  return { buffer, contentType: "image/jpeg" };
}
