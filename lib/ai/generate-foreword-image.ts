import sharp from "sharp";
import type { Pack } from "@/lib/packs";
import { generateImageGemini } from "./gemini-image-generation";
import { fetchHeroBuffers } from "./generate-foreword-collage";

// Foreword-Image-Generator (v3, Mai 2026).
//
// v3-Wechsel:
//   - Flux 2 Pro mit Still-Life-Prompt-Templates → Nano Banana (Gemini 2.5
//     Flash Image) mit Recipe-Heroes als Style-Anchor.
//   - Statt Pack-spezifischer hand-getunter Stillleben-Rezepte (PACK_STYLES,
//     styleFromTitle, inferStyleViaGemini) lernen wir den visuellen Stil
//     direkt aus den echten Recipe-Heroes des Packs. Damit ist das Vorwort-
//     Bild garantiert mit den Recipe-Cards visuell verwandt — kein
//     generisches Stock-Stillleben mehr.
//
// Logik:
//   1. Caller liefert 0-3 Recipe-Hero-URLs (Brand-DNA-Heroes, keine
//      Reel-Cover-Placeholder).
//   2. Wir laden bis zu 3 davon als data URIs.
//   3. Nano Banana bekommt die Refs ZUERST in der Parts-Liste, dann den
//      Prompt: "Komponiere ein Setting-Stillleben, das aussieht als kaeme
//      es aus derselben Welt wie diese Bilder."
//   4. Bei 0 Heroes: kein Ref, nur Pack-Kontext-Prompt. Output wird
//      generischer aussehen, ist aber immer noch kohaerent.

export type ForewordImageOpts = {
  /** 0-3 Recipe-Hero-URLs als Style-Anchor. Caller filtert vorher auf
   *  Brand-DNA-Heroes (kein Reel-Cover-Placeholder). */
  heroUrls?: string[];
  /** Optional fuer deterministische Tests. Aktuell von Nano Banana
   *  nicht direkt unterstuetzt — Field bleibt fuer Future-Proofing. */
  seed?: number;
};

// Aspect-Hint passt zur quadratischen Layout-Vorlage (Patisserie-Polaroid,
// Dashboard-Tile, Restaurant-Hero etc.). Wenn ein Layout Portrait/Landscape
// braucht, kann der Caller das ueber aspectRatio explizit setzen.
const FOREWORD_ASPECT = "1:1" as const;

// Caps fuer die Refs — mehr als 3 verwirrt Gemini eher als zu helfen, die
// kollektive Stil-Anchor-Logik wird unscharf.
const MAX_REFS = 3;

export type ForewordImageResult = {
  buffer: Buffer;
  /** MIME-Type aus dem Generator. Nano Banana liefert oft PNG, manchmal
   *  JPEG. Caller MUSS das beim Upload + File-Extension nutzen — sonst
   *  rendert react-pdf das Bild nicht (siehe cover-outro-fullbleed v9
   *  Bug: hardcoded image/jpeg + PNG-Bytes = silent render fail). */
  contentType: string;
};

/**
 * Generates the foreword still-life via Nano Banana, optionally style-
 * anchored by 1-3 Recipe-Heroes. Throws on Gemini failure — caller
 * decides retry/skip.
 */
export async function generateForewordImage(
  pack: Pack,
  opts: ForewordImageOpts = {}
): Promise<ForewordImageResult> {
  const heroUrls = (opts.heroUrls ?? []).slice(0, MAX_REFS);

  // Refs laden — fail-tolerant. Wenn Heroes nicht ladbar sind, machen wir
  // trotzdem ein Bild, nur ohne Refs. Verbessert die Ausfallsicherheit
  // gegenueber CDN-Issues.
  let referenceImages: string[] = [];
  if (heroUrls.length > 0) {
    try {
      const buffers = await fetchHeroBuffers(heroUrls);
      referenceImages = buffers.map(
        (buf) => `data:image/jpeg;base64,${buf.toString("base64")}`
      );
    } catch (err) {
      console.warn(
        "[foreword-image] hero load failed, generating without refs:",
        err instanceof Error ? err.message : err
      );
    }
  }

  const prompt = buildSettingPrompt(pack, referenceImages.length);

  const result = await generateImageGemini({
    prompt,
    referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
    aspectRatio: FOREWORD_ASPECT,
  });

  // Sharp-Konversion zu JPEG. Nano Banana liefert oft PNG, aber der
  // pack-forewords-Bucket ist mit allowedMimeTypes=["image/jpeg"]
  // erstellt worden (Flux-Stillleben-Zeit) und nimmt nur JPEG. Statt
  // den Bucket umzukonfigurieren, normalisieren wir hier — gleicher
  // Vorteil: alle Foreword-Bilder haben einheitliches Format,
  // PDF-Renderer hat keinen MIME-Type-Mismatch-Bug mehr.
  const jpegBuffer = await sharp(result.buffer)
    .jpeg({ quality: 92, mozjpeg: true, progressive: true })
    .toBuffer();

  return { buffer: jpegBuffer, contentType: "image/jpeg" };
}

// ─── Prompt-Builder ──────────────────────────────────────────────────────

function buildSettingPrompt(pack: Pack, refCount: number): string {
  const lines: string[] = [];

  if (refCount > 0) {
    lines.push(
      `Compose an editorial still-life PHOTOGRAPH that opens a recipe-pack chapter. Use the ${refCount} reference image${refCount > 1 ? "s" : ""} above as VISUAL STYLE ANCHORS — match their lighting, surface texture, color palette, and overall photographic mood. Do NOT replicate any single dish from the references — create a NEW setting scene that feels thematically related, like the same photographer shot the cover page of a cookbook chapter containing these recipes.`
    );
  } else {
    lines.push(
      `Compose an editorial still-life PHOTOGRAPH that opens a recipe-pack chapter. Cookbook-quality, magazine-grade composition, in the style of a Phaidon or Bon Appetit chapter opener.`
    );
  }

  // Pack-Kontext — sag Gemini was fuer ein Pack das ist
  lines.push("");
  lines.push(`PACK CONTEXT:`);
  lines.push(`Title: "${pack.title}"`);
  if (pack.subtitle) lines.push(`Subtitle: "${pack.subtitle}"`);
  if (pack.tagline) lines.push(`Tagline: "${pack.tagline}"`);
  if (pack.category) lines.push(`Category: ${pack.category}`);
  if (pack.description) {
    // Description kann mehrzeilig sein — auf 220 chars trimmen, sonst dominiert
    // sie den Prompt unnoetig.
    const trimmed = pack.description.replace(/\s+/g, " ").trim().slice(0, 220);
    lines.push(`Description: ${trimmed}`);
  }

  lines.push("");
  lines.push(`WHAT TO SHOW:
A thematic still-life setting — ingredients, utensils, surfaces, fabrics — that visually opens this pack. Pick 2-4 elements that THEMATICALLY anchor the pack (don't try to show everything). Examples by pack-type:
- Baking pack → vintage measuring cups, soft drift of flour, vanilla pods, worn enamel scoop on a pale wooden baker's table
- Salads/Bowls → fresh greens, citrus halves, ceramic bowl with wooden spoon resting on rim, linen runner
- Meal-Prep → glass containers in a row, small notebook + pen, organised grey concrete counter
- Snacks/Quick → single small ramekin with berries, tiny silver spoon, lots of negative space
- BBQ/Grill → tongs, fresh herbs, charred wooden board, single lemon half
- Dessert/Sweet → vintage cake tin tilted, dusting of powdered sugar, single fresh fig or berry cluster
- Hearty/Klassik → cast-iron pan with folded honey-colored kitchen towel, wooden spoon, herbs`);

  lines.push("");
  lines.push(`VISUAL RULES:
- Real photograph aesthetic. Shot on 50mm lens at f/2.8. Slight natural film grain. Magazine-grade composition with breathable negative space.
- Real ambient window light from one side, gentle natural shadows. NOT studio softbox.
- Imperfect, lived-in feel — slight crumb, fingerprint, asymmetric placement. Like someone just stepped away from the table.
- Natural matte surfaces. Earthy color palette: warm cream, soft neutral, gentle muted tones. NEVER neon, NEVER oversaturated.
- Photographic depth-of-field with subtle background fall-off. Camera angle: overhead 75-90° OR three-quarter 30-40°, depending on the elements.`);

  lines.push("");
  lines.push(`ABSOLUTELY NO:
- No people, no hands, no faces, no body parts, no fingers.
- No plated finished meal, no portion ready to eat, no fully-cooked dish as the subject.
- No text, no labels, no logos, no brand names, no packaging, no recipe cards.
- No studio lighting, no fluorescent light, no harsh contrast, no white-void background.
- No illustration, no cartoon, no painting — photographic style ONLY.
- No oversaturated colours, no plastic-looking food, no unnatural gloss.`);

  return lines.join("\n");
}

// ─── Backwards-Compat-Exports ────────────────────────────────────────────
// Der frueher exportierte buildForewordImagePrompt + Style-Type sind weg —
// Nano-Banana-Pipeline arbeitet direkt mit Refs + Inline-Prompt, kein
// separater Style-Builder mehr noetig.
//
// Wenn ein Script (scripts/generate-foreword-assets.ts) den alten Audit-
// Hook braucht: einfach buildSettingPrompt direkt importieren / re-exposen.
// Aktuell sehen wir keine externen Consumer mehr.
export { buildSettingPrompt as buildForewordImagePrompt };
