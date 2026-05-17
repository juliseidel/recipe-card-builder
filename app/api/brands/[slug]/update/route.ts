import { NextResponse } from "next/server";
import { upsertBrandData, loadBrand } from "@/lib/custom-brands-server";
import type { Brand } from "@/lib/brands";

// PATCH-Endpoint zum Updaten eines Brands. Wird von der Brand-Settings-
// Page (/[brand]/settings) genutzt damit der User nachtraeglich Felder
// wie signature, gender, bio, tagline editieren kann — z.B. wenn die
// Gemini-Identity-Analyse beim Onboarding daneben lag (typischer Fall:
// "Deine Martin" obwohl der Creator maennlich ist).
//
// Body: { patch: Partial<Brand> }
//
// Whitelist-Felder: nur die UI-edit-bare Subset darf hier rein, sonst
// koennte ein Bug im Frontend versehentlich computed Felder wie
// imageStyle/voiceProfile zerschiessen.

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ slug: string }> };

const ALLOWED_FIELDS: (keyof Brand)[] = [
  "name",
  "fullName",
  "bio",
  "tagline",
  "signature",
  "gender",
  "avatar",
  "stats",
  "tokens",
];

type Body = {
  patch: Partial<Brand>;
};

export async function POST(req: Request, { params }: RouteParams) {
  const { slug } = await params;
  if (!slug) {
    return NextResponse.json({ error: "Brand-Slug fehlt." }, { status: 400 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (!body?.patch || typeof body.patch !== "object") {
    return NextResponse.json(
      { error: "patch-Feld (Partial<Brand>) erforderlich." },
      { status: 400 }
    );
  }

  // Whitelist-Filter — nur erlaubte Felder durchlassen
  const cleanPatch: Partial<Brand> = {};
  for (const key of ALLOWED_FIELDS) {
    if (key in body.patch) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (cleanPatch as any)[key] = body.patch[key];
    }
  }

  if (Object.keys(cleanPatch).length === 0) {
    return NextResponse.json(
      { error: "Keine erlaubten Felder im Patch." },
      { status: 400 }
    );
  }

  try {
    await upsertBrandData(slug, cleanPatch);
  } catch (err) {
    return NextResponse.json(
      {
        error: `Update fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`,
      },
      { status: 500 }
    );
  }

  // Aktualisiertes Brand-Objekt zurueckgeben, damit der Client den State
  // ohne weiteren GET refreshen kann.
  const updated = await loadBrand(slug);
  return NextResponse.json({ ok: true, brand: updated });
}
