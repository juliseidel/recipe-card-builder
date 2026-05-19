import type { Pack } from "@/lib/packs";
import { generateImage, downloadImage } from "./bfl-flux";

// Pack-Cover-Generator fuer Fitness-Packs. Spiegel zu generate-pack-cover.ts
// aber mit Gym/Trainings-Setting-Prompt statt Food-Photography.
//
// Output: Square 1:1, top-down oder dramatischer Side-Shot je nach
// Trainings-Sub-Niche. Akzent-farbiger Backdrop entsprechend Pack-Mood.
// Kein Text, kein KI-Person — nur Equipment-Stillleben oder Gym-Setting.
//
// Sub-Niche-Heuristik (aus pack.category):
//   - hyrox/functional → Hyrox-Equipment-Setup (Sled, Wall Ball)
//   - hypertrophie/bodybuilding → Hantel-Setup auf Gym-Boden
//   - mobility/pilates → Mat + Bloecke + sanftes Licht
//   - cardio/laufen → Track / Laufschuhe / Stoppuhr
//   - abnehm/wochenplan → Mix Equipment + Tagebuch / Stoppuhr
//   - default → Hantel auf neutral-Backdrop

type FitnessPackCoverInput =
  | { pack: Pack }
  | { title: string; tagline?: string; category?: string; bgHex: string };

function colourWord(hex: string): string {
  const map: Record<string, string> = {
    "#ddc9e8": "lavender purple",
    "#f3cdd3": "soft rose pink",
    "#f7d4b8": "apricot",
    "#f4d88d": "honey yellow",
    "#f4dcd2": "warm blush rose",
    "#fae8b8": "buttercream vanilla",
    "#fad6c0": "peach",
    "#e4cad8": "muted mauve",
    "#c8e2a8": "sage green",
    "#b8dcc9": "mint green",
    "#c8d8c5": "eucalyptus muted green",
    "#d8e8b8": "pistachio bright green",
    "#b8c8a8": "moss forest green",
    "#b4cde4": "sky blue",
    "#d4dde2": "soft mist grey-blue",
    "#d8e2ee": "powder pale blue",
    "#b8d4d4": "ocean teal turquoise",
    "#e0cdb6": "cocoa cream beige",
    "#e8b89a": "terracotta clay",
    "#e8d4a4": "sand dune beige",
    "#1a1a1f": "deep charcoal black",
    "#16161a": "matte black anthracite",
    "#0f0f12": "tactical black",
    // Default-Pack-Mood
    "#fbf7f0": "cream beige",
  };
  return map[hex.toLowerCase()] ?? "neutral soft pastel";
}

// Heuristik: aus Pack-Title + Category das richtige Gym-Setting waehlen.
type FitnessSettingPrompt = {
  setting: string;
  equipmentFocus: string;
};

function pickFitnessSetting(
  title: string,
  category: string,
  tagline: string
): FitnessSettingPrompt {
  const combined = `${title} ${category} ${tagline}`.toLowerCase();

  if (
    combined.includes("hyrox") ||
    combined.includes("functional") ||
    combined.includes("crossfit") ||
    combined.includes("race")
  ) {
    return {
      setting:
        "Functional-fitness gym setup: polished concrete floor, wall ball ball, sled with metal plates, sandbag, kettlebells arranged in a clean composition",
      equipmentFocus: "Hyrox race-day equipment, performance arena vibe",
    };
  }
  if (
    combined.includes("bodybuilding") ||
    combined.includes("hypertroph") ||
    combined.includes("muskel") ||
    combined.includes("strength") ||
    combined.includes("krafttraining")
  ) {
    return {
      setting:
        "Old-school iron-temple gym floor: olympic barbell with plates, dumbbells stacked nearby, chalk dust, polished rubber floor",
      equipmentFocus:
        "Heavy iron + chalk + leather lifting belt, dramatic single-source lighting",
    };
  }
  if (
    combined.includes("pilates") ||
    combined.includes("mobility") ||
    combined.includes("yoga") ||
    combined.includes("stretch") ||
    combined.includes("beweglich")
  ) {
    return {
      setting:
        "Bright pilates studio: light wood floor, rolled-up yoga mat, foam block and roller, ceramic water bottle, morning sunlight through tall windows",
      equipmentFocus:
        "Pilates / mobility setup, calm and minimal, soft natural light",
    };
  }
  if (
    combined.includes("cardio") ||
    combined.includes("laufen") ||
    combined.includes("running") ||
    combined.includes("ausdauer") ||
    combined.includes("endurance")
  ) {
    return {
      setting:
        "Track-side cardio scene: running shoes on red rubber track, foam roller, water bottle, stopwatch lying nearby",
      equipmentFocus:
        "Running shoes + stopwatch + track surface, athletic performance atmosphere",
    };
  }
  if (
    combined.includes("abnehm") ||
    combined.includes("fat-loss") ||
    combined.includes("weight loss") ||
    combined.includes("wochenplan")
  ) {
    return {
      setting:
        "Coaching desk with handwritten weekly training plan, kettlebell, measuring tape, water bottle, fresh towel — clean editorial flat lay",
      equipmentFocus:
        "Mix of equipment + structured plan, coaching aesthetic, editorial composition",
    };
  }
  // Default: solider Hantel-Shot
  return {
    setting:
      "Clean home-gym corner: pair of dumbbells, rolled towel, water bottle on polished concrete floor",
    equipmentFocus:
      "Dumbbells + minimal setup, modern home-gym aesthetic, clean composition",
  };
}

export async function generateFitnessPackCover(
  input: FitnessPackCoverInput
): Promise<{ buffer: Buffer; contentType: string }> {
  const pack = "pack" in input ? input.pack : null;
  const title = pack?.title ?? ("title" in input ? input.title : "Training");
  const tagline =
    pack?.tagline ?? ("tagline" in input ? input.tagline : "");
  const category =
    pack?.category ?? ("category" in input ? input.category ?? "" : "");
  const bgHex = pack?.mood.background ?? ("bgHex" in input ? input.bgHex : "#16161a");
  const bgWord = colourWord(bgHex);

  const { setting, equipmentFocus } = pickFitnessSetting(
    title,
    category,
    tagline ?? ""
  );

  const prompt = [
    `Editorial fitness equipment still life on a completely solid ${bgWord} (${bgHex}) painted backdrop.`,
    setting + ".",
    `Vibe: ${equipmentFocus}.`,
    `Composition: equipment thoughtfully arranged, centred, square 1:1 frame, plenty of negative space.`,
    `Lighting: soft directional natural light, gentle long shadows, premium magazine aesthetic.`,
    `The entire background is the ${bgWord} colour, edge to edge — no other surfaces bleeding in.`,
    `Style: high-end performance brand editorial (Nike Training Club / Tracksmith / Hyrox official) cookbook-quality still life.`,
    `Real photography, NO TEXT anywhere in the image, NO people, NO faces, NO body parts.`,
  ]
    .filter(Boolean)
    .join(" ");

  const negative = [
    `text, words, letters, captions, titles, written language, signage, watermark, logo, brand markings`,
    `human hands, fingers, faces, body parts, people, athletes, models`,
    `cluttered scene, multiple competing focal points`,
    `bleeding background, complex texture, table edge, floor seam`,
    `illustration, painting, drawing, 3D render, CGI, cartoon, AI artifacts`,
    `harsh studio lighting, blown highlights, deep clipped shadows`,
    `cheap plastic equipment, scuffed dirty gear, gym mirror reflections`,
    `food, plates, drinks, kitchen objects`,
  ].join(", ");

  const result = await generateImage({
    prompt,
    negativePrompt: negative,
    model: "flux-2-pro",
    aspectRatio: "1:1",
    outputFormat: "jpeg",
    safetyTolerance: 2,
  });

  const buffer = await downloadImage(result.imageUrl);
  return { buffer, contentType: "image/jpeg" };
}
