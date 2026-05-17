"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Brand } from "@/lib/brands";
import { getAllBrandsClient } from "@/lib/custom-brands";

// Top-Left-Switcher fuer schnellen Wechsel zwischen Creator-Workspaces,
// ohne den Umweg ueber den Hub. Ingos Feedback-Quote: "ich habe hier
// Top Right irgendwie einen Dropdown und kann zwischen Creatoren
// wechseln."
//
// Verhalten:
//   - Self-detected via usePathname() — rendert sich nur, wenn der User
//     gerade in einem Brand-Workspace ist (`/[brand]/...`), sonst null.
//     Auf Hub, Login, Welcome, /new-brand und /submission unsichtbar.
//   - Brands kommen client-side via getAllBrandsClient() — Code-Brands
//     (Biene) + DB-Brands aus Supabase, gemischt.
//   - Klick auf anderen Brand → direkter router.push(`/[slug]`), KEINE
//     Welcome-Animation. Das ist die Quick-Switch-UX, die Welcome ist
//     dem cinematischen Hub-Eintritt vorbehalten.
//   - Klick auf "Workspace-Hub" Link → zurueck zu /.
//   - Dropdown schliesst sich bei Klick ausserhalb + Escape-Key.

// Reservierte First-Segments, die NICHT als Brand-Slug interpretiert
// werden duerfen. Bei Match: Switcher rendert nichts.
const RESERVED_SEGMENTS = new Set([
  "",
  "login",
  "welcome",
  "new-brand",
  "submission",
  "api",
]);

export function BrandSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const [brands, setBrands] = useState<Brand[] | null>(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const firstSegment = (pathname?.split("/").filter(Boolean)[0] ?? "")
    .toLowerCase();
  const isBrandPath = firstSegment && !RESERVED_SEGMENTS.has(firstSegment);

  // Brands lazy laden — nur wenn wir auch in einem Brand-Workspace sind.
  // So sparen wir den DB-Roundtrip auf Hub/Login/Welcome wo der Switcher
  // eh nicht gerendert wird.
  useEffect(() => {
    if (!isBrandPath || brands !== null) return;
    let active = true;
    void getAllBrandsClient().then((bs) => {
      if (active) setBrands(bs);
    });
    return () => {
      active = false;
    };
  }, [isBrandPath, brands]);

  // Klick ausserhalb schliesst das Dropdown. useEffect haengt sich an
  // mousedown — pointerdown ist breiter aber kompatibilitaet ist gut
  // genug fuer alle Ziel-Browser.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!isBrandPath) return null;
  if (brands === null) {
    // Loading-Skeleton statt nichts — verhindert Layout-Shift, wenn
    // der Dropdown nach 100-300 ms ploppt.
    return (
      <div className="h-[34px] w-[140px] animate-pulse rounded-full bg-surface/60" />
    );
  }
  const current = brands.find((b) => b.slug === firstSegment);
  if (!current) return null;
  const others = brands.filter((b) => b.slug !== firstSegment);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={`Aktuell: ${current.name} — klick fuer Switcher`}
        className="group inline-flex items-center gap-2 rounded-full border border-line/60 bg-surface/85 px-2.5 py-1.5 text-[12px] font-medium text-ink backdrop-blur-md transition-all duration-200 hover:border-line hover:bg-surface hover:shadow-[0_4px_12px_-4px_rgba(43,31,25,0.15)]"
      >
        {current.avatar ? (
          <span className="relative size-5 overflow-hidden rounded-full">
            <Image
              src={current.avatar}
              alt=""
              fill
              sizes="20px"
              className="object-cover"
            />
          </span>
        ) : (
          <span
            className="grid size-5 place-items-center rounded-full text-[10px] font-semibold"
            style={{
              background: current.tokens.accent + "33",
              color: current.tokens.accent,
            }}
          >
            {current.name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span>{current.name}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          aria-hidden
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path
            d="M2 4l3 3 3-3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-72 overflow-hidden rounded-2xl border border-line/60 bg-surface/95 p-2 shadow-[0_24px_60px_-30px_rgba(43,31,25,0.4)] backdrop-blur-md"
        >
          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
            Workspace wechseln
          </div>

          {others.length === 0 ? (
            <div className="px-3 py-3 text-[12px] text-ink-muted">
              Noch keine weiteren Creator angelegt.
            </div>
          ) : (
            <ul>
              {others.map((brand) => (
                <li key={brand.slug}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOpen(false);
                      router.push(`/${brand.slug}`);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-canvas-alt"
                  >
                    {brand.avatar ? (
                      <span className="relative size-9 shrink-0 overflow-hidden rounded-full border border-line/40">
                        <Image
                          src={brand.avatar}
                          alt=""
                          fill
                          sizes="36px"
                          className="object-cover"
                        />
                      </span>
                    ) : (
                      <span
                        className="grid size-9 shrink-0 place-items-center rounded-full font-display text-[14px] font-semibold"
                        style={{
                          background: brand.tokens.accent + "20",
                          color: brand.tokens.accent,
                        }}
                      >
                        {brand.name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[13px] font-medium text-ink">
                        {brand.name}
                      </span>
                      <span className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                        {brand.handle}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div
            className="my-1 border-t"
            style={{ borderColor: "rgba(43, 31, 25, 0.1)" }}
          />

          <Link
            href={`/${current.slug}/settings`}
            onClick={() => setOpen(false)}
            role="menuitem"
            className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-[12px] font-medium text-ink-muted transition-colors hover:bg-canvas-alt hover:text-ink"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden
            >
              <path
                d="M7 9.2A2.2 2.2 0 1 0 7 4.8a2.2 2.2 0 0 0 0 4.4zM11.6 7c0 .35-.03.69-.1 1.02l1.34 1.05-1.3 2.25-1.55-.62a4.7 4.7 0 0 1-1.77 1.02L8 13.5H5.4l-.22-1.78a4.7 4.7 0 0 1-1.77-1.02l-1.55.62-1.3-2.25 1.34-1.05A4.7 4.7 0 0 1 1.8 7c0-.35.03-.69.1-1.02L.56 4.93l1.3-2.25 1.55.62a4.7 4.7 0 0 1 1.77-1.02L5.4.5H8l.22 1.78a4.7 4.7 0 0 1 1.77 1.02l1.55-.62 1.3 2.25-1.34 1.05c.06.33.1.67.1 1.02z"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Workspace-Einstellungen
          </Link>

          <Link
            href="/"
            onClick={() => setOpen(false)}
            role="menuitem"
            className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-[12px] font-medium text-ink-muted transition-colors hover:bg-canvas-alt hover:text-ink"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden
            >
              <path
                d="M11 7H3m0 0L6.5 3.5M3 7l3.5 3.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Workspace-Hub
          </Link>
        </div>
      ) : null}
    </div>
  );
}
