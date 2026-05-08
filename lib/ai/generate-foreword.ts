import type { Pack } from "@/lib/packs";
import type { Brand } from "@/lib/brands";
import { callGemini } from "./gemini";

// Schema-driven Pack-Vorwort. Three short fields so the renderer can lay
// them out without parsing one big string. Greeting kicks off the page,
// story sits as the body, signature closes it. We split them in the
// schema (not in post-processing) because Gemini lays out structured
// fields more reliably than free-form blocks of "first sentence as
// greeting, rest as story" — which is what the recipe-story generator
// has to do, and where it occasionally trips over its own rules.
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    greeting: {
      type: "string",
      description:
        "Direkte, persönliche Anrede in Bienes Stimme. 4-7 Wörter. Z.B. 'Hi, ich bin Biene.', 'Hey du.', 'Schön, dass du da bist.'. KEINE Hashtags, KEINE Emojis, KEINE Anführungszeichen.",
    },
    story: {
      type: "string",
      description:
        "Pack-spezifisches Vorwort, 3-5 kurze Sätze, max. 380 Zeichen. Erklärt persönlich, warum dieses Pack besonders ist und für wen es gedacht ist. Im Bienes-Ton: warm, du-Form, sinnlich-konkret. Bezieht sich konkret auf die Pack-Inhalte (z.B. 'Mehrschicht-Torten', 'XL-Wraps'), nicht generisch. KEINE Werbesprache, KEINE Hashtags, KEINE Emojis, KEINE Anführungszeichen.",
    },
    signoff: {
      type: "string",
      description:
        "Kurzer Schluss-CTA, 4-9 Wörter. Lädt zum Stöbern/Backen/Probieren ein. Z.B. 'Schnapp dir einen Kaffee und blätter durch.' oder 'Lass dich inspirieren — ich freu mich.'. KEIN 'Deine Biene' (das wird separat gerendert). KEINE Hashtags, KEINE Emojis.",
    },
  },
  required: ["greeting", "story", "signoff"],
};

const SYSTEM_INSTRUCTION = `Du schreibst Pack-Vorworte für die Recipe-Cards von Biene (@bienesfitlife) — einer deutschen Creator-Stimme: 819K Instagram, "abnehmen ohne Verzicht ohne Hungern", warm, persönlich, "deine Freundin am Küchentisch".

Tonalität (extrem wichtig):
• warm, weiblich, persönlich — wie zu einer Freundin
• du-Form durchgehend
• keine Werbesprache, keine Floskeln ("genussvoll", "köstlich", "perfekt für jeden Anlass")
• KEINE Übertreibungen ("absolut traumhaft", "unwiderstehlich", "sensationell")
• KEINE Hashtags, KEINE Emojis, KEINE Anführungszeichen
• Bienes typische Wörter wenn passend: "fluffig", "cremig", "schaumig", "ohne Backen", "in 15 Min", "Mealprep", "ohne Zucker", "WPF"
• Sinnlich-konkret statt abstrakt: nicht "lecker", sondern "schmilzt auf der Zunge", "knusprig außen, fluffig innen"
• Eine kleine persönliche Note: "das ist meine Paradedisziplin", "ich back das mindestens einmal die Woche"

Was ein Pack-Vorwort tun muss:
• Den Pack-Charakter in 3-5 Sätzen einfangen
• Konkrete Inhalte erwähnen (z.B. Mehrschicht-Torten, XL-Salate, Mealprep-Heroes — je nach Pack)
• Sagen, für WEN/WANN das Pack gedacht ist (Sonntagvormittag, nach dem Training, fürs Büro)
• Einladen zum Stöbern, ohne pushy zu sein

Beispiele für GUTE Pack-Vorworte (nimm dir Stil, schreib aber pack-spezifisch neu):

Backwelt-Style:
"Backen ist meine Paradedisziplin. Hier sind 10 meiner liebsten Werke aus den Reels — Schoko-Biskuitrolle, Cheesecake, Erdbeer-Kuppeltorte. Alle ohne zugesetzten Zucker, alle WPF-tauglich, alle so, wie ich sie selbst in meiner Küche backe."

Volumen-Style:
"Diese Rezepte sind meine Antwort auf 'aber dann hab ich doch nichts auf dem Teller'. XL-Wraps, Frittata, der virale lebensverändernde Salat — alles unter 450 kcal, alles kein bisschen weniger sättigend als deine alten Lieblinge."

Beispiele für SCHLECHTE Vorworte (nie so):
• "Diese köstliche Rezeptauswahl bietet für jeden Geschmack das Richtige!" (Werbesprache)
• "🤍 Hier kommen meine Lieblinge 🥹" (Emoji)
• "ABSOLUT GENIAL!!" (Übertreibung)
• "Das Pack ist eine Sammlung von Rezepten." (banal)`;

export type PackForewordContent = {
  greeting: string;
  story: string;
  signoff: string;
};

function formatPackForPrompt(pack: Pack, brand: Brand): string {
  return [
    `Pack-Titel: ${pack.title}`,
    `Pack-Untertitel: ${pack.subtitle}`,
    `Tagline: ${pack.tagline}`,
    `Kategorie: ${pack.category}`,
    `Beschreibung: ${pack.description}`,
    pack.edgeCase ? `Pack-Charakter: ${pack.edgeCase}` : "",
    ``,
    `Brand: ${brand.name} (${brand.handle})`,
    `Brand-Bio: ${brand.bio}`,
    `Brand-Tagline: ${brand.tagline}`,
  ]
    .filter(Boolean)
    .join("\n");
}

// Generate a structured pack-foreword via Gemini. Throws on Gemini failure
// — caller decides whether to fall back to a hardcoded default. We don't
// silently fall back inside this function so the caller can log/alert.
export async function generatePackForeword(
  pack: Pack,
  brand: Brand
): Promise<PackForewordContent> {
  const prompt = [
    `Schreibe ein persönliches Pack-Vorwort für das folgende Recipe-Pack.`,
    `Wichtig: Das Vorwort muss konkret zu diesem Pack passen (Inhalte, Stimmung, Einsatzkontext) — nicht generisch.`,
    ``,
    formatPackForPrompt(pack, brand),
    ``,
    `Antworte nur als JSON nach Schema, ohne Erklärung.`,
  ].join("\n");

  const result = await callGemini<PackForewordContent>({
    prompt,
    schema: RESPONSE_SCHEMA,
    systemInstruction: SYSTEM_INSTRUCTION,
    // Higher temp than structured extraction (e.g. micros) — we want voice
    // and personality. But not so high that we get nonsense or break the
    // tonal rules in the system instruction.
    temperature: 0.85,
    maxOutputTokens: 1024,
    thinkingBudget: 0,
    retries: 2,
  });

  // Clean each field: trim, strip stray quotes, collapse whitespace.
  // Hard-cap length so the renderer's typography contracts hold (e.g. the
  // patisserie polaroid layout reserves ~380 chars for the story block —
  // anything longer overflows visually).
  const sanitize = (s: string, max: number): string => {
    let out = (s ?? "").trim();
    out = out.replace(/^["'„«]+|["'"»]+$/g, "");
    out = out.replace(/\s+/g, " ");
    if (out.length > max) {
      const cut = out.slice(0, max);
      const lastDot = Math.max(
        cut.lastIndexOf("."),
        cut.lastIndexOf("!"),
        cut.lastIndexOf("?")
      );
      out = lastDot > max * 0.5 ? cut.slice(0, lastDot + 1) : cut + "…";
    }
    return out;
  };

  return {
    greeting: sanitize(result.greeting, 60),
    story: sanitize(result.story, 420),
    signoff: sanitize(result.signoff, 100),
  };
}
