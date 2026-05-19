import Link from "next/link";
import Image from "next/image";
import type { Brand } from "@/lib/brands";
import type { Pack } from "@/lib/packs";
import type { ExerciseCard, FitnessCard } from "@/lib/fitness/types";
import { isExerciseCard } from "@/lib/fitness/types";
import { SiteHeader } from "./site-header";

// Hyrox Race-Day Programme — Web-Spiegel des PDF-Layouts.
// Magazine-Cover-Hero, Mega-Ghost-Number, Race-Strip, Pace-Block,
// Stations-Map. Premium-Polish, kein 0815-Layout.

type NavTarget = { href: string; title: string } | null;

type Props = {
  brand: Brand;
  pack: Pack;
  card: FitnessCard;
  totalCards: number;
  previous: NavTarget;
  next: NavTarget;
};

const COLORS = {
  bg: "#0a0a0d",
  bgSoft: "#0f0f12",
  surface: "#16161a",
  surfaceHi: "#1c1c20",
  accent: "#f4a338",
  accentDim: "#7a5a2a",
  accentGhost: "rgba(244,163,56,0.12)",
  ink: "#fafafa",
  inkMuted: "#8c8c95",
  inkSubtle: "#5a5a63",
  inkDim: "#3a3a40",
  warn: "#d49060",
  warnDim: "#3e2a16",
  divider: "#1f1f25",
  dividerStrong: "#2c2c33",
} as const;

export function FitnessCardDetailLayout({
  brand,
  pack,
  card,
  totalCards,
  previous,
  next,
}: Props) {
  return (
    <div className="flex min-h-screen flex-col" style={{ background: COLORS.bg }}>
      <SiteHeader />

      {/* Breadcrumb / Nav-Bar — minimalistisch in der Race-Tonalität */}
      <section
        className="border-b"
        style={{ borderColor: COLORS.dividerStrong, background: COLORS.bg }}
      >
        <div className="mx-auto flex max-w-[1240px] flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-10">
          <nav
            className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]"
            style={{ color: COLORS.inkMuted, letterSpacing: "0.04em" }}
          >
            <Link href={`/${brand.slug}`} className="uppercase opacity-75 transition hover:opacity-100">
              {brand.name}
            </Link>
            <span style={{ color: COLORS.inkSubtle }}>/</span>
            <Link href={`/${brand.slug}/${pack.slug}`} className="uppercase opacity-75 transition hover:opacity-100">
              {pack.title}
            </Link>
            <span style={{ color: COLORS.inkSubtle }}>/</span>
            <span className="uppercase" style={{ color: COLORS.ink, fontWeight: 600 }}>
              {card.title}
            </span>
          </nav>

          <div className="flex items-center gap-2 text-[11px]" style={{ color: COLORS.inkSubtle }}>
            {previous ? (
              <Link
                href={previous.href}
                className="border px-3 py-1.5 uppercase tracking-[0.15em] transition hover:opacity-100"
                style={{
                  borderColor: COLORS.dividerStrong,
                  color: COLORS.inkMuted,
                  opacity: 0.85,
                }}
              >
                ← Prev
              </Link>
            ) : null}
            {next ? (
              <Link
                href={next.href}
                className="border px-3 py-1.5 uppercase tracking-[0.15em] transition hover:opacity-100"
                style={{
                  borderColor: COLORS.dividerStrong,
                  color: COLORS.inkMuted,
                  opacity: 0.85,
                }}
              >
                Next →
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {/* Main: Card-Render */}
      <main className="flex-1">
        <FitnessCardWebRender
          brand={brand}
          pack={pack}
          card={card}
          totalCards={totalCards}
        />
      </main>

      {/* Footer */}
      <footer
        className="border-t"
        style={{ borderColor: COLORS.dividerStrong, background: COLORS.bgSoft }}
      >
        <div className="mx-auto flex max-w-[1240px] flex-col items-start justify-between gap-3 px-6 py-7 text-[12px] sm:flex-row sm:items-center lg:px-10">
          <p style={{ color: COLORS.inkMuted, letterSpacing: "0.04em" }}>
            <span
              className="font-display italic"
              style={{ color: COLORS.ink, fontWeight: 500 }}
            >
              {brand.signature}
            </span>
            <span style={{ color: COLORS.inkSubtle }}>
              {" "}
              · {pack.title} · Race-Day Programme
            </span>
          </p>
          <p
            className="text-[10px] uppercase tracking-[0.2em]"
            style={{ color: COLORS.inkSubtle }}
          >
            {brand.handle}
          </p>
        </div>
      </footer>
    </div>
  );
}

// ─── Card-Render — Magazine-Cover-Style ──────────────────────────────
function FitnessCardWebRender({
  brand,
  pack,
  card,
  totalCards,
}: {
  brand: Brand;
  pack: Pack;
  card: FitnessCard;
  totalCards: number;
}) {
  if (!isExerciseCard(card)) {
    return (
      <div className="mx-auto max-w-[1240px] px-6 py-12 lg:px-10 lg:py-20">
        <div
          className="rounded-lg border p-12 text-center"
          style={{ borderColor: COLORS.dividerStrong, color: COLORS.inkMuted }}
        >
          <h2 className="font-display text-[28px]" style={{ color: COLORS.ink }}>
            {card.title}
          </h2>
          <p className="mt-3 text-[14px]">
            Layout für Card-Type &quot;{card.type}&quot; folgt in einem späteren
            Schritt.
          </p>
        </div>
      </div>
    );
  }

  const ex = card as ExerciseCard;
  const bodyParts = ex.bodyParts ?? [];
  const cues = ex.exercise.cues ?? [];
  const mistakes = ex.exercise.commonMistakes ?? [];
  const stationNum = ex.number ?? 1;
  const stationNumStr = stationNum.toString().padStart(2, "0");

  return (
    <article className="mx-auto max-w-[1240px] px-6 py-6 lg:px-10 lg:py-10">
      {/* ═══ HERO SECTION ═══════════════════════════════════════════ */}
      <section
        className="relative w-full overflow-hidden"
        style={{
          background: COLORS.surface,
          // Tall portrait-leaning hero — Magazine-Cover feel
          aspectRatio: "16 / 11",
          maxHeight: "640px",
        }}
      >
        {card.hero ? (
          <>
            <Image
              src={card.hero}
              alt={card.title}
              fill
              quality={95}
              sizes="(min-width: 1024px) 1200px, 100vw"
              className="object-cover"
              priority
            />
            {/* Top vignette für Race-Strip-Lesbarkeit */}
            <div
              className="pointer-events-none absolute top-0 left-0 right-0 h-32"
              style={{
                background:
                  "linear-gradient(to bottom, rgba(10,10,13,0.6), transparent)",
              }}
            />
            {/* Bottom gradient für Title-Overlay */}
            <div
              className="pointer-events-none absolute bottom-0 left-0 right-0 h-3/5"
              style={{
                background:
                  "linear-gradient(to bottom, transparent, rgba(10,10,13,0.92) 70%, #0a0a0d)",
              }}
            />
          </>
        ) : (
          // Eleganter Empty-State (Block 6 Polish): Mega-Outline-Number im
          // Hintergrund + Brand-Mark + Divider + Hero-Status zentriert.
          // Vorher: nur Mega-Number alleine = wirkte billig.
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="pointer-events-none absolute select-none font-bold leading-none tracking-tighter"
              style={{
                fontSize: "clamp(220px, 38vw, 440px)",
                color: COLORS.bgSoft,
                letterSpacing: "-0.05em",
              }}
              aria-hidden
            >
              {stationNumStr}
            </span>
            <div className="relative flex flex-col items-center gap-4">
              <span
                className="text-[12px] font-bold uppercase tracking-[0.3em]"
                style={{ color: COLORS.inkMuted }}
              >
                {brand.handle ?? brand.name}
              </span>
              <span
                className="block"
                style={{ width: 56, height: 1, background: COLORS.dividerStrong }}
              />
              <span
                className="text-[10px] font-medium uppercase tracking-[0.25em]"
                style={{ color: COLORS.inkSubtle }}
              >
                Hero folgt
              </span>
            </div>
          </div>
        )}

        {/* Race-Strip oben */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-8 py-6 lg:px-12 lg:py-8">
          <span
            className="text-[10px] font-bold uppercase tracking-[0.25em]"
            style={{ color: COLORS.ink }}
          >
            {brand.handle ?? brand.name}
          </span>
          {stationNum <= 8 ? (
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                <span
                  key={s}
                  className="block"
                  style={{
                    width: 18,
                    height: 5,
                    background:
                      s === stationNum ? COLORS.accent : "rgba(255,255,255,0.18)",
                  }}
                />
              ))}
              <span
                className="ml-3 text-[10px] font-bold uppercase tracking-[0.18em]"
                style={{ color: COLORS.accent }}
              >
                Station {stationNumStr}
              </span>
            </div>
          ) : (
            <span
              className="text-[10px] font-bold uppercase tracking-[0.2em]"
              style={{ color: COLORS.accent }}
            >
              {stationNumStr} / {totalCards.toString().padStart(2, "0")}
            </span>
          )}
        </div>

        {/* Title-Overlay unten (mit Ghost-Number im Hintergrund) */}
        <div className="absolute bottom-0 left-0 right-0 z-10 px-8 pb-8 lg:px-12 lg:pb-10">
          {/* Mega-Ghost-Number */}
          <span
            className="pointer-events-none absolute select-none font-bold leading-[0.85] tracking-tighter"
            style={{
              left: "1rem",
              bottom: "-3rem",
              fontSize: "clamp(220px, 28vw, 340px)",
              color: COLORS.accentGhost,
              zIndex: 0,
            }}
            aria-hidden
          >
            {stationNumStr}
          </span>

          <div className="relative z-10">
            {bodyParts.length > 0 ? (
              <div className="mb-4 flex flex-wrap gap-1.5">
                {bodyParts.slice(0, 3).map((bp) => (
                  <span
                    key={bp}
                    className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em]"
                    style={{
                      background: COLORS.ink,
                      color: COLORS.bg,
                    }}
                  >
                    {bp}
                  </span>
                ))}
              </div>
            ) : null}
            <h1
              className="font-bold leading-[0.95] tracking-tight"
              style={{
                color: COLORS.ink,
                fontSize: "clamp(40px, 6vw, 80px)",
                letterSpacing: "-0.03em",
              }}
            >
              {ex.title}
            </h1>
            {ex.subtitle ? (
              <p
                className="mt-3 text-[12px] font-medium uppercase tracking-[0.18em]"
                style={{ color: COLORS.inkMuted }}
              >
                {ex.subtitle}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {/* ═══ PACE-BLOCK ═══════════════════════════════════════════════ */}
      <section
        className="grid grid-cols-3 border-b"
        style={{ borderColor: COLORS.dividerStrong }}
      >
        <PaceColumn
          label="Volumen"
          value={ex.exercise.setsReps}
          unit={ex.exercise.load ?? undefined}
        />
        <PaceColumn
          label="Pause"
          value={ex.exercise.rest ?? "—"}
          unit={ex.exercise.tempo ?? undefined}
          accent
          withBorder
        />
        <PaceColumn
          label="Level"
          value={(ex.level ?? "—").toUpperCase()}
          unit={ex.durationMinutes ? `${ex.durationMinutes} min` : undefined}
        />
      </section>

      {/* ═══ CONTENT SECTION ════════════════════════════════════════ */}
      <section className="grid grid-cols-1 gap-12 px-2 py-12 lg:grid-cols-[1.6fr_1fr] lg:gap-16 lg:px-4">
        {/* Linke Spalte: Cues + Mistakes */}
        <div className="flex flex-col gap-12">
          {cues.length > 0 ? (
            <div>
              <SectionLabel>Technik</SectionLabel>
              <ol className="mt-4 flex flex-col">
                {cues.slice(0, 6).map((cue, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-5 border-b py-4"
                    style={{ borderColor: COLORS.divider }}
                  >
                    <span
                      className="shrink-0 text-[14px] font-bold tabular-nums"
                      style={{ color: COLORS.accent, width: 28 }}
                    >
                      {i.toString().padStart(2, "0")}
                    </span>
                    <span
                      className="text-[14px] leading-relaxed"
                      style={{ color: COLORS.ink }}
                    >
                      {cue}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {mistakes.length > 0 ? (
            <div>
              <SectionLabel color={COLORS.warn}>Watch Out</SectionLabel>
              <ul className="mt-4 flex flex-col gap-3">
                {mistakes.slice(0, 3).map((m, i) => (
                  <li key={i} className="flex items-start gap-4">
                    <span
                      className="shrink-0 text-[18px] font-bold leading-none"
                      style={{ color: COLORS.warn, width: 16 }}
                    >
                      ×
                    </span>
                    <span
                      className="text-[14px] leading-relaxed"
                      style={{ color: COLORS.ink }}
                    >
                      {m}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {/* Rechte Spalte: Variations + Spec */}
        <aside className="flex flex-col gap-6">
          {ex.exercise.beginnerVariation ? (
            <VariationBlock
              label="Scaled"
              text={ex.exercise.beginnerVariation}
            />
          ) : null}
          {ex.exercise.advancedVariation ? (
            <VariationBlock label="Rx+ / Pro" text={ex.exercise.advancedVariation} />
          ) : null}

          {(ex.exercise.primaryMuscles ||
            ex.exercise.secondaryMuscles ||
            ex.exercise.workoutType) && (
            <div className="mt-2">
              <SectionLabel>Spec</SectionLabel>
              <dl className="mt-3">
                {ex.exercise.workoutType ? (
                  <SpecRow label="Type" value={ex.exercise.workoutType} />
                ) : null}
                {ex.exercise.primaryMuscles ? (
                  <SpecRow
                    label="Primary"
                    value={ex.exercise.primaryMuscles}
                  />
                ) : null}
                {ex.exercise.secondaryMuscles ? (
                  <SpecRow
                    label="Secondary"
                    value={ex.exercise.secondaryMuscles}
                  />
                ) : null}
              </dl>
            </div>
          )}
        </aside>
      </section>

      {/* ═══ STATIONS-MAP-FOOTER ═══════════════════════════════════ */}
      {totalCards <= 12 ? (
        <section
          className="flex items-center gap-3 border-t px-2 py-6 lg:px-4"
          style={{ borderColor: COLORS.dividerStrong }}
        >
          <span
            className="text-[10px] font-bold uppercase tracking-[0.2em]"
            style={{ color: COLORS.inkSubtle }}
          >
            Programme
          </span>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalCards }).map((_, i) => (
              <span
                key={i}
                className="block"
                style={{
                  width: 12,
                  height: 12,
                  background:
                    i + 1 === stationNum
                      ? COLORS.accent
                      : COLORS.dividerStrong,
                }}
              />
            ))}
          </div>
          <span
            className="ml-auto text-[10px] font-bold uppercase tracking-[0.2em]"
            style={{ color: COLORS.accent }}
          >
            Station {stationNumStr}
          </span>
          {card.sourceUrl ? (
            <a
              href={card.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-bold uppercase tracking-[0.2em] transition hover:opacity-80"
              style={{ color: COLORS.ink }}
            >
              Source ↗
            </a>
          ) : null}
        </section>
      ) : null}
    </article>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────

function PaceColumn({
  label,
  value,
  unit,
  accent = false,
  withBorder = false,
}: {
  label: string;
  value: string;
  unit?: string;
  accent?: boolean;
  withBorder?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-2 px-6 py-7 lg:px-10 lg:py-9 ${
        withBorder ? "border-x" : ""
      }`}
      style={{ borderColor: COLORS.divider }}
    >
      <p
        className="text-[10px] font-bold uppercase tracking-[0.2em]"
        style={{ color: COLORS.inkSubtle }}
      >
        {label}
      </p>
      <p
        className="font-bold leading-none tabular-nums tracking-tight"
        style={{
          color: accent ? COLORS.accent : COLORS.ink,
          fontSize: "clamp(28px, 3.5vw, 44px)",
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </p>
      {unit ? (
        <p
          className="text-[10px] font-medium uppercase tracking-[0.18em]"
          style={{ color: COLORS.inkMuted }}
        >
          {unit}
        </p>
      ) : null}
    </div>
  );
}

function SectionLabel({
  children,
  color = COLORS.accent,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <p
      className="text-[10px] font-bold uppercase tracking-[0.22em]"
      style={{ color }}
    >
      {children}
    </p>
  );
}

function VariationBlock({ label, text }: { label: string; text: string }) {
  return (
    <div
      className="border-l-2 px-5 py-4"
      style={{
        background: COLORS.surface,
        borderColor: COLORS.accent,
      }}
    >
      <p
        className="text-[10px] font-bold uppercase tracking-[0.2em]"
        style={{ color: COLORS.accent }}
      >
        {label}
      </p>
      <p
        className="mt-2 text-[13px] leading-relaxed"
        style={{ color: COLORS.ink }}
      >
        {text}
      </p>
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex items-center justify-between border-b py-2.5"
      style={{ borderColor: COLORS.divider }}
    >
      <dt
        className="text-[10px] font-semibold uppercase tracking-[0.18em]"
        style={{ color: COLORS.inkSubtle }}
      >
        {label}
      </dt>
      <dd
        className="text-[12px]"
        style={{ color: COLORS.ink, textAlign: "right", maxWidth: "60%" }}
      >
        {value}
      </dd>
    </div>
  );
}
