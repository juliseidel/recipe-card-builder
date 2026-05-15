import { NextResponse, after } from "next/server";
import { updateCustomPackData } from "@/lib/custom-packs-server";
import { revalidatePath } from "next/cache";
import type { Pack, PackMood, CardLayout } from "@/lib/packs";

// Pack-Editor-Backend. Patcht editierbare Felder eines Custom-Packs und
// markiert die geaenderten Felder als "manuell editiert" — damit ueberlebt
// die User-Edit den naechsten Auto-Sync-Pass (bei Recipe-Add/Delete).
//
// Body:
//   {
//     patch: Partial<Pack>,
//     editedFields: string[]  // welche Felder soll Auto-Sync nicht mehr anfassen
//   }
//
// editedFields ist explizit damit der Client entscheidet, was als "User-Edit"
// gelten soll. Beispiel: Re-Roll-Button generiert das Feld neu UND will dass
// es weiter Auto-Sync-faehig bleibt → editedFields nicht angeben.
// Direkter Form-Save will dass es eingefroren bleibt → editedFields setzen.

export const runtime = "nodejs";
export const maxDuration = 30;

type Body = {
  patch?: Partial<Pack>;
  editedFields?: string[];
  brandSlug?: string;
  packSlug?: string;
};

type RouteParams = { params: Promise<{ id: string }> };

const ALLOWED_FIELDS = new Set<keyof Pack>([
  "title",
  "subtitle",
  "tagline",
  "description",
  "category",
  "coverImage",
  "forewordImage",
  "foreword",
  "mood",
  "displayFont",
  "cardLayout",
]);

const VALID_FONTS: Pack["displayFont"][] = ["fraunces", "dm-serif", "inter-tight"];
const VALID_LAYOUTS: CardLayout[] = [
  "editorial",
  "patisserie",
  "minimal",
  "sport",
  "dashboard",
  "vital",
  "amber",
  "newspaper",
  "restaurant",
  "studio",
  "feature",
];

function sanitizeMood(mood: unknown): PackMood | undefined {
  if (!mood || typeof mood !== "object") return undefined;
  const m = mood as Partial<PackMood>;
  if (!m.background || !m.accent || !m.ink || !m.inkSoft) return undefined;
  return {
    background: String(m.background),
    accent: String(m.accent),
    ink: String(m.ink),
    inkSoft: String(m.inkSoft),
    ...(m.surface ? { surface: m.surface } : {}),
  };
}

function sanitizePatch(input: Partial<Pack>): Partial<Pack> {
  const out: Partial<Pack> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!ALLOWED_FIELDS.has(key as keyof Pack)) continue;
    if (key === "mood") {
      const sanitized = sanitizeMood(value);
      if (sanitized) out.mood = sanitized;
      continue;
    }
    if (key === "displayFont") {
      if (typeof value === "string" && VALID_FONTS.includes(value as Pack["displayFont"])) {
        out.displayFont = value as Pack["displayFont"];
      }
      continue;
    }
    if (key === "cardLayout") {
      if (typeof value === "string" && VALID_LAYOUTS.includes(value as CardLayout)) {
        out.cardLayout = value as CardLayout;
      }
      continue;
    }
    if (key === "foreword") {
      if (value && typeof value === "object") {
        const f = value as Partial<NonNullable<Pack["foreword"]>>;
        out.foreword = {
          greeting: f.greeting?.trim() ?? "",
          story: f.story?.trim() ?? "",
          signoff: f.signoff?.trim() ?? "",
          ...(f.outro ? { outro: f.outro.trim() } : {}),
        };
      }
      continue;
    }
    if (typeof value === "string") {
      // Generic string-Felder (title, subtitle, ...) trim + length-Cap
      const trimmed = value.trim().slice(0, 4000);
      (out as Record<string, string>)[key] = trimmed;
    }
  }
  return out;
}

export async function POST(req: Request, { params }: RouteParams) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Pack-ID fehlt." }, { status: 400 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (!body.patch || typeof body.patch !== "object") {
    return NextResponse.json({ error: "patch fehlt." }, { status: 400 });
  }

  const cleanPatch = sanitizePatch(body.patch);
  if (Object.keys(cleanPatch).length === 0) {
    return NextResponse.json({ error: "Keine gueltigen Felder im patch." }, { status: 400 });
  }

  const cleanEdited = Array.isArray(body.editedFields)
    ? body.editedFields.filter((f): f is string => typeof f === "string" && f.length > 0)
    : [];

  const updated = await updateCustomPackData(id, cleanPatch, {
    newlyEditedFields: cleanEdited,
  });
  if (!updated) {
    return NextResponse.json(
      { error: "Pack konnte nicht aktualisiert werden — vermutlich kein Custom-Pack." },
      { status: 404 }
    );
  }

  // Cache-Revalidation fire-and-forget — Pack-Detail-Page + Brand-Grid
  // sollen den frischen Stand zeigen.
  if (body.brandSlug && body.packSlug) {
    after(async () => {
      try {
        revalidatePath(`/${body.brandSlug}/${body.packSlug}`);
        revalidatePath(`/${body.brandSlug}`);
      } catch (err) {
        console.warn("[packs/update] revalidate failed", err);
      }
    });
  }

  return NextResponse.json({
    ok: true,
    pack: updated,
  });
}
