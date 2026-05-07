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
    id: "editorial",
    title: "Editorial",
    description:
      "Magazine-Look mit großem Hero-Bild und Mikronährstoff-Banner oben. Title-Section überschneidet das Foto, Stats in 4 Tiles, Pull-Quote für Bienes Story.",
    bestFor: "Hauptmahlzeiten, Mealprep, hohe Protein-Werte",
  },
  {
    id: "patisserie",
    title: "Patisserie",
    description:
      "Boutique-Bäckerei: italic Display-Font, Polaroid-Foto rechts mit -2°-Drehung, Macros als elegante Pills.",
    bestFor: "Backwaren, süße Desserts, anrichten-fokussierte Karten",
  },
  {
    id: "minimal",
    title: "Minimal",
    description:
      "Apple-Vibe: 140-px-Karten-Number, Bold Sans-Serif, viel Whitespace, kompakte 3-Stat-Box.",
    bestFor: "Kurze Snacks, klare Typografie, kalorisch fokussiert",
  },
  {
    id: "sport",
    title: "Sport",
    description:
      "Macro-Bars mit Emojis 💪🌾🥑, Zutaten-Cart mit Checkboxen, Schritt-Timeline mit Verbindungslinien.",
    bestFor: "High-Protein, Volumen, Fitness-Mahlzeiten",
  },
  {
    id: "dashboard",
    title: "Dashboard",
    description:
      "Notion-Style: Wochentag-Tag, Data-Rows mit Icons (🍴🔥💪⏱📊), 'Mealprep-Ready'-Marker. Strukturiert wie ein Wochenplaner.",
    bestFor: "Mealprep, Wochenplanung, operative Karten",
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
    hint: "Weich, Patisserie-Vibe — wie Bienes Backwelt",
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
    hint: "Frisch, Volumen-fokus — wie Volumen-Wunder",
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
    hint: "Cool, Apple-Aesthetik — wie Bienes Snacks",
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
    hint: "Strukturiert, Notion-Vibe — wie Meal-Prep Heroes",
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
    hint: "Bienen-Signaturfarbe, Hauptmahlzeiten — wie Feierabend-Klassiker",
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
