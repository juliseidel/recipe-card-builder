"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Brand } from "@/lib/brands";

// Pack-Vorschlaege-Section im Workspace. Wird ueber "Aktive Packs"
// angezeigt, solange pending-Vorschlaege existieren. Jede Card:
//   - Title + Subtitle + Reasoning
//   - Reel-Count Badge
//   - "Annehmen" Button → triggert /api/pack-suggestions/[id]/accept,
//     redirected zur frischen Pack-Page
//   - "Verwerfen" Button → status='dismissed', Card verschwindet
//
// Polling: einmal beim Mount + nach Library-Banner status='done' (per
// Refresh-Token-Prop). Kein dauerhaftes Polling — Vorschlaege aendern
// sich nur durch User-Aktionen.

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
      // Optimistic: aus der Liste entfernen.
      setSuggestions((prev) =>
        prev ? prev.filter((s) => s.id !== id) : prev
      );
      // Hub-Cache invalidieren, dann zur frischen Pack-Page.
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
    // Optimistic — sofort aus der Liste raus, API-Call im Hintergrund.
    setSuggestions((prev) => (prev ? prev.filter((s) => s.id !== id) : prev));
    try {
      await fetch(`/api/pack-suggestions/${id}/dismiss`, { method: "POST" });
    } catch {
      // Bei Fehler: leise — der Reel-Vorschlag ist immer noch in der DB
      // pending, aber das stoert nicht (er wuerde beim naechsten Reload
      // wieder auftauchen, was OK ist).
    } finally {
      setBusyIds((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  // Loading state — wir wollen nichts flashen, daher show nothing waehrend
  // initial-load (suggestions===null). Wenn null bleibt, ist Section
  // unsichtbar.
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
            className="mt-1 text-[14px]"
            style={{ color: brand.tokens.inkMuted }}
          >
            {suggestions.length} kuratierte Pack-Konzepte aus den letzten 2 Jahren {brand.name}-Reels. Annehmen
            erstellt das Pack mit Karten + KI-generierten Hero-Bildern in einem Klick.
          </p>
        </div>
        <div
          className="flex items-center gap-4 rounded-xl border px-4 py-2.5 text-[12px]"
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

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {suggestions.map((s) => {
          const busy = busyIds[s.id];
          return (
            <article
              key={s.id}
              className="group flex flex-col gap-4 rounded-2xl border p-5 transition-shadow hover:shadow-[0_18px_40px_-22px_rgba(26,18,11,0.18)]"
              style={{
                borderColor: brand.tokens.line,
                background: brand.tokens.surface,
              }}
            >
              <header className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1.5">
                  <span
                    className="text-[10.5px] font-semibold uppercase tracking-[0.18em]"
                    style={{ color: brand.tokens.accent }}
                  >
                    {s.category || "Pack-Konzept"}
                  </span>
                  <h3
                    className="font-display text-[22px] leading-[1.1] tracking-[-0.01em]"
                    style={{ color: brand.tokens.ink }}
                  >
                    {s.title}
                  </h3>
                  {s.subtitle ? (
                    <p
                      className="text-[12.5px]"
                      style={{ color: brand.tokens.inkMuted }}
                    >
                      {s.subtitle}
                    </p>
                  ) : null}
                </div>
                <span
                  className="shrink-0 rounded-full border px-2.5 py-1 text-[10.5px] font-mono font-semibold uppercase tracking-[0.12em]"
                  style={{
                    borderColor: brand.tokens.line,
                    color: brand.tokens.inkMuted,
                    background: brand.tokens.background,
                  }}
                >
                  {s.reelCount} Reels
                </span>
              </header>

              {s.tagline ? (
                <p
                  className="text-[13px] leading-relaxed"
                  style={{ color: brand.tokens.ink }}
                >
                  {s.tagline}
                </p>
              ) : null}

              {s.reasoning ? (
                <div
                  className="rounded-xl px-3 py-2.5 text-[11.5px] leading-snug"
                  style={{
                    background: brand.tokens.background,
                    color: brand.tokens.inkMuted,
                  }}
                >
                  <span className="font-semibold uppercase tracking-[0.14em] text-[10px]">
                    Warum:
                  </span>{" "}
                  {s.reasoning}
                </div>
              ) : null}

              <div className="mt-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleAccept(s.id)}
                  disabled={Boolean(busy)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-[12.5px] font-semibold text-white transition-all hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
                  style={{ background: brand.tokens.accent }}
                >
                  {busy === "accept" ? (
                    <>
                      <span className="size-3 animate-spin rounded-full border-[2px] border-white/30 border-t-white" />
                      Erstelle Pack…
                    </>
                  ) : (
                    <>
                      Annehmen & öffnen
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
                  className="rounded-full border px-3.5 py-2.5 text-[12px] font-medium transition-colors hover:bg-canvas-alt disabled:opacity-50"
                  style={{
                    borderColor: brand.tokens.line,
                    color: brand.tokens.inkMuted,
                  }}
                  title="Verwerfen"
                >
                  Verwerfen
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
