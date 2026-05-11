// Hero-Image-URL pro Recipe-Slug.
//
// Aktuelle Quelle: lokale Flux-2-Pro-JPEGs unter public/brands/biene/heroes/.
// Diese werden von scripts/generate-recipe-heroes.ts generiert.
//
// Hintergrund: Am 2026-05-11 hatte ein Ingo-Feedback-Patch versucht, das
// Reel-Cover-Frame (Apify displayUrl) als Hero zu nutzen. Das war ein
// Missverstaendnis — das Cover ist das vom Creator designte Instagram-
// Thumbnail mit Werbe-Text-Overlays ("WIE VERRÜCKT ist es", Kalorien-
// Stempel) und oft Talking-Head-Shots. Nicht Recipe-Card-tauglich.
//
// Die korrekte Pipeline (Jan's Spec) holt sich Keyframes aus dem Video,
// laesst ein Vision-Model den besten saubereren Frame waehlen und gibt
// diesen als Reference-Image an Flux 2 Pro mit Image-to-Image-Mode. Diese
// Pipeline wird separat gebaut — solange leben wir mit den alten Flux-
// Brand-Style-Heroes hier.

export const recipeHeroes: Record<string, string> = {
  "banana-bread-pudding": "/brands/biene/heroes/banana-bread-pudding.jpg",
  "beeren-cookie-crumble": "/brands/biene/heroes/beeren-cookie-crumble.jpg",
  "blaubeer-cheesecake-no-bake": "/brands/biene/heroes/blaubeer-cheesecake-no-bake.jpg",
  "blech-pasta": "/brands/biene/heroes/blech-pasta.jpg",
  "blitz-cheeseburger-auflauf": "/brands/biene/heroes/blitz-cheeseburger-auflauf.jpg",
  "drei-zutaten-eisbowl": "/brands/biene/heroes/drei-zutaten-eisbowl.jpg",
  "einfachstes-protein-brot": "/brands/biene/heroes/einfachstes-protein-brot.jpg",
  "erdbeer-biscuit-pudding-kuchen": "/brands/biene/heroes/erdbeer-biscuit-pudding-kuchen.jpg",
  "erdbeer-kuppeltorte": "/brands/biene/heroes/erdbeer-kuppeltorte.jpg",
  "erdbeer-loeffelkuchen": "/brands/biene/heroes/erdbeer-loeffelkuchen.jpg",
  "feta-haehnchen-blech": "/brands/biene/heroes/feta-haehnchen-blech.jpg",
  "frozen-coconut-strawberry-cups": "/brands/biene/heroes/frozen-coconut-strawberry-cups.jpg",
  "kaese-nudeln": "/brands/biene/heroes/kaese-nudeln.jpg",
  "kaese-zucchini-frittata": "/brands/biene/heroes/kaese-zucchini-frittata.jpg",
  "kartoffelsalat-protein-mayo": "/brands/biene/heroes/kartoffelsalat-protein-mayo.jpg",
  "ki-suesskartoffel-muffins": "/brands/biene/heroes/ki-suesskartoffel-muffins.jpg",
  "langos-airfryer-flammkuchen": "/brands/biene/heroes/langos-airfryer-flammkuchen.jpg",
  "lebensveraendernder-salat": "/brands/biene/heroes/lebensveraendernder-salat.jpg",
  "leichter-oster-zupfkuchen": "/brands/biene/heroes/leichter-oster-zupfkuchen.jpg",
  "marzipankartoffeln": "/brands/biene/heroes/marzipankartoffeln.jpg",
  "mealprep-lasagne": "/brands/biene/heroes/mealprep-lasagne.jpg",
  "mealprep-pizza-bowl": "/brands/biene/heroes/mealprep-pizza-bowl.jpg",
  "mini-franzbroetchen": "/brands/biene/heroes/mini-franzbroetchen.jpg",
  "protein-bananenbrot": "/brands/biene/heroes/protein-bananenbrot.jpg",
  "protein-griesspudding": "/brands/biene/heroes/protein-griesspudding.jpg",
  "protein-kaiserschmarren": "/brands/biene/heroes/protein-kaiserschmarren.jpg",
  "schoko-biskuitrolle": "/brands/biene/heroes/schoko-biskuitrolle.jpg",
  "spekulatius-tiramisu": "/brands/biene/heroes/spekulatius-tiramisu.jpg",
  "suesskartoffel-tarte": "/brands/biene/heroes/suesskartoffel-tarte.jpg",
  "viral-cloud-wrap": "/brands/biene/heroes/viral-cloud-wrap.jpg",
  "viral-xl-gemuese-wrap": "/brands/biene/heroes/viral-xl-gemuese-wrap.jpg",
  "virale-pasta-pfanne": "/brands/biene/heroes/virale-pasta-pfanne.jpg",
  "xl-mexican-bowl": "/brands/biene/heroes/xl-mexican-bowl.jpg",
  "xxl-frueh-cookie": "/brands/biene/heroes/xxl-frueh-cookie.jpg",
  "zimt-streuseltaler": "/brands/biene/heroes/zimt-streuseltaler.jpg",
  "zitronen-loeffelkuchen": "/brands/biene/heroes/zitronen-loeffelkuchen.jpg",
  "zuckerfreier-hefezopf": "/brands/biene/heroes/zuckerfreier-hefezopf.jpg",
};

// Helper that returns the hero URL for a recipe slug, or undefined if no
// image has been generated yet (custom recipes from the editor before the
// async enrichment kicks in).
export function getRecipeHero(slug: string): string | undefined {
  return recipeHeroes[slug];
}
