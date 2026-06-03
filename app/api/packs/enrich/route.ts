import { NextResponse, after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateCreatorCover } from "@/lib/ai/generate-creator-cover";
import { generateFitnessPackCover } from "@/lib/ai/generate-fitness-pack-cover";
import { generateOutroImage } from "@/lib/ai/generate-outro-image";

// Foreword-Generation ist im Pack-PDF aktuell deaktiviert (Mai 2026 v3 —
// Creator-Cover uebernimmt die Intro-Funktion). Foreword-Imports
// (generatePackForeword, generateForewordImage, Collage) liegen dormant
// im Code; bei Wiederbelebung der Foreword-Page einfach reaktivieren.
//
// generatePackCover (alter Single-Dish-Pfad) wird hier nicht mehr
// importiert — bleibt aber im Repo, weil Suggestion-Cover-Generator
// (lib/reel-library/) und regenerate-field-Endpoint ihn noch nutzen.
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
const OUTRO_BUCKET = "pack-outros";
// FOREWORD_BUCKET ist deaktiviert (Mai 2026 v3) — Foreword-Image
// generation laeuft nicht mehr durch enrich. Bestehende Files im Bucket
// bleiben unangetastet (kein Cleanup).

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
  /** Erzwingt Re-Generation des Outro-Bildes. Analog forceCover. */
  forceOutroImage?: boolean;
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
  // Cover-Skip-Check: "schon enriched" wenn coverImage im pack-covers-
  // Bucket liegt UND es bereits ein creator-Cover ist. Wenn es noch ein
  // altes Legacy-/Lifestyle-Cover ist, regenerieren wir auch ohne force-
  // Flag — sonst bleiben Bestands-Packs auf dem alten Stil haengen.
  const hasCover =
    !body.forceCover &&
    pack.coverStyle === "creator" &&
    (pack.coverImage ?? "").includes(
      `/storage/v1/object/public/${COVER_BUCKET}/`
    );
  // Foreword komplett deaktiviert (siehe Begruendung im Imports-Block).
  // Skip-Check ist immer true → keine Generation, keine Cost.
  const hasForewordText = true;
  const hasForewordImage = true;
  // Outro-Image: analog Cover. Bei Fitness aktuell auch generiert — die
  // Outro-Page rendert für jeden Pack-Type, und ein full-bleed-Outro
  // funktioniert auch ohne Foreword.
  const hasOutroImage =
    !body.forceOutroImage && !!pack.outroImage;

  if (hasCover && hasOutroImage) {
    return NextResponse.json({
      status: "already-enriched",
      packId: row.id,
      packType,
    });
  }

  // Recipes laden — generateCreatorCover braucht 1-3 Recipe-Titel als
  // thematischen Anchor (verankert das Cover-Bild visuell mit dem Pack).
  const packRowBrandSlug = row.brand_slug as string;
  const { data: rRows } = await supabase
    .from("recipes")
    .select("data")
    .eq("brand_slug", packRowBrandSlug)
    .eq("pack_slug", pack.slug);
  const packRecipes: Recipe[] = (rRows ?? [])
    .map((r) => r.data as Recipe)
    .filter((r) => r.title?.trim());

  after(async () => {
    // Zwei unabhaengige Tasks (Cover + Outro). Foreword ist seit Mai 2026 v3
    // komplett raus (siehe Imports-Block).
    //
    // Cover branched nach packType:
    //   - recipe: generateCreatorCover (Gemini 2.5 Flash Image, Person +
    //     Title direkt im Bild)
    //   - fitness: generateFitnessPackCover (Equipment-Stillleben, alter
    //     Hybrid-Pfad mit react-pdf Text-Overlay)
    // Wichtig: NICHT nur den Buffer durchreichen — wir brauchen
    // contentType (PNG bei Gemini, JPEG bei Flux), sonst MIME-Mismatch
    // beim Upload → react-pdf rendert das Bild im PDF nicht.
    const coverPromise = hasCover
      ? Promise.resolve(null)
      : packType === "fitness"
        ? generateFitnessPackCover({ pack })
        : generateCreatorCover({ pack, brand, recipes: packRecipes });

    const outroImagePromise = hasOutroImage
      ? Promise.resolve(null)
      : generateOutroImage(pack);

    const [coverSettled, outroImageSettled] = await Promise.allSettled([
      coverPromise,
      outroImagePromise,
    ]);

    // ─── Upload Pack-Cover ─────────────────────────────────────────────────
    let newCoverImage: string | null = null;
    if (coverSettled.status === "fulfilled" && coverSettled.value) {
      try {
        await ensureBucket(supabase, COVER_BUCKET);
        const { buffer, contentType } = coverSettled.value;
        // Extension nach contentType — sonst rendert react-pdf das Bild im
        // PDF nicht (Gemini liefert PNG, Flux liefert JPEG).
        const ext = contentType === "image/png" ? "png" : "jpg";
        const filePath = `${row.id}.${ext}`;
        const upload = await supabase.storage
          .from(COVER_BUCKET)
          .upload(filePath, buffer, {
            contentType,
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
          // Cache-Bust-Suffix — beim Force-Reroll bleibt sonst die alte
          // CDN-Variante haengen.
          newCoverImage = `${data.publicUrl}?t=${Date.now()}`;
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

    // ─── Upload Outro-Image ───────────────────────────────────────────────
    let newOutroImage: string | null = null;
    if (
      outroImageSettled.status === "fulfilled" &&
      outroImageSettled.value
    ) {
      try {
        await ensureBucket(supabase, OUTRO_BUCKET);
        const filePath = `${row.id}.jpg`;
        const upload = await supabase.storage
          .from(OUTRO_BUCKET)
          .upload(filePath, outroImageSettled.value, {
            contentType: "image/jpeg",
            upsert: true,
            cacheControl: "31536000",
          });
        if (upload.error) {
          console.error(
            "[packs/enrich] outro image upload failed:",
            upload.error.message
          );
        } else {
          const { data } = supabase.storage
            .from(OUTRO_BUCKET)
            .getPublicUrl(filePath);
          newOutroImage = `${data.publicUrl}?t=${Date.now()}`;
        }
      } catch (err) {
        console.error("[packs/enrich] outro image upload threw:", err);
      }
    } else if (outroImageSettled.status === "rejected") {
      console.error(
        "[packs/enrich] outro image generation failed:",
        outroImageSettled.reason
      );
    }

    // ─── Read-modify-write ─────────────────────────────────────────────────
    if (!newCoverImage && !newOutroImage) return;

    const { data: latest } = await supabase
      .from("packs")
      .select("data")
      .eq("id", row.id)
      .maybeSingle();
    const current = (latest?.data as Pack | undefined) ?? pack;
    const merged: Pack = { ...current };
    if (newCoverImage) {
      merged.coverImage = newCoverImage;
      // Cover-Style-Marker steuert die CoverPage:
      //   - "creator" → pure Image-Page (Text ist im Bild von Gemini)
      //   - "lifestyle" → Hybrid (Bild + react-pdf Overlay) fuer Fitness
      merged.coverStyle = packType === "recipe" ? "creator" : "lifestyle";
    }
    if (newOutroImage) merged.outroImage = newOutroImage;

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
