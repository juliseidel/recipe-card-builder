import type { RecipePack } from "@/types/recipe";
import { samplePack } from "./sample-pack";
import { sampleRecipes } from "./sample-recipes";

const bieneCreator = {
  name: "Biene",
  handle: "@bienesfitlife",
  signature: "Deine Biene 🐝",
};

export const packs: RecipePack[] = [
  {
    ...samplePack,
    description:
      "Fünf cremige, fluffige Lieblings-Frühstücke für gemütliche Mornings — alle unter 500 kcal, alle mit 30 g+ Protein, alle so einfach, dass sie in unter 30 Minuten fertig sind.",
  },
  {
    id: "fifteen-minute-snacks",
    slug: "fifteen-minute-snacks",
    title: "Fifteen Minutes",
    tagline: "Schnelle Snacks für unterwegs",
    description:
      "Sechs winzige Rezepte, die zwischen Termin und Workout passen. High-Protein, low-effort, in unter 15 Minuten gemacht.",
    themeId: "fifteen-minute",
    creator: bieneCreator,
    recipes: sampleRecipes.slice(0, 4),
    coverImagePrompt:
      "minimalist top-down arrangement of high-protein snack bars, energy bites, and quark cups on white marble, soft daylight, crisp shadows",
  },
  {
    id: "cozy-treats",
    slug: "cozy-sweet-treats",
    title: "Cozy Sweet Treats",
    tagline: "Süße Verführungen ohne Reue",
    description:
      "Patisserie-Momente für gemütliche Nachmittage — alles cremig, fluffig, fast zuckerfrei. Mit Bienes Lieblings-MORE-Produkten.",
    themeId: "cozy-treats",
    creator: bieneCreator,
    recipes: sampleRecipes.slice(0, 5),
    coverImagePrompt:
      "elegant patisserie-style flatlay of pistachio cheesecake, chocolate swiss roll, and lavender macarons on cream linen, soft pink napkin, dried flowers",
  },
  {
    id: "hearty-bites",
    slug: "hearty-bites",
    title: "Hearty Bites",
    tagline: "Pizza Night & herzhafte Klassiker",
    description:
      "Wenn es mal nicht süß sein soll: fünf herzhafte Lieblings-Rezepte mit kräftigem Protein-Boost. Perfekt für den Abend.",
    themeId: "hearty-bites",
    creator: bieneCreator,
    recipes: sampleRecipes.slice(0, 5),
    coverImagePrompt:
      "rustic kitchen table with protein pizza margherita, zucchini feta balls, and herbed bread on warm wooden cutting boards, dramatic side light",
  },
  {
    id: "meal-prep-sunday",
    slug: "meal-prep-sunday",
    title: "Meal Prep Sunday",
    tagline: "Die ganze Woche organisiert",
    description:
      "Sieben Rezepte, ein Sonntag, eine perfekte Woche. Mit Einkaufslisten, Wochenplan und voller Macro-Übersicht.",
    themeId: "meal-prep-sunday",
    creator: bieneCreator,
    recipes: sampleRecipes,
    coverImagePrompt:
      "neatly organized meal prep containers in a row on cream linen, top-down composition, warm studio light, structured editorial mood",
  },
];

export function getPackBySlug(slug: string): RecipePack | undefined {
  return packs.find((p) => p.slug === slug);
}
