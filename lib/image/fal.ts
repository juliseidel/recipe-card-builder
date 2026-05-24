import { nanoid } from "nanoid";
import type {
  ImageProvider,
  ImageGenerateInput,
  ImageJobResult,
} from "./types";

const results = new Map<string, ImageJobResult>();

const FAL_MODEL = "fal-ai/flux-pro/v1.1-ultra";

export const falFluxProvider: ImageProvider = {
  id: "fal-flux-pro-1.1-ultra",
  displayName: "FLUX 1.1 Pro Ultra (fal.ai)",
  async generate(input: ImageGenerateInput) {
    const apiKey = process.env.FAL_KEY;
    if (!apiKey) {
      throw new Error("FAL_KEY missing — falling back to mock");
    }

    const jobId = nanoid(12);
    results.set(jobId, { status: "running" });

    (async () => {
      try {
        const res = await fetch(`https://fal.run/${FAL_MODEL}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Key ${apiKey}`,
          },
          body: JSON.stringify({
            prompt: input.prompt,
            aspect_ratio: input.aspectRatio ?? "1:1",
            num_images: 1,
            output_format: "jpeg",
            safety_tolerance: "2",
            enable_safety_checker: true,
            seed: input.seed,
          }),
        });
        if (!res.ok) {
          const text = await res.text();
          results.set(jobId, {
            status: "failed",
            error: `fal.ai ${res.status}: ${text}`,
          });
          return;
        }
        const data = await res.json();
        const imageUrl = data?.images?.[0]?.url;
        if (!imageUrl) {
          results.set(jobId, {
            status: "failed",
            error: "No image URL in response",
          });
          return;
        }
        results.set(jobId, { status: "succeeded", imageUrl });
      } catch (err) {
        results.set(jobId, { status: "failed", error: String(err) });
      }
    })();

    return { jobId };
  },
  async poll(jobId: string): Promise<ImageJobResult> {
    return results.get(jobId) ?? { status: "failed", error: "Unknown job" };
  },
};
