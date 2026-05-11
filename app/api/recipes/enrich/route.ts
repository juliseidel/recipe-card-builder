import { NextResponse, after } from "next/server";
import { generateMicros } from "@/lib/ai/generate-micros";
import { generateStory } from "@/lib/ai/generate-story";
import { generateHeroForRecipe } from "@/lib/ai/generate-hero";
import { GeminiError } from "@/lib/ai/gemini";
import { getServerSupabase, hasServerSupabase } from "@/lib/supabase-server";
import { getBrand } from "@/lib/brands";
import { getPack } from "@/lib/packs";
import { getCustomPackServer } from "@/lib/custom-packs-server";
import type { Recipe } from "@/lib/recipes";

// Server route that fills in Gemini-derived micros AND a Flux 2 Pro hero
// image for a single saved custom recipe. Triggered fire-and-forget by the
// editor after a save. Both run in parallel in the background, single DB
// update at the end.
export const runtime = "nodejs";
// Hero generation: Apify (~10s) + Video-Download (~5s) + ffmpeg
// Frame-Extract (~5s) + Gemini Vision (~5s) + Flux Kontext Pro (~20-40s)
// + Storage-Upload = realistisch 50-90 s. Wir setzen 120 s als Ceiling
// fuer den seltenen worst-case (Apify cold-start + BFL load-spike).
export const maxDuration = 120;

type Body = {
  recipeId: string;
  /** Manueller Retry vom Client (Banner-Button). Setze `true`, um den
   *  Server-seitigen "schon mal versucht und gescheitert"-Marker
   *  (`nutrition.microsAttemptedAt`) zu uebergehen und einen neuen
   *  Mikros-Versuch zu starten. Auto-Trigger lassen das Feld leer und
   *  respektieren den Marker — verhindert dass jeder Page-Visit einer
   *  fehlgeschlagenen Karte automatisch einen neuen Gemini-Call ausloest. */
  force?: boolean;
  /** Wenn true: Hero wird neu generiert, auch wenn schon eines vorhanden
   *  ist. Wird vom "Bild neu generieren"-Button im Detail-View / Editor
   *  gesetzt. Micros + Story bleiben dabei unangetastet (es sei denn
   *  `force` ist zusaetzlich gesetzt). Pipeline-Strategie wie beim ersten
   *  Mal: Reel-Cover wenn sourceUrl, sonst Flux. */
  forceHero?: boolean;
  /** Wenn true: Hero wird zwingend ueber Flux 2 Pro generiert, auch wenn
   *  Reel-Cover verfuegbar waere. Wird vom "KI-Alternative generieren"-
   *  Button gesetzt — gedacht fuer den Fall, dass das Reel-Cover nicht
   *  passt (Talking-Head, Sticker-Overlay, schlechte Belichtung). */
  forceFlux?: boolean;
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
    .select("id, brand_slug, pack_slug, data")
    .eq("id", body.recipeId)
    .maybeSingle();
  if (error || !row) {
    return NextResponse.json(
      { error: error?.message ?? "Recipe not found" },
      { status: 404 }
    );
  }

  const recipe = row.data as Recipe;
  const brandSlug = (row.brand_slug as string) || "biene";
  const packSlug = (row.pack_slug as string) || recipe.packSlug;
  const brand = getBrand(brandSlug);
  const pack =
    getPack(brandSlug, packSlug) ??
    (await getCustomPackServer(brandSlug, packSlug));

  // Mikros-Marker: wenn ein vorheriger Versuch gescheitert ist
  // (microsAttemptedAt gesetzt, micros aber leer), respektieren wir das
  // beim Auto-Trigger und starten KEINEN neuen Versuch — sonst feuert
  // jeder Page-Visit der Detail-Seite einen weiteren Gemini-Call und
  // der User sieht jedes Mal die 30-s-Loading-Animation. Nur wenn der
  // Banner-Button "Erneut versuchen" geklickt wurde (force=true), wird
  // der Marker uebergangen und ein frischer Versuch gestartet.
  const microsEmpty =
    !recipe.nutrition?.micros || recipe.nutrition.micros.length === 0;
  const previousMicrosAttempt = Boolean(recipe.nutrition?.microsAttemptedAt);
  const needsMicros = microsEmpty && (!previousMicrosAttempt || body.force);
  const needsHero =
    !recipe.hero || Boolean(body.forceHero) || Boolean(body.forceFlux);
  // Story is "needed" if the description is empty or still equals the
  // pack-level fallback we wrote at save time. Once the user types their
  // own description (or a previous AI-Story has run), we leave it alone.
  const needsStory =
    Boolean(brand && pack) &&
    (!recipe.description ||
      recipe.description.trim() === "" ||
      recipe.description.trim() === pack?.description.trim());

  if (!needsMicros && !needsHero && !needsStory) {
    return NextResponse.json({
      status: "already-enriched",
      recipeId: row.id,
    });
  }

  // ─── MIKROS: SYNC vor der Response ──────────────────────────────────
  // Frueher lief das in after() parallel zu Hero + Story. Das hatte
  // zwei Probleme auf Vercel:
  //   1. Wenn der Editor-Trigger als fire-and-forget (kurz vor router.push)
  //      lief, hat der Browser den Fetch beim Navigieren manchmal abgebrochen
  //      — die Lambda startete in dem Fall gar nicht erst.
  //   2. Wenn die Hero-Pipeline (Flux 2 Pro) 60s+ brauchte und das Lambda-
  //      Limit erreicht war, wurden alle after()-Tasks abgewuergt — auch
  //      Mikros, die eigentlich nach 5s laengst durch gewesen waeren.
  // Fix: Mikros laufen synchron VOR der Response. Wenn der Endpoint 200
  // returnt, sind die Mikros garantiert in der DB. Das Detail-Polling
  // sieht sie beim ersten Refetch.
  if (needsMicros) {
    try {
      const micros = await generateMicros(recipe);
      await mergeRecipeData(row.id, (current) => ({
        nutrition: {
          ...current.nutrition,
          micros,
          // Erfolg → Failure-Marker loeschen, damit folgende Re-Renders
          // diesen Lauf als "endgueltig durch" sehen.
          microsAttemptedAt: undefined,
        },
      }));
    } catch (err) {
      // Strukturiertes Logging fuer Vercel-Logs. Wir schreiben pro
      // Failure einen einzeiligen JSON-aehnlichen Block — so sehen wir
      // beim Scrollen durch die Logs auf einen Blick:
      //   - welches Rezept und wie kurz es war (3-Zutaten-Eisbowl
      //     scheitert anders als 16-Zutaten-Mexican-Bowl)
      //   - ob Gemini einen HTTP-Status zurueckgegeben hat (429/5xx
      //     deutet auf Overload, andere auf Schema-/JSON-Probleme)
      //   - ein Snippet der echten Antwort, wenn vorhanden — meist
      //     reicht das um zu erkennen, ob Gemini wirklich nichts
      //     liefern konnte oder ob die JSON-Validation failed ist.
      const isGeminiErr = err instanceof GeminiError;
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("[enrich] micros failed sync", {
        recipeId: body.recipeId,
        recipeTitle: recipe.title,
        ingredientCount: recipe.ingredients.length,
        nutritionBasis: recipe.nutritionBasis,
        errorName: err instanceof Error ? err.name : "unknown",
        errorMessage,
        geminiStatus: isGeminiErr ? err.status : undefined,
        geminiDetailSnippet: isGeminiErr
          ? String(err.detail).slice(0, 500)
          : undefined,
      });
      // Failure-Marker setzen, damit:
      //   1. spaetere Auto-Trigger (Page-Visit) wissen "schon versucht,
      //      nicht nochmal" und uebersprungen werden.
      //   2. der Client das Feld liest und sofort den Retry-Banner zeigt,
      //      ohne erst 30 s auf den naechsten Polling-Timeout zu warten.
      // Hero + Story laufen trotzdem weiter — Mikros sind nicht kritisch
      // fuer die restliche Karte.
      try {
        await mergeRecipeData(row.id, (current) => ({
          nutrition: {
            ...current.nutrition,
            microsAttemptedAt: Date.now(),
          },
        }));
      } catch (markerErr) {
        console.error(
          "[enrich] could not persist micros failure marker",
          markerErr
        );
      }
    }
  }

  // ─── HERO + STORY: ASYNC nach der Response ──────────────────────────
  // Hero-Strategie (Ingo Phase 3): Wenn das Rezept aus Instagram kommt
  // (sourceUrl gesetzt) und der User NICHT explizit forceHero=true klickt,
  // nehmen wir den Reel-Cover-Frame statt Flux 2 Pro zu rendern. Das matcht
  // das echte Reel viel besser als ein generiertes Brand-DNA-Bild.
  //
  //   • Default-Path (kein Hero da, sourceUrl vorhanden) → Reel-Cover
  //   • Re-Roll-Button (forceHero=true) → Flux 2 Pro (alternative Strategie)
  //   • Kein sourceUrl → Flux 2 Pro (Fallback)
  //   • Beide failen → null, kein Hero
  //
  // Flux bleibt der lange Pol (15-90 s); Reel-Cover ist schnell (~2 s).
  // Beide laufen in after() nach der Response. Das Detail-Polling holt
  // den Hero ab, sobald er in der DB steht.
  if (needsHero) {
    after(async () => {
      try {
        const result = await generateHeroForRecipe({
          recipe,
          recipeId: row.id,
          brandSlug,
          forceFlux: Boolean(body.forceFlux),
        });
        if (result?.heroUrl) {
          await mergeRecipeData(row.id, () => ({ hero: result.heroUrl }));
        }
      } catch (err) {
        console.error("[enrich] hero failed for", body.recipeId, err);
      }
    });
  }

  if (needsStory && brand && pack) {
    after(async () => {
      try {
        const story = await generateStory(recipe, pack, brand);
        if (story && story.length > 20) {
          // Only overwrite if the user hasn't typed their own copy in the
          // meantime. mergeRecipeData re-reads the row inside the merge.
          await mergeRecipeData(row.id, (current) => {
            const userTouched =
              current.description &&
              current.description.trim() !== "" &&
              current.description.trim() !== pack.description.trim();
            if (userTouched) return {};
            return { description: story };
          });
        }
      } catch (err) {
        console.error("[enrich] story failed for", body.recipeId, err);
      }
    });
  }

  return NextResponse.json(
    {
      status: "enriching",
      recipeId: row.id,
      micros: needsMicros,
      hero: needsHero,
      story: needsStory,
    },
    { status: 202 }
  );
}

// Read-modify-write merge into recipes.data. Used when independent
// background tasks (micros + hero) write into the same row but at
// different times — without this, the slower task would clobber whatever
// the faster task already persisted. The `partial` callback gets the
// current row data so it can compose nested fields (e.g. nutrition.micros
// without losing nutrition.kcal).
async function mergeRecipeData(
  id: string,
  partial: (current: Recipe) => Partial<Recipe>
): Promise<void> {
  const supabase = getServerSupabase();
  const { data: latest, error: readErr } = await supabase
    .from("recipes")
    .select("data")
    .eq("id", id)
    .maybeSingle();
  if (readErr || !latest) {
    console.error("[enrich] mergeRecipeData read failed", id, readErr);
    return;
  }
  const current = latest.data as Recipe;
  const merged = { ...current, ...partial(current) };
  const { error: writeErr } = await supabase
    .from("recipes")
    .update({ data: merged })
    .eq("id", id);
  if (writeErr) {
    console.error("[enrich] mergeRecipeData write failed", id, writeErr);
  }
}
