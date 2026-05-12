"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Brand } from "@/lib/brands";

// Pack-Vorschlaege-Section im Workspace. Wird ueber "Aktive Packs"
// angezeigt, solange pending-Vorschlaege existieren.
//
// Layout: horizontales Carousel mit snap-scroll (statt Grid in 2-3
// Reihen). Jede Card hat:
//   - Background-Image aus dem display_url des Top-Reels im Vorschlag —
//     dunkler Gradient drueber damit der Text lesbar bleibt
//   - Title + Subtitle + Reel-Count + Annehmen-Button
//
// Cover-Logik: API liefert previewImages[] (bis zu 3 display_urls). Wir
// nehmen den ersten als Background. Bei fehlendem Cover: Mood-Gradient
// als Fallback (Brand-Accent → Brand-Background).
//
// Polling: einmal beim Mount + nach Library-Banner status='done' (per
// Refresh-Token-Prop).

type Suggestion = {
  id: string;
  title: string;
  subtitle: string;
  tagline: string;
  description: string;
  category: string;
  reasoning: string;
  reelCount: number;
  score: number | null;
  /** KI-generiertes Pack-Cover (Flux). Bevorzugt vor previewImages. */
  coverUrl: string | null;
  previewImages: string[];
};

export function PackSuggestionsSection({
  brand,
  /** Wenn dieser Wert sich aendert, wird die Liste neu geladen. Library-
   *  Banner triggert das mit Date.now() wenn Backfill 'done' wird. */
  refreshToken,
}: {
  brand: Brand;
  refreshToken?: number;
}) {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [busyIds, setBusyIds] = useState<Record<string, "accept" | "dismiss">>(
    {}
  );
  const [error, setError] = useState<string | null>(null);

  const loadSuggestions = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/brands/${encodeURIComponent(brand.slug)}/suggestions`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        setSuggestions([]);
        return;
      }
      const json = await res.json();
      setSuggestions(Array.isArray(json.suggestions) ? json.suggestions : []);
    } catch {
      setSuggestions([]);
    }
  }, [brand.slug]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSuggestions();
  }, [loadSuggestions, refreshToken]);

  // Auto-Poll solange mindestens ein Cover noch fehlt — KI-Cover-Generation
  // laeuft im Hintergrund fuer ~30-60s nach dem ersten Onboarding. Wir
  // pollen alle 8s und stoppen sobald alle Suggestions ein Cover haben
  // (oder die Section unmounted ist).
  useEffect(() => {
    if (!suggestions || suggestions.length === 0) return;
    const anyMissing = suggestions.some((s) => !s.coverUrl);
    if (!anyMissing) return;
    const interval = setInterval(() => {
      void loadSuggestions();
    }, 8000);
    return () => clearInterval(interval);
  }, [suggestions, loadSuggestions]);

  const handleAccept = async (id: string) => {
    setBusyIds((prev) => ({ ...prev, [id]: "accept" }));
    setError(null);
    try {
      const res = await fetch(`/api/pack-suggestions/${id}/accept`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Annehmen fehlgeschlagen.");
      }
      setSuggestions((prev) =>
        prev ? prev.filter((s) => s.id !== id) : prev
      );
      router.push(`/${brand.slug}/${json.packSlug}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Annehmen fehlgeschlagen.");
    } finally {
      setBusyIds((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const handleDismiss = async (id: string) => {
    setBusyIds((prev) => ({ ...prev, [id]: "dismiss" }));
    setError(null);
    setSuggestions((prev) => (prev ? prev.filter((s) => s.id !== id) : prev));
    try {
      await fetch(`/api/pack-suggestions/${id}/dismiss`, { method: "POST" });
    } catch {
      // leise
    } finally {
      setBusyIds((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  if (suggestions === null) return null;
  if (suggestions.length === 0) return null;

  return (
    <section className="mx-auto max-w-[1400px] px-6 pt-12 pb-8 lg:px-10 lg:pt-16">
      <div
        className="mb-7 flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between"
        style={{ borderColor: brand.tokens.line }}
      >
        <div className="flex flex-col gap-1.5">
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: brand.tokens.inkMuted }}
          >
            KI-Vorschläge · aus der Reel-Library
          </span>
          <h2
            className="font-display text-[32px] leading-none tracking-[-0.01em]"
            style={{ color: brand.tokens.ink }}
          >
            Vorgeschlagene Packs
          </h2>
          <p
            className="mt-1 max-w-[60ch] text-[14px]"
            style={{ color: brand.tokens.inkMuted }}
          >
            {suggestions.length} kuratierte Pack-Konzepte aus {brand.name}-Reels.
            Annehmen erstellt das Pack mit Karten und KI-generierten Hero-Bildern
            in einem Klick.
          </p>
        </div>
        <div
          className="flex items-center gap-3 self-start rounded-xl border px-4 py-2.5 text-[12px] sm:self-end"
          style={{
            borderColor: brand.tokens.line,
            background: brand.tokens.surface,
            color: brand.tokens.inkMuted,
          }}
        >
          <span className="flex items-center gap-2">
            <span
              className="size-1.5 rounded-full"
              style={{ background: brand.tokens.accent }}
            />
            Eines anklicken — Pack ist sofort live
          </span>
        </div>
      </div>

      {error ? (
        <div
          className="mb-5 rounded-xl border px-4 py-3 text-[13px]"
          style={{
            borderColor: "rgba(197, 48, 48, 0.3)",
            background: "rgba(254, 226, 226, 0.6)",
            color: "#9b2c2c",
          }}
        >
          {error}
        </div>
      ) : null}

      {/* Horizontal-Carousel: snap-scroll, eine Karte zeigt 1.1× sichtbar
          damit man sieht "es gibt mehr rechts" und naturlich scrollen kann.
          Auf Desktop: 3 sichtbar gleichzeitig. */}
      <div
        className="-mx-6 flex snap-x snap-mandatory gap-5 overflow-x-auto px-6 pb-3 lg:-mx-10 lg:px-10"
        style={{
          scrollbarWidth: "thin",
        }}
      >
        {suggestions.map((s) => {
          const busy = busyIds[s.id];
          // KI-Cover bevorzugt (Flux Pack-Cover), Fallback: Reel-Cover
          // (display_url des Top-Reels), Fallback: nichts → Brand-Gradient.
          const coverUrl = s.coverUrl || s.previewImages[0] || null;
          return (
            <article
              key={s.id}
              className="group relative flex w-[320px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border transition-all hover:-translate-y-1 hover:shadow-[0_28px_60px_-30px_rgba(26,18,11,0.32)] sm:w-[360px]"
              style={{
                borderColor: brand.tokens.line,
                background: brand.tokens.surface,
                minHeight: 360,
              }}
            >
              {/* Background — Reel-Cover als Bild, mit dunklem Gradient
                  Overlay fuer Text-Lesbarkeit. Bei fehlendem Cover:
                  Mood-Gradient mit Brand-Akzent. */}
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-[700ms] group-hover:scale-[1.04]"
                style={
                  coverUrl
                    ? { backgroundImage: `url("${coverUrl}")` }
                    : {
                        background: `linear-gradient(135deg, ${brand.tokens.accent}33 0%, ${brand.tokens.background} 70%)`,
                      }
                }
                aria-hidden
              />
              {/* Dunkler Gradient — unten staerker, oben fast transparent.
                  Macht Title + Buttons lesbar ohne Cover-Bild zu verstecken. */}
              <div
                className="absolute inset-0"
                style={{
                  background: coverUrl
                    ? "linear-gradient(180deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.35) 45%, rgba(0,0,0,0.78) 100%)"
                    : "linear-gradient(180deg, transparent 30%, rgba(0,0,0,0.35) 100%)",
                }}
                aria-hidden
              />

              {/* Foreground content */}
              <div className="relative flex h-full flex-col gap-3 p-5">
                <header className="flex items-start justify-between gap-3">
                  <span
                    className="rounded-full px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.16em] backdrop-blur"
                    style={{
                      background: "rgba(255,255,255,0.18)",
                      color: "white",
                    }}
                  >
                    {s.category || "Pack-Konzept"}
                  </span>
                  <span
                    className="rounded-full px-2.5 py-1 text-[10.5px] font-mono font-semibold uppercase tracking-[0.12em] backdrop-blur"
                    style={{
                      background: "rgba(255,255,255,0.18)",
                      color: "white",
                    }}
                  >
                    {s.reelCount} Reels
                  </span>
                </header>

                <div className="mt-auto flex flex-col gap-2.5">
                  <h3 className="font-display text-[22px] leading-[1.08] tracking-[-0.01em] text-white">
                    {s.title}
                  </h3>
                  {s.subtitle ? (
                    <p className="text-[12.5px] leading-relaxed text-white/85">
                      {s.subtitle}
                    </p>
                  ) : null}

                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleAccept(s.id)}
                      disabled={Boolean(busy)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-[12.5px] font-semibold text-white transition-all hover:opacity-95 disabled:cursor-wait disabled:opacity-60"
                      style={{ background: brand.tokens.accent }}
                    >
                      {busy === "accept" ? (
                        <>
                          <span className="size-3 animate-spin rounded-full border-[2px] border-white/30 border-t-white" />
                          Erstelle Pack…
                        </>
                      ) : (
                        <>
                          Annehmen
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
                    <button
                      type="button"
                      onClick={() => void handleDismiss(s.id)}
                      disabled={Boolean(busy)}
                      className="rounded-full border px-3.5 py-2.5 text-[12px] font-medium text-white backdrop-blur transition-colors hover:bg-white/15 disabled:opacity-50"
                      style={{
                        borderColor: "rgba(255,255,255,0.3)",
                        background: "rgba(255,255,255,0.08)",
                      }}
                      title="Verwerfen"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
