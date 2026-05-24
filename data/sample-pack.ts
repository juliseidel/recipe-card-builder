import type { RecipePack } from "@/types/recipe";
import { sampleRecipes } from "./sample-recipes";

export const samplePack: RecipePack = {
  id: "sweet-mornings-biene",
  slug: "sweet-mornings-biene",
  title: "Sweet Mornings",
  tagline: "High-Protein Frühstücks-Klassiker",
  description:
    "Fünf cremige, fluffige Lieblings-Frühstücke für gemütliche Mornings — alle unter 500 kcal, alle mit 30 g+ Protein, alle so einfach, dass sie in unter 30 Minuten fertig sind.",
  themeId: "sweet-mornings",
  creator: {
    name: "Biene",
    handle: "@bienesfitlife",
    signature: "Deine Biene 🐝",
  },
  coverImagePrompt:
    "warm overhead breakfast spread with fluffy strawberry trifle bowls, golden cinnamon rolls, and protein pancakes on cream linen, soft morning sun streaming through window, hand-held cookbook style, editorial food photography",
  recipes: sampleRecipes,
};
