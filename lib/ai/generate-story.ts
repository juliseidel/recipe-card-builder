import type { Recipe } from "@/lib/recipes";
import type { Pack } from "@/lib/packs";
import type { Brand } from "@/lib/brands";
import { callGemini } from "./gemini";

// Schema is intentionally tiny: one short string. We avoid arrays / nested
// objects so Gemini stays focused on tone, not structure.
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    story: {
      type: "string",
      description:
        "Eine sehr kurze persönliche Mini-Story (2-3 Sätze, max. 220 Zeichen) zu diesem Rezept, im Stil von Biene (@bienesfitlife). Keine Anführungszeichen, keine Hashtags, kein 'Hi', kein 'Hey'. Direkt in den Geschmack/Stimmung/Anlass einsteigen.",
    },
  },
  required: ["story"],
};

const SYSTEM_INSTRUCTION = `Du schreibst Mini-Stories für Rezeptkarten von Biene (@bienesfitlife) — einer deutschen Creator-Stimme: 819K Instagram, "abnehmen ohne Verzicht ohne Hungern", warm, persönlich, "deine Freundin am Küchentisch".

Tonalität (extrem wichtig):
• warm, weiblich, persönlich — wie zu einer Freundin
• keine Werbesprache, keine Floskeln ("genussvoll", "köstlich", "perfekt für")
• KEINE Übertreibungen ("absolut traumhaft", "unwiderstehlich")
• KEINE Hashtags, KEINE Emojis, KEINE Anführungszeichen, KEIN "Hi"/"Hey"
• Bienes typische Wörter: "fluffig", "cremig", "schaumig", "ohne Backen", "in 15 Min", "Mealprep", "ohne Zucker"
• Sinnlich-konkret statt abstrakt: nicht "lecker", sondern "schmilzt auf der Zunge"
• Manchmal eine kleine Story / Anlass: "perfekt für Sonntagvormittag", "wenn die Erdbeeren reif sind"

Länge: 2-3 kurze Sätze, max. 220 Zeichen insgesamt. Lieber zu kurz als zu lang.

Form:
• Kein Begrüßung, keine Anrede — direkt in die Story rein
• Aktivsprache, Präsens
• Beziehe dich auf die Zutaten/Methode wenn sinnvoll, aber nicht als Aufzählung
• Manchmal: ein konkreter Sinneseindruck zu Beginn

Beispiele für gute Stories:
• "Cremig wie Pudding, aber kommt komplett ohne Zucker aus. Genau das richtige Frühstück für Tage, an denen man Lust auf was Warmes hat — in 10 Minuten ist die Schale fertig."
• "Mit nur 4 Zutaten und 15 Minuten Backzeit. Außen knusprig, innen fluffig — meine Lieblings-Mealprep für die ganze Woche."
• "Wenn ich nach dem Training was Süßes brauche, mache ich diese in der Mikrowelle. 30 Sekunden und der Schoko-Pudding ist warm und cremig."

Beispiele für SCHLECHTE Stories (nie so):
• "Dieses köstliche Rezept ist perfekt für …" (Werbesprache)
• "Hi ihr Lieben! Heute teile ich …" (Anrede)
• "Absolut traumhaft cremig und unwiderstehlich!!" (Übertreibung)
• "🤍 fluffig & cremig" (Emoji)`;

function formatRecipeForPrompt(
  recipe: Recipe,
  pack: Pack,
  brand: Brand
): string {
  const ingredients = recipe.ingredients
    .slice(0, 12)
    .map((i) => `  • ${i.amount} ${i.name}`)
    .join("\n");
  const more =
    recipe.ingredients.length > 12
      ? `\n  • … und ${recipe.ingredients.length - 12} weitere`
      : "";
  const tagsLine = recipe.tags?.length
    ? `Tags: ${recipe.tags.join(", ")}`
    : "";
  const subtitleLine =
    recipe.subtitle && recipe.subtitle !== recipe.title
      ? `Untertitel: ${recipe.subtitle}`
      : "";
  return [
    `Rezept: ${recipe.title}`,
    subtitleLine,
    `Pack: ${pack.title} (${pack.tagline})`,
    `Pack-Stimmung: ${pack.description}`,
    `Brand: ${brand.name} (${brand.handle})`,
    ``,
    `Zutaten:`,
    ingredients + more,
    ``,
    `Zubereitungszeit: ${recipe.prepTime + (recipe.cookTime ?? 0)} Min`,
    `Portionen: ${recipe.servings}`,
    `Schwierigkeit: ${recipe.difficulty}`,
    `Kalorien: ${recipe.nutrition.kcal} kcal`,
    tagsLine,
  ]
    .filter(Boolean)
    .join("\n");
}

// Generate a short, on-brand "Bienes Story" for a recipe. Returns a plain
// string ready to drop into recipe.description. Throws on Gemini failure —
// caller decides whether to fall back to pack.description.
export async function generateStory(
  recipe: Recipe,
  pack: Pack,
  brand: Brand
): Promise<string> {
  const prompt = [
    `Schreibe eine kurze persönliche Mini-Story für die folgende Rezeptkarte.`,
    `Wichtig: Die Story muss zur konkreten Karte passen (Zutaten / Methode / Anlass), nicht generisch.`,
    ``,
    formatRecipeForPrompt(recipe, pack, brand),
    ``,
    `Antworte nur als JSON nach Schema, ohne Erklärung.`,
  ].join("\n");

  const result = await callGemini<{ story: string }>({
    prompt,
    schema: RESPONSE_SCHEMA,
    systemInstruction: SYSTEM_INSTRUCTION,
    // Higher temp than micros — we want voice/personality, not deterministic
    // extraction. But not so high that we get nonsense.
    temperature: 0.85,
    maxOutputTokens: 512,
    thinkingBudget: 0,
    retries: 2,
  });

  // Clean up: trim, strip stray quotes, collapse whitespace, hard-cap length
  let story = (result.story ?? "").trim();
  story = story.replace(/^["'„«]+|["'"»]+$/g, "");
  story = story.replace(/\s+/g, " ");
  // Hard cap so we never overflow the pull-quote layouts
  if (story.length > 260) {
    const cut = story.slice(0, 260);
    const lastDot = Math.max(
      cut.lastIndexOf("."),
      cut.lastIndexOf("!"),
      cut.lastIndexOf("?")
    );
    story = lastDot > 100 ? cut.slice(0, lastDot + 1) : cut + "…";
  }
  return story;
}
