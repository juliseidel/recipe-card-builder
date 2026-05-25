import type { Pack, StoryPage } from "@/lib/packs";
import { generateImageGemini } from "./gemini-image-generation";
import { fetchHeroBuffers } from "./generate-foreword-collage";

// Story-Page-Bild-Generator (Inkrement 2 Stufe 2).
//
// Im Gegensatz zum Foreword-Bild ist hier der Kontext PER PAGE-KIND
// unterschiedlich:
//   - personal-story  → intim, retro: vintage Kueche, alte Schuerze,
//                       handgeschriebene Notizen
//   - philosophy      → reflektiert: Notizbuch + Kaffee, gefaltetes Leinen,
//                       gestapelte Buecher
//   - what-you-find   → praktisch: Geschirr-Stapel, Zutaten-Anordnung,
//                       Pack-spezifisches Setting
//   - custom          → generisch aus Pack-Kontext abgeleitet
//
// Recipe-Heroes optional als Style-Anchor — gleicher Mechanismus wie beim
// Foreword-Bild: Gemini sieht 1-3 Recipe-Heroes und matched die Lichtstimmung,
// Farb-Palette, Surface-Texture im Output.
//
// Aspect-Ratio: 16:9 (Hero ist im Story-PDF-Layout ~45% Hoehe = leicht
// querformat).

export type StoryPageImageOpts = {
  /** 0-3 Recipe-Hero-URLs als Style-Anchor. */
  heroUrls?: string[];
};

export type StoryPageImageResult = {
  buffer: Buffer;
  contentType: string;
};

const STORY_IMAGE_ASPECT = "16:9" as const;
const MAX_REFS = 3;

// Pro Kind eine Setting-Beschreibung. Wird als zentraler Anchor im Prompt
// genutzt, damit Gemini eine konkrete Scene aufbaut (nicht "irgendwas
// thematisch passendes").
const SETTING_BY_KIND: Record<StoryPage["kind"], string> = {
  "personal-story": `An intimate, retro kitchen setting evoking memory and personal history. Pick 2-3 of these elements:
- A vintage worn apron loosely folded or draped over a chair back
- Handwritten recipe notes on yellowed paper or in an open notebook
- An old wooden cutting board with subtle knife marks
- A weathered enamel measuring cup with a single ingredient
- A small framed photograph turned face down (no actual photo visible)
- A simple ceramic bowl with one piece of fruit or a single egg
Surface: aged wooden table or warm-toned worn linen runner.
Light: late afternoon golden window light from one side, warm honey shadows.`,

  philosophy: `A reflective, contemplative setting — like the desk of someone thinking through what matters. Pick 2-3 of these elements:
- An open notebook with handwritten German text (faint, not readable)
- A small ceramic cup of coffee or tea, half-drunk
- A linen napkin folded neatly to the side
- A short stack of well-used cookbooks (no titles visible)
- A small sprig of fresh herbs in a vintage glass jar
- A single brass spoon resting on a saucer
Surface: pale neutral stone or muted off-white linen.
Light: soft morning indirect light, very even, contemplative mood.`,

  "what-you-find": `A practical "what's inside this pack" setting — visual preview of the cooking world the reader is about to enter. Pick 2-3 of these elements:
- A small stack of clean ceramic plates with one fork resting on top
- A scattering of fresh ingredients (greens, citrus, herbs) loose around the plates
- A wooden spoon resting in an empty bowl
- A folded clean kitchen towel
- One small bowl with a key ingredient from the pack (e.g. quinoa, beans, berries)
Surface: pale clean kitchen counter, slight matte texture.
Light: bright midday daylight, fresh, clean shadows.`,

  custom: `A neutral but characterful still-life setting that evokes the theme of the pack. Pick elements that thematically connect to the pack title or category. Examples: cake-pack → vintage tin + flour; salad-pack → fresh greens + ceramic bowl; meal-prep → containers + notebook.
Surface: pale wood OR linen OR warm stone.
Light: natural window light, gentle shadows.`,
};

export async function generateStoryPageImage(
  pack: Pack,
  story: StoryPage,
  opts: StoryPageImageOpts = {}
): Promise<StoryPageImageResult> {
  const heroUrls = (opts.heroUrls ?? []).slice(0, MAX_REFS);

  let referenceImages: string[] = [];
  if (heroUrls.length > 0) {
    try {
      const buffers = await fetchHeroBuffers(heroUrls);
      referenceImages = buffers.map(
        (buf) => `data:image/jpeg;base64,${buf.toString("base64")}`
      );
    } catch (err) {
      console.warn(
        "[story-page-image] hero load failed, generating without refs:",
        err instanceof Error ? err.message : err
      );
    }
  }

  const prompt = buildPrompt(pack, story, referenceImages.length);

  const result = await generateImageGemini({
    prompt,
    referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
    aspectRatio: STORY_IMAGE_ASPECT,
  });

  return { buffer: result.buffer, contentType: result.mimeType };
}

function buildPrompt(pack: Pack, story: StoryPage, refCount: number): string {
  const settingBrief = SETTING_BY_KIND[story.kind] ?? SETTING_BY_KIND.custom;

  const lines: string[] = [];

  if (refCount > 0) {
    lines.push(
      `Compose an editorial still-life PHOTOGRAPH for a story-page spread in a recipe-pack guide. Use the ${refCount} reference image${refCount > 1 ? "s" : ""} above as VISUAL STYLE ANCHORS — match their lighting, surface texture, color palette, photographic mood. Do NOT replicate any single dish — create a new SETTING scene that matches the page's theme below.`
    );
  } else {
    lines.push(
      `Compose an editorial still-life PHOTOGRAPH for a story-page in a recipe-pack guide. Magazine-grade composition, cookbook chapter quality.`
    );
  }

  lines.push("");
  lines.push(`STORY-PAGE THEME:`);
  lines.push(`Kind: ${story.kind}`);
  lines.push(`Title: "${story.title}"`);

  lines.push("");
  lines.push(`SETTING TO COMPOSE:`);
  lines.push(settingBrief);

  lines.push("");
  lines.push(`PACK CONTEXT (for tonal anchor only — do NOT show recipes themselves):`);
  lines.push(`- ${pack.title}${pack.subtitle ? ` · ${pack.subtitle}` : ""}`);
  if (pack.category) lines.push(`- Category: ${pack.category}`);

  lines.push("");
  lines.push(`VISUAL RULES:
- Real photograph aesthetic. Shot on 50mm lens at f/2.8. Slight natural film grain. Magazine-grade composition.
- Real ambient window light, gentle natural shadows. NOT studio softbox.
- Imperfect, lived-in feel — slight crumb, fingerprint, asymmetric placement.
- Earthy color palette: warm cream, soft neutral, gentle muted tones. NEVER neon, NEVER oversaturated.
- 16:9 horizontal landscape composition with breathable negative space.
- Photographic depth-of-field with subtle background fall-off.`);

  lines.push("");
  lines.push(`ABSOLUTELY NO:
- No people, no hands, no faces, no body parts, no fingers, no body silhouettes.
- No plated finished meal, no fully-cooked dish as the subject.
- No text, no labels, no logos, no brand names, no packaging, no recipe cards.
- No studio lighting, no harsh contrast, no white-void background.
- No illustration, no cartoon, no painting — photographic style ONLY.
- No oversaturated colours, no plastic-looking food, no unnatural gloss.`);

  return lines.join("\n");
}
