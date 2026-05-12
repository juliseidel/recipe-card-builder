import { NextResponse } from "next/server";
import {
  scrapeInstagramPost,
  normalizeInstagramUrl,
} from "@/lib/integrations/apify";
import { parseRecipeFromCaption } from "@/lib/ai/parse-instagram";
import { generateHeroForRecipe } from "@/lib/ai/generate-hero";
import type { Recipe } from "@/lib/recipes";
import { hasServerSupabase } from "@/lib/supabase-server";

// Test-Endpoint für die ECHTE V9.5-Hero-Pipeline.
//
// Body: { sourceUrl, brandSlug? }
//
// Flow:
//   1. Apify scrape Reel
//   2. parse-instagram.ts parst Caption zu Recipe-Daten (mit fallback wenn parse fail)
//   3. generateHeroForRecipe() aus lib/ai/generate-hero.ts (=V9.5-Pipeline)
//   4. URL zurück
//
// Sinn: Testen ob V9.5 bei Reels mit Text in jedem Frame korrekt zum
// text-only Fallback wechselt und ein text-freies Bild produziert.

export const runtime = "nodejs";
export const maxDuration = 300;

function slugify(s: string): string {
  return (s || "test")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[äÄ]/g, "ae")
    .replace(/[öÖ]/g, "oe")
    .replace(/[üÜ]/g, "ue")
    .replace(/[ß]/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "test";
}

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = process.env.ADMIN_RESEED_TOKEN;
  if (!token || auth !== `Bearer ${token}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.BFL_API_KEY) {
    return NextResponse.json({ error: "BFL_API_KEY missing" }, { status: 500 });
  }
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY missing" },
      { status: 500 }
    );
  }
  if (!process.env.APIFY_TOKEN) {
    return NextResponse.json(
      { error: "APIFY_TOKEN missing" },
      { status: 500 }
    );
  }
  if (!hasServerSupabase()) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 500 }
    );
  }

  let body: { sourceUrl?: string; brandSlug?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.sourceUrl) {
    return NextResponse.json(
      { error: "sourceUrl missing in body" },
      { status: 400 }
    );
  }
  const brandSlug = body.brandSlug || "biene";

  const t0 = Date.now();
  const normalized = normalizeInstagramUrl(body.sourceUrl);
  if (!normalized) {
    return NextResponse.json(
      { error: "sourceUrl not normalizable" },
      { status: 422 }
    );
  }

  // 1. Apify scrape
  const post = await scrapeInstagramPost(normalized);

  // 2. Caption parsen → Recipe-Daten
  const parsed = await parseRecipeFromCaption(post.caption, {
    username: post.ownerUsername,
  });

  // Recipe-Object für die Hero-Pipeline. Wenn Caption-Parse failed,
  // bauen wir ein Minimal-Recipe mit caption-snippet als title.
  let recipe: Recipe;
  if (parsed.ok) {
    recipe = {
      slug: slugify(parsed.recipe.title),
      packSlug: "test-pack",
      number: 1,
      title: parsed.recipe.title,
      subtitle: parsed.recipe.subtitle || "",
      description: parsed.recipe.description || "",
      prepTime: parsed.recipe.prepTime,
      cookTime:
        parsed.recipe.cookTime && parsed.recipe.cookTime > 0
          ? parsed.recipe.cookTime
          : undefined,
      difficulty: parsed.recipe.difficulty,
      servings: parsed.recipe.servings,
      tags: parsed.recipe.tags,
      ingredients: parsed.recipe.ingredients,
      steps: parsed.recipe.steps,
      nutrition: parsed.recipe.nutrition,
      nutritionBasis: parsed.recipe.nutritionBasis,
      sourceUrl: normalized,
      sourceLabel: `Instagram · @${post.ownerUsername}`,
    };
  } else {
    const firstLine = post.caption.split("\n")[0]?.slice(0, 80) || "Test Recipe";
    recipe = {
      slug: slugify(firstLine),
      packSlug: "test-pack",
      number: 1,
      title: firstLine,
      subtitle: "",
      description: "",
      prepTime: 10,
      difficulty: "Einfach",
      servings: 2,
      tags: [],
      ingredients: [],
      steps: [],
      nutrition: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
      nutritionBasis: "portion",
      sourceUrl: normalized,
      sourceLabel: `Instagram · @${post.ownerUsername}`,
    };
  }

  // 3. Echte V9.5-Pipeline aufrufen
  const result = await generateHeroForRecipe({
    recipe,
    recipeId: `test-${Date.now()}`,
    brandSlug,
  });

  const tTotal = Date.now() - t0;

  if (!result) {
    return NextResponse.json(
      {
        ok: false,
        error: "generateHeroForRecipe returned null — all paths failed",
        recipe: { title: recipe.title, slug: recipe.slug },
        post: {
          videoUrl: post.videoUrl ? "yes" : "no",
          displayUrl: post.displayUrl ? "yes" : "no",
          caption: post.caption.slice(0, 200),
        },
        timings: { totalMs: tTotal },
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    version: "v9.5-real-pipeline",
    generatedUrl: result.heroUrl,
    pipelinePath: result.source, // "keyframe" | "cover" | "flux-text-only"
    keyframeReasoning: result.keyframeReasoning,
    keyframeTimestamp: result.keyframeTimestamp,
    recipe: {
      title: recipe.title,
      slug: recipe.slug,
      sourceUrl: recipe.sourceUrl,
    },
    timings: { totalMs: tTotal },
    captionSnippet: post.caption.slice(0, 300),
  });
}
