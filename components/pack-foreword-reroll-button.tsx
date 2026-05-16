"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

// "Nur Vorwort neu"-Button im Pack-Detail-View. Triggert /api/packs/enrich
// mit AUSSCHLIESSLICH forceForewordText=true — das Cover und das Vorwort-
// Bild bleiben unveraendert.
//
// Use-Case: Der User hat Rezepte im Pack mutiert (Add/Delete) und das
// Vorwort steht noch auf der alten Recipe-Liste, obwohl der Auto-Sync
// laufen sollte. Manuelle Garantie: Klick hier triggert die Foreword-
// Generation komplett neu, ignoriert pack.editedFields[] (da enrich
// generell keine editedFields-Logik hat — es ist der initial-Generator).
//
// Cleane Abgrenzung zum "Cover + Vorwort neu"-Button:
//   - dieser hier:    nur greeting/story/signoff/outro neu (Cover bleibt)
//   - andere Button:  Cover + Vorwort-Bild + Vorwort-Text alle neu

type Props = {
  packId: string;
  tint: {
    bg: string;
    ink: string;
    accent: string;
  };
};

export function PackForewordRerollButton({ packId, tint }: Props) {
  const router = useRouter();
  const [stage, setStage] = useState<"idle" | "starting" | "waiting" | "done">(
    "idle"
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleClick = async () => {
    if (stage === "starting" || stage === "waiting") return;
    setStage("starting");
    try {
      const res = await fetch("/api/packs/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Nur Vorwort-Text — Cover + Vorwort-Bild bleiben unangetastet.
        body: JSON.stringify({
          packId,
          forceForewordText: true,
        }),
      });
      if (!res.ok) throw new Error("enrich-call returned " + res.status);
      setStage("waiting");
      // Foreword-Text ist Gemini Flash, ~5-10s typisch. Zwei Refresh-
      // Wellen reichen — schneller fertig als Cover-Generation.
      const attempts = [6000, 12000, 20000];
      let i = 0;
      const tick = () => {
        if (i >= attempts.length) {
          setStage("done");
          return;
        }
        timerRef.current = setTimeout(() => {
          router.refresh();
          i += 1;
          tick();
        }, attempts[i] - (i > 0 ? attempts[i - 1] : 0));
      };
      tick();
    } catch {
      setStage("idle");
    }
  };

  const label =
    stage === "idle"
      ? "Nur Vorwort neu"
      : stage === "starting"
        ? "Wird gestartet…"
        : stage === "waiting"
          ? "Vorwort wird neu geschrieben (5–10 s)…"
          : "Fertig — lade neu";

  const busy = stage === "starting" || stage === "waiting";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
      style={{
        borderColor: tint.ink + "20",
        background: "rgba(255,255,255,0.6)",
        color: tint.ink,
      }}
      aria-label="Nur Vorwort neu schreiben — Cover bleibt"
      title="Schreibt nur den Vorwort-Text neu (greeting + story + signoff + outro), basierend auf der aktuellen Rezept-Liste. Cover und Vorwort-Bild bleiben unverändert. Ideal wenn du Rezepte gelöscht/hinzugefügt hast und das Vorwort den neuen Stand zeigen soll."
    >
      {busy ? (
        <span
          className="inline-block size-3 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden
        />
      ) : (
        <RerollIcon />
      )}
      {label}
    </button>
  );
}

function RerollIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden
    >
      <path
        d="M3.5 7a3.5 3.5 0 0 1 6.18-2.24M10.5 7a3.5 3.5 0 0 1-6.18 2.24M9.5 4l1-1m0 0V5m0-2H8.5M4.5 10l-1 1m0 0V9m0 2H5.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
