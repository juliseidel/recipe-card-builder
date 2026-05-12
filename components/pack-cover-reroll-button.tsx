"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

// "Cover neu generieren"-Button im Pack-Detail-View. Analog zum Recipe-
// Hero-Reroll-Button — triggert /api/packs/enrich mit forceCover=true,
// d.h. die Flux 2 Pro Pack-Cover-Pipeline laeuft erneut mit anderem Seed.
//
// Use-Case: User hat einen Pack erstellt, aber das Cover ist haengen
// geblieben (Skeleton-Loading-State faded nicht aus) oder das generierte
// Bild gefaellt nicht. Klick → ~20-30 s warten → frisches Cover ist da.
//
// Pollt die Page in mehreren Wellen — pack.coverImage wird vom Enrich-
// Endpoint upserted, beim refresh holt Next die neue URL.

type Props = {
  packId: string;
  tint: {
    bg: string;
    ink: string;
    accent: string;
  };
};

export function PackCoverRerollButton({ packId, tint }: Props) {
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
        // Klick regeneriert beide grafischen Pack-Assets: Cover UND
        // Foreword-Image. Beide laufen ueber Flux, parallel im Background.
        // Vorher nur Cover — User hatten dann keinen Weg, das Foreword-
        // Bild allein zu refreshen wenn's thematisch nicht passt.
        body: JSON.stringify({
          packId,
          forceCover: true,
          forceForewordImage: true,
        }),
      });
      if (!res.ok) throw new Error("enrich-call returned " + res.status);
      setStage("waiting");
      // Cover ist async (after()) — ~20-30s typisch. Mehrere Refresh-
      // Wellen damit der User nicht zu frueh aufgibt.
      const attempts = [10000, 20000, 35000, 55000];
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
      ? "Cover + Vorwort neu"
      : stage === "starting"
        ? "Wird gestartet…"
        : stage === "waiting"
          ? "Cover + Vorwort werden neu generiert (20–40 s)…"
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
      aria-label="Pack-Cover + Vorwort-Bild neu generieren"
      title="Generiert Pack-Cover UND Vorwort-Stillleben komplett neu via Flux 2 Pro. Falls eines der beiden Bilder hängt oder thematisch nicht passt — einfach klicken. Dauert ~20–40 Sekunden, beide parallel."
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
