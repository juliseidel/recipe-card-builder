import { callGemini } from "./gemini";
import type { BrandImageStyleOverride } from "@/lib/brands";
import type { InstagramProfile } from "@/lib/integrations/apify";
import {
  BRAND_STYLE_TEMPLATES,
  getStyleTemplate,
  suggestTemplateByKeywords,
  type BrandStyleTemplate,
} from "./brand-style-templates";

// Text-basierter Style-Selector (PR 11). Pivot weg von Gemini Pro Vision,
// das reliable mit 400 INVALID_ARGUMENT geworfen hat (siehe PRs 5-10).
//
// Neuer Flow:
//   1. Bio + Caption-Auszuege + Hashtags + Mood-Wahl in einen Text-Pool
//   2. Gemini Flash (TEXT, nicht Vision): waehlt aus 6 vorgefertigten
//      BRAND_STYLE_TEMPLATES das passendste
//   3. Falls Flash fail't: deterministic Keyword-Match als Fallback
//   4. Template wird 1:1 in brand.imageStyle gespeichert
//
// Vorteile gegenueber Vision:
//   - Robust: kein Image-Format-Issue, kein Payload-Limit, kein Black-Box-
//     responseSchema-Validator
//   - Schnell: ~3-5s Flash statt ~30s Pro Vision
//   - Billig: ~$0.005 statt ~$0.15-0.20 pro Run
//   - Funktioniert IMMER (deterministic Fallback)
//
// Trade-off: nicht so granular wie echte Vision-Analyse. Aber: jeder
// Creator bekommt einen sinnvollen Brand-Style aus einer Bibliothek von
// 6 hand-tuneden Templates, statt auf den generischen Fallback zu fallen.
//
// Bienes Style bleibt im Code — diese Funktion wird NIE fuer Biene
// aufgerufen.

export type StyleSelectionContext = {
  profile: InstagramProfile;
  /** Optional: User-Wahl im Onboarding-Mood-Picker. Schwacher Hint
   *  fuer die Auswahl (z.B. "Cream & Honey" → patisserie/modern-warm). */
  moodId?: string;
};

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    templateId: {
      type: "string",
      enum: BRAND_STYLE_TEMPLATES.map((t) => t.id),
      description:
        "ID des passendsten Brand-Style-Templates fuer diesen Creator.",
    },
    reasoning: {
      type: "string",
      description:
        "Ein Satz auf Deutsch, warum dieses Template passt. Wird ins Logging geschrieben fuer Debugging.",
    },
  },
  required: ["templateId", "reasoning"],
};

const SYSTEM_INSTRUCTION = `Du bist ein Food-Photography-Style-Klassifikator fuer einen Recipe-Card-Generator.

Aufgabe: gegeben Instagram-Profil-Daten eines Food-Creators (Bio, letzte Captions, Hashtags), waehle aus einer Liste von Brand-Style-Templates das, was am besten zum visuellen Stil des Creators passt.

Verfuegbare Templates:
${BRAND_STYLE_TEMPLATES.map(
  (t) =>
    `• "${t.id}" (${t.label}): ${t.description}\n  Passt fuer: ${t.keywords.join(", ")}`
).join("\n")}

Regeln:
- Du siehst KEINE Bilder, nur Text. Leite aus Bio + Caption-Tonalitaet + Hashtags + Themen-Patterns ab, welche Aesthetik wahrscheinlich ist.
- Backen/Desserts/Kuchen-Sprache → "patisserie-warm" oder bei dark themes "dark-moody"
- Fitness/Healthy/Mealprep-Sprache mit modernen Begriffen → "modern-minimal"
- Bowls/Veggies/Smoothies/grünes Essen → "vital-fresh"
- Hausmannskost/Schmoren/Wintergerichte → "cookbook-rustic"
- Schokolade/Kaffee/Tiramisu (dunkel) → "dark-moody"
- Restaurant/Plating/Premium → "editorial-cool"
- Im Zweifel "modern-minimal" — moderner Default fuer heutige Creator

Antworte AUSSCHLIESSLICH im JSON-Schema mit templateId + kurzer reasoning.`;

function buildContextText(profile: InstagramProfile, moodId?: string): string {
  const captionSample = profile.latestPosts
    .slice(0, 8)
    .map((p, i) => `[Post ${i + 1}] ${p.caption.slice(0, 250)}`)
    .filter(Boolean)
    .join("\n---\n");
  const allHashtags = Array.from(
    new Set(profile.latestPosts.flatMap((p) => p.hashtags))
  ).slice(0, 30);

  return [
    `Handle: @${profile.username}`,
    profile.fullName ? `Display Name: ${profile.fullName}` : "",
    profile.followersCount ? `Follower: ${profile.followersCount}` : "",
    "",
    `Bio:`,
    profile.biography || "(leer)",
    "",
    moodId ? `User hat im Onboarding diesen Mood gewählt: "${moodId}"` : "",
    "",
    `Hashtags aus letzten Posts:`,
    allHashtags.length > 0 ? `#${allHashtags.join(" #")}` : "(keine)",
    "",
    `Caption-Auszuege (letzte Posts):`,
    captionSample || "(keine)",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function analyzeCreatorStyleFromText(
  ctx: StyleSelectionContext
): Promise<{
  style: BrandImageStyleOverride;
  templateId: string;
  source: "gemini" | "keyword-fallback";
  reasoning: string;
}> {
  const text = buildContextText(ctx.profile, ctx.moodId);

  // Erst Gemini Flash versuchen — schnell, billig, mit JSON-Schema
  try {
    const result = await callGemini<{ templateId: string; reasoning: string }>({
      prompt: `Klassifiziere folgenden Food-Creator-Account und gib das passendste Brand-Style-Template zurueck.\n\n${text}`,
      schema: RESPONSE_SCHEMA,
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.3,
      maxOutputTokens: 512,
      thinkingBudget: 0,
      retries: 1,
      model: "flash",
    });

    const template = getStyleTemplate(result.templateId);
    if (template) {
      console.log(
        `[style-text] gemini-flash picked "${template.id}" — ${result.reasoning.slice(0, 200)}`
      );
      return {
        style: template.style,
        templateId: template.id,
        source: "gemini",
        reasoning: result.reasoning,
      };
    }
    console.warn(
      `[style-text] gemini returned unknown templateId "${result.templateId}", falling back to keywords`
    );
  } catch (err) {
    console.warn(
      "[style-text] gemini-flash failed, falling back to keyword match:",
      err instanceof Error ? err.message : err
    );
  }

  // Deterministic Fallback: keyword-scoring auf Bio + Captions
  const fallback = pickByKeywords(ctx.profile);
  console.log(
    `[style-text] keyword-fallback picked "${fallback.id}" (${fallback.label})`
  );
  return {
    style: fallback.style,
    templateId: fallback.id,
    source: "keyword-fallback",
    reasoning: `Deterministic keyword match → ${fallback.label}`,
  };
}

function pickByKeywords(profile: InstagramProfile): BrandStyleTemplate {
  const allText = [
    profile.biography,
    profile.fullName ?? "",
    profile.latestPosts.map((p) => p.caption).join(" "),
    profile.latestPosts.flatMap((p) => p.hashtags).join(" "),
  ].join(" ");
  return suggestTemplateByKeywords(allText);
}
