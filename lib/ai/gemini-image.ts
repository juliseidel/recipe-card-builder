// Gemini 2.5 Flash Image (Nano Banana) REST-Client.
//
// Separates Modul vom Text-Gemini (lib/ai/gemini.ts) weil:
//   - Anderer Endpoint (gemini-2.5-flash-image:generateContent)
//   - Anderes Request-Schema (parts mit text + inline_data fuer Reference-Images)
//   - Andere Response-Form (inline_data Image-Bytes statt JSON)
//   - Andere Cost-Charakteristik (~$0.039 pro Bild, 1290 output tokens)
//
// Reference-Images werden inline als base64 mitgeschickt — wir akzeptieren
// rohe Buffer und enkodieren hier. Caller gibt mime-type explizit, weil wir
// nicht erraten wollen (PNG/JPEG/WEBP).
//
// Text-Rendering: Gemini 2.5 Flash Image kann Text ins Bild generieren,
// aber Doku warnt: "struggles with precise typography compared to Gemini 3".
// Fuer kurze Cookbook-Titel okay; lange Strings oder spezielle Glyphen
// (Umlaute, Sonderzeichen) sind nicht garantiert pixelgenau. Caller sollte
// damit rechnen + die Title-Texte robust formulieren (kurz, sparsame
// Umlaute).

const ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent";

export type GeminiImageReference = {
  /** Roher Bild-Buffer (z.B. von fs.readFile oder fetch.arrayBuffer). */
  buffer: Buffer;
  /** MIME-Typ, z.B. "image/jpeg" oder "image/png". */
  mimeType: "image/jpeg" | "image/png" | "image/webp";
};

export type GeminiImageOptions = {
  /** Hauptprompt — was generiert werden soll. */
  prompt: string;
  /** Reference-Bilder die Gemini als Input/Anker nutzen soll. Order matters:
   *  das erste Bild wird typischerweise als Subject-Anker gelesen, das
   *  zweite als Stil/Setting-Anker. Max 3 in der Praxis. */
  references?: GeminiImageReference[];
  /** Aspect-Ratio. Supported: 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9.
   *  Alle bei 1024px Basis-Aufloesung. Default 1:1. */
  aspectRatio?:
    | "1:1"
    | "2:3"
    | "3:2"
    | "3:4"
    | "4:3"
    | "4:5"
    | "5:4"
    | "9:16"
    | "16:9"
    | "21:9";
  /** Retries on 5xx / network errors. Default 1 (Image-Gen ist teuer, kein
   *  aggressiver Retry). */
  retries?: number;
};

export type GeminiImageResult = {
  /** Image-Buffer (Format ist typischerweise PNG, Gemini entscheidet). */
  buffer: Buffer;
  /** MIME-Typ wie von Gemini gemeldet. */
  mimeType: string;
};

export class GeminiImageError extends Error {
  constructor(
    message: string,
    public status?: number,
    public detail?: unknown
  ) {
    super(message);
    this.name = "GeminiImageError";
  }
}

export async function generateGeminiImage(
  opts: GeminiImageOptions
): Promise<GeminiImageResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiImageError(
      "GEMINI_API_KEY is not set in the environment"
    );
  }

  // Parts: zuerst Text, dann Reference-Images. Reihenfolge ist
  // konventionell; Gemini liest beide Modalitaeten zusammen.
  const parts: Array<Record<string, unknown>> = [{ text: opts.prompt }];
  for (const ref of opts.references ?? []) {
    parts.push({
      inline_data: {
        mime_type: ref.mimeType,
        data: ref.buffer.toString("base64"),
      },
    });
  }

  const body = {
    contents: [{ parts }],
    generationConfig: {
      responseFormat: {
        image: {
          aspectRatio: opts.aspectRatio ?? "1:1",
        },
      },
    },
  };

  const retries = opts.retries ?? 1;
  let lastErr: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        // 5xx oder 429 wird retried; 4xx ist meist permanent (bad prompt,
        // safety-block, schema-fehler) — kein Retry, sofort raisen.
        const isTransient = res.status >= 500 || res.status === 429;
        if (!isTransient || attempt === retries) {
          throw new GeminiImageError(
            `Gemini Image ${res.status}: ${txt.slice(0, 240)}`,
            res.status,
            txt
          );
        }
        lastErr = new GeminiImageError(
          `transient ${res.status}`,
          res.status,
          txt
        );
        // Backoff: 800ms, 2s
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1) ** 1.5));
        continue;
      }

      const data = await res.json();
      const candidate = data?.candidates?.[0];
      const imagePart = (candidate?.content?.parts ?? []).find(
        (p: { inline_data?: { data?: string; mime_type?: string } }) =>
          p?.inline_data?.data
      );
      const inline = imagePart?.inline_data;
      if (!inline?.data) {
        throw new GeminiImageError(
          "Gemini returned no image in response",
          200,
          data
        );
      }
      return {
        buffer: Buffer.from(inline.data, "base64"),
        mimeType: inline.mime_type ?? "image/png",
      };
    } catch (err) {
      lastErr = err;
      if (attempt === retries) throw err;
    }
  }

  throw lastErr instanceof Error
    ? lastErr
    : new GeminiImageError("Gemini Image generation failed (unknown)");
}

// ─── Helper: Bild von URL/Lokalem Pfad als Buffer laden ────────────────────
// Mirror von loadImageAsDataUri in lib/pdf/assets.ts, aber gibt Buffer +
// mime statt data:URI String zurueck — Gemini braucht beide getrennt.
export async function loadImageAsReference(
  pathOrUrl: string
): Promise<GeminiImageReference | null> {
  function mimeFromExt(ext: string): GeminiImageReference["mimeType"] {
    const e = ext.toLowerCase().replace(/^\./, "");
    if (e === "png") return "image/png";
    if (e === "webp") return "image/webp";
    return "image/jpeg";
  }

  if (/^https?:\/\//i.test(pathOrUrl)) {
    try {
      const res = await fetch(pathOrUrl, { cache: "no-store" });
      if (!res.ok) return null;
      const buffer = Buffer.from(await res.arrayBuffer());
      const extMatch = pathOrUrl.match(/\.(jpe?g|png|webp)(?:[?#]|$)/i);
      return { buffer, mimeType: mimeFromExt(extMatch?.[1] ?? "jpeg") };
    } catch {
      return null;
    }
  }

  // Lokaler public-Pfad
  const path = await import("node:path");
  const fs = await import("node:fs/promises");
  const clean = pathOrUrl.replace(/^\//, "");
  const fullPath = path.join(process.cwd(), "public", clean);
  try {
    const buffer = await fs.readFile(fullPath);
    return { buffer, mimeType: mimeFromExt(path.extname(clean)) };
  } catch {
    return null;
  }
}
