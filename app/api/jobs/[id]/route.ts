import { NextResponse } from "next/server";
import { getJob } from "@/lib/jobs/queue";
import { ensureHandlersRegistered } from "@/lib/jobs/handlers";

ensureHandlersRegistered();

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const job = getJob(id);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  return NextResponse.json(job);
}
