import { NextResponse, after } from "next/server";
import {
  getSuggestionById,
  updateSuggestionStatus,
  getReelsByIds,
} from "@/lib/creator-reels-server";
import {
  buildPackFromReels,
  pickMoodById,
  triggerEnrichForBuiltPack,
} from "@/lib/reel-library/pack-builder";
import { brandMoodPresets } from "@/lib/brand-presets";
import { loadBrand } from "@/lib/custom-brands-server";
import { generatePackMeta } from "@/lib/ai/generate-pack-meta";
import type { CardLayout } from "@/lib/packs";

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

// Valid layout-IDs gemaess CardLayout-Typ in lib/packs.ts. Wir akzeptieren
// einen optionalen layout-Param im Body und prüfen ihn gegen diese Liste.
// WICHTIG: muss exakt CardLayout enum aus lib/packs.ts spiegeln, sonst
// werden gueltige Layouts vom UI ignoriert und auf default zurueckfallen.
const VALID_LAYOUTS: readonly CardLayout[] = [
  "editorial",
  "vital",
  "minimal",
  "patisserie",
  "amber",
  "dashboard",
  "sport",
  "newspaper",
  "restaurant",
] as const;

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

  // Optional: Body kann ein layout-Override mitschicken. Wenn nicht: aus
  // category abgeleitet (moodForCategory-Heuristik unten).
  let overrideLayout: CardLayout | null = null;
  try {
    const body = await req.json().catch(() => null);
    if (body && typeof body.layout === "string") {
      if ((VALID_LAYOUTS as readonly string[]).includes(body.layout)) {
        overrideLayout = body.layout as CardLayout;
      }
    }
  } catch {
    // No body — alles default.
  }

  const origin = new URL(req.url).origin;
  const { packMood, cardLayout, displayFont } = moodForCategory(
    suggestion.category
  );

  const baseSlug = slugifyPack(suggestion.title) || "pack";
  const slug = `${baseSlug}-${Date.now().toString(36).slice(-4)}`;

  // Texte aus der Suggestion werden mit der neuen Brand-Voice-Pipeline
  // regeneriert, falls moeglich. Suggestions, die vor der Pipeline-V2
  // generiert wurden, klingen sonst nach generischer KI — und der User
  // wuerde den schlechten Text uebernehmen ohne es zu merken. Re-Generate
  // ist non-blocking: bei Fehler oder fehlenden Reels fallen wir auf den
  // gespeicherten Suggestion-Text zurueck.
  let finalTitle = suggestion.title;
  let finalSubtitle = suggestion.subtitle;
  let finalTagline = suggestion.tagline;
  let finalDescription = suggestion.description;
  let finalCategory = suggestion.category;
  try {
    const brand = await loadBrand(suggestion.brand_slug);
    const reels = await getReelsByIds(suggestion.reel_ids);
    if (brand && reels.length >= 3) {
      const meta = await generatePackMeta(reels, brand);
      finalTitle = meta.title || finalTitle;
      finalSubtitle = meta.subtitle || finalSubtitle;
      finalTagline = meta.tagline || finalTagline;
      finalDescription = meta.description || finalDescription;
      finalCategory = meta.category || finalCategory;
    }
  } catch (err) {
    console.warn(
      "[pack-suggestions/accept] re-generate meta failed (fallback to stored suggestion text):",
      err instanceof Error ? err.message : err
    );
  }

  const result = await buildPackFromReels({
    brandSlug: suggestion.brand_slug,
    reelIds: suggestion.reel_ids,
    pack: {
      slug,
      title: finalTitle,
      subtitle: finalSubtitle,
      tagline: finalTagline,
      description: finalDescription,
      category: finalCategory,
      mood: packMood,
      displayFont,
      cardLayout: overrideLayout ?? cardLayout,
    },
    origin,
    // Cover-Reuse: das beim Onboarding bereits generierte Suggestion-Cover
    // wird übernommen, statt ein neues Flux-Cover beim Pack-Akzeptieren zu
    // bauen. Spart ~$0.15 + ~15s Wartezeit. Wenn cover_url null ist (Cover-
    // Gen noch nicht durch), generiert /api/packs/enrich frisch nach.
    presetCoverImage: suggestion.cover_url ?? undefined,
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

  // Enrich-Calls NACH der Response triggern. WICHTIG: after() statt
  // fire-and-forget — sonst wuerde Vercel die Lambda terminate'n bevor
  // die HTTP-Calls vollstaendig raus sind. Pack-Cover (wenn nicht
  // presetCoverImage) + alle Recipe-Heroes laufen dann in separaten
  // Lambdas parallel weiter.
  after(async () => {
    try {
      await triggerEnrichForBuiltPack(
        origin,
        result.packId,
        result.insertedRecipeIds
      );
    } catch (err) {
      console.error("[pack-suggestions/accept] enrich trigger failed", err);
    }
  });

  return NextResponse.json({
    status: "accepted",
    packId: result.packId,
    packSlug: result.packSlug,
    recipeCount: result.recipeCount,
    parseFailures: result.parseFailures,
    brandSlug: suggestion.brand_slug,
  });
}
