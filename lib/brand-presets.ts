import type { BrandTokens } from "./brands";

// Vorgekoppelte Brand-Token-Sets fuer das Creator-Onboarding. Im Gegensatz
// zu lib/pack-presets.ts (das die schlanken PackMood-Tokens abdeckt) hat
// ein Brand acht abgestimmte Farben (background, surface, ink, inkMuted,
// accent, accentSoft, line, signature) — eine Free-Form-Color-Picker
// Loesung waere too much friction beim ersten Pack-Aufbau. Vier hand-tuned
// Moods reichen, um typische Food-Creator-Identitaeten abzudecken.

export type BrandMoodPreset = {
  id: string;
  label: string;
  hint: string;
  tokens: BrandTokens;
};

export const brandMoodPresets: BrandMoodPreset[] = [
  {
    id: "cream",
    label: "Cream & Honey",
    hint: "Warm, einladend — Cream-Patisserie-Vibe",
    tokens: {
      background: "#fbf7f0", surface: "#ffffff",
      ink: "#2b1f19", inkMuted: "#6b5444",
      accent: "#e8889b", accentSoft: "#fde8ee",
      line: "#efe6d6", signature: "#f4c44a",
    },
  },
  {
    id: "sage",
    label: "Sage & Earth",
    hint: "Natur, Volumen-fokussiert — Veggies, Bowls",
    tokens: {
      background: "#f5f3ec", surface: "#ffffff",
      ink: "#1f2a14", inkMuted: "#5a6b48",
      accent: "#527a2c", accentSoft: "#e7efdc",
      line: "#dfe4d2", signature: "#a3c14a",
    },
  },
  {
    id: "linen",
    label: "Linen & Slate",
    hint: "Editorial-cool, modern minimal — Health, Clean Eating",
    tokens: {
      background: "#f6f4f0", surface: "#ffffff",
      ink: "#1a2433", inkMuted: "#586377",
      accent: "#3a6090", accentSoft: "#e3edf7",
      line: "#e1dfd8", signature: "#5b8fc9",
    },
  },
  {
    id: "amber",
    label: "Amber & Cocoa",
    hint: "Warm-rustic, Patisserie — Baking, Sweet Creators",
    tokens: {
      background: "#fbf5ea", surface: "#ffffff",
      ink: "#2a1810", inkMuted: "#7a5a3e",
      accent: "#b8642b", accentSoft: "#f7e5d4",
      line: "#ecdfca", signature: "#e8a651",
    },
  },
  {
    id: "blush",
    label: "Blush & Berry",
    hint: "Warm-rosé — Berry-Smoothies, Frühstücks-Bowls, Tea-Time",
    tokens: {
      background: "#fbf2ee", surface: "#ffffff",
      ink: "#2e1814", inkMuted: "#7d4f47",
      accent: "#c4716e", accentSoft: "#f7dcd6",
      line: "#ecdcd5", signature: "#e09a91",
    },
  },
  {
    id: "mint",
    label: "Mint & Olive",
    hint: "Cool-frisch, Apple-Aesthetik — Snacks, Energy-Balls",
    tokens: {
      background: "#f0f6f1", surface: "#ffffff",
      ink: "#16291f", inkMuted: "#4a6a58",
      accent: "#3f7560", accentSoft: "#d8eae0",
      line: "#dde6df", signature: "#6ea889",
    },
  },
  {
    id: "ocean",
    label: "Ocean & Mist",
    hint: "Cool-Türkis — Fisch, Seafood, Mediterran",
    tokens: {
      background: "#eff5f5", surface: "#ffffff",
      ink: "#142426", inkMuted: "#456063",
      accent: "#356c70", accentSoft: "#d8ecec",
      line: "#dce8e8", signature: "#5f9094",
    },
  },
  {
    id: "terracotta",
    label: "Terracotta & Clay",
    hint: "Rot-Erde — Mexican, Mediterran, Bohnen-Eintöpfe",
    tokens: {
      background: "#fbf2eb", surface: "#ffffff",
      ink: "#2c1612", inkMuted: "#7a4936",
      accent: "#b85a3a", accentSoft: "#f7dccc",
      line: "#ecd9cd", signature: "#d97b50",
    },
  },
  {
    id: "plum",
    label: "Plum & Mauve",
    hint: "Premium-Lila — Patisserie, Date-Night-Desserts, Beeren",
    tokens: {
      background: "#f7eef4", surface: "#ffffff",
      ink: "#1f0c1c", inkMuted: "#6a4663",
      accent: "#6a2860", accentSoft: "#ecd8e6",
      line: "#e6d6e0", signature: "#9c5a8e",
    },
  },
  {
    id: "saffron",
    label: "Saffron & Honey",
    hint: "Warm-orange — Curry, Paella, Risotto, Indian",
    tokens: {
      background: "#fcf4e3", surface: "#ffffff",
      ink: "#2a1d0c", inkMuted: "#7c5e2c",
      accent: "#b8772a", accentSoft: "#f9e6c4",
      line: "#eee0c4", signature: "#dfa64a",
    },
  },
];

export const DEFAULT_BRAND_MOOD_ID = "cream";

// Brand-Identitaet-Defaults fuers Onboarding, falls Felder leer gelassen
// werden — bessere UX als komplette Pflichtfelder.
export const DEFAULT_BRAND_FONTS = {
  display: "var(--font-fraunces)",
  body: "var(--font-inter)",
};

export const DEFAULT_BRAND_STATS = {
  followers: "",
  niche: "Food & Recipes",
};
