import type { Recipe } from "@/lib/recipes";
import type { Pack } from "@/lib/packs";
import type { Brand } from "@/lib/brands";
import { callGemini } from "./gemini";
import {
  formatVoiceProfileForPrompt,
  formatCaptionFewShot,
  ensureBrandVoiceProfile,
} from "./analyze-voice-profile";
import { findBannedPhrases, buildAvoidHint } from "./banned-phrases";

// Generates a short "Creator's Story" pull-quote for the recipe card —
// die kurze 2-3-Saetze-Einleitung, die auf sparen Karten (≤10 Zutaten)
// im Editorial/Patisserie-Layout als Pull-Quote angezeigt wird.
//
// Brand-agnostisch (v2, Mai 2026): nutzt Voice-Profil statt hardcoded
// Biene-Wendungen. Funktioniert fuer jeden Creator mit eigenem Stil.
//
// Pipeline ist leichter als Pack-Meta:
//   - Voice-Profile + Few-Shot in System-Instruction
//   - Single-Shot Generation (Text ist kurz — Multi-Candidate Overkill)
//   - Banned-Phrases-Check, Retry mit AVOID-Hint bei Hit

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    story: {
      type: "string",
      description:
        "Eine sehr kurze persoenliche Mini-Story (2-3 Saetze, max 220 Zeichen) zum Rezept, in der Stimme der Creatorin. KEINE Anfuehrungszeichen, Hashtags, Emojis, Em-Dashes. KEIN 'Hi'/'Hey' am Anfang. Direkt in Geschmack/Stimmung/Anlass einsteigen.",
    },
  },
  required: ["story"],
};

function buildSystemInstruction(brand: Brand): string {
  const voiceBlock = formatVoiceProfileForPrompt(brand.voiceProfile, brand.name);
  const fewShotBlock = formatCaptionFewShot(brand.voiceProfile);

  return `Du schreibst Mini-Stories fuer Rezeptkarten von ${brand.name} (${brand.handle}). Diese Story ist eine 2-3-Saetze-Einleitung als Pull-Quote auf einer Recipe-Card.

Brand-Kontext:
- Name: ${brand.name}
- Bio: ${brand.bio}
- Tagline: ${brand.tagline}

${voiceBlock}

${fewShotBlock}

GENERATIONS-REGELN:
- Schreibe in der Stimme von ${brand.name} — nicht generisch
- KEINE Werbesprache, keine Floskeln ("genussvoll", "koestlich", "perfekt fuer")
- KEINE Uebertreibungen ("absolut traumhaft", "unwiderstehlich", "sensationell")
- KEINE Hashtags, Emojis, Anfuehrungszeichen, Em-Dashes (—)
- KEIN "Hi"/"Hey" am Anfang — direkt rein
- Sinnlich-konkret statt abstrakt: nicht "lecker", sondern "schmilzt auf der Zunge", "in 15 Min fertig"
- Manchmal eine kleine Story / Anlass: "perfekt fuer Sonntagvormittag", "wenn die Erdbeeren reif sind"

LAENGE: 2-3 kurze Saetze, max 220 Zeichen insgesamt. Lieber zu kurz als zu lang.

FORM:
- Keine Begruessung, keine Anrede — direkt in die Story
- Aktivsprache, Praesens
- Beziehe dich auf Zutaten/Methode wenn sinnvoll, aber NICHT als Aufzaehlung
- Manchmal: ein konkreter Sinneseindruck zu Beginn

Antworte AUSSCHLIESSLICH im JSON-Schema.`;
}

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

function cleanStory(raw: string): string {
  let story = (raw ?? "").trim();
  story = story.replace(/^["'„«]+|["'"»]+$/g, "");
  story = story.replace(/\s*[—–]\s*/g, ", "); // Em/En-Dashes → Komma
  story = story.replace(/\s+/g, " ");
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

/**
 * Generate a short, on-brand pull-quote story for a recipe card.
 * Brand-agnostic — nutzt Voice-Profil falls vorhanden, fallback auf
 * Bio/Tagline-basierte Generic-Defaults. Throws on Gemini failure.
 */
export async function generateStory(
  recipe: Recipe,
  pack: Pack,
  brand: Brand
): Promise<string> {
  // Lazy-Backfill — wenn Brand kein Voice-Profil hat, lazy aus DB ableiten
  const brandWithVoice = (await ensureBrandVoiceProfile(brand)) ?? brand;
  const brandBanned = brandWithVoice.voiceProfile?.bannedPhrases ?? [];

  const systemInstruction = buildSystemInstruction(brandWithVoice);
  const prompt = [
    `Schreibe eine kurze persoenliche Mini-Story fuer die folgende Rezeptkarte.`,
    `Wichtig: Die Story muss zur konkreten Karte passen (Zutaten/Methode/Anlass), nicht generisch.`,
    ``,
    formatRecipeForPrompt(recipe, pack, brandWithVoice),
    ``,
    `Antworte nur als JSON nach Schema, ohne Erklaerung.`,
  ].join("\n");

  // Pass 1: normale Generation
  let result: { story: string };
  try {
    result = await callGemini<{ story: string }>({
      prompt,
      schema: RESPONSE_SCHEMA,
      systemInstruction,
      temperature: 0.85,
      maxOutputTokens: 512,
      thinkingBudget: 0,
      retries: 2,
    });
  } catch (err) {
    throw err;
  }

  let story = cleanStory(result.story);
  let hits = findBannedPhrases(story, brandBanned);

  // Retry-Pass mit explizitem AVOID-Hint bei Banned-Hit
  if (hits.length > 0) {
    const avoidHint = buildAvoidHint(brandBanned);
    const observedFloskel = hits.map((h) => h.phrase).slice(0, 6);
    try {
      const retry = await callGemini<{ story: string }>({
        prompt: `${prompt}\n\n${avoidHint}\n\nDein vorheriger Versuch hatte diese Probleme: ${observedFloskel.map((p) => `"${p}"`).join(", ")}. Schreibe es komplett anders.`,
        schema: RESPONSE_SCHEMA,
        systemInstruction,
        temperature: 0.75,
        maxOutputTokens: 512,
        thinkingBudget: 0,
        retries: 1,
      });
      const retryClean = cleanStory(retry.story);
      const retryHits = findBannedPhrases(retryClean, brandBanned);
      // Nur uebernehmen wenn Retry tatsaechlich besser (weniger Hits)
      if (retryHits.length < hits.length) {
        story = retryClean;
        hits = retryHits;
      }
    } catch {
      // Retry-Fail → wir behalten Pass-1-Output mit Banned-Hits.
      // Besser als gar nichts, und der Caller kann nach Hits filtern wenn noetig.
    }
  }

  if (process.env.NODE_ENV !== "production" && hits.length > 0) {
    console.log(
      `[generate-story] residual banned hits for ${recipe.slug}: ${hits.map((h) => h.phrase).join(", ")}`
    );
  }

  return story;
}
