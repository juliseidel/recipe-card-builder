import { mockImageProvider } from "./mock";
import { geminiImageProvider } from "./gemini";
import { falFluxProvider } from "./fal";
import type { ImageProvider } from "./types";

export type { ImageProvider, ImageJobResult, ImageGenerateInput } from "./types";

export const providers: Record<string, ImageProvider> = {
  mock: mockImageProvider,
  gemini: geminiImageProvider,
  fal: falFluxProvider,
};

export function getActiveProvider(): ImageProvider {
  const id = process.env.IMAGE_PROVIDER ?? "mock";
  return providers[id] ?? mockImageProvider;
}
