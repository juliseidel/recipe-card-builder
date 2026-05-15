import type { ReelRow } from "@/lib/creator-reels-server";
import type { Brand } from "@/lib/brands";
import type { CardLayout } from "@/lib/packs";
import {
  formatVoiceProfileForPrompt,
  formatCaptionFewShot,
  ensureBrandVoiceProfile,
} from "./analyze-voice-profile";
import { generateWithCritique } from "./text-generation-pipeline";

// Pre-Generate Design-Vorschlaege fuer den Auto-Pack-Builder.
//
// Wird vom AutoPackForm aufgerufen, wenn der User auf
// "✨ KI-Auto-Setup" klickt — schaut auf die ausgewaehlten Reels und
// schlaegt:
//   - 5 Pack-Title-Optionen (sortiert nach Empfehlung)
//   - 1 empfohlenes Card-Layout (aus 9)
//   - 1 empfohlener Mood-Preset (aus 8)
//   - 1 empfohlener Display-Font (aus 3)
//   - Subtitle, Tagline, Description, Category
//   - Surface-Style (solid/gradient/pattern)
//
// Brand-agnostische Pipeline (v2):
//   - Voice-Profil + Few-Shot mit echten Captions
//   - Multi-Candidate (3 parallel) + Self-Critique
//   - Banned-Phrases-Check + Retry-Pass
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
  {
    id: "newspaper",
    description:
      "Broadsheet-Editorial wie New York Times / Guardian. Italic Headline mit Drop-Cap im Lead-Paragraph, Byline, Magazine-Hero mit Bildunterschrift, 3-Spalten-Zutaten, italic Step-Nummern. Naehrwerte als Spreadsheet-Footer. Editorial-Anspruch, Reisekueche, Saisonal, Sonntag-Klassiker.",
  },
  {
    id: "restaurant",
    description:
      "Fine-Dining-Speisekarte: Cream-BG mit Gold-Akzenten. Hero quadratisch mit Gold-Border, italic Display-Title, Diamant-Ornamente. Dot-Leader-Zutaten, Roman-Numerals-Steps, Wine-Notes-Mikros. Date-Night, festliche Dinner, Premium-Hauptmahlzeiten, Wein-begleitete Kollektionen.",
  },
  {
    id: "studio",
    description:
      "Step-First-Choreographie. Pure-White-Background ohne Tint, kleiner 4:5-Portrait-Hero rechts oben, Big-Number-Steps mit vertikalem Pace-Beat als Hauptbuehne, Zutaten als fluide Inline-Linie unten, Mikros als Italic-Prose ('Reich an Vitamin C 44 %...'). Editorial-Buchstil. Passt zu Recipes wo die Technik wichtiger als die Zutaten ist (Pasta-Klassiker, Saucen, Eintoepfe, Fermentation, Baking-Techniken).",
  },
  {
    id: "feature",
    description:
      "Cinematic-Split-Layout im Magazin-Stil: Content links ~42 % auf warmem Cream-Tint (von Mood abgeleitet), grosses Hero-Foto rechts ~58 % full-bleed mit Soft-Fade in den Content. Sans-Serif, ruhige Hierarchie. Zutaten in zwei adaptive Spalten (Hauptzutaten + Gewuerze/Beilagen, merged bei <6 Items), Steps nummeriert einspaltig, Mikros als kompakter Pill-Strip. Passt zu foto-starken Recipes wo das Bild verkauft: einfache Hauptmahlzeiten (Pasta, Bowls, Salate, Stir-Fries), Brunch-Klassiker, moderne Comfort-Food-Karten, Recipes mit ruhigem Editorial-Anspruch und starkem Hero.",
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

const VALID_PATTERN_IDS = [
  "polka",
  "honeycomb",
  "crosshatch",
  "topo",
  "marble",
  "stripes",
  "grid",
  "confetti",
] as const;

export type PackDesignSuggestion = {
  titles: string[]; // 5 Optionen, sortiert nach Empfehlung (Index 0 = top)
  layout: CardLayout;
  layoutReason: string;
  moodId: string;
  moodReason: string;
  fontId: "fraunces" | "dm-serif" | "inter-tight";
  fontReason: string;
  category: string;
  subtitle: string;
  tagline: string;
  description: string;
  surfaceType: "solid" | "gradient" | "pattern";
  patternId: string;
  surfaceReason: string;
};

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    titles: {
      type: "array",
      items: { type: "string" },
      description:
        "Genau 5 Pack-Titel-Optionen, je 15-40 chars. Index 0 = beste Empfehlung. STILISTISCH UNTERSCHIEDLICH (nicht 5 Varianten desselben Konzepts).",
    },
    layout: {
      type: "string",
      description:
        'Empfohlenes Layout, einer aus: "amber", "editorial", "patisserie", "minimal", "vital", "dashboard", "sport", "newspaper", "restaurant", "studio", "feature". Studio = Step-First-Choreographie mit kleinem Portrait-Hero rechts, Big-Number-Steps als Hauptbühne, Inline-Zutaten unten; passt zu Recipes wo die Technik wichtiger als die Zutaten ist (Pasta-Klassiker, Saucen, Eintöpfe, Fermentation, Baking-Techniken). Feature = Cinematic-Split mit Content links auf Cream-Tint und großem Hero-Foto rechts mit Soft-Fade; Zutaten in 2 Spalten + nummerierte Steps; passt zu foto-starken Mahlzeiten mit ruhigem Editorial-Anspruch (Pasta, Bowls, Salate, Brunch-Klassiker).',
    },
    layoutReason: {
      type: "string",
      description: "Kurze Begründung warum dieses Layout (max 80 chars).",
    },
    moodId: {
      type: "string",
      description:
        'Empfohlene Mood-Palette aus 26 Optionen — siehe MOOD_OPTIONS-Tabelle in der System-Instruction fuer Beschreibungen. Erlaubte Werte: lavender, rose, apricot, honey, blush, buttercream, peach, mauve, sage, mint, eucalyptus, pistachio, moss, sky, mist, powder, ocean, cocoa, terracotta, sand, camel, coral, burgundy, mustard, plum, saffron.',
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
      description: "Kategorie-Bezeichnung (Frühstück, Snacks, Backen, Mittagessen, Mealprep, etc.).",
    },
    subtitle: {
      type: "string",
      description: "Eine Zeile Untertitel, 30-80 chars.",
    },
    tagline: {
      type: "string",
      description: "Teaser mit 2-3 konkreten Recipe-Titles aus der Auswahl, kommagetrennt, 30-120 chars.",
    },
    description: {
      type: "string",
      description:
        "2-3 Saetze Pack-Beschreibung in der Stimme des Creators. 140-280 chars. Bezieht sich konkret auf 1-2 Rezepte aus der Liste.",
    },
    surfaceType: {
      type: "string",
      description:
        'Surface-Style fuer den Pack-Hintergrund, einer aus: "solid", "gradient", "pattern".',
    },
    patternId: {
      type: "string",
      description:
        'Bei surfaceType=pattern: einer aus: "polka", "honeycomb", "crosshatch", "topo", "marble", "stripes", "grid", "confetti". Sonst leerer String.',
    },
    surfaceReason: {
      type: "string",
      description: "Kurze Begründung warum diese Surface-Wahl (max 80 chars).",
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
    "surfaceType",
    "patternId",
    "surfaceReason",
  ],
};

function buildSystemInstruction(brand: Brand | null): string {
  const name = brand?.name ?? "die Creatorin";
  const intro = brand
    ? `Du gestaltest einen Recipe-Pack fuer ${brand.name} (${brand.handle}). Bio: "${brand.bio}". Tagline: "${brand.tagline}".`
    : `Du gestaltest einen Recipe-Pack-Generator.`;

  const voiceBlock = formatVoiceProfileForPrompt(brand?.voiceProfile, name);
  const fewShotBlock = formatCaptionFewShot(brand?.voiceProfile);

  const layoutTable = LAYOUT_OPTIONS.map((l) => `- "${l.id}": ${l.description}`).join("\n");
  const moodTable = MOOD_OPTIONS.map((m) => `- "${m.id}": ${m.description}`).join("\n");
  const fontTable = FONT_OPTIONS.map((f) => `- "${f.id}": ${f.description}`).join("\n");

  return `${intro}

${voiceBlock}

${fewShotBlock}

AUFGABE:
1. 5 Pack-Titel-Optionen (Index 0 = beste Empfehlung)
2. 1 Card-Layout aus 9
3. 1 Mood-Palette aus 8
4. 1 Display-Font aus 3
5. Subtitle, Tagline, Description, Category
6. Surface-Style (solid / gradient / pattern)

PACK-TITEL-REGELN:
- 15-40 chars
- 5 STILISTISCH UNTERSCHIEDLICHE Optionen (nicht 5 Varianten desselben Konzepts)
- Beispiele fuer stilistische Vielfalt: persoenlich-emotional / Charts-Style / knapp-minimalistisch / deutsch-warm / englisch-modern
- KEINE Marketing-Floskeln: keine "perfekt fuer...", "die besten...", "angesagteste...", "must-have"
- KEINE Anfuehrungszeichen, Emojis, Hashtags, Em-Dashes (—)
- Knackig, einpraegsam, klingt nach echtem Creator

LAYOUT-AUSWAHL (picke einen):
${layoutTable}

MOOD-AUSWAHL (picke einen):
${moodTable}

FONT-AUSWAHL (picke einen):
${fontTable}

TONALITAET fuer Description/Subtitle/Tagline:
- ICH-Form als ob ${name} spricht
- KEINE Marketing-Sprache
- Konkret statt abstrakt — nenn ECHTE Rezeptnamen aus der gelieferten Liste

PASSUNG (Layout/Mood/Font zur Rezeptauswahl):
- Dessert/Backwaren → patisserie/amber, lavender/honey, fraunces
- Bowls/Healthy → vital, sage/mint, fraunces oder inter-tight
- Mealprep → dashboard, sky/cocoa, inter-tight
- Snacks → minimal, mint/rose, fraunces
- Comfort-Food/Hauptmahlzeiten → amber, honey, fraunces oder dm-serif
- Date-Night-Dinners / Pariser-Maison / Wein-begleitet → restaurant, honey/cocoa/rose, fraunces

SURFACE-STYLE (sei nicht zwanghaft kreativ — solid sieht oft besser aus):
- DEFAULT: solid
- gradient: Sunset-Vibe, Date-Night, Sommer-BBQ, Cocktails
- pattern: nur wenn klares Signature-Konzept passt
  - honeycomb: Backwaren mit Honig, gesunder Honig-Vibe
  - polka: Snacks, leichte Desserts, kindlich-cozy
  - marble: Premium-Patisserie, edle Desserts
  - stripes: Sport/Energy, Workout-Snacks
  - crosshatch: Editorial/Premium-Hauptmahlzeiten
  - topo: Outdoor/BBQ/Adventure
  - grid: strukturierte Wochenplanung
  - confetti: Festliche Packs

Antworte AUSSCHLIESSLICH im JSON-Schema.`;
}

function buildUserPrompt(reels: ReelRow[]): string {
  const reelLines = reels
    .slice(0, 30)
    .map((r) => {
      const tags = [r.meal_type, r.cuisine, r.main_ingredient, r.occasion, r.season, r.vessel]
        .filter(Boolean)
        .join("/");
      const dietary = r.dietary?.length ? ` [${r.dietary.join(",")}]` : "";
      const time = r.estimated_time_minutes ? ` ${r.estimated_time_minutes}min` : "";
      return `• ${r.recipe_title || r.caption.slice(0, 60)} (${tags})${dietary}${time}`;
    })
    .join("\n");

  return `Anzahl ausgewaehlter Reels: ${reels.length}

Reel-Auswahl (NUR diese Rezepte sind im Pack — Titel/Tagline/Description duerfen nur auf diese verweisen, nichts dazu erfinden):
${reelLines}

Generiere Design-Vorschlaege im JSON-Schema.`;
}

function applyDefensiveValidation(result: PackDesignSuggestion): PackDesignSuggestion {
  const validLayout = LAYOUT_OPTIONS.find((l) => l.id === result.layout);
  const validMood = MOOD_OPTIONS.find((m) => m.id === result.moodId);
  const validFont = FONT_OPTIONS.find((f) => f.id === result.fontId);
  const validSurface =
    result.surfaceType === "solid" ||
    result.surfaceType === "gradient" ||
    result.surfaceType === "pattern";
  const safePatternId =
    result.surfaceType === "pattern" &&
    (VALID_PATTERN_IDS as readonly string[]).includes(result.patternId)
      ? result.patternId
      : "";

  return {
    ...result,
    titles: Array.isArray(result.titles) ? result.titles.slice(0, 5) : [],
    layout: validLayout ? (result.layout as CardLayout) : "editorial",
    moodId: validMood ? result.moodId : "honey",
    fontId: validFont
      ? (result.fontId as "fraunces" | "dm-serif" | "inter-tight")
      : "fraunces",
    surfaceType: validSurface ? result.surfaceType : "solid",
    patternId: safePatternId,
  };
}

export async function suggestPackDesign(
  reels: ReelRow[],
  brand?: Brand | null
): Promise<PackDesignSuggestion> {
  if (reels.length === 0) {
    throw new Error("suggestPackDesign: keine Reels uebergeben");
  }

  // Lazy-Backfill: wenn der Brand kein Voice-Profil hat, leiten wir es
  // jetzt aus den DB-Captions ab + persistieren. Naechster Call profitiert.
  const brandSafe = await ensureBrandVoiceProfile(brand);
  const brandBanned = brandSafe?.voiceProfile?.bannedPhrases ?? [];

  const result = await generateWithCritique<PackDesignSuggestion>({
    schema: RESPONSE_SCHEMA,
    generationPrompt: buildUserPrompt(reels),
    generationSystemInstruction: buildSystemInstruction(brandSafe),
    candidateCount: 3,
    generationTemperature: 0.75,
    maxOutputTokens: 2048,
    brandBannedPhrases: brandBanned,
    bannedCheckFields: ["subtitle", "tagline", "description"],
    scorableFields: [
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
          "Nennt 2-3 ECHTE Rezeptnamen aus der Auswahl. Keine erfundenen Gerichte.",
      },
      {
        key: "description",
        label: "Description",
        minLength: 140,
        maxLength: 280,
        goodCriteria:
          "2-3 Saetze in der Stimme des Creators, bezieht sich konkret auf Rezepte. Klingt persoenlich.",
      },
    ],
    preFilter: (c) => {
      // Hard-Reject wenn Pflichtfelder fehlen
      if (!c.description?.trim() || !c.subtitle?.trim()) return true;
      if (!Array.isArray(c.titles) || c.titles.length < 3) return true;
      return false;
    },
    debugTag: "suggest-pack-design",
  });

  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[suggest-pack-design] passes=${result.passes} cleanCount=${result.cleanCount} winnerBannedHits=${result.winnerBannedHits.length}`
    );
  }

  return applyDefensiveValidation(result.winner);
}
