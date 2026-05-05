import Link from "next/link";
import type { Brand } from "@/lib/brands";
import type { Pack } from "@/lib/packs";

type PackActionsProps = {
  brand: Brand;
  pack: Pack;
};

export function PackActions({ brand, pack }: PackActionsProps) {
  return (
    <section
      className="border-b"
      style={{
        background: brand.tokens.surface,
        borderColor: brand.tokens.line,
      }}
    >
      <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <div className="flex items-center gap-3 text-[13px]">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
            style={{
              background: pack.mood.accent + "20",
              color: pack.mood.accent,
            }}
          >
            <span
              className="size-1.5 rounded-full"
              style={{ background: pack.mood.accent }}
            />
            Status · druckfertig
          </span>
          <span style={{ color: brand.tokens.inkMuted }}>
            Letzte Bearbeitung · Heute 14:32
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-[13px] font-medium opacity-60"
            style={{
              background: brand.tokens.background,
              color: brand.tokens.inkMuted,
              border: `1px solid ${brand.tokens.line}`,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path
                d="M3 5h8M3 7h8M3 9h5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            Duplizieren
          </button>

          <Link
            href={`/${brand.slug}/${pack.slug}/edit`}
            className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors"
            style={{
              background: brand.tokens.background,
              color: brand.tokens.ink,
              border: `1px solid ${brand.tokens.line}`,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path
                d="M2 12V9.5L9.5 2L12 4.5L4.5 12H2Z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
            </svg>
            Pack bearbeiten
          </Link>

          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold transition-transform hover:scale-[1.02]"
            style={{
              background: pack.mood.ink,
              color: pack.mood.background,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path
                d="M7 1.5v8m0 0L4 6.5m3 3l3-3M2 11h10"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            PDF exportieren ({pack.recipeCount} Karten)
          </button>
        </div>
      </div>
    </section>
  );
}
