/**
 * Theme system — five truly distinct editorial worlds in @bienesfitlife's universe.
 *
 * Each theme is a *publishing house*, not a colour swap:
 * — its own typographic system,
 * — its own palette anchor,
 * — its own layout DNA,
 * — its own ornament vocabulary,
 * — its own micro-interaction rhythm.
 */

export type ThemePalette = {
  paper: string;        // primary surface (cream/beige base)
  paperDeep: string;    // surface 2 (slightly deeper paper)
  paperVeil: string;    // surface for muted blocks
  ink: string;          // primary text
  inkSoft: string;      // secondary text
  inkMute: string;      // tertiary text / dividers
  hairline: string;     // borders
  accent: string;       // primary accent (the soul colour)
  accentSoft: string;   // accent tint
  accentDeep: string;   // accent shadow / hover
  highlight: string;    // tertiary highlight (gold/sage etc.)
};

export type ThemeFonts = {
  display: string;       // hero/title font
  body: string;          // running text
  meta: string;          // labels, tags, numbers
  script?: string;       // optional handwriting (signature)
};

export type ThemeLayoutId =
  | "editorial-cookbook"
  | "swiss-editorial"
  | "patisserie-romantic"
  | "rustic-spread"
  | "modern-planner";

export type ThemeMotion = {
  spring: { stiffness: number; damping: number; mass?: number };
  stagger: number; // seconds
  reducedMotionFallback: "fade" | "none";
};

export type Theme = {
  id: string;
  name: string;
  tagline: string;
  layout: ThemeLayoutId;
  publishingHouse: string; // the editorial inspiration
  palette: ThemePalette;
  fonts: ThemeFonts;
  motion: ThemeMotion;
  ornament:
    | "honey-drop"
    | "rule-only"
    | "fleuron"
    | "sage-sprig"
    | "tab-marker";
  imageStylePrompt: string;
};

export const themes: Record<string, Theme> = {
  /* ─────────────────────────────────────────────────────
   * 1.  SWEET MORNINGS — Editorial Cookbook
   *     "Yotam Ottolenghi-meets-Bon-Appétit"
   * ───────────────────────────────────────────────────── */
  "sweet-mornings": {
    id: "sweet-mornings",
    name: "Sweet Mornings",
    tagline: "High-Protein Frühstücks-Klassiker",
    layout: "editorial-cookbook",
    publishingHouse: "Editorial Cookbook · Phaidon-style",
    palette: {
      paper: "#faf6ee",
      paperDeep: "#f3ebd9",
      paperVeil: "#fbf7ed",
      ink: "#1a120b",
      inkSoft: "#4d3d2f",
      inkMute: "#a8998a",
      hairline: "#d9cdb4",
      accent: "#7c2d12",      // burgundy — Bienes signature
      accentSoft: "#f1d7d2",
      accentDeep: "#4f180f",
      highlight: "#e0a82c",   // honey gold
    },
    fonts: {
      display: "var(--font-fraunces)",
      body: "var(--font-inter)",
      meta: "var(--font-mono)",
      script: "var(--font-script)",
    },
    motion: {
      spring: { stiffness: 220, damping: 26, mass: 0.9 },
      stagger: 0.04,
      reducedMotionFallback: "fade",
    },
    ornament: "honey-drop",
    imageStylePrompt:
      "warm hand-held cookbook photography, soft morning sun streaming, beige linen napkin, ceramic bowl, oat milk highlights, shot on 50mm prime, shallow depth of field, editorial styling reminiscent of Bon Appétit",
  },

  /* ─────────────────────────────────────────────────────
   * 2.  FIFTEEN MINUTES — Swiss Editorial
   *     "Kinfolk-meets-Wallpaper"
   * ───────────────────────────────────────────────────── */
  "fifteen-minute": {
    id: "fifteen-minute",
    name: "Fifteen Minutes",
    tagline: "Schnelle Snacks · in unter 15 Minuten",
    layout: "swiss-editorial",
    publishingHouse: "Swiss Editorial · Kinfolk / Wallpaper",
    palette: {
      paper: "#faf7f0",
      paperDeep: "#efe8d6",
      paperVeil: "#fdfaf2",
      ink: "#0f0d0a",
      inkSoft: "#3a352d",
      inkMute: "#a39a8c",
      hairline: "#d8cdb6",
      accent: "#0f0d0a",       // editorial black
      accentSoft: "#e6dcc6",
      accentDeep: "#0f0d0a",
      highlight: "#d97706",    // single amber pop
    },
    fonts: {
      display: "var(--font-inter-tight)",
      body: "var(--font-inter)",
      meta: "var(--font-mono)",
    },
    motion: {
      spring: { stiffness: 260, damping: 30 },
      stagger: 0.02,
      reducedMotionFallback: "none",
    },
    ornament: "rule-only",
    imageStylePrompt:
      "minimalist top-down composition on white marble, crisp morning daylight, single subject, scandi-modern styling, clean negative space, editorial monochrome mood",
  },

  /* ─────────────────────────────────────────────────────
   * 3.  COZY SWEET TREATS — Patisserie Romantic
   *     "Cédric-Grolet-meets-Ladurée"
   * ───────────────────────────────────────────────────── */
  "cozy-treats": {
    id: "cozy-treats",
    name: "Cozy Sweet Treats",
    tagline: "Süße Verführungen ohne Reue",
    layout: "patisserie-romantic",
    publishingHouse: "Patisserie · Cédric Grolet / Ladurée",
    palette: {
      paper: "#fff7f3",
      paperDeep: "#fbe6e0",
      paperVeil: "#fdeee8",
      ink: "#3d1410",
      inkSoft: "#6e2a23",
      inkMute: "#c08c84",
      hairline: "#ecccc4",
      accent: "#7c2d12",
      accentSoft: "#f6e2dc",
      accentDeep: "#4f180f",
      highlight: "#a87a14",    // antique gold
    },
    fonts: {
      display: "var(--font-cormorant)",
      body: "var(--font-baskerville)",
      meta: "var(--font-mono)",
      script: "var(--font-script)",
    },
    motion: {
      spring: { stiffness: 180, damping: 22, mass: 1.1 },
      stagger: 0.05,
      reducedMotionFallback: "fade",
    },
    ornament: "fleuron",
    imageStylePrompt:
      "elegant patisserie photography, vintage porcelain plate, dried rose petals, soft window light, painterly bokeh, romantic cookbook aesthetic, watercolor mood",
  },

  /* ─────────────────────────────────────────────────────
   * 4.  HEARTY BITES — Rustic Spread
   *     "Jamie Oliver-meets-Sam Sifton"
   * ───────────────────────────────────────────────────── */
  "hearty-bites": {
    id: "hearty-bites",
    name: "Hearty Bites",
    tagline: "Pizza Night & herzhafte Klassiker",
    layout: "rustic-spread",
    publishingHouse: "Rustic Cookbook · Sam Sifton / Jamie Oliver",
    palette: {
      paper: "#f3eadb",
      paperDeep: "#e0d3bc",
      paperVeil: "#f7efe1",
      ink: "#221a10",
      inkSoft: "#54402d",
      inkMute: "#a3927c",
      hairline: "#cbbda1",
      accent: "#54402d",       // espresso
      accentSoft: "#e2e7d8",
      accentDeep: "#2b1f15",
      highlight: "#7d8c66",    // sage
    },
    fonts: {
      display: "var(--font-calistoga)",
      body: "var(--font-inter)",
      meta: "var(--font-mono)",
    },
    motion: {
      spring: { stiffness: 200, damping: 24 },
      stagger: 0.035,
      reducedMotionFallback: "fade",
    },
    ornament: "sage-sprig",
    imageStylePrompt:
      "rustic kitchen table, warm wooden cutting board, dramatic side light, herb garnish, hearty cookbook photography, cinematic widescreen composition, food in motion",
  },

  /* ─────────────────────────────────────────────────────
   * 5.  MEAL PREP SUNDAY — Modern Planner
   *     "Field-Notes-meets-Hermès-Agenda"
   * ───────────────────────────────────────────────────── */
  "meal-prep-sunday": {
    id: "meal-prep-sunday",
    name: "Meal Prep Sunday",
    tagline: "Die ganze Woche organisiert",
    layout: "modern-planner",
    publishingHouse: "Modern Planner · Field Notes / Hermès Agenda",
    palette: {
      paper: "#fffbeb",
      paperDeep: "#f5ecd0",
      paperVeil: "#fffcf0",
      ink: "#0c0a09",
      inkSoft: "#44403c",
      inkMute: "#a8a29e",
      hairline: "#d6cfb8",
      accent: "#0c0a09",
      accentSoft: "#f5ecd0",
      accentDeep: "#0c0a09",
      highlight: "#d97706",    // mustard gold
    },
    fonts: {
      display: "var(--font-inter-tight)",
      body: "var(--font-inter)",
      meta: "var(--font-mono)",
    },
    motion: {
      spring: { stiffness: 240, damping: 28 },
      stagger: 0.03,
      reducedMotionFallback: "none",
    },
    ornament: "tab-marker",
    imageStylePrompt:
      "organized meal prep containers on cream linen, top-down editorial flat-lay, structured composition, soft daylight, planner-style scene, premium food photography",
  },
};

export const themeList = Object.values(themes);

export function getTheme(id: string): Theme {
  const theme = themes[id];
  if (!theme) throw new Error(`Theme "${id}" not found`);
  return theme;
}
