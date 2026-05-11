// Thin Gemini 2.5 client. We use the REST endpoint directly to keep the
// dependency surface small — no @google/genai SDK needed for our use case.
//
// Two model variants are reachable via `model` option in GeminiOptions:
//   - "flash" (default): gemini-2.5-flash, ~2-3 s, gut fuer Schema-Extraktion
//   - "pro": gemini-2.5-pro, ~5-10 s, deutlich besseres Bild-Verstaendnis
//     (Detail-Capture, Farb-Nuancen, raeumliche Anordnung) — wir nutzen
//     Pro fuer Vision-Calls, wo Bild-Detail-Treue zaehlt.

const ENDPOINT_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models/";

function endpointFor(model: "flash" | "pro"): string {
  const slug = model === "pro" ? "gemini-2.5-pro" : "gemini-2.5-flash";
  return `${ENDPOINT_BASE}${slug}:generateContent`;
}

export type GeminiSchema = Record<string, unknown>;

export type GeminiOptions = {
  prompt: string;
  schema?: GeminiSchema;
  temperature?: number;
  maxOutputTokens?: number;
  systemInstruction?: string;
  /** Set to 0 to disable Gemini 2.5's internal thinking budget — speeds up
   * structured-extraction calls and prevents thinking tokens from cannibalising
   * the output budget. Default leaves it model-default. */
  thinkingBudget?: number;
  /** How many times to retry on 5xx / network errors. Default 2. */
  retries?: number;
  /** "flash" (default, schnell) oder "pro" (genauer fuer Vision). */
  model?: "flash" | "pro";
};

export class GeminiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public detail?: unknown
  ) {
    super(message);
    this.name = "GeminiError";
  }
}

// Calls Gemini 2.5 Flash with optional structured JSON output. Returns the
// parsed JSON when a schema is provided, otherwise the raw text response.
export async function callGemini<T = unknown>(
  opts: GeminiOptions
): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiError(
      "GEMINI_API_KEY is not set in the environment"
    );
  }

  // No maxOutputTokens by default — letting Gemini decide its own output
  // budget avoids mid-response truncation. Only set when explicitly requested
  // (e.g. cost guard for free-form text generation, never for JSON extraction).
  const generationConfig: Record<string, unknown> = {
    temperature: opts.temperature ?? 0.4,
    ...(opts.maxOutputTokens !== undefined
      ? { maxOutputTokens: opts.maxOutputTokens }
      : {}),
    ...(opts.schema
      ? {
          responseMimeType: "application/json",
          responseSchema: opts.schema,
        }
      : {}),
  };
  if (opts.thinkingBudget !== undefined) {
    generationConfig.thinkingConfig = {
      thinkingBudget: opts.thinkingBudget,
    };
  }

  const body: Record<string, unknown> = {
    contents: [{ parts: [{ text: opts.prompt }] }],
    generationConfig,
  };

  if (opts.systemInstruction) {
    body.systemInstruction = {
      parts: [{ text: opts.systemInstruction }],
    };
  }

  const maxRetries = opts.retries ?? 2;
  let lastErr: GeminiError | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      // Exponential backoff with jitter: 1s, 2s, 4s …
      const delay = Math.min(8000, 800 * 2 ** (attempt - 1)) + Math.random() * 400;
      await new Promise((r) => setTimeout(r, delay));
    }

    let res: Response;
    try {
      res = await fetch(`${endpointFor(opts.model ?? "flash")}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (err) {
      lastErr = new GeminiError(
        `Network error: ${(err as Error).message}`,
        undefined,
        err
      );
      continue;
    }

    if (res.status >= 500 || res.status === 429) {
      const errText = await res.text().catch(() => "");
      lastErr = new GeminiError(
        `Gemini API ${res.status}: ${errText.slice(0, 200)}`,
        res.status,
        errText
      );
      continue;
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new GeminiError(
        `Gemini API ${res.status}: ${errText.slice(0, 400)}`,
        res.status,
        errText
      );
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        finishReason?: string;
      }>;
      promptFeedback?: { blockReason?: string };
    };

    if (data.promptFeedback?.blockReason) {
      throw new GeminiError(
        `Gemini blocked request: ${data.promptFeedback.blockReason}`,
        undefined,
        data.promptFeedback
      );
    }

    const finishReason = data.candidates?.[0]?.finishReason;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      // Empty response often means MAX_TOKENS was hit during thinking — retry
      // is unlikely to help, but the caller may need to bump the budget.
      throw new GeminiError(
        `Gemini returned empty response (finishReason=${finishReason ?? "unknown"})`,
        undefined,
        data
      );
    }

    if (!opts.schema) {
      return text as unknown as T;
    }

    try {
      return JSON.parse(text) as T;
    } catch (err) {
      throw new GeminiError(
        `Gemini returned invalid JSON (finishReason=${finishReason}): ${
          (err as Error).message
        }\nText (first 300): ${text.slice(0, 300)}`
      );
    }
  }

  throw lastErr ?? new GeminiError("Gemini failed after retries");
}

// ─── Multimodal-Variante ────────────────────────────────────────────────────
// Identisch zu callGemini, aber statt eines einzelnen Text-Prompts nimmt
// diese Variante eine Liste von Parts entgegen — Text-Bloecke + inline-
// Image-Bloecke (Base64). Gebraucht fuer Vision-Use-Cases wie Keyframe-
// Selection (lib/ai/select-keyframe.ts) und (zukuenftig) Image-to-Recipe-
// Workflows. Gemini 2.5 Flash unterstuetzt bis zu 16 inline images pro
// Request.

export type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

export type GeminiMultimodalOptions = Omit<GeminiOptions, "prompt"> & {
  parts: GeminiPart[];
  /** "flash" (default) oder "pro" — pro fuer detail-kritische Vision-Calls. */
  model?: "flash" | "pro";
};

export async function callGeminiMultimodal<T = unknown>(
  opts: GeminiMultimodalOptions
): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiError("GEMINI_API_KEY is not set in the environment");
  }

  const generationConfig: Record<string, unknown> = {
    temperature: opts.temperature ?? 0.4,
    ...(opts.maxOutputTokens !== undefined
      ? { maxOutputTokens: opts.maxOutputTokens }
      : {}),
    ...(opts.schema
      ? {
          responseMimeType: "application/json",
          responseSchema: opts.schema,
        }
      : {}),
  };
  if (opts.thinkingBudget !== undefined) {
    generationConfig.thinkingConfig = { thinkingBudget: opts.thinkingBudget };
  }

  const body: Record<string, unknown> = {
    contents: [{ parts: opts.parts }],
    generationConfig,
  };
  if (opts.systemInstruction) {
    body.systemInstruction = { parts: [{ text: opts.systemInstruction }] };
  }

  const maxRetries = opts.retries ?? 2;
  let lastErr: GeminiError | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delay =
        Math.min(8000, 800 * 2 ** (attempt - 1)) + Math.random() * 400;
      await new Promise((r) => setTimeout(r, delay));
    }
    let res: Response;
    try {
      res = await fetch(`${endpointFor(opts.model ?? "flash")}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (err) {
      lastErr = new GeminiError(
        `Network error: ${(err as Error).message}`,
        undefined,
        err
      );
      continue;
    }
    if (res.status >= 500 || res.status === 429) {
      const errText = await res.text().catch(() => "");
      lastErr = new GeminiError(
        `Gemini API ${res.status}: ${errText.slice(0, 200)}`,
        res.status,
        errText
      );
      continue;
    }
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new GeminiError(
        `Gemini API ${res.status}: ${errText.slice(0, 400)}`,
        res.status,
        errText
      );
    }
    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        finishReason?: string;
      }>;
      promptFeedback?: { blockReason?: string };
    };
    if (data.promptFeedback?.blockReason) {
      throw new GeminiError(
        `Gemini blocked request: ${data.promptFeedback.blockReason}`,
        undefined,
        data.promptFeedback
      );
    }
    const finishReason = data.candidates?.[0]?.finishReason;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new GeminiError(
        `Gemini returned empty response (finishReason=${finishReason ?? "unknown"})`,
        undefined,
        data
      );
    }
    if (!opts.schema) {
      return text as unknown as T;
    }
    try {
      return JSON.parse(text) as T;
    } catch (err) {
      throw new GeminiError(
        `Gemini returned invalid JSON (finishReason=${finishReason}): ${
          (err as Error).message
        }\nText (first 300): ${text.slice(0, 300)}`
      );
    }
  }
  throw lastErr ?? new GeminiError("Gemini failed after retries");
}
