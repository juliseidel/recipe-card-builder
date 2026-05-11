import { NextResponse } from "next/server";
import {
  getSuggestionById,
  updateSuggestionStatus,
} from "@/lib/creator-reels-server";
import { buildPackFromReels, pickMoodById } from "@/lib/reel-library/pack-builder";
import { brandMoodPresets } from "@/lib/brand-presets";

// Annahme eines Pack-Vorschlags. Triggert die volle Pack-Erstellungs-
// Pipeline: alle zugeordneten Reels werden geparst → Recipe-Rows + Pack-
// Row entstehen → Cover-Image + Heroes async im Hintergrund.
//
// Lambda-Limit 300s: 12 Reels parallel parsing (~10s) + DB-Inserts (~2s).
// Hero/Cover-Generation triggert nur via fire-and-forget Internal-Fetch,
// die laufen in separaten Lambdas.

export const runtime = "nodejs";
export const maxDuration = 60;

// Heuristik: aus dem Pack-Category-Label ein Mood-Preset ableiten, damit
// das frische Pack visuell zur Stimmung passt. UI kann das spaeter
// ueberschreiben.
function moodForCategory(category: string): {
  packMood: ReturnType<typeof pickMoodById>;
  cardLayout: import("@/lib/packs").CardLayout;
  displayFont: import("@/lib/packs").Pack["displayFont"];
} {
  const c = category.toLowerCase();
  if (c.includes("back") || c.includes("dessert") || c.includes("suess") || c.includes("süß")) {
    return {
      packMood: pickMoodById("lavender"),
      cardLayout: "patisserie",
      displayFont: "fraunces",
    };
  }
  if (c.includes("snack") || c.includes("minimal")) {
    return {
      packMood: pickMoodById("mint"),
      cardLayout: "minimal",
      displayFont: "fraunces",
    };
  }
  if (c.includes("vital") || c.includes("volumen") || c.includes("protein") || c.includes("healthy")) {
    return {
      packMood: pickMoodById("sage"),
      cardLayout: "vital",
      displayFont: "inter-tight",
    };
  }
  if (c.includes("meal") || c.includes("prep") || c.includes("woche")) {
    return {
      packMood: pickMoodById("sky"),
      cardLayout: "dashboard",
      displayFont: "inter-tight",
    };
  }
  if (c.includes("top") || c.includes("favorit") || c.includes("most")) {
    return {
      packMood: pickMoodById("amber"),
      cardLayout: "amber",
      displayFont: "fraunces",
    };
  }
  // Default: warm-honey + editorial
  return {
    packMood: pickMoodById("honey"),
    cardLayout: "editorial",
    displayFont: "fraunces",
  };
}

function slugifyPack(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: RouteParams) {
  // brandMoodPresets ist hier nicht direkt genutzt — ein Hinweis fuer den
  // Code-Reader, dass das Mood-Picking ueber pickMoodById (pack-presets)
  // statt brand-presets laeuft.
  void brandMoodPresets;

  const { id } = await params;
  const suggestion = await getSuggestionById(id);
  if (!suggestion) {
    return NextResponse.json(
      { error: "Vorschlag nicht gefunden." },
      { status: 404 }
    );
  }
  if (suggestion.status !== "pending") {
    return NextResponse.json(
      { error: `Vorschlag ist bereits ${suggestion.status}.` },
      { status: 409 }
    );
  }

  const origin = new URL(req.url).origin;
  const { packMood, cardLayout, displayFont } = moodForCategory(
    suggestion.category
  );

  const baseSlug = slugifyPack(suggestion.title) || "pack";
  const slug = `${baseSlug}-${Date.now().toString(36).slice(-4)}`;

  const result = await buildPackFromReels({
    brandSlug: suggestion.brand_slug,
    reelIds: suggestion.reel_ids,
    pack: {
      slug,
      title: suggestion.title,
      subtitle: suggestion.subtitle,
      tagline: suggestion.tagline,
      description: suggestion.description,
      category: suggestion.category,
      mood: packMood,
      displayFont,
      cardLayout,
    },
    origin,
  });

  if (!result) {
    return NextResponse.json(
      {
        error:
          "Pack konnte nicht erstellt werden — zu wenige Reels parsbar oder DB-Fehler.",
      },
      { status: 500 }
    );
  }

  await updateSuggestionStatus(id, "accepted", result.packId);

  return NextResponse.json({
    status: "accepted",
    packId: result.packId,
    packSlug: result.packSlug,
    recipeCount: result.recipeCount,
    parseFailures: result.parseFailures,
    brandSlug: suggestion.brand_slug,
  });
}
