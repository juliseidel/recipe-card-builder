import type { PackForewordContent } from "./ai/generate-foreword";

// Surface-Typen fuer den Pack-Hintergrund. solid = alter Default
// (kompatibel zu allen Bestands-Packs), gradient = linear/radial Verlauf,
// pattern = procedural SVG-Muster ueber base color.
//
// pattern-ids: polka (Punkte), honeycomb (Sechseck-Grid), crosshatch
// (gekreuzte Linien), topo (Hoehenlinien), marble (organische Streifen),
// stripes (diagonale Streifen), grid (Bento-Linien-Grid), confetti
// (zufaellig verteilte Confetti-Striche).
export type SolidSurface = { type: "solid"; color: string };
export type GradientSurface = {
  type: "gradient";
  variant: "linear" | "radial";
  /** 2-3 Color-Stops, position 0..1. */
  stops: { color: string; position: number }[];
  /** Nur fuer linear; Default 135. */
  angle?: number;
};
export type PatternId =
  | "polka"
  | "honeycomb"
  | "crosshatch"
  | "topo"
  | "marble"
  | "stripes"
  | "grid"
  | "confetti";
export type PatternSurface = {
  type: "pattern";
  patternId: PatternId;
  baseColor: string;
  accentColor: string;
  /** 0.5..3, default 1. Skaliert die Pattern-Density. */
  scale?: number;
  /** 0..1, default 1. */
  opacity?: number;
};
export type PackSurface = SolidSurface | GradientSurface | PatternSurface;

export type PackMood = {
  /** Alte Solid-Background-Farbe — bleibt fuer Backward-Compat fuer
   *  Bestands-Packs. Bei neuen Packs wird `surface` priorisiert; falls
   *  surface fehlt, wird `background` als solid color genutzt. */
  background: string;
  /** Erweiterter Surface-Type. Optional — wenn null, wird background
   *  als solid color verwendet. */
  surface?: PackSurface;
  accent: string;
  ink: string;
  inkSoft: string;
};

/**
 * Liefert die Surface-Definition eines Mood zurueck. Fallback auf
 * solid+background fuer Bestands-Packs ohne explizite surface.
 */
export function resolveSurface(mood: PackMood): PackSurface {
  return mood.surface ?? { type: "solid", color: mood.background };
}

export type CardLayout =
  | "editorial"
  | "patisserie"
  | "minimal"
  | "sport"
  | "dashboard"
  | "vital"
  | "amber"
  // ─── Neue Layouts (Phase C, ab 2026-05-13) ─────────────────────────────
  // Jedes ist eine komplett andere Design-Sprache als die existierenden 7.
  // Spec siehe docs/LAYOUT_RULES.md.
  | "newspaper" // Broadsheet-Editorial: Drop-Cap Lead + 3-Spalten + Spreadsheet-Mikros
  | "restaurant" // Fine-Dining-Speisekarte: Cream + Gold, quadrat. Hero mit Gold-Border, Dot-Leader-Zutaten, Roman-Steps, Wine-Notes-Mikros
  | "studio"; // Step-First Choreographie: kleiner Hero rechts oben, große Step-Numbers links, Zutaten als Inline-Linie, Mikros als prose. Auto-Fit über 3 Density-Stufen + Title-Auto-Shrink + Step-Spaltenwechsel ab 10+ Steps.

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
  /** Custom-Pack-Vorwort. Bei kuratierten Bienen-Packs leer — die lesen
   *  ihren Vorwort-Text aus dem statischen Cache `lib/pack-forewords.ts`.
   *  Bei Custom-Packs wird dieses Feld beim Anlegen automatisch via
   *  Gemini gefuellt (siehe app/api/packs/enrich/route.ts). */
  foreword?: PackForewordContent;
  /** URL zum Vorwort-Stillleben (Supabase Storage `pack-forewords`-Bucket).
   *  Bei kuratierten Bienen-Packs leer — die liegen unter
   *  `public/brands/<brand>/forewords/<slug>.jpg` auf der Disk. Bei
   *  Custom-Packs wird dieses Feld beim Anlegen via Flux 2 Pro gefuellt. */
  forewordImage?: string;
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
      "Bienes voluminöse WPF-Mahlzeiten aus den Reels: optisch riesig, kalorisch fair. Frittata, XL-Wraps, der virale 'lebensverändernde' Salat, Beeren-Cookie-Crumble. Plus zwei Edge-Case-Rezepte: 3-Zutaten-Eisbowl und 16-Zutaten-Mexican-Bowl.",
    recipeCount: 7,
    coverImage: "/brands/biene/packs/pack-4.jpg",
    mood: {
      background: "#c8e2a8",
      accent: "#527a2c",
      ink: "#1f2a14",
      inkSoft: "#3f5b22",
    },
    displayFont: "inter-tight",
    cardLayout: "vital",
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
    cardLayout: "amber",
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

// Helper used by the workspace and pack-detail page so the displayed
// pack-number stays consistent across navigations and stays gap-free
// after a delete.
//
// Order:
//   1. Curated packs sorted by their authored number (1..N).
//   2. Custom packs in creation order (oldest first → lowest custom
//      number, newest last → highest).
//
// Numbering: position-in-array + 1, overwriting whatever was stored on
// each pack. So with 5 curated packs and 3 custom packs we get
// 1,2,3,4,5,6,7,8 — and after deleting position 6 the previous 7 and 8
// become 6 and 7 automatically on the next render.
export function mergeAndRenumberPacks(
  staticPacks: Pack[],
  customPacks: Array<Pack & { createdAt?: number }>
): Pack[] {
  const sortedStatic = [...staticPacks].sort((a, b) => a.number - b.number);
  const sortedCustom = [...customPacks].sort(
    (a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0)
  );
  return [...sortedStatic, ...sortedCustom].map((pack, idx) => ({
    ...pack,
    number: idx + 1,
  }));
}
