import Image from "next/image";
import type { Brand } from "@/lib/brands";

type BrandHeroProps = {
  brand: Brand;
  /** Live-zaehlende Pack-Anzahl (curated + custom). Faellt auf den im
   *  Brand hinterlegten Statisch-Wert zurueck, falls der Caller noch
   *  keinen live count uebergibt. */
  livePackCount?: number;
  /** Live-zaehlende Rezept-Anzahl (alle sichtbaren Karten ueber alle
   *  Packs der Brand: curated − hidden + custom). Faellt analog auf den
   *  hinterlegten Statisch-Wert zurueck. */
  liveRecipeCount?: number;
};

export function BrandHero({
  brand,
  livePackCount,
  liveRecipeCount,
}: BrandHeroProps) {
  return (
    <section
      className="relative border-b"
      style={{
        background: brand.tokens.background,
        borderColor: brand.tokens.line,
      }}
    >
      <div className="mx-auto max-w-[1400px] px-6 pt-10 pb-8 lg:px-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
          <div className="flex items-center gap-5">
            <div
              className="relative size-[88px] shrink-0 overflow-hidden rounded-2xl ring-2"
              style={{
                background: brand.tokens.surface,
                boxShadow:
                  "0 1px 0 rgba(43,31,25,0.05), 0 12px 24px -10px rgba(43,31,25,0.18)",
              }}
            >
              <Image
                src={brand.avatar}
                alt={`${brand.name} – ${brand.fullName}`}
                fill
                sizes="88px"
                className="object-cover"
                priority
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline gap-3">
                <h1
                  className="font-display text-[40px] leading-none tracking-[-0.01em] sm:text-[48px]"
                  style={{ color: brand.tokens.ink }}
                >
                  {brand.name}
                </h1>
                <span
                  className="text-[14px] font-medium"
                  style={{ color: brand.tokens.inkMuted }}
                >
                  {brand.handle}
                </span>
              </div>
              <p
                className="text-[14px] leading-snug"
                style={{ color: brand.tokens.inkMuted }}
              >
                {brand.fullName} · {brand.tagline}
              </p>
              <span
                className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                style={{
                  background: brand.tokens.signature + "30",
                  color: brand.tokens.ink,
                }}
              >
                <span
                  className="size-1.5 rounded-full"
                  style={{ background: brand.tokens.signature }}
                />
                Signatur · {brand.signature}
              </span>
            </div>
          </div>

          {/* Stats-Block: auf Mobile als 2-Spalten-Grid (vier Stats in 2x2),
              ab sm wieder als Flex-Row mit vertikalen Dividern. So passt
              der Block auch in einen 375-px-iPhone-Viewport, ohne dass
              "Live" rechts abgeschnitten wird. Desktop-Layout unverändert. */}
          <div
            className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-2xl border px-5 py-4 sm:flex sm:items-stretch sm:gap-6"
            style={{
              borderColor: brand.tokens.line,
              background: brand.tokens.surface,
            }}
          >
            <Stat label="Follower" value={brand.stats.followers} brand={brand} />
            <Divider brand={brand} />
            <Stat
              label="Packs"
              value={String(livePackCount ?? brand.packCount)}
              brand={brand}
            />
            <Divider brand={brand} />
            <Stat
              label="Rezepte"
              value={String(liveRecipeCount ?? brand.recipeCount)}
              brand={brand}
            />
            <Divider brand={brand} />
            <Stat
              label="Status"
              value="Live"
              brand={brand}
              valueColor={brand.tokens.accent}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  brand,
  valueColor,
}: {
  label: string;
  value: string;
  brand: Brand;
  valueColor?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span
        className="font-display text-[24px] leading-none"
        style={{ color: valueColor ?? brand.tokens.ink }}
      >
        {value}
      </span>
      <span
        className="text-[10px] font-semibold uppercase tracking-[0.16em]"
        style={{ color: brand.tokens.inkMuted }}
      >
        {label}
      </span>
    </div>
  );
}

function Divider({ brand }: { brand: Brand }) {
  return (
    <span
      // Versteckt auf Mobile (Grid-Layout braucht keine Trennstriche),
      // ab sm wieder sichtbar als vertikale Trennlinie zwischen den Stats.
      className="hidden h-9 w-px self-center sm:block"
      style={{ background: brand.tokens.line }}
    />
  );
}
