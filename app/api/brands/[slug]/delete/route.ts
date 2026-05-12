import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getServerSupabase, hasServerSupabase } from "@/lib/supabase-server";
import { isCodeBrand } from "@/lib/brands";

// Workspace-Delete-Endpoint. Loescht einen DB-Brand komplett — inklusive
// aller verknuepften Daten: Recipes, Packs, Hidden-Recipes, Reel-Library,
// Scrape-Jobs, Pack-Vorschlaege. Code-Brands (Biene) sind hardcoded in
// lib/brands.ts und koennen nicht geloescht werden.
//
// Reihenfolge (wichtig wegen FK-Constraints und Auslesbarkeit):
//   1. pack_suggestions   — KI-Vorschlaege, koennen alleinstehend weg
//   2. creator_reels      — Reel-Library, blocked von nichts
//   3. creator_scrapes    — Scrape-Jobs, blocked von nichts
//   4. hidden_recipes     — Hide-Marker pro Brand
//   5. recipes            — Custom-Rezepte (Heroes im Storage bleiben
//      erstmal — die werden via TTL eh nach 1 Jahr aus dem Cache fallen)
//   6. packs              — Custom-Packs
//   7. brands             — die Brand-Row selbst
//
// RLS: alle drei Reel-Library-Tabellen haben open public-policy (internes
// Team-Tool). brands/packs/recipes ebenfalls offen.

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

  // Schutz: Code-Brands (Biene) sind in lib/brands.ts hardcoded — die
  // gibt es nicht in der DB und der Delete waere ein Bug.
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

  // Helper: Tabelle aufräumen, count zurückgeben. Bei Tabellen die noch
  // nicht migriert sind (z.B. creator_reels ohne SQL-Run), wollen wir das
  // ganze Delete nicht crashen lassen — wir markieren skipped.
  const cleanup = async (
    table: string,
    column: string = "brand_slug"
  ): Promise<number | "skipped" | "failed"> => {
    const { error, count } = await supabase
      .from(table)
      .delete({ count: "exact" })
      .eq(column, slug);
    if (error) {
      // "relation does not exist" → Tabelle nicht migriert, kein Fehler.
      if (error.code === "42P01") return "skipped";
      console.warn(`[delete-brand] cleanup ${table} failed:`, error.message);
      return "failed";
    }
    return count ?? 0;
  };

  deleted.pack_suggestions = await cleanup("pack_suggestions");
  deleted.creator_reels = await cleanup("creator_reels");
  deleted.creator_scrapes = await cleanup("creator_scrapes");
  deleted.hidden_recipes = await cleanup("hidden_recipes");
  deleted.recipes = await cleanup("recipes");
  deleted.packs = await cleanup("packs");

  // Brand-Row selbst — das ist der eigentliche Delete. Wenn das fehlschlaegt,
  // ist der Workspace nicht weg, also geben wir einen klaren Fehler zurueck.
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

  // Cache-Invalidation: Hub + Workspace-Routen.
  try {
    revalidatePath("/");
    revalidatePath(`/${slug}`);
  } catch {
    // revalidatePath kann in einigen Contexts werfen — non-fatal.
  }

  return NextResponse.json({
    ok: true,
    slug,
    deleted,
  });
}
