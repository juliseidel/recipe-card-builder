// Hero-Image-URL pro Recipe-Slug.
//
// Stand 2026-05-11: 34 Rezepte mit sourceUrl wurden mit der Vision-
// Description-Pipeline (Gemini Vision analysiert Reel-Cover-Bild und
// beschreibt das Gericht, Flux 2 Pro generiert mit Description + Brand-
// Style) neu gerendert. Die Heroes liegen im Supabase Storage Bucket
// `recipe-heroes`, gespeichert unter der DB-Row-UUID.
//
// 3 Rezepte ohne sourceUrl (drei-zutaten-eisbowl, xl-mexican-bowl,
// xxl-frueh-cookie) behalten die lokalen Flux-Heroes — da gibt es kein
// Reel-Cover, das Gemini Vision analysieren koennte.
//
// Re-Seed (alle oder gefiltert):
//   curl -X POST -H "Authorization: Bearer $ADMIN_RESEED_TOKEN" \
//        https://clever-satoshi-22bf41.vercel.app/api/admin/reseed-heroes \
//        -d '{"packSlug":"blitz-snacks"}'   # einzelner Pack
//        -d '{"slug":"protein-kaiserschmarren"}'   # einzelnes Rezept
//
// Re-Seed (1 Recipe via UI im Detail-View):
//   "KI-Alternative"-Button triggert /api/recipes/enrich mit
//   forceFlux:true — text-only Flux 2 Pro, schreibt direkt in die DB,
//   nicht hier.
//
// Hinweis: dieser Eintrag wird von lib/recipes.ts:enrich() nur dann
// verwendet, wenn das data.hero im DB-Row leer ist. Static-Bienes-
// Rezepte haben kein hero-Feld in lib/recipes.ts -> diese Map ist ihr
// Hero, ueberschreibt also die DB-Variante. Nach jedem Reseed-Lauf
// muss diese Map mit den neuen Supabase-URLs aktualisiert werden,
// sonst rendert die App weiterhin die alten Bilder.

export const recipeHeroes: Record<string, string> = {
  // Reel-Cover + Vision-Description Pipeline (34 Rezepte mit sourceUrl)
  "banana-bread-pudding":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/93046853-c3a8-47bc-9e43-f83bbc0fc1f6.jpg?v=v9.4",
  "beeren-cookie-crumble":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/1b31a572-9054-4114-8621-2e2eda793f27.jpg?v=v9.4",
  "blaubeer-cheesecake-no-bake":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/0f2c6959-d722-4fd2-974d-d8b55dfbf0d8.jpg?v=v9.4",
  "blech-pasta":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/d4b5c445-2451-4b36-8523-ab8b0fc03907.jpg?v=v9.4",
  "blitz-cheeseburger-auflauf":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/daf0c0a9-07d6-4735-bbb8-ba01df6a29a8.jpg?v=v9.4",
  "einfachstes-protein-brot":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/b05780ef-28a0-4d43-ad6a-77779867fa6b.jpg?v=v9.4",
  "erdbeer-biscuit-pudding-kuchen":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/b1d8a984-40da-4327-b9d7-9f3cbf606d49.jpg?v=v9.4",
  "erdbeer-kuppeltorte":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/1c0ac046-b7c1-4388-9e08-f660181ddb2d.jpg?v=v9.4",
  "erdbeer-loeffelkuchen":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/fdb926f7-9c99-4ca2-8a89-558183039e0b.jpg?v=v9.4",
  "feta-haehnchen-blech":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/aa53f0cb-4940-44e6-8e64-615acdd57391.jpg?v=v9.4",
  "frozen-coconut-strawberry-cups":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/5cc84e3e-be4d-4e42-a62b-a17f982b64c8.jpg?v=v9.4",
  "kaese-nudeln":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/ef1becb6-daff-46a3-a966-429fe9638079.jpg?v=v9.4",
  "kaese-zucchini-frittata":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/ac591b3b-20ee-4dbc-bc3b-471fe83c7287.jpg?v=v9.4",
  "kartoffelsalat-protein-mayo":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/a1108882-5eb1-4950-94be-0c924baed749.jpg?v=v9.4",
  "ki-suesskartoffel-muffins":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/4754bae4-97d2-4e63-ae5d-0534961997ec.jpg?v=v9.4",
  "langos-airfryer-flammkuchen":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/dfb60e62-79c7-49b3-9dcc-c9c4be317e2c.jpg?v=v9.4",
  "lebensveraendernder-salat":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/7b91d431-6f61-4f7c-9d1d-f68c15089cef.jpg?v=v9.4",
  "leichter-oster-zupfkuchen":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/876083b6-ed20-4647-899e-040a4c071b29.jpg?v=v9.4",
  "marzipankartoffeln":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/c57b3672-41f9-4288-bba0-a97b6b951228.jpg?v=v9.4",
  "mealprep-lasagne":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/66fd99a0-4f8e-43e7-8e9c-11642b0a365a.jpg?v=v9.4",
  "mealprep-pizza-bowl":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/36bf65a0-1d7d-49a7-af85-dc632091ac6c.jpg?v=v9.4",
  "mini-franzbroetchen":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/b7c4fb73-ae04-4630-834c-c1dde951235f.jpg?v=v9.4",
  "protein-bananenbrot":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/17657beb-f44a-4c08-8471-8ed36a26bdea.jpg?v=v9.4",
  "protein-griesspudding":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/9ffa2103-e535-4123-aea4-24adfeeca6c2.jpg?v=v9.4",
  "protein-kaiserschmarren":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/d2aefdc7-736a-4d55-b67b-13dc2b704342.jpg?v=v9.4",
  "schoko-biskuitrolle":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/c15a392d-2a37-452a-97e4-a0a37008992d.jpg?v=v9.4",
  "spekulatius-tiramisu":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/317b8a9c-d7e4-4bad-b6c2-d3fedf62deae.jpg?v=v9.4",
  "suesskartoffel-tarte":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/e8d05f14-82dd-4e31-8fce-01573fda8f6e.jpg?v=v9.4",
  "viral-cloud-wrap":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/fd9c2b2d-80ea-4744-b77c-8b2d6d4255ea.jpg?v=v9.4",
  "viral-xl-gemuese-wrap":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/f9e7eeea-5c3d-44d4-a78b-e8e1570e84a4.jpg?v=v9.4",
  "virale-pasta-pfanne":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/cd428ded-b05f-4e97-8ec7-3b525538a573.jpg?v=v9.4",
  "zimt-streuseltaler":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/ff51d8d6-c1e9-4ec6-a5d3-5ca693f56771.jpg?v=v9.4",
  "zitronen-loeffelkuchen":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/aa25f4ad-8718-4e22-9b44-ef1a5696b569.jpg?v=v9.4",
  "zuckerfreier-hefezopf":
    "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/recipe-heroes/956b97d5-c209-44d3-9b9c-d842bedb8b79.jpg?v=v9.4",

  // Lokale Flux-Heroes — 3 Rezepte ohne sourceUrl, kein Reel-Cover vorhanden
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
