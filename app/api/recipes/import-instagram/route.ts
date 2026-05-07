import { NextResponse } from "next/server";
import {
  ApifyError,
  normalizeInstagramUrl,
  scrapeInstagramPost,
} from "@/lib/integrations/apify";
import { parseRecipeFromCaption } from "@/lib/ai/parse-instagram";

// Beide Calls (Apify + Gemini) sind I/O-bound, brauchen aber Node.js
// (kein Edge — Apify-API + Gemini-API funktionieren auch dort, aber wir
// halten es konsistent mit den anderen API-Routes des Projekts).
export const runtime = "nodejs";
// Apify (synchron) + Gemini (Schema-Parsing) zusammen: typischerweise 8-25 s,
// im Worst Case bis ~40 s. 60 s gibt uns Puffer für Vercel-Lambda.
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const rawUrl = body?.url;
  if (!rawUrl || typeof rawUrl !== "string") {
    return NextResponse.json(
      { error: "Bitte schick eine 'url' im Body mit." },
      { status: 400 }
    );
  }

  const normalized = normalizeInstagramUrl(rawUrl);
  if (!normalized) {
    return NextResponse.json(
      {
        error:
          "Das ist keine gültige Instagram-URL. Erwartet: instagram.com/p/... oder /reel/...",
      },
      { status: 400 }
    );
  }

  // 1) Apify: Caption + Bild + Username holen.
  let post;
  try {
    post = await scrapeInstagramPost(normalized);
  } catch (err) {
    const status =
      err instanceof ApifyError && err.status === 401
        ? 500 // Server-Config-Problem, nicht der User
        : 422;
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Konnte den Instagram-Post nicht laden.",
        stage: "scrape",
      },
      { status }
    );
  }

  // 2) Gemini: Caption → strukturiertes Rezept.
  const parsed = await parseRecipeFromCaption(post.caption, {
    username: post.ownerUsername,
  });

  if (!parsed.ok) {
    return NextResponse.json(
      {
        error: parsed.error,
        stage: "parse",
        // Wir geben die Caption + Source-Info trotzdem zurück, damit das UI
        // dem User wenigstens Bild + Link anbieten kann statt komplett leer.
        source: {
          url: post.postUrl,
          username: post.ownerUsername,
          imageUrl: post.displayUrl,
          captionPreview: post.caption.slice(0, 280),
        },
      },
      { status: 422 }
    );
  }

  return NextResponse.json({
    ok: true,
    recipe: parsed.recipe,
    source: {
      url: post.postUrl,
      username: post.ownerUsername,
      imageUrl: post.displayUrl,
      type: post.type,
    },
  });
}
