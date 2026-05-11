// Hero-Image-URL pro Recipe-Slug.
//
// Ingo-Feedback Phase 3: vorher kamen die Heroes von scripts/generate-recipe-heroes.ts
// (Flux 2 Pro nach Brand-DNA-Prompt) als lokale JPEGs unter
// public/brands/biene/heroes/<slug>.jpg. Die matchten das echte Reel oft
// nicht. Jetzt zeigen die meisten Eintraege auf Reel-Cover-Frames im
// Supabase-Storage (Bucket `recipe-heroes`), gesetzt durch das einmalige
// /api/admin/reseed-heroes Bulk-Update am 2026-05-11.
//
// Die 3 Rezepte ohne sourceUrl (drei-zutaten-eisbowl, xl-mexican-bowl,
// xxl-frueh-cookie) behalten die alten lokalen Flux-Heroes — bei denen
// gibt es kein Reel, aus dem wir ein Cover-Frame ziehen koennten.
//
// Re-Seed (alle Reel-Cover-Heroes neu):
//   curl -X POST -H "Authorization: Bearer $ADMIN_RESEED_TOKEN" \
//        https://clever-satoshi-22bf41.vercel.app/api/admin/reseed-heroes
//
// Re-Seed (1 Recipe via HeroRerollButton im UI):
//   "KI-Alternative"-Button im Detail-View triggert Flux 2 Pro statt
//   Reel-Cover, ueberschreibt den Wert im DB-Row, nicht hier.
// Hinweis: dieser Eintrag wird von lib/recipes.ts:enrich() nur dann
// verwendet, wenn das DB-data.hero leer ist. Static-Bienes-Rezepte
// haben kein hero-Feld in lib/recipes.ts → diese Map ist ihr Hero.

export const recipeHeroes: Record<string, string> = {
  // Reel-Cover-Frames (Supabase Storage) — 34 Rezepte mit sourceUrl
  "banana-bread-pudding":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/93046853-c3a8-47bc-9e43-f83bbc0fc1f6.jpg",
  "beeren-cookie-crumble":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/1b31a572-9054-4114-8621-2e2eda793f27.jpg",
  "blaubeer-cheesecake-no-bake":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/0f2c6959-d722-4fd2-974d-d8b55dfbf0d8.jpg",
  "blech-pasta":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/d4b5c445-2451-4b36-8523-ab8b0fc03907.jpg",
  "blitz-cheeseburger-auflauf":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/daf0c0a9-07d6-4735-bbb8-ba01df6a29a8.jpg",
  "einfachstes-protein-brot":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/b05780ef-28a0-4d43-ad6a-77779867fa6b.jpg",
  "erdbeer-biscuit-pudding-kuchen":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/b1d8a984-40da-4327-b9d7-9f3cbf606d49.jpg",
  "erdbeer-kuppeltorte":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/1c0ac046-b7c1-4388-9e08-f660181ddb2d.jpg",
  "erdbeer-loeffelkuchen":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/fdb926f7-9c99-4ca2-8a89-558183039e0b.jpg",
  "feta-haehnchen-blech":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/aa53f0cb-4940-44e6-8e64-615acdd57391.jpg",
  "frozen-coconut-strawberry-cups":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/5cc84e3e-be4d-4e42-a62b-a17f982b64c8.jpg",
  "kaese-nudeln":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/ef1becb6-daff-46a3-a966-429fe9638079.jpg",
  "kaese-zucchini-frittata":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/ac591b3b-20ee-4dbc-bc3b-471fe83c7287.jpg",
  "kartoffelsalat-protein-mayo":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/a1108882-5eb1-4950-94be-0c924baed749.jpg",
  "ki-suesskartoffel-muffins":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/4754bae4-97d2-4e63-ae5d-0534961997ec.jpg",
  "langos-airfryer-flammkuchen":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/dfb60e62-79c7-49b3-9dcc-c9c4be317e2c.jpg",
  "lebensveraendernder-salat":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/7b91d431-6f61-4f7c-9d1d-f68c15089cef.jpg",
  "leichter-oster-zupfkuchen":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/876083b6-ed20-4647-899e-040a4c071b29.jpg",
  "marzipankartoffeln":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/c57b3672-41f9-4288-bba0-a97b6b951228.jpg",
  "mealprep-lasagne":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/66fd99a0-4f8e-43e7-8e9c-11642b0a365a.jpg",
  "mealprep-pizza-bowl":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/36bf65a0-1d7d-49a7-af85-dc632091ac6c.jpg",
  "mini-franzbroetchen":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/b7c4fb73-ae04-4630-834c-c1dde951235f.jpg",
  "protein-bananenbrot":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/17657beb-f44a-4c08-8471-8ed36a26bdea.jpg",
  "protein-griesspudding":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/9ffa2103-e535-4123-aea4-24adfeeca6c2.jpg",
  "protein-kaiserschmarren":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/d2aefdc7-736a-4d55-b67b-13dc2b704342.jpg",
  "schoko-biskuitrolle":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/c15a392d-2a37-452a-97e4-a0a37008992d.jpg",
  "spekulatius-tiramisu":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/317b8a9c-d7e4-4bad-b6c2-d3fedf62deae.jpg",
  "suesskartoffel-tarte":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/e8d05f14-82dd-4e31-8fce-01573fda8f6e.jpg",
  "viral-cloud-wrap":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/fd9c2b2d-80ea-4744-b77c-8b2d6d4255ea.jpg",
  "viral-xl-gemuese-wrap":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/f9e7eeea-5c3d-44d4-a78b-e8e1570e84a4.jpg",
  "virale-pasta-pfanne":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/cd428ded-b05f-4e97-8ec7-3b525538a573.jpg",
  "zimt-streuseltaler":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/ff51d8d6-c1e9-4ec6-a5d3-5ca693f56771.jpg",
  "zitronen-loeffelkuchen":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/aa25f4ad-8718-4e22-9b44-ef1a5696b569.jpg",
  "zuckerfreier-hefezopf":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/956b97d5-c209-44d3-9b9c-d842bedb8b79.jpg",

  // Lokale Flux-Heroes — 3 Rezepte ohne sourceUrl, kein Reel-Cover verfuegbar
  "drei-zutaten-eisbowl": "/brands/biene/heroes/drei-zutaten-eisbowl.jpg",
  "xl-mexican-bowl": "/brands/biene/heroes/xl-mexican-bowl.jpg",
  "xxl-frueh-cookie": "/brands/biene/heroes/xxl-frueh-cookie.jpg",
};

// Helper that returns the hero URL for a recipe slug, or undefined if no
// image has been generated yet (custom recipes from the editor before the
// async enrichment kicks in).
export function getRecipeHero(slug: string): string | undefined {
  return recipeHeroes[slug];
}
