import { nanoid } from "nanoid";
import type {
  ImageProvider,
  ImageGenerateInput,
  ImageJobResult,
} from "./types";

const inflight = new Map<string, Promise<ImageJobResult>>();
const results = new Map<string, ImageJobResult>();

const GEMINI_IMAGE_MODEL = "imagen-4.0-generate-001";

export const geminiImageProvider: ImageProvider = {
  id: "gemini-imagen",
  displayName: "Google Imagen 4",
  async generate(input: ImageGenerateInput) {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_API_KEY missing — falling back to mock");
    }

    const jobId = nanoid(12);
    results.set(jobId, { status: "running" });

    const promise = (async (): Promise<ImageJobResult> => {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateImages?key=${apiKey}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: { text: input.prompt },
            aspectRatio: input.aspectRatio ?? "1:1",
            sampleCount: 1,
          }),
        });
        if (!res.ok) {
          const text = await res.text();
          return { status: "failed", error: `Gemini ${res.status}: ${text}` };
        }
        const data = await res.json();
        const imageBase64 = data?.images?.[0]?.bytesBase64Encoded;
        if (!imageBase64) {
          return { status: "failed", error: "No image in response" };
        }
        return {
          status: "succeeded",
          imageUrl: `data:image/png;base64,${imageBase64}`,
        };
      } catch (err) {
        return { status: "failed", error: String(err) };
      }
    })();

    inflight.set(jobId, promise);
    promise.then((r) => results.set(jobId, r));

    return { jobId };
  },
  async poll(jobId: string): Promise<ImageJobResult> {
    return results.get(jobId) ?? { status: "failed", error: "Unknown job" };
  },
};
