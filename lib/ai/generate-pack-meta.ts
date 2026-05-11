import { callGemini } from "./gemini";
import type { ReelRow } from "@/lib/creator-reels-server";

// Generiert Pack-Title + Beschreibung aus einer Reel-Auswahl. Wird vom
// Auto-Pack-Generator (Phase 4 UI) genutzt, wenn der User per Filter
// einen Pack aus 5-15 Reels zusammenbaut. Gemini Flash bekommt die
// Reel-Titles + Metadaten und schlaegt einen Pack-Titel vor.

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
        "2 Saetze Beschreibung auf Deutsch — was das Pack auszeichnet.",
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

const SYSTEM_INSTRUCTION = `Du baust Pack-Metadaten fuer einen Recipe-Pack-Generator.

Aufgabe: gegeben eine Liste ausgewaehlter Recipe-Reels, generiere einen einpraegsamen Pack-Titel + Subtitle + Tagline + Description + passendes Mood-Preset.

Regeln:
- Pack-Titel max 40 chars, knackig auf Deutsch ("Suesse Backwelt", "Top 12 Mai 2026", "Schnelle Frueh stuecke").
- Tagline nennt 2-3 konkrete Rezept-Namen aus der Liste, kommagetrennt.
- Description: 2 Saetze, klingt nach Cookbook-Editorial, nicht nach Marketing.
- moodHint passt sich an:
    - Suesses/Backwaren → "amber" (warm-rustic) oder "cream"
    - Veggies/Bowls/Healthy → "sage" (frisch)
    - Editorial/Premium/Modern → "linen" (cool-modern)
    - Allround / Hauptmahlzeiten → "cream"

Antworte AUSSCHLIESSLICH im JSON-Schema.`;

export async function generatePackMeta(reels: ReelRow[]): Promise<GeneratedPackMeta> {
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
    systemInstruction: SYSTEM_INSTRUCTION,
    temperature: 0.4,
    maxOutputTokens: 1024,
    thinkingBudget: 0,
    retries: 1,
    model: "flash",
  });
}
