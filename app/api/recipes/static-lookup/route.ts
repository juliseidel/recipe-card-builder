import { NextResponse } from "next/server";
import { getRecipe } from "@/lib/recipes";

// Edit-Route uses this to fetch a curated static recipe so the user can
// fork-edit it. Server-only `getRecipe()` consults the in-code recipes[]
// array first; we strip the DB-lookup-side-effects to keep this fast.
//
// 404 when neither code nor DB knows the slug; callers fall back to
// "Karte nicht gefunden".

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const packSlug = url.searchParams.get("pack");
  const recipeSlug = url.searchParams.get("recipe");
  if (!packSlug || !recipeSlug) {
    return NextResponse.json(
      { error: "pack + recipe params required" },
      { status: 400 }
    );
  }
  const recipe = await getRecipe(packSlug, recipeSlug);
  if (!recipe) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }
  return NextResponse.json({ recipe });
}
