import { getServerSupabase, hasServerSupabase } from "@/lib/supabase-server";
import { getReelsByIds, type ReelRow } from "@/lib/creator-reels-server";
import {
  parseExerciseFromCaption,
  assembleExerciseCard,
} from "@/lib/ai/parse-exercise-from-caption";
import { moodPresets } from "@/lib/pack-presets";
import type { Pack, PackMood, CardLayout } from "@/lib/packs";
import type { ExerciseCard, FitnessCardLayout } from "@/lib/fitness/types";

// Spiegel zu lib/reel-library/pack-builder.ts, aber baut Fitness-Packs:
//   - packs-Row mit packType='fitness'
//   - fitness_cards-Rows (ExerciseCard) mit aus Caption geparsten Feldern
//     + Klassifikations-Tags (bodyParts, equipment, workoutType, level)
//   - Hero-Pipeline (Reel-Keyframe + Sharp Cinematic) pro Card via
//     fire-and-forget enrich-Call durch den Caller
//
// Wird vom /api/pack-suggestions/[id]/accept-Endpoint aufgerufen wenn die
// Suggestion zu einem Fitness-Brand gehoert.

export type BuildFitnessPackOptions = {
  brandSlug: string;
  reelIds: string[];
  pack: {
    slug: string;
    title: string;
    subtitle: string;
    tagline: string;
    description: string;
    category: string;
    mood: PackMood;
    displayFont: Pack["displayFont"];
    /** CardLayout aus lib/packs.ts (recipe-Layouts) — wird hier als Pack-
     *  Default gespeichert, aber bei Fitness-Packs spielt es keine Rolle
     *  weil Fitness-Cards eigene FitnessCardLayouts haben. */
    cardLayout: CardLayout;
    /** Default-Fitness-Layout fuer die Cards. Aktuell nur 'studio-performance'
     *  produktiv (siehe lib/pdf/fitness-card-pdf.tsx). */
    fitnessCardLayout?: FitnessCardLayout;
  };
  origin: string;
  presetCoverImage?: string;
};

export type BuildFitnessPackResult = {
  packId: string;
  packSlug: string;
  cardCount: number;
  parseFailures: number;
  /** Card-Slugs der frisch angelegten Karten. Caller triggert pro Card
   *  einen /api/fitness-cards/enrich-Call im after()-Hook. */
  insertedCardSlugs: string[];
};

function slugifyCard(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

// Re-export aus pack-builder fuer Konsistenz beim Mood-Picken.
export function pickFitnessMoodById(id: string): PackMood {
  return moodPresets.find((m) => m.id === id)?.mood ?? moodPresets[0].mood;
}

export async function buildFitnessPackFromReels(
  opts: BuildFitnessPackOptions
): Promise<BuildFitnessPackResult | null> {
  if (!hasServerSupabase()) return null;
  if (opts.reelIds.length === 0) return null;

  const reels = await getReelsByIds(opts.reelIds);
  if (reels.length === 0) return null;

  // 1. Parse alle Captions parallel via Gemini.
  const parsedSettled = await Promise.allSettled(
    reels.map((r) =>
      parseExerciseFromCaption(r.caption, {
        contentType: r.content_type,
        workoutType: r.workout_type,
        bodyParts: r.body_parts,
        equipment: r.equipment,
        trainingSetting: r.training_setting,
        trainingGoal: r.training_goal,
        fitnessLevel: r.fitness_level,
        durationMinutes: r.duration_minutes,
        recipeTitle: r.recipe_title,
      })
    )
  );

  type ParsedEntry = {
    reel: ReelRow;
    parsed: import("@/lib/ai/parse-exercise-from-caption").ParsedExerciseCard;
  };
  const successes: ParsedEntry[] = [];
  let failures = 0;
  parsedSettled.forEach((res, idx) => {
    if (res.status === "fulfilled" && res.value.ok) {
      successes.push({ reel: reels[idx], parsed: res.value.card });
    } else {
      failures += 1;
      const errMsg =
        res.status === "rejected"
          ? res.reason instanceof Error
            ? res.reason.message
            : String(res.reason)
          : (res as { value: { ok: false; error: string } }).value.error;
      console.warn(
        `[fitness-pack-builder] parse failed for reel ${reels[idx].ig_id}: ${errMsg}`
      );
    }
  });

  if (successes.length < 3) {
    console.warn(
      `[fitness-pack-builder] only ${successes.length} of ${reels.length} reels parsed — aborting`
    );
    return null;
  }

  const supabase = getServerSupabase();

  // 2. Pack-Number ableiten.
  const { count: customCount } = await supabase
    .from("packs")
    .select("*", { count: "exact", head: true })
    .eq("brand_slug", opts.brandSlug)
    .eq("is_custom", true);

  const { packs: codePacks } = await import("@/lib/packs");
  const staticCount = codePacks.filter((p) => p.brandSlug === opts.brandSlug)
    .length;
  const packNumber = staticCount + (customCount ?? 0) + 1;

  // 3. Pack-Row anlegen — mit packType='fitness'.
  const packData: Pack = {
    slug: opts.pack.slug,
    brandSlug: opts.brandSlug,
    number: packNumber,
    title: opts.pack.title,
    subtitle: opts.pack.subtitle,
    category: opts.pack.category,
    tagline: opts.pack.tagline,
    description: opts.pack.description,
    recipeCount: 0,
    coverImage: opts.presetCoverImage ?? "",
    mood: opts.pack.mood,
    displayFont: opts.pack.displayFont,
    cardLayout: opts.pack.cardLayout,
    packType: "fitness",
  };

  const { data: packRow, error: packErr } = await supabase
    .from("packs")
    .insert({
      brand_slug: opts.brandSlug,
      pack_slug: opts.pack.slug,
      data: packData,
      is_custom: true,
    })
    .select("id, pack_slug")
    .single();

  if (packErr || !packRow) {
    console.error("[fitness-pack-builder] pack insert failed", packErr);
    return null;
  }

  // 4. Fitness-Card-Rows anlegen. Slug-Conflict-Resolution mit Counter-Suffix.
  const cardRows: Array<{
    brand_slug: string;
    pack_slug: string;
    card_slug: string;
    type: string;
    data: ExerciseCard;
    is_custom: boolean;
  }> = [];

  const seenSlugs = new Set<string>();
  successes.forEach((entry, idx) => {
    const baseSlug =
      slugifyCard(entry.parsed.title) ||
      `exercise-${idx + 1}-${entry.reel.ig_id.slice(0, 6)}`;
    let slug = baseSlug;
    let counter = 2;
    while (seenSlugs.has(slug)) {
      slug = `${baseSlug}-${counter++}`;
    }
    seenSlugs.add(slug);

    // Hero-Placeholder: gecachte Reel-Cover-URL aus reel-covers-Bucket
    // (permanent verfuegbar). /api/fitness-cards/enrich erkennt das als
    // Platzhalter und triggert die Cinematic-Hero-Pipeline.
    const heroPlaceholder =
      (entry.reel as { cover_storage_url?: string | null }).cover_storage_url ??
      entry.reel.display_url ??
      "";

    const assembled = assembleExerciseCard(entry.parsed, {
      contentType: entry.reel.content_type,
      workoutType: entry.reel.workout_type,
      bodyParts: entry.reel.body_parts,
      equipment: entry.reel.equipment,
      trainingSetting: entry.reel.training_setting,
      trainingGoal: entry.reel.training_goal,
      fitnessLevel: entry.reel.fitness_level,
      durationMinutes: entry.reel.duration_minutes,
      recipeTitle: entry.reel.recipe_title,
    });

    const card: ExerciseCard = {
      ...assembled,
      slug,
      brandSlug: opts.brandSlug,
      packSlug: opts.pack.slug,
      number: idx + 1,
      sourceUrl: entry.reel.post_url,
      sourceLabel: "Original-Reel",
      hero: heroPlaceholder,
    };

    cardRows.push({
      brand_slug: opts.brandSlug,
      pack_slug: opts.pack.slug,
      card_slug: slug,
      type: "exercise",
      data: card,
      is_custom: true,
    });
  });

  const { data: insertedCards, error: cardErr } = await supabase
    .from("fitness_cards")
    .insert(cardRows)
    .select("card_slug");

  if (cardErr) {
    console.error("[fitness-pack-builder] card inserts failed", cardErr);
  }

  const cardCount = insertedCards?.length ?? cardRows.length;
  const insertedCardSlugs = (insertedCards ?? []).map(
    (r) => r.card_slug as string
  );

  return {
    packId: packRow.id,
    packSlug: packRow.pack_slug,
    cardCount,
    parseFailures: failures,
    insertedCardSlugs,
  };
}

// Helper fuer Caller: triggert /api/fitness-cards/enrich pro Card im
// after()-Hook. Mit X-Internal-Token damit die Auth-Middleware durchlaesst.
export async function triggerEnrichForBuiltFitnessPack(
  origin: string,
  brandSlug: string,
  packSlug: string,
  cardSlugs: string[],
  packId?: string
): Promise<void> {
  const internalToken = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  console.log(
    `[fitness-pack-builder] triggering enrich for ${packSlug} + ${cardSlugs.length} cards (token ${internalToken ? "set" : "MISSING"})`
  );
  const headers = {
    "Content-Type": "application/json",
    "x-internal-token": internalToken,
  };

  const calls: Promise<unknown>[] = [];

  // Pack-Cover/Foreword separat triggern (siehe Block 8 — /api/packs/enrich
  // mit pack-type-Branching).
  if (packId) {
    calls.push(
      fetch(`${origin}/api/packs/enrich`, {
        method: "POST",
        headers,
        body: JSON.stringify({ packId }),
      }).catch((err) =>
        console.warn(
          "[fitness-pack-builder] pack-enrich failed:",
          err instanceof Error ? err.message : err
        )
      )
    );
  }

  // Pro Card ein Hero-Enrich
  for (const cardSlug of cardSlugs) {
    calls.push(
      fetch(`${origin}/api/fitness-cards/enrich`, {
        method: "POST",
        headers,
        body: JSON.stringify({ brandSlug, packSlug, cardSlug }),
      }).catch((err) =>
        console.warn(
          `[fitness-pack-builder] card-enrich failed for ${cardSlug}:`,
          err instanceof Error ? err.message : err
        )
      )
    );
  }

  const results = await Promise.allSettled(calls);
  results.forEach((r, idx) => {
    if (r.status === "rejected") {
      console.warn(
        `[fitness-pack-builder] enrich call ${idx} rejected:`,
        r.reason instanceof Error ? r.reason.message : r.reason
      );
    }
  });
}
