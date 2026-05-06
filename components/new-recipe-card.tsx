import Link from "next/link";
import type { Brand } from "@/lib/brands";
import type { Pack } from "@/lib/packs";

type NewRecipeCardProps = {
  brand: Brand;
  pack: Pack;
};

export function NewRecipeCard({ brand, pack }: NewRecipeCardProps) {
  return (
    <Link
      href={`/${brand.slug}/${pack.slug}/new`}
      className="group relative flex aspect-[3/4] flex-col items-center justify-center overflow-hidden rounded-[var(--radius-card)] border-2 border-dashed transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[var(--shadow-card-hover)]"
      style={{
        borderColor: pack.mood.ink + "30",
        background: pack.mood.background + "30",
      }}
    >
      {/* Soft mood-tinted bloom */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background: `radial-gradient(ellipse 70% 55% at 50% 45%, ${pack.mood.background}, transparent 70%)`,
        }}
      />

      {/* Center stack */}
      <div className="relative z-10 flex flex-col items-center gap-7 px-8 text-center">
        <div
          className="grid size-[72px] place-items-center rounded-[20px] shadow-soft transition-transform duration-300 group-hover:scale-[1.08] group-hover:rotate-[4deg]"
          style={{
            background: pack.mood.ink,
            color: pack.mood.background,
          }}
        >
          <svg
            width="26"
            height="26"
            viewBox="0 0 26 26"
            fill="none"
            aria-hidden
          >
            <path
              d="M13 5v16M5 13h16"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <div className="flex flex-col items-center gap-2.5">
          <h3
            className="font-display text-[28px] leading-[1.0] tracking-[-0.01em] sm:text-[32px]"
            style={{ color: pack.mood.ink }}
          >
            Neue Rezeptkarte
          </h3>
          <p
            className="max-w-[22ch] text-[13px] leading-relaxed"
            style={{ color: pack.mood.inkSoft }}
          >
            Zutaten, Schritte & Nährwerte — manuell eingeben.
          </p>
        </div>

        <span
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition-transform duration-300 group-hover:translate-x-0.5"
          style={{ color: pack.mood.ink }}
        >
          Karte erstellen
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path
              d="M2.5 6h7m0 0L6.5 3m3 3l-3 3"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>

      {/* Subtle pack badge bottom */}
      <span
        className="absolute bottom-5 left-1/2 -translate-x-1/2 font-mono text-[10px] font-medium uppercase tracking-[0.2em] opacity-50"
        style={{ color: pack.mood.inkSoft }}
      >
        Pack {String(pack.number).padStart(2, "0")}
      </span>
    </Link>
  );
}
