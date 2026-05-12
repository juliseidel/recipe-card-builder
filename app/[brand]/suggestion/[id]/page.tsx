"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { SiteHeader } from "@/components/site-header";
import { LayoutPicker } from "@/components/layout-picker";
import type { Brand } from "@/lib/brands";
import type { CardLayout } from "@/lib/packs";

// Preview-Page für einen Pack-Vorschlag. Zeigt das KI-generierte Cover,
// alle Reels die im Pack landen würden + Layout-Picker. Erst durch
// explizites "Pack erstellen" mit dem gewählten Layout wird der Pack-Build
// getriggert.
//
// User-Wunsch (Mai 2026, Ingos Vision):
//   1. Click auf Suggestion → direkte Ansicht mit den Recipes
//   2. Layout selber wählen (nicht auto-pick aus Category)
//   3. Erst dann "Pack erstellen"

type SuggestionDetail = {
  id: string;
  brandSlug: string;
  title: string;
  subtitle: string;
  tagline: string;
  description: string;
  category: string;
  reasoning: string;
  score: number | null;
  status: string;
  coverUrl: string | null;
  acceptedPackId: string | null;
};

type ReelDetail = {
  id: string;
  igId: string;
  postUrl: string;
  type: string;
  caption: string;
  displayUrl: string | null;
  postedAt: string | null;
  likeCount: number | null;
  viewCount: number | null;
  commentCount: number | null;
  recipeTitle: string | null;
  mealType: string | null;
  cuisine: string | null;
  mainIngredient: string | null;
  dietary: string[];
  estimatedTimeMinutes: number | null;
};

// Heuristik die im accept-route schon existiert — wir replizieren sie
// hier als Default für den Layout-Picker (User kann dann ändern).
function defaultLayoutForCategory(category: string): CardLayout {
  const c = (category || "").toLowerCase();
  if (c.includes("back") || c.includes("dessert") || c.includes("suess") || c.includes("süß"))
    return "patisserie";
  if (c.includes("snack") || c.includes("minimal")) return "minimal";
  if (c.includes("vital") || c.includes("volumen") || c.includes("protein") || c.includes("healthy"))
    return "vital";
  if (c.includes("meal") || c.includes("prep") || c.includes("woche")) return "dashboard";
  if (c.includes("top") || c.includes("favorit") || c.includes("most")) return "amber";
  return "editorial";
}

function formatEngagement(n: number | null): string {
  if (n === null || n === undefined) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}K`;
  return String(n);
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export default function SuggestionPreviewPage() {
  const params = useParams<{ brand: string; id: string }>();
  const router = useRouter();
  const brandSlug = params.brand;
  const suggestionId = params.id;

  const [suggestion, setSuggestion] = useState<SuggestionDetail | null>(null);
  const [reels, setReels] = useState<ReelDetail[]>([]);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [layout, setLayout] = useState<CardLayout>("editorial");
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      // Parallel: Suggestion-Preview + Brand-Tokens.
      const [previewRes, brandRes] = await Promise.all([
        fetch(`/api/pack-suggestions/${suggestionId}/preview`, { cache: "no-store" }),
        fetch(`/api/brands/${encodeURIComponent(brandSlug)}`, { cache: "no-store" }),
      ]);
      if (!previewRes.ok) {
        throw new Error(`Vorschlag nicht gefunden.`);
      }
      const previewJson = await previewRes.json();
      setSuggestion(previewJson.suggestion);
      setReels(previewJson.reels ?? []);
      setLayout(defaultLayoutForCategory(previewJson.suggestion.category));

      if (brandRes.ok) {
        const brandJson = await brandRes.json();
        setBrand(brandJson.brand ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Konnte Vorschlag nicht laden.");
    } finally {
      setLoading(false);
    }
  }, [brandSlug, suggestionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAccept = async () => {
    if (!suggestion || accepting) return;
    setAccepting(true);
    setError(null);
    try {
      const res = await fetch(`/api/pack-suggestions/${suggestion.id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Pack-Erstellung fehlgeschlagen.");
      }
      router.push(`/${brandSlug}/${json.packSlug}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Annehmen fehlgeschlagen.");
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        <SiteHeader />
        <main className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <span className="size-6 animate-spin rounded-full border-2 border-ink/20 border-t-ink" />
            <span className="text-[13px] text-ink-muted">Vorschlag wird geladen…</span>
          </div>
        </main>
      </div>
    );
  }

  if (!suggestion) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        <SiteHeader />
        <main className="mx-auto flex max-w-[800px] flex-1 flex-col items-center justify-center gap-3 px-6 py-20 text-center">
          <h1 className="font-display text-[28px]">Vorschlag nicht gefunden</h1>
          <p className="text-[14px] text-ink-muted">
            {error ?? "Der Pack-Vorschlag existiert nicht mehr."}
          </p>
          <Link
            href={`/${brandSlug}`}
            className="rounded-full bg-ink px-5 py-2.5 text-[13px] font-semibold text-white"
          >
            Zurück zum Workspace
          </Link>
        </main>
      </div>
    );
  }

  const accent = brand?.tokens.accent ?? "#e07a8c";
  const ink = brand?.tokens.ink ?? "#1a120b";
  const inkMuted = brand?.tokens.inkMuted ?? "#6b5b4a";
  const surface = brand?.tokens.surface ?? "#fffaf3";
  const line = brand?.tokens.line ?? "rgba(26, 18, 11, 0.10)";

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <SiteHeader />

      {/* Breadcrumb */}
      <section
        className="border-b"
        style={{ borderColor: line, background: surface }}
      >
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-6 py-4 lg:px-10">
          <nav className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]" style={{ color: inkMuted }}>
            <Link href={`/${brandSlug}`} className="hover:opacity-80">
              {brand?.name ?? brandSlug}-Workspace
            </Link>
            <span aria-hidden>›</span>
            <span className="font-medium" style={{ color: ink }}>
              Pack-Vorschau
            </span>
          </nav>
          <Link
            href={`/${brandSlug}`}
            className="text-[12px] font-medium underline-offset-4 hover:underline"
            style={{ color: inkMuted }}
          >
            Abbrechen
          </Link>
        </div>
      </section>

      <main className="flex-1">
        {/* Hero — Cover + Pack-Meta */}
        <section className="mx-auto grid max-w-[1400px] grid-cols-1 gap-10 px-6 py-12 lg:grid-cols-[1.1fr_1fr] lg:px-10 lg:py-16">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <span
                className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: accent }}
              >
                {suggestion.category} · Pack-Vorschlag
              </span>
              <h1
                className="font-display text-[44px] leading-[1.04] tracking-[-0.015em] lg:text-[56px]"
                style={{ color: ink }}
              >
                {suggestion.title}
              </h1>
              {suggestion.subtitle ? (
                <p className="mt-1 max-w-[58ch] text-[16px] leading-relaxed" style={{ color: inkMuted }}>
                  {suggestion.subtitle}
                </p>
              ) : null}
            </div>

            {suggestion.description ? (
              <p className="max-w-[58ch] text-[14px] leading-relaxed" style={{ color: ink }}>
                {suggestion.description}
              </p>
            ) : null}

            {suggestion.reasoning ? (
              <div
                className="rounded-xl px-4 py-3 text-[12.5px] leading-snug"
                style={{ background: surface, color: inkMuted }}
              >
                <span className="font-semibold uppercase tracking-[0.14em] text-[10px]">
                  KI-Reasoning:
                </span>{" "}
                {suggestion.reasoning}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3 text-[12px]" style={{ color: inkMuted }}>
              <span className="font-mono font-semibold uppercase tracking-[0.14em]">
                {reels.length} Rezepte
              </span>
              {suggestion.score !== null ? (
                <>
                  <span aria-hidden>·</span>
                  <span>Match-Score {Math.round(suggestion.score * 100)}%</span>
                </>
              ) : null}
            </div>
          </div>

          {/* Cover */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <div
              className="relative aspect-square w-full overflow-hidden rounded-3xl border"
              style={{ borderColor: line, background: surface }}
            >
              {suggestion.coverUrl ? (
                <Image
                  src={suggestion.coverUrl}
                  alt={suggestion.title}
                  fill
                  sizes="(min-width: 1024px) 600px, 100vw"
                  className="object-cover"
                  quality={92}
                  unoptimized
                />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center text-[12px] font-mono uppercase tracking-[0.14em]"
                  style={{
                    color: inkMuted,
                    background: `linear-gradient(135deg, ${accent}22 0%, ${surface} 100%)`,
                  }}
                >
                  Cover wird generiert…
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Layout-Picker */}
        <section
          className="border-t"
          style={{ borderColor: line, background: surface }}
        >
          <div className="mx-auto max-w-[1400px] px-6 py-10 lg:px-10 lg:py-14">
            <div className="mb-6 flex flex-col gap-1.5">
              <span
                className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: inkMuted }}
              >
                Karten-Layout
              </span>
              <h2
                className="font-display text-[28px] leading-tight tracking-[-0.01em]"
                style={{ color: ink }}
              >
                Wie sollen die Rezept-Karten aussehen?
              </h2>
              <p className="mt-1 max-w-[58ch] text-[14px]" style={{ color: inkMuted }}>
                Das gewählte Layout wird auf alle {reels.length} Karten im Pack
                angewendet. Du kannst es später pro Karte ändern.
              </p>
            </div>
            <LayoutPicker
              value={layout}
              onChange={setLayout}
              accent={accent}
              thumbnailMood={{
                background: brand?.tokens.background ?? "#f5f1e8",
                accent,
                ink,
              }}
            />
          </div>
        </section>

        {/* Recipe-Grid */}
        <section className="mx-auto max-w-[1400px] px-6 py-12 lg:px-10 lg:py-16">
          <div className="mb-6 flex flex-col gap-1.5">
            <span
              className="text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: inkMuted }}
            >
              Rezepte im Pack
            </span>
            <h2
              className="font-display text-[28px] leading-tight tracking-[-0.01em]"
              style={{ color: ink }}
            >
              {reels.length} kuratierte Reels
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reels.map((r, idx) => (
              <a
                key={r.id}
                href={r.postUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col gap-3 overflow-hidden rounded-2xl border transition-shadow hover:shadow-[0_18px_40px_-22px_rgba(26,18,11,0.18)]"
                style={{ borderColor: line, background: surface }}
              >
                <div className="relative aspect-[4/5] w-full overflow-hidden" style={{ background: brand?.tokens.background ?? "#f5f1e8" }}>
                  {r.displayUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={r.displayUrl}
                      alt={r.recipeTitle ?? `Reel ${r.igId}`}
                      className="h-full w-full object-cover transition-transform duration-[600ms] group-hover:scale-[1.04]"
                      loading="lazy"
                      // Instagram/TikTok-CDN blockiert Cross-Origin-Requests
                      // mit Referrer-Header — ohne no-referrer kriegen wir 403.
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[11px] font-mono uppercase tracking-[0.14em]" style={{ color: inkMuted }}>
                      kein Cover
                    </div>
                  )}
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.55) 100%)",
                    }}
                  />
                  <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2 text-[10px] font-mono uppercase tracking-[0.14em] text-white">
                    <span>#{String(idx + 1).padStart(2, "0")}</span>
                    {r.estimatedTimeMinutes ? (
                      <span>{r.estimatedTimeMinutes} Min</span>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-col gap-2 px-4 pb-4">
                  <h3
                    className="font-display text-[16px] leading-[1.15] tracking-[-0.005em] line-clamp-2"
                    style={{ color: ink }}
                  >
                    {r.recipeTitle || r.caption.slice(0, 70) || "Rezept-Reel"}
                  </h3>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]" style={{ color: inkMuted }}>
                    {r.mealType ? <span>{r.mealType}</span> : null}
                    {r.cuisine ? (
                      <>
                        {r.mealType ? <span aria-hidden>·</span> : null}
                        <span>{r.cuisine}</span>
                      </>
                    ) : null}
                    {r.likeCount !== null ? (
                      <>
                        <span aria-hidden>·</span>
                        <span>♥ {formatEngagement(r.likeCount)}</span>
                      </>
                    ) : null}
                  </div>
                  {r.postedAt ? (
                    <span className="text-[10.5px] font-mono uppercase tracking-[0.14em]" style={{ color: inkMuted }}>
                      {formatDate(r.postedAt)}
                    </span>
                  ) : null}
                </div>
              </a>
            ))}
          </div>
        </section>
      </main>

      {/* Sticky Bottom-Bar mit Accept-CTA */}
      <div
        className="sticky bottom-0 border-t backdrop-blur"
        style={{
          borderColor: line,
          background: "rgba(255, 250, 243, 0.92)",
        }}
      >
        <div className="mx-auto flex max-w-[1400px] flex-col items-stretch gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-10">
          {error ? (
            <span className="text-[12.5px]" style={{ color: "#9b2c2c" }}>
              {error}
            </span>
          ) : (
            <span className="text-[12.5px]" style={{ color: inkMuted }}>
              Layout: <strong style={{ color: ink }}>{layout}</strong>{" "}
              · KI-generiert Cover{suggestion.coverUrl ? "" : " (wird beim Erstellen gerendert)"}
            </span>
          )}
          <div className="flex items-center gap-2">
            <Link
              href={`/${brandSlug}`}
              className="rounded-full border px-5 py-2.5 text-[13px] font-medium transition-colors hover:bg-canvas-alt"
              style={{ borderColor: line, color: inkMuted }}
            >
              Zurück
            </Link>
            <button
              type="button"
              onClick={() => void handleAccept()}
              disabled={accepting}
              className="inline-flex items-center justify-center gap-1.5 rounded-full px-6 py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-95 disabled:cursor-wait disabled:opacity-60"
              style={{ background: accent }}
            >
              {accepting ? (
                <>
                  <span className="size-3 animate-spin rounded-full border-[2px] border-white/30 border-t-white" />
                  Pack wird erstellt…
                </>
              ) : (
                <>
                  Pack erstellen
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden>
                    <path
                      d="M2.5 5.5h6m0 0L5.75 2.75M8.5 5.5l-2.75 2.75"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
