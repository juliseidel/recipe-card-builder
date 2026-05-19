import { NextResponse, after } from "next/server";
import { getFitnessCardServer } from "@/lib/fitness/custom-cards-server";
import { generateFitnessHeroForCard } from "@/lib/ai/generate-fitness-hero";
import { hasServerSupabase, getServerSupabase } from "@/lib/supabase-server";

// Hero-Generierung fuer eine Fitness-Card. Spiegel zu /api/recipes/enrich
// aber fuer fitness_cards-Tabelle. Wird vom Card-Editor nach Save
// fire-and-forget aufgerufen — User landet auf Pack-Detail-Page,
// Hero-Bild taucht auf sobald die Pipeline durch ist (~10-25s).
//
// Ablauf:
//   1. Card aus DB laden (validate brandSlug + packSlug + cardSlug existieren)
//   2. Wenn card.hero schon gesetzt und !force: skip (idempotent)
//   3. generateFitnessHeroForCard: Apify-Scrape -> Keyframe -> Sharp Upscale
//   4. UPDATE fitness_cards SET data->>'hero' = <new-url>
//   5. Optional: forceHero=true im body triggert Re-Roll (alte URL ueberschrieben)

export const runtime = "nodejs";
export const maxDuration = 120;

type EnrichRequest = {
  brandSlug: string;
  packSlug: string;
  cardSlug: string;
  /** Wenn true: ueberschreibt vorhandenes Hero (Re-Roll). Default false. */
  forceHero?: boolean;
};

export async function POST(req: Request) {
  if (!hasServerSupabase()) {
    return NextResponse.json(
      { error: "Supabase is not configured on the server" },
      { status: 500 }
    );
  }

  let body: Partial<EnrichRequest>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.brandSlug || !body.packSlug || !body.cardSlug) {
    return NextResponse.json(
      { error: "brandSlug, packSlug and cardSlug are required" },
      { status: 400 }
    );
  }

  const card = await getFitnessCardServer(
    body.brandSlug,
    body.packSlug,
    body.cardSlug
  );
  if (!card) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }
  if (!card.sourceUrl) {
    return NextResponse.json(
      { error: "Card has no sourceUrl — cannot generate hero" },
      { status: 400 }
    );
  }

  // Idempotent: wenn Hero schon da und !force, return den existierenden.
  if (card.hero && !body.forceHero) {
    return NextResponse.json(
      { ok: true, heroUrl: card.hero, skipped: "already-set" },
      { status: 200 }
    );
  }

  // Card-Row-ID brauchen wir fuer den Hero-Storage-Pfad. Wir lesen sie
  // jetzt separat statt sie ueber den Loader durchzureichen — Loader gibt
  // FitnessCard (semantic shape) ohne DB-id zurueck.
  const supabase = getServerSupabase();
  const { data: row, error: rowErr } = await supabase
    .from("fitness_cards")
    .select("id, data")
    .eq("brand_slug", body.brandSlug)
    .eq("pack_slug", body.packSlug)
    .eq("card_slug", body.cardSlug)
    .maybeSingle();
  if (rowErr || !row) {
    return NextResponse.json({ error: "Card row not found" }, { status: 404 });
  }
  const cardId = row.id as string;

  // Async ueber after() — Client bekommt sofort 202, Pipeline laeuft
  // im Background. Pack-Detail-Page polled die fitness_cards-Tabelle
  // ueber das Grid (client-side getCustomFitnessCardsForPack) und
  // zeigt das Hero sobald geschrieben.
  after(async () => {
    try {
      const result = await generateFitnessHeroForCard({
        card,
        cardId,
        brandSlug: body.brandSlug!,
      });
      if (!result?.heroUrl) {
        console.warn(
          `[fitness-enrich] no hero generated for ${body.cardSlug}`
        );
        return;
      }
      // Hero-URL in data->>'hero' persistieren — Merge mit bestehendem
      // data-Object (anderes als das was kommt + frische hero-URL).
      const currentData = row.data as Record<string, unknown>;
      const newData = { ...currentData, hero: result.heroUrl };
      const { error: updErr } = await supabase
        .from("fitness_cards")
        .update({ data: newData })
        .eq("id", cardId);
      if (updErr) {
        console.error("[fitness-enrich] update failed:", updErr);
      } else {
        console.log(
          `[fitness-enrich] hero saved for ${body.cardSlug} (source: ${result.source})`
        );
      }
    } catch (err) {
      console.error(
        `[fitness-enrich] pipeline failed for ${body.cardSlug}:`,
        err instanceof Error ? err.message : err
      );
    }
  });

  return NextResponse.json(
    {
      ok: true,
      jobStarted: true,
      message: "Hero-Generation laeuft im Hintergrund. Pack-Detail-Page polled.",
    },
    { status: 202 }
  );
}
