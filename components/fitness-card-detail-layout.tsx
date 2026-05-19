import Link from "next/link";
import Image from "next/image";
import type { Brand } from "@/lib/brands";
import type { Pack } from "@/lib/packs";
import type { ExerciseCard, FitnessCard } from "@/lib/fitness/types";
import { isExerciseCard } from "@/lib/fitness/types";
import { SiteHeader } from "./site-header";

// Web-Spiegel des Studio-Performance-PDF-Layouts (lib/pdf/fitness-card-pdf.tsx).
// Statische Server-Komponente — keine Client-Side-Logik fuer jetzt (Editor,
// Hero-Reroll, Delete kommen in Schritt 7).

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
  bg: "#0f0f12",
  surface: "#16161a",
  accent: "#f4a338",
  accentSoft: "#3a2a14",
  ink: "#f5f5f7",
  inkMuted: "#9c9ca5",
  inkSubtle: "#6a6a73",
  warn: "#e87363",
  warnSoft: "#3a1a16",
  divider: "#28282e",
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

      {/* Breadcrumb-Bar — dunkel passend zum Body */}
      <section className="border-b" style={{ borderColor: COLORS.divider }}>
        <div className="mx-auto flex max-w-[1200px] flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-10">
          <nav
            className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]"
            style={{ color: COLORS.inkMuted }}
          >
            <Link
              href={`/${brand.slug}`}
              className="transition-opacity hover:opacity-100"
              style={{ opacity: 0.75 }}
            >
              {brand.name}
            </Link>
            <span style={{ color: COLORS.inkSubtle }}>·</span>
            <Link
              href={`/${brand.slug}/${pack.slug}`}
              className="transition-opacity hover:opacity-100"
              style={{ opacity: 0.75 }}
            >
              {pack.title}
            </Link>
            <span style={{ color: COLORS.inkSubtle }}>·</span>
            <span style={{ color: COLORS.ink, fontWeight: 500 }}>
              {card.title}
            </span>
          </nav>

          <div className="flex items-center gap-2 text-[12px]" style={{ color: COLORS.inkSubtle }}>
            {previous ? (
              <Link
                href={previous.href}
                className="rounded-full border px-3 py-1.5 transition hover:bg-[#1c1c20]"
                style={{ borderColor: COLORS.divider, color: COLORS.inkMuted }}
              >
                ← {previous.title}
              </Link>
            ) : null}
            {next ? (
              <Link
                href={next.href}
                className="rounded-full border px-3 py-1.5 transition hover:bg-[#1c1c20]"
                style={{ borderColor: COLORS.divider, color: COLORS.inkMuted }}
              >
                {next.title} →
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {/* Main: Card-Render */}
      <main className="flex-1">
        <div className="mx-auto max-w-[1200px] px-6 py-8 lg:px-10 lg:py-12">
          <FitnessCardWebRender
            brand={brand}
            pack={pack}
            card={card}
            totalCards={totalCards}
          />
        </div>
      </main>

      {/* Footer */}
      <footer
        className="border-t"
        style={{ borderColor: COLORS.divider, background: COLORS.surface }}
      >
        <div className="mx-auto flex max-w-[1200px] flex-col items-start justify-between gap-3 px-6 py-7 text-[13px] sm:flex-row sm:items-center lg:px-10">
          <p style={{ color: COLORS.inkMuted }}>
            <span style={{ color: COLORS.ink, fontWeight: 500 }}>
              {brand.signature}
            </span>{" "}
            · Pack &quot;{pack.title}&quot; · Trainings-Karte mit Recipe Card Builder
          </p>
          <p className="text-[12px]" style={{ color: COLORS.inkSubtle }}>
            {brand.handle}
          </p>
        </div>
      </footer>
    </div>
  );
}

// ─── Card-Render ────────────────────────────────────────────────────────
// Spiegelt das PDF-Layout, aber als ResponsiveLayout (Mobile = Stack,
// Desktop = Side-by-Side wie PDF).

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
      <div
        className="rounded-lg border p-12 text-center"
        style={{ borderColor: COLORS.divider, color: COLORS.inkMuted }}
      >
        <h2 className="font-display text-[22px]" style={{ color: COLORS.ink }}>
          {card.title}
        </h2>
        <p className="mt-3 text-[14px]">
          Layout fuer Card-Type &quot;{card.type}&quot; folgt in einem spaeteren
          Update.
        </p>
      </div>
    );
  }

  const ex = card as ExerciseCard;
  const bodyParts = ex.bodyParts ?? [];
  const cues = ex.exercise.cues ?? [];
  const mistakes = ex.exercise.commonMistakes ?? [];

  return (
    <article
      className="overflow-hidden rounded-2xl border shadow-2xl"
      style={{
        background: COLORS.bg,
        borderColor: COLORS.divider,
      }}
    >
      {/* Top-Bar */}
      <div
        className="flex items-center justify-between border-b px-6 py-4"
        style={{ borderColor: COLORS.divider }}
      >
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: COLORS.inkMuted }}
        >
          {brand.handle ?? brand.name}
        </span>
        <div className="flex items-center gap-2">
          {bodyParts.slice(0, 3).map((bp) => (
            <span
              key={bp}
              className="rounded-sm px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.15em]"
              style={{
                background: COLORS.accentSoft,
                color: COLORS.accent,
              }}
            >
              {bp}
            </span>
          ))}
          <span
            className="text-[10px] font-bold tracking-[0.15em]"
            style={{ color: COLORS.accent }}
          >
            {(ex.number ?? 1).toString().padStart(2, "0")} /{" "}
            {totalCards.toString().padStart(2, "0")}
          </span>
        </div>
      </div>

      {/* Main Split — Mobile: Stack, Desktop: 2-Spalten */}
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* Content-Spalte */}
        <div className="flex flex-col gap-6 p-8 lg:p-10">
          <div>
            <div
              className="font-display text-[72px] leading-none tracking-tight"
              style={{ color: COLORS.accent }}
            >
              {(ex.number ?? 1).toString().padStart(2, "0")}
            </div>
            <h1
              className="mt-1 text-[32px] font-bold leading-tight tracking-tight lg:text-[36px]"
              style={{ color: COLORS.ink }}
            >
              {ex.title}
            </h1>
            {ex.subtitle ? (
              <p className="mt-2 text-[14px]" style={{ color: COLORS.inkMuted }}>
                {ex.subtitle}
              </p>
            ) : null}
          </div>

          {/* Sets-Block */}
          <div
            className="border-y py-4"
            style={{ borderColor: COLORS.divider }}
          >
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: COLORS.inkSubtle }}
            >
              Sätze × Wiederholungen
            </p>
            <p
              className="mt-1 font-display text-[48px] leading-none tracking-tight"
              style={{ color: COLORS.ink }}
            >
              {ex.exercise.setsReps}
            </p>
            {ex.exercise.load || ex.exercise.distance ? (
              <p
                className="mt-2 text-[14px]"
                style={{ color: COLORS.inkMuted }}
              >
                {[ex.exercise.load, ex.exercise.distance]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
          </div>

          {/* Mini-Stats */}
          {(ex.exercise.rest || ex.exercise.tempo || ex.level) && (
            <div className="grid grid-cols-3 gap-4">
              {ex.exercise.rest ? (
                <MiniStat label="Pause" value={ex.exercise.rest} />
              ) : null}
              {ex.exercise.tempo ? (
                <MiniStat label="Tempo" value={ex.exercise.tempo} />
              ) : null}
              {ex.level ? (
                <MiniStat label="Level" value={ex.level} />
              ) : null}
            </div>
          )}

          {/* Cues */}
          {cues.length > 0 ? (
            <div>
              <p
                className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em]"
                style={{ color: COLORS.accent }}
              >
                Technik
              </p>
              <ol className="flex flex-col gap-2.5">
                {cues.slice(0, 6).map((cue, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span
                      className="shrink-0 text-[12px] font-bold tabular-nums"
                      style={{ color: COLORS.accent, width: 20 }}
                    >
                      {i + 1}.
                    </span>
                    <span
                      className="text-[13px] leading-relaxed"
                      style={{ color: COLORS.ink }}
                    >
                      {cue}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {/* Common Mistakes */}
          {mistakes.length > 0 ? (
            <div
              className="border-l-2 px-4 py-3"
              style={{
                background: COLORS.warnSoft,
                borderColor: COLORS.warn,
              }}
            >
              <p
                className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em]"
                style={{ color: COLORS.warn }}
              >
                Vermeide
              </p>
              {mistakes.slice(0, 3).map((m, i) => (
                <p
                  key={i}
                  className="text-[12px] leading-relaxed"
                  style={{ color: COLORS.ink }}
                >
                  – {m}
                </p>
              ))}
            </div>
          ) : null}

          {/* Variations */}
          {(ex.exercise.beginnerVariation || ex.exercise.advancedVariation) && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {ex.exercise.beginnerVariation ? (
                <VariationBox
                  label="Anfänger"
                  text={ex.exercise.beginnerVariation}
                />
              ) : null}
              {ex.exercise.advancedVariation ? (
                <VariationBox label="Pro" text={ex.exercise.advancedVariation} />
              ) : null}
            </div>
          )}
        </div>

        {/* Hero-Spalte */}
        <div
          className="relative min-h-[400px] md:min-h-[600px]"
          style={{ background: COLORS.surface }}
        >
          {card.hero ? (
            <Image
              src={card.hero}
              alt={card.title}
              fill
              quality={95}
              sizes="(min-width: 768px) 55vw, 100vw"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.2em]"
                style={{ color: COLORS.inkSubtle }}
              >
                {ex.exercise.primaryMuscles ?? "Hero folgt"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between border-t px-6 py-4"
        style={{ borderColor: COLORS.divider }}
      >
        <p style={{ color: COLORS.inkMuted, fontSize: 12 }}>
          <span className="font-display italic" style={{ color: COLORS.ink }}>
            {brand.signature}
          </span>{" "}
          · {pack.title}
        </p>
        {card.sourceUrl ? (
          <a
            href={card.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-semibold uppercase tracking-[0.15em] transition hover:opacity-80"
            style={{ color: COLORS.accent }}
          >
            Original Reel →
          </a>
        ) : null}
      </div>
    </article>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p
        className="text-[9px] font-semibold uppercase tracking-[0.15em]"
        style={{ color: COLORS.inkSubtle }}
      >
        {label}
      </p>
      <p
        className="mt-0.5 text-[14px] font-semibold"
        style={{ color: COLORS.ink }}
      >
        {value}
      </p>
    </div>
  );
}

function VariationBox({ label, text }: { label: string; text: string }) {
  return (
    <div
      className="border-l px-3 py-2.5"
      style={{
        background: COLORS.surface,
        borderColor: COLORS.divider,
      }}
    >
      <p
        className="text-[9px] font-semibold uppercase tracking-[0.15em]"
        style={{ color: COLORS.accent }}
      >
        {label}
      </p>
      <p className="mt-1 text-[12px] leading-relaxed" style={{ color: COLORS.inkMuted }}>
        {text}
      </p>
    </div>
  );
}
