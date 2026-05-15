import { NextResponse } from "next/server";
import { loadAllBrands } from "@/lib/custom-brands-server";
import {
  analyzeVoiceProfileFromCaptions,
} from "@/lib/ai/analyze-voice-profile";
import { updateBrandVoiceProfile } from "@/lib/custom-brands-server";
import { getRecipeReelsForBrand } from "@/lib/creator-reels-server";

// Admin-Endpoint: Proaktiver Voice-Profile-Backfill fuer alle Brands,
// die noch kein Profil haben (Biene, Julia, frueh angelegte Custom-Brands).
//
// Hintergrund: Voice-Profile werden seit Mai 2026 beim Onboarding
// automatisch generiert. Brands, die VORHER angelegt wurden, kriegen
// das Profil sonst nur via Lazy-Backfill beim ersten Pack-Gen — was
// ~3-5s zusaetzliche Latenz beim ersten Klick bedeutet. Dieser Endpoint
// erledigt das proaktiv: ein POST, alle Profile sind danach in DB.
//
// Auth: Bearer-Token mit ADMIN_RESEED_TOKEN (reusing existing).
//
// Body (optional):
//   { force?: boolean }  — true: auch fuer Brands neu generieren die schon
//                          ein Profil haben (z.B. Refresh nach 90 Tagen)
//   { onlySlugs?: string[] }  — nur diese Brands; sonst alle ohne Profil
//
// Response:
//   { processed: Array<{ slug, status: "ok" | "skipped" | "failed", reason? }> }

export const runtime = "nodejs";
export const maxDuration = 120;

type BackfillResult = {
  slug: string;
  status: "ok" | "skipped" | "failed";
  reason?: string;
  toneDescriptors?: string[];
  captionCount?: number;
};

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = process.env.ADMIN_RESEED_TOKEN;
  if (!token || auth !== `Bearer ${token}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { force?: boolean; onlySlugs?: string[] } = {};
  try {
    body = await req.json();
  } catch {
    // empty body → process all-without-profile
  }

  const brands = await loadAllBrands();
  const targetBrands = brands.filter((b) => {
    if (body.onlySlugs?.length && !body.onlySlugs.includes(b.slug)) return false;
    if (body.force) return true;
    return !b.voiceProfile;
  });

  if (targetBrands.length === 0) {
    return NextResponse.json({
      processed: [],
      message: "Keine Brands zu backfillen — alle haben schon ein Voice-Profil. Mit `force: true` neu generieren.",
    });
  }

  const results: BackfillResult[] = [];

  // Sequenziell durchgehen — paralleler Gemini-Burst wuerde Rate-Limits
  // riskieren und die Lambda-Dauer ist sowieso pro Brand ~3-5 s.
  for (const brand of targetBrands) {
    try {
      const reels = await getRecipeReelsForBrand(brand.slug);
      const captions = reels
        .map((r) => r.caption ?? "")
        .filter((c) => c.trim().length > 50)
        .slice(0, 15);

      if (captions.length < 5) {
        results.push({
          slug: brand.slug,
          status: "skipped",
          reason: `nur ${captions.length} verwertbare Captions in creator_reels`,
        });
        continue;
      }

      const profile = await analyzeVoiceProfileFromCaptions(captions, {
        username: brand.handle.replace(/^@/, ""),
        biography: brand.bio,
      });

      await updateBrandVoiceProfile(brand.slug, profile);

      results.push({
        slug: brand.slug,
        status: "ok",
        toneDescriptors: profile.toneDescriptors,
        captionCount: captions.length,
      });
    } catch (err) {
      results.push({
        slug: brand.slug,
        status: "failed",
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const okCount = results.filter((r) => r.status === "ok").length;
  const skipCount = results.filter((r) => r.status === "skipped").length;
  const failCount = results.filter((r) => r.status === "failed").length;

  return NextResponse.json({
    summary: `${okCount} ok, ${skipCount} skipped, ${failCount} failed`,
    processed: results,
  });
}
