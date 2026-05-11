"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

// "Bild neu generieren"-Button im Detail-View. Triggert /api/recipes/enrich
// mit forceHero=true und pollt danach die Page, weil das Hero asynchron in
// Vercel after() landet (15-90 s typische BFL-Flux-Laufzeit). Wir muten
// nicht die ganze Page — die Karte bleibt sichtbar, der Button zeigt nur
// kurz "Wird neu generiert…", und nach ~45 s holt router.refresh() das
// neue Bild aus der DB.

type Props = {
  recipeId: string;
  tint: {
    bg: string;
    ink: string;
    accent: string;
  };
};

export function HeroRerollButton({ recipeId, tint }: Props) {
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
      const res = await fetch("/api/recipes/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipeId, forceHero: true }),
      });
      if (!res.ok) throw new Error("enrich-call returned " + res.status);
      setStage("waiting");
      // Hero ist async (after()). 45s ist ein sicherer Mittelwert fuer Flux —
      // mehrere Refresh-Versuche, damit der User nicht zu fruehe abbricht.
      const attempts = [15000, 30000, 45000, 65000];
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
      ? "Bild neu generieren"
      : stage === "starting"
        ? "Wird gestartet…"
        : stage === "waiting"
          ? "Bild wird generiert (45–90 s)…"
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
      aria-label="Bild neu generieren"
      title="Generiert ein neues Hero-Bild für diese Karte. Dauert 45–90 s."
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
      width="13"
      height="13"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden
    >
      <path
        d="M2.5 7a4.5 4.5 0 018-2.8M11.5 7a4.5 4.5 0 01-8 2.8M11 1.5V4H8.5M3 12.5V10h2.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
