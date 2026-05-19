import {
  getUnclassifiedReels,
  updateReelClassification,
  getRecipeReelsForBrand,
  countRecipeReelsForBrand,
  getFitnessReelsForBrand,
  countFitnessReelsForBrand,
  countReelsForBrand,
  insertSuggestions,
  clearPendingSuggestions,
  getSuggestionsForBrand,
  updateScrapeStatus,
  type NewSuggestion,
  type ReelRow,
} from "@/lib/creator-reels-server";
import { loadBrand } from "@/lib/custom-brands-server";
import { classifyReels, CLASSIFICATION_FAILED } from "@/lib/ai/classify-reels";
import { suggestPacks } from "@/lib/ai/suggest-packs";
import { suggestFitnessPacks } from "@/lib/ai/suggest-fitness-packs";
import { generateSuggestionCovers } from "./generate-suggestion-covers";

// Orchestrierung der Phase-2 + Phase-3 Pipeline. Wird vom Apify-Webhook
// im after()-Hook ausgefuehrt, nachdem das Dataset persistiert wurde.
//
// Schritte:
//   1. Alle unklassifizierten Reels des Brands in Batches durch Gemini
//      Flash klassifizieren, einzeln in die DB persistieren
//   2. Alle Rezept-Reels einsammeln, Gemini Pro generiert 10-20 Pack-
//      Vorschlaege, alle als 'pending' in pack_suggestions schreiben
//   3. scrape.status = 'done' + counts aktualisieren
//
// Bei einem Step-Fail: scrape.status = 'failed' + Error-Message. UI zeigt
// dann den Hinweis "Reel-Library teilweise geladen, Vorschlaege fehlen —
// nochmal versuchen".
//
// Idempotent: lauft eine zweite Mal mit denselben Inputs durch, ohne
// Doppel-Klassifikation (filter auf classified_at = null) und ohne
// Doppel-Suggestions (clearPendingSuggestions vor Insert).

export async function runClassificationAndSuggestions(opts: {
  scrapeId: string;
  brandSlug: string;
}): Promise<void> {
  const { scrapeId, brandSlug } = opts;

  // ─── Schritt 1: Klassifikation ──────────────────────────────────────
  // Loop bis nichts mehr unklassifiziert ist. Jeder getUnclassifiedReels-
  // Call holt max 50 Stueck, eine 500er Library braucht also ~10 Loops.
  // Pro Loop ~10s (5 Batches a 10 Reels * 2s), total ~100s.
  let classifiedTotal = 0;
  let consecutiveFailures = 0;
  let loopIteration = 0;
  while (true) {
    loopIteration += 1;
    const batch = await getUnclassifiedReels(brandSlug, 50);
    console.log(
      `[classify-and-suggest] brand=${brandSlug} iteration=${loopIteration} fetched_unclassified=${batch.length}`
    );
    if (batch.length === 0) break;
    const results = await classifyReels(batch);
    console.log(
      `[classify-and-suggest] brand=${brandSlug} iteration=${loopIteration} classifyReels_returned=${results.size}`
    );
    // Per-Reel-Persist parallel. CLASSIFICATION_FAILED → SKIP, classified_at
    // bleibt NULL, naechster Resume probiert es nochmal. Verhindert
    // Datenzerstoerung bei Gemini-Failure (Bug-2026-05-13).
    let batchFailures = 0;
    await Promise.all(
      batch.map((reel) => {
        const c = results.get(reel.id);
        if (!c || c === CLASSIFICATION_FAILED) {
          batchFailures += 1;
          return Promise.resolve();
        }
        return updateReelClassification(reel.id, c);
      })
    );
    const batchSuccesses = batch.length - batchFailures;
    classifiedTotal += batchSuccesses;
    console.log(
      `[classify-and-suggest] brand=${brandSlug} classified=${classifiedTotal} (this batch: ${batchSuccesses}/${batch.length} ok, ${batchFailures} failed)`
    );
    // Schutz vor Endlos-Loop: wenn nichts erfolgreich war, ist Gemini
    // wahrscheinlich permanent gefailt (Schema-Bug, Quota, ...). Wir
    // brechen ab statt die selben 50 Reels endlos zu retryen.
    if (batchSuccesses === 0) {
      consecutiveFailures += 1;
      if (consecutiveFailures >= 2) {
        console.error(
          `[classify-and-suggest] brand=${brandSlug} aborting after 2 batches with 0 successes — Gemini likely broken`
        );
        break;
      }
    } else {
      consecutiveFailures = 0;
    }
  }

  const totalReels = await countReelsForBrand(brandSlug);
  const recipeCount = await countRecipeReelsForBrand(brandSlug);
  const fitnessCount = await countFitnessReelsForBrand(brandSlug);
  console.log(
    `[classify-and-suggest] brand=${brandSlug} totalReels=${totalReels} recipeCount=${recipeCount} fitnessCount=${fitnessCount}`
  );

  // ─── Schritt 2: Pack-Vorschlaege ────────────────────────────────────
  // Entscheidung welcher Suggester laueft:
  //   1. brand.defaultPackType ist primary signal (vom Onboarding-Picker
  //      oder Auto-Detection gesetzt)
  //   2. Falls nicht gesetzt: nimm den Suggester wo wir MEHR klassifizierte
  //      Reels haben (Mehrheit gewinnt)
  //   3. Falls beides <5: skip
  // Hybrid-Creators (Christian Wolf, Aylin) bekommen primaer den Default-
  // Suggester, koennen aber das andere Pack-Format manuell ueber den
  // Pack-Type-Toggle anlegen.
  const brand = await loadBrand(brandSlug);
  const explicitPackType = brand?.defaultPackType;
  const effectivePackType: "recipe" | "fitness" =
    explicitPackType ??
    (fitnessCount > recipeCount ? "fitness" : "recipe");

  let suggestionCount = 0;
  if (effectivePackType === "fitness" && fitnessCount >= 5) {
    // Fitness-Pipeline
    const fitnessReels = await getFitnessReelsForBrand(brandSlug);
    try {
      const suggestions = await suggestFitnessPacks({
        brandName: brand?.name ?? brandSlug,
        fitnessReels,
        brand,
      });
      if (suggestions.length > 0) {
        await clearPendingSuggestions(brandSlug);
        const rows: NewSuggestion[] = suggestions.map((s) => ({
          brandSlug,
          title: s.title,
          subtitle: s.subtitle,
          tagline: s.tagline,
          description: s.description,
          category: s.category,
          reelIds: s.reelIds,
          reasoning: s.reasoning,
          score: s.score,
        }));
        suggestionCount = await insertSuggestions(rows);
        console.log(
          `[classify-and-suggest] brand=${brandSlug} fitness-suggestions=${suggestionCount}`
        );
      }
    } catch (err) {
      console.error(
        "[classify-and-suggest] suggestFitnessPacks failed (non-fatal):",
        err instanceof Error ? err.message : err
      );
    }
  } else if (recipeCount >= 5) {
    // Recipe-Pipeline (Default fuer alle Bestands-Brands ohne Pack-Type
    // oder explicit recipe-Brands)
    const recipeReels = await getRecipeReelsForBrand(brandSlug);
    try {
      const suggestions = await suggestPacks({
        brandName: brand?.name ?? brandSlug,
        recipeReels,
        brand,
      });
      if (suggestions.length > 0) {
        // Vor neuer Generierung: vorhandene pending-Vorschlaege loeschen,
        // damit das Team keine Doppel-Anzeige sieht. Accepted/dismissed
        // bleiben als History stehen.
        await clearPendingSuggestions(brandSlug);
        const rows: NewSuggestion[] = suggestions.map((s) => ({
          brandSlug,
          title: s.title,
          subtitle: s.subtitle,
          tagline: s.tagline,
          description: s.description,
          category: s.category,
          reelIds: s.reelIds,
          reasoning: s.reasoning,
          score: s.score,
        }));
        suggestionCount = await insertSuggestions(rows);
        console.log(
          `[classify-and-suggest] brand=${brandSlug} recipe-suggestions=${suggestionCount}`
        );
      }
    } catch (err) {
      // Suggestions sind nicht kritisch — Klassifikation ist persistiert,
      // User kann Vorschlaege spaeter manuell re-triggern. Wir loggen
      // den Fehler aber laufen mit status='done' weiter, damit der
      // Banner schliesst.
      console.error(
        "[classify-and-suggest] suggestPacks failed (non-fatal):",
        err instanceof Error ? err.message : err
      );
    }
  }

  // ─── Schritt 3: Final-Status ────────────────────────────────────────
  await updateScrapeStatus(scrapeId, "done", {
    reelCount: totalReels,
    recipeCount,
    suggestionCount,
  });

  // ─── Schritt 4: KI-Cover fuer Suggestions im Hintergrund ────────────
  // Genau wie beim Pack-Akzeptieren wird fuer jeden Vorschlag ein
  // Flux-Pack-Cover generiert (~$0.15 × N Vorschlaege). Parallel-Chunks
  // von 3, total ~25-50s fuer 6-10 Suggestions. Wenn die Pipeline hier
  // crasht oder timed out, bleibt status='done' und das UI rendert den
  // Reel-Cover-Fallback bis ein erneuter Trigger durchlaeuft.
  //
  // Wichtig: Cover-Gen wird IMMER versucht (nicht nur wenn suggestPacks
  // gerade neue erzeugt hat), damit ein Resume nach Lambda-Timeout den
  // Cover-Schritt sauber nachholt.
  try {
    const pending = await getSuggestionsForBrand(brandSlug, "pending");
    const missingCover = pending.filter((s) => !s.cover_url);
    if (missingCover.length > 0) {
      console.log(
        `[classify-and-suggest] generating ${missingCover.length} suggestion-covers for brand=${brandSlug}`
      );
      await generateSuggestionCovers({
        brandSlug,
        suggestions: missingCover.map((s) => ({
          id: s.id,
          title: s.title,
          tagline: s.tagline,
        })),
      });
    }
  } catch (err) {
    console.error(
      "[classify-and-suggest] suggestion-cover generation failed (non-fatal):",
      err instanceof Error ? err.message : err
    );
  }
}

// Suggestion-Only-Regen ohne Apify-Scrape. Wird vom Cron aufgerufen, wenn
// der Brand zwar einen frischen Reel-Scrape hat (skip-lock greift), aber
// die Pack-Vorschlaege >7 Tage alt sind oder ein Monatswechsel war —
// damit "Top Reels Mai" nicht im Juni stehen bleibt.
//
// Im Unterschied zu runClassificationAndSuggestions:
//   - Kein Klassifikations-Step (Reels sind schon klassifiziert)
//   - Keine scrapeId / kein Scrape-Status-Update
//   - Nutzt direkt die existierende Recipe-Reel-Library
//
// Ablauf:
//   1. Recipe-Reels laden
//   2. Bei < 5 Rezepten: skip
//   3. suggestPacks neu rufen (mit aktuellem Datum im Prompt)
//   4. Alte pending clear, neue insert
//   5. Cover fuer neue Vorschlaege async generieren
export async function regenerateSuggestionsForBrand(
  brandSlug: string
): Promise<{ generated: number; skipped: boolean; reason?: string }> {
  const recipeCount = await countRecipeReelsForBrand(brandSlug);
  if (recipeCount < 5) {
    return { generated: 0, skipped: true, reason: "fewer-than-5-recipes" };
  }
  const brand = await loadBrand(brandSlug);
  const recipeReels: ReelRow[] = await getRecipeReelsForBrand(brandSlug);

  let suggestionCount = 0;
  try {
    const suggestions = await suggestPacks({
      brandName: brand?.name ?? brandSlug,
      recipeReels,
      brand,
    });
    if (suggestions.length === 0) {
      return { generated: 0, skipped: true, reason: "no-suggestions-from-ai" };
    }
    await clearPendingSuggestions(brandSlug);
    const rows: NewSuggestion[] = suggestions.map((s) => ({
      brandSlug,
      title: s.title,
      subtitle: s.subtitle,
      tagline: s.tagline,
      description: s.description,
      category: s.category,
      reelIds: s.reelIds,
      reasoning: s.reasoning,
      score: s.score,
    }));
    suggestionCount = await insertSuggestions(rows);
    console.log(
      `[regenerate-suggestions] brand=${brandSlug} generated=${suggestionCount}`
    );
  } catch (err) {
    console.error(
      "[regenerate-suggestions] suggestPacks failed:",
      err instanceof Error ? err.message : err
    );
    return { generated: 0, skipped: true, reason: "suggest-packs-failed" };
  }

  // Cover async im Hintergrund — gleicher Pattern wie im Onboarding.
  try {
    const pending = await getSuggestionsForBrand(brandSlug, "pending");
    const missingCover = pending.filter((s) => !s.cover_url);
    if (missingCover.length > 0) {
      await generateSuggestionCovers({
        brandSlug,
        suggestions: missingCover.map((s) => ({
          id: s.id,
          title: s.title,
          tagline: s.tagline,
        })),
      });
    }
  } catch (err) {
    console.error(
      "[regenerate-suggestions] cover-gen failed (non-fatal):",
      err instanceof Error ? err.message : err
    );
  }

  return { generated: suggestionCount, skipped: false };
}
