"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { Brand } from "@/lib/brands";
import type { CardLayout, PackMood, PackSurface, PatternId } from "@/lib/packs";
import { moodPresets, displayFontOptions, layoutPresets } from "@/lib/pack-presets";
import { surfaceToCss, PATTERN_CATALOG, GRADIENT_PRESETS } from "@/lib/pack-surface";

// Auto-Pack-Form fuer den /[brand]/new Auto-Tab. User waehlt Filter
// (Timeframe + 8 Tag-Dimensionen + Limit + Sortierung), Live-Preview-Grid
// zeigt die matchenden Reels, "Pack generieren" baut Pack + Recipes +
// Heroes.
//
// Smart-Hide: Beim Mount laed't die UI Tag-Aggregates fuer den Brand und
// zeigt nur die Chip-Werte die wirklich vorkommen. Counter pro Chip
// ("Asia (12)") hilft dem User einzuschaetzen welche Filter sinnvoll
// sind.

type ReelPreview = {
  id: string;
  title: string | null;
  displayUrl: string | null;
  postUrl: string;
  postedAt: string | null;
  mealType: string | null;
  cuisine: string | null;
  mainIngredient: string | null;
  dietary: string[];
  occasion: string | null;
  season: string | null;
  skillLevel: string | null;
  vessel: string | null;
  estimatedTimeMinutes: number | null;
  likeCount: number | null;
  viewCount: number | null;
};

type TagBucket = { value: string; count: number };

// Server-Response von /api/packs/auto-suggest-design — Gemini-Vorschlag
// fuer die Pack-Identitaet basierend auf den gewaehlten Reels.
type PackDesignSuggestion = {
  titles: string[];
  layout: CardLayout;
  layoutReason: string;
  moodId: string;
  moodReason: string;
  fontId: "fraunces" | "dm-serif" | "inter-tight";
  fontReason: string;
  category: string;
  subtitle: string;
  tagline: string;
  description: string;
  surfaceType: "solid" | "gradient" | "pattern";
  patternId: string;
  surfaceReason: string;
};

type ReelTagAggregates = {
  total: number;
  mealType: TagBucket[];
  cuisine: TagBucket[];
  mainIngredient: TagBucket[];
  dietary: TagBucket[];
  occasion: TagBucket[];
  season: TagBucket[];
  skillLevel: TagBucket[];
  vessel: TagBucket[];
  timeBuckets: TagBucket[];
};

const TIMEFRAME_PRESETS = [
  { id: "2w", label: "Letzte 2 Wochen", days: 14 },
  { id: "1m", label: "Letzter Monat", days: 30 },
  { id: "3m", label: "Letzte 3 Monate", days: 90 },
  { id: "1y", label: "Letztes Jahr", days: 365 },
  { id: "all", label: "Alle Zeit", days: 0 },
] as const;

// ─── Label-Maps (KI gibt englische enums, User sieht Deutsch) ────────────

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: "Frühstück",
  lunch: "Mittag",
  dinner: "Abend",
  snack: "Snack",
  dessert: "Dessert",
  drink: "Drink",
};

const CUISINE_LABELS: Record<string, string> = {
  italian: "Italienisch",
  asian: "Asiatisch",
  german: "Deutsch",
  mediterranean: "Mediterran",
  mexican: "Mexikanisch",
  indian: "Indisch",
  american: "Amerikanisch",
  "middle-eastern": "Orientalisch",
  french: "Französisch",
  healthy: "Healthy",
  baking: "Backen",
  bbq: "BBQ",
  "fastfood-makeover": "Fastfood-Makeover",
  "comfort-food": "Comfort-Food",
};

const MAIN_INGREDIENT_LABELS: Record<string, string> = {
  chicken: "Hähnchen",
  beef: "Rind",
  pork: "Schwein",
  fish: "Fisch",
  seafood: "Meeresfrüchte",
  tofu: "Tofu",
  eggs: "Eier",
  oats: "Hafer",
  pasta: "Pasta",
  rice: "Reis",
  potato: "Kartoffel",
  quark: "Quark",
  skyr: "Skyr",
  chocolate: "Schokolade",
  berries: "Beeren",
  apple: "Apfel",
  banana: "Banane",
  vegetables: "Gemüse",
  legumes: "Hülsenfrüchte",
  cheese: "Käse",
  bread: "Brot",
  nuts: "Nüsse",
  yogurt: "Joghurt",
  noodles: "Nudeln",
  "flour-baking": "Mehl-Backware",
};

const DIETARY_LABELS: Record<string, string> = {
  highprotein: "High-Protein",
  lowcarb: "Low-Carb",
  lowcal: "Low-Cal",
  vegan: "Vegan",
  vegetarian: "Vegetarisch",
  glutenfree: "Glutenfrei",
  dairyfree: "Laktosefrei",
  sugarfree: "Ohne Zucker",
  nutfree: "Nussfrei",
};

const OCCASION_LABELS: Record<string, string> = {
  mealprep: "Mealprep",
  "quick-weeknight": "Schnell unter der Woche",
  cozy: "Cozy & deftig",
  gameday: "Gameday & Snacks",
  brunch: "Brunch",
  "family-dinner": "Familien-Dinner",
  "date-night": "Date-Night",
  "summer-bbq": "Sommer-BBQ",
  festive: "Festlich",
  "sunday-baking": "Sonntag-Backen",
  "post-workout": "Nach dem Sport",
  "lazy-morning": "Gemütliches Wochenende",
};

const SEASON_LABELS: Record<string, string> = {
  spring: "Frühling",
  summer: "Sommer",
  autumn: "Herbst",
  winter: "Winter",
  "year-round": "Ganzjährig",
};

const SKILL_LABELS: Record<string, string> = {
  beginner: "Anfänger",
  intermediate: "Mittel",
  advanced: "Fortgeschritten",
};

const VESSEL_LABELS: Record<string, string> = {
  bowl: "Bowl",
  pan: "Pfanne",
  sheet: "Backblech",
  airfryer: "Airfryer",
  mug: "Tasse",
  mixer: "Standmixer",
  oven: "Ofen",
  pot: "Topf",
  "no-cook": "Ohne Kochen",
  grill: "Grill",
  blender: "Blender",
};

const TIME_LABELS: Record<string, string> = {
  "<=15": "≤ 15 Min",
  "<=30": "≤ 30 Min",
  "<=60": "≤ 60 Min",
  ">60": "> 60 Min",
};

// timeBucket → maxTimeMinutes-Cap fuer Backend-Query
const TIME_BUCKET_TO_MAX: Record<string, number | undefined> = {
  "<=15": 15,
  "<=30": 30,
  "<=60": 60,
  ">60": undefined,
};

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function labelFor(map: Record<string, string>, value: string): string {
  return map[value] ?? value.charAt(0).toUpperCase() + value.slice(1);
}

export function AutoPackForm({ brand }: { brand: Brand }) {
  const router = useRouter();
  const [timeframe, setTimeframe] = useState<(typeof TIMEFRAME_PRESETS)[number]["id"]>("1m");
  const [limit, setLimit] = useState(12);
  const [sortBy, setSortBy] = useState<"engagement" | "recent">("engagement");

  // ─── Multi-Select Filter-State pro Dimension ───────────────────────────
  const [mealTypes, setMealTypes] = useState<string[]>([]);
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [mainIngredients, setMainIngredients] = useState<string[]>([]);
  const [dietaries, setDietaries] = useState<string[]>([]);
  const [occasions, setOccasions] = useState<string[]>([]);
  const [seasons, setSeasons] = useState<string[]>([]);
  const [skillLevels, setSkillLevels] = useState<string[]>([]);
  const [vessels, setVessels] = useState<string[]>([]);
  const [timeBucket, setTimeBucket] = useState<string | null>(null);

  const [reels, setReels] = useState<ReelPreview[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Smart-Hide: Tag-Aggregates beim Mount laden, damit nur vorkommende
  // Werte als Chips gerendert werden. Counter pro Chip.
  const [tags, setTags] = useState<ReelTagAggregates | null>(null);
  const [tagsLoading, setTagsLoading] = useState(true);

  // Quick-Scrape-State: User klickt "Frisch von Instagram laden" wenn die
  // Library leer ist oder er aktuelle Daten will. Synchroner Apify-Run
  // (~30s) + Klassifikation, danach reloaden wir den Filter.
  const [scraping, setScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [scrapeSuccess, setScrapeSuccess] = useState<string | null>(null);

  // ─── Pack-Identity-State (KI-Auto-Setup) ───────────────────────────────
  // User kann Title/Layout/Mood/Font manuell setzen ODER vom KI-Setup-
  // Button befuellen lassen. Wenn nichts gesetzt ist (alles null), benutzt
  // der Generate-Endpoint die generatePackMeta-Heuristik wie vorher.
  const [packTitle, setPackTitle] = useState<string>("");
  const [packSubtitle, setPackSubtitle] = useState<string>("");
  const [packTagline, setPackTagline] = useState<string>("");
  const [packDescription, setPackDescription] = useState<string>("");
  const [packCategory, setPackCategory] = useState<string>("");
  const [packLayout, setPackLayout] = useState<CardLayout | null>(null);
  const [packMoodId, setPackMoodId] = useState<string | null>(null);
  const [packCustomMood, setPackCustomMood] = useState<PackMood | null>(null);
  const [packFont, setPackFont] = useState<
    "fraunces" | "dm-serif" | "inter-tight" | null
  >(null);

  // KI-Suggestion-State: gespeicherte Antwort + Loading + 5 Title-Alternativen
  const [aiSuggestion, setAiSuggestion] =
    useState<PackDesignSuggestion | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showAlternativeTitles, setShowAlternativeTitles] = useState(false);
  const [showOptionalDetails, setShowOptionalDetails] = useState(false);

  // Surface-State (Phase B): solid (default, undefined) | gradient | pattern
  const [packSurfaceType, setPackSurfaceType] = useState<
    "solid" | "gradient" | "pattern"
  >("solid");
  const [packGradient, setPackGradient] = useState<{
    variant: "linear" | "radial";
    stops: { color: string; position: number }[];
    angle: number;
  }>({
    variant: "linear",
    stops: [
      { color: "#f4d88d", position: 0 },
      { color: "#e8889b", position: 1 },
    ],
    angle: 135,
  });
  const [packPattern, setPackPattern] = useState<{
    patternId: PatternId;
    baseColor: string;
    accentColor: string;
    scale: number;
    opacity: number;
  }>({
    patternId: "polka",
    baseColor: "#f4d88d",
    accentColor: "#b07a2a",
    scale: 1,
    opacity: 0.6,
  });

  const loadTags = useCallback(async () => {
    setTagsLoading(true);
    try {
      const res = await fetch(
        `/api/brands/${encodeURIComponent(brand.slug)}/reel-tags`,
        { cache: "no-store" }
      );
      const json = (await res.json()) as ReelTagAggregates;
      setTags(json);
    } catch {
      setTags({
        total: 0,
        mealType: [],
        cuisine: [],
        mainIngredient: [],
        dietary: [],
        occasion: [],
        season: [],
        skillLevel: [],
        vessel: [],
        timeBuckets: [],
      });
    } finally {
      setTagsLoading(false);
    }
  }, [brand.slug]);

  useEffect(() => {
    void loadTags();
  }, [loadTags]);

  // Aktive Filter-URL fuer das Reel-Preview-Endpoint. useMemo damit der
  // useEffect nur bei echten Aenderungen re-laed't.
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    const tf = TIMEFRAME_PRESETS.find((t) => t.id === timeframe);
    if (tf && tf.days > 0) {
      params.set("from", isoDaysAgo(tf.days));
    }
    if (mealTypes.length > 0) params.set("mealTypes", mealTypes.join(","));
    if (cuisines.length > 0) params.set("cuisines", cuisines.join(","));
    if (mainIngredients.length > 0)
      params.set("mainIngredients", mainIngredients.join(","));
    if (dietaries.length > 0) params.set("dietaries", dietaries.join(","));
    if (occasions.length > 0) params.set("occasions", occasions.join(","));
    if (seasons.length > 0) params.set("seasons", seasons.join(","));
    if (skillLevels.length > 0)
      params.set("skillLevels", skillLevels.join(","));
    if (vessels.length > 0) params.set("vessels", vessels.join(","));
    if (timeBucket) {
      const max = TIME_BUCKET_TO_MAX[timeBucket];
      if (typeof max === "number") params.set("maxMinutes", String(max));
    }
    params.set("limit", String(Math.max(50, limit * 3)));
    return params.toString();
  }, [
    timeframe,
    mealTypes,
    cuisines,
    mainIngredients,
    dietaries,
    occasions,
    seasons,
    skillLevels,
    vessels,
    timeBucket,
    limit,
  ]);

  const loadReels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/brands/${encodeURIComponent(brand.slug)}/reels?${queryString}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      const fetched: ReelPreview[] = Array.isArray(json.reels) ? json.reels : [];
      // Client-side sort + slice basierend auf sortBy/limit fuer Live-Preview.
      const sorted = [...fetched];
      if (sortBy === "recent") {
        sorted.sort(
          (a, b) =>
            new Date(b.postedAt ?? 0).getTime() -
            new Date(a.postedAt ?? 0).getTime()
        );
      } else {
        sorted.sort(
          (a, b) =>
            (b.likeCount ?? 0) +
            (b.viewCount ?? 0) / 10 -
            ((a.likeCount ?? 0) + (a.viewCount ?? 0) / 10)
        );
      }
      setReels(sorted.slice(0, limit));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Konnte Reels nicht laden.");
    } finally {
      setLoading(false);
    }
  }, [brand.slug, queryString, sortBy, limit]);

  useEffect(() => {
    // Debounce auf 200ms damit Slider-Drag nicht 60 API-Calls macht.
    const t = setTimeout(() => void loadReels(), 200);
    return () => clearTimeout(t);
  }, [loadReels]);

  // Multi-Select-Toggle-Helper. Funktioniert fuer jede Dimension.
  function toggleIn(
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    value: string
  ) {
    setter((prev) =>
      prev.includes(value) ? prev.filter((m) => m !== value) : [...prev, value]
    );
  }

  // Total aktive Filter (alle Dimensionen). Wird fuer Reset-Button +
  // "Filter aktiv"-Pill genutzt.
  const activeFilterCount =
    mealTypes.length +
    cuisines.length +
    mainIngredients.length +
    dietaries.length +
    occasions.length +
    seasons.length +
    skillLevels.length +
    vessels.length +
    (timeBucket ? 1 : 0);

  const resetAllFilters = () => {
    setMealTypes([]);
    setCuisines([]);
    setMainIngredients([]);
    setDietaries([]);
    setOccasions([]);
    setSeasons([]);
    setSkillLevels([]);
    setVessels([]);
    setTimeBucket(null);
  };

  // Quick-Scrape: triggert /api/brands/[slug]/quick-scrape mit dem
  // aktuellen Timeframe. Server scrapt Apify synchron, klassifiziert,
  // returnt. Danach refreshen wir die Reel-Preview + Tag-Aggregates.
  const handleQuickScrape = async () => {
    setScraping(true);
    setScrapeError(null);
    setScrapeSuccess(null);
    try {
      const tf = TIMEFRAME_PRESETS.find((t) => t.id === timeframe);
      const days = tf && tf.days > 0 ? tf.days : 90;
      const res = await fetch(
        `/api/brands/${encodeURIComponent(brand.slug)}/quick-scrape`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ days, limit: 30 }),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          json.needsSetup
            ? "Reel-Library-Tabellen fehlen in Supabase. Bitte sql/creator-reels-table.sql ausfuehren."
            : json.error ?? "Scrape fehlgeschlagen."
        );
      }
      setScrapeSuccess(
        `${json.scraped} Posts gescrapt, ${json.classified} klassifiziert.`
      );
      // Reels-Preview + Tags re-laden mit dem aktuellen Filter
      await Promise.all([loadReels(), loadTags()]);
    } catch (err) {
      setScrapeError(
        err instanceof Error ? err.message : "Scrape fehlgeschlagen."
      );
    } finally {
      setScraping(false);
    }
  };

  // Bundled filter-payload — identisch fuer /reels, /auto-suggest-design,
  // /generate-auto Calls. So muss man Filter nur an EINER Stelle aendern.
  const filterPayload = useMemo(() => {
    const tf = TIMEFRAME_PRESETS.find((t) => t.id === timeframe);
    const maxTimeMinutes = timeBucket
      ? TIME_BUCKET_TO_MAX[timeBucket]
      : undefined;
    return {
      brandSlug: brand.slug,
      fromDate: tf && tf.days > 0 ? isoDaysAgo(tf.days) : undefined,
      mealTypes: mealTypes.length > 0 ? mealTypes : undefined,
      cuisines: cuisines.length > 0 ? cuisines : undefined,
      mainIngredients:
        mainIngredients.length > 0 ? mainIngredients : undefined,
      dietaries: dietaries.length > 0 ? dietaries : undefined,
      occasions: occasions.length > 0 ? occasions : undefined,
      seasons: seasons.length > 0 ? seasons : undefined,
      skillLevels: skillLevels.length > 0 ? skillLevels : undefined,
      vessels: vessels.length > 0 ? vessels : undefined,
      maxTimeMinutes,
      limit,
      sortBy,
    };
  }, [
    brand.slug,
    timeframe,
    mealTypes,
    cuisines,
    mainIngredients,
    dietaries,
    occasions,
    seasons,
    skillLevels,
    vessels,
    timeBucket,
    limit,
    sortBy,
  ]);

  // KI-Auto-Setup: Gemini schaut auf die gewaehlten Reels und schlaegt
  // Title/Layout/Mood/Font + 5 Title-Alternativen vor. User kann
  // Vorschlag uebernehmen (per Klick auf einen Title) oder eigenes setzen.
  const loadAiSuggestion = useCallback(async () => {
    if (!reels || reels.length < 3) {
      setAiError(
        "Mindestens 3 Reels in der Live-Vorschau, bevor KI Vorschläge machen kann."
      );
      return;
    }
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch("/api/packs/auto-suggest-design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filterPayload),
      });
      const json = await res.json();
      if (!res.ok || !json.suggestion) {
        throw new Error(json.error ?? "KI-Vorschlag fehlgeschlagen.");
      }
      const s = json.suggestion as PackDesignSuggestion;
      setAiSuggestion(s);
      // Auto-Apply die Top-Empfehlung wenn User noch nichts gesetzt hat.
      if (!packTitle && s.titles[0]) setPackTitle(s.titles[0]);
      if (!packLayout) setPackLayout(s.layout);
      if (!packMoodId && !packCustomMood) setPackMoodId(s.moodId);
      if (!packFont) setPackFont(s.fontId);
      if (!packCategory && s.category) setPackCategory(s.category);
      if (!packSubtitle && s.subtitle) setPackSubtitle(s.subtitle);
      if (!packTagline && s.tagline) setPackTagline(s.tagline);
      if (!packDescription && s.description) setPackDescription(s.description);
      // Surface-Vorschlag uebernehmen: setze Type + bei pattern setze
      // patternId; baseColor/accentColor leiten wir vom empfohlenen Mood ab.
      if (s.surfaceType && s.surfaceType !== "solid") {
        setPackSurfaceType(s.surfaceType);
        if (s.surfaceType === "pattern" && s.patternId) {
          const moodColors =
            moodPresets.find((m) => m.id === s.moodId)?.mood ??
            moodPresets[0].mood;
          setPackPattern({
            patternId: s.patternId as PatternId,
            baseColor: moodColors.background,
            accentColor: moodColors.accent,
            scale: 1,
            opacity: 0.6,
          });
        } else if (s.surfaceType === "gradient") {
          const moodColors =
            moodPresets.find((m) => m.id === s.moodId)?.mood ??
            moodPresets[0].mood;
          setPackGradient({
            variant: "linear",
            stops: [
              { color: moodColors.background, position: 0 },
              { color: moodColors.accent, position: 1 },
            ],
            angle: 135,
          });
        }
      }
      setShowAlternativeTitles(false);
    } catch (err) {
      setAiError(
        err instanceof Error ? err.message : "KI-Vorschlag fehlgeschlagen."
      );
    } finally {
      setAiLoading(false);
    }
  }, [
    reels,
    filterPayload,
    packTitle,
    packLayout,
    packMoodId,
    packCustomMood,
    packFont,
    packCategory,
    packSubtitle,
    packTagline,
    packDescription,
  ]);

  const resetDesignOverrides = () => {
    setPackTitle("");
    setPackSubtitle("");
    setPackTagline("");
    setPackDescription("");
    setPackCategory("");
    setPackLayout(null);
    setPackMoodId(null);
    setPackCustomMood(null);
    setPackFont(null);
    setPackSurfaceType("solid");
    setAiSuggestion(null);
    setShowAlternativeTitles(false);
    setShowOptionalDetails(false);
  };

  // Berechnete Surface: gradient/pattern wenn ausgewaehlt, sonst null.
  const resolvedSurface = useMemo<PackSurface | null>(() => {
    if (packSurfaceType === "gradient") {
      return {
        type: "gradient",
        variant: packGradient.variant,
        stops: packGradient.stops,
        angle: packGradient.angle,
      };
    }
    if (packSurfaceType === "pattern") {
      return {
        type: "pattern",
        patternId: packPattern.patternId,
        baseColor: packPattern.baseColor,
        accentColor: packPattern.accentColor,
        scale: packPattern.scale,
        opacity: packPattern.opacity,
      };
    }
    return null;
  }, [packSurfaceType, packGradient, packPattern]);

  const handleGenerate = async () => {
    if (!reels || reels.length < 3) {
      setError("Mindestens 3 Reels nötig, um ein Pack zu generieren.");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      // User-Overrides bauen: nur Felder mitschicken die User explizit
      // gesetzt hat. Leere bleiben undefined, Backend nutzt dann seine
      // generatePackMeta-Heuristik.
      const overrides: Record<string, unknown> = {};
      if (packTitle.trim()) overrides.title = packTitle.trim();
      if (packSubtitle.trim()) overrides.subtitle = packSubtitle.trim();
      if (packTagline.trim()) overrides.tagline = packTagline.trim();
      if (packDescription.trim()) overrides.description = packDescription.trim();
      if (packCategory.trim()) overrides.category = packCategory.trim();
      if (packLayout) overrides.layout = packLayout;
      if (packCustomMood) overrides.customMood = packCustomMood;
      else if (packMoodId) overrides.moodId = packMoodId;
      if (packFont) overrides.displayFont = packFont;
      if (resolvedSurface) overrides.surface = resolvedSurface;

      const res = await fetch("/api/packs/generate-auto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...filterPayload,
          overrides: Object.keys(overrides).length > 0 ? overrides : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Pack-Generierung fehlgeschlagen.");
      }
      router.push(`/${brand.slug}/${json.packSlug}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pack-Generierung fehlgeschlagen.");
      setGenerating(false);
    }
  };

  // Resolved-Mood fuer Live-Preview: Custom > Preset > null
  const resolvedMood = useMemo<PackMood | null>(() => {
    if (packCustomMood) return packCustomMood;
    if (packMoodId)
      return moodPresets.find((m) => m.id === packMoodId)?.mood ?? null;
    return null;
  }, [packCustomMood, packMoodId]);

  // Hilft beim Disable des Generate-Buttons + KI-Setup
  const hasEnoughReels = (reels?.length ?? 0) >= 3;
  const designIsUntouched =
    !packTitle &&
    !packLayout &&
    !packMoodId &&
    !packCustomMood &&
    !packFont &&
    packSurfaceType === "solid" &&
    !aiSuggestion;

  const recipeWord = limit === 1 ? "Rezept" : "Rezepte";
  const reelWord = (reels?.length ?? 0) === 1 ? "Reel" : "Reels";

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: brand.tokens.inkMuted }}
        >
          Auto-Pack aus Reel-Library
        </span>
        <h1
          className="font-display text-[36px] leading-[1.05] tracking-[-0.015em]"
          style={{ color: brand.tokens.ink }}
        >
          Pack in einem Klick
        </h1>
        <p
          className="text-[14px] leading-relaxed"
          style={{ color: brand.tokens.inkMuted }}
        >
          Wähl Zeitraum + Kategorien — die KI baut Pack-Titel, Beschreibung
          und Karten aus der Reel-Library. Hero-Bilder werden parallel im
          Hintergrund generiert.
        </p>
      </header>

      {/* Section 1 — Timeframe */}
      <section className="editor-section editor-card flex flex-col gap-5">
        <SectionHeader
          num="01"
          title="Zeitraum"
          hint="Welcher Slice aus den letzten 2 Jahren?"
          brand={brand}
        />
        <div className="flex flex-wrap gap-2">
          {TIMEFRAME_PRESETS.map((preset) => {
            const active = timeframe === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => setTimeframe(preset.id)}
                className="rounded-full border-2 px-4 py-2 text-[12.5px] font-semibold transition-all"
                style={{
                  borderColor: active ? brand.tokens.accent : brand.tokens.line,
                  background: active
                    ? brand.tokens.accent + "12"
                    : brand.tokens.surface,
                  color: active ? brand.tokens.accent : brand.tokens.inkMuted,
                }}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Section 2 — Filter-Bar mit gruppierten Chip-Sektionen.
          Smart-Hide: jede Gruppe rendert nur Chips fuer Werte die in der
          Reel-Library wirklich vorkommen (count > 0). Counter im Chip. */}
      <section className="editor-section editor-card flex flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          <SectionHeader
            num="02"
            title="Kategorien & Filter"
            hint={
              tagsLoading
                ? "Lade Tag-Library…"
                : `${tags?.total ?? 0} klassifizierte Rezepte in der Library — kombiniere beliebig viele Filter.`
            }
            brand={brand}
          />
          {activeFilterCount > 0 ? (
            <button
              type="button"
              onClick={resetAllFilters}
              className="shrink-0 rounded-full border px-3 py-1.5 text-[11.5px] font-semibold transition-all hover:opacity-80"
              style={{
                borderColor: brand.tokens.line,
                color: brand.tokens.inkMuted,
                background: brand.tokens.surface,
              }}
            >
              ✕ Alle Filter zurücksetzen ({activeFilterCount})
            </button>
          ) : null}
        </div>

        {tagsLoading ? (
          <div className="flex flex-col gap-3">
            <div
              className="h-3 w-1/3 animate-pulse rounded-full"
              style={{ background: brand.tokens.line }}
            />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-8 w-24 animate-pulse rounded-full"
                  style={{ background: brand.tokens.line }}
                />
              ))}
            </div>
          </div>
        ) : !tags || tags.total === 0 ? (
          <div
            className="rounded-2xl border border-dashed px-6 py-6 text-center text-[13px]"
            style={{
              borderColor: brand.tokens.line,
              color: brand.tokens.inkMuted,
              background: brand.tokens.surface,
            }}
          >
            Noch keine klassifizierten Reels. Erst Library laden mit „Frisch
            von Instagram laden" unten — danach erscheinen hier alle Filter.
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <FilterGroup
              title="Mahlzeit"
              buckets={tags.mealType}
              labels={MEAL_TYPE_LABELS}
              selected={mealTypes}
              onToggle={(v) => toggleIn(setMealTypes, v)}
              brand={brand}
            />
            <FilterGroup
              title="Anlass"
              buckets={tags.occasion}
              labels={OCCASION_LABELS}
              selected={occasions}
              onToggle={(v) => toggleIn(setOccasions, v)}
              brand={brand}
            />
            <FilterGroup
              title="Cuisine"
              buckets={tags.cuisine}
              labels={CUISINE_LABELS}
              selected={cuisines}
              onToggle={(v) => toggleIn(setCuisines, v)}
              brand={brand}
            />
            <FilterGroup
              title="Hauptzutat"
              buckets={tags.mainIngredient}
              labels={MAIN_INGREDIENT_LABELS}
              selected={mainIngredients}
              onToggle={(v) => toggleIn(setMainIngredients, v)}
              brand={brand}
              collapsible
            />
            <FilterGroup
              title="Diät"
              buckets={tags.dietary}
              labels={DIETARY_LABELS}
              selected={dietaries}
              onToggle={(v) => toggleIn(setDietaries, v)}
              brand={brand}
            />
            <TimeFilterGroup
              buckets={tags.timeBuckets}
              selected={timeBucket}
              onSelect={(v) =>
                setTimeBucket((prev) => (prev === v ? null : v))
              }
              brand={brand}
            />
            <FilterGroup
              title="Saison"
              buckets={tags.season}
              labels={SEASON_LABELS}
              selected={seasons}
              onToggle={(v) => toggleIn(setSeasons, v)}
              brand={brand}
              collapsible
            />
            <FilterGroup
              title="Schwierigkeit"
              buckets={tags.skillLevel}
              labels={SKILL_LABELS}
              selected={skillLevels}
              onToggle={(v) => toggleIn(setSkillLevels, v)}
              brand={brand}
              collapsible
            />
            <FilterGroup
              title="Zubereitung in"
              buckets={tags.vessel}
              labels={VESSEL_LABELS}
              selected={vessels}
              onToggle={(v) => toggleIn(setVessels, v)}
              brand={brand}
              collapsible
            />
          </div>
        )}
      </section>

      {/* Section 3 — Anzahl + Sortierung */}
      <section className="editor-section editor-card flex flex-col gap-5">
        <SectionHeader
          num="03"
          title="Anzahl & Sortierung"
          hint="Wie viele Rezepte ins Pack?"
          brand={brand}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label
              className="text-[12px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: brand.tokens.inkMuted }}
            >
              Anzahl Rezepte: <span style={{ color: brand.tokens.ink }}>{limit}</span>
            </label>
            <input
              type="range"
              min={5}
              max={20}
              step={1}
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value))}
              className="w-full accent-current"
              style={{ accentColor: brand.tokens.accent }}
            />
            <div
              className="flex justify-between text-[11px]"
              style={{ color: brand.tokens.inkMuted }}
            >
              <span>5 ({recipeWord})</span>
              <span>20 ({recipeWord})</span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label
              className="text-[12px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: brand.tokens.inkMuted }}
            >
              Auswahl-Kriterium
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSortBy("engagement")}
                className="flex-1 rounded-xl border-2 px-3 py-2.5 text-[12.5px] font-semibold transition-all"
                style={{
                  borderColor:
                    sortBy === "engagement" ? brand.tokens.accent : brand.tokens.line,
                  background:
                    sortBy === "engagement"
                      ? brand.tokens.accent + "12"
                      : brand.tokens.surface,
                  color:
                    sortBy === "engagement" ? brand.tokens.accent : brand.tokens.inkMuted,
                }}
              >
                Meist-gespeichert
              </button>
              <button
                type="button"
                onClick={() => setSortBy("recent")}
                className="flex-1 rounded-xl border-2 px-3 py-2.5 text-[12.5px] font-semibold transition-all"
                style={{
                  borderColor:
                    sortBy === "recent" ? brand.tokens.accent : brand.tokens.line,
                  background:
                    sortBy === "recent"
                      ? brand.tokens.accent + "12"
                      : brand.tokens.surface,
                  color:
                    sortBy === "recent" ? brand.tokens.accent : brand.tokens.inkMuted,
                }}
              >
                Neueste zuerst
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Live-Preview */}
      <section className="editor-section editor-card flex flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          <SectionHeader
            num="04"
            title="Live-Vorschau"
            hint={
              loading
                ? "Lade Reels…"
                : reels && reels.length > 0
                  ? `Das werden die ${reels.length} ${reelWord} im Pack.`
                  : "Keine Reels gefunden — Filter lockern oder neu von Instagram laden:"
            }
            brand={brand}
          />
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            {reels && reels.length > 0 ? (
              <span
                className="font-mono text-[10.5px] uppercase tracking-[0.16em]"
                style={{ color: brand.tokens.inkMuted }}
              >
                {reels.length} {reelWord}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => void handleQuickScrape()}
              disabled={scraping || loading}
              className="flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[11.5px] font-semibold transition-all hover:opacity-80 disabled:cursor-wait disabled:opacity-50"
              style={{
                borderColor: brand.tokens.line,
                color: scraping ? brand.tokens.inkMuted : brand.tokens.accent,
                background: brand.tokens.surface,
              }}
              title="Holt SOFORT die letzten ~30 Posts und klassifiziert sie"
            >
              {scraping ? (
                <>
                  <span
                    className="size-3 animate-spin rounded-full border-[1.5px] border-current border-t-transparent"
                    style={{ borderTopColor: "transparent" }}
                  />
                  Lade Instagram…
                </>
              ) : (
                <>
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
                    <path
                      d="M10.5 4.5A4.5 4.5 0 1 0 11 6m-.5-1.5V2m0 2.5h-2.5"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Frisch von Instagram laden
                </>
              )}
            </button>
          </div>
        </div>

        {scrapeError ? (
          <div
            className="rounded-xl border px-4 py-2.5 text-[12px]"
            style={{
              borderColor: "rgba(197, 48, 48, 0.3)",
              background: "rgba(254, 226, 226, 0.6)",
              color: "#9b2c2c",
            }}
          >
            {scrapeError}
          </div>
        ) : null}
        {scrapeSuccess ? (
          <div
            className="rounded-xl border px-4 py-2.5 text-[12px]"
            style={{
              borderColor: brand.tokens.accent + "55",
              background: brand.tokens.accent + "10",
              color: brand.tokens.ink,
            }}
          >
            ✓ {scrapeSuccess}
          </div>
        ) : null}

        {loading && !reels ? (
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square animate-pulse rounded-xl"
                style={{ background: brand.tokens.line }}
              />
            ))}
          </div>
        ) : reels && reels.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {reels.map((reel) => (
              <article
                key={reel.id}
                className="group relative overflow-hidden rounded-xl border"
                style={{
                  borderColor: brand.tokens.line,
                  background: brand.tokens.surface,
                }}
              >
                <div className="relative aspect-square">
                  {reel.displayUrl ? (
                    <Image
                      src={reel.displayUrl}
                      alt={reel.title ?? "Reel"}
                      fill
                      sizes="(max-width: 640px) 100vw, 25vw"
                      className="object-cover transition-transform group-hover:scale-[1.02]"
                      unoptimized
                    />
                  ) : (
                    <div
                      className="grid h-full w-full place-items-center text-[11px]"
                      style={{
                        background: brand.tokens.background,
                        color: brand.tokens.inkMuted,
                      }}
                    >
                      kein Bild
                    </div>
                  )}
                  {reel.mealType ? (
                    <span
                      className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white backdrop-blur"
                      style={{ background: "rgba(0,0,0,0.55)" }}
                    >
                      {labelFor(MEAL_TYPE_LABELS, reel.mealType)}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-col gap-1 p-3">
                  <p
                    className="line-clamp-2 text-[12px] font-semibold leading-tight"
                    style={{ color: brand.tokens.ink }}
                  >
                    {reel.title ?? "Rezept"}
                  </p>
                  <p
                    className="text-[10.5px]"
                    style={{ color: brand.tokens.inkMuted }}
                  >
                    {reel.postedAt ? reel.postedAt.slice(0, 10) : "—"}
                    {reel.likeCount ? ` · ${reel.likeCount.toLocaleString("de-DE")} Likes` : ""}
                  </p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div
            className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-8 text-center"
            style={{
              borderColor: brand.tokens.line,
              background: brand.tokens.surface,
            }}
          >
            <span
              className="grid size-10 place-items-center rounded-full"
              style={{ background: brand.tokens.accent + "15" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <rect
                  x="3"
                  y="3"
                  width="18"
                  height="18"
                  rx="5"
                  stroke={brand.tokens.accent}
                  strokeWidth="1.6"
                />
                <circle cx="12" cy="12" r="4" stroke={brand.tokens.accent} strokeWidth="1.6" />
                <circle cx="17" cy="7" r="0.8" fill={brand.tokens.accent} />
              </svg>
            </span>
            <p
              className="max-w-[50ch] text-[13px] leading-relaxed"
              style={{ color: brand.tokens.ink }}
            >
              <span className="font-semibold">
                {activeFilterCount > 0
                  ? "Keine Reels matchen die aktuellen Filter."
                  : "Noch keine Reels in der Library."}
              </span>{" "}
              {activeFilterCount > 0
                ? "Versuch Filter zu lockern oder den Zeitraum zu erweitern."
                : `Lass mich die letzten ${TIMEFRAME_PRESETS.find((t) => t.id === timeframe)?.days ?? 90} Tage von ${brand.handle} jetzt frisch scrapen — dauert ~20–30 Sek.`}
            </p>
            {activeFilterCount === 0 ? (
              <button
                type="button"
                onClick={() => void handleQuickScrape()}
                disabled={scraping}
                className="flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-semibold text-white transition-all hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
                style={{ background: brand.tokens.accent }}
              >
                {scraping ? (
                  <>
                    <span className="size-3 animate-spin rounded-full border-[2px] border-white/40 border-t-white" />
                    Scrape laeuft…
                  </>
                ) : (
                  <>
                    Jetzt von Instagram laden
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                      <path
                        d="M3 6h6m0 0L6.5 3.5M9 6L6.5 8.5"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={resetAllFilters}
                className="flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-semibold text-white transition-all hover:opacity-90"
                style={{ background: brand.tokens.accent }}
              >
                Alle Filter zurücksetzen
              </button>
            )}
          </div>
        )}
      </section>

      {/* Section 5 — Pack-Identität (KI-Auto-Setup + Manual Overrides).
          Hier waehlt der User Title/Layout/Mood/Font. Der Master-Button
          "✨ KI-Auto-Setup" befuellt alle Felder in einem Klick basierend
          auf den gewaehlten Reels. */}
      <section className="editor-section editor-card flex flex-col gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <SectionHeader
            num="05"
            title="Pack-Identität"
            hint="Titel, Farbe, Layout, Font — manuell oder KI-vorschlagen lassen."
            brand={brand}
          />
          <div className="flex shrink-0 gap-2">
            {!designIsUntouched ? (
              <button
                type="button"
                onClick={resetDesignOverrides}
                className="rounded-full border px-3 py-2 text-[11.5px] font-semibold transition-all hover:opacity-80"
                style={{
                  borderColor: brand.tokens.line,
                  color: brand.tokens.inkMuted,
                  background: brand.tokens.surface,
                }}
              >
                ✕ Zurücksetzen
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void loadAiSuggestion()}
              disabled={!hasEnoughReels || aiLoading}
              className="flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-semibold text-white transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: brand.tokens.accent }}
              title={
                !hasEnoughReels
                  ? "Mindestens 3 Reels in der Live-Vorschau nötig"
                  : "KI wählt Titel, Layout, Farbe und Font passend zu den Reels"
              }
            >
              {aiLoading ? (
                <>
                  <span className="size-3 animate-spin rounded-full border-[1.5px] border-white/40 border-t-white" />
                  Gemini denkt nach…
                </>
              ) : (
                <>✨ KI-Auto-Setup</>
              )}
            </button>
          </div>
        </div>

        {aiError ? (
          <div
            className="rounded-xl border px-4 py-2.5 text-[12px]"
            style={{
              borderColor: "rgba(197, 48, 48, 0.3)",
              background: "rgba(254, 226, 226, 0.6)",
              color: "#9b2c2c",
            }}
          >
            {aiError}
          </div>
        ) : null}

        {/* ── Title-Input mit KI-Alternativen-Toggle ── */}
        <div className="flex flex-col gap-2">
          <label
            className="text-[11px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: brand.tokens.inkMuted }}
          >
            Pack-Titel
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={packTitle}
              onChange={(e) => setPackTitle(e.target.value)}
              placeholder='z. B. „Bowls für die Woche" — leer lassen für Auto-Titel'
              maxLength={50}
              className="editor-input flex-1"
            />
            {aiSuggestion && aiSuggestion.titles.length > 1 ? (
              <button
                type="button"
                onClick={() => setShowAlternativeTitles((v) => !v)}
                className="shrink-0 rounded-xl border-2 px-3 py-2.5 text-[12px] font-semibold transition-all"
                style={{
                  borderColor: brand.tokens.line,
                  color: brand.tokens.inkMuted,
                  background: brand.tokens.surface,
                }}
                title="Weitere KI-Titel-Vorschläge anzeigen"
              >
                {showAlternativeTitles ? "✕" : "✨"} {aiSuggestion.titles.length} Vorschläge
              </button>
            ) : null}
          </div>
          {showAlternativeTitles && aiSuggestion ? (
            <div className="mt-1 flex flex-col gap-1.5 rounded-xl border bg-white p-2.5"
              style={{ borderColor: brand.tokens.line }}
            >
              {aiSuggestion.titles.map((t, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setPackTitle(t);
                    setShowAlternativeTitles(false);
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] transition-colors hover:bg-current/5"
                  style={{ color: brand.tokens.ink }}
                >
                  <span>{t}</span>
                  <span
                    className="font-mono text-[10px] uppercase tracking-[0.14em]"
                    style={{ color: brand.tokens.inkMuted }}
                  >
                    {i === 0 ? "★ Top-Pick" : `Vorschlag ${i + 1}`}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* ── Layout-Picker ── */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <label
              className="text-[11px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: brand.tokens.inkMuted }}
            >
              Layout
            </label>
            {aiSuggestion ? (
              <span
                className="text-[10.5px]"
                style={{ color: brand.tokens.inkMuted }}
              >
                ✨ Empfohlen: <span style={{ color: brand.tokens.ink, fontWeight: 600 }}>{layoutPresets.find((l) => l.id === aiSuggestion.layout)?.title}</span>
                {" — "}
                {aiSuggestion.layoutReason}
              </span>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {layoutPresets.map((l) => {
              const active = packLayout === l.id;
              const recommended = aiSuggestion?.layout === l.id;
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setPackLayout(active ? null : l.id)}
                  className="group flex flex-col items-stretch gap-1.5 rounded-2xl border-2 p-2.5 text-left transition-all"
                  style={{
                    borderColor: active
                      ? brand.tokens.accent
                      : brand.tokens.line,
                    background: active
                      ? brand.tokens.accent + "12"
                      : brand.tokens.surface,
                  }}
                  title={l.description}
                >
                  <LayoutThumbnail
                    layout={l.id}
                    accent={brand.tokens.accent}
                    inkSoft={brand.tokens.inkMuted}
                    surface={brand.tokens.surface}
                  />
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className="text-[11.5px] font-semibold"
                      style={{
                        color: active ? brand.tokens.accent : brand.tokens.ink,
                      }}
                    >
                      {l.title}
                    </span>
                    {recommended && !active ? (
                      <span
                        className="font-mono text-[9px]"
                        style={{ color: brand.tokens.accent }}
                      >
                        ✨
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Mood-Picker (8 Presets + Custom) ── */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <label
              className="text-[11px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: brand.tokens.inkMuted }}
            >
              Farbe / Mood
            </label>
            {aiSuggestion ? (
              <span
                className="text-[10.5px]"
                style={{ color: brand.tokens.inkMuted }}
              >
                ✨ Empfohlen: <span style={{ color: brand.tokens.ink, fontWeight: 600 }}>{moodPresets.find((m) => m.id === aiSuggestion.moodId)?.label}</span>
                {" — "}
                {aiSuggestion.moodReason}
              </span>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {moodPresets.map((preset) => {
              const active =
                !packCustomMood && packMoodId === preset.id;
              const recommended = aiSuggestion?.moodId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setPackMoodId(active ? null : preset.id);
                    setPackCustomMood(null);
                  }}
                  className="flex flex-col items-stretch gap-1.5 rounded-2xl border-2 p-2.5 text-left transition-all"
                  style={{
                    borderColor: active
                      ? preset.mood.accent
                      : brand.tokens.line,
                    background: brand.tokens.surface,
                  }}
                >
                  <div
                    className="flex h-9 overflow-hidden rounded-lg"
                    style={{ background: preset.mood.background }}
                  >
                    <span
                      className="flex-1"
                      style={{ background: preset.mood.background }}
                    />
                    <span
                      className="w-1/3"
                      style={{ background: preset.mood.accent }}
                    />
                    <span
                      className="w-[10%]"
                      style={{ background: preset.mood.ink }}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className="text-[11.5px] font-semibold"
                      style={{ color: preset.mood.ink }}
                    >
                      {preset.label}
                    </span>
                    {recommended && !active ? (
                      <span
                        className="font-mono text-[9px]"
                        style={{ color: brand.tokens.accent }}
                      >
                        ✨
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Custom-Mood-Toggle */}
          <details
            className="group mt-1 rounded-xl border border-dashed px-3 py-2"
            style={{ borderColor: brand.tokens.line }}
            open={!!packCustomMood}
          >
            <summary
              className="flex cursor-pointer items-center justify-between text-[12px] font-semibold"
              onClick={(e) => {
                e.preventDefault();
                if (packCustomMood) {
                  setPackCustomMood(null);
                } else {
                  const seed =
                    moodPresets.find((m) => m.id === packMoodId)?.mood ??
                    moodPresets[0].mood;
                  setPackCustomMood({ ...seed });
                  setPackMoodId(null);
                }
              }}
              style={{ color: brand.tokens.inkMuted }}
            >
              <span>Eigene Farben (4 Picker)</span>
              <span
                className="font-mono text-[10px] uppercase tracking-[0.14em]"
                style={{ color: packCustomMood ? brand.tokens.accent : brand.tokens.inkMuted }}
              >
                {packCustomMood ? "Aktiv" : "Aktivieren"}
              </span>
            </summary>
            {packCustomMood ? (
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <ColorPickerInput
                  label="Hintergrund"
                  value={packCustomMood.background}
                  onChange={(v) =>
                    setPackCustomMood({ ...packCustomMood, background: v })
                  }
                  brand={brand}
                />
                <ColorPickerInput
                  label="Akzent"
                  value={packCustomMood.accent}
                  onChange={(v) =>
                    setPackCustomMood({ ...packCustomMood, accent: v })
                  }
                  brand={brand}
                />
                <ColorPickerInput
                  label="Tinte"
                  value={packCustomMood.ink}
                  onChange={(v) =>
                    setPackCustomMood({ ...packCustomMood, ink: v })
                  }
                  brand={brand}
                />
                <ColorPickerInput
                  label="Tinte weich"
                  value={packCustomMood.inkSoft}
                  onChange={(v) =>
                    setPackCustomMood({ ...packCustomMood, inkSoft: v })
                  }
                  brand={brand}
                />
              </div>
            ) : null}
          </details>
        </div>

        {/* ── Font-Picker ── */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <label
              className="text-[11px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: brand.tokens.inkMuted }}
            >
              Display-Font
            </label>
            {aiSuggestion ? (
              <span
                className="text-[10.5px]"
                style={{ color: brand.tokens.inkMuted }}
              >
                ✨ Empfohlen: <span style={{ color: brand.tokens.ink, fontWeight: 600 }}>{displayFontOptions.find((f) => f.id === aiSuggestion.fontId)?.label}</span>
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {displayFontOptions.map((f) => {
              const active = packFont === f.id;
              const recommended = aiSuggestion?.fontId === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setPackFont(active ? null : f.id)}
                  className="flex flex-col items-start gap-0.5 rounded-xl border-2 px-3 py-2 text-left transition-all"
                  style={{
                    borderColor: active
                      ? brand.tokens.accent
                      : brand.tokens.line,
                    background: active
                      ? brand.tokens.accent + "10"
                      : brand.tokens.surface,
                  }}
                >
                  <span
                    className="flex items-center gap-1.5 text-[14px] font-semibold"
                    style={{
                      color: active ? brand.tokens.accent : brand.tokens.ink,
                    }}
                  >
                    {f.label}
                    {recommended && !active ? (
                      <span className="font-mono text-[9px]" style={{ color: brand.tokens.accent }}>✨</span>
                    ) : null}
                  </span>
                  <span
                    className="text-[10.5px]"
                    style={{ color: brand.tokens.inkMuted }}
                  >
                    {f.hint}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Optional Details (collapsible) ── */}
        <details
          className="group rounded-xl border border-dashed px-4 py-3"
          style={{ borderColor: brand.tokens.line }}
          open={showOptionalDetails}
          onToggle={(e) => setShowOptionalDetails((e.target as HTMLDetailsElement).open)}
        >
          <summary
            className="flex cursor-pointer items-center justify-between text-[12.5px] font-semibold"
            style={{ color: brand.tokens.inkMuted }}
          >
            <span className="flex items-center gap-2">
              <span>Optional: Subtitle, Tagline, Beschreibung, Kategorie</span>
              <span
                className="rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.14em]"
                style={{
                  background: brand.tokens.line,
                  color: brand.tokens.inkMuted,
                }}
              >
                Auto wenn leer
              </span>
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] group-open:hidden">
              aufklappen
            </span>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.16em] group-open:inline">
              zuklappen
            </span>
          </summary>
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: brand.tokens.inkMuted }}>
                Untertitel
              </label>
              <input
                type="text"
                className="editor-input"
                value={packSubtitle}
                onChange={(e) => setPackSubtitle(e.target.value)}
                placeholder="z. B. „High-Protein Frühstücke unter 400 kcal"
                maxLength={80}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: brand.tokens.inkMuted }}>
                Tagline
              </label>
              <input
                type="text"
                className="editor-input"
                value={packTagline}
                onChange={(e) => setPackTagline(e.target.value)}
                placeholder="z. B. „Overnight Oats, Protein-Pancakes, Frischkäse-Toast"
                maxLength={140}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: brand.tokens.inkMuted }}>
                Beschreibung
              </label>
              <textarea
                className="editor-input min-h-[80px] resize-none"
                value={packDescription}
                onChange={(e) => setPackDescription(e.target.value)}
                placeholder="2-3 Sätze in deiner Stimme..."
                maxLength={300}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: brand.tokens.inkMuted }}>
                Kategorie
              </label>
              <input
                type="text"
                className="editor-input"
                value={packCategory}
                onChange={(e) => setPackCategory(e.target.value)}
                placeholder="z. B. Frühstück, Snacks, Mealprep"
                maxLength={40}
              />
            </div>
          </div>
        </details>

        {/* ── Hintergrund-Style (Surface) ── */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <label
              className="text-[11px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: brand.tokens.inkMuted }}
            >
              Hintergrund-Style
            </label>
            {aiSuggestion ? (
              <span
                className="text-[10.5px]"
                style={{ color: brand.tokens.inkMuted }}
              >
                ✨ Empfohlen:{" "}
                <span style={{ color: brand.tokens.ink, fontWeight: 600 }}>
                  {aiSuggestion.surfaceType === "pattern"
                    ? `Pattern · ${PATTERN_CATALOG.find((p) => p.id === aiSuggestion.patternId)?.label ?? aiSuggestion.patternId}`
                    : aiSuggestion.surfaceType === "gradient"
                      ? "Farbverlauf"
                      : "Solid (klassisch)"}
                </span>
                {aiSuggestion.surfaceReason
                  ? ` — ${aiSuggestion.surfaceReason}`
                  : null}
              </span>
            ) : null}
          </div>
          {/* Type-Tabs */}
          <div className="flex gap-2">
            {(
              [
                { id: "solid", label: "Solid", hint: "Klassisch & sauber" },
                { id: "gradient", label: "Farbverlauf", hint: "Premium-Feel" },
                { id: "pattern", label: "Muster", hint: "Signature-Look" },
              ] as const
            ).map((t) => {
              const active = packSurfaceType === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setPackSurfaceType(t.id)}
                  className="flex flex-1 flex-col items-start gap-0.5 rounded-xl border-2 px-3 py-2.5 text-left transition-all"
                  style={{
                    borderColor: active
                      ? brand.tokens.accent
                      : brand.tokens.line,
                    background: active
                      ? brand.tokens.accent + "12"
                      : brand.tokens.surface,
                  }}
                >
                  <span
                    className="text-[13px] font-semibold"
                    style={{
                      color: active ? brand.tokens.accent : brand.tokens.ink,
                    }}
                  >
                    {t.label}
                  </span>
                  <span
                    className="text-[10.5px]"
                    style={{ color: brand.tokens.inkMuted }}
                  >
                    {t.hint}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Gradient-Picker */}
          {packSurfaceType === "gradient" ? (
            <div
              className="flex flex-col gap-3 rounded-xl border p-3"
              style={{
                borderColor: brand.tokens.line,
                background: brand.tokens.surface,
              }}
            >
              <div className="flex flex-wrap gap-2">
                {GRADIENT_PRESETS.map((preset) => {
                  const active =
                    packGradient.stops[0]?.color === preset.stops[0] &&
                    packGradient.stops[packGradient.stops.length - 1]?.color ===
                      preset.stops[preset.stops.length - 1];
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() =>
                        setPackGradient((g) => ({
                          ...g,
                          stops: preset.stops.map((color, i) => ({
                            color,
                            position: i / (preset.stops.length - 1),
                          })),
                        }))
                      }
                      className="flex flex-col items-stretch gap-1 rounded-lg border-2 p-2 transition-all"
                      style={{
                        borderColor: active
                          ? brand.tokens.accent
                          : brand.tokens.line,
                        background: "white",
                        minWidth: 90,
                      }}
                    >
                      <div
                        className="h-7 rounded"
                        style={{
                          background: `linear-gradient(135deg, ${preset.stops.join(", ")})`,
                        }}
                      />
                      <span
                        className="text-[10.5px] font-semibold"
                        style={{ color: brand.tokens.ink }}
                      >
                        {preset.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-[11.5px]" style={{ color: brand.tokens.inkMuted }}>
                  <span>Typ:</span>
                  <select
                    value={packGradient.variant}
                    onChange={(e) =>
                      setPackGradient((g) => ({
                        ...g,
                        variant: e.target.value as "linear" | "radial",
                      }))
                    }
                    className="rounded border bg-white px-2 py-1 text-[11.5px]"
                    style={{ borderColor: brand.tokens.line, color: brand.tokens.ink }}
                  >
                    <option value="linear">Linear</option>
                    <option value="radial">Radial</option>
                  </select>
                </label>
                {packGradient.variant === "linear" ? (
                  <label className="flex items-center gap-2 text-[11.5px]" style={{ color: brand.tokens.inkMuted }}>
                    <span>Winkel: {packGradient.angle}°</span>
                    <input
                      type="range"
                      min={0}
                      max={359}
                      value={packGradient.angle}
                      onChange={(e) =>
                        setPackGradient((g) => ({
                          ...g,
                          angle: parseInt(e.target.value),
                        }))
                      }
                      className="w-24"
                      style={{ accentColor: brand.tokens.accent }}
                    />
                  </label>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {packGradient.stops.map((stop, i) => (
                  <ColorPickerInput
                    key={i}
                    label={`Stop ${i + 1}`}
                    value={stop.color}
                    onChange={(v) =>
                      setPackGradient((g) => ({
                        ...g,
                        stops: g.stops.map((s, idx) =>
                          idx === i ? { ...s, color: v } : s
                        ),
                      }))
                    }
                    brand={brand}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {/* Pattern-Picker */}
          {packSurfaceType === "pattern" ? (
            <div
              className="flex flex-col gap-3 rounded-xl border p-3"
              style={{
                borderColor: brand.tokens.line,
                background: brand.tokens.surface,
              }}
            >
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {PATTERN_CATALOG.map((p) => {
                  const active = packPattern.patternId === p.id;
                  const recommended =
                    aiSuggestion?.surfaceType === "pattern" &&
                    aiSuggestion.patternId === p.id;
                  const previewCss = surfaceToCss({
                    type: "pattern",
                    patternId: p.id,
                    baseColor: packPattern.baseColor,
                    accentColor: packPattern.accentColor,
                    scale: 0.8,
                    opacity: packPattern.opacity,
                  });
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        setPackPattern((pp) => ({ ...pp, patternId: p.id }))
                      }
                      className="flex flex-col items-stretch gap-1 rounded-lg border-2 p-1.5 transition-all"
                      style={{
                        borderColor: active
                          ? brand.tokens.accent
                          : brand.tokens.line,
                        background: "white",
                      }}
                      title={p.description}
                    >
                      <div
                        className="h-10 rounded"
                        style={{ background: previewCss }}
                      />
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className="text-[10.5px] font-semibold"
                          style={{
                            color: active
                              ? brand.tokens.accent
                              : brand.tokens.ink,
                          }}
                        >
                          {p.label}
                        </span>
                        {recommended && !active ? (
                          <span
                            className="font-mono text-[9px]"
                            style={{ color: brand.tokens.accent }}
                          >
                            ✨
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <ColorPickerInput
                  label="Hintergrund"
                  value={packPattern.baseColor}
                  onChange={(v) =>
                    setPackPattern((p) => ({ ...p, baseColor: v }))
                  }
                  brand={brand}
                />
                <ColorPickerInput
                  label="Pattern-Farbe"
                  value={packPattern.accentColor}
                  onChange={(v) =>
                    setPackPattern((p) => ({ ...p, accentColor: v }))
                  }
                  brand={brand}
                />
                <label className="flex flex-col gap-1">
                  <span
                    className="text-[10.5px] font-semibold uppercase tracking-[0.14em]"
                    style={{ color: brand.tokens.inkMuted }}
                  >
                    Skalierung: {packPattern.scale.toFixed(1)}×
                  </span>
                  <input
                    type="range"
                    min={0.5}
                    max={2.5}
                    step={0.1}
                    value={packPattern.scale}
                    onChange={(e) =>
                      setPackPattern((p) => ({
                        ...p,
                        scale: parseFloat(e.target.value),
                      }))
                    }
                    style={{ accentColor: brand.tokens.accent }}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span
                    className="text-[10.5px] font-semibold uppercase tracking-[0.14em]"
                    style={{ color: brand.tokens.inkMuted }}
                  >
                    Intensität: {Math.round(packPattern.opacity * 100)}%
                  </span>
                  <input
                    type="range"
                    min={0.2}
                    max={1}
                    step={0.05}
                    value={packPattern.opacity}
                    onChange={(e) =>
                      setPackPattern((p) => ({
                        ...p,
                        opacity: parseFloat(e.target.value),
                      }))
                    }
                    style={{ accentColor: brand.tokens.accent }}
                  />
                </label>
              </div>
              <p
                className="text-[10.5px] leading-relaxed"
                style={{ color: brand.tokens.inkMuted }}
              >
                Hinweis: Pattern wird im Web in voller Pracht angezeigt. PDF
                fällt aus Print-Sicherheitsgründen auf die Hintergrund-Farbe
                zurück — alles bleibt CMYK-tauglich.
              </p>
            </div>
          ) : null}
        </div>

        {/* ── Live Mood-Preview-Strip ── */}
        {resolvedMood ? (
          <div
            className="flex items-stretch gap-0 overflow-hidden rounded-xl border"
            style={{ borderColor: brand.tokens.line }}
          >
            <div
              className="flex-1 px-3 py-2.5"
              style={{
                background: resolvedSurface
                  ? surfaceToCss(resolvedSurface)
                  : resolvedMood.background,
                color: resolvedMood.ink,
              }}
            >
              <p className="text-[11px] uppercase tracking-[0.16em] opacity-70">
                Live-Vorschau Pack-Cover-Mood
              </p>
              <p
                className="text-[16px] font-semibold leading-tight"
                style={{
                  fontFamily:
                    packFont === "dm-serif"
                      ? "var(--font-dm-serif, serif)"
                      : packFont === "inter-tight"
                        ? "var(--font-inter-tight, sans-serif)"
                        : "var(--font-fraunces, serif)",
                }}
              >
                {packTitle.trim() || "Pack-Titel"}
              </p>
            </div>
            <div
              className="w-12"
              style={{ background: resolvedMood.accent }}
              title="Akzent"
            />
            <div
              className="w-6"
              style={{ background: resolvedMood.ink }}
              title="Tinte"
            />
          </div>
        ) : null}
      </section>

      {/* Save bar */}
      <div className="sticky bottom-4 z-10">
        <div
          className="flex flex-col gap-3 rounded-2xl border bg-white/95 p-5 shadow-[0_18px_40px_-16px_rgba(26,18,11,0.18)] backdrop-blur-md sm:flex-row sm:items-center sm:justify-between"
          style={{ borderColor: brand.tokens.line }}
        >
          <div className="flex flex-col gap-0.5">
            <span
              className="text-[12px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: brand.tokens.inkMuted }}
            >
              {reels && reels.length >= 3
                ? `Bereit zu generieren · ${reels.length} ${reelWord}`
                : "Wähle mindestens 3 Reels"}
            </span>
            <span
              className="text-[11px]"
              style={{ color: brand.tokens.inkMuted }}
            >
              {activeFilterCount > 0
                ? `${activeFilterCount} Filter aktiv · Pack-Titel, Beschreibung & Karten in ~30–60 Sek`
                : "Pack-Titel, Beschreibung & Karten werden in ~30–60 Sek erstellt"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={generating || !reels || reels.length < 3}
            className="editor-button-primary"
            style={{
              background: brand.tokens.accent,
              color: "white",
            }}
          >
            {generating ? (
              <>
                <span className="size-3.5 animate-spin rounded-full border-[2px] border-white/40 border-t-white" />
                Pack wird gebaut…
              </>
            ) : (
              <>
                Pack generieren
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                  <path
                    d="M3 7h8m0 0L7.5 3.5M11 7l-3.5 3.5"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </>
            )}
          </button>
        </div>
        {error ? (
          <p
            className="mt-2 rounded-xl border px-4 py-2.5 text-[12.5px]"
            style={{
              borderColor: "#dc2626",
              background: "#fee2e2",
              color: "#991b1b",
            }}
          >
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

// ─── Sub-Components ────────────────────────────────────────────────────────

function SectionHeader({
  num,
  title,
  hint,
  brand,
}: {
  num: string;
  title: string;
  hint: string;
  brand: Brand;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="editor-section-number">{num}</span>
      <div className="flex flex-col gap-1">
        <h2
          className="font-display text-[22px] leading-none tracking-[-0.01em]"
          style={{ color: brand.tokens.ink }}
        >
          {title}
        </h2>
        <p className="text-[12.5px]" style={{ color: brand.tokens.inkMuted }}>
          {hint}
        </p>
      </div>
    </div>
  );
}

// FilterGroup — eine Chip-Reihe pro Tag-Dimension. Smart-Hide: rendert
// nur Chips fuer Werte mit count > 0. Counter im Chip. Optional
// collapsible (default-collapsed) fuer weniger wichtige Dimensionen.
function FilterGroup({
  title,
  buckets,
  labels,
  selected,
  onToggle,
  brand,
  collapsible = false,
}: {
  title: string;
  buckets: TagBucket[];
  labels: Record<string, string>;
  selected: string[];
  onToggle: (value: string) => void;
  brand: Brand;
  collapsible?: boolean;
}) {
  const [open, setOpen] = useState(!collapsible);
  // Smart-Hide: leere Sektion komplett raus
  if (buckets.length === 0) return null;

  const activeCount = selected.length;

  return (
    <div className="flex flex-col gap-2">
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center justify-between gap-2 text-left"
        >
          <span className="flex items-center gap-2">
            <span
              className="text-[11px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: brand.tokens.inkMuted }}
            >
              {title}
            </span>
            {activeCount > 0 ? (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{
                  background: brand.tokens.accent + "20",
                  color: brand.tokens.accent,
                }}
              >
                {activeCount} aktiv
              </span>
            ) : (
              <span
                className="text-[10.5px]"
                style={{ color: brand.tokens.inkMuted }}
              >
                {buckets.length} Optionen
              </span>
            )}
          </span>
          <span
            className="font-mono text-[10px] uppercase tracking-[0.16em]"
            style={{ color: brand.tokens.inkMuted }}
          >
            {open ? "zuklappen" : "aufklappen"}
          </span>
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: brand.tokens.inkMuted }}
          >
            {title}
          </span>
          {activeCount > 0 ? (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{
                background: brand.tokens.accent + "20",
                color: brand.tokens.accent,
              }}
            >
              {activeCount} aktiv
            </span>
          ) : null}
        </div>
      )}

      {open ? (
        <div className="flex flex-wrap gap-2">
          {buckets.map((b) => {
            const active = selected.includes(b.value);
            return (
              <button
                key={b.value}
                type="button"
                onClick={() => onToggle(b.value)}
                className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-all"
                style={{
                  borderColor: active
                    ? brand.tokens.accent
                    : brand.tokens.line,
                  background: active
                    ? brand.tokens.accent + "14"
                    : brand.tokens.surface,
                  color: active ? brand.tokens.accent : brand.tokens.ink,
                }}
              >
                {active ? "✓ " : ""}
                {labelFor(labels, b.value)}
                <span
                  className="font-mono text-[10px] opacity-60"
                  style={{ color: active ? brand.tokens.accent : brand.tokens.inkMuted }}
                >
                  {b.count}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

// TimeFilterGroup — Sonderfall: nur EIN Time-Bucket aktiv (kein Multi-
// Select, weil "<=15" und "<=30" semantisch ueberlappen).
function TimeFilterGroup({
  buckets,
  selected,
  onSelect,
  brand,
}: {
  buckets: TagBucket[];
  selected: string | null;
  onSelect: (value: string) => void;
  brand: Brand;
}) {
  if (buckets.length === 0) return null;
  // Stable sort by time-bucket-order, NICHT by count (count sortiert nach
  // Haeufigkeit, aber Time-Buckets brauchen logische Reihenfolge).
  const ORDER = ["<=15", "<=30", "<=60", ">60"];
  const sorted = [...buckets].sort(
    (a, b) => ORDER.indexOf(a.value) - ORDER.indexOf(b.value)
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.16em]"
          style={{ color: brand.tokens.inkMuted }}
        >
          Zubereitungszeit
        </span>
        {selected ? (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{
              background: brand.tokens.accent + "20",
              color: brand.tokens.accent,
            }}
          >
            1 aktiv
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {sorted.map((b) => {
          const active = selected === b.value;
          return (
            <button
              key={b.value}
              type="button"
              onClick={() => onSelect(b.value)}
              className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-all"
              style={{
                borderColor: active ? brand.tokens.accent : brand.tokens.line,
                background: active
                  ? brand.tokens.accent + "14"
                  : brand.tokens.surface,
                color: active ? brand.tokens.accent : brand.tokens.ink,
              }}
            >
              {active ? "✓ " : ""}
              {labelFor(TIME_LABELS, b.value)}
              <span
                className="font-mono text-[10px] opacity-60"
                style={{ color: active ? brand.tokens.accent : brand.tokens.inkMuted }}
              >
                {b.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Layout-Thumbnail (Mini-SVG-Vorschau pro Layout) ─────────────────────

function LayoutThumbnail({
  layout,
  accent,
  inkSoft,
  surface,
}: {
  layout: CardLayout;
  accent: string;
  inkSoft: string;
  surface: string;
}) {
  // Mini-SVG-Vorschau (70×52) die das Layout-Konzept andeutet. Kein perfekter
  // Render, aber der User erkennt den Charakter (Sidebar, Full-Bleed, etc).
  const base = (
    <rect x="0" y="0" width="70" height="52" rx="4" fill={surface} />
  );
  let body: React.ReactNode;
  switch (layout) {
    case "patisserie":
      // Linke Sidebar in Akzentfarbe + Polaroid + 4 Body-Zeilen rechts
      body = (
        <>
          <rect x="0" y="0" width="24" height="52" fill={accent} />
          <rect x="4" y="6" width="16" height="14" rx="1" fill={surface} opacity="0.95" />
          <rect x="28" y="6" width="38" height="3" rx="1" fill={accent} />
          <rect x="28" y="12" width="30" height="2" rx="1" fill={inkSoft} opacity="0.4" />
          <rect x="28" y="18" width="34" height="2" rx="1" fill={inkSoft} opacity="0.4" />
          <rect x="28" y="22" width="32" height="2" rx="1" fill={inkSoft} opacity="0.4" />
          <rect x="28" y="26" width="33" height="2" rx="1" fill={inkSoft} opacity="0.4" />
        </>
      );
      break;
    case "minimal":
      // Full-Bleed Hero oben + Spec-Strip + Body
      body = (
        <>
          <rect x="0" y="0" width="70" height="24" fill={accent} opacity="0.6" />
          <rect x="6" y="14" width="38" height="4" rx="1" fill={surface} />
          <rect x="4" y="28" width="62" height="3" rx="1.5" fill={accent} />
          <rect x="4" y="34" width="58" height="2" rx="1" fill={inkSoft} opacity="0.4" />
          <rect x="4" y="38" width="52" height="2" rx="1" fill={inkSoft} opacity="0.4" />
          <rect x="4" y="42" width="60" height="2" rx="1" fill={inkSoft} opacity="0.4" />
        </>
      );
      break;
    case "vital":
      // 3 gestapelte Cards
      body = (
        <>
          <rect x="4" y="4" width="62" height="12" rx="2" fill={accent} opacity="0.5" />
          <rect x="4" y="20" width="62" height="12" rx="2" fill={accent} opacity="0.85" />
          <circle cx="14" cy="26" r="3" fill={surface} />
          <circle cx="24" cy="26" r="3" fill={surface} />
          <circle cx="34" cy="26" r="3" fill={surface} />
          <rect x="4" y="36" width="62" height="12" rx="2" fill={inkSoft} opacity="0.25" />
        </>
      );
      break;
    case "dashboard":
      // Notion-Style Data-Rows
      body = (
        <>
          <rect x="4" y="4" width="24" height="5" rx="1.5" fill={accent} />
          <rect x="4" y="14" width="62" height="6" rx="1" fill={inkSoft} opacity="0.15" />
          <rect x="4" y="22" width="62" height="6" rx="1" fill={inkSoft} opacity="0.15" />
          <rect x="4" y="30" width="62" height="6" rx="1" fill={inkSoft} opacity="0.15" />
          <rect x="4" y="38" width="62" height="6" rx="1" fill={inkSoft} opacity="0.15" />
        </>
      );
      break;
    case "amber":
      // Sunset-Editorial: Hero zentriert mit Halo + Stat-Ribbon
      body = (
        <>
          <circle cx="35" cy="18" r="14" fill={accent} opacity="0.7" />
          <circle cx="35" cy="18" r="9" fill={accent} />
          <rect x="4" y="36" width="62" height="4" rx="1" fill={accent} opacity="0.4" />
          <rect x="4" y="42" width="42" height="3" rx="1" fill={inkSoft} opacity="0.4" />
        </>
      );
      break;
    case "editorial":
      // Mikronaehrstoff-Banner oben + Hero + Body
      body = (
        <>
          <rect x="4" y="4" width="62" height="4" rx="1" fill={accent} />
          <rect x="4" y="12" width="30" height="24" rx="2" fill={accent} opacity="0.5" />
          <rect x="38" y="12" width="28" height="3" rx="1" fill={inkSoft} opacity="0.6" />
          <rect x="38" y="18" width="22" height="2" rx="1" fill={inkSoft} opacity="0.4" />
          <rect x="38" y="22" width="26" height="2" rx="1" fill={inkSoft} opacity="0.4" />
          <rect x="38" y="26" width="24" height="2" rx="1" fill={inkSoft} opacity="0.4" />
          <rect x="4" y="40" width="62" height="2" rx="1" fill={inkSoft} opacity="0.3" />
          <rect x="4" y="44" width="50" height="2" rx="1" fill={inkSoft} opacity="0.3" />
        </>
      );
      break;
    case "sport":
      // Macro-Bars + Timeline
      body = (
        <>
          <rect x="4" y="4" width="62" height="4" rx="2" fill={inkSoft} opacity="0.2" />
          <rect x="4" y="4" width="40" height="4" rx="2" fill={accent} />
          <rect x="4" y="12" width="62" height="4" rx="2" fill={inkSoft} opacity="0.2" />
          <rect x="4" y="12" width="28" height="4" rx="2" fill={accent} />
          <rect x="4" y="20" width="62" height="4" rx="2" fill={inkSoft} opacity="0.2" />
          <rect x="4" y="20" width="34" height="4" rx="2" fill={accent} />
          <circle cx="8" cy="34" r="2.5" fill={accent} />
          <line x1="8" y1="36.5" x2="8" y2="44" stroke={accent} strokeWidth="1.5" />
          <circle cx="8" cy="46" r="2.5" fill={accent} />
          <rect x="14" y="32" width="40" height="3" rx="1" fill={inkSoft} opacity="0.4" />
          <rect x="14" y="44" width="36" height="3" rx="1" fill={inkSoft} opacity="0.4" />
        </>
      );
      break;
    case "vinyl":
      // 12"-Schallplatte mit Center-Label (Hero) + Tracklist drunter
      body = (
        <>
          {/* Schwarze Disc */}
          <circle cx="35" cy="22" r="18" fill="#0a0a0a" />
          {/* Grooves */}
          <circle cx="35" cy="22" r="15" fill="none" stroke="#1f1f1f" strokeWidth="0.4" />
          <circle cx="35" cy="22" r="12" fill="none" stroke="#1f1f1f" strokeWidth="0.4" />
          <circle cx="35" cy="22" r="9" fill="none" stroke="#1f1f1f" strokeWidth="0.4" />
          {/* Center Label */}
          <circle cx="35" cy="22" r="6" fill={accent} />
          {/* Spindle hole */}
          <circle cx="35" cy="22" r="0.8" fill="#fafafa" />
          {/* Tracklist Lines */}
          <rect x="4" y="44" width="6" height="1.5" rx="0.5" fill={accent} />
          <rect x="12" y="44" width="20" height="1.5" rx="0.5" fill={inkSoft} opacity="0.4" />
          <rect x="38" y="44" width="6" height="1.5" rx="0.5" fill={accent} />
          <rect x="46" y="44" width="20" height="1.5" rx="0.5" fill={inkSoft} opacity="0.4" />
          <rect x="4" y="48" width="6" height="1.5" rx="0.5" fill={accent} />
          <rect x="12" y="48" width="16" height="1.5" rx="0.5" fill={inkSoft} opacity="0.4" />
        </>
      );
      break;
    case "newspaper":
      // Broadsheet: Masthead, Hero+Headline, 3-Col Body, Spreadsheet-Footer
      body = (
        <>
          {/* Masthead doppellinie */}
          <rect x="3" y="3" width="64" height="1" fill={inkSoft} />
          <rect x="3" y="5" width="64" height="0.4" fill={inkSoft} opacity="0.5" />
          {/* Title-Italic Hint */}
          <rect x="3" y="7.5" width="30" height="2" rx="0.5" fill={accent} />
          {/* Hero block */}
          <rect x="3" y="12" width="30" height="14" fill={accent} opacity="0.5" />
          {/* Right column lines */}
          <rect x="36" y="12" width="22" height="2.5" rx="0.5" fill={accent} />
          <rect x="36" y="16" width="20" height="1.2" rx="0.3" fill={inkSoft} opacity="0.3" />
          <rect x="36" y="18.5" width="18" height="1" rx="0.3" fill={inkSoft} opacity="0.3" />
          <rect x="36" y="21" width="20" height="1" rx="0.3" fill={inkSoft} opacity="0.3" />
          <rect x="36" y="23.5" width="16" height="1" rx="0.3" fill={inkSoft} opacity="0.3" />
          {/* 3-col body hint */}
          <rect x="3" y="29" width="18" height="0.6" fill={inkSoft} opacity="0.4" />
          <rect x="3" y="31" width="14" height="0.6" fill={inkSoft} opacity="0.4" />
          <rect x="3" y="33" width="16" height="0.6" fill={inkSoft} opacity="0.4" />
          <rect x="25" y="29" width="18" height="0.6" fill={inkSoft} opacity="0.4" />
          <rect x="25" y="31" width="14" height="0.6" fill={inkSoft} opacity="0.4" />
          <rect x="25" y="33" width="16" height="0.6" fill={inkSoft} opacity="0.4" />
          <rect x="47" y="29" width="18" height="0.6" fill={inkSoft} opacity="0.4" />
          <rect x="47" y="31" width="14" height="0.6" fill={inkSoft} opacity="0.4" />
          <rect x="47" y="33" width="16" height="0.6" fill={inkSoft} opacity="0.4" />
          {/* Spreadsheet footer doppellinie */}
          <rect x="3" y="40" width="64" height="1" fill={inkSoft} />
          <rect x="3" y="42" width="64" height="0.4" fill={inkSoft} opacity="0.5" />
          {/* Spreadsheet cells (Macros + Mikros) */}
          <rect x="3" y="44" width="3" height="2" fill={accent} />
          <rect x="7" y="44" width="3" height="2" fill={accent} />
          <rect x="11" y="44" width="3" height="2" fill={accent} />
          <rect x="15" y="44" width="3" height="2" fill={accent} />
          <rect x="40" y="44" width="3" height="2" fill={accent} opacity="0.7" />
          <rect x="44" y="44" width="3" height="2" fill={accent} opacity="0.7" />
          <rect x="48" y="44" width="3" height="2" fill={accent} opacity="0.7" />
        </>
      );
      break;
  }
  return (
    <svg
      viewBox="0 0 70 52"
      width="100%"
      height="auto"
      style={{ aspectRatio: "70/52", display: "block" }}
    >
      {base}
      {body}
    </svg>
  );
}

// ─── Color-Picker-Input (HTML color + Hex-Text) ──────────────────────────

function ColorPickerInput({
  label,
  value,
  onChange,
  brand,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  brand: Brand;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span
        className="text-[10.5px] font-semibold uppercase tracking-[0.14em]"
        style={{ color: brand.tokens.inkMuted }}
      >
        {label}
      </span>
      <div
        className="flex items-center gap-1.5 rounded-lg border bg-white px-1.5 py-1"
        style={{ borderColor: brand.tokens.line }}
      >
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="size-6 cursor-pointer rounded border-0 bg-transparent p-0"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-[11px] font-mono uppercase outline-none"
          style={{ color: brand.tokens.ink }}
          maxLength={7}
        />
      </div>
    </label>
  );
}
