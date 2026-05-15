import type { Pack } from "@/lib/packs";
import { generateImage, downloadImage } from "./bfl-flux";

// Pack covers are styled exactly like the curated pack-1..pack-5 images:
// a single dish on a flat coloured backdrop matching the pack's mood,
// shot from above. We deliberately don't dictate the dish — we feed Flux
// the pack title + tagline and let it pick something thematically right
// (so "7 Tage Frühstück" gets a breakfast scene, "Bienes Backwelt" gets a
// cake, etc.) instead of hardcoding category mappings that always drift
// in edge cases.
//
// Akzeptiert entweder einen voll-strukturierten Pack ODER nur die
// minimalen Felder (title, tagline, bgHex). Letzteres wird vom Pack-
// Suggestions-Cover-Generator genutzt: dort gibt's keinen echten Pack
// in der DB, nur das Vorschlags-Konzept.

type PackCoverInput =
  | { pack: Pack }
  | { title: string; tagline?: string; bgHex: string };

// Hex → English colour word so Flux's text encoder anchors the backdrop
// colour properly. Without the word the model treats the hex as noise.
// Deckt alle 26 moodPresets aus lib/pack-presets.ts ab. Erweitern wenn
// neue Paletten dazu kommen — sonst fallt Flux auf generischen "soft
// pastel"-Anker zurueck und das Cover wird farblich unspezifisch.
function colourWord(hex: string): string {
  const map: Record<string, string> = {
    // Warm-Pastel
    "#ddc9e8": "lavender purple",
    "#f3cdd3": "soft rose pink",
    "#f7d4b8": "apricot",
    "#f4d88d": "honey yellow",
    "#f4dcd2": "warm blush rosé",
    "#fae8b8": "buttercream vanilla",
    "#fad6c0": "peach",
    "#e4cad8": "muted mauve",
    // Fresh
    "#c8e2a8": "sage green",
    "#b8dcc9": "mint green",
    "#c8d8c5": "eucalyptus muted green",
    "#d8e8b8": "pistachio bright green",
    "#b8c8a8": "moss forest green",
    // Cool
    "#b4cde4": "sky blue",
    "#d4dde2": "soft mist grey-blue",
    "#d8e2ee": "powder pale blue",
    "#b8d4d4": "ocean teal turquoise",
    // Earth
    "#e0cdb6": "cocoa cream beige",
    "#e8b89a": "terracotta clay",
    "#ecddc4": "warm sand beige",
    "#d8c2a0": "camel tan",
    // Statement
    "#fbb09a": "vibrant coral pink",
    "#d8a8b0": "burgundy wine red",
    "#e4cc60": "rich mustard yellow",
    "#c8a4c0": "deep plum violet",
    "#f0c878": "warm saffron orange",
  };
  return map[hex.toLowerCase()] ?? "soft pastel";
}

export async function generatePackCover(input: PackCoverInput): Promise<{
  buffer: Buffer;
  contentType: "image/jpeg";
}> {
  // Normalize beide Eingabe-Formen auf die internen Felder.
  const title = "pack" in input ? input.pack.title : input.title;
  const tagline = "pack" in input ? input.pack.tagline : input.tagline;
  const bgHex = "pack" in input ? input.pack.mood.background : input.bgHex;
  const bgWord = colourWord(bgHex);

  // Minimal prompt. The dish is implied from the pack name — Flux is good
  // enough at "what dish fits this title" that we don't need to micromanage.
  // Hard rules: solid coloured backdrop in the pack mood, no text anywhere,
  // top-down, single dish, real food.
  const prompt = [
    `Top-down food photography on a completely solid ${bgWord} (${bgHex}) painted backdrop.`,
    `One single beautiful dish that fits the theme "${title}".`,
    tagline ? `Vibe: ${tagline}.` : "",
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
