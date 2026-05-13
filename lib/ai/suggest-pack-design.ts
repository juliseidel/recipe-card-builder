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
  {
    id: "vinyl",
    description:
      "12\"-Schallplatte mit Hero als Center-Label, schwarze Disc mit Grooves, Audio-Spec-Strip (KCAL/MIN/KEY) + Top-Mikros, Steps als A-Side/B-Side-Tracklist (A1, A2, B1, B2), Zutaten als Liner-Notes. Pressed-by-Brand-Footer. Maximaler Wow-Faktor, einzigartig vs. allen anderen Layouts. Passt fuer Mealprep-Compilations, Hauptmahlzeiten-Packs, Show-Off-Sammlungen, alles wo der User eine Signature-Statement-Card haben moechte.",
  },
  {
    id: "newspaper",
    description:
      "Broadsheet-Editorial wie New York Times / Guardian. Italic Headline mit Drop-Cap im Lead-Paragraph, Byline 'Von [Brand]', Magazine-Hero mit Bildunterschrift. Zutaten in 3 Spalten (Newspaper-typisch), Schritte in 2 Spalten mit italic Nummern. Naehrwerte als Spreadsheet-Footer-Row mit Doppellinie. Mikros in EIGENER Position (unten als Daten-Zeile) statt seitlich/oben. Passt fuer hochwertige Recipe-Kollektionen mit editorialem Anspruch, Magazin-Pack-Konzepte, Reiseküche, Saisonal, Sonntag-Klassiker.",
  },
  {
    id: "constellation",
    description:
      "Sternkarten-Look auf Dark-Sky-Background (Marineblau, #0a0e1f). Hero rund mit Glow-Halo, italic Fraunces-Title in cream-Weiss, ✦-Stern-Bullets bei Zutaten, Schritte als Trajectory mit Station-Markern. Mikronaehrstoffe in EIGENER Position: als Planeten-Symbole vertikal am rechten Rand (kleine Akzent-Kreise mit %-Wert, durch Connection-Line verbunden). Background-Sterne als Atmosphaere. Sehr eigenstaendige Premium-Optik, Dark-Mode-Pop. Passt fuer Premium-Mealprep-Packs, Show-Off-Sammlungen, Dessert-Editions, Nacht- und Sunset-Themen, alles wo der Pack im Browser pop machen soll.",
  },
  {
    id: "restaurant",
    description:
      "Fine-Dining-Speisekarte: Cream-Background (#fcf9f3) mit Gold-Akzenten (#b08842). Hero quadratisch mit duenner Gold-Border, italic Fraunces-Display-Title zentriert, ◆-Diamant-Ornamente. Zutaten mit klassischem Dot-Leader-Pattern (Name....Menge), Schritte mit Roman-Numerals (I, II, III). Mikronaehrstoffe in EIGENER Position: als beschreibender 'Wine Notes'-Block unten ('Reich an Vitamin C, Calcium, frisch wie ein Sommerwein') plus dezenter %-Subline. Maison-Pariser-Bistro-Aesthetik. Passt fuer Date-Night-Packs, festliche Dinners, Premium-Hauptmahlzeiten, edle Desserts, Wein-begleitete Kollektionen, Sonntag-Brunch.",
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
  /** Empfohlener Surface-Style (solid/gradient/pattern). Default solid
   *  (klassischer Look). Pattern/Gradient nur wenn es zum Pack-Thema
   *  passt (z.B. honeycomb fuer Biene-Patisserie, stripes fuer Sport,
   *  marble fuer Premium-Dessert). */
  surfaceType: "solid" | "gradient" | "pattern";
  /** Bei pattern: ein patternId aus dem Katalog. Sonst "". */
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
        "Genau 5 Pack-Titel-Optionen auf Deutsch, je max 40 chars. Index 0 = beste Empfehlung. KEINE Anführungszeichen, KEINE Emojis, KEINE Marketing-Floskeln.",
    },
    layout: {
      type: "string",
      description:
        'Empfohlenes Layout, einer aus: "amber", "editorial", "patisserie", "minimal", "vital", "dashboard", "sport", "vinyl", "newspaper", "constellation", "restaurant".',
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
    surfaceType: {
      type: "string",
      description:
        'Surface-Style fuer den Pack-Hintergrund, einer aus: "solid" (klassische einfarbige Flaeche, sicherer Default), "gradient" (Farbverlauf, premium-feel fuer Premium-Themen), "pattern" (Texturmuster, signature-feel). Empfehlung: meistens solid; gradient bei Premium-Sunset-Themen / Brunch / Date-Night; pattern wenn Recipe-Auswahl ein klares Signature hat (Biene-Backwelt → honeycomb, Sport → stripes).',
    },
    patternId: {
      type: "string",
      description:
        'Bei surfaceType=pattern: einer aus: "polka", "honeycomb", "crosshatch", "topo", "marble", "stripes", "grid", "confetti". Sonst leerer String. polka = leichtere Snacks/Dessert. honeycomb = Biene/Backen/Bowls. crosshatch = Editorial/Premium. topo = Outdoor/BBQ/Adventure. marble = Premium-Patisserie/Dessert. stripes = Sport/Energy/Bold. grid = Mealprep/Strukturiert. confetti = Festlich/Party.',
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
- Wenn Mealprep → dashboard ODER vinyl, sky/cocoa, inter-tight
- Wenn Snacks → minimal, mint/rose, fraunces
- Wenn Comfort-Food/Hauptmahlzeiten → amber, honey, fraunces oder dm-serif
- Wenn der User eine Signature-Compilation will (Top-Hits, Mealprep-Lieblinge,
  Wochenstars) oder eine Show-Off-Sammlung → vinyl, cocoa/honey, fraunces.
  vinyl ist deutlich von allen anderen Layouts unterscheidbar (Schallplatten-
  Look) — gut wenn das Pack im Browser pop machen soll.
- Wenn der User Dark-Mode-Optik / Premium-Show-Off / Nacht-Sunset-Themen
  will (z.B. Date-Night-Desserts, Premium-Mealprep, "after dark"-Snacks) →
  constellation, cocoa/honey/lavender, fraunces. Sehr eigenstaendige Dark-Sky-
  Optik (dunkles Marineblau + Sternen-Background), Mikros als Planeten-Symbole.
- Wenn das Pack ein Restaurant-/Bistro-Feel haben soll (Date-Night-Dinners,
  Pariser-Maison-Aesthetik, mehrgaengige Menus, edle Hauptmahlzeiten, Wein-
  begleitete Rezepte) → restaurant, honey/cocoa/rose, fraunces. Cream-BG mit
  Gold-Ornamenten, Dot-Leader bei Zutaten, Roman-Numerals bei Steps, Wine-
  Notes-Block fuer Mikros.

SURFACE-STYLE (Pack-Hintergrund) — sei mutig wo es passt:
- DEFAULT: solid — wirkt clean, sicher, immer ok
- gradient: wenn die Recipe-Auswahl warm/premium/sunset-Vibe hat (Date-Night Pasta, Sommer-BBQ, Cocktails, Sunset-Brunch)
- pattern: wenn die Auswahl ein klares Signature-Konzept hat
  - honeycomb: Biene-Brand, Backwaren mit Honig, gesunder Honig-Vibe
  - polka: Snacks, leichte Desserts, kindlich-cozy
  - marble: Premium-Patisserie, edle Desserts, Tiramisu
  - stripes: Sport/Energy, Workout-Snacks, Protein-Focused
  - crosshatch: Editorial/Premium-Hauptmahlzeiten
  - topo: Outdoor/BBQ/Adventure-Food
  - grid: Mealprep, strukturierte Wochenplanung
  - confetti: Festliche Packs, Geburtstagskuchen, Party-Snacks

Wenn unsicher: solid. Sei nicht zwanghaft kreativ — solid sieht oft besser aus.

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
  const validSurface =
    result.surfaceType === "solid" ||
    result.surfaceType === "gradient" ||
    result.surfaceType === "pattern";
  const validPatterns = [
    "polka",
    "honeycomb",
    "crosshatch",
    "topo",
    "marble",
    "stripes",
    "grid",
    "confetti",
  ];
  const safePatternId =
    result.surfaceType === "pattern" && validPatterns.includes(result.patternId)
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
