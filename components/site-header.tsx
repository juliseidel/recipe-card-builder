import Link from "next/link";
import { RecipeCardLogo } from "./logo";

// Header is intentionally minimal: a creator opening this should see a
// tool for them, not a dev console. The logo is the Stacked-Cards mark
// from components/logo.tsx (matches the favicon at app/icon.svg) — sets
// the brand anchor consistently across browser-tab, header, footer.
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 w-full border-b border-line/60 bg-canvas/85 backdrop-blur-xl">
      <div className="mx-auto flex h-[68px] max-w-[1400px] items-center justify-between px-6 lg:px-10">
        <Link
          href="/"
          className="group flex items-center gap-3 text-ink transition-all duration-200 hover:opacity-90"
        >
          <span
            className="inline-flex size-10 items-center justify-center transition-transform duration-300 ease-out group-hover:-translate-y-px group-hover:rotate-[-3deg]"
            aria-hidden
          >
            <RecipeCardLogo size={36} />
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-display text-[19px] font-medium leading-none tracking-[-0.01em]">
              Recipe Card Builder
            </span>
            <span className="mt-1.5 text-[10.5px] font-semibold uppercase tracking-[0.22em] text-ink-subtle">
              Studio für Creator
            </span>
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          <Link
            href="/"
            className="rounded-full px-4 py-1.5 text-sm font-medium text-ink transition-colors duration-200 hover:bg-surface"
          >
            Workspaces
          </Link>
        </nav>
      </div>
    </header>
  );
}
