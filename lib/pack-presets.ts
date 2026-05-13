import type { CardLayout, PackMood } from "./packs";

// Layout presets shown in the pack-editor. Each has a short rationale so the
// user knows when to pick what — these are the same five layouts the curated
// packs use, no fancy new options. Order matches the curated pack ordering
// (Editorial first because it's the most "magazine-feeling" default).
export type LayoutPreset = {
  id: CardLayout;
  title: string;
  description: string;
  bestFor: string;
};

export const layoutPresets: LayoutPreset[] = [
  {
    id: "amber",
    title: "Amber",
    description:
      "Sunset-Editorial Premium: Hero zentriert mit Honey-Glow-Halo, Avatar-Stempel mit Honey-Ring, typografischer Macro-Stat-Ribbon (Big-Numbers in einer Zeile), Mikronährstoffe als vertikale Bar-Liste mit %-Indikator. Wie eine Doppelseite aus Bon Appétit / Saveur.",
    bestFor: "Hauptmahlzeiten, Sattmacher, Feierabend-Klassiker",
  },
  {
    id: "editorial",
    title: "Editorial (Klassisch)",
    description:
      "Magazine-Look mit großem Hero-Bild und Mikronährstoff-Banner oben. Title-Section überschneidet das Foto, Stats in 4 Tiles, Pull-Quote für die Creator-Story.",
    bestFor: "Älteres Hauptmahlzeiten-Layout — wir empfehlen Amber stattdessen",
  },
  {
    id: "patisserie",
    title: "Patisserie",
    description:
      "Magazin-Spread: linke Sidebar in Mood-Farbe mit italic Display-Title, Polaroid-Foto, Mikronährstoffen vertikal und Avatar-Anker. Rechte Cream-Spalte mit Stats, Macro-Pills und Rezept-Body.",
    bestFor: "Backwaren, süße Desserts, anrichten-fokussierte Karten",
  },
  {
    id: "minimal",
    title: "Cookbook-Cover",
    description:
      "Hero-Bild fuellt die obere Haelfte als Cookbook-Cover, Title als Mega-Display-Overlay, Creator-Avatar als Stempel rechts. Apple-Spec-Strip mit kcal/Macros/Zeit, Mikros als Capsule-Pills, Mint-getoenter QR-Stempel.",
    bestFor: "Snacks, Showpiece-Rezepte, Karten mit starkem Hero-Bild",
  },
  {
    id: "vital",
    title: "Vital-Stack",
    description:
      "Drei gestapelte Premium-Cards: Hero-Card mit Avatar-Stempel, Nährstoff-Card mit Donut-Ringen für Macros + horizontaler Mikro-Pearl-Strip, Zubereitungs-Card mit Dot-Leader-Zutaten und Time-Marker-Steps. Apple-Health-meets-Cookbook.",
    bestFor: "Volumen, High-Protein, Diet-Fokus, frische Premium-Mahlzeiten",
  },
  {
    id: "dashboard",
    title: "Dashboard",
    description:
      "Notion-Style: Wochentag-Tag, Data-Rows mit Icons (🍴🔥💪⏱📊), 'Mealprep-Ready'-Marker. Strukturiert wie ein Wochenplaner.",
    bestFor: "Mealprep, Wochenplanung, operative Karten",
  },
  {
    id: "sport",
    title: "Sport",
    description:
      "Macro-Bars mit Emojis 💪🌾🥑, Zutaten-Cart mit Checkboxen, Schritt-Timeline mit Verbindungslinien.",
    bestFor: "Aelteres Fitness-Layout — wir empfehlen Vital-Stack stattdessen",
  },
  {
    id: "vinyl",
    title: "Vinyl",
    description:
      "12\"-Schallplatte: Hero als Center-Label auf schwarzer Disc mit Grooves, Title darunter, Audio-Spec-Strip (KCAL · MIN · KEY), Top-Mikros als Spec-Zeile. Steps als A-Side/B-Side-Tracklist (A1, A2, B1, B2). Zutaten als Liner-Notes in 2 Spalten. Footer „Pressed by [Brand]“. Komplett neue Design-Sprache aus der Musik-/Audio-Welt.",
    bestFor:
      "Mealprep-Sammlungen, Hauptmahlzeiten-Packs, Compilation-artige Kollektionen, jeder Pack der einen Signature-Wow-Faktor braucht",
  },
  {
    id: "newspaper",
    title: "Newspaper",
    description:
      "Broadsheet-Editorial wie New York Times / Guardian: italic Headline mit Drop-Cap im Lead-Paragraph, Byline „Von [Brand]\", Magazine-Hero mit Bildunterschrift, Zutaten in 3 Spalten (Newspaper-typisch), Schritte in 2 Spalten mit italic Nummern. Nährwerte als Spreadsheet-Footer mit Doppellinie. Komplett anderes Mikronährstoffe-Layout (unten als Daten-Zeile) statt seitlich/oben.",
    bestFor:
      "Hochwertige Recipe-Kollektionen mit editorialem Anspruch, Magazin-Pack-Konzepte, Pack-Themen die Lese-Tiefe brauchen (Reiseküche, Saisonal, Sonntag-Recipes)",
  },
  {
    id: "constellation",
    title: "Constellation",
    description:
      "Sternkarten-Look auf Dark-Sky-Background (Marineblau): Hero rund mit Glow-Halo, italic Fraunces-Title in cream-Weiß, Mikronährstoffe als Planeten-Symbole am rechten Rand (kleine Akzent-Kreise mit %-Wert, vertikal verbunden), Zutaten mit ✦-Stern-Bullets, Schritte als Trajectory (horizontale Linie mit Station-Markern bei ≤4 Steps, sonst 2-Spalten-Grid). Background-Sterne als Atmosphäre. Sehr eigenständige Premium-Optik.",
    bestFor:
      "Premium-Mealprep-Packs, Show-Off-Sammlungen, Dessert-Editions, Nacht- und Sunset-Themen, alles wo Dark-Mode-Pop gewünscht ist",
  },
];

// Mood presets — eight pre-tuned palettes that pass contrast checks and look
// on-brand for Biene's cream-base universe. Free-form color picker is
// intentionally not exposed in the editor — the cost of one bad palette
// (white text on light beige) outweighs the benefit. If we ever need more,
// we add presets here.
export type MoodPreset = {
  id: string;
  label: string;
  hint: string;
  mood: PackMood;
};

export const moodPresets: MoodPreset[] = [
  {
    id: "lavender",
    label: "Lavender",
    hint: "Weich, Patisserie-Vibe — perfekt für Backwaren",
    mood: {
      background: "#ddc9e8",
      accent: "#735090",
      ink: "#241830",
      inkSoft: "#503d6b",
    },
  },
  {
    id: "sage",
    label: "Sage Green",
    hint: "Frisch, Volumen-fokus — perfekt für Bowls",
    mood: {
      background: "#c8e2a8",
      accent: "#527a2c",
      ink: "#1f2a14",
      inkSoft: "#3f5b22",
    },
  },
  {
    id: "mint",
    label: "Mint",
    hint: "Cool, Apple-Aesthetik — perfekt für Snacks",
    mood: {
      background: "#b8dcc9",
      accent: "#3f7560",
      ink: "#16291f",
      inkSoft: "#365546",
    },
  },
  {
    id: "sky",
    label: "Sky Blue",
    hint: "Strukturiert, Notion-Vibe — perfekt für Meal-Prep",
    mood: {
      background: "#b4cde4",
      accent: "#3a6090",
      ink: "#1a2433",
      inkSoft: "#3a4866",
    },
  },
  {
    id: "honey",
    label: "Honey",
    hint: "Warmer Honey-Ton — perfekt für Hauptmahlzeiten",
    mood: {
      background: "#f4d88d",
      accent: "#b07a2a",
      ink: "#2b1f10",
      inkSoft: "#5e4720",
    },
  },
  {
    id: "rose",
    label: "Soft Rose",
    hint: "Fruchtig-warm, Beeren-Rezepte, Frühstücke",
    mood: {
      background: "#f3cdd3",
      accent: "#a94d61",
      ink: "#2a1418",
      inkSoft: "#6b3340",
    },
  },
  {
    id: "apricot",
    label: "Apricot",
    hint: "Warm-orange, Smoothies, Kürbis-Kuchen",
    mood: {
      background: "#f7d4b8",
      accent: "#b8642b",
      ink: "#2c1810",
      inkSoft: "#6e3d1d",
    },
  },
  {
    id: "cocoa",
    label: "Cocoa Cream",
    hint: "Tief, Schokoladen-Rezepte, Tiramisu",
    mood: {
      background: "#e0cdb6",
      accent: "#7a4a2a",
      ink: "#2a1810",
      inkSoft: "#5a3a23",
    },
  },
];

// Display fonts a custom pack can pick. Same three the curated packs use.
export const displayFontOptions = [
  { id: "fraunces", label: "Fraunces", hint: "Warm-serif, Cookbook-Vibe" },
  {
    id: "dm-serif",
    label: "DM Serif Display",
    hint: "Hoch, editorial, magazine",
  },
  {
    id: "inter-tight",
    label: "Inter Tight",
    hint: "Bold sans, sportlich-clean",
  },
] as const;
