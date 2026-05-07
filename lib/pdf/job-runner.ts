import type { SupabaseClient } from "@supabase/supabase-js";
import { getBrand } from "@/lib/brands";
import { getPack } from "@/lib/packs";
import { getRecipe, getRecipesForPack, type Recipe } from "@/lib/recipes";
import { getServerSupabase } from "@/lib/supabase-server";
import { renderPackPdf, renderRecipePdf } from "./render";

export type PdfJobType = "recipe" | "pack";

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
  const insert = {
    type: input.type,
    brand_slug: input.brandSlug,
    pack_slug: input.packSlug,
    recipe_slug: input.type === "recipe" ? input.recipeSlug : null,
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

  const brand = getBrand(job.brand_slug);
  const pack = getPack(job.brand_slug, job.pack_slug);
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

    if (job.type === "recipe") {
      const recipe = await loadRecipe(
        supabase,
        job.pack_slug,
        job.recipe_slug ?? ""
      );
      if (!recipe) {
        await markFailed(supabase, jobId, "Recipe not found");
        return;
      }
      const staticRecipes = await getRecipesForPack(job.pack_slug);
      const totalRecipes =
        staticRecipes.length +
        (await countCustomRecipes(supabase, job.pack_slug));
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
      // Pack PDF includes both curated recipes and any custom cards the user
      // saved into this pack. We merge them and sort by recipe.number so the
      // index, recipe pages, and nutrition table all read in the same order.
      const [staticRecipes, customRecipes] = await Promise.all([
        getRecipesForPack(job.pack_slug),
        loadCustomRecipesForPack(supabase, job.pack_slug),
      ]);
      const recipes = [...staticRecipes, ...customRecipes].sort(
        (a, b) => a.number - b.number
      );
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

// Reads custom recipes for a pack from Supabase server-side. Mirrors the
// client-side helper in lib/custom-recipes.ts but doesn't need the browser
// client. Used by the pack-PDF renderer so user-saved cards show up next to
// the curated set in cover, index, recipes, and nutrition overview.
async function loadCustomRecipesForPack(
  supabase: SupabaseClient,
  packSlug: string
): Promise<Recipe[]> {
  const { data, error } = await supabase
    .from("recipes")
    .select("data")
    .eq("pack_slug", packSlug)
    .eq("is_custom", true);
  if (error) {
    console.warn("[pdf-jobs] loadCustomRecipesForPack failed", error);
    return [];
  }
  return (data ?? [])
    .map((row) => row.data as Recipe | undefined)
    .filter((r): r is Recipe => Boolean(r));
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
