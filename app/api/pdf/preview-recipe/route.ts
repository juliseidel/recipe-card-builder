import { NextResponse } from "next/server";
import { loadBrand } from "@/lib/custom-brands-server";
import { getPack } from "@/lib/packs";
import { getCustomPackServer } from "@/lib/custom-packs-server";
import { renderRecipePdf } from "@/lib/pdf/render";
import type { Recipe } from "@/lib/recipes";

// Live-Preview-PDF fuer den Recipe-Editor.
//
// Anders als /api/pdf/jobs (asynchron, schreibt in `pdf_jobs`-Table, polled
// vom Client) rendert dieser Endpoint SYNCHRON und gibt das fertige PDF
// als binary response zurueck. Der Editor packt das in einen Blob-URL und
// haengt es an ein <iframe>, damit der User sofort eins-zu-eins sieht,
// was beim PDF-Download rauskommt.
//
// Render-time fuer eine einzelne Karte: 3-10s. Das ist OK fuer einen
// "Vorschau aktualisieren"-Button, aber zu langsam fuer keystroke-live.
// Daher button-triggered, nicht onChange-getriggert.
//
// Body: { brandSlug, packSlug, recipe } — recipe ist das vollstaendige
// Recipe-Objekt aus dem Editor-State (NICHT aus der DB). So sieht der
// User auch noch-nicht-gespeicherte Aenderungen.

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  brandSlug: string;
  packSlug: string;
  recipe: Recipe;
  totalRecipes?: number;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.brandSlug || !body.packSlug || !body.recipe) {
    return NextResponse.json(
      { error: "brandSlug, packSlug, recipe required" },
      { status: 400 }
    );
  }

  const brand = await loadBrand(body.brandSlug);
  const pack =
    getPack(body.brandSlug, body.packSlug) ??
    (await getCustomPackServer(body.brandSlug, body.packSlug));

  if (!brand || !pack) {
    return NextResponse.json(
      { error: "brand or pack not found" },
      { status: 404 }
    );
  }

  try {
    const buf = await renderRecipePdf({
      brand,
      pack,
      recipe: body.recipe,
      totalRecipes: body.totalRecipes ?? pack.recipeCount,
    });
    // Direkt als binary response. Uint8Array statt ArrayBuffer, weil die
    // TS-Definition von BodyInit ArrayBuffer (vs. SharedArrayBuffer) nicht
    // sauber abgrenzt und der Compiler den Plain-Buffer ablehnt.
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "no-store",
        "Content-Disposition": 'inline; filename="recipe-preview.pdf"',
      },
    });
  } catch (err) {
    console.error("[pdf-preview] render failed", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "PDF-Render fehlgeschlagen.",
      },
      { status: 500 }
    );
  }
}
