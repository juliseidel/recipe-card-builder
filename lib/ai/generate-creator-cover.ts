import type { Pack } from "@/lib/packs";
import type { Brand } from "@/lib/brands";
import type { Recipe } from "@/lib/recipes";
import {
  generateGeminiImage,
  loadImageAsReference,
  type GeminiImageReference,
} from "./gemini-image";

// Creator-Cover-Generator (v3, Mai 2026)
//
// Ueber-uebernaechste Iteration vom Cover-Bild. Vorgaenger:
//   v1 (Bon-Appetit-Single-Dish, 1:1): wirkte stock-fotomaessig
//   v2 (Lifestyle-Kitchen-Szene mit react-pdf Text-Overlay, 3:4):
//       Bild zeigte "random hands working", null Bezug zum Creator,
//       Text auf separater Layer-Ebene wirkte nicht integriert
//   v3 (HIER): ein einziges Gemini-Bild mit DEM CREATOR drauf, dem
//       Rezept als Kontext, und dem Title als Text DIREKT im Bild
//       generiert. Kein react-pdf Overlay mehr, kein separates Foreword.
//
// User-Intent: das Cover soll EIN komplettes Bild sein, das sofort sagt
// "das ist DAS Kochbuch von DIESEM Creator". Wirkung: editorial
// magazine-cover, nicht Stock-Lifestyle.
//
// Modell: Gemini 2.5 Flash Image (Nano Banana). Vorteil ggü. Flux:
//   - Reference-Image-Support (Brand-Avatar als Anker fuer Creator-
//     Likeness — Gemini ist BEST-IN-CLASS fuer face-preservation)
//   - Text-Rendering native (Doku-Caveat: "not pixel-perfect, but okay
//     fuer kurze Titel" — wir halten Title kurz + sparsam Umlaute)
//   - Multi-Modal Input (Pack-Hero-Recipe als zweite Reference moeglich
//     fuer Recipe-Context — Phase 2)
//
// Ethik / Lizenz: Brand-Owner hat den Account/Avatar selbst angelegt
// (via /new-brand Onboarding). Wir nutzen genau dieses Material fuer
// IHR Cover. Kein Third-Party Face. Memory-Regel "no faces via Flux"
// gilt fuer Flux (schwache Anatomie). Gemini 2.5 ist anders + Use-Case
// ist consensual.

export type CreatorCoverInput = {
  pack: Pack;
  brand: Brand;
  /** Recipes im Pack — werden fuer Thematik-Kontext genutzt. Top-3 reichen
   *  fuer einen guten Prompt-Anchor. */
  recipes?: Recipe[];
};

export type CreatorCoverResult = {
  buffer: Buffer;
  contentType: "image/png" | "image/jpeg";
};

// Helper: pickt 1-3 Recipe-Titel als thematischen Kontext fuer Gemini.
// Wir wollen das Cover-Bild thematisch verankern ("das Pack handelt von X"),
// nicht ein konkretes Recipe nachstellen.
function pickRecipeContext(recipes: Recipe[] | undefined): string {
  if (!recipes?.length) return "various recipes";
  const titles = recipes
    .slice(0, 3)
    .map((r) => r.title?.trim())
    .filter(Boolean);
  if (titles.length === 0) return "various recipes";
  if (titles.length === 1) return titles[0];
  if (titles.length === 2) return `${titles[0]} and ${titles[1]}`;
  return `${titles[0]}, ${titles[1]}, and ${titles[2]}`;
}

// Helper: Pack-spezifischer Szenen-Hint. Gender-neutral formuliert
// (User-Feedback: nicht zu viele "her/she" — auch maennliche Creator
// dabei). Lehnt sich an Pack-Title-Heuristiken an.
function sceneHintFromPack(pack: Pack): string {
  const t = pack.title.toLowerCase();
  if (
    t.includes("airfryer") ||
    t.includes("heißluft") ||
    t.includes("heisluft") ||
    t.includes("fritteuse")
  ) {
    return "stands in a sunlit modern kitchen beside an open airfryer with golden crispy contents, holding the airfryer drawer with confidence";
  }
  if (
    t.includes("backwelt") ||
    t.includes("backen") ||
    t.includes("backwaren") ||
    t.includes("dessert") ||
    t.includes("kuchen")
  ) {
    return "is in a warm baker's kitchen, gently dusting flour over a freshly-baked cake on a wire cooling rack, soft late-morning light";
  }
  if (t.includes("meal") || t.includes("prep") || t.includes("vorkoch")) {
    return "is in an organised kitchen with three glass meal-prep containers in front, arranging them with focused attention, Sunday-prep mood";
  }
  if (t.includes("salat") || t.includes("bowl") || t.includes("veggie")) {
    return "stands at a fresh kitchen island holding a deep ceramic bowl of vibrant greens, bright noon light";
  }
  if (t.includes("snack") || t.includes("naschen") || t.includes("bites")) {
    return "is in a minimal kitchen, placing one small ceramic ramekin of bite-sized snacks on the counter, soft indirect daylight";
  }
  if (t.includes("pasta") || t.includes("nudel")) {
    return "stands in a warm kitchen with a deep bowl of fresh pasta with herbs and cherry tomatoes, parmesan and basil in front, soft daylight";
  }
  if (t.includes("pizza")) {
    return "is in a warm kitchen holding a freshly baked pizza on a wooden board, melted cheese and herbs visible";
  }
  if (
    t.includes("protein") ||
    t.includes("high-protein") ||
    t.includes("highprotein") ||
    t.includes("hähnchen") ||
    t.includes("haehnchen") ||
    t.includes("chicken")
  ) {
    return "is in a modern bright kitchen, holding a plated high-protein dish with grilled chicken and fresh greens, confident pose";
  }
  if (t.includes("frühstück") || t.includes("breakfast") || t.includes("morgen")) {
    return "is at a warm wooden breakfast table with a bowl of porridge and berries, holding a coffee mug, soft golden morning light";
  }
  if (t.includes("abnehm") || t.includes("kalor") || t.includes("schlank")) {
    return "is in a bright modern kitchen holding a fresh bowl of high-protein salad with grilled chicken, fitness-foodie vibe, additional dishes visible";
  }
  if (t.includes("süß") || t.includes("suess") || t.includes("treat") || t.includes("sweet")) {
    return "is in a warm cozy kitchen with a plate of sweet treats — small cheesecakes, berry tarts, decorative serving";
  }
  // Default: generisch "Creator in Küche mit Pack-Hero-Dish"
  return "stands in a warm sunlit kitchen beside a beautifully plated dish from this recipe pack, holding a wooden serving spoon, confident pose";
}

// Helper: lokalisiere das Pack-Thema kurz auf Englisch fuer Gemini.
// Wir uebergeben Title + Tagline auf Deutsch (so wie sie im Bild
// erscheinen sollen), aber die Szenen-Beschreibung bleibt Englisch
// (Gemini versteht beides, Englisch ist robuster bei Bild-Prompts).
function buildCoverPrompt(input: CreatorCoverInput): string {
  const { pack, brand, recipes } = input;
  const sceneHint = sceneHintFromPack(pack);
  const recipeContext = pickRecipeContext(recipes);

  return [
    `A professional cookbook cover photograph in the style of high-end Pinterest/Canva recipe books (Smitten Kitchen, Penguin Random House cookbook covers, Tracksmith editorial).`,
    ``,
    `SUBJECT — 1:1 LIKENESS LOCK:`,
    `The person from the FIRST reference image is the creator (${brand.name}, ${brand.handle}). Reproduce their face, hairstyle, hair colour, eye colour, body type, and overall appearance EXACTLY as in the reference — same person, not a similar-looking one. They may be in a different pose, in a different setting, wearing different clothes — but FACE and IDENTITY must match the reference 1:1. This applies regardless of gender: male creator stays male, female creator stays female. Do not stereotype, do not feminize/masculinize beyond the reference.`,
    ``,
    `SCENE:`,
    `The creator ${sceneHint}. The ADDITIONAL reference images are real dishes from this pack — use them as visual anchor for plating, food colours, lighting mood. The dish in the foreground should belong to the same visual universe (NOT a literal copy).`,
    ``,
    `Pack theme: "${pack.title}" — ${pack.tagline}. Recipes include: ${recipeContext}.`,
    ``,
    `═══════════════ COVER DESIGN — CRITICAL ═══════════════`,
    ``,
    `This is a FULL COOKBOOK COVER with integrated typography and decorative design elements layered over the photo. NOT just a photo with title — a composed cover layout like Pinterest/Canva cookbook covers.`,
    ``,
    `TYPOGRAPHY (rendered INSIDE the image, perfect German spelling):`,
    `  1. MAIN TITLE: "${pack.title}" — large, elegant serif font (think Fraunces, Playfair, Cormorant). Place upper-left or centre-left. Use a TWO-TONE colour treatment: one word in cream-white, another word in a soft accent colour (dusty rose / warm terracotta / sage green / honey-amber — pick what matches the food). Render with high precision: every German Umlaut (ä, ö, ü, ß) must be pixel-perfect.`,
    pack.subtitle ? `  2. SUBTITLE: "${pack.subtitle}" — smaller sans-serif (Inter, Helvetica), below the title, with a thin horizontal divider line between title and subtitle.` : "",
    `  3. CIRCULAR BADGE: place a soft cream-coloured round badge somewhere in the composition (typically lower-third). Inside: 2-3 short German words like "Einfach. Lecker. Von Herzen." or "Schnell & kalorienbewusst" — fitting the pack theme. Decorate with a tiny heart or small sprig.`,
    `  4. BOTTOM STRIP: a thin band at the very bottom with 2-3 small feature pills/icons (e.g. clock-icon + "Schnell zubereitet", leaf-icon + "Leicht & kalorienbewusst", heart-icon + "Mit Liebe gemacht"). Use simple line-icons.`,
    `  5. OPTIONAL TOP ACCENT: a small decorative element above the title — a hand-drawn heart, a tiny bee, a sprig of herbs, a small brushstroke. Subtle, not loud.`,
    ``,
    `LAYOUT PRINCIPLE:`,
    `Think Cookbook-Cover-Design with multiple visual layers — photo as background, typography elements layered over it with small whitespace gaps so each text-element breathes. Food + creator stay clearly visible, the text complements without dominating.`,
    ``,
    `IMAGE QUALITY:`,
    `Real photography style — soft natural daylight, warm tones, slight film grain. Real human skin (pores, natural texture, not airbrushed plastic). Real food (no glossy plastic). Professional but not over-stylized — should feel like a real published cookbook cover, not AI-generated.`,
    ``,
    `HARD CONSTRAINTS:`,
    `  - GERMAN TEXT PERFECTION: every word from title/subtitle/badge MUST be spelled correctly with intact German diacritics. NO misspellings, NO broken Umlauts (no "Eiwes reiche" instead of "Eiweißreiche", no "oeh" instead of "öl"). Text rendering quality is the most important quality bar for this cover.`,
    `  - NO logos or brand names beyond the handle.`,
    `  - NO oversaturated colours, no neon, no AI-art gloss, no impossibly perfect symmetric face.`,
    `  - 3:4 portrait orientation.`,
  ]
    .filter(Boolean)
    .join("\n");
}

// Lädt den Creator-Avatar als Reference-Image-Buffer. Avatar kommt
// typischerweise als URL (Supabase Storage) oder als public-Pfad
// (/brands/biene/avatar.jpg). Bei fehlendem Avatar gibt's null —
// Caller entscheidet ob er ohne Creator-Reference generiert (less
// personal) oder die Generation skippt.
async function loadCreatorAvatar(
  brand: Brand
): Promise<GeminiImageReference | null> {
  if (!brand.avatar) return null;
  return loadImageAsReference(brand.avatar);
}

// Lädt Recipe-Hero-Bilder als zusätzliche Reference-Inputs für Gemini.
// User-Wunsch (2026-05-24): "die Bilder der einzelnen Rezepte mitgegeben
// werden, und dann muss da ein passendes Bild erstellt werden". Mit
// Recipe-Heroes versteht Gemini die VISUELLE Welt des Packs (Farben,
// Plating-Stil, Food-Atmosphäre) und nicht nur die Title-Worte. Max 3
// Heroes — mehr ist sowohl prompt-noise als auch Latenz/Cost.
async function loadRecipeHeroes(
  recipes: Recipe[] | undefined
): Promise<GeminiImageReference[]> {
  if (!recipes?.length) return [];
  const heroUrls = recipes
    .map((r) => r.hero)
    .filter((u): u is string => Boolean(u?.trim()))
    .slice(0, 3);
  const refs = await Promise.all(heroUrls.map((u) => loadImageAsReference(u)));
  return refs.filter((r): r is GeminiImageReference => r !== null);
}

export async function generateCreatorCover(
  input: CreatorCoverInput
): Promise<CreatorCoverResult> {
  // Parallel laden: Avatar (Person-Anker) + bis zu 3 Recipe-Heroes
  // (visueller Pack-Anker). Beide sind optional — fehlende References
  // führen NICHT zum Fail, Gemini generiert dann eben "generischer".
  const [avatarRef, recipeRefs] = await Promise.all([
    loadCreatorAvatar(input.brand),
    loadRecipeHeroes(input.recipes),
  ]);

  // References-Order ist wichtig: Avatar zuerst → Gemini liest das als
  // primären Subject-Anker (die Person), Recipe-Heroes als sekundäre
  // Style/Mood-Anker (das visuelle Universum des Packs).
  const references: GeminiImageReference[] = [];
  if (avatarRef) references.push(avatarRef);
  references.push(...recipeRefs);

  const prompt = buildCoverPrompt(input);

  const result = await generateGeminiImage({
    prompt,
    references,
    // 3:4 Portrait passt fast verlustfrei in A4 1:1.414 (objectFit cover
    // beschneidet marginal Top/Bottom). Falls Aspect-Switch noetig,
    // wechseln wir auf 4:5 oder 9:16 — beides supported.
    aspectRatio: "3:4",
    retries: 1,
  });

  return {
    buffer: result.buffer,
    contentType:
      result.mimeType === "image/jpeg" ? "image/jpeg" : "image/png",
  };
}
