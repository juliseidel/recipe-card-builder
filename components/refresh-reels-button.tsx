"use client";

import { useEffect, useState } from "react";
import type { Brand } from "@/lib/brands";

// "Reel-Library aktualisieren"-Button mit Letzter-Sync-Anzeige.
//
// UI-Flow:
//   1. Beim Mount: GET /api/brands/[slug]/library-status — zeigt
//      "Letzter Sync vor X" oder "Noch nie aktualisiert"
//   2. User klickt "Aktualisieren" → POST /api/brands/[slug]/refresh-reels
//   3. Bei Success: setRefreshing=true, Parent (BrandLibraryHeader)
//      rendert dann den LibraryStatusBanner als progress-anzeige. Sobald
//      der Banner status='done' triggert, refreshen wir hier den
//      Last-Sync-Text via onRefreshComplete-Callback.
//   4. Bei Fehler (429 throttled / 409 running / 422 no-handle): Error-
//      Toast ohne Banner-Trigger.
//
// Wir nutzen die ASYNC-Pipeline (refresh-reels Endpoint), NICHT quick-
// scrape. Grund: nur die async-Pipeline triggert Webhook → Klassifikation
// → Pack-Suggestion-Regen → Cover-Caching. Quick-scrape macht nur das
// Reel-Insert, was fuer einen vollwertigen Refresh nicht reicht.

type LibraryStatus =
  | "none"
  | "running"
  | "classifying"
  | "done"
  | "failed";

type StatusResponse = {
  status: LibraryStatus;
  reelCount: number;
  recipeCount: number;
  finishedAt?: string | null;
  startedAt?: string;
};

type Props = {
  brand: Brand;
  /** Wird vom Parent erhoeht, wenn ein gerade laufender Refresh fertig
   *  ist (Banner-onDone). Triggert Re-Fetch der Last-Sync-Anzeige. */
  refreshToken?: number;
  /** Callback ans Parent: ein neuer Scrape wurde erfolgreich gestartet.
   *  Parent zeigt dann den LibraryStatusBanner an. */
  onRefreshStarted?: () => void;
};

export function RefreshReelsButton({
  brand,
  refreshToken = 0,
  onRefreshStarted,
}: Props) {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Status laden: beim Mount und immer wenn refreshToken aenert (= ein
  // laufender Scrape ist fertig geworden).
  useEffect(() => {
    let cancelled = false;
    const fetchStatus = async () => {
      try {
        const res = await fetch(
          `/api/brands/${encodeURIComponent(brand.slug)}/library-status`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const json = (await res.json()) as StatusResponse;
        if (!cancelled) setStatus(json);
      } catch {
        // Kein Sync-Status verfuegbar — wir zeigen "Noch nie aktualisiert"
      }
    };
    void fetchStatus();
    return () => {
      cancelled = true;
    };
  }, [brand.slug, refreshToken]);

  const handleRefresh = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/brands/${encodeURIComponent(brand.slug)}/refresh-reels`,
        { method: "POST", headers: { "Content-Type": "application/json" } }
      );
      const json = await res.json();
      if (!res.ok) {
        // 409 = bereits laufend → Parent soll den Banner rendern, damit
        // User den Fortschritt sieht. Trotzdem onRefreshStarted callen.
        if (res.status === 409) {
          onRefreshStarted?.();
          setError(null);
          return;
        }
        throw new Error(json.error ?? "Aktualisierung fehlgeschlagen.");
      }
      onRefreshStarted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler.");
    } finally {
      setLoading(false);
    }
  };

  const isCurrentlyRunning =
    status?.status === "running" || status?.status === "classifying";

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={handleRefresh}
        disabled={loading || isCurrentlyRunning}
        className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[12px] font-semibold transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        style={{
          borderColor: brand.tokens.line,
          background: brand.tokens.surface,
          color: brand.tokens.ink,
        }}
        title="Holt die neuesten Reels von Instagram/TikTok, klassifiziert sie und generiert neue Pack-Vorschlaege."
      >
        <RefreshIcon
          color={brand.tokens.accent}
          spinning={loading || isCurrentlyRunning}
        />
        {loading
          ? "Wird gestartet…"
          : isCurrentlyRunning
            ? "Aktualisierung laeuft…"
            : "Reel-Library aktualisieren"}
      </button>
      <SyncIndicator status={status} brand={brand} />
      {error ? (
        <span
          className="text-[11px]"
          style={{ color: "#c53030" }}
        >
          {error}
        </span>
      ) : null}
    </div>
  );
}

function SyncIndicator({
  status,
  brand,
}: {
  status: StatusResponse | null;
  brand: Brand;
}) {
  if (!status || status.status === "none") {
    return (
      <span
        className="text-[11px]"
        style={{ color: brand.tokens.inkMuted }}
      >
        Noch keine Reel-Library
      </span>
    );
  }
  if (status.status === "running" || status.status === "classifying") {
    return (
      <span
        className="text-[11px]"
        style={{ color: brand.tokens.inkMuted }}
      >
        Apify scrapt gerade …
      </span>
    );
  }
  if (status.status === "failed") {
    return (
      <span className="text-[11px]" style={{ color: "#c53030" }}>
        Letzte Aktualisierung fehlgeschlagen
      </span>
    );
  }
  if (status.status === "done" && status.finishedAt) {
    const ageMin =
      (Date.now() - new Date(status.finishedAt).getTime()) / 60_000;
    return (
      <span
        className="text-[11px]"
        style={{ color: brand.tokens.inkMuted }}
      >
        Zuletzt aktualisiert {formatRelative(ageMin)} · {status.reelCount} Reels
      </span>
    );
  }
  return null;
}

function formatRelative(ageMin: number): string {
  if (ageMin < 1) return "gerade eben";
  if (ageMin < 60) return `vor ${Math.round(ageMin)} Min`;
  const ageHours = ageMin / 60;
  if (ageHours < 24) return `vor ${Math.round(ageHours)} Std`;
  const ageDays = ageHours / 24;
  if (ageDays < 30) return `vor ${Math.round(ageDays)} Tagen`;
  const ageMonths = ageDays / 30;
  return `vor ${Math.round(ageMonths)} Monaten`;
}

function RefreshIcon({
  color,
  spinning,
}: {
  color: string;
  spinning: boolean;
}) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      className={spinning ? "animate-spin" : undefined}
      aria-hidden="true"
    >
      <path
        d="M14 3v4h-4M2 13v-4h4M3.5 6.5a5 5 0 0 1 8.2-1.9L14 7M12.5 9.5a5 5 0 0 1-8.2 1.9L2 9"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
