import { notFound, redirect } from "next/navigation";
import { loadBrand } from "@/lib/custom-brands-server";
import { getCustomPackByIdServer } from "@/lib/custom-packs-server";
import { getServerSupabase, hasServerSupabase } from "@/lib/supabase-server";
import { PackEditor } from "@/components/pack-editor";
import type { Pack } from "@/lib/packs";

// Pack-Editor-Route. Erlaubt manuelle Bearbeitung aller Pack-Felder fuer
// Custom-Packs. Kuratierte Bienen-Packs sind hier nicht editierbar — die
// liegen in lib/packs.ts und sind read-only.

type Params = Promise<{ brand: string; pack: string }>;

export const dynamic = "force-dynamic";

export default async function PackEditPage({ params }: { params: Params }) {
  const { brand: brandSlug, pack: packSlug } = await params;

  const brand = await loadBrand(brandSlug);
  if (!brand) notFound();

  // Wir brauchen die DB-Row-ID fuer die Update/Regenerate-Routes — die
  // gibt's nur fuer Custom-Packs. Kuratierte Packs leiten zur Pack-Detail
  // zurueck (mit Hinweis).
  if (!hasServerSupabase()) {
    redirect(`/${brandSlug}/${packSlug}?error=db-not-configured`);
  }
  const row = await getCustomPackByIdServer(brandSlug, packSlug);
  if (!row) {
    // Kuratierter Pack oder existiert nicht — beides geht zurueck
    redirect(`/${brandSlug}/${packSlug}`);
  }

  // Pack-Slug erzwingen damit der Editor ihn anzeigen kann (DB-Row hat ihn
  // auf der Row-Level, nicht in data — wir injizieren ihn ins Object).
  const packWithSlug: Pack = {
    ...row.pack,
    slug: row.pack.slug ?? packSlug,
    brandSlug: row.pack.brandSlug ?? brandSlug,
  };

  return <PackEditor brand={brand} pack={packWithSlug} packId={row.id} />;
}
