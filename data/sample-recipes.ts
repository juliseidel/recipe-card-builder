import type { Recipe } from "@/types/recipe";

export const sampleRecipes: Recipe[] = [
  {
    id: "erdbeer-mealprep",
    slug: "erdbeerkuchen-mealprep",
    title: "Erdbeerkuchen-Mealprep",
    subtitle: "Ohne Backen · in 15 Minuten",
    description:
      "Cremiger Vanille-Pudding auf Löffelbiscuits, getoppt mit frischen Erdbeeren — perfekt zum Mitnehmen.",
    servings: 2,
    prepMinutes: 15,
    cookMinutes: 0,
    totalMinutes: 15,
    difficulty: "easy",
    tags: ["Frühstück", "Mealprep", "Ohne Backen", "High-Protein"],
    highlights: [
      "ohne Backen",
      "in 15 min gemacht",
      "nur 394 kcal",
      "31 g Protein pro Schüssel",
    ],
    ingredients: [
      { amount: "8", name: "Löffelbiscuits", group: "Boden" },
      { amount: "200", unit: "g", name: "Magerquark", group: "Creme" },
      { amount: "1", name: "Päckchen Vanille-Puddingpulver", group: "Creme" },
      { amount: "300", unit: "ml", name: "Mandelmilch", group: "Creme" },
      {
        amount: "40",
        unit: "g",
        name: 'MORE Protein „Sahne"',
        group: "Creme",
      },
      {
        amount: "6–9",
        unit: "g",
        name: "Chunky Flavour Vanilla Perfection",
        group: "Creme",
      },
      { amount: "200", unit: "g", name: "frische Erdbeeren", group: "Topping" },
      { amount: "1", name: "Päckchen Tortenguss rot", group: "Topping" },
      {
        amount: "nach Geschmack",
        name: "Erythrit oder Zerup zum Süßen",
        group: "Topping",
      },
    ],
    steps: [
      {
        index: 1,
        text: "Löffelbiscuits auf zwei Schüsseln verteilen, optional mit etwas Milch oder Kaffee tränken.",
      },
      {
        index: 2,
        text: 'Puddingpulver mit kalter Mandelmilch verrühren, kurz aufkochen. Vom Herd nehmen, MORE Protein „Sahne", Chunky Flavour und Magerquark zügig einrühren.',
      },
      {
        index: 3,
        text: "Pudding-Creme gleichmäßig auf die Schüsseln verteilen.",
      },
      {
        index: 4,
        text: "Erdbeeren halbieren und großzügig darauf anrichten.",
      },
      {
        index: 5,
        text: "Tortenguss nach Packungsanleitung mit Erythrit aufkochen, vorsichtig über die Erdbeeren gießen, fest werden lassen und genießen.",
      },
    ],
    nutrition: { kcal: 394, protein: 31, carbs: 57, fat: 4 },
    notes: "Schmeckt am nächsten Tag noch besser — perfekt für Mealprep.",
    signature: "Deine Biene 🐝",
    imagePrompt:
      "two glass bowls of strawberry trifle with vanilla cream and whole strawberries on top, soft pink linen, warm morning light, hand-held cookbook style",
  },
  {
    id: "schoko-biskuitrolle",
    slug: "schoko-biskuitrolle",
    title: "Schoko-Biskuitrolle",
    subtitle: "140 g Protein · fast zuckerfrei",
    description:
      "Locker-saftige Biskuitrolle mit High-Protein-Schlagcreme — wie aus der Patisserie.",
    servings: 10,
    prepMinutes: 25,
    cookMinutes: 15,
    totalMinutes: 100,
    difficulty: "medium",
    tags: ["Dessert", "Backen", "High-Protein"],
    highlights: ["140 g Protein", "einfach gemacht", "unfassbar lecker", "fast zuckerfrei"],
    ingredients: [
      { amount: "50", unit: "g", name: "Mehl", group: "Teig" },
      {
        amount: "20",
        unit: "g",
        name: 'MORE Protein „Sahne"',
        group: "Teig",
      },
      { amount: "20", unit: "g", name: "Backkakao", group: "Teig" },
      { amount: "1", unit: "TL", name: "Backpulver", group: "Teig" },
      { amount: "¼", unit: "TL", name: "Salz", group: "Teig" },
      { amount: "4", name: "Eier (getrennt)", group: "Teig" },
      { amount: "140", unit: "g", name: "Erythrit oder No More Sugar", group: "Teig" },
      { amount: "50", unit: "g", name: "Butter, geschmolzen", group: "Teig" },
      {
        amount: "100",
        unit: "g",
        name: "MORE Protein Schlagcreme",
        group: "Creme",
      },
      { amount: "300", unit: "ml", name: "Mandelmilch", group: "Creme" },
      {
        amount: "9",
        unit: "g",
        name: "Chunky Flavour Vanilla Perfection",
        group: "Creme",
      },
      { amount: "1–2", name: "Päckchen Sahne steif", group: "Creme" },
      { amount: "200", unit: "g", name: "Exquisa fitline 2 %", group: "Creme" },
      { amount: "40", unit: "g", name: "85 % Zartbitterschokolade (optional)", group: "Topping" },
    ],
    steps: [
      {
        index: 1,
        text: "Ofen auf 170 °C Ober-/Unterhitze vorheizen. Blech mit Backpapier auslegen.",
      },
      {
        index: 2,
        text: "Mehl, Kakao, Protein und Backpulver mischen.",
      },
      {
        index: 3,
        text: "Eiweiß steif schlagen, dabei die Hälfte des Erythrits einrieseln lassen.",
      },
      {
        index: 4,
        text: "Eigelb mit restlichem Erythrit 5 Minuten cremig schlagen.",
      },
      {
        index: 5,
        text: "Eischnee unterheben, Trockenmischung einsieben, zum Schluss Butter unterziehen.",
      },
      {
        index: 6,
        text: "Teig auf das Blech streichen und 10–20 Minuten backen.",
      },
      {
        index: 7,
        text: "Direkt nach dem Backen mit Kakao bestäuben, mit zweitem Backpapier eindrehen, auskühlen lassen.",
      },
      {
        index: 8,
        text: "Alle Creme-Zutaten steif schlagen, Rolle entrollen, bestreichen, wieder einrollen und mindestens 1 Stunde kühlen.",
      },
    ],
    nutrition: { kcal: 172, protein: 14, carbs: 8, fat: 9 },
    notes: "Pro Stück bei 10 Stücken — 2,5 Stück = 429 kcal mit 35 g Protein.",
    signature: "Deine Biene 🐝",
    imagePrompt:
      "elegant chocolate swiss roll cake on white porcelain plate, dusted cocoa, romantic patisserie photography, soft pink linen, dried flowers, watercolor mood",
  },
  {
    id: "pistazien-cheesecake",
    slug: "pistazien-cheesecake",
    title: "Pistazien-Cheesecake",
    subtitle: "ohne Backen · cremig & nussig",
    description:
      "Samtige Pistazien-Quark-Creme auf knusprigem Biscuit-Boden — Patisserie zum Selbermachen.",
    servings: 8,
    prepMinutes: 20,
    cookMinutes: 0,
    totalMinutes: 20 + 240,
    difficulty: "medium",
    tags: ["Dessert", "Ohne Backen", "Pistazie"],
    highlights: ["ohne Backen", "cremig & nussig", "300 kcal pro Stück", "16 g Protein"],
    ingredients: [
      { amount: "150", unit: "g", name: "Butterkekse", group: "Boden" },
      { amount: "60", unit: "g", name: "Butter, geschmolzen", group: "Boden" },
      { amount: "400", unit: "g", name: "Magerquark", group: "Creme" },
      { amount: "200", unit: "g", name: "Frischkäse 0,2 %", group: "Creme" },
      { amount: "70", unit: "g", name: "Pistazien-Mus", group: "Creme" },
      {
        amount: "30",
        unit: "g",
        name: "MORE Protein Vanille",
        group: "Creme",
      },
      {
        amount: "9",
        unit: "g",
        name: "Chunky Flavour Pistachio",
        group: "Creme",
      },
      { amount: "8", name: "Blatt Gelatine", group: "Creme" },
      { amount: "30", unit: "g", name: "Pistazien gehackt", group: "Topping" },
    ],
    steps: [
      {
        index: 1,
        text: "Kekse fein zerbröseln, mit Butter mischen und in eine 20 cm Springform drücken.",
      },
      {
        index: 2,
        text: "Gelatine in kaltem Wasser einweichen, leicht ausdrücken und in einem heißen Schuss Wasser auflösen.",
      },
      {
        index: 3,
        text: "Quark, Frischkäse, Pistazien-Mus, Protein und Chunky cremig rühren. Die warme Gelatine löffelweise zügig unterziehen.",
      },
      {
        index: 4,
        text: "Creme auf den Boden geben und 4 Stunden im Kühlschrank fest werden lassen.",
      },
      {
        index: 5,
        text: "Vor dem Servieren mit gehackten Pistazien und einem Pistazien-Mus-Drizzle dekorieren.",
      },
    ],
    nutrition: { kcal: 300, protein: 16, carbs: 28, fat: 12 },
    signature: "Deine Biene 🐝",
    imagePrompt:
      "pistachio cheesecake slice on cream porcelain, chopped pistachios on top, soft pastel green linen, romantic patisserie style, dreamy bokeh",
  },
  {
    id: "kaiserschmarrn",
    slug: "protein-kaiserschmarrn",
    title: "Protein Kaiserschmarrn",
    subtitle: "fluffig · alpenländisch",
    description: "Klassischer Kaiserschmarrn mit Protein-Boost und Apfelmus.",
    servings: 2,
    prepMinutes: 5,
    cookMinutes: 15,
    totalMinutes: 20,
    difficulty: "easy",
    tags: ["Frühstück", "Süß", "Schnell"],
    highlights: ["unter 15 Minuten", "fluffig", "421 kcal pro Portion", "30 g Protein"],
    ingredients: [
      { amount: "100", unit: "g", name: "Magerquark" },
      { amount: "3", name: "Eier (getrennt)" },
      {
        amount: "30",
        unit: "g",
        name: "MORE Protein Vanille",
      },
      { amount: "30", unit: "g", name: "Mehl" },
      {
        amount: "9",
        unit: "g",
        name: "Chunky Flavour Vanilla Perfection",
      },
      { amount: "1", unit: "Prise", name: "Salz" },
      {
        amount: "150",
        unit: "g",
        name: "ungesüßtes Apfelmus zum Servieren",
      },
    ],
    steps: [
      {
        index: 1,
        text: "Eiweiß mit Salz steif schlagen.",
      },
      {
        index: 2,
        text: "Eigelb, Quark, Mehl, Protein und Chunky glatt rühren.",
      },
      {
        index: 3,
        text: "Eischnee vorsichtig unter die Quark-Masse heben.",
      },
      {
        index: 4,
        text: "In einer beschichteten Pfanne goldbraun ausbacken, mit zwei Gabeln in mundgerechte Stücke zerreißen, weitere 2 Minuten knusprig anrösten.",
      },
      {
        index: 5,
        text: "Mit Apfelmus servieren.",
      },
    ],
    nutrition: { kcal: 421, protein: 30, carbs: 38, fat: 14 },
    signature: "Deine Biene 🐝",
    imagePrompt:
      "fluffy austrian kaiserschmarrn torn into pieces in a black pan with applesauce on the side, warm morning light, beige linen, hand-held cookbook style",
  },
  {
    id: "protein-pizza",
    slug: "protein-pizza",
    title: "Protein Pizza Margherita",
    subtitle: "fluffiger Quark-Boden · 38 g Protein",
    description:
      "Knusprig-fluffige Pizza auf Magerquark-Boden, klassisch belegt mit Tomate, Mozzarella und Basilikum.",
    servings: 1,
    prepMinutes: 10,
    cookMinutes: 15,
    totalMinutes: 25,
    difficulty: "easy",
    tags: ["Hauptgericht", "Pizza", "Herzhaft"],
    highlights: ["38 g Protein", "510 kcal", "fluffiger Quark-Boden", "in 25 min"],
    ingredients: [
      { amount: "150", unit: "g", name: "Magerquark", group: "Boden" },
      { amount: "120", unit: "g", name: "Dinkel-Vollkornmehl", group: "Boden" },
      { amount: "1", unit: "TL", name: "Backpulver", group: "Boden" },
      { amount: "1", unit: "Prise", name: "Salz", group: "Boden" },
      { amount: "100", unit: "g", name: "passierte Tomaten", group: "Belag" },
      {
        amount: "1",
        unit: "TL",
        name: "italienische Kräuter",
        group: "Belag",
      },
      { amount: "60", unit: "g", name: "light Mozzarella", group: "Belag" },
      { amount: "8", name: "Cocktail-Tomaten", group: "Belag" },
      { amount: "1", unit: "Handvoll", name: "frischer Basilikum", group: "Belag" },
    ],
    steps: [
      {
        index: 1,
        text: "Ofen auf 220 °C Ober-/Unterhitze vorheizen.",
      },
      {
        index: 2,
        text: "Quark, Mehl, Backpulver und Salz zu einem glatten Teig verkneten.",
      },
      {
        index: 3,
        text: "Teig auf Backpapier dünn ausrollen.",
      },
      {
        index: 4,
        text: "Tomatensauce mit Kräutern verrühren und auf den Boden streichen.",
      },
      {
        index: 5,
        text: "Mozzarella und halbierte Cocktail-Tomaten verteilen.",
      },
      {
        index: 6,
        text: "12–15 Minuten backen, mit frischem Basilikum servieren.",
      },
    ],
    nutrition: { kcal: 510, protein: 38, carbs: 62, fat: 12 },
    signature: "Deine Biene 🐝",
    imagePrompt:
      "rustic protein pizza margherita on warm wooden cutting board, melted mozzarella, fresh basil, dramatic side light, hearty cookbook photography",
  },
];
