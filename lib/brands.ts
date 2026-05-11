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

// Optionales Brand-DNA-Override fuer die Image-Pipeline. Code-Brands
// (Biene) haben ihre DNA in lib/ai/brand-image-style.ts hardgecodet —
// DB-Brands speichern dieselben Felder hier in brand.imageStyle, generiert
// von der Vision-Analyse beim Onboarding (PR 5).
//
// Schema identisch zu BrandImageStyle in lib/ai/brand-image-style.ts,
// ohne den brandSlug — der kommt aus brand.slug.
export type BrandImageStyleOverride = {
  lightingOptions: string[];
  sceneOptions: string[];
  styleSuffix: string;
  negativeAddition: string;
  cameraAesthetic: string;
  heroElementGuidance: string;
  defaultAngles?: Partial<
    Record<"flat" | "layered" | "tall" | "liquid" | "mixed", string>
  >;
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
  /** Per-Brand Image-Pipeline-DNA. Bei Code-Brand (Biene) leer — Style
   *  liegt in lib/ai/brand-image-style.ts. Bei DB-Brands von der Vision-
   *  Analyse der letzten Reel-Covers generiert und hier persistiert. */
  imageStyle?: BrandImageStyleOverride;
};

export const brands: Brand[] = [
  {
    slug: "biene",
    name: "Biene",
    fullName: "Sabrina Mirella Börke",
    handle: "@bienesfitlife",
    bio: "−20 kg abgenommen · einfache Abnehm-Rezepte ohne Verzicht · High-Protein, fluffig, cremig — und für jeden machbar.",
    tagline: "Abnehmen ohne Verzicht",
    signature: "Deine Biene",
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

// Sagt: ist dieser Slug ein Code-Brand (z. B. Biene)? Wird vom UI
// gebraucht, um Aktionen (z. B. "Brand-Style aktualisieren") auf DB-
// Brands zu beschraenken — Code-Brand-Styles liegen im Code und duerfen
// nicht ueber den Regenerate-Endpoint ueberschrieben werden.
export function isCodeBrand(slug: string): boolean {
  return brands.some((b) => b.slug === slug);
}
