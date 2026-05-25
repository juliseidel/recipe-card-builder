"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Pendant zum HeroRerollButton: laesst den User ein eigenes Foto hochladen,
// statt eines KI-generierten Bilds. Sitzt in derselben Toolbar-Reihe auf der
// Recipe-Detail-Seite, sodass beide Wege auf den ersten Blick sichtbar sind.
//
// Flow: File-Picker -> POST /api/recipes/hero-upload -> server schreibt das
// Bild in den recipe-heroes Bucket + setzt data.hero -> router.refresh()
// zieht das neue Bild auf die Karte. Cache-Bust passiert serverseitig.

type Props = {
  recipeId: string;
  tint: {
    bg: string;
    ink: string;
    accent: string;
  };
};

type Stage = "idle" | "uploading" | "done" | "error";

export function HeroUploadButton({ recipeId, tint }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const busy = stage === "uploading";

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErrorMsg(null);
    setStage("uploading");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("recipeId", recipeId);
      const res = await fetch("/api/recipes/hero-upload", {
        method: "POST",
        body: form,
      });
      const payload = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!res.ok || !payload.url) {
        throw new Error(payload.error ?? `Upload fehlgeschlagen (${res.status})`);
      }
      setStage("done");
      router.refresh();
      // nach 2.5 s zurueck in idle, damit der Button beim nächsten Upload
      // wieder neutral aussieht
      setTimeout(() => setStage("idle"), 2500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload fehlgeschlagen";
      setErrorMsg(msg);
      setStage("error");
    }
  }

  const label =
    stage === "uploading"
      ? "Wird hochgeladen…"
      : stage === "done"
        ? "Bild hochgeladen ✓"
        : stage === "error"
          ? "Fehler — nochmal versuchen"
          : "Eigenes Bild hochladen";

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[13px] font-medium transition-colors disabled:opacity-50"
        style={{
          borderColor: tint.ink + "25",
          color: stage === "error" ? "#b91c1c" : tint.ink,
          background: stage === "done" ? tint.accent + "18" : "transparent",
        }}
      >
        {label}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        onChange={handleFileChange}
        className="hidden"
      />
      {errorMsg && stage === "error" && (
        <span className="max-w-[260px] text-right text-[11px] text-red-700">
          {errorMsg}
        </span>
      )}
    </div>
  );
}
