import { nanoid } from "nanoid";
import type { ImageProvider, ImageGenerateInput, ImageJobResult } from "./types";

type MockJob = {
  startedAt: number;
  duration: number;
  prompt: string;
  aspectRatio: string;
};

const jobs = new Map<string, MockJob>();

function aspectRatioDimensions(ar?: string): { w: number; h: number } {
  switch (ar) {
    case "1:1":
      return { w: 1024, h: 1024 };
    case "4:3":
      return { w: 1024, h: 768 };
    case "3:4":
      return { w: 768, h: 1024 };
    case "16:9":
      return { w: 1280, h: 720 };
    case "21:9":
      return { w: 1280, h: 549 };
    default:
      return { w: 1024, h: 1024 };
  }
}

function placeholderUrl(prompt: string, ar: string): string {
  const { w, h } = aspectRatioDimensions(ar);
  const seed = encodeURIComponent(prompt.slice(0, 60));
  return `https://picsum.photos/seed/${seed}/${w}/${h}`;
}

export const mockImageProvider: ImageProvider = {
  id: "mock",
  displayName: "Mock (Placeholder)",
  async generate(input: ImageGenerateInput) {
    const jobId = nanoid(12);
    jobs.set(jobId, {
      startedAt: Date.now(),
      duration: 4000 + Math.random() * 3000,
      prompt: input.prompt,
      aspectRatio: input.aspectRatio ?? "1:1",
    });
    return { jobId };
  },
  async poll(jobId: string): Promise<ImageJobResult> {
    const job = jobs.get(jobId);
    if (!job) return { status: "failed", error: "Job not found" };
    const elapsed = Date.now() - job.startedAt;
    if (elapsed < job.duration) return { status: "running" };
    return {
      status: "succeeded",
      imageUrl: placeholderUrl(job.prompt, job.aspectRatio),
    };
  },
};
