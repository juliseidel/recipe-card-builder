"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { Brand } from "@/lib/brands";

// Auto-Pack-Form fuer den /[brand]/new Auto-Tab. User waehlt Filter
// (Timeframe + MealTypes + Limit + Sortierung), Live-Preview-Grid zeigt
// die matchenden Reels, "Pack generieren" baut Pack + Recipes + Heroes.

type ReelPreview = {
  id: string;
  title: string | null;
  displayUrl: string | null;
  postUrl: string;
  postedAt: string | null;
  mealType: string | null;
  cuisine: string | null;
  likeCount: number | null;
  viewCount: number | null;
};

const TIMEFRAME_PRESETS = [
  { id: "2w", label: "Letzte 2 Wochen", days: 14 },
  { id: "1m", label: "Letzter Monat", days: 30 },
  { id: "3m", label: "Letzte 3 Monate", days: 90 },
  { id: "1y", label: "Letztes Jahr", days: 365 },
  { id: "all", label: "Alle Zeit", days: 0 },
] as const;

const MEAL_TYPES = [
  { id: "breakfast", label: "Frühstück" },
  { id: "lunch", label: "Mittag" },
  { id: "dinner", label: "Abend" },
  { id: "snack", label: "Snack" },
  { id: "dessert", label: "Dessert" },
  { id: "drink", label: "Drink" },
] as const;

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export function AutoPackForm({ brand }: { brand: Brand }) {
  const router = useRouter();
  const [timeframe, setTimeframe] = useState<(typeof TIMEFRAME_PRESETS)[number]["id"]>("1m");
  const [mealTypes, setMealTypes] = useState<string[]>([]);
  const [limit, setLimit] = useState(12);
  const [sortBy, setSortBy] = useState<"engagement" | "recent">("engagement");

  const [reels, setReels] = useState<ReelPreview[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Aktive Filter-URL fuer das Reel-Preview-Endpoint. useMemo damit der
  // useEffect nur bei echten Aenderungen re-laed't.
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    const tf = TIMEFRAME_PRESETS.find((t) => t.id === timeframe);
    if (tf && tf.days > 0) {
      params.set("from", isoDaysAgo(tf.days));
    }
    if (mealTypes.length > 0) {
      params.set("mealTypes", mealTypes.join(","));
    }
    params.set("limit", String(Math.max(50, limit * 3)));
    return params.toString();
  }, [timeframe, mealTypes, limit]);

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

  const toggleMealType = (id: string) => {
    setMealTypes((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const handleGenerate = async () => {
    if (!reels || reels.length < 3) {
      setError("Mindestens 3 Reels nötig, um ein Pack zu generieren.");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const tf = TIMEFRAME_PRESETS.find((t) => t.id === timeframe);
      const res = await fetch("/api/packs/generate-auto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandSlug: brand.slug,
          fromDate: tf && tf.days > 0 ? isoDaysAgo(tf.days) : undefined,
          mealTypes: mealTypes.length > 0 ? mealTypes : undefined,
          limit,
          sortBy,
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
          Wähl einen Zeitraum, optionale Kategorien — die KI baut Pack-Titel,
          Beschreibung und Karten aus der Reel-Library. Hero-Bilder werden
          parallel im Hintergrund generiert.
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

      {/* Section 2 — Mahlzeit-Typ */}
      <section className="editor-section editor-card flex flex-col gap-5">
        <SectionHeader
          num="02"
          title="Mahlzeit-Kategorien"
          hint="Optional — wähle eine oder mehrere. Alles leer = jede Kategorie."
          brand={brand}
        />
        <div className="flex flex-wrap gap-2">
          {MEAL_TYPES.map((mt) => {
            const active = mealTypes.includes(mt.id);
            return (
              <button
                key={mt.id}
                type="button"
                onClick={() => toggleMealType(mt.id)}
                className="rounded-full border-2 px-4 py-2 text-[12.5px] font-semibold transition-all"
                style={{
                  borderColor: active ? brand.tokens.accent : brand.tokens.line,
                  background: active
                    ? brand.tokens.accent + "12"
                    : brand.tokens.surface,
                  color: active ? brand.tokens.accent : brand.tokens.inkMuted,
                }}
              >
                {active ? "✓ " : ""}
                {mt.label}
              </button>
            );
          })}
        </div>
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
        <div className="flex items-baseline justify-between gap-3">
          <SectionHeader
            num="04"
            title="Live-Vorschau"
            hint={
              loading
                ? "Lade Reels…"
                : reels && reels.length > 0
                  ? `Das werden die ${reels.length} ${reelWord} im Pack.`
                  : "Keine Reels mit diesen Filtern. Lockere die Filter."
            }
            brand={brand}
          />
          {reels && reels.length > 0 ? (
            <span
              className="font-mono text-[10.5px] uppercase tracking-[0.16em]"
              style={{ color: brand.tokens.inkMuted }}
            >
              {reels.length} {reelWord}
            </span>
          ) : null}
        </div>
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
                      {reel.mealType}
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
          <p
            className="rounded-xl border border-dashed px-4 py-6 text-center text-[13px]"
            style={{
              borderColor: brand.tokens.line,
              color: brand.tokens.inkMuted,
              background: brand.tokens.surface,
            }}
          >
            Keine Reels matchen die Filter. Erweitere den Zeitraum oder
            entferne Mahlzeit-Filter.
          </p>
        )}
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
              Pack-Titel, Beschreibung und Karten werden in ~30–60 Sek erstellt
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
