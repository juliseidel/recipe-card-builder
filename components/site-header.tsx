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
          <a
            href="https://github.com/juliseidel/recipe-card-builder"
            target="_blank"
            rel="noreferrer noopener"
            aria-label="Quellcode auf GitHub"
            title="Quellcode auf GitHub"
            className="ml-1 hidden size-9 place-items-center rounded-full text-ink-subtle transition-colors hover:bg-surface hover:text-ink sm:grid"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 .5C5.7.5.5 5.7.5 12c0 5 3.3 9.3 7.9 10.9.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.4-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.4-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2.9-.3 1.9-.4 2.9-.4s2 .1 2.9.4c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.7.8 1.2 1.9 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.6-1.6 7.9-5.9 7.9-10.9C23.5 5.7 18.3.5 12 .5z" />
            </svg>
          </a>
        </nav>
      </div>
    </header>
  );
}
