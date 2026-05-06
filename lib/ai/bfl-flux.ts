// Black Forest Labs Flux 1.1 Pro client. We use BFL's hosted API directly
// rather than going through Replicate so the dependency surface stays tiny
// (one fetch, no SDK) and so we can swap to FLUX.1 Kontext later (which
// supports image+text+image input — Jan's "Fusion" workflow with reference
// keyframes) without changing call sites.
//
// API docs: https://docs.bfl.ml/

const BFL_BASE = "https://api.bfl.ai";

export type FluxModel =
  | "flux-2-pro" // newest model, the one Jan recommends
  | "flux-pro-1.1" // standard pro, $0.04 per image, ~12-15 s
  | "flux-pro-1.1-ultra" // higher fidelity, $0.06, ~20 s
  | "flux-kontext-pro" // image-to-image with reference, $0.04
  | "flux-kontext-max"; // higher-fidelity image-to-image

export type FluxRequest = {
  prompt: string;
  /** Negative prompt — what NOT to render. */
  negativePrompt?: string;
  model?: FluxModel;
  /** Output dimensions. Default 1024×1024 — square covers fit our card UI. */
  width?: number;
  height?: number;
  /** Reference image for kontext model (data URI or public URL). */
  referenceImage?: string;
  /** Random seed for deterministic regeneration. Default random. */
  seed?: number;
  /** Output format. PNG for our pipeline (lossless before we re-encode). */
  outputFormat?: "jpeg" | "png";
  /** Soft safety setting. 0 = strict, 6 = permissive. Default 2. */
  safetyTolerance?: number;
  /** Aspect ratio for ultra model (overrides width/height). E.g. "1:1". */
  aspectRatio?: string;
};

export type FluxResult = {
  /** Direct URL to the generated PNG. URL is valid for ~10 minutes,
   *  so always download to local storage immediately. */
  imageUrl: string;
  /** Whether the moderator flagged the image. */
  flagged: boolean;
  /** Echoed seed (use to reproduce the same image deterministically). */
  seed: number;
};

export class BflError extends Error {
  constructor(
    message: string,
    public status?: number,
    public detail?: unknown
  ) {
    super(message);
    this.name = "BflError";
  }
}

// BFL is async: POST starts a job and returns a polling URL. We hide that
// behind a single call() that resolves to the final image URL once ready.
export async function generateImage(req: FluxRequest): Promise<FluxResult> {
  const apiKey = process.env.BFL_API_KEY;
  if (!apiKey) {
    throw new BflError("BFL_API_KEY is not set");
  }

  const model = req.model ?? "flux-pro-1.1";
  const endpoint = `${BFL_BASE}/v1/${model}`;

  const body: Record<string, unknown> = {
    prompt: req.prompt,
    output_format: req.outputFormat ?? "jpeg",
    safety_tolerance: req.safetyTolerance ?? 2,
  };
  if (req.negativePrompt) body.negative_prompt = req.negativePrompt;
  if (req.seed !== undefined) body.seed = req.seed;
  if (req.referenceImage) body.image_prompt = req.referenceImage;

  // Ultra model uses aspect_ratio; standard pro uses width+height.
  if (model === "flux-pro-1.1-ultra") {
    body.aspect_ratio = req.aspectRatio ?? "1:1";
  } else {
    body.width = req.width ?? 1024;
    body.height = req.height ?? 1024;
  }

  // Step 1 — kick off the job
  const startRes = await fetch(endpoint, {
    method: "POST",
    headers: {
      "x-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!startRes.ok) {
    const text = await startRes.text().catch(() => "");
    throw new BflError(
      `BFL POST failed (${startRes.status}): ${text.slice(0, 400)}`,
      startRes.status,
      text
    );
  }
  const startJson = (await startRes.json()) as {
    id?: string;
    polling_url?: string;
  };
  const pollUrl = startJson.polling_url;
  if (!pollUrl) {
    throw new BflError("BFL response missing polling_url", undefined, startJson);
  }

  // Step 2 — poll until ready. Flux 1.1 Pro typically completes in 12-15s,
  // Flux 2 Pro in 15-25s. We give it 240s (4 minutes) max — observed in
  // batch runs that a healthy BFL cluster occasionally takes 90-120s on
  // some prompts under load, and a 180s ceiling caused ~40% timeouts on a
  // 37-recipe batch. 240s gives enough headroom without hanging forever.
  const POLL_DEADLINE_MS = 240_000;
  const deadline = Date.now() + POLL_DEADLINE_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    const pollRes = await fetch(pollUrl, {
      headers: { "x-key": apiKey },
    });
    if (!pollRes.ok) {
      // Transient errors: retry. 4xx other than 429 = give up.
      if (pollRes.status >= 500 || pollRes.status === 429) continue;
      const text = await pollRes.text().catch(() => "");
      throw new BflError(
        `BFL poll failed (${pollRes.status}): ${text.slice(0, 400)}`,
        pollRes.status,
        text
      );
    }
    const poll = (await pollRes.json()) as {
      status: string;
      result?: {
        sample?: string;
        seed?: number;
        prompt_safety?: { flagged?: boolean };
      };
    };
    if (poll.status === "Ready") {
      const sample = poll.result?.sample;
      if (!sample) {
        throw new BflError(
          "BFL marked Ready but result.sample missing",
          undefined,
          poll
        );
      }
      return {
        imageUrl: sample,
        flagged: poll.result?.prompt_safety?.flagged ?? false,
        seed: poll.result?.seed ?? 0,
      };
    }
    if (poll.status === "Error" || poll.status === "Content Moderated") {
      throw new BflError(
        `BFL job ${poll.status}`,
        undefined,
        poll
      );
    }
    // "Pending" / "Request Moderated" → keep polling
  }

  throw new BflError(
    `BFL polling timed out after ${POLL_DEADLINE_MS / 1000} s`
  );
}

// Download the generated image into a Buffer. BFL's CDN is fast — pulling
// a 1024×1024 JPEG is ~30-60 KB, takes a fraction of a second.
export async function downloadImage(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new BflError(
      `Image download failed (${res.status}) from ${url.slice(0, 80)}…`,
      res.status
    );
  }
  const arr = await res.arrayBuffer();
  return Buffer.from(arr);
}
