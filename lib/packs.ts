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
    slug: "bienes-backwelt",
    brandSlug: "biene",
    number: 1,
    title: "Bienes Backwelt",
    subtitle: "Süßes ohne Zuckerzusatz",
    category: "Backen & Desserts",
    tagline: "Schoko-Biskuitrolle, Cheesecake, Erdbeer-Kuppeltorte — Bienes Paradedisziplin",
    description:
      "Bienes legendäre Backwerke aus den Reels: Mehrschicht-Torten, Brot, Muffins — alle ohne zugesetzten Zucker, mit MORE Sahne Protein und Chunky Flavour.",
    recipeCount: 10,
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
    slug: "volumen-wunder",
    brandSlug: "biene",
    number: 2,
    title: "Volumen-Wunder",
    subtitle: "XL-Mahlzeiten unter 450 kcal",
    category: "Diät-Fokus",
    tagline: "Frittata, XL-Wraps, Cookie-Crumble — Bienes WPF-Mahlzeiten",
    description:
      "Bienes voluminöse WPF-Mahlzeiten aus den Reels: optisch riesig, kalorisch fair. Frittata, XL-Wraps, der virale 'lebensverändernde' Salat, Beeren-Cookie-Crumble.",
    recipeCount: 5,
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
    slug: "blitz-snacks",
    brandSlug: "biene",
    number: 3,
    title: "Bienes Snacks",
    subtitle: "Süßes für zwischendurch",
    category: "Schnelle Snacks",
    tagline: "Frozen Cups, Kaiserschmarren, Marzipan-Kugeln — Bienes virale Snacks",
    description:
      "Bienes liebste Snacks aus den Reels: zuckerfreie Mini-Desserts, Protein-Pudding, Frozen Cups und Backwerk für zwischendurch.",
    recipeCount: 5,
    coverImage: "/brands/biene/packs/pack-3.jpg",
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
    slug: "meal-prep-heroes",
    brandSlug: "biene",
    number: 4,
    title: "Meal-Prep Heroes",
    subtitle: "Vorkochen für die ganze Woche",
    category: "Wochenplanung",
    tagline: "Löffelkuchen, Tarte, Lasagne, Tiramisu — Bienes virale Mealpreps",
    description:
      "Bienes Mealprep-Hits aus den Reels: süße Löffelkuchen, herzhafte Tarte, Lasagne und Tiramisu — vorgekocht für 2 bis 4 Tage, perfekt für den Bürotag.",
    recipeCount: 8,
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
  {
    slug: "feierabend-klassiker",
    brandSlug: "biene",
    number: 5,
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
];

export function getPacksForBrand(brandSlug: string): Pack[] {
  return packs.filter((pack) => pack.brandSlug === brandSlug);
}

export function getPack(brandSlug: string, packSlug: string): Pack | undefined {
  return packs.find(
    (pack) => pack.brandSlug === brandSlug && pack.slug === packSlug
  );
}
