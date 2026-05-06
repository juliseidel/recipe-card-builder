import { NextResponse } from "next/server";
import { getJob } from "@/lib/pdf/job-runner";
import { hasServerSupabase } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!hasServerSupabase()) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 500 }
    );
  }
  const { id } = await ctx.params;
  const job = await getJob(id);
  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(
    {
      id: job.id,
      type: job.type,
      brandSlug: job.brand_slug,
      packSlug: job.pack_slug,
      recipeSlug: job.recipe_slug,
      status: job.status,
      progress: job.progress,
      stage: job.stage,
      fileUrl: job.file_url,
      fileSizeBytes: job.file_size_bytes,
      error: job.error,
      createdAt: job.created_at,
      startedAt: job.started_at,
      completedAt: job.completed_at,
    },
    {
      headers: {
        // Polling endpoint — never cache responses
        "Cache-Control": "no-store",
      },
    }
  );
}
