"use client";

import { useEffect, useState } from "react";
import type { Brand } from "@/lib/brands";

// Banner, der den Status des Reel-Library-Backfills im Workspace zeigt.
// Polled /api/brands/[slug]/library-status alle 4s und animiert die
// Reel-Counts beim Hochzaehlen. Verschwindet 8s nachdem der Status auf
// 'done' geht (gibt dem User die Chance, das "X Vorschlaege bereit"
// drueber zu lesen, bevor er verschwindet).

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
  suggestionCount: number;
  error: string | null;
};

const POLL_INTERVAL_MS = 4000;
const POST_DONE_FADE_MS = 8000;

export function LibraryStatusBanner({
  brand,
  /** Callback wenn Status auf 'done' wechselt — Workspace nutzt das, um
   *  die Suggestions-Section frisch zu laden. */
  onDone,
}: {
  brand: Brand;
  onDone?: (s: StatusResponse) => void;
}) {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;
    let fadeTimer: ReturnType<typeof setTimeout> | null = null;

    const fetchStatus = async () => {
      try {
        const res = await fetch(
          `/api/brands/${encodeURIComponent(brand.slug)}/library-status`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const json = (await res.json()) as StatusResponse;
        if (cancelled) return;

        // 'none' = keine Library, also gar nicht anzeigen.
        if (json.status === "none") {
          setHidden(true);
          return;
        }

        setStatus((prev) => {
          // Bei status='done' Transition: callback + Fade-Timer setzen
          if (
            json.status === "done" &&
            (!prev || prev.status !== "done")
          ) {
            onDone?.(json);
            if (fadeTimer) clearTimeout(fadeTimer);
            fadeTimer = setTimeout(() => setHidden(true), POST_DONE_FADE_MS);
          }
          return json;
        });

        // Beim Erreichen von 'done' oder 'failed' Polling stoppen.
        if (
          (json.status === "done" || json.status === "failed") &&
          interval
        ) {
          clearInterval(interval);
          interval = null;
        }
      } catch {
        // Network-Hiccup — naechster Poll versucht es nochmal.
      }
    };

    void fetchStatus();
    interval = setInterval(fetchStatus, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      if (fadeTimer) clearTimeout(fadeTimer);
    };
  }, [brand.slug, onDone]);

  if (hidden || !status) return null;
  if (status.status === "none") return null;

  const isRunning = status.status === "running";
  const isClassifying = status.status === "classifying";
  const isDone = status.status === "done";
  const isFailed = status.status === "failed";

  const isError = isFailed;
  const accentColor = isError ? "#c53030" : brand.tokens.accent;
  const bgColor = isError ? "#fff5f5" : brand.tokens.surface;
  const borderColor = isError
    ? "rgba(197, 48, 48, 0.3)"
    : brand.tokens.line;

  return (
    <div
      className="border-b"
      style={{
        background: bgColor,
        borderColor,
      }}
    >
      <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-6 py-3.5 sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <div className="flex items-center gap-3">
          {isFailed ? (
            <ErrorIcon color={accentColor} />
          ) : isDone ? (
            <CheckIcon color={accentColor} />
          ) : (
            <Spinner color={accentColor} />
          )}
          <div className="flex flex-col gap-0.5">
            <span
              className="text-[13px] font-semibold"
              style={{ color: isError ? "#c53030" : brand.tokens.ink }}
            >
              {isRunning && status.reelCount === 0
                ? `Reel-Library von ${brand.name} wird importiert…`
                : null}
              {isRunning && status.reelCount > 0
                ? `${status.reelCount} Reels geladen — Apify scrapt noch…`
                : null}
              {isClassifying
                ? `${status.recipeCount > 0 ? status.recipeCount : "…"} von ${status.reelCount} Reels klassifiziert`
                : null}
              {isDone
                ? `Reel-Library bereit · ${status.recipeCount} Rezepte erkannt${status.suggestionCount > 0 ? ` · ${status.suggestionCount} Pack-Vorschläge` : ""}`
                : null}
              {isFailed ? "Reel-Library konnte nicht geladen werden" : null}
            </span>
            <span
              className="text-[11.5px]"
              style={{
                color: isError ? "#9b2c2c" : brand.tokens.inkMuted,
              }}
            >
              {isRunning
                ? "Apify scrapt die letzten 2 Jahre Posts. Das dauert ~3–5 Minuten."
                : null}
              {isClassifying
                ? "Gemini klassifiziert jeden Reel als Rezept oder nicht und extrahiert Meta-Felder. Gleich werden Pack-Vorschläge generiert."
                : null}
              {isDone
                ? "Scroll runter zu den Pack-Vorschlägen oder leg ein eigenes Pack im Auto-Modus an."
                : null}
              {isFailed
                ? (status.error?.slice(0, 200) ?? "Unbekannter Fehler.") +
                  " — Du kannst manuell Rezepte importieren oder den Workspace neu anlegen."
                : null}
            </span>
          </div>
        </div>
        {isFailed ? null : (
          <div className="flex items-center gap-4 text-[11px] font-mono uppercase tracking-[0.16em]"
            style={{ color: brand.tokens.inkMuted }}
          >
            <span>{status.reelCount} Posts</span>
            <span aria-hidden>·</span>
            <span>{status.recipeCount} Rezepte</span>
            {status.suggestionCount > 0 ? (
              <>
                <span aria-hidden>·</span>
                <span>{status.suggestionCount} Pack-Ideen</span>
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function Spinner({ color }: { color: string }) {
  return (
    <span
      className="size-4 shrink-0 animate-spin rounded-full border-[2px] border-transparent"
      style={{ borderColor: `${color}30`, borderTopColor: color }}
    />
  );
}

function CheckIcon({ color }: { color: string }) {
  return (
    <span
      className="grid size-5 shrink-0 place-items-center rounded-full"
      style={{ background: color }}
    >
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
        <path
          d="M2.5 6.5L5 9L9.5 3.5"
          stroke="white"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function ErrorIcon({ color }: { color: string }) {
  return (
    <span
      className="grid size-5 shrink-0 place-items-center rounded-full"
      style={{ background: color }}
    >
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
        <path
          d="M6 3v3.5M6 8.5h.01"
          stroke="white"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
