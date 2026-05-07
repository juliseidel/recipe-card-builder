import Link from "next/link";

export function NewBrandCard() {
  return (
    <Link
      href="/new-brand"
      className="group relative flex flex-col overflow-hidden rounded-[var(--radius-card)] border-2 border-dashed border-line-strong bg-canvas-alt/40 transition-all duration-300 hover:-translate-y-1.5 hover:border-ink hover:bg-surface hover:shadow-[var(--shadow-card-hover)]"
    >
      <div className="relative flex aspect-[5/4] flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="grid size-12 place-items-center rounded-xl bg-ink text-canvas transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
          <svg
            width="18"
            height="18"
            viewBox="0 0 22 22"
            fill="none"
            aria-hidden
          >
            <path
              d="M11 4v14M4 11h14"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="font-display text-[20px] leading-none tracking-[-0.01em] text-ink">
            Neuer Workspace
          </h3>
          <p className="mx-auto max-w-[26ch] text-[12.5px] leading-relaxed text-ink-muted">
            Eigener Creator — Farben, Schriften, Pack-Sammlung.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 border-t border-dashed border-line-strong px-4 py-3 text-[12px] text-ink-subtle">
        <svg
          width="12"
          height="12"
          viewBox="0 0 14 14"
          fill="none"
          aria-hidden
        >
          <path
            d="M7 2.5v9M2.5 7h9"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        Workspace erstellen
      </div>
    </Link>
  );
}
