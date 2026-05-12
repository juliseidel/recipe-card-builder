import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getServerSupabase, hasServerSupabase } from "@/lib/supabase-server";
import { isCodeBrand } from "@/lib/brands";

// Workspace-Delete-Endpoint mit Daten-Erhaltung.
//
// User-Wunsch (Mai 2026): Beim Loeschen eines Workspaces sollen die
// wertvollen Daten (Reel-Library, Rezepte, Packs) NICHT verloren gehen
// — falls der Creator spaeter neu angelegt wird (gleicher Handle/Slug),
// sind die alten Daten automatisch wieder verfuegbar (via brand_slug-FK).
//
// Was geloescht wird:
//   - brands              — das Brand-Profil selbst
//   - creator_scrapes     — Job-Tracker (rein technisch, kein Mehrwert)
//   - pack_suggestions    — KI-Vorschlaege (werden bei Re-Onboard frisch
//                           generiert; alte waren auf alte Reel-Library
//                           kalibriert)
//   - hidden_recipes      — UI-Hide-Marker pro Brand (nicht relevant ohne
//                           Brand)
//
// Was BLEIBT (Daten-Erhaltung):
//   - creator_reels       — die 200-500 gescrapten Reels mit Klassifikation
//   - recipes             — fertige strukturierte Rezepte (Zutaten,
//                           Schritte, Naehrwerte, Mikros, Hero-Bild-URLs)
//   - packs               — kuratierte Recipe-Packs (z.B. "Top 10 Reels")
//
// Re-Activation-Flow: User legt im /new-brand-Wizard einen Brand mit dem
// gleichen Handle/Slug neu an → addCustomBrand() schreibt eine neue
// brands-Row → die bestehenden creator_reels/recipes/packs Rows mit
// brand_slug-Match sind automatisch wieder sichtbar im Workspace.
//
// Code-Brands (Biene) sind hardcoded in lib/brands.ts und nicht loeschbar.

export const runtime = "nodejs";
export const maxDuration = 30;

type RouteParams = { params: Promise<{ slug: string }> };

export async function DELETE(_req: Request, { params }: RouteParams) {
  const { slug } = await params;

  if (!slug) {
    return NextResponse.json(
      { error: "Brand-Slug fehlt." },
      { status: 400 }
    );
  }

  if (isCodeBrand(slug)) {
    return NextResponse.json(
      {
        error:
          "Dieser Workspace ist ein fest eingebauter Brand und kann nicht gelöscht werden.",
      },
      { status: 403 }
    );
  }

  if (!hasServerSupabase()) {
    return NextResponse.json(
      { error: "Supabase ist nicht konfiguriert." },
      { status: 500 }
    );
  }

  const supabase = getServerSupabase();
  const deleted: Record<string, number | "skipped" | "failed"> = {};

  const cleanup = async (
    table: string,
    column: string = "brand_slug"
  ): Promise<number | "skipped" | "failed"> => {
    const { error, count } = await supabase
      .from(table)
      .delete({ count: "exact" })
      .eq(column, slug);
    if (error) {
      if (error.code === "42P01") return "skipped";
      console.warn(`[delete-brand] cleanup ${table} failed:`, error.message);
      return "failed";
    }
    return count ?? 0;
  };

  // Nur tracking-Tabellen + Brand-Profil loeschen. Die wertvollen Daten
  // (creator_reels, recipes, packs) bleiben — sie haengen via brand_slug
  // und sind sofort wieder verfuegbar wenn ein Brand mit demselben Slug
  // neu angelegt wird.
  deleted.pack_suggestions = await cleanup("pack_suggestions");
  deleted.creator_scrapes = await cleanup("creator_scrapes");
  deleted.hidden_recipes = await cleanup("hidden_recipes");

  // Audit-Counts der ERHALTENEN Daten — zurück an UI, damit der User sieht
  // wie viel weiterhin im "Cold-Storage" für Re-Activation liegt.
  const [{ count: reelsKept }, { count: recipesKept }, { count: packsKept }] =
    await Promise.all([
      supabase
        .from("creator_reels")
        .select("*", { count: "exact", head: true })
        .eq("brand_slug", slug),
      supabase
        .from("recipes")
        .select("*", { count: "exact", head: true })
        .eq("brand_slug", slug),
      supabase
        .from("packs")
        .select("*", { count: "exact", head: true })
        .eq("brand_slug", slug),
    ]);

  // Brand-Row als letztes loeschen.
  const { error: brandError } = await supabase
    .from("brands")
    .delete()
    .eq("slug", slug);
  if (brandError) {
    return NextResponse.json(
      {
        error: `Konnte den Brand-Eintrag nicht löschen: ${brandError.message}`,
        partial: deleted,
      },
      { status: 500 }
    );
  }

  try {
    revalidatePath("/");
    revalidatePath(`/${slug}`);
  } catch {
    // non-fatal
  }

  return NextResponse.json({
    ok: true,
    slug,
    deleted,
    kept: {
      creator_reels: reelsKept ?? 0,
      recipes: recipesKept ?? 0,
      packs: packsKept ?? 0,
    },
  });
}
