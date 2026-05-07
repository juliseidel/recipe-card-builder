import Link from "next/link";

// Header is intentionally minimal: a creator opening this should see a tool
// for them, not a dev console. "Quellcode" used to live here — moved to a
// small icon-only link on the right so the visual weight stays on the tool
// itself, not the engineering meta.
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 w-full border-b border-line/60 bg-canvas/85 backdrop-blur-xl">
      <div className="mx-auto flex h-[68px] max-w-[1400px] items-center justify-between px-6 lg:px-10">
        <Link
          href="/"
          className="flex items-center gap-3 text-ink transition-opacity hover:opacity-80"
        >
          <span
            className="grid size-9 place-items-center rounded-xl bg-ink text-honey shadow-soft"
            aria-hidden
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M4 4.5C4 3.67157 4.67157 3 5.5 3H10.5C11.3284 3 12 3.67157 12 4.5V13L8 11L4 13V4.5Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-display text-[19px] font-medium leading-none tracking-tight">
              Recipe Card Builder
            </span>
            <span className="mt-1 text-[11px] uppercase tracking-[0.18em] text-ink-subtle">
              Studio für Creator
            </span>
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          <Link
            href="/"
            className="rounded-full px-4 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-surface"
          >
            Workspaces
          </Link>
        </nav>
      </div>
    </header>
  );
}
