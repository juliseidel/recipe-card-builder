import type { Pack } from "@/lib/packs";
import type { Brand } from "@/lib/brands";
import { callGemini } from "./gemini";

// Schema-driven Pack-Vorwort. Vier kurze Felder so der Renderer sie ohne
// Parsing layouten kann:
//   - greeting:  Anrede oben auf der Vorwort-Page
//   - story:     Pack-spezifisches Vorwort im Body
//   - signoff:   Kurzer Schluss-CTA UNTERHALB der story (auf der Vorwort-Page)
//   - outro:     2-3 Saetze persoenliche Abschiedsworte auf der LETZTEN Seite
//                des Packs (Outro-Page). Bezieht sich auf Pack-Inhalt UND ggf.
//                Saison/Monat. Optional — Pre-existing Code-Brand-Forewords
//                (Bienen-Packs in lib/pack-forewords.ts) haben kein outro;
//                dann faellt der Renderer auf seinen Default-Text zurueck.

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    greeting: {
      type: "string",
      description:
        "Direkte, persoenliche Anrede in der Stimme der Creatorin. 4-7 Woerter. Z.B. 'Hey, schoen dass du da bist.', 'Hi, ich bin <NAME>.'. KEINE Hashtags, KEINE Emojis, KEINE Anfuehrungszeichen.",
    },
    story: {
      type: "string",
      description:
        "Pack-spezifisches Vorwort, 3-5 kurze Saetze, max. 380 Zeichen. Erklaert persoenlich, warum dieses Pack besonders ist und fuer wen es gedacht ist. In der Stimme der Creatorin: warm, du-Form, sinnlich-konkret. Bezieht sich konkret auf die Pack-Inhalte (Rezept-Beispiele), nicht generisch. KEINE Werbesprache, KEINE Hashtags, KEINE Emojis, KEINE Anfuehrungszeichen.",
    },
    signoff: {
      type: "string",
      description:
        "Kurzer Schluss-CTA fuer die Vorwort-Page, 4-9 Woerter. Laedt zum Stoebern/Backen/Probieren ein. KEIN 'Deine <NAME>' (das wird separat gerendert). KEINE Hashtags, KEINE Emojis.",
    },
    outro: {
      type: "string",
      description:
        "2-3 Saetze persoenliche Abschiedsworte fuer die LETZTE Seite des Packs (NICHT die Vorwort-Page). In ICH-Form, persoenlich, warm. Bezieht sich auf 1-2 konkrete Rezepte aus dem Pack ODER Saison/Anlass wenn der Pack-Titel das nahelegt (z.B. 'Mai 2026' -> Fruehlings/Mai-Bezug). Max 280 Zeichen. KEIN 'Deine <NAME>' (wird separat gerendert). KEINE Hashtags, KEINE Emojis.",
    },
  },
  required: ["greeting", "story", "signoff", "outro"],
};

function systemInstructionFor(brand: Brand): string {
  return `Du schreibst Pack-Vorworte fuer die Recipe-Cards von ${brand.name} (${brand.handle}).

Brand-Kontext:
- Name: ${brand.name}
- Handle: ${brand.handle}
- Bio: ${brand.bio}
- Tagline: ${brand.tagline}
- Signature: "${brand.signature}" (wird separat gerendert — NICHT in deinen Texten erwaehnen)

Tonalitaet (extrem wichtig):
- Sprich in der ICH-Form, als ob ${brand.name} selbst spricht. Du-Form fuer die Leserin.
- Warm, persoenlich, "wie zu einer Freundin am Kuechentisch".
- KEINE Werbesprache, KEINE Floskeln ("genussvoll", "koestlich", "perfekt fuer jeden Anlass", "absolute Lieblinge", "angesagt").
- KEINE Uebertreibungen ("absolut traumhaft", "unwiderstehlich", "sensationell").
- KEINE Hashtags, KEINE Emojis, KEINE Anfuehrungszeichen.
- Sinnlich-konkret statt abstrakt: nicht "lecker", sondern "schmilzt auf der Zunge", "knusprig aussen, fluffig innen", "in 15 Min auf dem Tisch".
- Eine kleine persoenliche Note: "das ist mein Sonntagsritual", "ich back das mindestens einmal die Woche", "der Salat geht mit mir jeden Montag ins Buero".

DEUTSCHE SCHREIBWEISE (kritisch):
- Verwende ALLE deutschen Umlaute korrekt: ae, oe, ue → IMMER ä, ö, ü, ß. Beispiele: "für", "über", "gemütlich", "dünn", "Gemüse", "süß", "schön", "möchte".
- ß bleibt ß (nicht ss). Beispiel: "süß", nicht "suess".
- NIEMALS Woerter ohne Umlaut wo einer hin gehoert.

Was ein Pack-Vorwort tun muss:
- Den Pack-Charakter in 3-5 Saetzen einfangen
- Konkrete Inhalte erwaehnen (Rezept-Beispiele aus dem Pack)
- Sagen, fuer WEN/WANN das Pack gedacht ist (Sonntagvormittag, nach dem Training, fuers Buero)
- Einladen zum Stoebern, ohne pushy zu sein

Was das outro-Feld tun muss:
- Persoenliche Abschiedsworte, 2-3 Saetze in ICH-Form
- Bezug auf den Pack-Charakter ODER Saison/Monat wenn der Titel das nahelegt
  (Beispiel: Pack heisst "Top Reels Mai 2026" -> Mai-Bezug, Spargel-Zeit, Erdbeeren, Sonne)
  (Beispiel: Pack heisst "Airfryer Lieblinge" -> Airfryer-Bezug, schnelle Abende)
- Klingt wie eine handgeschriebene Notiz, kein Marketing-Outro

Beispiele fuer GUTE Pack-Vorworte (nimm dir Stil, schreib aber pack-spezifisch neu):

Greeting + Story (Backwelt-Style):
"Backen ist meine Paradedisziplin. Hier sind meine liebsten Werke aus den Reels — Schoko-Biskuitrolle, Cheesecake, Erdbeer-Kuppeltorte. Alle ohne zugesetzten Zucker, alle so wie ich sie selbst in meiner Kueche backe."

Greeting + Story (Mai-Top-Pack):
"Hey, schoen dass du da bist. Hier sind die Rezepte, die diesen Monat bei euch am besten angekommen sind — vom Curry Dattel Dip ueber den High Protein Schuettel Salat bis zu den Pina Colada Energy Balls. Lass dich inspirieren."

Outro-Beispiele (PERSOENLICH, KEIN Marketing):
- "Ich hoffe, du findest in diesem Pack genau das, wonach du grade Lust hast. Wenn du eines der Rezepte nachkochst, schick mir gerne ein Foto bei Instagram — ich liebe es, eure Versionen zu sehen."
- "Der Mai ist meine Lieblingszeit zum Kochen — alles wird leichter, frischer, lebendiger. Probier ein Rezept aus, das dir Lust macht, und schreib mir gerne wie es war."

Beispiele SCHLECHTE Texte (nie so):
- "Diese koestliche Rezeptauswahl bietet fuer jeden Geschmack das Richtige!" (Werbesprache)
- "🤍 Hier kommen meine Lieblinge 🥹" (Emoji)
- "ABSOLUT GENIAL!!" (Uebertreibung)
- "Das Pack ist eine Sammlung von Rezepten." (banal)
- "Perfekt, um keine Trends zu verpassen." (Marketing)`;
}

export type PackForewordContent = {
  greeting: string;
  story: string;
  signoff: string;
  /** Optionales Outro fuer die letzte Pack-Seite. Bei aelteren Forewords
   *  (Bienen Code-Brand) kann das Feld fehlen — der Renderer faellt dann auf
   *  seinen Default-Text zurueck. */
  outro?: string;
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
// — caller decides whether to fall back to a hardcoded default.
export async function generatePackForeword(
  pack: Pack,
  brand: Brand
): Promise<PackForewordContent> {
  const prompt = [
    `Schreibe ein persoenliches Pack-Vorwort fuer das folgende Recipe-Pack.`,
    `Wichtig: Das Vorwort muss konkret zu diesem Pack passen (Inhalte, Stimmung, Einsatzkontext) — nicht generisch.`,
    ``,
    formatPackForPrompt(pack, brand),
    ``,
    `Antworte nur als JSON nach Schema, ohne Erklaerung.`,
  ].join("\n");

  const result = await callGemini<PackForewordContent>({
    prompt,
    schema: RESPONSE_SCHEMA,
    systemInstruction: systemInstructionFor(brand),
    // Higher temp than structured extraction (e.g. micros) — we want voice
    // and personality. But not so high that we get nonsense or break the
    // tonal rules in the system instruction.
    temperature: 0.85,
    maxOutputTokens: 1024,
    thinkingBudget: 0,
    retries: 2,
  });

  // Clean each field: trim, strip stray quotes, collapse whitespace.
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
    outro: result.outro ? sanitize(result.outro, 320) : undefined,
  };
}
