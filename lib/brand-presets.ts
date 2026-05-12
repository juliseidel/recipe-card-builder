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
      background: "#fbf7f0",
      surface: "#ffffff",
      ink: "#2b1f19",
      inkMuted: "#6b5444",
      accent: "#e8889b",
      accentSoft: "#fde8ee",
      line: "#efe6d6",
      signature: "#f4c44a",
    },
  },
  {
    id: "sage",
    label: "Sage & Earth",
    hint: "Natur, Volumen-fokussiert — Veggies, Bowls",
    tokens: {
      background: "#f5f3ec",
      surface: "#ffffff",
      ink: "#1f2a14",
      inkMuted: "#5a6b48",
      accent: "#527a2c",
      accentSoft: "#e7efdc",
      line: "#dfe4d2",
      signature: "#a3c14a",
    },
  },
  {
    id: "linen",
    label: "Linen & Slate",
    hint: "Editorial-cool, modern minimal — Health, Clean Eating",
    tokens: {
      background: "#f6f4f0",
      surface: "#ffffff",
      ink: "#1a2433",
      inkMuted: "#586377",
      accent: "#3a6090",
      accentSoft: "#e3edf7",
      line: "#e1dfd8",
      signature: "#5b8fc9",
    },
  },
  {
    id: "amber",
    label: "Amber & Cocoa",
    hint: "Warm-rustic, Patisserie — Baking, Sweet Creators",
    tokens: {
      background: "#fbf5ea",
      surface: "#ffffff",
      ink: "#2a1810",
      inkMuted: "#7a5a3e",
      accent: "#b8642b",
      accentSoft: "#f7e5d4",
      line: "#ecdfca",
      signature: "#e8a651",
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
