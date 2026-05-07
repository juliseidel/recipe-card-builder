import Link from "next/link";
import type { Brand } from "@/lib/brands";

type NewPackCardProps = {
  brand: Brand;
  /** The number this pack would receive when saved — workspace counts
   *  static + custom packs and passes (count + 1). Falls back to 6 for
   *  callers that haven't been updated yet. */
  nextNumber?: number;
};

export function NewPackCard({ brand, nextNumber = 6 }: NewPackCardProps) {
  const orderLabel = String(nextNumber).padStart(2, "0");
  return (
    <Link
      href={`/${brand.slug}/new`}
      className="group relative flex flex-col overflow-hidden rounded-[var(--radius-card)] border-2 border-dashed transition-all duration-300 hover:-translate-y-2 hover:shadow-[var(--shadow-card-hover)]"
      style={{
        borderColor: brand.tokens.line,
        background: brand.tokens.surface,
      }}
    >
      {/* Top row matched to pack-card layout */}
      <div className="flex items-start justify-between gap-3 px-6 pt-5">
        <span
          className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em]"
          style={{ color: brand.tokens.inkMuted }}
        >
          Pack {orderLabel}
        </span>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em]"
          style={{
            background: brand.tokens.signature + "30",
            color: brand.tokens.ink,
          }}
        >
          Neu starten
        </span>
      </div>

      {/* Empty image area with plus icon */}
      <div
        className="relative mx-6 mt-4 grid aspect-[4/3.4] place-items-center overflow-hidden rounded-2xl"
        style={{
          background: brand.tokens.background,
        }}
      >
        <div
          className="grid size-16 place-items-center rounded-2xl transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3"
          style={{
            background: brand.tokens.ink,
            color: brand.tokens.signature,
          }}
        >
          <svg
            width="22"
            height="22"
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
      </div>

      {/* Text body */}
      <div className="flex flex-1 flex-col gap-3 px-6 pt-6 pb-6">
        <span
          className="text-[12px] font-semibold uppercase tracking-[0.16em]"
          style={{ color: brand.tokens.inkMuted }}
        >
          Eigenes Konzept
        </span>
        <h3
          className="font-display text-[34px] leading-[0.96] tracking-[-0.01em]"
          style={{ color: brand.tokens.ink }}
        >
          Neues Pack
          <span className="block text-[18px] font-normal italic opacity-70">
            in Bienes Welt
          </span>
        </h3>
        <p
          className="text-[14px] leading-[1.55]"
          style={{ color: brand.tokens.inkMuted }}
        >
          Wähle Layout, gib Rezepte ein, lass die Karten generieren.
        </p>

        <div
          className="mt-auto flex items-center justify-between border-t pt-4"
          style={{ borderColor: brand.tokens.ink + "1a" }}
        >
          <span
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold transition-transform duration-300 group-hover:translate-x-0.5"
            style={{ color: brand.tokens.ink }}
          >
            Pack starten
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden
            >
              <path
                d="M3 7h8m0 0L7.5 3.5M11 7l-3.5 3.5"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span
            className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: brand.tokens.inkMuted }}
          >
            ~ 3 Min Setup
          </span>
        </div>
      </div>
    </Link>
  );
}
