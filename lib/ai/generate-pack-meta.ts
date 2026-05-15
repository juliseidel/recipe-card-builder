import type { ReelRow } from "@/lib/creator-reels-server";
import type { Brand } from "@/lib/brands";
import {
  formatVoiceProfileForPrompt,
  formatCaptionFewShot,
  ensureBrandVoiceProfile,
} from "./analyze-voice-profile";
import { generateWithCritique } from "./text-generation-pipeline";

// Generiert Pack-Title + Beschreibung aus einer Reel-Auswahl.
//
// Brand-agnostische, qualitaetsgesicherte Pipeline (Mai 2026 v2):
//   1. Voice-Profil des Brands als System-Instruction (formality, tone,
//      vokabel-anker, brand-tabus)
//   2. Few-Shot mit 3-5 echten Reel-Captions des Creators
//   3. Live-Recipe-Titel + Mood-Hints im User-Prompt (nicht nur Reel-IDs)
//   4. 3 Kandidaten parallel mit Temperatur-Spread, dann Self-Critique
//   5. Banned-Phrases-Check, Retry-Pass falls noetig
//
// Brand ohne voiceProfile: Fallback auf generic-but-bio-based Profil.
// Funktioniert sofort fuer jeden neuen Creator ohne manuelle Setup.

export type GeneratedPackMeta = {
  title: string;
  subtitle: string;
  tagline: string;
  description: string;
  category: string;
  /** Empfohlene Mood-ID aus brand-presets basierend auf der Reel-Selektion.
   *  UI kann dem User folgen oder ueberschreiben. */
  moodHint: "cream" | "sage" | "linen" | "amber";
};

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description:
        "Pack-Titel auf der Sprache des Creators (meist Deutsch). 15-40 chars. Knackig, konkret, NICHT generisch.",
    },
    subtitle: {
      type: "string",
      description:
        "Eine Zeile Untertitel, 30-80 chars. Schaerft das Pack-Versprechen.",
    },
    tagline: {
      type: "string",
      description:
        "Teaser mit 2-3 KONKRETEN Recipe-Titles aus der Liste, kommagetrennt. Max 120 chars.",
    },
    description: {
      type: "string",
      description:
        "2-3 Saetze Pack-Beschreibung in der Stimme des Creators. 140-280 chars. Bezieht sich konkret auf 1-2 Rezepte aus der Liste. NICHT Marketing.",
    },
    category: {
      type: "string",
      description:
        "Eine Kategorie-Bezeichnung passend zum Pack (Frühstück, Snacks, Backen, Mittagessen, Mealprep, etc.).",
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

function buildSystemInstruction(brand: Brand | null): string {
  const name = brand?.name ?? "die Creatorin";
  const intro = brand
    ? `Du baust Pack-Metadaten fuer einen Recipe-Pack von ${brand.name} (${brand.handle}). Bio: "${brand.bio}". Tagline: "${brand.tagline}".`
    : `Du baust Pack-Metadaten fuer einen Recipe-Pack-Generator.`;

  const voiceBlock = formatVoiceProfileForPrompt(brand?.voiceProfile, name);
  const fewShotBlock = formatCaptionFewShot(brand?.voiceProfile);

  return `${intro}

Aufgabe: gegeben eine Liste ausgewaehlter Recipe-Reels, generiere einen Pack-Titel + Subtitle + Tagline + Description + passendes Mood-Preset.

${voiceBlock}

${fewShotBlock}

GENERATIONS-REGELN:
- Sprich in der ICH-Form als ob ${name} selbst spricht.
- KEINE Marketing-Floskeln. Tabu: "angesagteste", "perfekte Auswahl", "Trends nicht verpassen", "koestliche Rezepte", "Geschmackserlebnis", "die besten", "must-have", "Lass dich inspirieren".
- KEINE Emojis, KEINE Hashtags, KEINE Anfuehrungszeichen, KEINE Em-Dashes (—).
- Konkret statt abstrakt: nicht "leckere Snacks", sondern "Frozen Yoghurt Cups, Pudding ohne Zucker und Pina Colada Energy Balls".
- Pack-Titel: 15-40 chars, knackig.
- Tagline: nennt 2-3 konkrete Rezept-Namen aus der gelieferten Liste, kommagetrennt.
- Description: 2-3 Saetze in ${name}s Stimme. Erzaehlt warum DIESE Rezepte gewaehlt sind, fuer wen oder welchen Anlass. Verweist konkret auf 1-2 Rezepte aus der Liste — nicht erfinden.
- moodHint passt sich an:
    - Suesses/Backwaren -> "amber" oder "cream"
    - Veggies/Bowls/Healthy -> "sage"
    - Editorial/Premium/Modern -> "linen"
    - Allround/Hauptmahlzeiten -> "cream"

Antworte AUSSCHLIESSLICH im JSON-Schema.`;
}

function buildUserPrompt(reels: ReelRow[]): string {
  const reelLines = reels
    .slice(0, 30)
    .map((r) => {
      const date = r.posted_at?.slice(0, 10) ?? "—";
      const tags = [r.meal_type, r.cuisine, r.main_ingredient]
        .filter(Boolean)
        .join("/");
      const title = r.recipe_title || r.caption.slice(0, 60);
      return `• ${title} (${tags || "?"}, ${date})`;
    })
    .join("\n");

  return `Anzahl ausgewaehlter Reels: ${reels.length}

Reel-Auswahl (NUR diese Rezepte sind im Pack — alles in Description/Tagline MUSS sich auf diese beziehen, nichts dazu erfinden):
${reelLines}

Generiere Pack-Metadaten im JSON-Schema.`;
}

export async function generatePackMeta(
  reels: ReelRow[],
  brand?: Brand | null
): Promise<GeneratedPackMeta> {
  if (reels.length === 0) {
    throw new Error("generatePackMeta: keine Reels uebergeben");
  }

  // Lazy-Backfill: wenn der Brand kein Voice-Profil hat, leiten wir es
  // jetzt aus den DB-Captions ab + persistieren. Naechster Call profitiert.
  const brandSafe = await ensureBrandVoiceProfile(brand);
  const brandBanned = brandSafe?.voiceProfile?.bannedPhrases ?? [];

  const result = await generateWithCritique<GeneratedPackMeta>({
    schema: RESPONSE_SCHEMA,
    generationPrompt: buildUserPrompt(reels),
    generationSystemInstruction: buildSystemInstruction(brandSafe),
    candidateCount: 3,
    generationTemperature: 0.75,
    maxOutputTokens: 1024,
    brandBannedPhrases: brandBanned,
    bannedCheckFields: ["title", "subtitle", "tagline", "description"],
    scorableFields: [
      {
        key: "title",
        label: "Pack-Titel",
        minLength: 8,
        maxLength: 40,
        goodCriteria:
          "Knackig, konkret, unverwechselbar. Klingt nach echtem Creator, nicht nach KI-Sammlung.",
      },
      {
        key: "subtitle",
        label: "Subtitle",
        minLength: 20,
        maxLength: 80,
        goodCriteria: "Schaerft das Pack-Versprechen in einem Satz, ohne Floskeln.",
      },
      {
        key: "tagline",
        label: "Tagline",
        minLength: 30,
        maxLength: 120,
        goodCriteria:
          "Nennt 2-3 ECHTE Rezeptnamen aus der Auswahl, kommagetrennt. Keine erfundenen Gerichte.",
      },
      {
        key: "description",
        label: "Description",
        minLength: 140,
        maxLength: 280,
        goodCriteria:
          "2-3 Saetze in der Stimme des Creators, bezieht sich konkret auf 1-2 Rezepte. Klingt persoenlich, nicht generisch.",
      },
    ],
    preFilter: (c) => {
      // Hard-Reject wenn moodHint enum-violation
      if (!["cream", "sage", "linen", "amber"].includes(c.moodHint)) return true;
      // Hard-Reject wenn ein Pflichtfeld leer
      if (!c.title?.trim() || !c.description?.trim()) return true;
      return false;
    },
    debugTag: "generate-pack-meta",
  });

  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[generate-pack-meta] passes=${result.passes} cleanCount=${result.cleanCount} winnerBannedHits=${result.winnerBannedHits.length}`
    );
  }

  return result.winner;
}
