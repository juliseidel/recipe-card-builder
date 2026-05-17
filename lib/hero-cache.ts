import { getServerSupabase, hasServerSupabase } from "@/lib/supabase-server";
import { normalizeInstagramUrl } from "@/lib/integrations/apify";
import type { Recipe } from "@/lib/recipes";

// Hero-Cache pro Source-URL.
//
// Problem: Apifys Reel-URL ist der stabile Identifier eines Original-Reels.
// Wenn dasselbe Reel in mehreren Packs eines Brands auftaucht, wird heute
// pro Pack EIN neues Hero-Bild generiert — duplicate Apify + ffmpeg + Vision +
// Flux-Calls, ~$0.05 + 30-90s Wartezeit pro Duplikat. Vermeidbar.
//
// Loesung: Vor jedem Flux-Call schauen wir, ob ein anderes Recipe im
// selben Brand mit derselben sourceUrl bereits ein "echtes" Brand-Hero hat
// (nicht Placeholder, nicht User-Upload). Wenn ja: dieses heroUrl auf das
// neue Recipe uebernehmen, kein Flux-Call.
//
// Cache-Match-Regeln:
//   - sourceUrl gleich (nach normalizeInstagramUrl, damit /p/X und /reel/X
//     denselben Cache-Key haben)
//   - brand_slug gleich (kein Cross-Brand-Sharing, weil Brand-DNA-Style
//     unterschiedlich ist)
//   - data.hero ist eine Brand-Hero-URL (siehe isBrandHero unten)
//
// Re-Roll-Verhalten: bei forceFlux/forceHero ueberspringt der Caller den
// Cache komplett — Flux laeuft regulaer. Das neue Bild ueberschreibt
// recipe.hero und wird beim naechsten Cache-Lookup zur neuen Cache-Source.
// Damit propagiert ein Re-Roll automatisch auf alle NEUEN Recipes mit
// gleicher sourceUrl, ohne aber bereits-existierende Recipes anzufassen
// (User-Uploads in anderen Packs bleiben sicher unangetastet).

// Erkennt ob ein heroUrl-Wert ein "echtes" Brand-generiertes Bild ist, das
// zum Cachen taugt. Filtert ALLES raus, was ein Placeholder oder ein
// User-Upload sein koennte — denn diese wollen wir NICHT als Cache-Quelle.
//
// True wenn der Pfad auf den recipe-heroes Storage-Bucket zeigt (das ist
// der Bucket, in den die Flux-Pipeline schreibt). User-Uploads landen in
// /uploads/ — die werden hier ausgeschlossen.
function isBrandHero(url: string | undefined | null): boolean {
  if (!url) return false;
  // Placeholder: Reel-Cover (Instagram/TikTok CDN oder unser reel-covers Bucket)
  if (/cdninstagram\.com|fbcdn\.net|tiktokcdn|tiktok-domain/i.test(url)) return false;
  if (/\/reel-covers\//i.test(url)) return false;
  // User-Uploads (alle Buckets die NICHT recipe-heroes sind)
  if (/\/uploads\//i.test(url)) return false;
  if (/\/pack-covers\//i.test(url)) return false;
  if (/\/pack-suggestion-covers\//i.test(url)) return false;
  // Lokale Static-Assets (Code-Brand-Heroes)
  if (url.startsWith("/")) return false;
  // Echter Brand-Hero im recipe-heroes Bucket → Cache-fähig
  return /\/recipe-heroes\//i.test(url);
}

// Normalisiert sourceUrl auf eine kanonische Form fuer den Cache-Match.
// Nutzt normalizeInstagramUrl wenn die URL ein Instagram-Permalink ist,
// sonst returnt sie unveraendert. Damit matchen /p/XYZ und /reel/XYZ und
// /p/XYZ?igsh=... alle den gleichen Cache-Key.
function normalizeForCache(url: string): string {
  const normalized = normalizeInstagramUrl(url);
  return normalized ?? url.trim();
}

export type CachedHeroResult = {
  /** URL des cached Bilds — direkt in recipe.hero schreibbar. */
  heroUrl: string;
  /** ID des Recipes von dem wir's geklaut haben — fuer Debug-Logging. */
  sourceRecipeId: string;
};

// Sucht in der DB nach einem cache-fähigen Brand-Hero fuer eine gegebene
// sourceUrl. Returns null wenn keiner gefunden.
//
// Performance: ein einzelner SELECT auf recipes mit brand_slug-Index.
// Wir filtern Cache-Faehigkeit (isBrandHero) client-seitig in JS, weil
// JSONB-Path-Filter in PostgREST umstaendlich ist und die Brand-Filter
// schon ~95% der Rows ausschliesst.
export async function findCachedHeroForSource(
  brandSlug: string,
  sourceUrl: string
): Promise<CachedHeroResult | null> {
  if (!hasServerSupabase()) return null;
  if (!sourceUrl || !sourceUrl.trim()) return null;

  const targetUrl = normalizeForCache(sourceUrl);
  if (!targetUrl) return null;

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("recipes")
    .select("id, data, created_at")
    .eq("brand_slug", brandSlug);

  if (error) {
    console.warn("[hero-cache] DB-Lookup fehlgeschlagen", error.message);
    return null;
  }

  // Filter im Speicher: matching sourceUrl + brand-hero-tauglich.
  // Sortiere nach created_at desc, nehme den neuesten → bei Re-Rolls
  // wird automatisch die juengste Variante als Cache-Quelle genutzt.
  const candidates = (data ?? [])
    .map((row) => {
      const recipe = row.data as Recipe;
      return {
        id: row.id as string,
        created_at: row.created_at as string,
        sourceUrl: recipe.sourceUrl,
        hero: recipe.hero,
      };
    })
    .filter((r) => r.sourceUrl && normalizeForCache(r.sourceUrl) === targetUrl)
    .filter((r) => isBrandHero(r.hero))
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

  const hit = candidates[0];
  if (!hit || !hit.hero) return null;

  return {
    heroUrl: hit.hero,
    sourceRecipeId: hit.id,
  };
}
