import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/auth/server";
import { getBrand } from "@/lib/brands";
import { WelcomeAnimation } from "./welcome-animation";

// Welcome-Screen — der Wow-Moment direkt nach dem Login. Zeigt eine
// cinematische Brand-Animation mit dem Creator-Foto und seinem Namen,
// dann redirected in den Brand-Workspace.
//
// Architektur:
//   - Server Component liest auth.getUser() und ermittelt das Ziel
//   - Client-Component WelcomeAnimation spielt die Animation und ruft
//     router.push() nach Ablauf
//   - Brand-Daten (Avatar, Name, Handle, Tagline, Tokens) kommen aus
//     lib/brands.ts via brand_slug aus user.metadata
//   - Wenn user.metadata.brand_slug fehlt, fallen wir auf /biene zurück

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

  const brandSlug = (user.user_metadata?.brand_slug as string) || "biene";
  const brand = getBrand(brandSlug);
  const displayName =
    (user.user_metadata?.display_name as string) ||
    brand?.name ||
    "Creator";

  const finalTarget =
    redirectParam &&
    redirectParam.startsWith("/") &&
    !redirectParam.startsWith("/login")
      ? redirectParam
      : `/${brandSlug}`;

  return (
    <WelcomeAnimation
      displayName={displayName}
      handle={brand?.handle ?? ""}
      tagline={brand?.tagline ?? ""}
      avatarUrl={brand?.avatar ?? null}
      brandTokens={brand?.tokens ?? null}
      finalTarget={finalTarget}
    />
  );
}
