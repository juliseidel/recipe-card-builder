import { NextResponse } from "next/server";
import { queryReelsForBrand, type ReelRow } from "@/lib/creator-reels-server";
import { generatePackMeta } from "@/lib/ai/generate-pack-meta";
import { buildPackFromReels, pickMoodById } from "@/lib/reel-library/pack-builder";
import { loadBrand } from "@/lib/custom-brands-server";
import type { Pack } from "@/lib/packs";

// Auto-Pack-Generator. Wird vom Auto-Tab in /[brand]/new aufgerufen. User
// gibt Filter (Timeframe, MealTypes, Cuisines), Server:
//   1. Querie creator_reels mit den Filtern
//   2. Gemini Flash generiert Pack-Title/Description aus den Reels
//   3. buildPackFromReels macht die Recipe-Inserts + Hero-Trigger
//   4. Returnt packSlug fuer Client-Redirect

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  brandSlug: string;
  fromDate?: string;          // ISO yyyy-mm-dd inclusive
  toDate?: string;            // ISO yyyy-mm-dd inclusive
  mealTypes?: string[];
  cuisines?: string[];
  mainIngredients?: string[];
  dietaries?: string[];
  occasions?: string[];
  seasons?: string[];
  skillLevels?: string[];
  vessels?: string[];
  maxTimeMinutes?: number;
  /** Welche Sortierung wenn mehr Reels passen als gewuenscht. Default 'engagement'
   *  (Likes+Views desc). Alternativ 'recent' (posted_at desc). */
  sortBy?: "engagement" | "recent";
  /** Wie viele Reels max ins Pack. Default 12, Hard-Limit 20. */
  limit?: number;
  /** Optionale User-Overrides — wenn gesetzt, wird Gemini's generatePackMeta
   *  fuer diese Felder uebergangen. User-First. */
  overrides?: {
    title?: string;
    subtitle?: string;
    tagline?: string;
    description?: string;
    category?: string;
    moodId?: string; // matched gegen moodPresets (lavender/sage/mint/sky/honey/rose/apricot/cocoa)
    customMood?: {
      background: string;
      accent: string;
      ink: string;
      inkSoft: string;
    };
    layout?: string; // matched gegen CardLayout enum
    displayFont?: "fraunces" | "dm-serif" | "inter-tight";
    /** Surface-Override fuer den Pack-Hintergrund (Phase B). */
    surface?: import("@/lib/packs").PackSurface;
  };
};

function sortReels(
  reels: ReelRow[],
  sortBy: "engagement" | "recent"
): ReelRow[] {
  if (sortBy === "recent") {
    return [...reels].sort(
      (a, b) =>
        new Date(b.posted_at ?? 0).getTime() -
        new Date(a.posted_at ?? 0).getTime()
    );
  }
  return [...reels].sort((a, b) => {
    const ea = (a.like_count ?? 0) + (a.view_count ?? 0) / 10;
    const eb = (b.like_count ?? 0) + (b.view_count ?? 0) / 10;
    return eb - ea;
  });
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

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.brandSlug) {
    return NextResponse.json(
      { error: "brandSlug ist erforderlich." },
      { status: 400 }
    );
  }

  const limit = Math.max(3, Math.min(body.limit ?? 12, 20));
  const sortBy = body.sortBy ?? "engagement";

  // Wir queryen mehr als wir brauchen (3× limit), sortieren clientseitig
  // und cutten — gibt uns saubere Top-Engagement-Selection unter den
  // gefilterten Reels.
  const allMatching = await queryReelsForBrand({
    brandSlug: body.brandSlug,
    fromDate: body.fromDate,
    toDate: body.toDate,
    mealTypes: body.mealTypes,
    cuisines: body.cuisines,
    mainIngredients: body.mainIngredients,
    dietaries: body.dietaries,
    occasions: body.occasions,
    seasons: body.seasons,
    skillLevels: body.skillLevels,
    vessels: body.vessels,
    maxTimeMinutes: body.maxTimeMinutes,
    limit: Math.max(50, limit * 3),
    onlyRecipes: true,
  });

  if (allMatching.length < 3) {
    return NextResponse.json(
      {
        error: `Nur ${allMatching.length} Rezepte matchen die Filter — Pack braucht mindestens 3. Lockere die Filter oder erweitere den Zeitraum.`,
        matchCount: allMatching.length,
      },
      { status: 422 }
    );
  }

  const selected = sortReels(allMatching, sortBy).slice(0, limit);
  const overrides = body.overrides ?? {};

  // Meta-Generierung (Title, Description, Mood) NUR wenn nicht alle Felder
  // ueberschrieben sind. User-First: wenn der User in der UI schon Title/
  // Description gesetzt hat, sparen wir den Gemini-Call.
  const brand = await loadBrand(body.brandSlug);
  const needsMeta = !(
    overrides.title &&
    overrides.subtitle &&
    overrides.tagline &&
    overrides.description &&
    overrides.category
  );
  let meta: {
    title: string;
    subtitle: string;
    tagline: string;
    description: string;
    category: string;
    moodHint: "cream" | "sage" | "linen" | "amber";
  };
  if (needsMeta) {
    try {
      meta = await generatePackMeta(selected, brand);
    } catch (err) {
      console.error("[generate-auto] generatePackMeta failed", err);
      meta = {
        title: `${selected.length} Rezepte`,
        subtitle: "Eine kuratierte Auswahl",
        tagline: selected
          .slice(0, 3)
          .map((r) => r.recipe_title || "Rezept")
          .join(" · "),
        description: "Eine automatisch zusammengestellte Sammlung aus der Reel-Library des Creators.",
        category: "Auto-Pack",
        moodHint: "cream" as const,
      };
    }
  } else {
    // Alles vom User vorgegeben, generatePackMeta nicht noetig.
    meta = {
      title: overrides.title!,
      subtitle: overrides.subtitle!,
      tagline: overrides.tagline!,
      description: overrides.description!,
      category: overrides.category!,
      moodHint: "cream",
    };
  }

  // Auto-Mapping wenn User keinen Mood/Layout/Font vorgegeben hat.
  // Mood: erst User-customMood, dann User-moodId, dann moodHint-Mapping.
  let resolvedMood: import("@/lib/packs").PackMood;
  if (overrides.customMood) {
    resolvedMood = overrides.customMood;
  } else if (overrides.moodId) {
    resolvedMood = pickMoodById(overrides.moodId);
  } else {
    const packMoodId = {
      cream: "honey",
      sage: "sage",
      linen: "sky",
      amber: "amber",
    }[meta.moodHint] ?? "honey";
    resolvedMood = pickMoodById(packMoodId);
  }

  // Surface-Override (Phase B): wenn der User explicit eine surface
  // (gradient/pattern) gewaehlt hat, in resolvedMood reinmischen.
  if (overrides.surface) {
    resolvedMood = { ...resolvedMood, surface: overrides.surface };
  }

  // Layout: User-Override gewinnt, sonst Auto-Map nach moodHint.
  const VALID_LAYOUTS: import("@/lib/packs").CardLayout[] = [
    "editorial",
    "patisserie",
    "minimal",
    "sport",
    "dashboard",
    "vital",
    "amber",
  ];
  let resolvedLayout: import("@/lib/packs").CardLayout;
  if (overrides.layout && VALID_LAYOUTS.includes(overrides.layout as import("@/lib/packs").CardLayout)) {
    resolvedLayout = overrides.layout as import("@/lib/packs").CardLayout;
  } else {
    resolvedLayout =
      meta.moodHint === "amber"
        ? "amber"
        : meta.moodHint === "sage"
          ? "vital"
          : meta.moodHint === "linen"
            ? "minimal"
            : "editorial";
  }

  // Font: User-Override gewinnt, sonst Auto-Map.
  const resolvedFont: Pack["displayFont"] =
    overrides.displayFont ??
    (meta.moodHint === "linen" ? "inter-tight" : "fraunces");

  // Override-Strings (falls partial)
  const title = overrides.title?.trim() || meta.title;
  const subtitle = overrides.subtitle?.trim() || meta.subtitle;
  const tagline = overrides.tagline?.trim() || meta.tagline;
  const description = overrides.description?.trim() || meta.description;
  const category = overrides.category?.trim() || meta.category;

  const baseSlug = slugifyPack(title) || "auto-pack";
  const slug = `${baseSlug}-${Date.now().toString(36).slice(-4)}`;
  const origin = new URL(req.url).origin;

  const result = await buildPackFromReels({
    brandSlug: body.brandSlug,
    reelIds: selected.map((r) => r.id),
    pack: {
      slug,
      title,
      subtitle,
      tagline,
      description,
      category,
      mood: resolvedMood,
      displayFont: resolvedFont,
      cardLayout: resolvedLayout,
    },
    origin,
  });

  if (!result) {
    return NextResponse.json(
      {
        error: "Pack konnte nicht erstellt werden.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    status: "created",
    packId: result.packId,
    packSlug: result.packSlug,
    recipeCount: result.recipeCount,
    parseFailures: result.parseFailures,
    meta,
  });
}
