import { NextResponse } from "next/server";
import { loadAllBrands } from "@/lib/custom-brands-server";
import {
  analyzeCreatorStoryFromCaptions,
  ensureBrandCreatorStory,
} from "@/lib/ai/analyze-creator-story";
import { updateBrandCreatorStory } from "@/lib/custom-brands-server";
import { queryReelsForBrand } from "@/lib/creator-reels-server";
import type { Brand } from "@/lib/brands";

// Backfill-Endpoint fuer brand.creatorStory. Wird einmalig getriggert
// (nach dem Deploy dieses PRs), damit alle bestehenden 15 Creator eine
// persistierte Story bekommen. Spaeter onboardende Brands bekommen die
// Story automatisch im Onboarding-Flow.
//
// Aufruf:
//   POST /api/brands/backfill-story            → alle Brands ohne Story
//   POST /api/brands/backfill-story?force=1    → alle Brands, ueberschreibt
//   POST /api/brands/backfill-story?slug=biene → nur 1 Brand
//
// Auth: optionaler CRON_SECRET-Bearer-Header. Default: public — non-
// destruktiv (liest aus reels, schreibt in brand.creatorStory),
// idempotent (zweiter Aufruf ohne ?force=1 ist no-op).

export const runtime = "nodejs";
// 15 Brands x ~8s Gemini-Pro = 120s sequenziell. Mit 3er-Batches ~40s,
// aber wir wollen Headroom fuer Reel-DB-Lookups + Persistierung. 300s
// gibt Sicherheit, auch wenn ein Brand mal 30s braucht.
export const maxDuration = 300;

const BATCH_SIZE = 3;

type BackfillResult = {
  slug: string;
  status: "ok" | "skipped" | "failed";
  reason?: string;
  storyLength?: number;
};

async function handle(req: Request) {
  // Optionaler Bearer-Token-Check — gleiches Pattern wie cron-Endpoints.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY nicht gesetzt." },
      { status: 500 }
    );
  }

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";
  const singleSlug = url.searchParams.get("slug")?.trim() || null;

  // Brand-Liste sammeln
  let brands: Brand[];
  try {
    brands = await loadAllBrands();
  } catch (err) {
    return NextResponse.json(
      {
        error: `Brands konnten nicht geladen werden: ${err instanceof Error ? err.message : err}`,
      },
      { status: 500 }
    );
  }

  if (singleSlug) {
    brands = brands.filter((b) => b.slug === singleSlug);
    if (brands.length === 0) {
      return NextResponse.json(
        { error: `Brand '${singleSlug}' nicht gefunden.` },
        { status: 404 }
      );
    }
  }

  // Filter: nur Brands ohne Story, ausser force=1
  const toProcess = force
    ? brands
    : brands.filter((b) => !b.creatorStory?.trim());

  const skipped: BackfillResult[] = brands
    .filter((b) => !toProcess.includes(b))
    .map((b) => ({
      slug: b.slug,
      status: "skipped" as const,
      reason: "creatorStory bereits vorhanden",
      storyLength: b.creatorStory?.length,
    }));

  // Process in BATCH_SIZE-Chunks parallel
  const results: BackfillResult[] = [...skipped];
  for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
    const chunk = toProcess.slice(i, i + BATCH_SIZE);
    const settled = await Promise.allSettled(
      chunk.map((brand) => backfillOne(brand, force))
    );
    settled.forEach((s, idx) => {
      const brand = chunk[idx];
      if (s.status === "fulfilled") {
        results.push(s.value);
      } else {
        results.push({
          slug: brand.slug,
          status: "failed",
          reason: s.reason instanceof Error ? s.reason.message : String(s.reason),
        });
      }
    });
  }

  const ok = results.filter((r) => r.status === "ok").length;
  const skippedCount = results.filter((r) => r.status === "skipped").length;
  const failed = results.filter((r) => r.status === "failed").length;

  return NextResponse.json({
    ok: true,
    summary: {
      total: brands.length,
      processed: ok,
      skipped: skippedCount,
      failed,
    },
    results,
  });
}

/** Einzel-Backfill: laedt Captions aus der DB, ruft Gemini Pro, persistiert.
 *  Bei force=true wird auch ueberschrieben — sonst nutzen wir
 *  ensureBrandCreatorStory das schon den has-story-Check macht.
 *
 *  Wir gehen NICHT ueber ensureBrandCreatorStory bei force=true, weil das
 *  bei vorhandener Story sofort returnt — wir wollen aber neu generieren. */
async function backfillOne(brand: Brand, force: boolean): Promise<BackfillResult> {
  if (!force) {
    // Standard-Pfad ueber ensureBrandCreatorStory → checkt has-story selbst,
    // Lazy-Backfill-Logik kommt mit (Cache, Persistenz, Captions-Mindest-
    // Anzahl).
    const result = await ensureBrandCreatorStory(brand);
    if (result?.creatorStory?.trim()) {
      return {
        slug: brand.slug,
        status: "ok",
        storyLength: result.creatorStory.length,
      };
    }
    return {
      slug: brand.slug,
      status: "failed",
      reason: "ensureBrandCreatorStory returnte keinen Story-Text (zu wenig Captions oder Gemini-Fail)",
    };
  }

  // force=true: direkt Captions ziehen, neu generieren, persistieren.
  // onlyRecipes:false — auch Fitness/Mindset einbeziehen, Persoenlichkeit
  // steckt quer durch alle Content-Types.
  let captions: string[] = [];
  try {
    const reels = await queryReelsForBrand({
      brandSlug: brand.slug,
      onlyRecipes: false,
      limit: 15,
    });
    captions = reels
      .map((r) => r.caption ?? "")
      .filter((c) => c.trim().length > 50)
      .slice(0, 15);
  } catch (err) {
    return {
      slug: brand.slug,
      status: "failed",
      reason: `reels-load failed: ${err instanceof Error ? err.message : err}`,
    };
  }

  if (captions.length < 5) {
    return {
      slug: brand.slug,
      status: "failed",
      reason: `nur ${captions.length} Captions verfuegbar (min 5 noetig)`,
    };
  }

  let story: string;
  try {
    story = await analyzeCreatorStoryFromCaptions(captions, {
      username: brand.handle.replace(/^@/, ""),
      biography: brand.bio,
      voiceDescriptors: brand.voiceProfile?.toneDescriptors,
      forbiddenTopics: brand.voiceProfile?.forbiddenTopics,
    });
  } catch (err) {
    return {
      slug: brand.slug,
      status: "failed",
      reason: `gemini failed: ${err instanceof Error ? err.message : err}`,
    };
  }

  if (!story.trim()) {
    return {
      slug: brand.slug,
      status: "failed",
      reason: "leere Story von Gemini erhalten",
    };
  }

  try {
    await updateBrandCreatorStory(brand.slug, story);
  } catch (err) {
    return {
      slug: brand.slug,
      status: "failed",
      reason: `persist failed: ${err instanceof Error ? err.message : err}`,
    };
  }

  return {
    slug: brand.slug,
    status: "ok",
    storyLength: story.length,
  };
}

export async function POST(req: Request) {
  return handle(req);
}

export async function GET(req: Request) {
  return handle(req);
}
