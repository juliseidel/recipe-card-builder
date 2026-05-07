import type { Pack } from "@/lib/packs";
import { generateImage, downloadImage } from "./bfl-flux";

// Pack covers are styled exactly like the curated pack-1..pack-5 images:
// a single dish on a flat coloured backdrop matching the pack's mood,
// shot from above. We deliberately don't dictate the dish — we feed Flux
// the pack title + tagline and let it pick something thematically right
// (so "7 Tage Frühstück" gets a breakfast scene, "Bienes Backwelt" gets a
// cake, etc.) instead of hardcoding category mappings that always drift
// in edge cases.

type PackCoverInput = {
  pack: Pack;
};

// Hex → English colour word so Flux's text encoder anchors the backdrop
// colour properly. Without the word the model treats the hex as noise.
function colourWord(hex: string): string {
  const map: Record<string, string> = {
    "#ddc9e8": "lavender purple",
    "#c8e2a8": "sage green",
    "#b8dcc9": "mint green",
    "#b4cde4": "sky blue",
    "#f4d88d": "honey yellow",
    "#f3cdd3": "soft rose pink",
    "#f7d4b8": "apricot",
    "#e0cdb6": "cocoa cream beige",
  };
  return map[hex.toLowerCase()] ?? "soft pastel";
}

export async function generatePackCover(input: PackCoverInput): Promise<{
  buffer: Buffer;
  contentType: "image/jpeg";
}> {
  const { pack } = input;
  const bgHex = pack.mood.background;
  const bgWord = colourWord(bgHex);

  // Minimal prompt. The dish is implied from the pack name — Flux is good
  // enough at "what dish fits this title" that we don't need to micromanage.
  // Hard rules: solid coloured backdrop in the pack mood, no text anywhere,
  // top-down, single dish, real food.
  const prompt = [
    `Top-down food photography on a completely solid ${bgWord} (${bgHex}) painted backdrop.`,
    `One single beautiful dish that fits the theme "${pack.title}".`,
    pack.tagline ? `Vibe: ${pack.tagline}.` : "",
    `The entire background is the ${bgWord} colour, edge to edge — no other surfaces, no table texture, no objects bleeding in.`,
    `Soft diffused natural daylight, gentle shadow underneath the dish.`,
    `Composition: dish centred, square 1:1 frame.`,
    `Real food, modern cookbook plating, slight imperfection, NO TEXT anywhere in the image.`,
    `Style: Bon Appétit cookbook aesthetic, clean and inviting.`,
  ]
    .filter(Boolean)
    .join(" ");

  // Negatives are blunt — Flux Pro respects them well when the positive
  // prompt is short. Text is at the front because that's the failure we
  // see most: Flux loves to hallucinate cookbook titles.
  const negative = [
    `text, words, letters, captions, titles, written language, signage, watermark, logo`,
    `wooden table, marble surface, tablecloth, bleeding background, complex texture`,
    `multiple plates, multiple bowls, cluttered scene`,
    `human hands, fingers, faces, body parts`,
    `plastic food, glossy fake food, oversaturated, garish`,
    `illustration, painting, drawing, 3D render, CGI, cartoon, AI artifacts`,
    `harsh studio lighting, blown highlights, deep clipped shadows`,
    `dirty plates, messy crumbs, stained surface`,
  ].join(", ");

  const result = await generateImage({
    prompt,
    negativePrompt: negative,
    model: "flux-2-pro",
    // 1:1 — same shape as the curated pack-1..pack-5 images. Display layouts
    // (3/4 cover, 4/3.4 card) crop into it via object-cover. Square also
    // gives Flux room to centre the dish without weird vertical cropping.
    aspectRatio: "1:1",
    outputFormat: "jpeg",
    safetyTolerance: 2,
  });

  const buffer = await downloadImage(result.imageUrl);
  return { buffer, contentType: "image/jpeg" };
}
