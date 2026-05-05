export type PackMood = {
  background: string;
  accent: string;
  ink: string;
};

export type Pack = {
  slug: string;
  brandSlug: string;
  title: string;
  tagline: string;
  description: string;
  recipeCount: number;
  coverEmoji: string;
  mood: PackMood;
  displayFont: "fraunces" | "dm-serif" | "inter-tight";
};

export const packs: Pack[] = [
  {
    slug: "sweet-mornings",
    brandSlug: "biene",
    title: "Sweet Mornings",
    tagline: "High-Protein Frühstücks-Klassiker",
    description:
      "Cinnamon Rolls, Erdbeer-Mealprep, Protein-Waffeln — wie Sonntagsfrühstück bei Oma, nur besser.",
    recipeCount: 8,
    coverEmoji: "🥐",
    mood: {
      background: "#f7f1e8",
      accent: "#d4b79e",
      ink: "#2b1f19",
    },
    displayFont: "fraunces",
  },
  {
    slug: "15-minuten-snacks",
    brandSlug: "biene",
    title: "15-Minuten Snacks",
    tagline: "Schnell, unterwegs, proteinreich",
    description:
      "Protein-Riegel-Bites, Cookie Dough Bars, Energieballs — fertig bevor der Kaffee kalt ist.",
    recipeCount: 6,
    coverEmoji: "⚡",
    mood: {
      background: "#fbf7f0",
      accent: "#e8889b",
      ink: "#2b1f19",
    },
    displayFont: "inter-tight",
  },
  {
    slug: "cozy-sweet-treats",
    brandSlug: "biene",
    title: "Cozy Sweet Treats",
    tagline: "Süße Verführungen ohne Reue",
    description:
      "Pistazien-Cheesecake, Lotus-Cheesecake, Lava Cake — Fitness-Patisserie zum Verlieben.",
    recipeCount: 9,
    coverEmoji: "🧁",
    mood: {
      background: "#f3ebf2",
      accent: "#d8c9e8",
      ink: "#2b1f19",
    },
    displayFont: "dm-serif",
  },
  {
    slug: "pizza-night",
    brandSlug: "biene",
    title: "Pizza Night",
    tagline: "Herzhaft & High-Protein",
    description:
      "Protein-Pizza, Zucchini-Feta-Bällchen, Käse-Kräuter-Brötchen — Komfort-Food, das zählt.",
    recipeCount: 7,
    coverEmoji: "🍕",
    mood: {
      background: "#eff2e8",
      accent: "#a8b88e",
      ink: "#2b1f19",
    },
    displayFont: "fraunces",
  },
  {
    slug: "meal-prep-sunday",
    brandSlug: "biene",
    title: "Meal Prep Sunday",
    tagline: "Die ganze Woche organisiert",
    description:
      "Wochenplan-Rezepte, Batches, Bowls, Einkaufsliste — Sonntag vorbereiten, Wochenende genießen.",
    recipeCount: 8,
    coverEmoji: "📅",
    mood: {
      background: "#eef2f5",
      accent: "#9bb0bd",
      ink: "#2b1f19",
    },
    displayFont: "inter-tight",
  },
];

export function getPacksForBrand(brandSlug: string): Pack[] {
  return packs.filter((pack) => pack.brandSlug === brandSlug);
}

export function getPack(brandSlug: string, packSlug: string): Pack | undefined {
  return packs.find(
    (pack) => pack.brandSlug === brandSlug && pack.slug === packSlug
  );
}
