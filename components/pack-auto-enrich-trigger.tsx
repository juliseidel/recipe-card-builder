"use client";

import { useEffect, useRef } from "react";

// Client-Component die nach dem Mount EIN POST an /api/packs/auto-trigger-
// enrich macht. Der Endpoint laeuft mit User-Session-Cookies (regulaere
// Auth-Middleware) und checkt via detectAndTriggerEnrichGaps ob Recipes
// ohne Hero/Mikros oder das Pack-Cover-Lueck existieren — wenn ja:
// triggert nach.
//
// Server-Side after() in Page-Components hat in Next 16 unsere Page mit
// einem 500-Server-Error gecrashed (vermutlich weil after() experimentell
// in Server Components ist). Diese Client-Side-Loesung ist robust und
// laeuft sauber durch die existierende Auth-Pipeline.
//
// useRef + enrichedKey verhindert dass mehrfache Renders multiple Triggers
// machen. Pro Pack genau ein Trigger pro Tab-Visit.

type Props = {
  brandSlug: string;
  packSlug: string;
};

export function PackAutoEnrichTrigger({ brandSlug, packSlug }: Props) {
  const triggeredRef = useRef<string | null>(null);

  useEffect(() => {
    const key = `${brandSlug}/${packSlug}`;
    if (triggeredRef.current === key) return;
    triggeredRef.current = key;

    // fire-and-forget: Browser sendet den Request, wir schauen nicht auf
    // die Response. Backend laeuft in seinem eigenen after()-Hook weiter.
    void fetch("/api/packs/auto-trigger-enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandSlug, packSlug }),
    }).catch(() => {
      // Swallow — wenn der Trigger failed, sehen wir das in den Vercel-
      // Logs. UI bleibt unbeeintraechtigt.
    });
  }, [brandSlug, packSlug]);

  // Kein UI — purely side-effect Component.
  return null;
}
