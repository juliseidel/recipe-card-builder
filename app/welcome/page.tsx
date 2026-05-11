import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/auth/server";
import { loadBrand } from "@/lib/custom-brands-server";
import { WelcomeAnimation } from "./welcome-animation";

// Welcome-Screen — der cinematische Brand-Moment beim Eintritt in einen
// Workspace. Frueher (Single-Tenant) wurde die Page direkt nach dem Login
// aufgerufen und las den Brand aus `user.metadata.brand_slug`. Im neuen
// Multi-Tenant-Flow stoesst der Hub die Animation an: Card-Klick →
// `/welcome?brand=<slug>` → Animation → `/[brand]`.
//
// Quelle der Brand-Daten ist `loadBrand(slug)` — checked beide Quellen
// (Code wie Biene + DB wie spaeter onboardete Creator). Display-Name fuer
// die Eyebrow-Anrede ist der Brand-Name, nicht mehr der eingeloggte User
// (es ist ja ein Team-Tool — der Eintritt in "Bienes Workspace" soll
// sich nach Bienes Brand anfuehlen, nicht nach Julian).

export const dynamic = "force-dynamic";

type WelcomePageProps = {
  searchParams: Promise<{ brand?: string; redirect?: string }>;
};

export default async function WelcomePage({ searchParams }: WelcomePageProps) {
  const { brand: brandSlug, redirect: redirectParam } = await searchParams;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Kein Brand-Param? Direkt zum Hub — z. B. wenn jemand /welcome ohne
  // Query von einer alten Lesezeichen-URL aufruft, oder wenn das Onboarding
  // den Param vergessen hat.
  if (!brandSlug) {
    redirect("/");
  }

  const brand = await loadBrand(brandSlug);
  // Brand-Slug existiert nicht (geloescht, vertippt)? Zurueck zum Hub mit
  // dem urspruenglichen Redirect-Target falls vorhanden — der Hub zeigt
  // dann alle realen Workspaces.
  if (!brand) {
    redirect("/");
  }

  // Sichere Redirect-Target-Auflösung: explizit gesetzter `redirect`-Param
  // (z. B. wenn der User vor dem Login eine Deep-Link wie
  // `/biene/feierabend-klassiker/blech-pasta` aufgerufen hat) hat Vorrang.
  // Sonst landet die Animation am Workspace-Root des gewaehlten Brands.
  const finalTarget =
    redirectParam &&
    redirectParam.startsWith("/") &&
    !redirectParam.startsWith("/login") &&
    !redirectParam.startsWith("/welcome")
      ? redirectParam
      : `/${brand.slug}`;

  return (
    <WelcomeAnimation
      displayName={brand.name}
      handle={brand.handle}
      tagline={brand.tagline}
      avatarUrl={brand.avatar}
      brandTokens={brand.tokens}
      finalTarget={finalTarget}
    />
  );
}
