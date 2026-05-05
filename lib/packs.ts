export type PackMood = {
  background: string;
  accent: string;
  ink: string;
  inkSoft: string;
};

export type CardLayout =
  | "editorial"
  | "patisserie"
  | "minimal"
  | "sport"
  | "dashboard";

export type Pack = {
  slug: string;
  brandSlug: string;
  number: number;
  title: string;
  subtitle: string;
  category: string;
  tagline: string;
  description: string;
  recipeCount: number;
  coverImage: string;
  edgeCase?: string;
  mood: PackMood;
  displayFont: "fraunces" | "dm-serif" | "inter-tight";
  cardLayout: CardLayout;
};

export const packs: Pack[] = [
  {
    slug: "feierabend-klassiker",
    brandSlug: "biene",
    number: 1,
    title: "Feierabend-Klassiker",
    subtitle: "Herzhaft & Sattmacher",
    category: "Hauptgerichte",
    tagline: "Käse-Nudeln, Cheeseburger-Auflauf, Cloud Wrap — Bienes WPF-Klassiker",
    description:
      "Bienes virale Sattmacher-Rezepte. Hohe Proteinwerte, große Portionen, alles diättauglich umgebaut — ohne Verzicht, mit Geschmack.",
    recipeCount: 7,
    coverImage: "/brands/biene/packs/pack-1.jpg",
    edgeCase: "WPF-Mahlzeiten mit 30–55g Protein pro Portion",
    mood: {
      background: "#f4d88d",
      accent: "#b07a2a",
      ink: "#2b1f10",
      inkSoft: "#5e4720",
    },
    displayFont: "fraunces",
    cardLayout: "editorial",
  },
  {
    slug: "bienes-backwelt",
    brandSlug: "biene",
    number: 2,
    title: "Bienes Backwelt",
    subtitle: "Süßes ohne Verzicht",
    category: "Backen & Desserts",
    tagline: "Magerquark-Käsekuchen, Brownies, Biskuitrolle",
    description:
      "Ihre Paradedisziplin. High-Protein-Backen mit Chunky Flavour statt Zucker — Nährwerte sichtbar im Vordergrund.",
    recipeCount: 8,
    coverImage: "/brands/biene/packs/pack-2.jpg",
    mood: {
      background: "#ddc9e8",
      accent: "#735090",
      ink: "#241830",
      inkSoft: "#503d6b",
    },
    displayFont: "fraunces",
    cardLayout: "patisserie",
  },
  {
    slug: "blitz-snacks",
    brandSlug: "biene",
    number: 3,
    title: "Blitz-Snacks",
    subtitle: "Die 3-Zutaten-Wunder",
    category: "Schnelle Snacks",
    tagline: "Fertig, bevor der Heißhunger zuschlägt",
    description:
      "Protein-Fluff, Bananen-Pancakes, Quark-Cups — drei Zutaten, fünf Minuten, maximaler Soforteffekt.",
    recipeCount: 8,
    coverImage: "/brands/biene/packs/pack-3.jpg",
    edgeCase: "Alle Rezepte mit nur 3 Zutaten",
    mood: {
      background: "#b8dcc9",
      accent: "#3f7560",
      ink: "#16291f",
      inkSoft: "#365546",
    },
    displayFont: "inter-tight",
    cardLayout: "minimal",
  },
  {
    slug: "volumen-wunder",
    brandSlug: "biene",
    number: 4,
    title: "Volumen-Wunder",
    subtitle: "Riesige Portionen unter 500 kcal",
    category: "Diät-Fokus",
    tagline: "Optisch riesig, kalorisch fair",
    description:
      "Zucchini-Nudel-Pfannen, Hähnchen-Salate, Volumen-Bowls — Sättigung ohne Reue, kcal als Hero-Badge.",
    recipeCount: 6,
    coverImage: "/brands/biene/packs/pack-4.jpg",
    mood: {
      background: "#c8e2a8",
      accent: "#527a2c",
      ink: "#1f2a14",
      inkSoft: "#3f5b22",
    },
    displayFont: "inter-tight",
    cardLayout: "sport",
  },
  {
    slug: "meal-prep-heroes",
    brandSlug: "biene",
    number: 5,
    title: "Meal-Prep Heroes",
    subtitle: "Vorkochen für die Arbeit",
    category: "Wochenplanung",
    tagline: "Ein Sonntag, fünf Tage Versorgung",
    description:
      "Overnight-Oats, Schichtsalate, Bowls — fertig in der Tupperdose, perfekt für den Bürotag.",
    recipeCount: 7,
    coverImage: "/brands/biene/packs/pack-5.jpg",
    mood: {
      background: "#b4cde4",
      accent: "#3a6090",
      ink: "#1a2433",
      inkSoft: "#3a4866",
    },
    displayFont: "fraunces",
    cardLayout: "dashboard",
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
