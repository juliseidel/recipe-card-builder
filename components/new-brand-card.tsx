import Link from "next/link";

export function NewBrandCard() {
  return (
    <Link
      href="/new-brand"
      className="group relative flex flex-col overflow-hidden rounded-[var(--radius-card)] border-2 border-dashed border-line-strong bg-canvas-alt/40 transition-all duration-300 hover:-translate-y-1.5 hover:border-ink hover:bg-surface hover:shadow-[var(--shadow-card-hover)]"
    >
      <div className="relative flex aspect-square flex-col items-center justify-center gap-4 px-7 text-center">
        <div className="grid size-14 place-items-center rounded-2xl bg-ink text-canvas transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
          <svg
            width="20"
            height="20"
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
        <div className="flex flex-col gap-1.5">
          <h3 className="font-display text-[24px] leading-none tracking-[-0.01em] text-ink">
            Neuer Workspace
          </h3>
          <p className="mx-auto max-w-[24ch] text-[13px] leading-relaxed text-ink-muted">
            Lege ein neues Creator-Setup an — Farben, Schriften, Vibe.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-dashed border-line-strong px-5 py-4 text-[12.5px] text-ink-subtle">
        <svg
          width="13"
          height="13"
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
