import { callGemini } from "./gemini";
import type { ReelRow } from "@/lib/creator-reels-server";
import type { Brand } from "@/lib/brands";
import type { CardLayout } from "@/lib/packs";

// Pre-Generate Design-Vorschlaege fuer den Auto-Pack-Builder.
// Wird vom AutoPackForm aufgerufen, wenn der User auf
// "✨ KI-Auto-Setup" klickt — Gemini Flash schaut auf die ausgewaehlten
// Reels (Title + meal_type + cuisine + occasion + season + vessel) und
// schlaegt:
//   - 5 Pack-Title-Optionen
//   - 1 empfohlenes Layout (aus 7) mit Begruendung
//   - 1 empfohlener Mood-Preset (aus 8) mit Begruendung
//   - 1 empfohlener Display-Font (aus 3)
//
// User kann jede Suggestion uebernehmen oder eigenes setzen.

const LAYOUT_OPTIONS: { id: CardLayout; description: string }[] = [
  {
    id: "amber",
    description:
      "Sunset-Editorial Premium mit Honey-Halo, Stat-Ribbon, Avatar-Stempel. Hauptmahlzeiten, Sattmacher, Feierabend-Klassiker.",
  },
  {
    id: "editorial",
    description:
      "Klassischer Magazin-Look mit Mikronaehrstoff-Banner oben, Pull-Quote. Allround-Hauptmahlzeiten, Editorial-Feel.",
  },
  {
    id: "patisserie",
    description:
      "Magazin-Spread mit Lavender-Sidebar + Polaroid-Foto. Backwaren, Desserts, anrichten-fokussierte Karten.",
  },
  {
    id: "minimal",
    description:
      "Cookbook-Cover mit Full-Bleed-Hero + Mega-Title-Overlay. Snacks, Showpiece-Rezepte, starke Hero-Bilder.",
  },
  {
    id: "vital",
    description:
      "Apple-Health-Stack mit 3 Cards + Macro-Donuts. Volumen, High-Protein, Diet-Fokus, frische Premium-Mahlzeiten.",
  },
  {
    id: "dashboard",
    description:
      "Notion-Style mit Wochentag-Tag + Icons. Mealprep, Wochenplanung, operative Karten.",
  },
  {
    id: "sport",
    description:
      "Macro-Bars mit Emojis + Checkbox-Zutaten + Timeline. Workout-fokussiert, alt — meist Vital besser.",
  },
];

const MOOD_OPTIONS = [
  { id: "lavender", description: "Weich, Patisserie-Vibe — Backwaren, Soft-Desserts." },
  { id: "sage", description: "Frisch, Volumen-fokus — Bowls, Salate, Healthy." },
  { id: "mint", description: "Cool, Apple-Aesthetik — Snacks, Energy-Balls, leichte Rezepte." },
  { id: "sky", description: "Strukturiert, Notion-Vibe — Meal-Prep, Wochenplanung." },
  { id: "honey", description: "Warmer Honey-Ton — Hauptmahlzeiten, Comfort-Food, Pasta." },
  { id: "rose", description: "Fruchtig-warm — Beeren, Frühstücke, Smoothies." },
  { id: "apricot", description: "Warm-orange — Kürbis, Smoothies, Herbst-Vibe." },
  { id: "cocoa", description: "Tief — Schokoladen-Rezepte, Tiramisu, Brownies." },
];

const FONT_OPTIONS = [
  { id: "fraunces", description: "Warm-serif, Cookbook-Vibe. Default für die meisten Packs." },
  { id: "dm-serif", description: "Hoch, editorial, magazine. Premium-Feel für Hauptmahlzeiten/Desserts." },
  { id: "inter-tight", description: "Bold sans, sportlich-clean. Mealprep, Workout, modern-minimalistisch." },
];

export type PackDesignSuggestion = {
  titles: string[]; // 5 Optionen, sortiert nach Empfehlung (Index 0 = top)
  layout: CardLayout;
  layoutReason: string;
  moodId: string; // matched gegen lib/pack-presets.ts moodPresets
  moodReason: string;
  fontId: "fraunces" | "dm-serif" | "inter-tight";
  fontReason: string;
  category: string;
  subtitle: string;
  tagline: string;
  description: string;
};

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    titles: {
      type: "array",
      items: { type: "string" },
      description:
        "Genau 5 Pack-Titel-Optionen auf Deutsch, je max 40 chars. Index 0 = beste Empfehlung. KEINE Anführungszeichen, KEINE Emojis, KEINE Marketing-Floskeln.",
    },
    layout: {
      type: "string",
      description:
        'Empfohlenes Layout, einer aus: "amber", "editorial", "patisserie", "minimal", "vital", "dashboard", "sport".',
    },
    layoutReason: {
      type: "string",
      description: "Kurze Begründung warum dieses Layout (max 80 chars).",
    },
    moodId: {
      type: "string",
      description:
        'Empfohlene Mood-Palette, einer aus: "lavender", "sage", "mint", "sky", "honey", "rose", "apricot", "cocoa".',
    },
    moodReason: {
      type: "string",
      description: "Kurze Begründung warum diese Farbe (max 80 chars).",
    },
    fontId: {
      type: "string",
      description: 'Empfohlene Display-Font, einer aus: "fraunces", "dm-serif", "inter-tight".',
    },
    fontReason: {
      type: "string",
      description: "Kurze Begründung (max 80 chars).",
    },
    category: {
      type: "string",
      description: 'Kategorie-Bezeichnung (Frühstück, Snacks, Backen, Mittagessen, Mealprep, etc.).',
    },
    subtitle: {
      type: "string",
      description: "Eine Zeile Untertitel, max 80 chars.",
    },
    tagline: {
      type: "string",
      description: "Teaser mit 2-3 konkreten Recipe-Titles aus der Auswahl, max 120 chars.",
    },
    description: {
      type: "string",
      description:
        "2-3 Sätze Pack-Beschreibung auf Deutsch — PERSÖNLICH in der Stimme der Creatorin, du-Form, NICHT Marketing. Bezieht sich konkret auf 1-2 Rezepte. KEINE Floskeln wie 'angesagteste', 'perfekte Sammlung', 'Trends nicht verpassen'. KEINE Anführungszeichen.",
    },
  },
  required: [
    "titles",
    "layout",
    "layoutReason",
    "moodId",
    "moodReason",
    "fontId",
    "fontReason",
    "category",
    "subtitle",
    "tagline",
    "description",
  ],
};

function systemInstructionFor(brand: Brand | null): string {
  const intro = brand
    ? `Du gestaltest einen Recipe-Pack für ${brand.name} (${brand.handle}). Bio: "${brand.bio}". Tagline: "${brand.tagline}".`
    : `Du gestaltest einen Recipe-Pack-Generator.`;

  const layoutTable = LAYOUT_OPTIONS.map(
    (l) => `- "${l.id}": ${l.description}`
  ).join("\n");
  const moodTable = MOOD_OPTIONS.map(
    (m) => `- "${m.id}": ${m.description}`
  ).join("\n");
  const fontTable = FONT_OPTIONS.map(
    (f) => `- "${f.id}": ${f.description}`
  ).join("\n");

  return `${intro}

AUFGABE: Gegeben eine Liste ausgewählter Recipe-Reels, schlage:
1. 5 Pack-Titel-Optionen (Index 0 = beste)
2. 1 Card-Layout aus 7
3. 1 Mood-Palette aus 8
4. 1 Display-Font aus 3
5. Subtitle, Tagline, Description, Category

PACK-TITEL-REGELN:
- Max 40 chars je Titel
- 5 STILISTISCH UNTERSCHIEDLICHE Optionen (nicht 5 Varianten desselben Konzepts!)
- Beispiele für stilistische Vielfalt: "Feierabend-Klassiker" (deutsch-warm) / "Quick & Cozy" (englisch-modern) / "Mama's Wochenrezepte" (persönlich-emotional) / "Top 10 der Woche" (Charts-Style) / "Bowls & mehr" (minimalistisch)
- KEINE Marketing-Floskeln: keine "perfekt für...", "die besten...", "angesagteste..."
- KEINE Anführungszeichen, Emojis, Hashtags
- Knackig, einprägsam

LAYOUT-AUSWAHL — picke einen aus dieser Liste:
${layoutTable}

MOOD-AUSWAHL — picke einen aus dieser Liste:
${moodTable}

FONT-AUSWAHL — picke einen aus dieser Liste:
${fontTable}

TONALITÄT für Description/Subtitle/Tagline:
- ICH-Form als ob ${brand?.name ?? "die Creatorin"} spricht
- Du-Form für die Leserin
- Warm, persönlich, "Freundin am Küchentisch"
- KEINE Marketing-Sprache
- Konkret statt abstrakt — nenn Rezeptnamen, keine Adjektiv-Wolken

PASSUNG sehr wichtig: Layout/Mood/Font sollen ZUR REZEPTAUSWAHL passen.
- Wenn die Reels Dessert/Backwaren sind → patisserie/amber, lavender/honey, fraunces
- Wenn Bowls/Healthy → vital, sage/mint, fraunces oder inter-tight
- Wenn Mealprep → dashboard, sky, inter-tight
- Wenn Snacks → minimal, mint/rose, fraunces
- Wenn Comfort-Food/Hauptmahlzeiten → amber, honey, fraunces oder dm-serif

Antworte AUSSCHLIESSLICH im JSON-Schema.`;
}

export async function suggestPackDesign(
  reels: ReelRow[],
  brand?: Brand | null
): Promise<PackDesignSuggestion> {
  if (reels.length === 0) {
    throw new Error("suggestPackDesign: keine Reels uebergeben");
  }

  const reelLines = reels
    .slice(0, 30)
    .map((r) => {
      const tags = [
        r.meal_type,
        r.cuisine,
        r.main_ingredient,
        r.occasion,
        r.season,
        r.vessel,
      ]
        .filter(Boolean)
        .join("/");
      const dietary = r.dietary?.length ? ` [${r.dietary.join(",")}]` : "";
      const time = r.estimated_time_minutes
        ? ` ${r.estimated_time_minutes}min`
        : "";
      return `• ${r.recipe_title || r.caption.slice(0, 60)} (${tags})${dietary}${time}`;
    })
    .join("\n");

  const result = await callGemini<PackDesignSuggestion>({
    prompt: `Anzahl ausgewaehlter Reels: ${reels.length}\n\nReel-Auswahl:\n${reelLines}\n\nGeneriere Design-Vorschlaege im JSON-Schema.`,
    schema: RESPONSE_SCHEMA,
    systemInstruction: systemInstructionFor(brand ?? null),
    temperature: 0.65,
    maxOutputTokens: 2048,
    thinkingBudget: 0,
    retries: 1,
    model: "flash",
  });

  // Defensive Validierung — falls Gemini einen Wert ausserhalb der enums
  // liefert (passiert selten), fallback auf safe defaults.
  const validLayout = LAYOUT_OPTIONS.find((l) => l.id === result.layout);
  const validMood = MOOD_OPTIONS.find((m) => m.id === result.moodId);
  const validFont = FONT_OPTIONS.find((f) => f.id === result.fontId);

  return {
    ...result,
    titles: Array.isArray(result.titles) ? result.titles.slice(0, 5) : [],
    layout: validLayout ? (result.layout as CardLayout) : "editorial",
    moodId: validMood ? result.moodId : "honey",
    fontId: validFont
      ? (result.fontId as "fraunces" | "dm-serif" | "inter-tight")
      : "fraunces",
  };
}
