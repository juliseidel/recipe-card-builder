import "server-only";
import { registerHandler } from "./queue";
import { getActiveProvider } from "@/lib/image";
import type { ImageGenerateInput } from "@/lib/image";

let installed = false;

export function ensureHandlersRegistered() {
  if (installed) return;
  installed = true;

  registerHandler<ImageGenerateInput, { imageUrl: string }>(
    "image.generate",
    async (input, ctx) => {
      const provider = getActiveProvider();
      ctx.setProgress(0.05, `Provider: ${provider.displayName}`);
      const { jobId } = await provider.generate(input);
      ctx.setProgress(0.15, "Generierung läuft …");

      let attempts = 0;
      const maxAttempts = 60;

      while (attempts < maxAttempts) {
        await new Promise((r) => setTimeout(r, 1500));
        const result = await provider.poll(jobId);
        ctx.setProgress(
          0.15 + (attempts / maxAttempts) * 0.8,
          `Warte auf Bild …`,
        );
        if (result.status === "succeeded" && result.imageUrl) {
          ctx.setProgress(0.98, "Fast fertig …");
          return { imageUrl: result.imageUrl };
        }
        if (result.status === "failed") {
          throw new Error(result.error ?? "Image generation failed");
        }
        attempts += 1;
      }
      throw new Error("Image generation timed out");
    },
  );

  registerHandler<{ packSlug: string }, { url: string }>(
    "pack.render-pdf",
    async (input, ctx) => {
      ctx.setProgress(0.1, "PDF wird vorbereitet …");
      // The PDF endpoint streams synchronously. We just simulate the queue
      // step here so the UI can show a progress bar; the actual stream is
      // served by /api/pack/[slug]/pdf.
      await new Promise((r) => setTimeout(r, 800));
      ctx.setProgress(0.9, "Layout finalisieren …");
      await new Promise((r) => setTimeout(r, 400));
      return { url: `/api/pack/${input.packSlug}/pdf` };
    },
  );
}
