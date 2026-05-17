"use client";

import { useState } from "react";
import type { Brand } from "@/lib/brands";
import { LibraryStatusBanner } from "./library-status-banner";
import { PackSuggestionsSection } from "./pack-suggestions-section";
import { RefreshReelsButton } from "./refresh-reels-button";

// Client-Wrapper, der die komplette Reel-Library-UI orchestriert:
//   - Permanente Refresh-Toolbar mit "Letzter Sync vor X"
//   - LibraryStatusBanner (zeigt sich nur wenn ein Scrape laeuft)
//   - PackSuggestionsSection (zeigt nur, wenn pending Suggestions da)
//
// State-Flow:
//   - refreshToken: wird vom Banner.onDone und vom RefreshButton.
//     onRefreshStarted bewegt, triggert Re-Fetch in Suggestions-Section
//     und RefreshButton-Status-Anzeige
//   - showBanner: wird vom RefreshButton getriggert, sorgt dafuer dass
//     der Banner direkt mit Polling startet (sonst koennte er denken,
//     es laeuft noch kein Scrape)
//
// Wird in app/[brand]/page.tsx unter dem SiteHeader gerendert. Funktioniert
// fuer BEIDE Brand-Quellen: Code-Brands (Biene) und DB-Brands.
// Voraussetzung: brand.handle muss gesetzt sein — sonst kann nicht
// gescrapt werden.

export function BrandLibraryHeader({ brand }: { brand: Brand }) {
  const [refreshToken, setRefreshToken] = useState(0);

  const handle = brand.handle?.replace(/^@+/, "").trim();
  const hasHandle = Boolean(handle) && handle !== "creator";

  return (
    <>
      {hasHandle ? (
        <div
          className="border-b"
          style={{
            background: brand.tokens.background,
            borderColor: brand.tokens.line,
          }}
        >
          <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-6 py-2.5 lg:px-10">
            <span
              className="text-[11px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: brand.tokens.inkMuted }}
            >
              Reel-Library · {brand.handle}
            </span>
            <RefreshReelsButton
              brand={brand}
              refreshToken={refreshToken}
              onRefreshStarted={() => setRefreshToken(Date.now())}
            />
          </div>
        </div>
      ) : null}
      <LibraryStatusBanner
        brand={brand}
        onDone={() => setRefreshToken(Date.now())}
      />
      <PackSuggestionsSection brand={brand} refreshToken={refreshToken} />
    </>
  );
}
