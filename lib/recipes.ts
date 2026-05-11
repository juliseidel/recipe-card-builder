import { unstable_cache } from "next/cache";

export type Ingredient = {
  amount: string;
  name: string;
  note?: string;
  /** Explicit subgroup name ("Für den Teig", "Glasur", "Schoko-Variante").
   *  Curated recipes use note-based markers ("Für die Mayo · gekocht");
   *  the editor produces the explicit field so users can name groups
   *  freely without needing to match the legacy detection regex. */
  group?: string;
};

export type Micronutrient = {
  name: string;
  amount: string;
  pctDaily?: number;
};

export type Nutrition = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  micros?: Micronutrient[];
  /** Unix-ms-Timestamp des letzten Mikronaehrstoff-Generierungs-Versuchs.
   *  Nur gesetzt, wenn der Versuch fehlgeschlagen ist UND `micros` leer
   *  geblieben ist. Server liest das Feld als "schon mal versucht, gib
   *  auf" und ueberspringt den Auto-Retry; nur ein expliziter Retry
   *  (force=true im Request-Body) startet einen neuen Versuch. Bei
   *  erfolgreicher Generierung wird das Feld geloescht. */
  microsAttemptedAt?: number;
};

// Steps support optional grouping ("Für den Teig:", "Für die Glasur:") via
// the `group` field. Plain strings are accepted for backwards compatibility
// — all 37 curated recipes were written that way.
export type RecipeStep = {
  text: string;
  group?: string;
};

// What the displayed nutrition values are in reference to. "portion" is the
// historical default; the editor lets users pick what fits the dish (a
// muffin recipe is more naturally communicated "pro Stück" than per portion).
export type NutritionBasis = "portion" | "piece" | "per100g" | "total";

export type Recipe = {
  slug: string;
  packSlug: string;
  number: number;
  title: string;
  subtitle: string;
  description: string;
  prepTime: number;
  cookTime?: number;
  difficulty: "Einfach" | "Mittel" | "Aufwendig";
  servings: number;
  tags: string[];
  ingredients: Ingredient[];
  steps: Array<string | RecipeStep>;
  nutrition: Nutrition;
  /** What the nutrition values are per. Defaults to "portion" for backward compat. */
  nutritionBasis?: NutritionBasis;
  hero?: string;
  sourceUrl?: string;
  sourceLabel?: string;
  /**
   * Optional per-recipe layout override. When set, the renderer uses this
   * instead of pack.cardLayout. Lets the user pick a layout per card from
   * the recipe editor — independent of which layout the pack defaults to.
   * Static curated recipes leave this undefined and inherit the pack layout.
   */
  cardLayout?: import("./packs").CardLayout;
};

// Normalise a step entry (string or object) to the canonical RecipeStep shape.
// Callers can rely on .text and .group being defined consistently.
export function normalizeStep(
  s: string | RecipeStep
): RecipeStep {
  return typeof s === "string" ? { text: s } : s;
}

// Returns the human-readable label for the nutrition basis. Used in headers
// like "Nährwerte pro Stück". Always uppercase + diacritics intact.
export function nutritionBasisLabel(basis: NutritionBasis | undefined): string {
  switch (basis) {
    case "piece":
      return "PRO STÜCK";
    case "per100g":
      return "PRO 100 G";
    case "total":
      return "GESAMTES REZEPT";
    case "portion":
    case undefined:
    default:
      return "PRO PORTION";
  }
}

// Sentence-case version for body copy (e.g. "Pro Stück" inside descriptive
// text, where the all-caps label would be too shouty).
export function nutritionBasisLabelShort(
  basis: NutritionBasis | undefined
): string {
  switch (basis) {
    case "piece":
      return "Pro Stück";
    case "per100g":
      return "Pro 100 g";
    case "total":
      return "Gesamtes Rezept";
    case "portion":
    case undefined:
    default:
      return "Pro Portion";
  }
}

// Inline form used inside sentences ("350 kcal pro Stück"). Keeps the German
// noun capitalisation but lowercases the leading "pro/im" so it reads as
// flowing text, not a header.
export function nutritionBasisInline(
  basis: NutritionBasis | undefined
): string {
  switch (basis) {
    case "piece":
      return "pro Stück";
    case "per100g":
      return "pro 100 g";
    case "total":
      return "im ganzen Rezept";
    case "portion":
    case undefined:
    default:
      return "pro Portion";
  }
}

export const recipes: Recipe[] = [
  // ─── Pack 1: Feierabend-Klassiker (7 Rezepte, original von @bienesfitlife) ───
  {
    slug: "kartoffelsalat-protein-mayo",
    packSlug: "feierabend-klassiker",
    number: 1,
    title: "Kartoffelsalat mit Protein-Mayo",
    subtitle: "5 große Portionen · 313 kcal · 1345 kcal gespart",
    description:
      "Bienes Klassiker für die Grillfeier — die cremige Mayo wird komplett aus hartgekochten Eiern gemixt. Niemand merkt, dass wir hier 1345 kcal sparen.",
    prepTime: 15,
    cookTime: 25,
    difficulty: "Einfach",
    servings: 5,
    tags: ["Anzeige", "High-Protein", "Grillklassiker", "Mealprep-tauglich"],
    ingredients: [
      { amount: "1000 g", name: "Kartoffeln" },
      { amount: "200 g", name: "Gewürzgurken" },
      { amount: "4", name: "Eier", note: "gekocht" },
      { amount: "Salz", name: "& Knobilicious-Gewürz" },
      { amount: "1 Bund", name: "Petersilie & Schnittlauch", note: "frisch" },
      { amount: "3", name: "Eier", note: "für die Mayo · hartgekocht" },
      { amount: "15 ml", name: "Öl", note: "für die Mayo · nach Wahl" },
      { amount: "50 ml", name: "Wasser", note: "für die Mayo" },
      { amount: "10 g", name: "Senf", note: "für die Mayo" },
      { amount: "1 Prise", name: "Salz", note: "für die Mayo" },
      { amount: "1 Spritzer", name: "Zitronensaft", note: "für die Mayo" },
      { amount: "20 g", name: "MORE Sahne Protein", note: "Geheimtipp · optional" },
    ],
    steps: [
      "Kartoffeln und Eier kochen. Kartoffeln pellen und abkühlen lassen, in der Zeit Gurken und Eier klein schneiden.",
      "Die Kartoffeln ebenfalls würfeln und alles in eine Schale geben.",
      "Für die Mayo alle Zutaten in einen Mixer geben — die Eier zuerst, dann alles cremig mixen. Optional 20 g MORE Sahne Protein für Extra-Cremigkeit & Sättigung.",
      "Mayo unter den Kartoffelsalat heben, mit Petersilie und Schnittlauch toppen, durchmischen und genießen!",
    ],
    nutrition: {
      kcal: 313,
      protein: 15,
      carbs: 34,
      fat: 12,
      fiber: 4,
    },
    sourceUrl: "https://www.instagram.com/reel/DW_GD7buV5s/",
    sourceLabel: "Original-Reel @bienesfitlife",
  },
  {
    slug: "kaese-nudeln",
    packSlug: "feierabend-klassiker",
    number: 2,
    title: "Käse-Nudeln zum Abnehmen",
    subtitle: "2 Portionen · 726 kcal · 51 g Protein · 15 Min",
    description:
      "Bienes virale Käse-Nudel-Pfanne — Schmelzkäse, MORE Trüffel-Mayo und Sahne Protein machen sie cremig wie Carbonara. Die perfekte große WPF-Mahlzeit für alle Käse-Nudel-Fans.",
    prepTime: 5,
    cookTime: 10,
    difficulty: "Einfach",
    servings: 2,
    tags: ["Anzeige", "High-Protein", "WPF-Mahlzeit", "Schnell"],
    ingredients: [
      { amount: "3 Scheiben", name: "Schmelzkäse" },
      { amount: "20 g", name: "Light Butter" },
      { amount: "1 EL", name: "Tomatenmark" },
      { amount: "1 EL", name: "MORE Light Gourmet Sauce", note: "z. B. Trüffel-Mayo" },
      { amount: "1 TL", name: "Gemüsebrühe-Gewürz" },
      { amount: "Gewürze", name: "z. B. MORE Pasta Allrounder" },
      { amount: "500 ml", name: "Mandelmilch ungesüßt" },
      { amount: "180 g", name: "Mie-Nudeln" },
      { amount: "etwas", name: "Salz" },
      { amount: "70 g", name: "MORE Sahne Protein" },
      { amount: "100 ml", name: "Mandelmilch", note: "für die Protein-Sahne" },
      { amount: "Petersilie", name: "frisch" },
      { amount: "2 Scheiben", name: "Schmelzkäse", note: "Topping · 1 pro Schüssel" },
    ],
    steps: [
      "3 Scheiben Schmelzkäse mit Butter, Tomatenmark, Mayo und Gewürzen in einer Pfanne bei mittlerer Hitze schmelzen.",
      "Mit 500 ml Mandelmilch ablöschen, gut verrühren, dann die Mie-Nudeln hineingeben. Mit Deckel 10 Minuten köcheln lassen, ggf. einmal wenden.",
      "In der Kochzeit Sahne Protein mit 100 ml Mandelmilch anrühren. Nudeln in der Pfanne vermengen, Hitze aus, Protein-Sahne unterziehen.",
      "Auf zwei Schüsseln verteilen, mit je einer Scheibe Schmelzkäse toppen und Petersilie servieren.",
    ],
    nutrition: {
      kcal: 726,
      protein: 51,
      carbs: 75,
      fat: 24,
      fiber: 4,
    },
    sourceUrl: "https://www.instagram.com/reel/DV9J1iBDuIJ/",
    sourceLabel: "Original-Reel @bienesfitlife",
  },
  {
    slug: "blech-pasta",
    packSlug: "feierabend-klassiker",
    number: 3,
    title: "Blech-Pasta",
    subtitle: "2 Portionen · 692 kcal · 53 g Protein",
    description:
      "Spaghetti, Salakis Feta und Cocktail-Tomaten aufs Blech — der Ofen macht den Rest. In 5 Minuten vorbereitet, perfekt als Mealprep.",
    prepTime: 5,
    cookTime: 25,
    difficulty: "Einfach",
    servings: 2,
    tags: ["Anzeige", "High-Protein", "WPF-Mahlzeit", "Mealprep"],
    ingredients: [
      { amount: "200 g", name: "Spaghetti", note: "ungekocht gewogen" },
      { amount: "180 g", name: "Salakis Feta Light" },
      { amount: "400 g", name: "Cocktail-Tomaten" },
      { amount: "1", name: "Zwiebel", note: "klein, gehackt" },
      { amount: "600–800 ml", name: "Gemüsebrühe" },
      { amount: "40 g", name: "Tomatenmark" },
      { amount: "Gewürze", name: "z. B. MORE Italian Allrounder" },
      { amount: "50 g", name: "MORE Sahne Protein" },
      { amount: "100 ml", name: "Mandelmilch", note: "für die Protein-Sahne" },
    ],
    steps: [
      "Backofen auf 180 °C Ober-/Unterhitze vorheizen.",
      "Gemüsebrühe zum Kochen bringen und Tomatenmark einrühren.",
      "Spaghetti aufs Blech verteilen, mit Feta, halbierten Cocktail-Tomaten und gehackter Zwiebel toppen, mit der Brühe übergießen und ca. 25 Min bei 180 °C backen.",
      "In der Zeit Sahne Protein mit Mandelmilch anrühren. Nach dem Backen mit der Protein-Sauce und Gewürzen vermengen.",
    ],
    nutrition: {
      kcal: 692,
      protein: 53,
      carbs: 92,
      fat: 12,
      fiber: 6,
    },
    sourceUrl: "https://www.instagram.com/reel/DVTnnPEDJPz/",
    sourceLabel: "Original-Reel @bienesfitlife",
  },
  {
    slug: "virale-pasta-pfanne",
    packSlug: "feierabend-klassiker",
    number: 4,
    title: "Virale Pasta-Pfanne",
    subtitle: "2 Portionen · 750 kcal · 54 g Protein",
    description:
      "Tomaten, Zwiebeln und Veggie-Hack zu Pasta-Sauce gedünstet — mit Käse, Nudeln und MORE Sahne Protein zur perfekten großen WPF-Mahlzeit.",
    prepTime: 10,
    cookTime: 20,
    difficulty: "Einfach",
    servings: 2,
    tags: ["Anzeige", "High-Protein", "WPF-Mahlzeit", "Sattmacher"],
    ingredients: [
      { amount: "5–6", name: "große Tomaten" },
      { amount: "etwas", name: "Ölspray" },
      { amount: "1", name: "Zwiebel", note: "gehackt" },
      { amount: "250 g", name: "Veggie-Hack", note: "oder normales Hack" },
      { amount: "1 Schuss", name: "Wasser" },
      { amount: "1 EL", name: "Tomatenmark" },
      { amount: "Gewürze", name: "z. B. MORE Pasta Allrounder" },
      { amount: "100 g", name: "geriebener Käse Light" },
      { amount: "180 g", name: "Nudeln", note: "ungekocht gewogen" },
      { amount: "20 g", name: "MORE Sahne Protein" },
      { amount: "50–80 ml", name: "Mandelmilch", note: "für die Protein-Sahne" },
      { amount: "Basilikum", name: "frisch" },
    ],
    steps: [
      "Tomaten in etwas Ölspray mit Wasser und gehackten Zwiebeln bei mittlerer Hitze mit Deckel ca. 10 Min dünsten.",
      "Hack zugeben und anbraten. Bei den Tomaten die Haut abziehen und sie kleindrücken.",
      "Mit Tomatenmark abschmecken, würzen, Käse einrühren.",
      "Mit gekochten Nudeln vermengen und mit Sahne Protein und etwas Käse toppen. Hitze aus, kurz ziehen lassen — fertig!",
    ],
    nutrition: {
      kcal: 750,
      protein: 54,
      carbs: 87,
      fat: 23,
      fiber: 7,
    },
    sourceUrl: "https://www.instagram.com/reel/DU_csfmDmzO/",
    sourceLabel: "Original-Reel @bienesfitlife",
  },
  {
    slug: "viral-cloud-wrap",
    packSlug: "feierabend-klassiker",
    number: 5,
    title: "Viral Cloud Wrap",
    subtitle: "1 XL-Wrap · 235 kcal Basis · 28 g Protein",
    description:
      "Eiklar-Wrap aus dem Ofen — XL-Mahlzeit, super sättigend und nur knapp 200 kcal als Basis. Perfekt für Volumen-Lover, die abnehmen wollen.",
    prepTime: 5,
    cookTime: 10,
    difficulty: "Einfach",
    servings: 1,
    tags: ["XL-Mahlzeit", "Volumen", "Low-Carb", "High-Protein"],
    ingredients: [
      { amount: "225 ml", name: "Eiklar" },
      { amount: "10 g", name: "Speisestärke" },
      { amount: "Salz", name: "" },
      { amount: "Gewürze", name: "z. B. MORE Knobilicious" },
      { amount: "50 g", name: "Exquisa fitline", note: "Belag" },
      { amount: "Eisbergsalat", name: "nach Wahl · Belag" },
      { amount: "1", name: "Spiegelei", note: "Belag" },
      { amount: "1", name: "große Tomate", note: "Belag" },
      { amount: "35 g", name: "Light Gouda", note: "Belag" },
      { amount: "MORE Light Gourmet Sauce", name: "Honey Mustard + Trüffel-Mayo · Belag" },
    ],
    steps: [
      "Backofen auf 180 °C Umluft vorheizen.",
      "Eiklar sehr steif schlagen, dann Speisestärke und Gewürze einrieseln lassen und vorsichtig unterheben.",
      "Auf einem Backpapier auf Backblechgröße verstreichen und 8–10 Min bei 180 °C backen, bis es leicht goldbraun, aber noch nicht knusprig fest ist.",
      "Vom Backpapier vorsichtig lösen, mit Frischkäse, Gouda, Tomate, Spiegelei, Salat und Saucen belegen — fertig!",
    ],
    nutrition: {
      kcal: 235,
      protein: 28,
      carbs: 11,
      fat: 8,
    },
    sourceUrl: "https://www.instagram.com/reel/DUqnNhMjIKL/",
    sourceLabel: "Original-Reel @bienesfitlife",
  },
  {
    slug: "blitz-cheeseburger-auflauf",
    packSlug: "feierabend-klassiker",
    number: 6,
    title: "Blitz Cheeseburger-Auflauf",
    subtitle: "2 Portionen · 683 kcal · 53 g Protein",
    description:
      "Kartoffeln, Veggie-Hack und Burger-Sauce mit Schmelzkäse überbacken — schmeckt nach purer Sünde, ist aber Abnehm-Mealprep für 2 Tage.",
    prepTime: 10,
    cookTime: 15,
    difficulty: "Einfach",
    servings: 2,
    tags: ["Anzeige", "High-Protein", "Sattmacher", "Mealprep"],
    ingredients: [
      { amount: "600 g", name: "Kartoffeln", note: "roh gewogen" },
      { amount: "250 g", name: "Veggie-Hack", note: "z. B. Rügenwalder · oder leichtes Hack" },
      { amount: "4 Scheiben", name: "Schmelzkäse" },
      { amount: "50 g", name: "Gewürzgurken" },
      { amount: "80 ml", name: "Mandelmilch", note: "für die Burger-Sauce" },
      { amount: "50 ml", name: "passierte Tomaten", note: "für die Burger-Sauce" },
      { amount: "etwas", name: "Light-Ketchup", note: "optional · für die Sauce" },
      { amount: "60 g", name: "MORE Sahne Protein", note: "für die Burger-Sauce" },
      { amount: "Salz", name: "& MORE Italian Allrounder" },
      { amount: "1 EL", name: "MORE Light Gourmet Sauce", note: "Burger Sauce · optional" },
    ],
    steps: [
      "Gekochte Kartoffeln pellen, vierteln und in eine Auflaufform geben.",
      "Hack mit etwas Ölspray anbraten und auf den Kartoffeln verteilen.",
      "Sauce separat anrühren (Mandelmilch, Tomaten, optional Ketchup, Sahne Protein, Gewürze), abschmecken und auf dem Hack verstreichen.",
      "Mit Schmelzkäse und Gewürzgurken toppen, bei 175 °C Umluft ca. 15 Min überbacken — fertig!",
    ],
    nutrition: {
      kcal: 683,
      protein: 53,
      carbs: 69,
      fat: 25,
      fiber: 8,
    },
    sourceUrl: "https://www.instagram.com/reel/DUoK7j1jtnd/",
    sourceLabel: "Original-Reel @bienesfitlife",
  },
  {
    slug: "langos-airfryer-flammkuchen",
    packSlug: "feierabend-klassiker",
    number: 7,
    title: "Langos im Airfryer · Flammkuchen-Style",
    subtitle: "1 Langos · 442 kcal · 37 g Protein · 10 Min",
    description:
      "Knuspriger Dinkel-Magerquark-Teig mit cremigem Frischkäse, Schinken-Würfeln und Frühlingszwiebeln — die perfekte kleine WPF-Mahlzeit aus dem Airfryer.",
    prepTime: 5,
    cookTime: 15,
    difficulty: "Einfach",
    servings: 1,
    tags: ["High-Protein", "WPF-Mahlzeit", "Airfryer"],
    ingredients: [
      { amount: "70 g", name: "Dinkelmehl", note: "Teig" },
      { amount: "30 g", name: "MORE Sahne Protein", note: "Teig" },
      { amount: "4 g", name: "Backpulver", note: "Teig" },
      { amount: "etwas", name: "Salz", note: "Teig" },
      { amount: "50 g", name: "Magerquark", note: "Teig" },
      { amount: "ca. 40 ml", name: "Wasser", note: "Teig" },
      { amount: "2 Sprüher", name: "Ölspray", note: "Teig" },
      { amount: "40 g", name: "Exquisa fitline", note: "Topping" },
      { amount: "Gewürze", name: "z. B. MORE Knobilicious · Topping" },
      { amount: "15–20 g", name: "Schinken-Würfel", note: "Topping · z. B. Veggie von Billie Green" },
      { amount: "1/4", name: "rote Zwiebel", note: "Topping" },
      { amount: "Frühlingszwiebeln", name: "Topping" },
    ],
    steps: [
      "Alle trockenen Zutaten für den Teig vermengen, dann mit Magerquark und Wasser verkneten und zu einem Fladen formen.",
      "Frischkäse mit etwas Wasser cremig rühren und den Fladen damit toppen.",
      "Mit roten Zwiebeln und Schinken-Würfeln abschließen und 15 Min bei ca. 130 °C in den Airfryer geben.",
      "Mit Frühlingszwiebeln abschließen und noch warm genießen!",
    ],
    nutrition: {
      kcal: 442,
      protein: 37,
      carbs: 60,
      fat: 6,
      fiber: 6,
    },
    sourceUrl: "https://www.instagram.com/reel/DUfO5PCDImH/",
    sourceLabel: "Original-Reel @bienesfitlife",
  },

  // ─── Pack 2: Bienes Backwelt (10 Rezepte, original von @bienesfitlife) ───
  {
    slug: "schoko-biskuitrolle",
    packSlug: "bienes-backwelt",
    number: 1,
    title: "High Protein Schoko-Biskuitrolle",
    subtitle: "10 Stücke · 172 kcal · 14 g Protein",
    description:
      "Bienes legendäre Schoko-Biskuitrolle mit cremiger Vanille-Schlagcreme — fast zuckerfrei, mit insgesamt 140 g Protein in der ganzen Rolle. 2,5 Stücke = kleine WPF-Mahlzeit mit 35 g Protein.",
    prepTime: 25,
    cookTime: 15,
    difficulty: "Mittel",
    servings: 10,
    tags: ["Anzeige", "High-Protein", "ohne Zucker", "Klassiker"],
    ingredients: [
      { amount: "50 g", name: "Mehl", note: "Teig" },
      { amount: "20 g", name: "MORE Protein Sahne", note: "Teig · oder Iced Coffee oder mehr Mehl" },
      { amount: "20 g", name: "Backkakao", note: "Teig" },
      { amount: "1 TL", name: "Backpulver", note: "Teig" },
      { amount: "1/4 TL", name: "Salz", note: "Teig" },
      { amount: "4", name: "Eier", note: "Teig · getrennt" },
      { amount: "140 g", name: "No More Sugar", note: "Teig · oder Erythrit" },
      { amount: "50 g", name: "Butter", note: "Teig · geschmolzen" },
      { amount: "100 g", name: "MORE Protein Schlagcreme", note: "Creme · oder 200 ml Cremefine 19 %" },
      { amount: "300 ml", name: "Mandelmilch", note: "Creme · für die Schlagcreme" },
      { amount: "9 g", name: "MORE Chunky Flavour", note: "Creme · z. B. Vanilla Perfection" },
      { amount: "1–2 Pck", name: "Sahne steif", note: "Creme" },
      { amount: "200 g", name: "Exquisa fitline 2 %", note: "Creme" },
      { amount: "40 g", name: "dunkle 85 % Schokolade", note: "Topping · optional zum Übergießen" },
    ],
    steps: [
      "Ofen auf 170 °C O/U (150 °C Umluft) vorheizen, Blech (37 × 24 cm) mit Backpapier auslegen.",
      "Trockene Zutaten mischen: Mehl, Kakao, Protein, Backpulver, Salz.",
      "Eiweiß steif schlagen, dabei nach und nach die Hälfte des Erythrits einrieseln lassen.",
      "Eigelb mit dem restlichen Erythrit 5 Min cremig schlagen.",
      "Eischnee vorsichtig unterheben, trockene Zutaten einsieben, zum Schluss die geschmolzene Butter einarbeiten.",
      "Teig aufs Blech, glatt streichen, ca. 10–20 Min backen.",
      "Direkt mit Kakao bestäuben, Backpapier drauf, umdrehen, unteres Backpapier abziehen und mit Papier einrollen. Auskühlen lassen.",
      "Für die Creme alle Zutaten zusammen steif schlagen.",
      "Rolle entrollen, Creme verstreichen, wieder einrollen. Mind. 1 Stunde kühlen. Optional mit dunkler Schokolade übergießen.",
    ],
    nutrition: {
      kcal: 172,
      protein: 14,
      carbs: 8,
      fat: 9,
    },
    sourceUrl: "https://www.instagram.com/reel/DXwIRHpMmaU/",
    sourceLabel: "Original-Reel @bienesfitlife",
  },
  {
    slug: "erdbeer-biscuit-pudding-kuchen",
    packSlug: "bienes-backwelt",
    number: 2,
    title: "Erdbeer-Biscuit-Kuchen mit Vanille Pudding",
    subtitle: "8 Stücke · 117 kcal · 8 g Protein",
    description:
      "Bienes legendärer Erdbeer-Kuchen mit fluffigem Biskuit, Vanille-Pudding-Schicht und frischen Erdbeeren — ohne Zucker und niemand merkt's. Achtung: kein Backpulver im Teig!",
    prepTime: 25,
    cookTime: 20,
    difficulty: "Mittel",
    servings: 8,
    tags: ["Anzeige", "ohne Zucker", "High-Protein", "Sommer"],
    ingredients: [
      { amount: "4", name: "Eier", note: "Teig" },
      { amount: "75 g", name: "no more Sugar", note: "Teig" },
      { amount: "30 g", name: "Mehl", note: "Teig" },
      { amount: "20 g", name: "MORE Protein Sahne", note: "Teig · oder mehr Mehl" },
      { amount: "6 g", name: "MORE Chunky Vanilla Perfection", note: "Teig · optional" },
      { amount: "20 g", name: "Puddingpulver Vanille", note: "Teig" },
      { amount: "1 Msp", name: "Salz", note: "Teig · KEIN Backpulver!" },
      { amount: "1 Pck", name: "Puddingpulver Vanille", note: "Creme" },
      { amount: "200 ml", name: "Mandelmilch ungesüßt", note: "Creme" },
      { amount: "150 g", name: "Magerquark", note: "Creme" },
      { amount: "3 g", name: "MORE Chunky Vanilla Perfection", note: "Creme" },
      { amount: "400 g", name: "frische Erdbeeren", note: "Topping" },
      { amount: "1 Pck", name: "Tortenguss rot", note: "Topping" },
      { amount: "1 Prise", name: "MORE Chunky Vanilla", note: "Topping · oder 2 EL Erythrit" },
    ],
    steps: [
      "Backofen auf 160 °C Umluft (180 °C O/U) vorheizen.",
      "Eier mit no more Sugar 4 Min aufschlagen, bis eine fest-fluffige Masse entsteht (es muss wirklich fest sein).",
      "Restliche trockene Zutaten vermengen, in die Eimasse sieben und unterheben.",
      "Teig in die 26er Form füllen, ca. 15–20 Min backen (nach 10 Min mit Alufolie abdecken).",
      "Für die Creme Puddingpulver mit kalter Mandelmilch in einem Topf verrühren und unter Rühren aufkochen.",
      "Magerquark schnell unterrühren, mit Chunky süßen, auf den abgekühlten Biskuitboden verstreichen.",
      "Mit halbierten Erdbeeren belegen.",
      "Tortenguss nach Packungsanleitung mit Chunky/Erythrit statt Zucker zubereiten und über die Erdbeeren geben.",
      "Mindestens 1 Stunde kalt stellen und genießen!",
    ],
    nutrition: {
      kcal: 117,
      protein: 8,
      carbs: 14,
      fat: 3,
    },
    sourceUrl: "https://www.instagram.com/reel/DXtgtyyDAiI/",
    sourceLabel: "Original-Reel @bienesfitlife",
  },
  {
    slug: "blaubeer-cheesecake-no-bake",
    packSlug: "bienes-backwelt",
    number: 3,
    title: "Blaubeer-Cheesecake ohne Backen",
    subtitle: "10 Stücke · 149 kcal · 18 g Protein",
    description:
      "Bienes cremigster No-Bake-Cheesecake — mit Blueberry-Lavender-Note, ohne Zuckerzusatz. 2 Stücke = kleine WPF-Mahlzeit mit 36 g Protein.",
    prepTime: 30,
    cookTime: 0,
    difficulty: "Mittel",
    servings: 10,
    tags: ["Anzeige", "No-Bake", "ohne Zucker", "High-Protein", "WPF-Mahlzeit"],
    ingredients: [
      { amount: "60 g", name: "zuckerreduzierte Butterkekse", note: "Boden" },
      { amount: "60 g", name: "zarte Haferflocken", note: "Boden" },
      { amount: "40 g", name: "MORE Protein Sahne", note: "Boden" },
      { amount: "3 g", name: "MORE Chunky Vanilla Perfection", note: "Boden" },
      { amount: "100 g", name: "Exquisa Fitline 0,2 %", note: "Boden" },
      { amount: "500 g", name: "Magerquark", note: "Creme" },
      { amount: "200 g", name: "Exquisa Fitline 0,2 %", note: "Creme" },
      { amount: "40 g", name: "MORE Protein Schlagcreme", note: "Creme" },
      { amount: "200 ml", name: "Mandelmilch", note: "Creme" },
      { amount: "6 Blatt", name: "Gelatine", note: "Creme" },
      { amount: "9 g", name: "MORE Chunky Flavour", note: "Creme · z. B. Blueberry Lavender" },
      { amount: "150 g", name: "Blaubeeren TK", note: "Topping" },
      { amount: "5 g", name: "Speisestärke", note: "Topping" },
    ],
    steps: [
      "Boden: Kekse und Haferflocken im Mixer zerkleinern. Mit Frischkäse, Protein Sahne und Chunky verkneten. In der 18er Form fest andrücken.",
      "Creme: Magerquark, Frischkäse und Chunky verrühren.",
      "6 Blatt Gelatine 5 Min in kaltem Wasser einweichen, ausdrücken und im Topf erwärmen bis geschmolzen (NICHT kochen).",
      "Zunächst 2 EL der Quark-Creme in die Gelatine rühren (Temperaturangleich), dann fix mit dem restlichen Quark vermixen.",
      "Schlagcreme mit Mandelmilch aufschlagen und unterheben (2 EL für Tupfer aufheben). Creme auf den Boden geben.",
      "Optional: TK-Blaubeeren erwärmen und 3 EL in der obersten Kuchenschicht verswirlen.",
      "Mind. 2 Stunden in den Kühlschrank.",
      "Restliche Blaubeeren aufkochen, mit 20 ml kaltem Wasser angerührter Speisestärke einrühren. Auf den Kuchen geben.",
      "Mit restlicher Schlagcreme Tupfer machen — fertig!",
    ],
    nutrition: {
      kcal: 149,
      protein: 18,
      carbs: 15,
      fat: 2,
    },
    sourceUrl: "https://www.instagram.com/reel/DXOhpecOZAw/",
    sourceLabel: "Original-Reel @bienesfitlife",
  },
  {
    slug: "erdbeer-kuppeltorte",
    packSlug: "bienes-backwelt",
    number: 4,
    title: "Erdbeer-Kuppeltorte",
    subtitle: "8 Stücke · 149 kcal · 18 g Protein",
    description:
      "Bienes Angeber-Kuppeltorte mit Erdbeer-Quark-Creme zwischen Biskuit-Schichten — ohne Zuckerzusatz, mit pürierten und ganzen Erdbeeren.",
    prepTime: 35,
    cookTime: 20,
    difficulty: "Aufwendig",
    servings: 8,
    tags: ["Anzeige", "ohne Zucker", "High-Protein", "Show-Off"],
    ingredients: [
      { amount: "3", name: "Eier", note: "Teig" },
      { amount: "75 g", name: "Erythrit", note: "Teig" },
      { amount: "30 g", name: "Weizenmehl", note: "Teig" },
      { amount: "20 g", name: "MORE Protein Sahne", note: "Teig" },
      { amount: "20 g", name: "Puddingpulver Vanille", note: "Teig" },
      { amount: "500 g", name: "Magerquark", note: "Creme" },
      { amount: "50 g", name: "MORE Protein Schlagcreme", note: "Creme" },
      { amount: "200 ml", name: "Mandelmilch", note: "Creme · für die Schlagcreme" },
      { amount: "7 Blatt", name: "Gelatine", note: "Creme" },
      { amount: "5 g", name: "MORE Chunky Strawberry/Vanilla", note: "Creme" },
      { amount: "150 g", name: "Erdbeeren", note: "Creme · püriert" },
      { amount: "300 g", name: "frische Erdbeeren", note: "Topping" },
    ],
    steps: [
      "Backofen auf 180 °C O/U vorheizen. Eier mit Erythrit 4 Min auf höchster Stufe schlagen, bis eine 3-fache fest-fluffige Masse entsteht.",
      "Trockene Zutaten vermengen, in die Eimasse sieben und unterheben.",
      "In die 18er Springform füllen, 15–20 Min backen (nach 10 Min mit Alufolie abdecken). Etwas abkühlen lassen, in zwei Hälften schneiden.",
      "Für die Creme: Erdbeeren pürieren, Schlagcreme aufschlagen, alles mit Magerquark und Chunky verrühren.",
      "Gelatineblätter einweichen, ausdrücken, im Topf erwärmen (nicht kochen). Mit 4 EL Quark-Creme anrühren, dann unter die gesamte Masse rühren.",
      "Erdbeeren für das Topping in dünne Scheiben schneiden.",
      "Eine Schale fetten und mit Frischhaltefolie auskleiden, mit Erdbeer-Scheiben auskleiden.",
      "Creme und Biskuit-Böden abwechselnd schichten.",
      "Mindestens 2–3 Stunden kalt stellen und genießen!",
    ],
    nutrition: {
      kcal: 149,
      protein: 18,
      carbs: 12,
      fat: 3,
    },
    sourceUrl: "https://www.instagram.com/reel/DXJ8XAus1oj/",
    sourceLabel: "Original-Reel @bienesfitlife",
  },
  {
    slug: "protein-bananenbrot",
    packSlug: "bienes-backwelt",
    number: 5,
    title: "Protein-Bananenbrot",
    subtitle: "10 Scheiben · 145 kcal · 10 g Protein",
    description:
      "Bienes Bananenbrot mit Schoki-Swirl und dunkler Schokolade — ohne zugesetzten Zucker, super saftig. 3 Scheiben = kleine WPF-Mahlzeit mit 30 g Protein.",
    prepTime: 10,
    cookTime: 50,
    difficulty: "Einfach",
    servings: 10,
    tags: ["Anzeige", "ohne Zucker", "High-Protein", "WPF-Mahlzeit"],
    ingredients: [
      { amount: "2", name: "Bananen", note: "Teig · zerdrückt" },
      { amount: "2", name: "Eier", note: "Teig" },
      { amount: "120 g", name: "Magerquark", note: "Teig" },
      { amount: "120 g", name: "Dinkelmehl", note: "Teig" },
      { amount: "70 g", name: "MORE Protein Sahne", note: "Teig" },
      { amount: "100 g", name: "Erythrit", note: "Teig · oder no more Sugar" },
      { amount: "10 g", name: "Backpulver", note: "Teig" },
      { amount: "3 g", name: "MORE Chunky Vanilla Perfection", note: "Teig" },
      { amount: "5 g", name: "Backkakao", note: "Teig · für 1/3 Schoki-Schicht" },
      { amount: "5 g", name: "MORE Chunky Ultra Dark Choc", note: "Teig · für 1/3 Schoki-Schicht" },
      { amount: "40 g", name: "dunkle 80 % Schokolade", note: "Topping · gehackt" },
      { amount: "1", name: "Banane", note: "Topping · längs halbiert" },
    ],
    steps: [
      "Backofen auf 180 °C Umluft vorheizen. Bananen mit Gabel zerdrücken, Eier und Magerquark unterrühren.",
      "Alle trockenen Zutaten für den hellen Teig dazugeben und verrühren.",
      "1/3 des Teigs in eine andere Schüssel füllen und mit Backkakao und schokoladigem Chunky verrühren.",
      "Hellen Teig in die Frame-M-Form füllen, mit Schoki-Teig toppen.",
      "2/3 der gehackten Schokolade drüber, 2× alles mit einer Gabel durchswirlen.",
      "Mit der halbierten Banane und restlichen Schoko-Stücken toppen.",
      "30 Min bei 180 °C backen, mit Alufolie abdecken und weitere 15–20 Min backen.",
    ],
    nutrition: {
      kcal: 145,
      protein: 10,
      carbs: 17,
      fat: 4,
    },
    sourceUrl: "https://www.instagram.com/reel/DXFPSjmurtI/",
    sourceLabel: "Original-Reel @bienesfitlife",
  },
  {
    slug: "ki-suesskartoffel-muffins",
    packSlug: "bienes-backwelt",
    number: 6,
    title: "Virale KI-Süßkartoffel-Muffins",
    subtitle: "9 Stück · 82 kcal · 8 g Protein",
    description:
      "Bienes virale Süßkartoffel-Muffins — nur 80 kcal pro Stück, ohne Zucker, mit hohem Proteingehalt. 4 Stück = kleine WPF-Mahlzeit mit 31 g Protein.",
    prepTime: 10,
    cookTime: 25,
    difficulty: "Einfach",
    servings: 9,
    tags: ["Anzeige", "ohne Zucker", "High-Protein", "Snack", "Schnell"],
    ingredients: [
      { amount: "200 g", name: "Süßkartoffel", note: "gekocht" },
      { amount: "70 g", name: "Mehl" },
      { amount: "70 g", name: "MORE Protein Sahne" },
      { amount: "50 g", name: "Erythrit" },
      { amount: "1 Spritzer", name: "MORE Zerup Barista", note: "z. B. Brown Sugar" },
      { amount: "8 g", name: "Backpulver" },
      { amount: "50 g", name: "Magerquark" },
      { amount: "40 ml", name: "Mandelmilch" },
    ],
    steps: [
      "Süßkartoffel kochen, Schale abziehen. Backofen auf 180 °C Umluft vorheizen.",
      "Süßkartoffel kleindrücken und mit allen restlichen Zutaten zu einem Teig vermengen.",
      "Auf 9 Muffin-Förmchen aufteilen, 20–25 Min backen.",
      "Stäbchenprobe: wenn nichts mehr klebt, sind sie fertig!",
    ],
    nutrition: {
      kcal: 82,
      protein: 8,
      carbs: 12,
      fat: 1,
    },
    sourceUrl: "https://www.instagram.com/reel/DW6BsuisKXc/",
    sourceLabel: "Original-Reel @bienesfitlife",
  },
  {
    slug: "leichter-oster-zupfkuchen",
    packSlug: "bienes-backwelt",
    number: 7,
    title: "Leichter Oster-Zupfkuchen",
    subtitle: "16 Stücke · 174 kcal · 14 g Protein · 4,6 g Zucker",
    description:
      "Bienes Hommage an den Dr.-Oetker-Klassiker — kalorienarm abgewandelt, mit 3395 kcal gespart gegenüber dem Original (das hat 22 g Zucker pro Stück, dieser nur 4,6 g).",
    prepTime: 30,
    cookTime: 50,
    difficulty: "Aufwendig",
    servings: 16,
    tags: ["Anzeige", "ohne Zucker", "Klassiker", "Show-Off"],
    ingredients: [
      { amount: "175 g", name: "Dinkelmehl Type 630", note: "Boden" },
      { amount: "75 g", name: "MORE Sahne Protein", note: "Boden" },
      { amount: "100 g", name: "no more Sugar", note: "Boden" },
      { amount: "25 g", name: "Backkakao", note: "Boden" },
      { amount: "5 g", name: "Backpulver", note: "Boden" },
      { amount: "6 g", name: "MORE Chunky Ultra Dark Choc", note: "Boden" },
      { amount: "1", name: "Ei", note: "Boden" },
      { amount: "60 g", name: "Butter", note: "Boden · flüssig" },
      { amount: "80 g", name: "Magerquark", note: "Boden" },
      { amount: "250 g", name: "Aprikosenhälften", note: "Boden · ungezuckert" },
      { amount: "500 g", name: "Magerquark", note: "Creme" },
      { amount: "400 g", name: "Exquisa fitline", note: "Creme" },
      { amount: "100 ml", name: "Cremefine 19 %", note: "Creme · separat steif schlagen" },
      { amount: "2", name: "Eier", note: "Creme" },
      { amount: "6 g", name: "MORE Chunky Vanilla", note: "Creme" },
      { amount: "1 Pck", name: "Vanille-Puddingpulver", note: "Creme" },
    ],
    steps: [
      "Trockene Zutaten für den Schoko-Teig vermengen. Flüssige Butter, Magerquark und Ei dazugeben, zu einem Teig kneten.",
      "1/3 des Teigs mit etwas Mehl dünn ausrollen, mit Keks-Ausstechern Motive ausstechen (ca. 14 Stück), beiseite legen.",
      "Restlichen Teig wieder zusammenkneten, ausrollen und damit den Boden der Frame-L-Form bedecken.",
      "Für die Creme: Sahne separat steif schlagen. Restliche Zutaten vermixen. Sahne vorsichtig unterheben.",
      "Aprikosen auf dem Schoki-Teig verteilen.",
      "Quark-Creme vorsichtig drüber geben und mit den Motiv-Teigstücken dekorieren.",
      "Bei 170 °C O/U ca. 45–55 Min backen.",
      "Im Ofen vollständig abkühlen lassen, am besten über Nacht in den Kühlschrank.",
    ],
    nutrition: {
      kcal: 174,
      protein: 14,
      carbs: 15,
      fat: 6,
      sugar: 4.6,
    },
    sourceUrl: "https://www.instagram.com/reel/DWrKSEPMO_G/",
    sourceLabel: "Original-Reel @bienesfitlife",
  },
  {
    slug: "mini-franzbroetchen",
    packSlug: "bienes-backwelt",
    number: 8,
    title: "Mini Franzbrötchen",
    subtitle: "12 Stück · 118 kcal · 9 g Eiweiß · 15 Min",
    description:
      "Bienes Mini-Franzbrötchen ohne Hefe — in 15 Min im Ofen, ohne Zuckerzusatz. Saftig und perfekt für die ganze Familie. Schmecken am besten noch warm.",
    prepTime: 15,
    cookTime: 11,
    difficulty: "Einfach",
    servings: 12,
    tags: ["Anzeige", "ohne Zucker", "ohne Hefe", "Schnell"],
    ingredients: [
      { amount: "180 g", name: "Dinkelmehl Type 630", note: "Teig" },
      { amount: "80 g", name: "MORE Protein Sahne", note: "Teig" },
      { amount: "6 g", name: "MORE Chunky Vanilla Perfection", note: "Teig" },
      { amount: "11 g", name: "Backpulver", note: "Teig" },
      { amount: "150 g", name: "Magerquark", note: "Teig" },
      { amount: "1", name: "Ei", note: "Teig · M" },
      { amount: "30 g", name: "Light-Butter", note: "Teig · z. B. Meggle Joghurt-Butter" },
      { amount: "MORE ZimtkeinZucker", name: "nach Belieben", note: "Füllung · oder Erythrit + Zimt" },
      { amount: "20 g", name: "Light-Butter", note: "Füllung" },
    ],
    steps: [
      "Backofen auf 180 °C Umluft vorheizen. Trockene Zutaten für den Teig vermengen.",
      "Geschmolzene Butter, Ei und Magerquark dazugeben, zu einem Teig verkneten.",
      "Teig in zwei Hälften teilen. Jeweils auf bemehlter Fläche rechteckig auf ca. die Größe eines halben Backbleches ausrollen.",
      "Dünn mit geschmolzener Butter bestreichen, kräftig mit ZimtkeinZucker bestreuen.",
      "Jeweils zu einer Teigrolle aufrollen und in 3–4 cm lange Stücke trennen.",
      "Auf einer Backfolie drapieren und mit einem Kochlöffel in der Mitte tief hinunterdrücken (typische Franzbrötchen-Form).",
      "Vor dem Backen nochmal mit der restlichen Butter bestreichen und mit ZimtkeinZucker bestreuen.",
      "11 Min bei 180 °C Umluft goldbraun backen.",
    ],
    nutrition: {
      kcal: 118,
      protein: 9,
      carbs: 12,
      fat: 4,
    },
    sourceUrl: "https://www.instagram.com/reel/DWgWv8_snyi/",
    sourceLabel: "Original-Reel @bienesfitlife",
  },
  {
    slug: "zuckerfreier-hefezopf",
    packSlug: "bienes-backwelt",
    number: 9,
    title: "Zuckerfreier Hefezopf",
    subtitle: "14 Scheiben · 137 kcal · 4 g Protein",
    description:
      "Bienes klassischer Hefezopf — fast komplett zuckerfrei (nur 1 EL für die Hefe). Optionale Protein-Variante: 350 g Mehl + 50 g MORE Sahne Protein → 6 g Protein pro Scheibe.",
    prepTime: 30,
    cookTime: 25,
    difficulty: "Mittel",
    servings: 14,
    tags: ["Anzeige", "ohne Zucker", "Klassiker", "Hefeteig"],
    ingredients: [
      { amount: "400 g", name: "Mehl", note: "oder 350 g Mehl + 50 g MORE Protein Sahne für Protein-Variante" },
      { amount: "150 ml", name: "Mandelmilch", note: "warm aus Topf/Mikrowelle" },
      { amount: "1/2 Würfel", name: "frische Hefe" },
      { amount: "1 EL", name: "Zucker", note: "einziger Zucker im Rezept!" },
      { amount: "75 g", name: "no more Sugar", note: "oder Erythrit" },
      { amount: "2", name: "Eier" },
      { amount: "50 g", name: "Butter", note: "warm" },
      { amount: "9 g", name: "MORE Chunky Vanilla Perfection", note: "oder Morezipan" },
      { amount: "1 Prise", name: "Salz" },
      { amount: "1", name: "Eigelb", note: "Topping" },
      { amount: "1 Schuss", name: "Milch", note: "Topping · für die Eigelb-Glasur" },
      { amount: "Hagelzucker", name: "oder gehobelte Mandeln", note: "Topping" },
    ],
    steps: [
      "Mehl in eine Schüssel geben. Milch leicht erwärmen und in eine Mulde im Mehl kippen.",
      "Hefe in die warme Milch bröseln, EL Zucker dazu, in der Milch verrühren bis Hefe aufgelöst ist. 10 Min abgedeckt stehen lassen.",
      "Eier, Erythrit, Chunky und Butter dazugeben und alles mit Maschine/Mixer verkneten bis ein klebriger Teig entsteht.",
      "Teig auf bemehlter Fläche etwas falten, in bemehlter Schüssel an warmen Ort zugedeckt 45 Min gehen lassen.",
      "Teig in 3 Stränge teilen und von der Mitte her flechten (Achtung: Protein-Teig ist klebrig).",
      "Auf Blech nochmal 15–20 Min zugedeckt gehen lassen.",
      "Mit Eigelb-Milch-Mischung bestreichen, dekorieren, bei 180 °C O/U 20–30 Min backen.",
    ],
    nutrition: {
      kcal: 137,
      protein: 4,
      carbs: 22,
      fat: 4,
    },
    sourceUrl: "https://www.instagram.com/reel/DWUY7L8O24k/",
    sourceLabel: "Original-Reel @bienesfitlife",
  },
  {
    slug: "einfachstes-protein-brot",
    packSlug: "bienes-backwelt",
    number: 10,
    title: "Einfachstes Protein-Brot",
    subtitle: "14 Scheiben · 144 kcal · 12 g Protein",
    description:
      "Bienes Protein-Brot ohne Hefe, ohne Wartezeit, ohne Zucker. Tipp: in Scheiben einfrieren — hält am längsten. Wichtig: Sobald die Flüssigkeit zu den trockenen Zutaten kommt, muss das Brot in 3–5 Min im Ofen sein.",
    prepTime: 5,
    cookTime: 35,
    difficulty: "Einfach",
    servings: 14,
    tags: ["Anzeige", "ohne Zucker", "ohne Hefe", "High-Protein"],
    ingredients: [
      { amount: "250 ml", name: "Mandelmilch", note: "oder andere leichte Milch" },
      { amount: "2 EL", name: "(Apfel-)Essig" },
      { amount: "20 ml", name: "Olivenöl" },
      { amount: "120 ml", name: "Mineralwasser sprudelnd" },
      { amount: "350 g", name: "Dinkel- oder Weizenmehl" },
      { amount: "150 g", name: "MORE Total Protein", note: "geschmacksneutral oder Sahne" },
      { amount: "16 g", name: "Backpulver", note: "1 Packung" },
      { amount: "1 TL", name: "Salz" },
    ],
    steps: [
      "Milch lauwarm erwärmen, Essig dazu, umrühren, stehen lassen.",
      "Backofen auf 220 °C O/U vorheizen, eine Schale Wasser unten reinstellen.",
      "Trockene Zutaten in großer Schüssel vermengen.",
      "Zur Milch-Essig-Mischung Öl und Mineralwasser geben.",
      "WICHTIG: Ab jetzt schnell! Sobald die Flüssigkeit hinzukommt, sollte das Brot in 3–5 Min im Ofen sein.",
      "Milch-Mischung zu den trockenen Zutaten kippen, schnell mit Knethaken zu einem klebrigen Teig vermengen, in die Coox-Wunderform-M füllen.",
      "Mit Wasser bepinseln, einschneiden, mit Mehl durch ein Sieb bestäuben, ab in den Ofen!",
      "35 Min bei 220 °C O/U backen, herausnehmen, abkühlen lassen.",
    ],
    nutrition: {
      kcal: 144,
      protein: 12,
      carbs: 18,
      fat: 2,
    },
    sourceUrl: "https://www.instagram.com/reel/DWJU84joSW4/",
    sourceLabel: "Original-Reel @bienesfitlife",
  },

  // ─── Pack 3: Bienes Snacks (5 Rezepte, original von @bienesfitlife) ───
  {
    slug: "frozen-coconut-strawberry-cups",
    packSlug: "blitz-snacks",
    number: 1,
    title: "Frozen Coconut & Strawberry Cups",
    subtitle: "8 Cups · 132 kcal · 7 g Protein",
    description:
      "Bienes perfekter kleiner Sommer-Snack — zwei Schichten (cremig Kokos + fruchtig Erdbeere), in 10 Min vorbereitet, dann ins Gefrierfach. Ohne Zuckerzusatz.",
    prepTime: 10,
    cookTime: 0,
    difficulty: "Einfach",
    servings: 8,
    tags: ["Anzeige", "ohne Zucker", "TK", "Protein"],
    ingredients: [
      { amount: "350 g", name: "TK-Erdbeeren", note: "Erdbeer-Schicht" },
      { amount: "1 Schuss", name: "Wasser", note: "Erdbeer-Schicht" },
      { amount: "1 Spritzer", name: "MORE Zerup Strawberry Sugar", note: "Erdbeer-Schicht · oder Süße nach Wahl" },
      { amount: "10 g", name: "Chiasamen", note: "Erdbeer-Schicht" },
      { amount: "80 g", name: "Kokosraspeln", note: "Kokos-Schicht" },
      { amount: "60 g", name: "MORE Sahne Protein", note: "Kokos-Schicht" },
      { amount: "3 g", name: "MORE Chunky White Almond Coconut", note: "Kokos-Schicht · oder andere Süße" },
      { amount: "80 ml", name: "Kokosmilch", note: "Kokos-Schicht · fettreduziert, aus der Dose" },
    ],
    steps: [
      "TK-Erdbeeren in einer Pfanne mit dem Schuss Wasser erhitzen.",
      "Währenddessen Kokosraspeln mit Protein, Kokosmilch und Chunky in einem Mixer fein mixen.",
      "Hitze aus, weiche Erdbeeren zerdrücken, süßen und mit Chiasamen verrühren.",
      "Kokosmasse auf 8 Muffinförmchen aufteilen, mit Erdbeer-Masse toppen.",
      "3–4 Stunden ins Gefrierfach — fertig!",
    ],
    nutrition: {
      kcal: 132,
      protein: 7,
      carbs: 6,
      fat: 9,
    },
    sourceUrl: "https://www.instagram.com/reel/DVgnNrPjCf5/",
    sourceLabel: "Original-Reel @bienesfitlife",
  },
  {
    slug: "protein-griesspudding",
    packSlug: "blitz-snacks",
    number: 2,
    title: "8-Min Protein-Grießpudding",
    subtitle: "1 Portion · 336 kcal · 33 g Protein",
    description:
      "Bienes 8-Min Grießpudding ohne Zucker — mit Vanille-Pudding-Pulver, MORE Sahne Protein und Chunky Vanilla Perfection. Am besten direkt warm genießen.",
    prepTime: 3,
    cookTime: 5,
    difficulty: "Einfach",
    servings: 1,
    tags: ["Anzeige", "ohne Zucker", "High-Protein", "Schnell"],
    ingredients: [
      { amount: "20 g", name: "Puddingpulver Vanille" },
      { amount: "300 ml", name: "Wasser", note: "kalt" },
      { amount: "50–100 ml", name: "Mandelmilch", note: "je nach gewünschter Cremigkeit" },
      { amount: "25 g", name: "(Dinkel-)Grieß" },
      { amount: "40 g", name: "MORE Protein Sahne" },
      { amount: "3 g", name: "MORE Chunky Vanilla Perfection" },
    ],
    steps: [
      "Puddingpulver mit dem kalten Wasser verrühren.",
      "Unter gelegentlichem Rühren aufkochen.",
      "In der Zeit Sahne Protein mit Mandelmilch verrühren und etwas andicken lassen.",
      "Wenn die Pudding-Masse kocht, Grieß hinzugeben und ca. 3 Min auf mittlerer Hitze köcheln lassen, dabei umrühren.",
      "Topf vom Herd, sofort das angedickte Protein einrühren. Mit Chunky süßen — am besten direkt noch warm genießen.",
    ],
    nutrition: {
      kcal: 336,
      protein: 33,
      carbs: 36,
      fat: 5,
    },
    sourceUrl: "https://www.instagram.com/reel/DUI_JRvDNLT/",
    sourceLabel: "Original-Reel @bienesfitlife",
  },
  {
    slug: "protein-kaiserschmarren",
    packSlug: "blitz-snacks",
    number: 3,
    title: "High Protein Kaiserschmarren",
    subtitle: "1 Portion · 431 kcal · 41 g Protein · 10 Min",
    description:
      "Bienes Kaiserschmarren in 10 Min — schmeckt wie das Original, macht satt und glücklich. Am besten mit Marmelade, Erythrit-Puder oder Apfelmus.",
    prepTime: 5,
    cookTime: 5,
    difficulty: "Einfach",
    servings: 1,
    tags: ["Anzeige", "ohne Zucker", "High-Protein", "Klassiker"],
    ingredients: [
      { amount: "40 g", name: "Dinkelmehl" },
      { amount: "30 g", name: "MORE Protein Sahne" },
      { amount: "3 g", name: "MORE Chunky Vanilla Perfection" },
      { amount: "2 g", name: "Backpulver" },
      { amount: "2", name: "Eier", note: "getrennt" },
      { amount: "90 ml", name: "Mandelmilch" },
      { amount: "etwas", name: "MORE 2 kcal Ölspray" },
      { amount: "etwas", name: "MORE no more Sugar pulverisiert", note: "oder Erythrit-Puder" },
    ],
    steps: [
      "Alle trockenen Zutaten vermengen.",
      "Eier trennen. Eiklar steif schlagen. Eigelb mit Mandelmilch zu den trockenen Zutaten geben und zu einem Teig verrühren.",
      "Eiklar vorsichtig unter den Teig heben, sodass er möglichst luftig flüssig bleibt.",
      "Pfanne auf mittlerer Hitze erwärmen, mit Ölspray besprühen. Teig hineingeben und mit Deckel ca. 2–3 Min anbraten.",
      "Teig wenden, nochmals kurz anbraten, dann mit einem Pfannenwender in die typischen Kaiserschmarren-Stücke rupfen.",
      "Heiß aus der Pfanne servieren — am besten mit Marmelade, Erythrit-Puder oder Apfelmus toppen.",
    ],
    nutrition: {
      kcal: 431,
      protein: 41,
      carbs: 33,
      fat: 14,
    },
    sourceUrl: "https://www.instagram.com/reel/DTdkfAajIoZ/",
    sourceLabel: "Original-Reel @bienesfitlife",
  },
  {
    slug: "marzipankartoffeln",
    packSlug: "blitz-snacks",
    number: 4,
    title: "5-Min Marzipankartoffeln",
    subtitle: "22 Kugeln · 17 kcal · 1,3 g Protein pro Stück",
    description:
      "Bienes zuckerfreie Marzipankartoffeln — pro Kugel nur 17 kcal. Tipp: kühl gelagert halten sie sich mehrere Tage. Funktioniert auch mit jedem anderen Chunky-Flavour.",
    prepTime: 5,
    cookTime: 0,
    difficulty: "Einfach",
    servings: 22,
    tags: ["Anzeige", "ohne Zucker", "Mini-Snack", "Mealprep-tauglich"],
    ingredients: [
      { amount: "40 g", name: "gemahlene blanchierte Mandeln" },
      { amount: "25 g", name: "MORE Protein Sahne" },
      { amount: "20 g", name: "no more Sugar", note: "im Mixer pulverisiert · oder Erythrit" },
      { amount: "3 g", name: "MORE Chunky Morezipan White Chocolate" },
      { amount: "20 ml", name: "Mandelmilch ungesüßt" },
      { amount: "ca. 2 g", name: "Backkakao", note: "Topping" },
      { amount: "ca. 2 g", name: "MORE Chunky Feine Vollmilch Schokolade", note: "Topping" },
    ],
    steps: [
      "Alle Zutaten für die Kartoffeln mit den Händen zu einer Teigkugel verkneten.",
      "Teig in 22 gleichschwere Teile (je 5 g) teilen und zu Kugeln rollen.",
      "Kugeln in einer Mischung aus Backkakao und Chunky schwenken — fertig!",
      "Am besten kühl stellen — so halten sie mehrere Tage.",
    ],
    nutrition: {
      kcal: 17,
      protein: 1,
      carbs: 0,
      fat: 1,
    },
    sourceUrl: "https://www.instagram.com/reel/DRUJkzxDA99/",
    sourceLabel: "Original-Reel @bienesfitlife",
  },
  {
    slug: "zimt-streuseltaler",
    packSlug: "blitz-snacks",
    number: 5,
    title: "Schnelle Zimt-Streuseltaler",
    subtitle: "4 Stück · 222 kcal · 19 g Protein (ohne Obst)",
    description:
      "Bienes Streuseltaler wie vom Bäcker — nur ohne Zucker und 3× weniger kcal. Mit Pflaumen oder anderem Obst nach Wahl, in 10 Min im Ofen.",
    prepTime: 10,
    cookTime: 20,
    difficulty: "Einfach",
    servings: 4,
    tags: ["Anzeige", "ohne Zucker", "High-Protein", "Bäcker-Klassiker"],
    ingredients: [
      { amount: "80 g", name: "Dinkelmehl Type 630", note: "Teig" },
      { amount: "40 g", name: "MORE Total Protein Sahne", note: "Teig" },
      { amount: "8 g", name: "Backpulver", note: "Teig" },
      { amount: "5 g", name: "MORE Chunky Vanilla Perfection", note: "Teig" },
      { amount: "140 g", name: "Magerquark", note: "Teig" },
      { amount: "200 g", name: "Pflaumen", note: "Topping · oder Obst nach Wahl" },
      { amount: "35 g", name: "Dinkelmehl Type 630", note: "Streusel" },
      { amount: "20 g", name: "MORE Total Protein Sahne", note: "Streusel" },
      { amount: "20 g", name: "Erythrit", note: "Streusel" },
      { amount: "3 g", name: "MORE Chunky Vanilla Perfection", note: "Streusel" },
      { amount: "1 Prise", name: "Zimt", note: "Streusel · gerne großzügig" },
      { amount: "25 g", name: "Meggle Joghurt-Butter", note: "Streusel" },
    ],
    steps: [
      "Trockene Zutaten für den Teig vermengen, mit Magerquark verkneten.",
      "Teig in 4 gleichgroße Kugeln teilen, auf einer Backmatte zu Kreisen platt drücken.",
      "Mit Obst nach Wahl belegen.",
      "Streusel-Zutaten zusammenkneten, auf dem Obst verteilen.",
      "Bei 175 °C Umluft ca. 20 Min backen — nach 10 Min mit Alufolie abdecken, damit sie nicht zu braun werden.",
    ],
    nutrition: {
      kcal: 222,
      protein: 19,
      carbs: 23,
      fat: 6,
    },
    sourceUrl: "https://www.instagram.com/reel/DOgp5oyiIE0/",
    sourceLabel: "Original-Reel @bienesfitlife",
  },

  // ─── Pack 4: Volumen-Wunder (7 Rezepte, original von @bienesfitlife · plus 2 Edge-Cases) ───
  {
    slug: "kaese-zucchini-frittata",
    packSlug: "volumen-wunder",
    number: 1,
    title: "Käse-Zucchini-Frittata",
    subtitle: "1 Schüssel · 404 kcal · 35 g Protein",
    description:
      "Bienes Frittata-Bowl als perfektes Abnehm-Mealprep. Schmeckt warm und kalt, eine ganze Schüssel mit nur 404 kcal — die perfekte kleine WPF-Mahlzeit.",
    prepTime: 10,
    cookTime: 25,
    difficulty: "Einfach",
    servings: 1,
    tags: ["Anzeige", "High-Protein", "WPF-Mahlzeit", "Mealprep", "Low-Carb"],
    ingredients: [
      { amount: "2", name: "Eier" },
      { amount: "40 g", name: "Salakis Feta Light" },
      { amount: "200 g", name: "Zucchini", note: "gerieben, leicht ausgedrückt" },
      { amount: "Gewürze", name: "z. B. MORE Knobilicious" },
      { amount: "40 g", name: "Reibekäse Light" },
    ],
    steps: [
      "Eier mit zerbröseltem Feta in einer ofenfesten Schüssel verrühren.",
      "Zucchini klein reiben, leicht ausdrücken, mit in die Schüssel geben. Würzen und verrühren.",
      "Mit Käse toppen und für 20–25 Min bei 175 °C Umluft in den Ofen.",
    ],
    nutrition: {
      kcal: 404,
      protein: 35,
      carbs: 6,
      fat: 24,
    },
    sourceUrl: "https://www.instagram.com/reel/DUWJLygjmS9/",
    sourceLabel: "Original-Reel @bienesfitlife",
  },
  {
    slug: "viral-xl-gemuese-wrap",
    packSlug: "volumen-wunder",
    number: 2,
    title: "Viraler XL Gemüse-Wrap",
    subtitle: "2 Portionen · 435 kcal · 42 g Protein (mit Füllung)",
    description:
      "Bienes virale XL-Wrap-Rolle aus Zucchini, Kartoffel und Karotte — das ganze Blech ergibt 2 Portionen. Mit Füllung 435 kcal, ohne Füllung 360 kcal pro Portion.",
    prepTime: 10,
    cookTime: 30,
    difficulty: "Einfach",
    servings: 2,
    tags: ["Anzeige", "High-Protein", "WPF-Mahlzeit", "XL", "viral"],
    ingredients: [
      { amount: "350 g", name: "Zucchini", note: "Teig · roh, fein geraspelt" },
      { amount: "150 g", name: "Kartoffel", note: "Teig · roh, fein geraspelt" },
      { amount: "100 g", name: "Karotte", note: "Teig · roh, fein geraspelt" },
      { amount: "80 g", name: "Käse", note: "Teig · gerieben, light" },
      { amount: "20 g", name: "MORE Protein Sahne", note: "Teig" },
      { amount: "3", name: "Eier", note: "Teig · M" },
      { amount: "Gewürze", name: "z. B. Salz + MORE Knobilicious", note: "Teig" },
      { amount: "Eisbergsalat", name: "nach Wahl", note: "Füllung" },
      { amount: "100 g", name: "Exquisa fitline 0,2 %", note: "Füllung" },
      { amount: "100 g", name: "Cocktail-Tomaten", note: "Füllung" },
      { amount: "40 g", name: "Feta Light", note: "Füllung" },
      { amount: "MORE Light Gourmet Sauce Chipotle", name: "nach Wahl", note: "Füllung" },
    ],
    steps: [
      "Zucchini, Karotte und Kartoffel roh fein raspeln, Flüssigkeit so gut es geht ausdrücken.",
      "Mit Eiern, Sahne Protein und Gewürzen zu einem Teig verrühren, auf Backpapier glatt ausstreichen.",
      "Bei 180 °C Umluft 25–30 Min backen, schön goldbraun werden lassen.",
      "Etwas abkühlen lassen, mit Salat, Frischkäse, Tomaten, Feta und Sauce belegen, einrollen.",
      "Die Hälfte der XL-Rolle ist eine Portion!",
    ],
    nutrition: {
      kcal: 435,
      protein: 42,
      carbs: 32,
      fat: 17,
    },
    sourceUrl: "https://www.instagram.com/reel/DPWwnKgCLAS/",
    sourceLabel: "Original-Reel @bienesfitlife",
  },
  {
    slug: "lebensveraendernder-salat",
    packSlug: "volumen-wunder",
    number: 3,
    title: "Lebensverändernder Salat",
    subtitle: "1 Portion · 394 kcal · 35 g Protein",
    description:
      "Der virale 'wegen-dem-Salat-hat-sie-ihren-Mann-geheiratet'-Salat — von Biene getestet und als 'lebensverändernd lecker' bestätigt. Mit gekochtem Ei, Veggie-Chicken und Feta zur perfekten kleinen WPF-Mahlzeit gepimpt.",
    prepTime: 10,
    cookTime: 5,
    difficulty: "Einfach",
    servings: 1,
    tags: ["Anzeige", "High-Protein", "WPF-Mahlzeit", "Salat", "viral"],
    ingredients: [
      { amount: "150 g", name: "Eisbergsalat" },
      { amount: "1/2", name: "Zitrone", note: "Saft" },
      { amount: "15 ml", name: "Olivenöl" },
      { amount: "gute Menge", name: "Salz" },
      { amount: "Gewürze", name: "z. B. MORE Knobilicious oder Pfeffer" },
      { amount: "1 Zehe", name: "Knoblauch" },
      { amount: "1–2 EL", name: "Essig" },
      { amount: "1", name: "Ei", note: "Pimp · gekocht" },
      { amount: "90 g", name: "Veggie-Chicken", note: "Pimp · angebraten" },
      { amount: "30 g", name: "Salakis Feta Light", note: "Pimp" },
      { amount: "100 g", name: "Cocktail-Tomaten", note: "Pimp" },
    ],
    steps: [
      "Eisbergsalat klein zupfen.",
      "Zitronensaft, Olivenöl, Salz, Gewürze, gepressten Knoblauch und Essig zu einem Dressing verrühren.",
      "Veggie-Chicken anbraten, Ei kochen.",
      "Alles in eine Schüssel geben — Salat, gekochtes Ei, Veggie-Chicken, Feta, Cocktail-Tomaten — mit dem Dressing vermengen.",
    ],
    nutrition: {
      kcal: 394,
      protein: 35,
      carbs: 8,
      fat: 24,
    },
    sourceUrl: "https://www.instagram.com/reel/DNgStM8MSZF/",
    sourceLabel: "Original-Reel @bienesfitlife",
  },
  {
    slug: "beeren-cookie-crumble",
    packSlug: "volumen-wunder",
    number: 4,
    title: "Beeren-Cookie-Crumble",
    subtitle: "1 Portion · 435 kcal · 33 g Protein",
    description:
      "Bienes Frühstück für Beeren- und Keksteig-Lover — Beerenmasse mit Keksteig-Topping überbacken. Eine ganze Auflaufform = 1 perfekte kleine WPF-Mahlzeit.",
    prepTime: 5,
    cookTime: 20,
    difficulty: "Einfach",
    servings: 1,
    tags: ["Anzeige", "ohne Zucker", "High-Protein", "WPF-Mahlzeit", "Frühstück"],
    ingredients: [
      { amount: "300 g", name: "TK-Beerenmix", note: "Beerenmasse" },
      { amount: "10 g", name: "Speisestärke", note: "Beerenmasse" },
      { amount: "3 g", name: "MORE Chunky Vanilla Perfection", note: "Beerenmasse" },
      { amount: "20 g", name: "no more Sugar", note: "Beerenmasse · Erythrit-Stevia-Mix" },
      { amount: "40 g", name: "Dinkelmehl", note: "Keksteig" },
      { amount: "25 g", name: "MORE Protein Sahne", note: "Keksteig" },
      { amount: "3 g", name: "MORE Chunky Vanilla Perfection", note: "Keksteig" },
      { amount: "40 g", name: "no more Sugar", note: "Keksteig · Erythrit-Stevia-Mix" },
      { amount: "20 ml", name: "Mandelmilch", note: "Keksteig" },
      { amount: "50 g", name: "Magerquark", note: "Keksteig" },
    ],
    steps: [
      "TK-Beeren auftauen, leicht erwärmt in eine Auflaufform geben. Backofen auf 175 °C Umluft vorheizen.",
      "Speisestärke, Erythrit und Chunky unter die Beeren rühren.",
      "Keksteig aus den Zutaten anrühren und auf den Beeren verstreichen.",
      "15–20 Min überbacken bis goldbraun — fertig!",
    ],
    nutrition: {
      kcal: 435,
      protein: 33,
      carbs: 56,
      fat: 3,
    },
    sourceUrl: "https://www.instagram.com/reel/DK2Yk1QoBJs/",
    sourceLabel: "Original-Reel @bienesfitlife",
  },
  {
    slug: "xxl-frueh-cookie",
    packSlug: "volumen-wunder",
    number: 5,
    title: "XXL Frühstücks-Cookie",
    subtitle: "1 XL-Cookie · 444 kcal · 36 g Protein · 5 Min",
    description:
      "Bienes XXL-Cookie als Abnehm-Frühstück — eine ganze 18er-Coox-Wunderform für 1 Portion. In 15 Min im Ofen und mit MORE Schoko Drops.",
    prepTime: 5,
    cookTime: 15,
    difficulty: "Einfach",
    servings: 1,
    tags: ["Anzeige", "High-Protein", "WPF-Mahlzeit", "Frühstück", "Schnell"],
    ingredients: [
      { amount: "45 g", name: "Haferflocken", note: "gemahlen" },
      { amount: "20 g", name: "MORE Protein Sahne" },
      { amount: "3 g", name: "Backpulver" },
      { amount: "1", name: "Ei" },
      { amount: "3 g", name: "MORE Chunky Flavour", note: "nach Wahl" },
      { amount: "60 g", name: "Magerquark" },
      { amount: "20 g", name: "Mandelmilch" },
      { amount: "10 g", name: "MORE Schoko Drops" },
    ],
    steps: [
      "Alle Zutaten vermengen.",
      "Schoko Drops unterheben.",
      "Bei 175 °C Umluft ca. 15 Min in der 18er Coox-Wunderform backen.",
    ],
    nutrition: {
      kcal: 444,
      protein: 36,
      carbs: 38,
      fat: 15,
    },
  },
  {
    slug: "drei-zutaten-eisbowl",
    packSlug: "volumen-wunder",
    number: 6,
    title: "3-Zutaten Magerquark-Eisbowl",
    subtitle: "1 XL-Schüssel · 308 kcal · 53 g Protein · 5 Min",
    description:
      "Bienes simpelster Volumen-Hack — Magerquark über Nacht ins Gefrierfach, dann mit TK-Beeren und MORE Chunky in den Mixer. Eine Riesen-Schüssel cremiges Eis aus drei Zutaten.",
    prepTime: 5,
    difficulty: "Einfach",
    servings: 1,
    tags: ["High-Protein", "WPF-Mahlzeit", "ohne Zucker", "3-Zutaten", "Frühstück"],
    ingredients: [
      { amount: "500 g", name: "Magerquark", note: "über Nacht im Gefrierfach" },
      { amount: "200 g", name: "TK-Beerenmix" },
      { amount: "8 g", name: "MORE Chunky Vanilla Perfection" },
    ],
    steps: [
      "Den Magerquark am Vorabend in einer flachen Schale einfrieren — über Nacht durchziehen lassen.",
      "Gefrorenen Quark mit den TK-Beeren und Chunky in einen leistungsstarken Mixer geben.",
      "Auf höchster Stufe cremig pürieren — dabei zwei- bis dreimal stoppen und mit dem Spatel runterschieben.",
      "Sofort als XL-Eis-Bowl löffeln, sonst zieht der Magerquark Wasser.",
    ],
    nutrition: {
      kcal: 308,
      protein: 53,
      carbs: 18,
      fat: 1,
      fiber: 4,
    },
  },
  {
    slug: "xl-mexican-bowl",
    packSlug: "volumen-wunder",
    number: 7,
    title: "Bienes XL Mexican-Bowl",
    subtitle: "1 Riesen-Bowl · 432 kcal · 35 g Protein · 25 Min",
    description:
      "Bienes virale XL-Bowl mit gegrilltem Hähnchen, Kidneybohnen, Mais, Avocado und cremigem Magerquark-Chipotle-Dressing. Eine ganze Schüssel, 16 Zutaten — Volumen-Wunder mit maximaler Mikronährstoff-Tiefe.",
    prepTime: 15,
    cookTime: 10,
    difficulty: "Mittel",
    servings: 1,
    tags: ["Anzeige", "High-Protein", "WPF-Mahlzeit", "XL", "Mealprep"],
    ingredients: [
      { amount: "90 g", name: "Hähnchenbrust", note: "gewürfelt" },
      { amount: "50 g", name: "Vollkornreis", note: "gekocht" },
      { amount: "70 g", name: "Kidneybohnen", note: "Dose, abgespült" },
      { amount: "50 g", name: "Mais", note: "Dose, abgespült" },
      { amount: "1/2", name: "Paprika rot", note: "klein gewürfelt" },
      { amount: "100 g", name: "Cocktail-Tomaten", note: "halbiert" },
      { amount: "30 g", name: "Avocado" },
      { amount: "60 g", name: "Eisbergsalat", note: "klein gezupft" },
      { amount: "1", name: "Frühlingszwiebel", note: "in feinen Ringen" },
      { amount: "1/2", name: "Limette", note: "Saft" },
      { amount: "1 TL", name: "Olivenöl" },
      { amount: "1 Zehe", name: "Knoblauch", note: "gepresst" },
      { amount: "30 g", name: "Magerquark", note: "Dressing" },
      { amount: "1 EL", name: "MORE Light Gourmet Sauce Chipotle", note: "Dressing" },
      { amount: "15 g", name: "Salakis Feta Light", note: "Topping" },
      { amount: "Gewürze", name: "Kreuzkümmel, Paprika edelsüß, Salz, Pfeffer" },
    ],
    steps: [
      "Hähnchen mit Knoblauch, Kreuzkümmel, Paprika, Salz und Pfeffer würzen, mit dem Olivenöl in einer Pfanne 6–8 Min scharf anbraten.",
      "Vollkornreis nach Packung kochen (oder vorgekocht aus dem Mealprep verwenden).",
      "Bohnen und Mais abspülen und abtropfen lassen, Paprika, Tomaten und Avocado würfeln, Salat zupfen, Frühlingszwiebel in Ringe schneiden.",
      "Magerquark mit Chipotle-Sauce und Limettensaft cremig verrühren — fertig ist das Dressing.",
      "Reis als Boden in eine große Schüssel, Hähnchen, Bohnen, Mais, Paprika, Tomaten, Avocado und Salat ringförmig drüber anrichten.",
      "Mit dem Dressing übergießen, Frühlingszwiebeln und Feta toppen — sofort essen oder als Lunch-Bowl mitnehmen.",
    ],
    nutrition: {
      kcal: 432,
      protein: 35,
      carbs: 38,
      fat: 14,
      fiber: 9,
    },
  },

  // ─── Pack 5: Meal-Prep Heroes (8 Rezepte, original von @bienesfitlife) ───
  {
    slug: "erdbeer-loeffelkuchen",
    packSlug: "meal-prep-heroes",
    number: 1,
    title: "Erdbeer-Löffelkuchen",
    subtitle: "2 Schüsseln · 394 kcal · 31 g Protein · 15 Min",
    description:
      "Bienes Sommer-Mealprep ohne Backen — Löffelbiskuit-Boden, Vanille-Quark-Creme und frische Erdbeeren. In 15 Min vorbereitet, dann ab in den Kühlschrank.",
    prepTime: 15,
    cookTime: 5,
    difficulty: "Einfach",
    servings: 2,
    tags: ["Anzeige", "ohne Backen", "Mealprep", "WPF-Mahlzeit", "Sommer"],
    ingredients: [
      { amount: "8 Stk", name: "Löffelbiskuits" },
      { amount: "200 g", name: "Magerquark", note: "Creme" },
      { amount: "1 Pck", name: "Puddingpulver Vanille", note: "Creme" },
      { amount: "300 ml", name: "Mandelmilch", note: "Creme" },
      { amount: "40 g", name: "MORE Protein Sahne", note: "Creme" },
      { amount: "6–9 g", name: "MORE Chunky Vanilla Perfection", note: "Creme" },
      { amount: "200 g", name: "Erdbeeren", note: "Topping · frisch" },
      { amount: "1 Pck", name: "Tortenguss rot", note: "Topping" },
      { amount: "etwas", name: "MORE Zerup", note: "Topping · oder Erythrit zum Süßen" },
    ],
    steps: [
      "Löffelbiskuits auf 2 Schalen aufteilen, ggf. mit etwas Milch oder Kaffee übergießen.",
      "Puddingpulver mit kalter Mandelmilch verrühren und unter Rühren aufkochen. Topf vom Herd, Sahne Protein, Chunky und Quark zügig einrühren.",
      "Pudding-Creme auf die 2 Schüsseln aufteilen, mit halbierten Erdbeeren toppen.",
      "Tortenguss nach Packungsanleitung kochen — Zucker durch Zerup oder Erythrit ersetzen. Auf die Schälchen aufteilen, fest werden lassen.",
    ],
    nutrition: {
      kcal: 394,
      protein: 31,
      carbs: 57,
      fat: 4,
    },
    sourceUrl: "https://www.instagram.com/reel/DX2COGAMimz/",
    sourceLabel: "Original-Reel @bienesfitlife",
  },
  {
    slug: "zitronen-loeffelkuchen",
    packSlug: "meal-prep-heroes",
    number: 2,
    title: "Zitronen-Löffelkuchen",
    subtitle: "4 Schälchen · 301 kcal · 31 g Protein",
    description:
      "Bienes Anti-Heißhunger-Mealprep für 4 Tage — Löffelbiskuit-Boden, fluffige Quark-Sahne-Creme mit Lemon-Ice-Cream-Cake-Chunky. Ohne Zucker, super cremig.",
    prepTime: 10,
    cookTime: 0,
    difficulty: "Einfach",
    servings: 4,
    tags: ["Anzeige", "ohne Zucker", "Mealprep", "anti-Heißhunger", "Schnell"],
    ingredients: [
      { amount: "700 g", name: "Magerquark" },
      { amount: "40 g", name: "MORE Protein Sahne" },
      { amount: "60 ml", name: "Mandelmilch" },
      { amount: "100 ml", name: "Cremefine 19 %", note: "zum Aufschlagen" },
      { amount: "9 g", name: "MORE Chunky Lemon Ice Cream Cake" },
      { amount: "8 Stk", name: "Löffelbiskuits", note: "ohne Zuckerkruste" },
      { amount: "etwas", name: "Mandelmilch", note: "zum Tränken" },
      { amount: "20 g", name: "Löffelbiskuits", note: "Topping · zerbröselt" },
    ],
    steps: [
      "MORE Protein mit Mandelmilch verrühren, dann mit Magerquark vermengen.",
      "Quarkmasse mit Chunky süßen, beiseite stellen.",
      "Sahne separat (ggf. mit Sahnesteif) aufschlagen, unter die Quarkmasse heben.",
      "In 4 Schüsseln je 2 Löffelbiskuits legen, mit etwas Milch tränken.",
      "Mit der Quark-Sahne-Creme toppen, glatt streichen, mit zerbröselten Biscuits bestreuen.",
      "1–2 Stunden in den Kühlschrank — optimal kalt aus dem Kühlschrank.",
    ],
    nutrition: {
      kcal: 301,
      protein: 31,
      carbs: 26,
      fat: 7,
    },
    sourceUrl: "https://www.instagram.com/reel/DWWZ_Q0MKxO/",
    sourceLabel: "Original-Reel @bienesfitlife",
  },
  {
    slug: "suesskartoffel-tarte",
    packSlug: "meal-prep-heroes",
    number: 3,
    title: "Süßkartoffel-Tarte",
    subtitle: "4 Viertel · 393 kcal · 31 g Protein",
    description:
      "Bienes herzhaftes Mealprep für 4 Tage — Süßkartoffel-Boden mit Brokkoli, Paprika, Feta und Eier-Käse-Mischung. Schmeckt kalt und warm.",
    prepTime: 15,
    cookTime: 25,
    difficulty: "Einfach",
    servings: 4,
    tags: ["Anzeige", "Mealprep", "High-Protein", "WPF-Mahlzeit"],
    ingredients: [
      { amount: "550 g", name: "Süßkartoffel" },
      { amount: "100 g", name: "Brokkoli" },
      { amount: "100 g", name: "Paprika" },
      { amount: "1", name: "Zwiebel", note: "klein" },
      { amount: "100 g", name: "Salakis Feta Light" },
      { amount: "6", name: "Eier" },
      { amount: "40 g", name: "MORE Protein Sahne" },
      { amount: "100 ml", name: "Mandelmilch" },
      { amount: "Salz", name: "" },
      { amount: "100 g", name: "Reibekäse Light" },
      { amount: "Gewürze", name: "z. B. MORE Knobilicious" },
    ],
    steps: [
      "Süßkartoffeln schälen und weich garen (Mikrowelle oder Ofen). Brokkoli ca. 10 Min vordünsten.",
      "Eier verrühren, Sahne Protein mit Mandelmilch anrühren, unter die Eimasse. Hälfte des Reibekäses einrühren.",
      "Paprika, Zwiebel und Feta klein schneiden.",
      "Süßkartoffel in der 26er Quiche-Form platt drücken, mit Brokkoli, Paprika, Zwiebeln und Feta toppen.",
      "Mit der Ei-Käse-Masse übergießen, mit restlichem Käse toppen.",
      "Bei 180 °C Umluft ca. 20–25 Min backen.",
    ],
    nutrition: {
      kcal: 393,
      protein: 31,
      carbs: 37,
      fat: 14,
    },
    sourceUrl: "https://www.instagram.com/reel/DVrPXVyDltq/",
    sourceLabel: "Original-Reel @bienesfitlife",
  },
  {
    slug: "mealprep-lasagne",
    packSlug: "meal-prep-heroes",
    number: 4,
    title: "Mealprep-Lasagne in der Glas-Dose",
    subtitle: "2 Dosen · 704 kcal · 66 g Protein · 15 Min",
    description:
      "Bienes Lasagne als Mealprep für 2–3 Tage — perfekt zum Einfrieren, Aufwärmen, kalt und warm genießen. Pro Dose über 60 g Protein.",
    prepTime: 10,
    cookTime: 20,
    difficulty: "Einfach",
    servings: 2,
    tags: ["Anzeige", "Mealprep", "High-Protein", "WPF-Mahlzeit", "TK-tauglich"],
    ingredients: [
      { amount: "350 g", name: "Hack", note: "vegan oder normal" },
      { amount: "500 g", name: "gehackte Tomaten" },
      { amount: "Gewürze", name: "z. B. MORE Pasta Allrounder" },
      { amount: "6", name: "Lasagne-Blätter", note: "vorgekocht · 3 Blätter halbiert" },
      { amount: "60 g", name: "MORE Protein Sahne" },
      { amount: "ca. 100 ml", name: "Mandelmilch" },
      { amount: "80 g", name: "Reibekäse Light" },
    ],
    steps: [
      "Hack anbraten, mit gehackten Tomaten ablöschen und würzen.",
      "Sahne-Sauce aus Sahne Protein und Mandelmilch anrühren.",
      "In Glas-Dosen schichten: Mit Tomatensauce beginnen und abschließen, dann mit Käse toppen.",
      "Bei 175 °C Umluft ca. 15–20 Min backen.",
    ],
    nutrition: {
      kcal: 704,
      protein: 66,
      carbs: 51,
      fat: 26,
    },
    sourceUrl: "https://www.instagram.com/reel/DVHA9mujq5A/",
    sourceLabel: "Original-Reel @bienesfitlife",
  },
  {
    slug: "mealprep-pizza-bowl",
    packSlug: "meal-prep-heroes",
    number: 5,
    title: "5-Min Mealprep Pizza-Bowl",
    subtitle: "1 Bowl · 439 kcal · 47 g Protein",
    description:
      "Bienes Pizza-Bowl als Abnehm-Frühstück to-go — fluffig, lecker und mit über 47 g Protein. Schmeckt direkt warm oder später kalt.",
    prepTime: 5,
    cookTime: 18,
    difficulty: "Einfach",
    servings: 1,
    tags: ["Anzeige", "Mealprep", "High-Protein", "WPF-Mahlzeit", "Schnell"],
    ingredients: [
      { amount: "40 g", name: "Mehl", note: "Teig" },
      { amount: "25 g", name: "MORE Protein Sahne", note: "Teig" },
      { amount: "3 g", name: "Backpulver", note: "Teig" },
      { amount: "2 g", name: "Salz", note: "Teig" },
      { amount: "50 g", name: "Magerquark", note: "Teig" },
      { amount: "50–80 ml", name: "Wasser", note: "Teig · langsam zugeben" },
      { amount: "50 g", name: "passierte Tomaten", note: "Belag" },
      { amount: "Gewürze", name: "z. B. MORE Italian Allrounder", note: "Belag" },
      { amount: "30 g", name: "Reibekäse Light", note: "Belag" },
      { amount: "25 g", name: "(vegane) Salami", note: "Belag · z. B. Billie Green" },
    ],
    steps: [
      "Trockene Zutaten für den Teig vermengen, mit Wasser und Magerquark verrühren — zunächst weniger Wasser, dann nachgießen bis die Konsistenz passt.",
      "Auf den Teig passierte Tomaten, Gewürze, Käse und Salami verteilen.",
      "Bei 175 °C Umluft ca. 18–20 Min backen.",
    ],
    nutrition: {
      kcal: 439,
      protein: 47,
      carbs: 37,
      fat: 10,
    },
    sourceUrl: "https://www.instagram.com/reel/DTs8ClSjt6Q/",
    sourceLabel: "Original-Reel @bienesfitlife",
  },
  {
    slug: "banana-bread-pudding",
    packSlug: "meal-prep-heroes",
    number: 6,
    title: "Banana Bread Pudding",
    subtitle: "3 Schüsseln · 439 kcal · 32 g Protein · 10 Min",
    description:
      "Bienes Banana Bread Pudding ohne Kochen, ohne Zucker — Mealprep für 3 Tage. Schmeckt am besten durchgezogen und kalt aus dem Kühlschrank.",
    prepTime: 10,
    cookTime: 0,
    difficulty: "Einfach",
    servings: 3,
    tags: ["Anzeige", "ohne Zucker", "ohne Kochen", "Mealprep", "WPF-Mahlzeit"],
    ingredients: [
      { amount: "180 ml", name: "Cremefine 19 %", note: "zum Aufschlagen" },
      { amount: "1 Pck", name: "Sahnesteif" },
      { amount: "450 ml", name: "Mandelmilch ungesüßt" },
      { amount: "90 g", name: "MORE Protein Pudding neutral", note: "Pudding-Mix mit Xanthan, ohne Kochen" },
      { amount: "300 g", name: "Magerquark" },
      { amount: "9 g", name: "MORE Chunky Vanilla Perfection", note: "oder Vanilla Chocolate Chip Cookie" },
      { amount: "200 g", name: "Banane" },
      { amount: "50 g", name: "Chocolate Chip Cookies", note: "oder Löffelbiskuits" },
    ],
    steps: [
      "Sahne mit Sahnesteif aufschlagen, beiseite stellen.",
      "Pudding-Mix 1 Min mit der Mandelmilch mixen, bis fest und cremig. Magerquark und Chunky einrühren, dann die Sahne unterheben.",
      "Bananenscheiben und zerbröselte Kekse einrühren — fertig sind die 3 Mealprep-Portionen.",
    ],
    nutrition: {
      kcal: 439,
      protein: 32,
      carbs: 47,
      fat: 16,
    },
    sourceUrl: "https://www.instagram.com/reel/DTh3VSqDDl_/",
    sourceLabel: "Original-Reel @bienesfitlife",
  },
  {
    slug: "spekulatius-tiramisu",
    packSlug: "meal-prep-heroes",
    number: 7,
    title: "Mealprep Tiramisu · Spekulatius-Edition",
    subtitle: "4 Schälchen · 296 kcal · 31 g Protein",
    description:
      "Bienes Anti-Heißhunger-Mealprep für 4 Tage — Winter-Edition des viralen Tiramisus mit Zimt und Spekulatius-Gewürz. Hält sich mehrere Tage.",
    prepTime: 10,
    cookTime: 0,
    difficulty: "Einfach",
    servings: 4,
    tags: ["Anzeige", "ohne Zucker", "Mealprep", "Winter", "anti-Heißhunger"],
    ingredients: [
      { amount: "700 g", name: "Magerquark", note: "Creme" },
      { amount: "40 g", name: "MORE Protein Sahne", note: "Creme" },
      { amount: "60 ml", name: "Mandelmilch", note: "Creme" },
      { amount: "12 g", name: "MORE Chunky Vanilla Perfection", note: "Creme · + Zimt + etwas Spekulatius-Gewürz" },
      { amount: "100 ml", name: "Cremefine 19 %", note: "Creme · zum Aufschlagen" },
      { amount: "8 Stk", name: "Löffelbiskuits", note: "ohne Zuckerkruste" },
      { amount: "etwas", name: "kalter Kaffee", note: "oder Mandelmilch zum Tränken" },
      { amount: "10 g", name: "Backkakao", note: "Topping" },
      { amount: "5 g", name: "Spekulatius-Gewürz", note: "Topping" },
    ],
    steps: [
      "Sahne Protein mit Mandelmilch verrühren, dann mit Magerquark vermengen.",
      "Quarkmasse mit Chunky süßen, Zimt und Spekulatius-Gewürz dazugeben, beiseite stellen.",
      "Cremefine separat aufschlagen, unter die Quarkmasse heben.",
      "In 4 Schüsseln je 2 Löffelbiskuits legen, mit etwas Kaffee oder Mandelmilch tränken.",
      "Mit der Quark-Sahne-Creme toppen, glatt streichen, mit Backkakao + Spekulatius-Gewürz bestreuen.",
    ],
    nutrition: {
      kcal: 296,
      protein: 31,
      carbs: 24,
      fat: 8,
    },
    sourceUrl: "https://www.instagram.com/reel/DSF-I3SDgc3/",
    sourceLabel: "Original-Reel @bienesfitlife",
  },
  {
    slug: "feta-haehnchen-blech",
    packSlug: "meal-prep-heroes",
    number: 8,
    title: "Virales Feta-Hähnchen-Blech",
    subtitle: "4 Portionen · 668 kcal · 50 g Protein",
    description:
      "Bienes Optimierung des viralen Feta-Hähnchen-Blechs (Original by @adamhoad_coaching) — als perfekte große WPF-Mahlzeit für 4 Tage. Mit Süßkartoffel, Brokkoli und Protein-Joghurt-Dressing.",
    prepTime: 10,
    cookTime: 30,
    difficulty: "Einfach",
    servings: 4,
    tags: ["Anzeige", "Mealprep", "High-Protein", "WPF-Mahlzeit", "Sheet-Pan"],
    ingredients: [
      { amount: "500 g", name: "Süßkartoffel" },
      { amount: "265 g", name: "Kichererbsen", note: "1 Dose" },
      { amount: "250 g", name: "Brokkoli", note: "frisch" },
      { amount: "200 g", name: "rote Zwiebel" },
      { amount: "etwas", name: "MORE 2 kcal Ölspray" },
      { amount: "Gewürze", name: "z. B. MORE Knobilicious" },
      { amount: "180 g", name: "Salakis Feta Light" },
      { amount: "400 g", name: "Hähnchenbrust", note: "oder 360 g Like-Chicken-Filet (Like Meat)" },
      { amount: "4", name: "Eier", note: "gekocht" },
      { amount: "400 g", name: "fettarmer griechischer Joghurt", note: "Dressing" },
      { amount: "80 g", name: "MORE Protein Sahne", note: "Dressing" },
      { amount: "Knobilicious", name: "MORE", note: "Dressing" },
      { amount: "1 Prise", name: "Salz", note: "Dressing" },
    ],
    steps: [
      "Ofen auf 200 °C Umluft vorheizen. Süßkartoffel, Brokkoli und Zwiebel auf ein Blech, würzen und vermengen. Feta darüber bröseln.",
      "30 Min im vorgeheizten Backofen bei 200 °C braten.",
      "In der Zeit Hähnchen entweder in der Pfanne anbraten oder auf einem zweiten Blech 20–25 Min backen.",
      "Dressing aus den angegebenen Zutaten anmischen. Eier kochen.",
      "Auf 4 Schüsseln aufteilen — fertig!",
    ],
    nutrition: {
      kcal: 668,
      protein: 50,
      carbs: 57,
      fat: 23,
    },
    sourceUrl: "https://www.instagram.com/reel/DP1Aq4MDP8o/",
    sourceLabel: "Original-Reel @bienesfitlife",
  },
];

// Lazy-imported to avoid a circular dep (recipe-micros.ts imports Micronutrient
// from this file). The import happens at first call, not at module-load time.
let _microsCache: Record<string, Micronutrient[]> | null = null;
function getMicros(): Record<string, Micronutrient[]> {
  if (_microsCache) return _microsCache;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("./recipe-micros") as {
      recipeMicros: Record<string, Micronutrient[]>;
    };
    _microsCache = mod.recipeMicros;
  } catch {
    _microsCache = {};
  }
  return _microsCache;
}

// Hero image URLs are auto-generated by scripts/generate-recipe-heroes.ts
// and cached in lib/recipe-heroes.ts. Same lazy-import pattern as micros so
// callers don't need to know either file exists.
let _heroesCache: Record<string, string> | null = null;
function getHeroes(): Record<string, string> {
  if (_heroesCache) return _heroesCache;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("./recipe-heroes") as {
      recipeHeroes: Record<string, string>;
    };
    _heroesCache = mod.recipeHeroes;
  } catch {
    _heroesCache = {};
  }
  return _heroesCache;
}

// Single enrichment pass — attaches both AI-generated micros and the auto-
// generated hero image URL. Each is a pure data merge: existing fields on
// the recipe always win, so a recipe that ships its own hero or its own
// micros is untouched.
function enrich(recipe: Recipe): Recipe {
  let next = recipe;
  if (!next.nutrition.micros || next.nutrition.micros.length === 0) {
    const fromAi = getMicros()[recipe.slug];
    if (fromAi && fromAi.length > 0) {
      next = { ...next, nutrition: { ...next.nutrition, micros: fromAi } };
    }
  }
  if (!next.hero) {
    const heroUrl = getHeroes()[recipe.slug];
    if (heroUrl) {
      next = { ...next, hero: heroUrl };
    }
  }
  return next;
}

// Static fallback (used when Supabase is unavailable or row not in DB).
function staticRecipesForPack(packSlug: string): Recipe[] {
  return recipes
    .filter((recipe) => recipe.packSlug === packSlug)
    .sort((a, b) => a.number - b.number)
    .map(enrich);
}

// ════════════════════════════════════════════════
// MERGE — single source of truth for "the order recipes appear in this pack"
//
// Custom cards always come first (newest createdAt → top), curated recipes
// follow in their authored order. Numbers get rewritten to the merged
// position so the index, mega-numbers and table rows all read 01..N
// regardless of when a card was added or what number was stored on it.
//
// Used by:
//  - components/nutrition-overview.tsx (pack table on the web)
//  - lib/pdf/job-runner.ts (pack PDF render)
//  - components/custom-recipe-view.tsx (next/prev navigation order)
// ════════════════════════════════════════════════
export type MergeableCustom<R extends Recipe = Recipe> = R & {
  createdAt?: number;
};

export function mergeAndRenumber<R extends Recipe>(
  staticRecipes: R[],
  customRecipes: MergeableCustom<R>[]
): R[] {
  const sortedCustom = [...customRecipes].sort(
    (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)
  );
  const sortedStatic = [...staticRecipes].sort((a, b) => a.number - b.number);
  const merged = [...sortedCustom, ...sortedStatic];
  return merged.map((recipe, idx) => ({
    ...recipe,
    number: idx + 1,
  })) as R[];
}

function staticRecipe(
  packSlug: string,
  recipeSlug: string
): Recipe | undefined {
  const r = recipes.find(
    (recipe) => recipe.packSlug === packSlug && recipe.slug === recipeSlug
  );
  return r ? enrich(r) : undefined;
}

// Code (lib/recipes.ts) is the single source of truth for curated recipes.
// Adding a recipe to the array above makes it visible immediately — no DB
// reseed required. The DB seed (scripts/seed-recipes-to-db.ts) is still useful
// to mirror the catalogue for downstream consumers (admin tools, analytics),
// but it is NOT on the read path: a stale or empty DB row never causes a
// curated recipe to disappear from the UI.
//
// We additionally surface "DB-only" curated rows (is_custom=false rows whose
// slug isn't in code yet) so an admin could add a recipe directly to the DB
// in a pinch — e.g. for a hotfix without a code deploy. Such rows are merged
// in alongside the code list, deduped by slug (code wins on conflict).
//
// Custom recipes (is_custom=true, written by the editor at /new) live ONLY
// in the DB and are loaded via lib/custom-recipes.ts on the client.
// Cache-Bust-Helper fuer DB-Hero-URLs.
//
// Hintergrund: das Bulk-Reseed schreibt Supabase-Storage-URLs in data.hero
// ohne Query-Suffix (rohe https://.../uuid.jpg). Vercel Image Optimization
// und der Browser haben unter dieser URL noch alte optimierte/cached
// Varianten von frueheren Rendern (v3/v8). Die Code-Map in
// lib/recipe-heroes.ts hat seit v9.4 ein ?v=v9.4 Cache-Bust-Suffix, das
// Vercel zu einer frischen Optimierung zwingt.
//
// Damit DB-Heroes und Code-Map dasselbe Caching-Verhalten haben, appenden
// wir den gleichen ?v=v9.4 Suffix nachtraeglich beim Lesen aus der DB —
// wenn die URL nicht schon einen Query-Suffix hat (neue Renders vom
// uploadJpeg-Fix bringen ?t=<ms> mit, den respektieren wir).
function withHeroCacheBust(url: string): string {
  if (url.includes("?")) return url;
  return `${url}?v=v9.4`;
}

// Server-Cache fuer komplette DB-Pack-Daten. Ohne Cache wuerde jede Pack-
// Page einen Supabase-Roundtrip machen (~100-300ms inkl. Cold-Start) und
// die Navigation ist nicht fluessig. Mit Cache: erster Page-Load eines
// Pack hat den Query, naechste Loads in 30s holen aus Memory.
//
// Wir caches RAW DB rows (recipe_slug, hero + full custom data). Die
// Listen-Page extrahiert die hero-map, die Detail-Page filtert per slug.
// Re-Roll-Button + Bulk-Reseed invalidieren via revalidatePath() im
// enrich-Endpoint, damit neue Bilder sofort sichtbar werden.
type CachedPackRow = {
  recipe_slug: string;
  hero: string | null;
  data: Recipe | null; // null for non-custom (slim-load); set for custom
};

const getPackDbRows = unstable_cache(
  async (packSlug: string): Promise<CachedPackRow[]> => {
    try {
      const { getServerSupabase, hasServerSupabase } = await import(
        "./supabase-server"
      );
      if (!hasServerSupabase()) return [];
      const supabase = getServerSupabase();
      // Holt fuer ALLE Rezepte eines Pack:
      //   - recipe_slug + hero (slim) — fuer Static-Override
      //   - data (full) — nur fuer is_custom=true (User-erstellt)
      // Static-Rezepte brauchen kein full data (kommt aus lib/recipes.ts).
      const { data, error } = await supabase
        .from("recipes")
        .select("recipe_slug, is_custom, hero:data->>hero, data")
        .eq("pack_slug", packSlug);
      if (error || !data) return [];
      return (
        data as Array<{
          recipe_slug: string;
          is_custom: boolean;
          hero: string | null;
          data: Recipe | null;
        }>
      ).map((row) => ({
        recipe_slug: row.recipe_slug,
        hero: row.hero,
        data: row.is_custom ? row.data : null,
      }));
    } catch {
      return [];
    }
  },
  ["pack-db-rows"],
  { revalidate: 30 }
);

export async function getRecipesForPack(
  packSlug: string
): Promise<Recipe[]> {
  const fromCode = staticRecipesForPack(packSlug);
  const codeSlugs = new Set(fromCode.map((r) => r.slug));

  // Single gecachter DB-Roundtrip (30s TTL). Pack-Page navigation ist
  // wieder fluessig — wiederholte Visits in 30s gehen aus Memory.
  const dbRows = await getPackDbRows(packSlug);

  // Hero-Override fuer static recipes
  const staticWithDbHero = fromCode.map((r) => {
    const row = dbRows.find((x) => x.recipe_slug === r.slug);
    return row?.hero ? { ...r, hero: withHeroCacheBust(row.hero) } : r;
  });

  // Custom recipes (is_custom=true), die nicht in der static-Liste sind
  const dbOnly = dbRows
    .filter((row) => row.data && !codeSlugs.has(row.recipe_slug))
    .map((row) => row.data as Recipe);

  if (dbOnly.length === 0) return staticWithDbHero;
  return [...staticWithDbHero, ...dbOnly].sort(
    (a, b) => a.number - b.number
  );
}

export async function getRecipe(
  packSlug: string,
  recipeSlug: string
): Promise<Recipe | undefined> {
  // Code wins fuer das Rezept-Inhalt (Title, Steps, Nutrition etc.). ABER:
  // das hero-Feld bekommt eine Ausnahme — wenn der Operator den
  // "KI-Alternative"-Button im Detail-View geklickt hat, hat der enrich-
  // Endpoint ein frisches Hero in die DB geschrieben. Das wollen wir
  // sehen, sonst ist der Re-Roll-Button unsichtbar (Map ueberschreibt
  // immer den DB-Eintrag). Loesung: static recipes laden, dann fuer das
  // hero-Feld einen 1-Spalten-DB-Query nachlegen und wenn da ein hero
  // ist, ueberschreiben.
  const fromCode = staticRecipe(packSlug, recipeSlug);
  if (fromCode) {
    // Re-Use des gecachten Pack-DB-Reads (shared mit Listen-View).
    // Kein zweiter Roundtrip wenn die Pack-Page schon besucht wurde.
    const dbRows = await getPackDbRows(packSlug);
    const row = dbRows.find((x) => x.recipe_slug === recipeSlug);
    if (row?.hero)
      return { ...fromCode, hero: withHeroCacheBust(row.hero) };
    return fromCode;
  }

  try {
    const { getServerSupabase, hasServerSupabase } = await import(
      "./supabase-server"
    );
    if (!hasServerSupabase()) return undefined;
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("recipes")
      .select("data")
      .eq("pack_slug", packSlug)
      .eq("recipe_slug", recipeSlug)
      .eq("is_custom", false)
      .maybeSingle();
    if (error || !data) return undefined;
    return (data as { data: Recipe }).data;
  } catch (err) {
    console.warn("[recipes] DB load failed", err);
    return undefined;
  }
}

// Holt die DB-Row-UUID eines (auch statisch geseedeten) Rezepts. Wird vom
// Detail-View gebraucht, damit der "Bild neu generieren"-Button die richtige
// Row in /api/recipes/enrich addressieren kann. getRecipe() liest "code wins"
// aus lib/recipes.ts und kennt die DB-ID nicht — diese Funktion macht den
// expliziten Lookup. Returnt null, wenn keine Row da ist (z. B. lokale Dev-Env
// ohne Supabase-Konfig oder Row noch nicht geseedet).
export async function getRecipeRowIdFromDb(
  brandSlug: string,
  packSlug: string,
  recipeSlug: string
): Promise<string | null> {
  try {
    const { getServerSupabase, hasServerSupabase } = await import(
      "./supabase-server"
    );
    if (!hasServerSupabase()) return null;
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("recipes")
      .select("id")
      .eq("brand_slug", brandSlug)
      .eq("pack_slug", packSlug)
      .eq("recipe_slug", recipeSlug)
      .maybeSingle();
    if (error || !data) return null;
    return (data as { id: string }).id;
  } catch (err) {
    console.warn("[recipes] row-id lookup failed", err);
    return null;
  }
}
