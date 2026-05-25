import { NextResponse, after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generatePackCover } from "@/lib/ai/generate-pack-cover";
import { generateFitnessPackCover } from "@/lib/ai/generate-fitness-pack-cover";
import { generatePackForeword } from "@/lib/ai/generate-foreword";
import { generateForewordImage } from "@/lib/ai/generate-foreword-image";
// v3: Collage + fetchHeroBuffers werden hier nicht mehr direkt aufgerufen
// (Default = Nano Banana mit Heroes als Refs via generateForewordImage).
// isBrandStyleHero bleibt — der Pack-Heroes-Filter ist weiter sinnvoll.
import { isBrandStyleHero } from "@/lib/ai/generate-foreword-collage";
import { loadBrand } from "@/lib/custom-brands-server";
import { getServerSupabase, hasServerSupabase } from "@/lib/supabase-server";
import type { Pack } from "@/lib/packs";
import type { Recipe } from "@/lib/recipes";
import { resolvePackType } from "@/lib/fitness/types";

// Async pack-enrichment — generates everything a freshly-created custom
// pack needs to look like one of the curated Bienen-Packs:
//   1. Pack-Cover via Flux 2 Pro (~20-30 s)
//   2. Vorwort-Text via Gemini 2.5 Flash (~5 s) — Booklet-Greeting + Story + Signoff
//   3. Vorwort-Stillleben via Flux 2 Pro (~20-30 s)
//
// All three run inside after() so the POST returns a 202 immediately.
// The pack editor fires this fire-and-forget after the user clicks Save.
// Each task is independent — a Gemini hiccup doesn't kill the cover, a
// cover failure doesn't kill the foreword. Tasks that already have results
// (e.g. user re-edits the pack and triggers enrich again) are skipped.

export const runtime = "nodejs";
// Cover + Foreword-Image (parallel) ~30 s, Foreword-Text ~5 s, plus
// Storage-Upload/DB-Write overhead. Cap at 120 s to leave headroom.
export const maxDuration = 120;

const COVER_BUCKET = "pack-covers";
const FOREWORD_BUCKET = "pack-forewords";

type Body = {
  packId: string;
  /** Erzwingt Re-Generation des Covers, auch wenn schon eines existiert.
   *  Wird vom Pack-Cover-Reroll-Button im UI gesetzt — User klickt
   *  "Cover neu generieren", wenn ihm das aktuelle nicht gefaellt oder
   *  die Generierung haengen geblieben ist. */
  forceCover?: boolean;
  /** Erzwingt Re-Generation des Vorwort-Bildes. Analog forceCover. */
  forceForewordImage?: boolean;
  /** Erzwingt Re-Generation des Vorwort-Textes (Greeting + Story + Signoff). */
  forceForewordText?: boolean;
};

export async function POST(req: Request) {
  if (!hasServerSupabase()) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 500 }
    );
  }
  if (!process.env.BFL_API_KEY) {
    return NextResponse.json(
      { error: "BFL API key not configured" },
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
  if (!body?.packId) {
    return NextResponse.json(
      { error: "packId is required" },
      { status: 400 }
    );
  }

  const supabase = getServerSupabase();
  const { data: row, error } = await supabase
    .from("packs")
    .select("id, brand_slug, data")
    .eq("id", body.packId)
    .maybeSingle();
  if (error || !row) {
    return NextResponse.json(
      { error: error?.message ?? "Pack not found" },
      { status: 404 }
    );
  }

  const pack = row.data as Pack;
  const brand = await loadBrand(row.brand_slug);
  if (!brand) {
    return NextResponse.json(
      { error: `Brand '${row.brand_slug}' not found` },
      { status: 404 }
    );
  }

  // Pack-Type-Diskriminator. Bei Fitness-Pack laufen nur Cover-Gen (mit
  // Equipment-Prompt), kein Foreword-Text + kein Foreword-Bild —
  // Foreword-Pipeline ist recipe-spezifisch (Pack-PDF rendert die
  // Vorwort-Page nur fuer Recipe-Packs).
  const packType = resolvePackType(pack, brand);

  // Per-task skip checks — re-running enrich (e.g. user edits a field)
  // mustn't burn a fresh Flux/Gemini call for results we already have.
  // Cover counts as "done" when its URL points at our own bucket;
  // foreword counts as "done" when both fields are populated.
  //
  // force-Parameter-Override: wenn forceCover/forceForeword* gesetzt,
  // ignorieren wir den hasX-Check und regenerieren trotzdem.
  const hasCover =
    !body.forceCover &&
    (pack.coverImage ?? "").includes(
      `/storage/v1/object/public/${COVER_BUCKET}/`
    );
  // Bei Fitness-Packs: Foreword wird komplett geskipped — markieren als
  // "done" damit Skip-Check + Promise.allSettled das richtig tun.
  const hasForewordText =
    packType === "fitness" || (!body.forceForewordText && !!pack.foreword);
  const hasForewordImage =
    packType === "fitness" || (!body.forceForewordImage && !!pack.forewordImage);

  if (hasCover && hasForewordText && hasForewordImage) {
    return NextResponse.json({
      status: "already-enriched",
      packId: row.id,
      packType,
    });
  }

  // Foreword-Image-Strategie (v3): immer Nano Banana mit den Recipe-Heroes
  // des Packs als visuelle Style-Anker. Generator entscheidet selbst, was
  // er mit 0/1/2/3 Refs anstellt. Collage-Code (generateForewordCollage)
  // bleibt im Repo, wird aber nicht mehr default genutzt — der Setting-
  // Look von Nano Banana ist editorial-konsistenter als die 2x2-Repetition.
  //
  // Returns { buffer, isCollage } — isCollage bleibt im Type fuer
  // Backward-Compat mit dem File-Marker, ist v3 aber immer false.
  const packRowBrandSlug = row.brand_slug as string;
  async function buildForewordImage(): Promise<
    { buffer: Buffer; isCollage: boolean } | null
  > {
    if (hasForewordImage) return null;
    // Recipe-Heroes laden aus DB
    const { data: recipeRows } = await supabase
      .from("recipes")
      .select("data")
      .eq("brand_slug", packRowBrandSlug)
      .eq("pack_slug", pack.slug);
    const heroUrls: string[] = [];
    for (const r of recipeRows ?? []) {
      const recipe = r.data as Recipe;
      if (recipe.hero && isBrandStyleHero(recipe.hero)) {
        heroUrls.push(recipe.hero);
      }
    }
    console.log(
      `[packs/enrich] foreword-image: Nano Banana with ${heroUrls.length} hero refs for ${pack.slug}`
    );
    const buffer = await generateForewordImage(pack, { heroUrls });
    return { buffer, isCollage: false };
  }

  // Recipe-Titel fuer generatePackForeword laden — gibt der KI konkrete
  // Rezept-Namen die sie in der Story namentlich erwaehnen kann. Macht
  // die Vorworte um Welten besser ("vom Curry Dattel Dip ueber den High
  // Protein Schuettel Salat" statt "verschiedene Rezepte").
  let recipeTitlesForForeword: string[] = [];
  if (!hasForewordText) {
    const { data: rRows } = await supabase
      .from("recipes")
      .select("data")
      .eq("brand_slug", packRowBrandSlug)
      .eq("pack_slug", pack.slug);
    recipeTitlesForForeword = (rRows ?? [])
      .map((r) => (r.data as Recipe).title?.trim() ?? "")
      .filter(Boolean);
  }

  after(async () => {
    // Three independent enrichment tasks. We use Promise.allSettled so a
    // failure in one (Gemini overloaded, Flux timeout) doesn't drop the
    // others. Each settled value is processed individually below.
    //
    // Cover-Generator branched nach packType:
    //   - recipe: generatePackCover (Food-Stillleben)
    //   - fitness: generateFitnessPackCover (Equipment-Stillleben mit
    //     Sub-Niche-Heuristik aus Pack-Category, kein Foreword)
    const coverPromise = hasCover
      ? Promise.resolve(null)
      : packType === "fitness"
        ? generateFitnessPackCover({ pack }).then((r) => r.buffer)
        : generatePackCover({ pack }).then((r) => r.buffer);

    const [coverSettled, forewordTextSettled, forewordImageSettled] =
      await Promise.allSettled([
        coverPromise,
        hasForewordText
          ? Promise.resolve(null)
          : generatePackForeword(pack, brand, recipeTitlesForForeword),
        buildForewordImage(),
      ]);

    // ─── Upload Pack-Cover ─────────────────────────────────────────────────
    let newCoverImage: string | null = null;
    if (coverSettled.status === "fulfilled" && coverSettled.value) {
      try {
        await ensureBucket(supabase, COVER_BUCKET);
        const filePath = `${row.id}.jpg`;
        const upload = await supabase.storage
          .from(COVER_BUCKET)
          .upload(filePath, coverSettled.value, {
            contentType: "image/jpeg",
            upsert: true,
            cacheControl: "31536000",
          });
        if (upload.error) {
          console.error(
            "[packs/enrich] cover upload failed:",
            upload.error.message
          );
        } else {
          const { data } = supabase.storage
            .from(COVER_BUCKET)
            .getPublicUrl(filePath);
          newCoverImage = data.publicUrl;
        }
      } catch (err) {
        console.error("[packs/enrich] cover upload threw:", err);
      }
    } else if (coverSettled.status === "rejected") {
      console.error(
        "[packs/enrich] cover generation failed:",
        coverSettled.reason
      );
    }

    // ─── Foreword-Text — kein Upload, geht direkt in pack.data ────────────
    const newForeword =
      forewordTextSettled.status === "fulfilled"
        ? forewordTextSettled.value
        : null;
    if (forewordTextSettled.status === "rejected") {
      console.error(
        "[packs/enrich] foreword text generation failed:",
        forewordTextSettled.reason
      );
    }

    // ─── Upload Foreword-Bild (Collage ODER Flux-Stillleben) ─────────────
    // Filename-Marker: `{id}-collage.jpg` bei Collage, `{id}.jpg` bei Flux.
    // detectAndTriggerEnrichGaps liest diesen Marker und triggert re-gen
    // wenn der Pack jetzt 3+ Brand-Heroes hat aber das Foreword noch ein
    // Flux-Stillleben ist (User-Wunsch: Pack-Bild zeigt alle Rezepte).
    let newForewordImage: string | null = null;
    if (
      forewordImageSettled.status === "fulfilled" &&
      forewordImageSettled.value
    ) {
      try {
        await ensureBucket(supabase, FOREWORD_BUCKET);
        const { buffer, isCollage } = forewordImageSettled.value;
        const filePath = isCollage
          ? `${row.id}-collage.jpg`
          : `${row.id}.jpg`;
        const upload = await supabase.storage
          .from(FOREWORD_BUCKET)
          .upload(filePath, buffer, {
            contentType: "image/jpeg",
            upsert: true,
            cacheControl: "31536000",
          });
        if (upload.error) {
          console.error(
            "[packs/enrich] foreword image upload failed:",
            upload.error.message
          );
        } else {
          const { data } = supabase.storage
            .from(FOREWORD_BUCKET)
            .getPublicUrl(filePath);
          // Cache-Bust-Suffix damit Browser + Vercel die neue URL auch
          // dann holen wenn der alte Filename gelesen wurde.
          newForewordImage = `${data.publicUrl}?t=${Date.now()}`;
        }
      } catch (err) {
        console.error("[packs/enrich] foreword image upload threw:", err);
      }
    } else if (forewordImageSettled.status === "rejected") {
      console.error(
        "[packs/enrich] foreword image generation failed:",
        forewordImageSettled.reason
      );
    }

    // ─── Read-modify-write: alle Felder in einem Schreibvorgang merge ─────
    // Wenn nichts neu generiert wurde (alle Tasks failed oder schon
    // vorhanden), sparen wir den Round-Trip in die DB.
    if (!newCoverImage && !newForeword && !newForewordImage) return;

    const { data: latest } = await supabase
      .from("packs")
      .select("data")
      .eq("id", row.id)
      .maybeSingle();
    const current = (latest?.data as Pack | undefined) ?? pack;
    const merged: Pack = { ...current };
    if (newCoverImage) merged.coverImage = newCoverImage;
    if (newForeword) merged.foreword = newForeword;
    if (newForewordImage) merged.forewordImage = newForewordImage;

    await supabase.from("packs").update({ data: merged }).eq("id", row.id);
  });

  return NextResponse.json(
    { status: "enriching", packId: row.id },
    { status: 202 }
  );
}

async function ensureBucket(
  supabase: SupabaseClient,
  bucket: string
): Promise<void> {
  const { error } = await supabase.storage.createBucket(bucket, {
    public: true,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg"],
  });
  if (error && !/already exists/i.test(error.message)) {
    console.warn(
      `[packs/enrich] bucket '${bucket}' create warning:`,
      error.message
    );
  }
}
