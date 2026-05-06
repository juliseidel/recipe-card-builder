import { NextResponse, after } from "next/server";
import { generateMicros } from "@/lib/ai/generate-micros";
import { getServerSupabase, hasServerSupabase } from "@/lib/supabase-server";
import type { Recipe } from "@/lib/recipes";

// Server route that fills in Gemini-derived micros for a single saved
// custom recipe. Triggered fire-and-forget by the editor after a save.
export const runtime = "nodejs";
export const maxDuration = 30;

type Body = {
  recipeId: string;
};

export async function POST(req: Request) {
  if (!hasServerSupabase()) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 500 }
    );
  }
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "Gemini API key not configured" },
      { status: 500 }
    );
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body?.recipeId) {
    return NextResponse.json(
      { error: "recipeId is required" },
      { status: 400 }
    );
  }

  const supabase = getServerSupabase();
  const { data: row, error } = await supabase
    .from("recipes")
    .select("id, data")
    .eq("id", body.recipeId)
    .maybeSingle();
  if (error || !row) {
    return NextResponse.json(
      { error: error?.message ?? "Recipe not found" },
      { status: 404 }
    );
  }

  const recipe = row.data as Recipe;

  // If micros already exist, no-op (idempotent — safe to re-trigger)
  if (recipe.nutrition?.micros && recipe.nutrition.micros.length > 0) {
    return NextResponse.json({
      status: "already-enriched",
      recipeId: row.id,
    });
  }

  // Hand off the slow Gemini call to background-after so the user's request
  // returns immediately. The DB row update happens after the response flushes.
  after(async () => {
    try {
      const micros = await generateMicros(recipe);
      const updated: Recipe = {
        ...recipe,
        nutrition: { ...recipe.nutrition, micros },
      };
      await getServerSupabase()
        .from("recipes")
        .update({ data: updated })
        .eq("id", row.id);
    } catch (err) {
      console.error("[enrich] Gemini failed for", body.recipeId, err);
    }
  });

  return NextResponse.json(
    { status: "enriching", recipeId: row.id },
    { status: 202 }
  );
}
