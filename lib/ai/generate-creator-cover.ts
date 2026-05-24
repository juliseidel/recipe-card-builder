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

// Helper: Pack-spezifischer Szenen-Hint. Lehnt sich an die alten
// styleFromTitle-Heuristiken an (Airfryer, Backen, Snacks, Meal-Prep)
// — aber jetzt mit Person-im-Frame statt nur Items.
function sceneHintFromPack(pack: Pack): string {
  const t = pack.title.toLowerCase();
  if (
    t.includes("airfryer") ||
    t.includes("heißluft") ||
    t.includes("heisluft") ||
    t.includes("fritteuse")
  ) {
    return "standing in a sunlit modern kitchen beside an open airfryer with golden crispy contents, hands holding the airfryer drawer with confidence";
  }
  if (
    t.includes("backwelt") ||
    t.includes("backen") ||
    t.includes("backwaren") ||
    t.includes("dessert") ||
    t.includes("kuchen")
  ) {
    return "in a warm baker's kitchen, hands gently dusting flour over a freshly-baked cake on a wire cooling rack, soft late-morning light";
  }
  if (t.includes("meal") || t.includes("prep") || t.includes("vorkoch")) {
    return "in an organised kitchen with three glass meal-prep containers in front, gently arranging the second container, Sunday-prep mood";
  }
  if (t.includes("salat") || t.includes("bowl") || t.includes("veggie")) {
    return "at a fresh kitchen island with a deep ceramic bowl of vibrant greens, mid-action lifting a wooden serving spoon, bright noon light";
  }
  if (t.includes("snack") || t.includes("naschen") || t.includes("bites")) {
    return "in a minimal kitchen, gently placing one small ceramic ramekin of bite-sized snacks on the counter, soft indirect daylight";
  }
  if (
    t.includes("protein") ||
    t.includes("high-protein") ||
    t.includes("highprotein")
  ) {
    return "in a modern bright kitchen, beside a plated high-protein dish, holding a wooden serving spoon, confident editorial pose";
  }
  if (t.includes("frühstück") || t.includes("breakfast") || t.includes("morgen")) {
    return "at a warm wooden breakfast table with a bowl of porridge and berries, holding a coffee mug, soft golden morning light";
  }
  // Default: generischer "Creator in der Kueche mit Pack-Hero-Dish"
  return "in a warm sunlit kitchen, beside a beautifully plated dish from this recipe pack, holding a wooden serving spoon, confident editorial pose";
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
    `An editorial cookbook cover photograph in the style of Bon Appétit or Phaidon.`,
    `The person from the first reference image (${brand.name}, ${brand.handle}) is shown ${sceneHint}.`,
    `Use the person's face, hair, and general appearance from the reference — recognisable as ${brand.name}.`,
    ``,
    `Pack theme: "${pack.title}" — ${pack.tagline}.`,
    `Visual hint: this pack contains recipes like ${recipeContext}.`,
    ``,
    `IMPORTANT — text composition: render the following text DIRECTLY INSIDE the image, integrated as elegant cookbook cover typography:`,
    `  - Large title: "${pack.title}"`,
    pack.subtitle ? `  - Smaller italic subtitle below: "${pack.subtitle}"` : "",
    `  - Bottom corner small text: "${brand.handle}"`,
    `Use a warm, off-white text color with subtle shadow for readability. Title in elegant serif typography. Place text in a calm area of the composition (typically bottom-left third) so the person and dish stay visually prominent.`,
    ``,
    `Lighting: soft natural daylight from a side window, intimate magazine feel, slight film grain.`,
    `Composition: 3:4 portrait, person edge-positioned, scene atmosphere lived-in (not staged), warm cream/honey colour palette unless the pack theme suggests otherwise.`,
    `NO additional text beyond what's specified. NO logos, watermarks, brand names other than the handle. Real food only — no plastic-looking renders.`,
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

export async function generateCreatorCover(
  input: CreatorCoverInput
): Promise<CreatorCoverResult> {
  const avatarRef = await loadCreatorAvatar(input.brand);

  // Fallback bei fehlendem Avatar: Generation laeuft ohne Person-Reference,
  // Gemini erfindet eine generische Figur. Weniger personal, aber besser
  // als gar kein Cover. Caller (enrich-Route) sollte das nicht als Fail
  // werten.
  const references: GeminiImageReference[] = [];
  if (avatarRef) references.push(avatarRef);

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
