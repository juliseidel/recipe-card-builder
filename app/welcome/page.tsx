import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/auth/server";
import { getBrand } from "@/lib/brands";
import { WelcomeAnimation } from "./welcome-animation";

// Welcome-Screen — der Wow-Moment direkt nach dem Login. Zeigt eine kurze
// Brand-Animation (Logo → Eyebrow → Creator-Name → "Studio öffnet…") und
// redirected danach in den Brand-Workspace.
//
// Architektur:
//   - Server Component liest auth.getUser() und ermittelt das Ziel
//   - Client-Component WelcomeAnimation spielt die Animation und ruft
//     router.push() nach Ablauf
//   - Wenn user.metadata.brand_slug fehlt (z. B. Test-Account ohne
//     Profil), fallen wir auf /biene zurück — der Pflicht-Lieferung-
//     Workspace ist immer da
//
// Edge-cases:
//   - Nicht-authentifiziert hier zu landen: passiert nur wenn jemand
//     /welcome direkt aufruft. Middleware sieht es als public-Path NICHT
//     (im Allowlist nicht enthalten), also redirected sie zu /login.
//     Diese Page ist defensiv und prüft trotzdem.

export const dynamic = "force-dynamic";

type WelcomePageProps = {
  searchParams: Promise<{ redirect?: string }>;
};

export default async function WelcomePage({ searchParams }: WelcomePageProps) {
  const { redirect: redirectParam } = await searchParams;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Brand-slug from user metadata. Set when the account is created (or
  // backfilled in the Supabase-Auth dashboard). Falls back to "biene"
  // because that's the only seeded brand right now — for Phase-2
  // multi-tenant we'll require this metadata to be set.
  const brandSlug = (user.user_metadata?.brand_slug as string) || "biene";
  const brand = getBrand(brandSlug);
  const displayName =
    (user.user_metadata?.display_name as string) ||
    brand?.name ||
    "Creator";
  const handle = brand?.handle ?? "";

  // Final destination. Either the protected route the user was trying to
  // hit before login, or the brand workspace.
  const finalTarget =
    redirectParam && redirectParam.startsWith("/") && !redirectParam.startsWith("/login")
      ? redirectParam
      : `/${brandSlug}`;

  return (
    <WelcomeAnimation
      displayName={displayName}
      handle={handle}
      brandTokens={brand?.tokens ?? null}
      finalTarget={finalTarget}
    />
  );
}
