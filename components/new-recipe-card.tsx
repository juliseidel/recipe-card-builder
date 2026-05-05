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
      className="group relative flex aspect-[3/4] flex-col items-center justify-center gap-5 overflow-hidden rounded-[var(--radius-card)] border-2 border-dashed p-7 text-center transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[var(--shadow-card-hover)]"
      style={{
        borderColor: pack.mood.ink + "40",
        background: pack.mood.background + "40",
      }}
    >
      {/* Mood-tinted soft background bloom */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background: `radial-gradient(ellipse 80% 60% at 50% 30%, ${pack.mood.background}, transparent 70%)`,
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-5">
        {/* Plus icon in pack-mood-dark */}
        <div
          className="grid size-16 place-items-center rounded-2xl shadow-soft transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3"
          style={{
            background: pack.mood.ink,
            color: pack.mood.background,
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

        <div className="flex flex-col gap-2">
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: pack.mood.inkSoft }}
          >
            Pack {String(pack.number).padStart(2, "0")} · {pack.title}
          </span>
          <h3
            className="font-sans text-[22px] font-bold uppercase leading-[0.96] tracking-[-0.02em]"
            style={{ color: pack.mood.ink }}
          >
            Neue Rezept-
            <br />
            karte
          </h3>
          <p
            className="mx-auto max-w-[20ch] text-[12px] leading-relaxed"
            style={{ color: pack.mood.inkSoft }}
          >
            Zutaten, Schritte, Nährwerte — manuell eingeben.
          </p>
        </div>
      </div>

      <div
        className="relative z-10 mt-auto flex items-center justify-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.14em]"
        style={{ color: pack.mood.ink }}
      >
        Karte erstellen
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path
            d="M2.5 6h7m0 0L6.5 3m3 3l-3 3"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </Link>
  );
}
