import { GeminiError } from "./gemini";

// Gemini 2.5 Flash Image — Google's native image generation model
// (auch bekannt als "Nano Banana"). Endpoint: gemini-2.5-flash-image
// über generateContent. Akzeptiert Text-Prompt + optional Image-Inputs
// für multimodal Generation/Editing.
//
// API-Docs: https://ai.google.dev/gemini-api/docs/image-generation
//
// Vorteile gegenüber Flux:
//   - Andere Trainings-Daten → anderer Color-Bias (Hoffnung: realistischere Pinks)
//   - Multimodal-nativ — kann Reference-Images sauberer integrieren
//   - Schneller (~5-10s statt 15-25s bei Flux)
//
// Nachteile / Unbekanntes:
//   - Weniger photorealistisch bei manchen Subjects als Flux 2 Pro
//   - Aspect-Ratio-Kontrolle anders (via Prompt-Hint, nicht Parameter)

const ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent";

export type GeminiImageOpts = {
  prompt: string;
  /** Optionales Reference-Image als data URI für multimodal Generation. */
  referenceImage?: string;
  /** Aspect-Hint im Prompt — Gemini hat keinen separaten Parameter,
   *  wir hängen das ans Prompt-Ende: "square 1:1 aspect ratio". */
  aspectRatio?: "1:1" | "9:16" | "16:9" | "4:3" | "3:4";
};

export type GeminiImageResult = {
  /** Image als Buffer (JPEG oder PNG). */
  buffer: Buffer;
  /** MIME-Type (image/jpeg oder image/png). */
  mimeType: string;
};

export async function generateImageGemini(
  opts: GeminiImageOpts
): Promise<GeminiImageResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiError("GEMINI_API_KEY is not set");
  }

  // Aspect-Ratio im Prompt verstärken — Gemini reagiert auf Wording
  const aspectHint = opts.aspectRatio === "1:1"
    ? "Square 1:1 aspect ratio composition."
    : opts.aspectRatio
      ? `${opts.aspectRatio} aspect ratio.`
      : "";

  const fullPrompt = aspectHint
    ? `${opts.prompt}\n\n${aspectHint}`
    : opts.prompt;

  // Parts bauen: Reference-Image (falls vorhanden) ZUERST, dann Text-Prompt.
  // Bei multimodal Generation will Gemini erst den Kontext-Image sehen,
  // dann die Instruktion was zu tun ist.
  const parts: Array<
    { text: string } | { inlineData: { mimeType: string; data: string } }
  > = [];

  if (opts.referenceImage) {
    const base64 = opts.referenceImage.split(",")[1] ?? "";
    if (base64) {
      parts.push({
        inlineData: { mimeType: "image/jpeg", data: base64 },
      });
    }
  }
  parts.push({ text: fullPrompt });

  const body = {
    contents: [{ parts }],
    generationConfig: {
      // responseModalities essential — sonst returnt Gemini nur Text
      responseModalities: ["IMAGE"],
      temperature: 0.7,
    },
  };

  const res = await fetch(`${ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new GeminiError(
      `Gemini Image generation failed (${res.status}): ${text.slice(0, 400)}`,
      res.status,
      text
    );
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inlineData?: { mimeType: string; data: string };
          text?: string;
        }>;
      };
      finishReason?: string;
    }>;
    promptFeedback?: unknown;
  };

  const candidates = data.candidates ?? [];
  if (candidates.length === 0) {
    throw new GeminiError(
      "Gemini returned no candidates",
      undefined,
      data
    );
  }

  const responseParts = candidates[0]?.content?.parts ?? [];
  for (const part of responseParts) {
    if (part.inlineData?.data) {
      return {
        buffer: Buffer.from(part.inlineData.data, "base64"),
        mimeType: part.inlineData.mimeType || "image/jpeg",
      };
    }
  }

  // Kein Image im Response — meist Safety-Block oder Schema-Fehler
  const finishReason = candidates[0]?.finishReason ?? "unknown";
  const textParts = responseParts
    .map((p) => p.text)
    .filter(Boolean)
    .join(" ")
    .slice(0, 300);
  throw new GeminiError(
    `Gemini returned no image. finishReason=${finishReason}. Text: ${textParts}`,
    undefined,
    data
  );
}
