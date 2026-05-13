import type { Pack } from "@/lib/packs";
import type { Brand } from "@/lib/brands";
import { callGemini } from "./gemini";
import { restoreGermanUmlauts } from "@/lib/restore-umlauts";

// Schema-driven Pack-Vorwort. Vier kurze Felder so der Renderer sie ohne
// Parsing layouten kann:
//   - greeting:  Anrede oben auf der Vorwort-Page
//   - story:     Pack-spezifisches Vorwort im Body
//   - signoff:   Kurzer Schluss-CTA UNTERHALB der story (Vorwort-Page)
//   - outro:     2-3 Sätze persönliche Abschiedsworte auf der LETZTEN
//                Seite des Packs (Outro-Page)

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    greeting: {
      type: "string",
      description:
        "Direkte, persönliche Anrede in der Stimme der Creatorin. 4-7 Wörter mit korrekten deutschen Umlauten (ä, ö, ü, ß). Z.B. 'Hey, schön dass du da bist.', 'Hi, ich bin <NAME>.'. KEINE Hashtags, KEINE Emojis, KEINE Anführungszeichen, KEINE Em-Dashes (—).",
    },
    story: {
      type: "string",
      description:
        "Pack-spezifisches Vorwort, 3-5 kurze Sätze, max. 380 Zeichen. Erklärt persönlich, warum dieses Pack besonders ist und für wen es gedacht ist. In der Stimme der Creatorin: warm, du-Form, sinnlich-konkret. MUSS mindestens 2 konkrete Rezept-Namen aus dem Pack erwähnen (im Prompt aufgelistet). Mit korrekten deutschen Umlauten (ä, ö, ü, ß). KEINE Werbesprache, KEINE Hashtags, KEINE Emojis, KEINE Anführungszeichen, KEINE Em-Dashes (—).",
    },
    signoff: {
      type: "string",
      description:
        "Kurzer Schluss-CTA für die Vorwort-Page, 4-9 Wörter mit korrekten Umlauten. Lädt zum Stöbern/Backen/Probieren ein. KEIN 'Deine <NAME>'. KEINE Hashtags, KEINE Emojis, KEINE Em-Dashes.",
    },
    outro: {
      type: "string",
      description:
        "2-3 Sätze persönliche Abschiedsworte für die LETZTE Seite des Packs (NICHT die Vorwort-Page). In ICH-Form, persönlich, warm. MUSS auf mindestens 1 konkretes Rezept aus dem Pack ODER auf Saison/Anlass aus dem Pack-Titel beziehen. Mit korrekten deutschen Umlauten. Max 280 Zeichen. KEIN 'Deine <NAME>'. KEINE Hashtags, KEINE Emojis, KEINE Em-Dashes.",
    },
  },
  required: ["greeting", "story", "signoff", "outro"],
};

function systemInstructionFor(brand: Brand): string {
  return `Du schreibst Pack-Vorworte für die Recipe-Cards von ${brand.name} (${brand.handle}).

Brand-Kontext:
- Name: ${brand.name}
- Handle: ${brand.handle}
- Bio: ${brand.bio}
- Tagline: ${brand.tagline}

TONALITÄT (extrem wichtig):
- Sprich in der ICH-Form, als ob ${brand.name} selbst spricht. Du-Form für die Leserin.
- Warm, persönlich, "wie zu einer Freundin am Küchentisch".
- KEINE Werbesprache, KEINE Floskeln ("genussvoll", "köstlich", "perfekt für jeden Anlass", "absolute Lieblinge", "angesagt").
- KEINE Übertreibungen ("absolut traumhaft", "unwiderstehlich", "sensationell").
- KEINE Hashtags, KEINE Emojis, KEINE Anführungszeichen.
- Sinnlich-konkret statt abstrakt: nicht "lecker", sondern "schmilzt auf der Zunge", "knusprig außen, fluffig innen", "in 15 Min auf dem Tisch".
- Eine kleine persönliche Note: "das ist mein Sonntagsritual", "ich back das mindestens einmal die Woche", "der Salat geht mit mir jeden Montag ins Büro".

DEUTSCHE SCHREIBWEISE (ABSOLUT KRITISCH — wichtigste Regel):
Du MUSST alle deutschen Umlaute korrekt verwenden:
- ä, Ä (NIEMALS ae, Ae) — Beispiele: "ähnlich", "Bäcker", "während", "Käse", "Hähnchen"
- ö, Ö (NIEMALS oe, Oe) — Beispiele: "schön", "möchte", "öffnen", "Löffel", "Brötchen"
- ü, Ü (NIEMALS ue, Ue) — Beispiele: "für", "über", "Küche", "Frühstück", "süß"
- ß (NIEMALS ss bei langen Vokalen) — Beispiele: "süß", "heiß", "Fuß", "groß", "weiß"

Verbotene falsche Schreibweisen (überprüfe JEDES Wort am Ende):
"fuer" → "für" · "ueber" → "über" · "Kueche" → "Küche" · "schoen" → "schön"
"glueck" → "glück" · "suess" → "süß" · "moegen" → "mögen" · "möchte" (richtig)
"haehnchen" → "Hähnchen" · "naechste" → "nächste" · "spaeter" → "später"
"vielfaeltig" → "vielfältig" · "gemuetlich" → "gemütlich" · "Stueck" → "Stück"
"weiss" → "weiß" · "heiss" → "heiß" · "groesser" → "größer"

KEINE EM-DASHES / EN-DASHES (KI-Tell!):
- Verboten: "—" (Em-Dash) und "–" (En-Dash). Stattdessen Komma oder Punkt.
- Hyphen-Minus (-) für Komposita ("low-carb", "Mama-Pause") sind OK.

PACK-VORWORT-STRUKTUR:
- greeting: 4-7 Wörter, direkte Anrede
- story: 3-5 Sätze. MUSS mindestens 2 konkrete Rezept-Namen aus dem Pack
  erwähnen. Bezieht sich auf den Pack-Charakter, sagt für wen/wann das
  Pack gedacht ist (Sonntagmorgen, nach dem Training, fürs Büro)
- signoff: 4-9 Wörter, Einladung zum Stöbern
- outro: 2-3 Sätze, persönliche Abschiedsworte. Bezieht sich konkret auf
  1-2 Rezepte aus dem Pack ODER auf Saison/Monat wenn der Title das nahelegt
  ("Top Reels Mai" → Mai-Bezug, Spargel-Zeit; "Airfryer Lieblinge" → schnelle
  Abende). Klingt wie eine handgeschriebene Notiz, kein Marketing-Outro.

Beispiele für gute Vorworte (Stil übernehmen, neu schreiben):

Greeting: "Hey, schön dass du da bist."
Story (Backwelt): "Backen ist meine Paradedisziplin. Hier sind meine
liebsten Werke aus den Reels, Schoko-Biskuitrolle, Cheesecake und
Erdbeer-Kuppeltorte. Alle ohne zugesetzten Zucker, alle so wie ich sie
selbst in meiner Küche backe."

Story (Mai-Top-Pack): "Hey, schön dass du da bist. Hier sind die
Rezepte, die diesen Monat bei euch am besten angekommen sind: vom Curry
Dattel Dip über den High Protein Schüttel Salat bis zu den Pina Colada
Energy Balls. Lass dich inspirieren."

Outro-Beispiele:
- "Ich hoffe, du findest in diesem Pack genau das, wonach du gerade Lust
  hast. Wenn du eines der Rezepte nachkochst, schick mir gerne ein Foto
  bei Instagram, ich liebe es eure Versionen zu sehen."
- "Der Mai ist meine Lieblingszeit zum Kochen, alles wird leichter,
  frischer, lebendiger. Probier ein Rezept aus, das dir Lust macht, und
  schreib mir gerne wie es war."

Niemals so:
- "Diese köstliche Rezeptauswahl bietet für jeden Geschmack das Richtige!" (Werbesprache)
- "🤍 Hier kommen meine Lieblinge 🥹" (Emoji)
- "ABSOLUT GENIAL!!" (Übertreibung)
- "Das Pack ist eine Sammlung von Rezepten." (banal)`;
}

export type PackForewordContent = {
  greeting: string;
  story: string;
  signoff: string;
  /** Optionales Outro für die letzte Pack-Seite. Bei älteren Forewords
   *  (Bienen Code-Brand) kann das Feld fehlen — der Renderer fällt dann
   *  auf seinen Default-Text zurück. */
  outro?: string;
};

function formatPackForPrompt(
  pack: Pack,
  brand: Brand,
  recipeTitles: string[]
): string {
  const lines = [
    `Pack-Titel: ${pack.title}`,
    `Pack-Untertitel: ${pack.subtitle}`,
    `Tagline: ${pack.tagline}`,
    `Kategorie: ${pack.category}`,
    `Beschreibung: ${pack.description}`,
    pack.edgeCase ? `Pack-Charakter: ${pack.edgeCase}` : "",
  ];
  if (recipeTitles.length > 0) {
    lines.push("");
    lines.push(`REZEPTE in diesem Pack (MUSST du mindestens 2 davon namentlich erwähnen):`);
    recipeTitles.forEach((t) => lines.push(`- ${t}`));
  }
  lines.push("");
  lines.push(`Brand: ${brand.name} (${brand.handle})`);
  lines.push(`Brand-Bio: ${brand.bio}`);
  lines.push(`Brand-Tagline: ${brand.tagline}`);
  return lines.filter(Boolean).join("\n");
}

/**
 * Generate a structured pack-foreword via Gemini. recipeTitles ist optional
 * aber sehr empfohlen — gibt der KI konkrete Anker für persönliche
 * Texte. Throws on Gemini failure.
 */
export async function generatePackForeword(
  pack: Pack,
  brand: Brand,
  recipeTitles: string[] = []
): Promise<PackForewordContent> {
  const prompt = [
    `Schreibe ein persönliches Pack-Vorwort für das folgende Recipe-Pack.`,
    `Wichtig: Das Vorwort muss konkret zu diesem Pack passen (Inhalte, Stimmung, Einsatzkontext), nicht generisch.`,
    `KRITISCH: Verwende deutsche Umlaute (ä, ö, ü, ß) NIEMALS als ae, oe, ue, ss umschreiben.`,
    ``,
    formatPackForPrompt(pack, brand, recipeTitles),
    ``,
    `Antworte nur als JSON nach Schema, ohne Erklärung.`,
  ].join("\n");

  const result = await callGemini<PackForewordContent>({
    prompt,
    schema: RESPONSE_SCHEMA,
    systemInstruction: systemInstructionFor(brand),
    // Etwas niedrigere Temp als zuvor (0.85 → 0.7) — Voice bleibt, aber
    // weniger Drift zu falschen Umlauten oder Marketing-Wendungen.
    temperature: 0.7,
    maxOutputTokens: 1024,
    thinkingBudget: 0,
    retries: 2,
  });

  // Two-Stage-Cleanup: erst Umlaut-Restore (Wörterbuch-basiert), dann
  // typografisches Cleanup (Em-Dashes, Quotes, Whitespace, Max-Length).
  const cleanField = (s: string, max: number): string => {
    let out = (s ?? "").trim();
    // Stage 1: Umlauts wiederherstellen
    out = restoreGermanUmlauts(out);
    // Stage 2: typografisch sauber
    out = out.replace(/^["'„«]+|["'"»]+$/g, "");
    out = out.replace(/\s*[—–]\s*/g, ", "); // Em/En-Dashes → Komma
    out = out.replace(/\s+/g, " ");
    out = out.replace(/,\s*,/g, ",");
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
    greeting: cleanField(result.greeting, 60),
    story: cleanField(result.story, 420),
    signoff: cleanField(result.signoff, 100),
    outro: result.outro ? cleanField(result.outro, 320) : undefined,
  };
}
