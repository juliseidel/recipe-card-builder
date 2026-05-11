"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { isCodeBrand } from "@/lib/brands";

// Workspace-Toolbar-Action fuer DB-Brands: triggert /api/brands/regenerate-style
// um die Brand-DNA neu aus den Reel-Covers ableiten zu lassen. Self-detected
// via Pathname — rendert sich nur in `/[brand]/...` Routen UND nur fuer
// DB-Brands (Code-Brands wie Biene sind im Code, deren Style ueber diesen
// Endpoint zu aendern wuerde nichts bewirken).
//
// Use Cases:
//   - Onboarding-Vision-Analyse hat keinen sauberen Style erkannt
//   - Creator hat seinen Look geaendert
//   - Erstes Hero-Bild eines neuen Creators sieht generisch aus, also
//     "Versuch's nochmal"

const RESERVED_SEGMENTS = new Set([
  "",
  "login",
  "welcome",
  "new-brand",
  "submission",
  "api",
]);

type Stage =
  | "idle"
  | "running"
  | "success"
  | "error";

export function BrandStyleRefresh() {
  const pathname = usePathname();
  const firstSegment = (pathname?.split("/").filter(Boolean)[0] ?? "")
    .toLowerCase();
  const isBrandPath = firstSegment && !RESERVED_SEGMENTS.has(firstSegment);

  const [stage, setStage] = useState<Stage>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  // Bedingung: muss eine Brand-Route sein UND der Slug darf KEIN Code-Brand
  // sein (Biene hat ihren Style im Code, Regenerate macht nichts).
  if (!isBrandPath) return null;
  if (isCodeBrand(firstSegment)) return null;

  const handleClick = async () => {
    if (stage === "running") return;
    setStage("running");
    setMessage(null);
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);

    try {
      const res = await fetch("/api/brands/regenerate-style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandSlug: firstSegment }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data?.error ?? "Regenerate fehlgeschlagen.");
      }
      setStage("success");
      setMessage(
        `Brand-Style aktualisiert · ${data.lightingCount} Lighting-Optionen, ${data.sceneCount} Scenes. Naechstes Hero-Bild laeuft mit dem neuen Style.`
      );
      // Auto-dismiss success nach 8s
      dismissTimerRef.current = setTimeout(() => {
        setStage("idle");
        setMessage(null);
      }, 8000);
    } catch (err) {
      setStage("error");
      setMessage(
        err instanceof Error ? err.message : "Regenerate fehlgeschlagen."
      );
      dismissTimerRef.current = setTimeout(() => {
        setStage("idle");
        setMessage(null);
      }, 12000);
    }
  };

  const label =
    stage === "running"
      ? "Analysiere Reels…"
      : "Brand-Style aktualisieren";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        disabled={stage === "running"}
        title="Vision-Analyse der letzten Instagram-Reels erneut ausfuehren, um den Brand-Style zu verfeinern."
        className="group inline-flex items-center gap-1.5 rounded-full border border-line/60 bg-surface/85 px-3 py-1.5 text-[12px] font-medium text-ink-muted backdrop-blur-md transition-all duration-200 hover:border-line hover:bg-surface hover:text-ink hover:shadow-[0_4px_12px_-4px_rgba(43,31,25,0.15)] disabled:cursor-wait disabled:opacity-70"
        aria-label={label}
      >
        {stage === "running" ? (
          <span
            className="inline-block size-3 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden
          />
        ) : (
          <svg
            width="13"
            height="13"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden
            className="transition-transform duration-300 group-hover:rotate-180"
          >
            <path
              d="M2 7a5 5 0 0 1 9-3M12 7a5 5 0 0 1-9 3M11 1.5V4H8.5M3 12.5V10h2.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
        {label}
      </button>

      {message ? (
        <div
          className={`absolute right-0 top-full mt-2 w-72 rounded-xl border px-4 py-3 text-[12px] shadow-lg backdrop-blur-md ${
            stage === "success"
              ? "border-green-200 bg-green-50/95 text-green-900"
              : stage === "error"
                ? "border-red-200 bg-red-50/95 text-red-900"
                : "border-line bg-surface/95 text-ink"
          }`}
          role="status"
        >
          {message}
        </div>
      ) : null}
    </div>
  );
}
