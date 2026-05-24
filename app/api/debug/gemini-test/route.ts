import { NextResponse } from "next/server";

// Diagnostic endpoint — sticht direkt Gemini 2.5 Flash Image mit einem
// minimalen Test-Prompt (kein Reference-Image). Returnt die rohe
// HTTP-Response damit wir sehen ob Endpoint, Auth, Body-Schema, oder
// API-Key das Problem ist. Reine Debug-Hilfe, kann nach Fix wieder weg.
//
// Aufruf: GET /api/debug/gemini-test (Browser oder curl, Preview-Auth
// per SSO-Cookie reicht).

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;
  const result: Record<string, unknown> = {
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey?.length ?? 0,
  };

  if (!apiKey) {
    return NextResponse.json(
      { ...result, error: "GEMINI_API_KEY is not set" },
      { status: 500 }
    );
  }

  const endpoint =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent";

  const body = {
    contents: [
      {
        parts: [
          {
            text: "A simple cinematic photograph of a single ripe yellow banana on a wooden cutting board, soft natural light, square 1:1 composition.",
          },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: {
        aspectRatio: "1:1",
      },
    },
  };

  result.endpoint = endpoint;
  result.requestBody = body;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
    });

    result.status = res.status;
    result.statusText = res.statusText;

    const text = await res.text();
    // Wenn JSON: parse + filter inlineData/data (too long), sonst raw text
    try {
      const data = JSON.parse(text);
      // Maskiere base64-Image-Bytes damit der JSON-Output lesbar bleibt
      const stripBase64 = (obj: unknown): unknown => {
        if (Array.isArray(obj)) return obj.map(stripBase64);
        if (obj && typeof obj === "object") {
          const out: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
            if (
              (k === "data" || k === "bytesBase64Encoded") &&
              typeof v === "string" &&
              v.length > 200
            ) {
              out[k] = `<base64 ${v.length} chars>`;
            } else {
              out[k] = stripBase64(v);
            }
          }
          return out;
        }
        return obj;
      };
      result.responseJson = stripBase64(data);
    } catch {
      result.responseRawText = text.slice(0, 2000);
    }

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    result.threwError = (err as Error).message;
    result.stack = (err as Error).stack?.split("\n").slice(0, 8).join("\n");
    return NextResponse.json(result, { status: 500 });
  }
}
