import { NextRequest, NextResponse } from "next/server";
import { enqueueWithInput, listJobs } from "@/lib/jobs/queue";
import { ensureHandlersRegistered } from "@/lib/jobs/handlers";

ensureHandlersRegistered();

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const type = body.type as string;
  const input = body.input ?? {};
  if (!type) {
    return NextResponse.json({ error: "type required" }, { status: 400 });
  }
  const record = enqueueWithInput(type, input);
  return NextResponse.json({ id: record.id, status: record.status });
}

export async function GET() {
  return NextResponse.json({ jobs: listJobs() });
}
