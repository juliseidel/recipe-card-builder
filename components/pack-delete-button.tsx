"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { removeCustomPack } from "@/lib/custom-packs";

type PackDeleteButtonProps = {
  packId: string;
  brandSlug: string;
  tint: { ink: string; inkSoft: string };
};

// Two-stage delete identical to the recipe delete pattern: first click arms
// the button (red, "Wirklich löschen?") for 3s, second click commits and
// navigates back to the workspace. After delete we hit the revalidate
// endpoint so the workspace grid drops the row immediately.
export function PackDeleteButton({
  packId,
  brandSlug,
  tint,
}: PackDeleteButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = async () => {
    if (!confirming) {
      setConfirming(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setConfirming(false), 3000);
      return;
    }
    setDeleting(true);
    const ok = await removeCustomPack(packId);
    if (!ok) {
      // Don't navigate away if Supabase rejected the delete — show the
      // user the button is back to "klick again" instead of stuck in the
      // spinner.
      setDeleting(false);
      setConfirming(false);
      console.error("[pack-delete] delete failed for", packId);
      return;
    }
    await fetch("/api/packs/revalidate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandSlug }),
    }).catch(() => {});
    router.push(`/${brandSlug}`);
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseLeave={() => {
        if (!deleting) setConfirming(false);
      }}
      disabled={deleting}
      className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors"
      style={
        confirming
          ? {
              borderColor: "transparent",
              background: "#dc2626",
              color: "white",
            }
          : {
              borderColor: tint.ink + "20",
              color: tint.inkSoft,
              background: "rgba(255,255,255,0.7)",
            }
      }
    >
      {deleting ? (
        <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
          <path
            d="M3 4h8m-7 0v7a1 1 0 001 1h4a1 1 0 001-1V4M5.5 4V2.5h3V4M6 6.5v3M8 6.5v3"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {deleting
        ? "Pack wird gelöscht…"
        : confirming
        ? "Wirklich löschen?"
        : "Pack löschen"}
    </button>
  );
}
