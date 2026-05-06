export type BrandTokens = {
  background: string;
  surface: string;
  ink: string;
  inkMuted: string;
  accent: string;
  accentSoft: string;
  line: string;
  signature: string;
};

export type BrandFonts = {
  display: string;
  body: string;
};

export type BrandStats = {
  followers: string;
  niche: string;
};

export type Brand = {
  slug: string;
  name: string;
  fullName: string;
  handle: string;
  bio: string;
  tagline: string;
  signature: string;
  avatar: string;
  stats: BrandStats;
  tokens: BrandTokens;
  fonts: BrandFonts;
  packCount: number;
  recipeCount: number;
};

export const brands: Brand[] = [
  {
    slug: "biene",
    name: "Biene",
    fullName: "Sabrina Mirella Börke",
    handle: "@bienesfitlife",
    bio: "−20 kg abgenommen · einfache Abnehm-Rezepte ohne Verzicht · High-Protein, fluffig, cremig — und für jeden machbar.",
    tagline: "Abnehmen ohne Verzicht",
    signature: "Deine Biene 🐝",
    avatar: "/brands/biene/avatar.jpg",
    stats: {
      followers: "819K",
      niche: "Fitness · Food · MORE Nutrition",
    },
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
    fonts: {
      display: "var(--font-fraunces)",
      body: "var(--font-inter)",
    },
    packCount: 5,
    recipeCount: 37,
  },
];

export function getBrand(slug: string): Brand | undefined {
  return brands.find((brand) => brand.slug === slug);
}
