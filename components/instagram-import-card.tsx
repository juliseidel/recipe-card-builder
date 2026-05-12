"use client";

import { useEffect, useRef, useState } from "react";
import type { Pack } from "@/lib/packs";
import type { ParsedInstagramRecipe } from "@/lib/ai/parse-instagram";

export type ImportSource = {
  url: string;
  username: string | null;
  imageUrl: string | null;
};

type Props = {
  pack: Pack;
  /** Wird aufgerufen, sobald Apify + Gemini fertig sind und das Form
   *  gefüllt werden kann. Die Editor-Page hängt sich daran und setzt
   *  ihre State-Variablen. */
  onImported: (
    recipe: ParsedInstagramRecipe,
    source: ImportSource,
    reconciliation: string | null
  ) => void;
  /** Optional: zeigt nach erfolgreichem Import einen Reset-Button, der
   *  zurück in den "leeren" Import-Zustand schaltet. */
  onReset?: () => void;
  /** Wenn das Parent bereits einen erfolgreichen Import hat, zeigen wir
   *  den Source-Banner statt des Eingabe-Felds. */
  importedSource: ImportSource | null;
  importedConfidence: "high" | "medium" | "low" | null;
  importedNotes: string | null;
  /** Hinweis aus dem Konsistenz-Pass — z. B. wenn eine Zutat ohne
   *  Verwendung entfernt wurde. Wird als getoenter Hinweis-Block unter
   *  dem Confidence-Badge angezeigt, damit der User es nicht uebersieht. */
  importedReconciliation: string | null;
};

type Stage =
  | "idle"
  | "scrape"
  | "parse"
  | "done"
  | "error";

const STAGE_LABEL: Record<Exclude<Stage, "idle" | "done" | "error">, string> = {
  scrape: "Reel laden…",
  parse: "Rezept erkennen…",
};

export function InstagramImportCard({
  pack,
  onImported,
  onReset,
  importedSource,
  importedConfidence,
  importedNotes,
  importedReconciliation,
}: Props) {
  const [url, setUrl] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  // Stage-Progression-Animation. Apify-Phase ist ~70 % der Wartezeit, Gemini
  // die restlichen 30 %. Wir simulieren den Wechsel scrape→parse nach 5 s,
  // damit der User das Gefuehl von Fortschritt bekommt — der echte Backend-
  // Status kommt nicht in Echtzeit, weil wir nur einen einzelnen POST haben.
  const stageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (stageTimer.current) clearTimeout(stageTimer.current);
    };
  }, []);

  const isLoading = stage === "scrape" || stage === "parse";

  const submit = async () => {
    if (!url.trim() || isLoading) return;
    setError(null);
    setStage("scrape");
    if (stageTimer.current) clearTimeout(stageTimer.current);
    stageTimer.current = setTimeout(() => {
      setStage((s) => (s === "scrape" ? "parse" : s));
    }, 5500);

    try {
      const res = await fetch("/api/recipes/import-instagram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(
          (data && data.error) ||
            "Import fehlgeschlagen. Schau, ob der Link oeffentlich ist."
        );
      }
      setStage("done");
      onImported(
        data.recipe as ParsedInstagramRecipe,
        {
          url: data.source?.url ?? url.trim(),
          username: data.source?.username ?? null,
          imageUrl: data.source?.imageUrl ?? null,
        },
        typeof data.reconciliation === "string" && data.reconciliation.trim()
          ? data.reconciliation.trim()
          : null
      );
    } catch (err) {
      setStage("error");
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      if (stageTimer.current) clearTimeout(stageTimer.current);
    }
  };

  // ─── State 1: Erfolgreich importiert ──────────────────────────────
  if (importedSource) {
    return (
      <div
        className="rounded-2xl border p-4"
        style={{
          borderColor: pack.mood.accent + "40",
          background: pack.mood.accent + "10",
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className="grid size-10 flex-shrink-0 place-items-center rounded-xl"
              style={{
                background: pack.mood.accent + "25",
                color: pack.mood.accent,
              }}
              aria-hidden
            >
              <CheckCircleIcon />
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span
                className="text-[12px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: pack.mood.accent }}
              >
                {importedSource.url.includes("tiktok")
                  ? "Aus TikTok importiert"
                  : "Aus Instagram importiert"}
                {importedConfidence ? (
                  <span
                    className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{
                      background:
                        importedConfidence === "high"
                          ? pack.mood.accent + "30"
                          : importedConfidence === "medium"
                            ? "#d97706" + "20"
                            : "#dc2626" + "20",
                      color:
                        importedConfidence === "high"
                          ? pack.mood.accent
                          : importedConfidence === "medium"
                            ? "#d97706"
                            : "#dc2626",
                    }}
                  >
                    {importedConfidence === "high"
                      ? "Sicher"
                      : importedConfidence === "medium"
                        ? "Teilweise"
                        : "Unsicher"}
                  </span>
                ) : null}
              </span>
              <span
                className="truncate text-[13px]"
                style={{ color: pack.mood.ink }}
              >
                {importedSource.username
                  ? `@${importedSource.username}`
                  : importedSource.url.includes("tiktok")
                    ? "TikTok-Video"
                    : "Instagram-Post"}{" "}
                ·{" "}
                <a
                  href={importedSource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:opacity-80"
                  style={{ color: pack.mood.inkSoft }}
                >
                  Original anschauen
                </a>
              </span>
              {importedNotes ? (
                <span
                  className="mt-1 text-[12px] leading-snug"
                  style={{ color: pack.mood.inkSoft }}
                >
                  Hinweis: {importedNotes}
                </span>
              ) : (
                <span
                  className="mt-1 text-[12px] leading-snug"
                  style={{ color: pack.mood.inkSoft }}
                >
                  Felder unten sind ausgefüllt — prüf sie kurz und passe an,
                  was du brauchst.
                </span>
              )}
              {importedReconciliation ? (
                <span
                  className="mt-2 inline-flex items-start gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] leading-snug"
                  style={{
                    borderColor: "#d9770640",
                    background: "#d977060c",
                    color: "#92400e",
                  }}
                >
                  <ReconcileIcon />
                  <span>
                    <strong className="font-semibold">Konsistenz-Check:</strong>{" "}
                    {importedReconciliation}
                  </span>
                </span>
              ) : null}
            </div>
          </div>
          {onReset ? (
            <button
              type="button"
              onClick={() => {
                setUrl("");
                setStage("idle");
                setError(null);
                onReset();
              }}
              className="flex-shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors hover:bg-canvas-alt"
              style={{ color: pack.mood.inkSoft }}
            >
              Anderer Link
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  // ─── State 2: Eingabe / Loading / Error ───────────────────────────
  return (
    <div
      className="rounded-2xl border p-5 sm:p-6"
      style={{
        borderColor: pack.mood.accent + "30",
        background: "var(--color-surface)",
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="mt-0.5 grid size-9 flex-shrink-0 place-items-center rounded-xl"
          style={{
            background: pack.mood.accent + "18",
            color: pack.mood.accent,
          }}
          aria-hidden
        >
          <InstagramIcon />
        </div>
        <div className="flex flex-col gap-1">
          <h2
            className="font-display text-[20px] leading-tight"
            style={{ color: pack.mood.ink }}
          >
            Aus Link erstellen
          </h2>
          <p
            className="text-[13px] leading-snug"
            style={{ color: pack.mood.inkSoft }}
          >
            Instagram-Reel, TikTok-Video oder Post-URL einfügen — wir lesen
            Caption und Nährwerte aus und füllen die Felder unten automatisch.
          </p>
        </div>
      </div>

      <div
        className="mt-5 flex flex-col gap-3 rounded-2xl border p-3 sm:flex-row sm:items-center sm:gap-2"
        style={{
          borderColor: "var(--color-line)",
          background: "var(--color-canvas)",
        }}
      >
        <input
          type="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (error) setError(null);
            if (stage === "error") setStage("idle");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="https://www.instagram.com/reel/… oder https://www.tiktok.com/@…/video/…"
          disabled={isLoading}
          inputMode="url"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent px-2 py-2 text-[14px] outline-none placeholder:text-ink-subtle disabled:opacity-50"
          style={{ color: pack.mood.ink }}
          aria-label="Instagram- oder TikTok-URL"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!url.trim() || isLoading}
          className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-semibold transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
          style={{
            background: pack.mood.ink,
            color: pack.mood.background,
            minWidth: 180,
          }}
        >
          {isLoading ? (
            <>
              <span
                className="inline-block size-3 animate-spin rounded-full border-2 border-current border-t-transparent"
                aria-hidden
              />
              {STAGE_LABEL[stage as "scrape" | "parse"]}
            </>
          ) : (
            <>
              <DownloadIcon />
              Rezept importieren
            </>
          )}
        </button>
      </div>

      {/* Stage-Progression-Anzeige unter dem Eingabefeld, gibt dem User
          das Gefuehl, dass etwas Strukturiertes passiert. */}
      {isLoading ? (
        <div
          className="mt-4 flex items-center gap-3 text-[12px]"
          style={{ color: pack.mood.inkSoft }}
        >
          <StageDot
            label="Reel laden"
            active={stage === "scrape"}
            done={stage === "parse"}
            color={pack.mood.accent}
          />
          <span aria-hidden style={{ color: pack.mood.inkSoft + "60" }}>
            ›
          </span>
          <StageDot
            label="Rezept erkennen"
            active={stage === "parse"}
            done={false}
            color={pack.mood.accent}
          />
          <span aria-hidden style={{ color: pack.mood.inkSoft + "60" }}>
            ›
          </span>
          <StageDot
            label="Felder füllen"
            active={false}
            done={false}
            color={pack.mood.accent}
          />
        </div>
      ) : null}

      {error ? (
        <div
          className="mt-4 flex items-start gap-2 rounded-xl border p-3 text-[13px] leading-snug"
          style={{
            borderColor: "#dc262640",
            background: "#dc26260a",
            color: "#991b1b",
          }}
        >
          <ErrorIcon />
          <span>{error}</span>
        </div>
      ) : null}

      <p
        className="mt-4 text-[11.5px] leading-relaxed"
        style={{ color: pack.mood.inkSoft }}
      >
        Funktioniert mit öffentlichen Reels und Posts. Privatkonten und
        Posts ohne Rezept-Caption können nicht eingelesen werden.
      </p>
    </div>
  );
}

function StageDot({
  label,
  active,
  done,
  color,
}: {
  label: string;
  active: boolean;
  done: boolean;
  color: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5"
      style={{
        opacity: active || done ? 1 : 0.5,
        color: active || done ? color : undefined,
      }}
    >
      <span
        className={`inline-block size-2 rounded-full ${
          active ? "animate-pulse" : ""
        }`}
        style={{
          background: active || done ? color : "currentColor",
          opacity: done && !active ? 0.6 : 1,
        }}
        aria-hidden
      />
      {label}
    </span>
  );
}

function InstagramIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect
        x="2"
        y="2"
        width="12"
        height="12"
        rx="3.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="8" cy="8" r="2.6" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="11.5" cy="4.5" r="0.9" fill="currentColor" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M7 1.5v8m0 0L4 6.5m3 3l3-3M2 11h10"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M5 8l2.2 2.2L11 6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ReconcileIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      style={{ flexShrink: 0, marginTop: 1 }}
    >
      <path
        d="M3 5.5h7l-2-2m5 7h-7l2 2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      style={{ flexShrink: 0, marginTop: 1 }}
    >
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8 5v3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="8" cy="11" r="0.7" fill="currentColor" />
    </svg>
  );
}
