"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Common = {
  brandSlug: string;
  packSlug: string;
  label?: string;
  // Visual style: "hero" = filled dark button, "subtle" = compact
  variant?: "hero" | "subtle";
  // Pack mood for tinting (background of filled button etc.)
  tint: { bg: string; ink: string; accent: string };
  // Optional class to position the button container
  className?: string;
};

type Props =
  | (Common & { type: "recipe"; recipeSlug: string; filenameHint?: string })
  | (Common & { type: "pack"; filenameHint?: string });

type JobStatus = "queued" | "rendering" | "ready" | "failed" | null;

type JobSnapshot = {
  status: JobStatus;
  progress: number;
  stage: string | null;
  fileUrl: string | null;
  error: string | null;
};

const STAGE_LABELS: Record<string, string> = {
  starting: "Startet…",
  "loading-image": "Bild laden…",
  "loading-cover": "Cover laden…",
  "loading-recipe-images": "Bilder laden…",
  rendering: "Layout rendern…",
  uploading: "Hochladen…",
  done: "Fertig",
};

export function PdfExportButton(props: Props) {
  const { variant = "hero", label, tint } = props;

  const [jobId, setJobId] = useState<string | null>(null);
  const [snap, setSnap] = useState<JobSnapshot>({
    status: null,
    progress: 0,
    stage: null,
    fileUrl: null,
    error: null,
  });
  const [downloaded, setDownloaded] = useState(false);
  const downloadedFor = useRef<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopped = useRef(false);

  const isBusy = snap.status === "queued" || snap.status === "rendering";
  const isReady = snap.status === "ready" && Boolean(snap.fileUrl);
  const isFailed = snap.status === "failed";

  // Start a fresh job
  const start = useCallback(async () => {
    stopped.current = false;
    setSnap({
      status: "queued",
      progress: 0,
      stage: "starting",
      fileUrl: null,
      error: null,
    });
    setDownloaded(false);
    downloadedFor.current = null;

    try {
      const body =
        props.type === "recipe"
          ? {
              type: "recipe" as const,
              brandSlug: props.brandSlug,
              packSlug: props.packSlug,
              recipeSlug: props.recipeSlug,
            }
          : {
              type: "pack" as const,
              brandSlug: props.brandSlug,
              packSlug: props.packSlug,
            };

      const res = await fetch("/api/pdf/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { jobId: string };
      setJobId(data.jobId);
    } catch (err) {
      setSnap({
        status: "failed",
        progress: 0,
        stage: null,
        fileUrl: null,
        error: err instanceof Error ? err.message : "Unbekannter Fehler",
      });
    }
  }, [props]);

  // Poll job status
  useEffect(() => {
    if (!jobId) return;
    stopped.current = false;
    let attempt = 0;
    const startTime = Date.now();

    const tick = async () => {
      if (stopped.current) return;
      attempt++;
      try {
        const res = await fetch(`/api/pdf/jobs/${jobId}`, { cache: "no-store" });
        if (!res.ok) {
          if (Date.now() - startTime > 90_000) {
            setSnap((s) => ({
              ...s,
              status: "failed",
              error: "Timeout — Job nicht gefunden",
            }));
            return;
          }
        } else {
          const data = await res.json();
          setSnap({
            status: data.status,
            progress: data.progress ?? 0,
            stage: data.stage,
            fileUrl: data.fileUrl,
            error: data.error,
          });
          if (data.status === "ready" || data.status === "failed") return;
        }
      } catch {
        // network blip — keep trying
      }
      // Faster polling near completion for snappier UI
      const delay = attempt < 4 ? 700 : attempt < 12 ? 900 : 1400;
      pollTimer.current = setTimeout(tick, delay);
    };

    pollTimer.current = setTimeout(tick, 600);

    return () => {
      stopped.current = true;
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [jobId]);

  // Auto-trigger browser download when ready (once per file).
  // Wir nutzen den Blob-Download-Trick statt window.open: das umgeht
  // jeden Pop-up-Blocker und erzwingt ein "echtes" Download-Verhalten,
  // unabhängig davon, ob der Cross-Origin-Server Content-Disposition
  // sendet. Funktioniert in Safari, Chrome, Firefox + auf iOS.
  useEffect(() => {
    if (!isReady || !snap.fileUrl) return;
    if (downloadedFor.current === snap.fileUrl) return;
    downloadedFor.current = snap.fileUrl;
    void triggerBlobDownload(snap.fileUrl).then((ok) => {
      if (ok) setDownloaded(true);
    });
  }, [isReady, snap.fileUrl]);

  const onClick = () => {
    if (isBusy) return;
    if (isReady && snap.fileUrl) {
      // Re-Download: gleicher Blob-Trick wie beim Auto-Download.
      void triggerBlobDownload(snap.fileUrl);
      return;
    }
    void start();
  };

  const buttonLabel = (() => {
    if (snap.status === "queued") return "In Warteschlange…";
    if (snap.status === "rendering") {
      const pct = Math.max(5, Math.min(99, snap.progress));
      return `${stageLabel(snap.stage)} ${pct}%`;
    }
    if (isReady) return downloaded ? "Erneut herunterladen" : "Download startet…";
    if (isFailed) return "Erneut versuchen";
    return label ?? (props.type === "pack" ? "Komplettes Pack als PDF" : "Karte als PDF");
  })();

  const showProgress = isBusy && snap.progress > 0;

  return (
    // `relative` hier ist der Anker für die beiden absolute-positionierten
    // Sub-Elemente unten (Direkt-Link bei Erfolg, Fehler-Hint bei Fail).
    // So bleibt der Container in jedem State exakt button-hoch und der
    // nebenstehende "Löschen"-Button auf der gleichen vertikalen Achse.
    <div className={`relative ${props.className ?? ""}`.trim()}>
      <button
        type="button"
        onClick={onClick}
        disabled={isBusy}
        aria-busy={isBusy}
        className={
          variant === "hero"
            ? "group relative inline-flex items-center gap-2 overflow-hidden rounded-full px-4 py-2 text-[13px] font-semibold transition-transform hover:scale-[1.02] disabled:scale-100 disabled:opacity-90"
            : "group relative inline-flex items-center gap-2 overflow-hidden rounded-full px-4 py-1.5 text-[12px] font-semibold transition-transform hover:scale-[1.02] disabled:scale-100 disabled:opacity-90"
        }
        style={{
          background: isFailed ? "#b91c1c" : tint.ink,
          color: isFailed ? "#ffffff" : tint.bg,
          minWidth: variant === "hero" ? 200 : 170,
          justifyContent: "center",
        }}
      >
        {/* Progress bar fill behind label */}
        {showProgress ? (
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 transition-[width] duration-500 ease-out"
            style={{
              width: `${Math.max(5, Math.min(99, snap.progress))}%`,
              background: tint.accent,
              opacity: 0.45,
            }}
          />
        ) : null}

        <span className="relative inline-flex items-center gap-2">
          {isBusy ? (
            <Spinner />
          ) : isReady ? (
            <CheckIcon />
          ) : isFailed ? (
            <RetryIcon />
          ) : (
            <DownloadIcon />
          )}
          <span className="whitespace-nowrap">{buttonLabel}</span>
        </span>
      </button>

      {/* Direkt-Link als Backup: dank Blob-Download startet der Save-Dialog
       * normalerweise automatisch. Falls der Browser das doch mal blockiert
       * (extrem strenger Pop-up-Blocker, fetch-CORS-Fail, etc.), kann der
       * User hier manuell auf den Link klicken.
       *
       * Wichtig: absolute positioniert mit top-full, damit der Container
       * in seiner Höhe nicht wächst. Sonst würde der nebenstehende
       * "Löschen"-Button im Parent-Flex visuell asymmetrisch zum
       * "Erneut herunterladen"-Button stehen. */}
      {isReady && snap.fileUrl ? (
        <div
          className="absolute left-0 right-0 top-full mt-1.5 flex items-center justify-end gap-2 text-[11px]"
          style={{ color: tint.ink, opacity: 0.7 }}
        >
          <a
            href={snap.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="whitespace-nowrap underline underline-offset-2"
            style={{ color: tint.ink }}
          >
            Direkt-Link zum PDF
          </a>
        </div>
      ) : null}
      {isFailed ? (
        <div
          className="absolute left-0 right-0 top-full mt-1.5 flex items-center justify-end gap-2 text-[11px]"
          style={{ color: "#b91c1c" }}
        >
          {snap.error ?? "Fehler beim Rendern"}
        </div>
      ) : null}
    </div>
  );
}

function stageLabel(stage: string | null): string {
  if (!stage) return "Rendert";
  return STAGE_LABELS[stage] ?? "Rendert";
}

// Triggert einen echten Browser-Download für die übergebene PDF-URL.
// Wir fetchen das PDF, packen es in einen lokalen Blob und klicken ein
// verstecktes <a download>-Element. Das umgeht jeden Pop-up-Blocker und
// erzwingt den "Save As..."-Dialog, unabhängig davon, ob der Server
// Content-Disposition korrekt sendet. Funktioniert in Safari (auch iOS),
// Chrome, Firefox, Edge.
//
// Returnt true bei Erfolg, false bei Fehler — wir lassen den Fehler im
// Hintergrund schlucken, damit der "Erneut herunterladen"-Button den User
// trotzdem nicht blockt; ein zweiter Klick versucht es einfach nochmal.
async function triggerBlobDownload(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { credentials: "omit" });
    if (!res.ok) {
      // Fallback: window.open — falls fetch wegen CORS blockiert wäre.
      window.open(url, "_blank", "noopener,noreferrer");
      return true;
    }
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = extractFilenameFromUrl(url);
    a.rel = "noopener noreferrer";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Blob-URL revoken nach kurzer Verzögerung, damit der Browser Zeit
    // hat, den Download wirklich zu starten.
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
    return true;
  } catch {
    // Letzter Fallback: neuer Tab. Lieber irgendein Verhalten als gar nichts.
    try {
      window.open(url, "_blank", "noopener,noreferrer");
      return true;
    } catch {
      return false;
    }
  }
}

// Holt den Dateinamen aus dem ?download=...-Query-Parameter (Supabase
// setzt den beim getPublicUrl-Aufruf), oder fällt auf den Pfad-Letzten
// zurück. Niemals leer — sonst nutzt der Browser eine generische ID.
function extractFilenameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const param = u.searchParams.get("download");
    if (param) return decodeURIComponent(param);
    const last = u.pathname.split("/").filter(Boolean).pop();
    return last && last.endsWith(".pdf") ? last : "rezept.pdf";
  } catch {
    return "rezept.pdf";
  }
}

function Spinner() {
  return (
    <span
      className="inline-block size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
      aria-hidden
    />
  );
}

function DownloadIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M7 1.5v8m0 0L4 6.5m3 3l3-3M2 11h10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M3 7l3 3 5-7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RetryIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M11.5 5.5A4.5 4.5 0 1 0 12 9.5M11.5 2v3.5H8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
