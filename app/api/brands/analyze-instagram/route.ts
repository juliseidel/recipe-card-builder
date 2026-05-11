import { NextResponse } from "next/server";
import {
  ApifyError,
  scrapeInstagramProfile,
} from "@/lib/integrations/apify";
import { analyzeCreatorIdentity } from "@/lib/ai/analyze-creator-identity";
import { analyzeCreatorStyleFromText } from "@/lib/ai/analyze-creator-style";
import { getServerSupabase, hasServerSupabase } from "@/lib/supabase-server";

// Onboarding-Helper-Endpoint. Frontend tippt nur den Instagram-Handle,
// dieser Endpoint macht den Rest:
//
//   1. Apify scraped das Profil (Bio, Stats, Posts) + Avatar-URL
//   2. Avatar wird server-side runtergeladen + in den brand-avatars-Bucket
//      hochgeladen (sonst CORS-Probleme beim direkten Browser-Fetch)
//   3. Gemini 2.5 Flash analysiert Bio + Posts → strukturierte Brand-Felder
//   4. Response: { identity, avatarUrl, latestPosts } → Frontend befuellt
//      die Form-Felder, latestPosts gehen in PR 5 weiter fuer die
//      Brand-DNA-Vision-Analyse
//
// Vercel-Lambda: Apify (~10-20s) + Gemini-Identity-Flash (~3-5s) +
// Avatar-Upload (~2s) + Gemini-Text-Style-Flash (~3-5s) — parallel ~20-25s
// typisch. 60s gibt Headroom (PR 11: Pivot weg von Vision).

export const runtime = "nodejs";
export const maxDuration = 60;

const AVATAR_BUCKET = "brand-avatars";
const ACCEPTED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(req: Request) {
  if (!process.env.APIFY_TOKEN) {
    return NextResponse.json(
      { error: "Apify-Token ist nicht konfiguriert." },
      { status: 500 }
    );
  }
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "Gemini-API-Key ist nicht konfiguriert." },
      { status: 500 }
    );
  }
  if (!hasServerSupabase()) {
    return NextResponse.json(
      { error: "Supabase ist nicht konfiguriert." },
      { status: 500 }
    );
  }

  let body: { handle?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.handle || typeof body.handle !== "string") {
    return NextResponse.json(
      { error: "Bitte einen Instagram-Handle uebergeben." },
      { status: 400 }
    );
  }

  // ─── 1. Profil scrapen ──────────────────────────────────────────────────
  let profile;
  try {
    profile = await scrapeInstagramProfile(body.handle);
  } catch (err) {
    const status =
      err instanceof ApifyError && err.status === 401 ? 500 : 422;
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Konnte das Instagram-Profil nicht laden.",
        stage: "scrape",
      },
      { status }
    );
  }

  if (profile.isPrivate) {
    return NextResponse.json(
      {
        error:
          "Das Profil ist privat — Auto-Fill funktioniert nur fuer oeffentliche Accounts. Bitte manuell befuellen.",
        stage: "scrape",
      },
      { status: 422 }
    );
  }

  // ─── 2. Avatar uploaden ──────────────────────────────────────────────────
  // Wir laden das HD-Profile-Pic server-side (Instagram-CDN ist freundlich
  // mit Browser-User-Agents) und uploaden direkt in den brand-avatars
  // Bucket. So bekommt der Caller eine eigene Supabase-URL, die wir
  // langfristig kontrollieren — Instagram-CDN-URLs rotieren regelmaessig.
  let avatarUrl: string | null = null;
  if (profile.profilePicUrlHD) {
    try {
      avatarUrl = await uploadAvatarFromUrl(
        profile.profilePicUrlHD,
        profile.username
      );
    } catch (err) {
      console.warn(
        "[analyze-instagram] avatar upload failed",
        err instanceof Error ? err.message : err
      );
      // Best-effort: wenn der Avatar-Upload scheitert, der Rest des
      // Onboardings laeuft trotzdem durch — User kann manuell hochladen.
    }
  }

  // ─── 3. Identitaet + Style parallel ─────────────────────────────────────
  // Identity-Analyse: Gemini Flash, Bio + Captions → Brand-Felder (~3-5s)
  // Style-Selektion (PR 11): Text-basiert (kein Vision) — Gemini Flash
  //   waehlt aus 6 vorgefertigten Brand-Style-Templates anhand Bio +
  //   Captions + Hashtags. Falls Flash fail't: deterministic keyword
  //   match. Funktioniert IMMER, Style wird IMMER in brand.imageStyle
  //   gespeichert.
  const [identitySettled, styleSettled] = await Promise.allSettled([
    analyzeCreatorIdentity(profile),
    analyzeCreatorStyleFromText({ profile }),
  ]);

  if (identitySettled.status === "rejected") {
    return NextResponse.json(
      {
        error:
          identitySettled.reason instanceof Error
            ? identitySettled.reason.message
            : "Konnte das Profil nicht analysieren.",
        stage: "analyze",
        profile: {
          username: profile.username,
          fullName: profile.fullName,
          biography: profile.biography,
          followersCount: profile.followersCount,
        },
        avatarUrl,
      },
      { status: 422 }
    );
  }

  const identity = identitySettled.value;
  const styleResult =
    styleSettled.status === "fulfilled" ? styleSettled.value : null;
  const imageStyle = styleResult?.style ?? null;
  if (styleSettled.status === "rejected") {
    console.warn(
      "[analyze-instagram] style selection failed unexpectedly:",
      styleSettled.reason instanceof Error
        ? styleSettled.reason.message
        : styleSettled.reason
    );
  } else if (styleResult) {
    console.log(
      `[analyze-instagram] style picked: ${styleResult.templateId} (${styleResult.source})`
    );
  }

  return NextResponse.json({
    ok: true,
    identity,
    avatarUrl,
    // imageStyle: optional — kann null sein wenn Vision-Analyse fehlschlug
    // oder zu wenige Bilder verfuegbar waren (<3). Frontend speichert es
    // wenn vorhanden in brand.imageStyle; Pipeline-Fallback fuer null.
    imageStyle,
    latestPosts: profile.latestPosts,
    raw: {
      handle: profile.username,
      followersCount: profile.followersCount,
      isVerified: profile.isVerified,
    },
  });
}

// Laedt das Instagram-Profile-Pic + uploaded es ins brand-avatars-Bucket.
// Mime-Detection ueber den Response-Header, Extension daraus abgeleitet.
// Path: `auto/{slug}-{ts}-{rand}.{ext}` — `auto/`-Prefix unterscheidet
// auto-uploaded Avatare von manuellen User-Uploads (`uploads/`).
async function uploadAvatarFromUrl(
  imageUrl: string,
  usernameSlug: string
): Promise<string | null> {
  const fetchRes = await fetch(imageUrl, {
    headers: {
      // Instagram-CDN serviert mit normalen Browser-UAs ohne Probleme.
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    },
  });
  if (!fetchRes.ok) {
    throw new Error(
      `Avatar-Download failed: HTTP ${fetchRes.status} ${fetchRes.statusText}`
    );
  }
  const contentType =
    fetchRes.headers.get("content-type")?.split(";")[0]?.trim() ||
    "image/jpeg";
  if (!ACCEPTED_AVATAR_TYPES.includes(contentType)) {
    throw new Error(
      `Avatar-Type nicht unterstuetzt: ${contentType}`
    );
  }
  const buffer = Buffer.from(await fetchRes.arrayBuffer());

  const supabase = getServerSupabase();
  // Bucket idempotent anlegen (cover-upload-Pattern uebernommen).
  await supabase.storage.createBucket(AVATAR_BUCKET, {
    public: true,
    fileSizeLimit: 8 * 1024 * 1024,
    allowedMimeTypes: ACCEPTED_AVATAR_TYPES,
  });

  const ext = extensionFor(contentType);
  const path = `auto/${usernameSlug}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;

  const upload = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, buffer, {
      contentType,
      upsert: false,
      cacheControl: "31536000",
    });
  if (upload.error) {
    throw new Error(`Storage-Upload failed: ${upload.error.message}`);
  }
  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function extensionFor(mime: string): string {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/jpeg":
    default:
      return "jpg";
  }
}
