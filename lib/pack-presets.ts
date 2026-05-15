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
    id: "newspaper",
    title: "Newspaper",
    description:
      "Broadsheet-Editorial wie New York Times / Guardian: italic Headline mit Drop-Cap im Lead-Paragraph, Byline „Von [Brand]\", Magazine-Hero mit Bildunterschrift, Zutaten in 3 Spalten (Newspaper-typisch), Schritte in 2 Spalten mit italic Nummern. Nährwerte als Spreadsheet-Footer mit Doppellinie. Komplett anderes Mikronährstoffe-Layout (unten als Daten-Zeile) statt seitlich/oben.",
    bestFor:
      "Hochwertige Recipe-Kollektionen mit editorialem Anspruch, Magazin-Pack-Konzepte, Pack-Themen die Lese-Tiefe brauchen (Reiseküche, Saisonal, Sonntag-Recipes)",
  },
  {
    id: "restaurant",
    title: "Restaurant Menu",
    description:
      "Fine-Dining-Speisekarte: Cream-Background mit Gold-Akzenten, quadratisches Hero mit dünner Gold-Border, italic Fraunces-Display-Title, Diamant-Ornamente. Zutaten mit klassischem Dot-Leader-Pattern (Name........Menge), Schritte mit Roman-Numerals (I, II, III, IV). Mikronährstoffe als beschreibender Wine-Notes-Block unten (Reich an Vitamin C, Calcium, frisch wie ein Sommerwein) plus dezenter %-Subline. Maison-Original-Aesthetik wie ein Pariser Bistro-Menu.",
    bestFor:
      "Date-Night-Packs, festliche Dinner-Menus, Premium-Hauptmahlzeiten, edle Desserts, Wein-begleitete Kollektionen, Sonntag-Brunch-Hits",
  },
  {
    id: "studio",
    title: "Studio (Step-First)",
    description:
      'Choreographie-Layout: Die Zubereitung wird zum Helden. Kleiner 4:5-Portrait-Hero rechts oben, Big-Number-Steps mit vertikalem Pace-Beat als Hauptbühne, Zutaten als fluide Inline-Linie unten, Mikronährstoffe als prose-Bildunterschrift (Reich an Vitamin C 44 %, Calcium 23 %...). Pure-White-Background, kein Tint - Editorial-Buchstil. Auto-Fit über 3 Density-Stufen, Title-Auto-Shrink, 2-Spalten-Steps ab 10+ Schritten - passt immer auf eine Seite, egal wie viele Zutaten oder Schritte.',
    bestFor:
      "Recipes wo die Technik wichtiger als die Zutaten ist (Pasta-Klassiker, Saucen, Eintöpfe, Fermentation, Baking-Techniken, Hauptmahlzeiten mit klarer Abfolge)",
  },
  {
    id: "feature",
    title: "Feature (Cinematic Split)",
    description:
      "Editorial-Split-Layout im Magazin-Stil: Content links auf warmem Cream-Tint (~42 % Breite), großes Hero-Foto rechts full-bleed (~58 %) mit Soft-Fade in den Content-Bereich. Sans-Serif-Typografie, ruhige Hierarchie, Zutaten in zwei Spalten (Hauptzutaten + Gewürze/Beilagen) die bei wenig Content automatisch auf eine Spalte zusammenfließen. Steps nummeriert links, Mikronährstoffe als kompakter Strip vor den Schritten, Story als optionaler italic Block unter dem Titel. Auto-Fit über 3 Density-Stufen, Title-Shrink, Step-Font-Shrink ab 8+ Schritten — bleibt immer auf einer Seite, kein Waste bei kurzen Recipes.",
    bestFor:
      "Foto-starke Recipes mit ruhiger Hierarchie: einfache Hauptmahlzeiten (Pasta, Bowls, Salate, Stir-Fries), Brunch-Klassiker, Magazin-Editorial-Vibe, Recipes wo das Bild verkauft",
  },
];

// Mood presets — 24 hand-tuned Paletten, organisiert in 5 Farbfamilien.
// Alle Paletten passen Kontrast-Checks (ink auf background min ~6:1, accent
// auf background min ~4.5:1). Free-Form-Color-Picker bleibt bewusst aus —
// eine schlechte Palette (weiß auf hellbeige) kostet mehr als ein
// kuratiertes Set. Wenn wir mehr brauchen, hier dazu — der Pack-Editor
// gruppiert automatisch nach `family`.
export type MoodFamily = "warm" | "fresh" | "cool" | "earth" | "statement";

export type MoodPreset = {
  id: string;
  label: string;
  hint: string;
  family: MoodFamily;
  mood: PackMood;
};

export const moodPresets: MoodPreset[] = [
  // ─── WARM-PASTEL — sanft, einladend, Patisserie/Frühstück/Süßes ─────────
  { id: "lavender", label: "Lavender", hint: "Weich, Patisserie-Vibe — perfekt für Backwaren", family: "warm",
    mood: { background: "#ddc9e8", accent: "#735090", ink: "#241830", inkSoft: "#503d6b" } },
  { id: "rose", label: "Soft Rose", hint: "Fruchtig-warm, Beeren-Rezepte, Frühstücke", family: "warm",
    mood: { background: "#f3cdd3", accent: "#a94d61", ink: "#2a1418", inkSoft: "#6b3340" } },
  { id: "apricot", label: "Apricot", hint: "Warm-orange, Smoothies, Kürbis-Kuchen", family: "warm",
    mood: { background: "#f7d4b8", accent: "#b8642b", ink: "#2c1810", inkSoft: "#6e3d1d" } },
  { id: "honey", label: "Honey", hint: "Warmer Honey-Ton — perfekt für Hauptmahlzeiten", family: "warm",
    mood: { background: "#f4d88d", accent: "#b07a2a", ink: "#2b1f10", inkSoft: "#5e4720" } },
  { id: "blush", label: "Blush", hint: "Warmes Rosé — Berry-Bowls, Smoothies, Frühstücks-Packs", family: "warm",
    mood: { background: "#f4dcd2", accent: "#c4716e", ink: "#2e1814", inkSoft: "#6b3530" } },
  { id: "buttercream", label: "Buttercream", hint: "Cremige Vanille — Kuchen, Cookies, Desserts", family: "warm",
    mood: { background: "#fae8b8", accent: "#c19140", ink: "#2f2210", inkSoft: "#6d5223" } },
  { id: "peach", label: "Peach", hint: "Pfirsich — Sommer-Rezepte, Eis, Iced-Drinks", family: "warm",
    mood: { background: "#fad6c0", accent: "#c66f3d", ink: "#2d1810", inkSoft: "#6e3a1e" } },
  { id: "mauve", label: "Mauve", hint: "Gedämpftes Rosé-Lila — Premium-Patisserie, Tea-Time", family: "warm",
    mood: { background: "#e4cad8", accent: "#8a4769", ink: "#2a1620", inkSoft: "#5e2e4a" } },

  // ─── FRESH — natürlich, gesund, Gemüse/Bowls/Healthy ────────────────────
  { id: "sage", label: "Sage Green", hint: "Frisch, Volumen-fokus — perfekt für Bowls", family: "fresh",
    mood: { background: "#c8e2a8", accent: "#527a2c", ink: "#1f2a14", inkSoft: "#3f5b22" } },
  { id: "mint", label: "Mint", hint: "Cool, Apple-Aesthetik — perfekt für Snacks", family: "fresh",
    mood: { background: "#b8dcc9", accent: "#3f7560", ink: "#16291f", inkSoft: "#365546" } },
  { id: "eucalyptus", label: "Eucalyptus", hint: "Gedämpftes Grün — Detox, Smoothie-Bowls, Clean Eating", family: "fresh",
    mood: { background: "#c8d8c5", accent: "#4f7c5d", ink: "#1a2e1f", inkSoft: "#34593d" } },
  { id: "pistachio", label: "Pistachio", hint: "Helles fröhliches Grün — Pasta-Verde, Frühlings-Rezepte", family: "fresh",
    mood: { background: "#d8e8b8", accent: "#6e8c3a", ink: "#1c2a14", inkSoft: "#4a6228" } },
  { id: "moss", label: "Moss", hint: "Wald-Grün — Wild-Kräuter, Pilze, Herbst-Eintöpfe", family: "fresh",
    mood: { background: "#b8c8a8", accent: "#4a6535", ink: "#1a2014", inkSoft: "#36482d" } },

  // ─── COOL — modern, clean, Notion/Tech/Mealprep ─────────────────────────
  { id: "sky", label: "Sky Blue", hint: "Strukturiert, Notion-Vibe — perfekt für Meal-Prep", family: "cool",
    mood: { background: "#b4cde4", accent: "#3a6090", ink: "#1a2433", inkSoft: "#3a4866" } },
  { id: "mist", label: "Mist", hint: "Gedämpftes Grau-Blau — Editorial-Health, Clean-Minimal", family: "cool",
    mood: { background: "#d4dde2", accent: "#5d7787", ink: "#1c2429", inkSoft: "#3e505b" } },
  { id: "powder", label: "Powder", hint: "Sehr helles Pastell-Blau — Sommer-Drinks, Eis-Rezepte", family: "cool",
    mood: { background: "#d8e2ee", accent: "#6a89a8", ink: "#1d2935", inkSoft: "#44576a" } },
  { id: "ocean", label: "Ocean", hint: "Türkis-Petrol — Fisch, Seafood, Mediterrane Küche", family: "cool",
    mood: { background: "#b8d4d4", accent: "#356c70", ink: "#142426", inkSoft: "#2d4c4e" } },

  // ─── EARTH — warm-neutral, rustic, Kaffee/Bäcker/Comfort ────────────────
  { id: "cocoa", label: "Cocoa Cream", hint: "Tief, Schokoladen-Rezepte, Tiramisu", family: "earth",
    mood: { background: "#e0cdb6", accent: "#7a4a2a", ink: "#2a1810", inkSoft: "#5a3a23" } },
  { id: "terracotta", label: "Terracotta", hint: "Rot-Orange-Erde — Mexican, Mediterran, Bohnen-Gerichte", family: "earth",
    mood: { background: "#e8b89a", accent: "#b85a3a", ink: "#2c1612", inkSoft: "#6b3624" } },
  { id: "sand", label: "Sand", hint: "Warm-Beige — Reis, Couscous, Brot, Frühstück", family: "earth",
    mood: { background: "#ecddc4", accent: "#a07a44", ink: "#2a1f10", inkSoft: "#5d4628" } },
  { id: "camel", label: "Camel", hint: "Gold-Tan — Bratenfond, Karamell, Herbst", family: "earth",
    mood: { background: "#d8c2a0", accent: "#97703c", ink: "#281e12", inkSoft: "#5c4928" } },

  // ─── STATEMENT — mutig, modern, Premium/Date-Night/Editorial ────────────
  { id: "coral", label: "Coral", hint: "Lebendiges Orange-Pink — Brunch, BBQ, Sommer-Statement", family: "statement",
    mood: { background: "#fbb09a", accent: "#d54e3a", ink: "#2b1410", inkSoft: "#6a2d22" } },
  { id: "burgundy", label: "Burgundy", hint: "Tiefes Weinrot — Date-Night-Dinner, Schokolade, Wein-Pairing", family: "statement",
    mood: { background: "#d8a8b0", accent: "#8a2a3a", ink: "#28121a", inkSoft: "#5a1f29" } },
  { id: "mustard", label: "Mustard", hint: "Sattes Senfgelb — Senf-Vinaigrette, Indian, Curry", family: "statement",
    mood: { background: "#e4cc60", accent: "#8a6a14", ink: "#261d08", inkSoft: "#574308" } },
  { id: "plum", label: "Plum", hint: "Kräftiges Lila — Premium-Patisserie, Beeren, Pflaumen", family: "statement",
    mood: { background: "#c8a4c0", accent: "#6a2860", ink: "#1f0c1c", inkSoft: "#461842" } },
  { id: "saffron", label: "Saffron", hint: "Warmes Safran-Orange — Paella, Risotto, Indian-Cuisine", family: "statement",
    mood: { background: "#f0c878", accent: "#b8772a", ink: "#2a1d0c", inkSoft: "#5e3d17" } },
];

// Mood-Familien für gruppierte UI-Anzeige im Pack-Editor.
export const moodFamilies: Array<{ id: MoodFamily; label: string; hint: string }> = [
  { id: "warm", label: "Warm-Pastel", hint: "Patisserie, Frühstück, Süßes" },
  { id: "fresh", label: "Fresh", hint: "Bowls, Veggies, Healthy" },
  { id: "cool", label: "Cool", hint: "Mealprep, Notion-Vibe, Modern-Minimal" },
  { id: "earth", label: "Earth", hint: "Rustic, Kaffee, Bäcker, Comfort" },
  { id: "statement", label: "Statement", hint: "Premium, Date-Night, Editorial" },
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
