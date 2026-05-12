import { callGemini } from "./gemini";
import type { ReelRow } from "@/lib/creator-reels-server";
import type { Brand } from "@/lib/brands";

// Generiert Pack-Title + Beschreibung aus einer Reel-Auswahl. Wird vom
// Auto-Pack-Generator (Phase 4 UI) genutzt, wenn der User per Filter
// einen Pack aus 5-15 Reels zusammenbaut. Gemini Flash bekommt die
// Reel-Titles + Metadaten und schlaegt einen Pack-Titel vor — in der
// Stimme der Creatorin, nicht in Marketing-Sprache.

export type GeneratedPackMeta = {
  title: string;
  subtitle: string;
  tagline: string;
  description: string;
  category: string;
  /** Empfohlene Mood-ID aus brand-presets (cream/sage/linen/amber) basierend
   *  auf der Reel-Selektion. UI kann dem User folgen oder ueberschreiben. */
  moodHint: "cream" | "sage" | "linen" | "amber";
};

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description: "Kurzer Pack-Titel auf Deutsch, max 40 chars.",
    },
    subtitle: {
      type: "string",
      description: "Eine Zeile Untertitel, max 80 chars.",
    },
    tagline: {
      type: "string",
      description:
        "Teaser mit 2-3 konkreten Recipe-Titles aus der Auswahl, max 120 chars.",
    },
    description: {
      type: "string",
      description:
        "2-3 Saetze Pack-Beschreibung auf Deutsch — PERSOENLICH in der Stimme der Creatorin, du-Form, NICHT Marketing. Bezieht sich konkret auf 1-2 Rezepte aus der Auswahl. KEINE Floskeln wie 'angesagteste', 'perfekte Sammlung', 'Trends nicht verpassen'. KEINE Anfuehrungszeichen.",
    },
    category: {
      type: "string",
      description:
        "Eine Kategorie-Bezeichnung (Fruehstueck, Snacks, Backen, Mittagessen, etc.).",
    },
    moodHint: {
      type: "string",
      enum: ["cream", "sage", "linen", "amber"],
      description:
        "Empfohlenes Mood-Preset: cream (warm/einladend), sage (frisch/healthy), linen (editorial/clean), amber (warm/rustic-baking).",
    },
  },
  required: ["title", "subtitle", "tagline", "description", "category", "moodHint"],
};

function systemInstructionFor(brand: Brand | null): string {
  const intro = brand
    ? `Du baust Pack-Metadaten fuer einen Recipe-Pack von ${brand.name} (${brand.handle}). Bio: "${brand.bio}". Tagline: "${brand.tagline}".`
    : `Du baust Pack-Metadaten fuer einen Recipe-Pack-Generator.`;

  return `${intro}

Aufgabe: gegeben eine Liste ausgewaehlter Recipe-Reels, generiere einen einpraegsamen Pack-Titel + Subtitle + Tagline + Description + passendes Mood-Preset.

Tonalitaet (sehr wichtig):
- Sprich in der ICH-Form als ob ${brand?.name ?? "die Creatorin"} selbst spricht. Du-Form fuer die Leserin.
- Warm, persoenlich, "wie zu einer Freundin am Kuechentisch".
- KEINE Marketing-Floskeln. Verboten: "angesagteste", "perfekte Auswahl", "Trends nicht verpassen", "koestliche Rezepte", "Geschmackserlebnis".
- KEINE Werbesprache, KEINE Anfuehrungszeichen, KEINE Hashtags, KEINE Emojis.
- Konkret statt abstrakt: nicht "leckere Snacks", sondern "Frozen Yoghurt Cups, Marzipan-Kugeln und Pudding ohne Zucker".

Regeln:
- Pack-Titel max 40 chars, knackig auf Deutsch.
- Tagline nennt 2-3 konkrete Rezept-Namen aus der Liste, kommagetrennt.
- Description: 2-3 Saetze in ${brand?.name ?? "der Creatorin"}s Stimme. Erzaehlt warum du DIESE Rezepte gewaehlt hast, fuer wen oder welchen Anlass. Bezieht sich konkret auf 1-2 Rezepte aus der Liste.
- moodHint passt sich an:
    - Suesses/Backwaren -> "amber" oder "cream"
    - Veggies/Bowls/Healthy -> "sage"
    - Editorial/Premium/Modern -> "linen"
    - Allround/Hauptmahlzeiten -> "cream"

Beispiele GUTE Description (nicht kopieren, nimm dir Stil):
- "Diese Rezepte sind meine Antwort auf 'aber dann hab ich doch nichts auf dem Teller'. XL-Wraps und Frittata, alles unter 450 kcal, alles sattmachend."
- "Hier sind die Rezepte, die diesen Monat bei euch am besten angekommen sind. Vom Trauben Eis Snack bis zu den Pina Colada Energy Balls."

Beispiele SCHLECHTE Description (nie so):
- "Diese koestliche Sammlung praesentiert die angesagtesten Rezepte..." (Marketing)
- "Perfekt fuer jeden Anlass!" (Floskel)
- "🤍 Lass dich inspirieren 🥹" (Emoji)

Antworte AUSSCHLIESSLICH im JSON-Schema.`;
}

export async function generatePackMeta(
  reels: ReelRow[],
  brand?: Brand | null
): Promise<GeneratedPackMeta> {
  if (reels.length === 0) {
    throw new Error("generatePackMeta: keine Reels uebergeben");
  }

  const reelLines = reels
    .slice(0, 30)
    .map((r) => {
      const date = r.posted_at?.slice(0, 10) ?? "—";
      return `• ${r.recipe_title || r.caption.slice(0, 60)} (${r.meal_type ?? "?"}, ${r.cuisine ?? "?"}, ${date})`;
    })
    .join("\n");

  return await callGemini<GeneratedPackMeta>({
    prompt: `Anzahl ausgewaehlter Reels: ${reels.length}\n\nReel-Auswahl:\n${reelLines}\n\nGeneriere Pack-Metadaten im JSON-Schema.`,
    schema: RESPONSE_SCHEMA,
    systemInstruction: systemInstructionFor(brand ?? null),
    temperature: 0.55,
    maxOutputTokens: 1024,
    thinkingBudget: 0,
    retries: 1,
    model: "flash",
  });
}
