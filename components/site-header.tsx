"use client";

import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/login/actions";
import { BrandSwitcher } from "./brand-switcher";

// Floating Top-Right-Toolbar. Path-sensitive sichtbar:
//
//   /[brand]               → Brand-Switcher + Abmelden
//   /                      → Abmelden (Hub)
//   /new-brand             → Abmelden (Onboarding)
//   /[brand]/[pack]...     → NICHTS (User-Feedback: die Top-Right-Buttons
//                            haben die Action-Buttons der Pack/Recipe-Pages
//                            visuell zugedeckt — Loeschen, Bild neu, PDF)
//   /login, /welcome, /api → NICHTS
//
// Brand-Style-Refresh-Button wurde entfernt (User-Feedback: nicht mehr
// noetig, die Pipeline laeuft auch ohne explizites Re-Trigger). Endpoint
// /api/brands/regenerate-style + Komponente brand-style-refresh.tsx bleiben
// im Code falls wir das spaeter wieder brauchen.

const RESERVED_FIRST_SEGMENTS = new Set([
  "login",
  "welcome",
  "new-brand",
  "submission",
  "api",
]);

export function SiteHeader() {
  const pathname = usePathname() ?? "/";
  const segments = pathname.split("/").filter(Boolean);

  // Welche Route?
  const isHub = segments.length === 0;
  const isReserved =
    segments.length >= 1 && RESERVED_FIRST_SEGMENTS.has(segments[0]);
  const isBrandSubPage =
    segments.length >= 2 && !RESERVED_FIRST_SEGMENTS.has(segments[0]);
  const isBrandRoot =
    segments.length === 1 && !RESERVED_FIRST_SEGMENTS.has(segments[0]);

  // Sub-Pages eines Brands: gar nichts rendern. Damit haben die Action-
  // Buttons der Pack/Recipe-Pages (Loeschen, PDF, Re-Roll) freie Bahn.
  if (isBrandSubPage) return null;

  // /login, /welcome, /submission, /api → auch nichts. Logout auf /login
  // macht keinen Sinn, /welcome ist cinematic.
  if (isReserved && segments[0] !== "new-brand") return null;

  // Wir zeigen den Brand-Switcher nur am Brand-Root. Auf Hub/new-brand ist
  // er nutzlos (kein Current-Brand).
  const showSwitcher = isBrandRoot;
  // Auf Hub, /new-brand und Brand-Root: Abmelden sichtbar.
  const showLogout = isHub || isBrandRoot || segments[0] === "new-brand";

  if (!showSwitcher && !showLogout) return null;

  return (
    <div className="fixed right-4 top-4 z-50 flex items-center gap-2 lg:right-6 lg:top-6">
      {showSwitcher ? <BrandSwitcher /> : null}
      {showLogout ? (
        <form action={logoutAction}>
          <button
            type="submit"
            title="Abmelden"
            aria-label="Abmelden"
            className="group inline-flex items-center gap-1.5 rounded-full border border-line/60 bg-surface/85 px-3.5 py-1.5 text-[12px] font-medium text-ink-muted backdrop-blur-md transition-all duration-200 hover:border-line hover:bg-surface hover:text-ink hover:shadow-[0_4px_12px_-4px_rgba(43,31,25,0.15)]"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden
              className="transition-transform duration-200 group-hover:translate-x-0.5"
            >
              <path
                d="M5.5 2H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h2.5M9 4.5L11.5 7M11.5 7L9 9.5M11.5 7H6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Abmelden
          </button>
        </form>
      ) : null}
    </div>
  );
}
