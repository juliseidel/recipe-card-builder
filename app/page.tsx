import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/auth/server";

// Eingangs-Punkt der App. Frueher die Workspaces-Uebersicht (Multi-Brand-
// Grid). Mit Auth + Welcome-Flow ist das hier nur noch ein Routing-Punkt:
//   - Nicht eingeloggt → /login (Middleware faengt das eigentlich schon
//     ab; das hier ist defensiv)
//   - Eingeloggt → direkt in den eigenen Brand-Workspace
//
// Die alte BrandCard-Grid Logik ist nicht weg — sie lebt jetzt
// pro-creator unter /[brand]. Multi-Tenant-Workspace-Discovery ist
// Phase 2 (Vollzeit-Phase nach Test-Week).

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Brand-Slug aus user.metadata. Per-Account beim Anlegen gesetzt.
  // Fallback "biene" weil das aktuell der einzige seeded Brand ist —
  // unbekannte User landen also im Pflicht-Lieferung-Workspace.
  const brandSlug = (user.user_metadata?.brand_slug as string) || "biene";
  redirect(`/${brandSlug}`);
}
