import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/auth/server";
import { loadAllBrands } from "@/lib/custom-brands-server";
import { SiteHeader } from "@/components/site-header";
import { BrandHubCard } from "@/components/brand-hub-card";
import { NewBrandCard } from "@/components/new-brand-card";

// Workspace-Hub — der neue Einstiegspunkt nach dem Login. Frueher hat
// diese Page den User direkt in seinen `user_metadata.brand_slug`
// redirected (alter Single-Tenant-Flow). Jetzt ist es ein internes
// Team-Tool: ein User kann mehrere Creator betreuen, und der Hub listet
// alle verfuegbaren Workspaces.
//
// Quellen-Mix:
//   - Code-Brands (lib/brands.ts) — aktuell nur Biene, Pilot-Workspace mit
//     5 kuratierten Packs + 37 Rezepten unangetastet
//   - DB-Brands (Supabase brands-Tabelle) — vom Team via /new-brand
//     onboardete neue Creator (PR 3 liefert das Onboarding-UI)
//
// Klick-Flow: Card → /welcome?brand=<slug> → Welcome-Animation laeuft mit
// den Brand-Tokens → /[brand] Workspace. So bekommt jeder Creator den
// gleichen cinematischen Eintritt, nicht nur Biene.

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Workspace-Hub · Recipe Card Builder",
  description:
    "Wähle einen Creator-Workspace oder lege einen neuen an. Internes Team-Tool für die Verwaltung mehrerer Recipe-Pack-Workspaces.",
};

export default async function HubPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const brands = await loadAllBrands();
  const displayName =
    (user.user_metadata?.display_name as string) ||
    user.email?.split("@")[0] ||
    "Team";

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <SiteHeader />

      <main className="flex-1">
        <section className="mx-auto max-w-[1200px] px-6 pt-24 pb-10 lg:px-10 lg:pt-32 lg:pb-14">
          <div className="flex flex-col gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
              Workspace-Hub
            </span>
            <h1 className="font-display text-[44px] leading-[1.04] tracking-[-0.015em] text-ink lg:text-[56px]">
              Hi {displayName} — wähle einen Creator.
            </h1>
            <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-ink-muted">
              Jeder Creator hat seinen eigenen Workspace mit Recipe-Packs,
              Karten und der vollen KI-Pipeline. Wähle einen Workspace zum
              Arbeiten — oder leg einen neuen Creator an.
            </p>
          </div>

          <div className="mt-8 flex items-center gap-3 text-[12px] text-ink-subtle">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1"
              style={{
                borderColor: "rgba(26, 18, 11, 0.12)",
                background: "rgba(255,255,255,0.5)",
              }}
            >
              <span className="size-1.5 rounded-full bg-honey" />
              {brands.length}{" "}
              {brands.length === 1 ? "Workspace" : "Workspaces"} verfügbar
            </span>
            <span aria-hidden>·</span>
            <span>Klick einen Creator, um in seinen Workspace einzutreten.</span>
          </div>
        </section>

        <section className="mx-auto max-w-[1200px] px-6 pb-32 lg:px-10">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {brands.map((brand) => {
              const hasStats = brand.packCount > 0 || brand.recipeCount > 0;
              return (
                <BrandHubCard
                  key={brand.slug}
                  brand={brand}
                  packCount={hasStats ? brand.packCount : undefined}
                  recipeCount={hasStats ? brand.recipeCount : undefined}
                  badge={
                    brand.slug === "biene" ? "Pilot Workspace" : undefined
                  }
                />
              );
            })}
            <NewBrandCard />
          </div>
        </section>
      </main>

      <footer
        className="border-t bg-surface"
        style={{ borderColor: "rgba(26, 18, 11, 0.08)" }}
      >
        <div className="mx-auto flex max-w-[1200px] flex-col items-start justify-between gap-3 px-6 py-7 text-[12px] text-ink-muted sm:flex-row sm:items-center lg:px-10">
          <p>
            <span className="text-ink">Recipe Card Builder</span> · Internes
            Studio für Team & Creator-Onboarding
          </p>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em]">
            {user.email}
          </p>
        </div>
      </footer>
    </div>
  );
}
