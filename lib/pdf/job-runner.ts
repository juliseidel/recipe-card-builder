import type { SupabaseClient } from "@supabase/supabase-js";
import { loadBrand } from "@/lib/custom-brands-server";
import { getPack } from "@/lib/packs";
import { getCustomPackServer } from "@/lib/custom-packs-server";
import {
  getRecipe,
  getRecipesForPack,
  mergeAndRenumber,
  type MergeableCustom,
  type Recipe,
} from "@/lib/recipes";
import { getServerSupabase } from "@/lib/supabase-server";
import { renderPackPdf, renderRecipePdf } from "./render";
import { renderFitnessCardPdf } from "./render-fitness";
import { getFitnessCardServer } from "@/lib/fitness/custom-cards-server";
import { regeneratePackMeta } from "@/lib/ai/regenerate-pack-meta";

// Erweitert um Fitness-Types (Schritt 5/10, 2026-05-19). Fitness-Pack
// (Cover + alle Cards) folgt in Schritt 10 mit dem Pilot.
export type PdfJobType = "recipe" | "pack" | "fitness-card" | "fitness-pack";

export type CreateJobInput =
  | {
      type: "recipe";
      brandSlug: string;
      packSlug: string;
      recipeSlug: string;
    }
  | {
      type: "pack";
      brandSlug: string;
      packSlug: string;
    }
  | {
      type: "fitness-card";
      brandSlug: string;
      packSlug: string;
      /** Slug der Fitness-Card. Reused recipe_slug-Spalte in pdf_jobs
       *  (gleiches Format, andere Tabelle dahinter). */
      cardSlug: string;
    };

export type PdfJob = {
  id: string;
  type: PdfJobType;
  brand_slug: string;
  pack_slug: string;
  recipe_slug: string | null;
  status: "queued" | "rendering" | "ready" | "failed";
  progress: number;
  stage: string | null;
  file_path: string | null;
  file_url: string | null;
  file_size_bytes: number | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

const BUCKET = "recipe-pdfs";

// Creates a job row and returns its ID. Does not start rendering.
export async function createJob(input: CreateJobInput): Promise<PdfJob> {
  const supabase = getServerSupabase();
  // recipe_slug-Spalte wird fuer fitness-card mit cardSlug befuellt — gleiche
  // Spalte, andere Quell-Tabelle (fitness_cards statt recipes). Spart Schema-
  // Aenderung; processJob branched anhand type.
  const slugForRecipeColumn =
    input.type === "recipe"
      ? input.recipeSlug
      : input.type === "fitness-card"
        ? input.cardSlug
        : null;
  const insert = {
    type: input.type,
    brand_slug: input.brandSlug,
    pack_slug: input.packSlug,
    recipe_slug: slugForRecipeColumn,
    status: "queued" as const,
    progress: 0,
  };
  const { data, error } = await supabase
    .from("pdf_jobs")
    .insert(insert)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`Could not create job row: ${error?.message ?? "unknown"}`);
  }
  return data as PdfJob;
}

export async function getJob(id: string): Promise<PdfJob | null> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("pdf_jobs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[pdf-jobs] getJob", error);
    return null;
  }
  return (data as PdfJob | null) ?? null;
}

// Renders the PDF for a job and uploads to storage. Updates row throughout.
// Designed to be called from a background context (after()).
export async function processJob(jobId: string): Promise<void> {
  const supabase = getServerSupabase();
  const job = await getJob(jobId);
  if (!job) {
    console.error("[pdf-jobs] processJob: not found", jobId);
    return;
  }
  if (job.status === "ready" || job.status === "failed") return;

  const brand = await loadBrand(job.brand_slug);
  const pack =
    getPack(job.brand_slug, job.pack_slug) ??
    (await getCustomPackServer(job.brand_slug, job.pack_slug));
  if (!brand || !pack) {
    await markFailed(supabase, jobId, "Brand or pack not found");
    return;
  }

  // Wait briefly for capacity (simple cooperative queue: max 2 concurrent
  // renders per server). Capped at 30 seconds so a stuck job can't hold us.
  const queueOk = await waitForCapacity(supabase, jobId, 2, 30_000);
  if (!queueOk) {
    await markFailed(supabase, jobId, "Queue wait timed out");
    return;
  }

  try {
    await supabase
      .from("pdf_jobs")
      .update({
        status: "rendering",
        progress: 5,
        stage: "starting",
        started_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    const onProgress = async (stage: string, percent: number) => {
      await supabase
        .from("pdf_jobs")
        .update({ stage, progress: Math.min(99, Math.max(5, percent)) })
        .eq("id", jobId);
    };

    let buffer: Buffer;
    // storagePath stays slug-based so URLs remain ASCII-safe.
    // downloadName is the human-readable filename the browser saves.
    let storagePath: string;
    let downloadName: string;

    // ── Fitness-Card-Branch (Schritt 5/10) ─────────────────────────
    if (job.type === "fitness-card") {
      const cardSlug = job.recipe_slug ?? "";
      const card = await getFitnessCardServer(
        job.brand_slug,
        job.pack_slug,
        cardSlug
      );
      if (!card) {
        await markFailed(supabase, jobId, "Fitness card not found");
        return;
      }
      // Pack muss packType='fitness' haben — sicherheitshalber.
      buffer = await renderFitnessCardPdf({
        brand,
        pack,
        card,
        totalCards: 1, // Single-Card-Export, hideCardIndex blendet die Anzeige eh aus
        onProgress,
      });
      storagePath = `${pack.slug}__${card.slug}.pdf`;
      downloadName = `${safeFilename(card.title)}.pdf`;
    } else if (job.type === "recipe") {
      const recipe = await loadRecipe(
        supabase,
        job.pack_slug,
        job.recipe_slug ?? ""
      );
      if (!recipe) {
        await markFailed(supabase, jobId, "Recipe not found");
        return;
      }
      // totalRecipes drives the "01 / 07" index label on the single-card
      // export. It must reflect what the user sees in the pack grid:
      //   curated baseline − hidden curated cards + custom cards
      // Without the hidden subtraction, a freshly-deleted curated card
      // would still inflate the denominator on every other card's footer.
      const [staticRecipes, customCount, hiddenCount] = await Promise.all([
        getRecipesForPack(job.pack_slug),
        countCustomRecipes(supabase, job.pack_slug),
        countHiddenRecipes(supabase, job.brand_slug, job.pack_slug),
      ]);
      const totalRecipes = Math.max(
        1,
        staticRecipes.length - hiddenCount + customCount
      );
      buffer = await renderRecipePdf({
        brand,
        pack,
        recipe,
        totalRecipes,
        onProgress,
      });
      storagePath = `${pack.slug}__${recipe.slug}.pdf`;
      downloadName = `${safeFilename(recipe.title)}.pdf`;
    } else {
      // BLOCK-ON-SYNC: vor dem Pack-Render synchron sicherstellen, dass
      // pack.foreword die AKTUELLE Recipe-Liste reflektiert. Verhindert die
      // Race-Condition wo der User direkt nach Recipe-Mutation Pack-PDF
      // downloadet — der fire-and-forget triggerPackMetaSync wäre dann oft
      // noch nicht fertig (Gemini ~5-15s) und das PDF würde mit stale
      // foreword rendern (Lügen-Vorwort: gelöschte Rezepte stehen noch drin).
      //
      // forewordOnly=true (vorher force=true): wir synchronisieren NUR das
      // Foreword, NICHT den Title. Der Title ist ein stabiles Identitaets-
      // Feld — vorher lief hier force=true, was bei JEDEM Download den Titel
      // via Gemini neu (und durch LLM-Varianz jedes Mal anders) generierte.
      // Real-Bug 2026-05-19: "Cheesecake-Traeume" → "Meine liebsten
      // Cheesecakes" → "...High Protein Cheesecakes" bei drei aufeinander-
      // folgenden Downloads desselben Packs.
      //
      // Wenn die Re-Generation failt (Gemini-Outage, Network), rendern
      // wir trotzdem weiter mit den alten Texten. Nicht-fatal.
      await supabase
        .from("pdf_jobs")
        .update({ stage: "syncing-foreword", progress: 12 })
        .eq("id", jobId);
      try {
        const sync = await regeneratePackMeta(
          job.brand_slug,
          job.pack_slug,
          { forewordOnly: true }
        );
        if (sync.changed && sync.pack) {
          // Pack-Reference auf den frischen Stand setzen, damit der
          // anschließende Render das frische Foreword verwendet.
          Object.assign(pack, sync.pack);
        }
      } catch (err) {
        console.warn(
          "[pdf-jobs] pre-render foreword sync failed (non-fatal):",
          err instanceof Error ? err.message : err
        );
      }

      // Pack PDF includes curated recipes + any custom cards saved into this
      // pack, MINUS any curated cards the user hid from the web grid. Without
      // the hidden filter the PDF would re-introduce deleted-feeling cards
      // (the user already removed them from the web view but the export
      // would silently bring them back). mergeAndRenumber then puts newest
      // custom first and rewrites sequential 01..N numbers so the index,
      // foreword counter, nutrition table and filename all stay in sync.
      const [staticRecipes, customRecipes, hiddenSlugs] = await Promise.all([
        getRecipesForPack(job.pack_slug),
        loadCustomRecipesForPack(supabase, job.pack_slug),
        loadHiddenSlugsForPack(supabase, job.brand_slug, job.pack_slug),
      ]);
      const visibleStatic = staticRecipes.filter(
        (r) => !hiddenSlugs.has(r.slug)
      );
      const recipes = mergeAndRenumber(visibleStatic, customRecipes);
      if (recipes.length === 0) {
        await markFailed(supabase, jobId, "Pack has no recipes");
        return;
      }
      buffer = await renderPackPdf({
        brand,
        pack,
        recipes,
        onProgress,
      });
      storagePath = `${pack.slug}__pack.pdf`;
      downloadName = `${safeFilename(pack.title)} – ${recipes.length} Rezepte von ${safeFilename(brand.name)}.pdf`;
    }

    await supabase
      .from("pdf_jobs")
      .update({ stage: "uploading", progress: 90 })
      .eq("id", jobId);

    const filePath = `${jobId}/${storagePath}`;
    const upload = await supabase.storage
      .from(BUCKET)
      .upload(filePath, buffer, {
        contentType: "application/pdf",
        upsert: true,
        cacheControl: "3600",
      });
    if (upload.error) {
      await markFailed(supabase, jobId, `Upload failed: ${upload.error.message}`);
      return;
    }

    const { data: publicData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(filePath, {
        download: downloadName,
      });

    await supabase
      .from("pdf_jobs")
      .update({
        status: "ready",
        progress: 100,
        stage: "done",
        file_path: filePath,
        file_url: publicData.publicUrl,
        file_size_bytes: buffer.length,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[pdf-jobs] processJob failed", jobId, err);
    await markFailed(supabase, jobId, msg);
  }
}

// Strip filesystem-unsafe characters but keep umlauts and spaces — browsers
// handle UTF-8 download names fine via Content-Disposition filename*= encoding.
function safeFilename(input: string): string {
  return input
    .replace(/[\/\\:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

async function loadRecipe(
  supabase: SupabaseClient,
  packSlug: string,
  recipeSlug: string
): Promise<Recipe | null> {
  // Try the curated set first (static or already-seeded DB row)
  const stat = await getRecipe(packSlug, recipeSlug);
  if (stat) return stat;
  // Fall back to custom (Supabase-stored)
  const { data, error } = await supabase
    .from("recipes")
    .select("data")
    .eq("pack_slug", packSlug)
    .eq("recipe_slug", recipeSlug)
    .maybeSingle();
  if (error) {
    console.warn("[pdf-jobs] loadRecipe custom lookup failed", error);
    return null;
  }
  return (data?.data as Recipe | undefined) ?? null;
}

async function countCustomRecipes(
  supabase: SupabaseClient,
  packSlug: string
): Promise<number> {
  const { count, error } = await supabase
    .from("recipes")
    .select("*", { count: "exact", head: true })
    .eq("pack_slug", packSlug)
    .eq("is_custom", true);
  if (error) return 0;
  return count ?? 0;
}

// Counts how many curated cards the user has hidden from this pack — the
// single-recipe export uses this to keep its "01 / N" denominator honest.
async function countHiddenRecipes(
  supabase: SupabaseClient,
  brandSlug: string,
  packSlug: string
): Promise<number> {
  const { count, error } = await supabase
    .from("hidden_recipes")
    .select("*", { count: "exact", head: true })
    .eq("brand_slug", brandSlug)
    .eq("pack_slug", packSlug);
  if (error) return 0;
  return count ?? 0;
}

// Loads the slugs of curated cards the user has hidden from this pack. The
// pack-PDF render uses this set to drop those cards before rendering, so a
// freshly-deleted curated card never silently re-appears in the export.
async function loadHiddenSlugsForPack(
  supabase: SupabaseClient,
  brandSlug: string,
  packSlug: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("hidden_recipes")
    .select("recipe_slug")
    .eq("brand_slug", brandSlug)
    .eq("pack_slug", packSlug);
  if (error) {
    console.warn("[pdf-jobs] loadHiddenSlugsForPack failed", error);
    return new Set();
  }
  return new Set(
    (data ?? [])
      .map((row) => row.recipe_slug as string | undefined)
      .filter((slug): slug is string => Boolean(slug))
  );
}

// Reads custom recipes for a pack from Supabase server-side. Mirrors the
// client-side helper in lib/custom-recipes.ts but doesn't need the browser
// client. Returns each row's stored recipe + createdAt so mergeAndRenumber
// can sort by recency.
async function loadCustomRecipesForPack(
  supabase: SupabaseClient,
  packSlug: string
): Promise<MergeableCustom[]> {
  const { data, error } = await supabase
    .from("recipes")
    .select("data, created_at")
    .eq("pack_slug", packSlug)
    .eq("is_custom", true);
  if (error) {
    console.warn("[pdf-jobs] loadCustomRecipesForPack failed", error);
    return [];
  }
  const out: MergeableCustom[] = [];
  for (const row of data ?? []) {
    const recipe = row.data as Recipe | undefined;
    if (!recipe) continue;
    out.push({
      ...recipe,
      createdAt: new Date(row.created_at as string).getTime(),
    });
  }
  return out;
}

async function markFailed(
  supabase: SupabaseClient,
  jobId: string,
  message: string
): Promise<void> {
  await supabase
    .from("pdf_jobs")
    .update({
      status: "failed",
      error: message.slice(0, 500),
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}

// Waits until fewer than `maxConcurrent` jobs are in 'rendering' state, or
// until `timeoutMs` is reached. Returns true if the slot was secured.
async function waitForCapacity(
  supabase: SupabaseClient,
  ownJobId: string,
  maxConcurrent: number,
  timeoutMs: number
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { count, error } = await supabase
      .from("pdf_jobs")
      .select("*", { count: "exact", head: true })
      .eq("status", "rendering")
      .neq("id", ownJobId);
    if (error) {
      console.warn("[pdf-jobs] waitForCapacity error, proceeding anyway", error);
      return true;
    }
    if ((count ?? 0) < maxConcurrent) return true;
    await new Promise((res) => setTimeout(res, 800));
  }
  return false;
}
