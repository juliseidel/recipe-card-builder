import { nanoid } from "nanoid";

export type JobStatus = "pending" | "running" | "succeeded" | "failed";

export type JobRecord<T = unknown> = {
  id: string;
  type: string;
  status: JobStatus;
  progress: number;
  message?: string;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  result?: T;
  error?: string;
};

type JobHandler<I, O> = (
  input: I,
  ctx: {
    setProgress: (p: number, message?: string) => void;
  },
) => Promise<O>;

const jobs = new Map<string, JobRecord>();
const handlers = new Map<string, JobHandler<unknown, unknown>>();

const queue: string[] = [];
let running = 0;
const concurrency = 2;

export function registerHandler<I, O>(type: string, handler: JobHandler<I, O>) {
  handlers.set(type, handler as JobHandler<unknown, unknown>);
}

export function enqueue<I>(type: string, input: I): JobRecord {
  const id = nanoid(12);
  const record: JobRecord = {
    id,
    type,
    status: "pending",
    progress: 0,
    createdAt: Date.now(),
  };
  jobs.set(id, record);
  queue.push(id);
  // Defer start to next tick so caller gets the job-id first.
  setTimeout(tick, 10);
  return record;
}

export function getJob(id: string): JobRecord | undefined {
  return jobs.get(id);
}

export function listJobs(limit = 25): JobRecord[] {
  return Array.from(jobs.values())
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}

function tick() {
  while (running < concurrency && queue.length > 0) {
    const id = queue.shift()!;
    const record = jobs.get(id);
    if (!record) continue;
    runJob(record);
  }
}

async function runJob(record: JobRecord) {
  running += 1;
  record.status = "running";
  record.startedAt = Date.now();
  record.progress = 0.05;

  const handler = handlers.get(record.type);
  if (!handler) {
    record.status = "failed";
    record.error = `No handler for job type "${record.type}"`;
    record.finishedAt = Date.now();
    running -= 1;
    setTimeout(tick, 5);
    return;
  }

  try {
    const result = await handler((record as JobRecord<unknown>).result, {
      setProgress: (p, message) => {
        record.progress = Math.max(0, Math.min(1, p));
        if (message) record.message = message;
      },
    });
    record.status = "succeeded";
    record.progress = 1;
    record.result = result;
    record.finishedAt = Date.now();
  } catch (err) {
    record.status = "failed";
    record.error = err instanceof Error ? err.message : String(err);
    record.finishedAt = Date.now();
  } finally {
    running -= 1;
    setTimeout(tick, 5);
  }
}

// Variant that captures input separately so handler receives correct type.
export function enqueueWithInput<I>(type: string, input: I): JobRecord {
  const id = nanoid(12);
  const record: JobRecord = {
    id,
    type,
    status: "pending",
    progress: 0,
    createdAt: Date.now(),
    result: input as unknown,
  };
  jobs.set(id, record);
  queue.push(id);
  setTimeout(tick, 10);
  return record;
}
