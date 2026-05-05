import Link from "next/link";
import type { Brand } from "@/lib/brands";

type NewPackCardProps = {
  brand: Brand;
};

export function NewPackCard({ brand }: NewPackCardProps) {
  return (
    <Link
      href={`/${brand.slug}/new`}
      className="group relative flex aspect-[4/5] flex-col items-center justify-center gap-5 overflow-hidden rounded-[var(--radius-card)] border-2 border-dashed p-7 text-center transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[var(--shadow-card-hover)]"
      style={{
        borderColor: brand.tokens.line,
        background: brand.tokens.surface,
      }}
    >
      <div
        className="grid size-14 place-items-center rounded-2xl transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3"
        style={{
          background: brand.tokens.ink,
          color: brand.tokens.signature,
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden
        >
          <path
            d="M10 4v12M4 10h12"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div className="flex flex-col gap-2">
        <h3
          className="font-display text-[26px] leading-none tracking-[-0.01em]"
          style={{ color: brand.tokens.ink }}
        >
          Neues Pack
        </h3>
        <p
          className="mx-auto max-w-[22ch] text-[13px] leading-relaxed"
          style={{ color: brand.tokens.inkMuted }}
        >
          Wähle ein Layout, gib Rezepte ein, lass die Karten generieren.
        </p>
      </div>
    </Link>
  );
}
