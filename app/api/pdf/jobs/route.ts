import { NextResponse, after } from "next/server";
import { createJob, processJob, type CreateJobInput } from "@/lib/pdf/job-runner";
import { loadBrand } from "@/lib/custom-brands-server";
import { getPack } from "@/lib/packs";
import { getCustomPackServer } from "@/lib/custom-packs-server";
import { hasServerSupabase } from "@/lib/supabase-server";

// PDF rendering needs the Node.js runtime (binary FS reads, Buffer, etc.)
export const runtime = "nodejs";
// Allow longer-running jobs — pack PDFs with many recipes can take 10–30s.
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!hasServerSupabase()) {
    return NextResponse.json(
      { error: "Supabase is not configured on the server" },
      { status: 500 }
    );
  }

  let body: Partial<CreateJobInput> & {
    recipeSlug?: string;
    cardSlug?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validTypes = new Set(["recipe", "pack", "fitness-card"]);
  if (!body || !body.type || !validTypes.has(body.type)) {
    return NextResponse.json(
      { error: "type must be 'recipe', 'pack' or 'fitness-card'" },
      { status: 400 }
    );
  }
  if (!body.brandSlug || !body.packSlug) {
    return NextResponse.json(
      { error: "brandSlug and packSlug are required" },
      { status: 400 }
    );
  }
  if (body.type === "recipe" && !body.recipeSlug) {
    return NextResponse.json(
      { error: "recipeSlug is required when type='recipe'" },
      { status: 400 }
    );
  }
  if (body.type === "fitness-card" && !body.cardSlug) {
    return NextResponse.json(
      { error: "cardSlug is required when type='fitness-card'" },
      { status: 400 }
    );
  }

  // Cheap existence check before queuing — return 404 fast for typos.
  // Falls through to the user-created custom pack table if the slug
  // isn't in the curated set, otherwise PDFs for new packs would 404
  // before they even hit the job runner.
  const brand = await loadBrand(body.brandSlug);
  const pack =
    getPack(body.brandSlug, body.packSlug) ??
    (await getCustomPackServer(body.brandSlug, body.packSlug));
  if (!brand || !pack) {
    return NextResponse.json(
      { error: "Unknown brand or pack" },
      { status: 404 }
    );
  }

  let job;
  try {
    if (body.type === "recipe") {
      job = await createJob({
        type: "recipe",
        brandSlug: body.brandSlug,
        packSlug: body.packSlug,
        recipeSlug: body.recipeSlug!,
      });
    } else if (body.type === "fitness-card") {
      job = await createJob({
        type: "fitness-card",
        brandSlug: body.brandSlug,
        packSlug: body.packSlug,
        cardSlug: body.cardSlug!,
      });
    } else {
      job = await createJob({
        type: "pack",
        brandSlug: body.brandSlug,
        packSlug: body.packSlug,
      });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not create job" },
      { status: 500 }
    );
  }

  // Render in the background so the POST returns instantly (great UX) and
  // the heavy work runs after the response is flushed.
  after(async () => {
    await processJob(job.id);
  });

  return NextResponse.json(
    {
      jobId: job.id,
      status: job.status,
      pollUrl: `/api/pdf/jobs/${job.id}`,
    },
    { status: 202 }
  );
}
