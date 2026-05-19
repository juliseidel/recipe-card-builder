import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import type { Brand } from "@/lib/brands";
import type { Pack } from "@/lib/packs";
import type {
  ExerciseCard,
  FitnessCard,
} from "@/lib/fitness/types";
import { isExerciseCard } from "@/lib/fitness/types";
import { A4, PAGE_PADDING } from "./theme";

// ─── Hyrox Race-Day Programme Layout v1 ─────────────────────────────────
// Premium-Polish. Magazine-Cover-Aesthetic mit:
//   - Hero als full-bleed Top (60% der Seite), Title als Overlay
//   - Mega-Ghost-Number (Outline-Optik via low-alpha solid)
//   - Race-Indicator-Strip oben: 8 Mini-Boxes, aktive Station Amber
//   - Pace-Block: 3 Mono-Number-Columns (Reps · Race-Pace · Pro-Benchmark)
//   - Stations-Map im Footer mit Brand-Signature + QR
//
// Tonalitaet: Cinematic Schwarz, Race-Amber, monospace numbers, tabular
// nums durchgehend. Editorial-Coaching-Manual-Look. Inspired by Hyrox-
// Official-Programs + Premium-Sport-Brand-Editorial (Nike Training Club,
// Tracksmith, Bandit Running).

const COLORS = {
  bg: "#0a0a0d", // tiefer Cinematic-Schwarz
  bgSoft: "#0f0f12", // panel-bg, kaum unterscheidbar — gibt nur Tiefe
  surface: "#16161a",
  surfaceHi: "#1c1c20",
  // Race-Amber bleibt das Signature-Statement. Slightly more saturated
  // for impact.
  accent: "#f4a338",
  accentDim: "#7a5a2a",
  accentGhost: "#3a2914", // 12% Amber on black, for outline-numbers
  // Text-Hierarchie
  ink: "#fafafa",
  inkMuted: "#8c8c95",
  inkSubtle: "#5a5a63",
  inkDim: "#3a3a40",
  // Warning gedaempft, nicht roter Knalleffekt
  warn: "#d49060",
  warnDim: "#3e2a16",
  // Divider sehr subtil
  divider: "#1f1f25",
  dividerStrong: "#2c2c33",
} as const;

const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: COLORS.bg,
    fontFamily: "Inter",
    color: COLORS.ink,
    padding: 0,
  },

  // ─── Hero Section (Top 60%) ───────────────────────────────────────
  heroSection: {
    position: "relative",
    width: "100%",
    height: 500, // ~60% of A4-height (842pt)
    backgroundColor: COLORS.surface,
    overflow: "hidden",
  },
  heroImage: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  // Dunkler Gradient unten — Title liest sauber auf dem Hero-Bild
  heroGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: "100%",
    height: 240,
    backgroundColor: COLORS.bg,
    opacity: 0.55,
  },
  // Vignette oben (subtil) — Race-Strip + Brand-Mark lesen auf hellen Heros
  heroVignetteTop: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: 80,
    backgroundColor: COLORS.bg,
    opacity: 0.4,
  },

  // ─── Race-Indicator-Strip (top of hero) ────────────────────────────
  raceStrip: {
    position: "absolute",
    top: PAGE_PADDING,
    left: PAGE_PADDING,
    right: PAGE_PADDING,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 10,
  },
  brandMark: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSize: 9,
    letterSpacing: 2.5,
    textTransform: "uppercase",
    color: COLORS.ink,
  },
  stationsBar: {
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
  },
  stationBox: {
    width: 14,
    height: 4,
    backgroundColor: COLORS.inkDim,
  },
  stationBoxActive: {
    width: 14,
    height: 4,
    backgroundColor: COLORS.accent,
  },
  stationBoxLabel: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSize: 8,
    letterSpacing: 1.5,
    color: COLORS.accent,
    marginLeft: 6,
  },

  // ─── Title Overlay (bottom of hero) ────────────────────────────────
  titleOverlay: {
    position: "absolute",
    bottom: PAGE_PADDING,
    left: PAGE_PADDING,
    right: PAGE_PADDING,
    zIndex: 10,
  },
  // Mega-Ghost-Number — der visuelle Statement-Move. 200pt Inter Bold,
  // tabular-nums, sehr subtil-akzent (12% alpha effect via solid color).
  ghostNumber: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSize: 220,
    lineHeight: 0.85,
    color: COLORS.accentGhost,
    letterSpacing: -8,
    position: "absolute",
    bottom: -32,
    left: -10,
    zIndex: 0,
  },
  pillRow: {
    flexDirection: "row",
    gap: 5,
    marginBottom: 14,
    zIndex: 2,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: COLORS.ink,
  },
  pillText: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSize: 7,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: COLORS.bg,
  },
  title: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSize: 52,
    lineHeight: 0.95,
    color: COLORS.ink,
    letterSpacing: -1.4,
    zIndex: 2,
  },
  subtitleOverlay: {
    fontFamily: "Inter",
    fontWeight: 500,
    fontSize: 11,
    lineHeight: 1.3,
    color: COLORS.inkMuted,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginTop: 8,
    zIndex: 2,
  },

  // ─── Pace-Block (below hero) ───────────────────────────────────────
  paceBlock: {
    flexDirection: "row",
    paddingHorizontal: PAGE_PADDING,
    paddingTop: 20,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.dividerStrong,
    gap: 0,
  },
  paceColumn: {
    flex: 1,
    flexDirection: "column",
    gap: 6,
    paddingRight: 14,
    borderRightWidth: 1,
    borderRightColor: COLORS.divider,
  },
  paceColumnLast: {
    flex: 1,
    flexDirection: "column",
    gap: 6,
    paddingLeft: 14,
  },
  paceColumnMid: {
    flex: 1,
    flexDirection: "column",
    gap: 6,
    paddingHorizontal: 14,
    borderRightWidth: 1,
    borderRightColor: COLORS.divider,
  },
  paceLabel: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSize: 7,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: COLORS.inkSubtle,
  },
  paceValue: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSize: 28,
    lineHeight: 1,
    color: COLORS.ink,
    letterSpacing: -0.5,
  },
  paceValueAccent: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSize: 28,
    lineHeight: 1,
    color: COLORS.accent,
    letterSpacing: -0.5,
  },
  paceUnit: {
    fontFamily: "Inter",
    fontWeight: 500,
    fontSize: 9,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: COLORS.inkMuted,
  },

  // ─── Content Section ───────────────────────────────────────────────
  content: {
    flex: 1,
    paddingHorizontal: PAGE_PADDING,
    paddingTop: 22,
    paddingBottom: 18,
    flexDirection: "row",
    gap: 24,
  },
  contentLeft: {
    flex: 1.6,
    flexDirection: "column",
    gap: 14,
  },
  contentRight: {
    flex: 1,
    flexDirection: "column",
    gap: 12,
  },

  sectionLabel: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSize: 8,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: COLORS.accent,
    marginBottom: 2,
  },

  // Cues — numerierte Liste
  cueRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 7,
    paddingBottom: 7,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.divider,
  },
  cueRowLast: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 0,
  },
  cueNumber: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSize: 11,
    color: COLORS.accent,
    width: 18,
    letterSpacing: 0,
  },
  cueText: {
    flex: 1,
    fontFamily: "Inter",
    fontWeight: 400,
    fontSize: 10,
    lineHeight: 1.45,
    color: COLORS.ink,
  },

  // Mistakes — sober "WATCH"-strip, kein Rot-Knalleffekt
  mistakesBlock: {
    paddingTop: 12,
    paddingBottom: 4,
  },
  mistakesLabel: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSize: 8,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: COLORS.warn,
    marginBottom: 6,
  },
  mistakeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 5,
  },
  mistakeBullet: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSize: 10,
    color: COLORS.warn,
    width: 10,
  },
  mistakeText: {
    flex: 1,
    fontFamily: "Inter",
    fontWeight: 400,
    fontSize: 9.5,
    lineHeight: 1.4,
    color: COLORS.ink,
  },

  // Variations — clean Spec-Box-Stil
  variationBlock: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.accent,
    marginBottom: 8,
  },
  variationLabel: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSize: 7,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: COLORS.accent,
    marginBottom: 4,
  },
  variationText: {
    fontFamily: "Inter",
    fontWeight: 400,
    fontSize: 9,
    lineHeight: 1.5,
    color: COLORS.ink,
  },

  // Muscle-Tags Spec-Block
  specBlock: {
    paddingTop: 4,
  },
  specRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.divider,
  },
  specRowLabel: {
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 8,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: COLORS.inkSubtle,
  },
  specRowValue: {
    fontFamily: "Inter",
    fontWeight: 500,
    fontSize: 9,
    color: COLORS.ink,
    textAlign: "right",
    maxWidth: "60%",
  },

  // ─── Footer ─────────────────────────────────────────────────────────
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: PAGE_PADDING,
    paddingTop: 14,
    paddingBottom: PAGE_PADDING - 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.dividerStrong,
    gap: 16,
  },
  footerLeft: {
    flexDirection: "column",
    gap: 4,
    flex: 1,
  },
  footerSig: {
    fontFamily: "Fraunces",
    fontStyle: "italic",
    fontSize: 13,
    color: COLORS.ink,
  },
  footerLine: {
    fontFamily: "Inter",
    fontWeight: 500,
    fontSize: 8.5,
    letterSpacing: 0.5,
    color: COLORS.inkMuted,
  },
  // Stations-Map — 8 Mini-Boxes der Hyrox-Stationen, aktuelle Amber
  stationsMap: {
    flexDirection: "row",
    gap: 3,
    alignItems: "center",
  },
  stationsMapLabel: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSize: 7,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: COLORS.inkSubtle,
    marginRight: 6,
  },
  stationMapBox: {
    width: 8,
    height: 8,
    backgroundColor: COLORS.dividerStrong,
  },
  stationMapBoxActive: {
    width: 8,
    height: 8,
    backgroundColor: COLORS.accent,
  },
  qrWrap: {
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 3,
  },
  qrLabel: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSize: 6,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: COLORS.inkSubtle,
  },
  qr: {
    width: 36,
    height: 36,
    backgroundColor: "#ffffff",
    padding: 2,
  },

  // ─── Empty Hero State ───────────────────────────────────────────────
  heroEmpty: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
  },
  heroEmptyMega: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSize: 240,
    lineHeight: 0.85,
    color: COLORS.dividerStrong,
    letterSpacing: -10,
  },
});

// ─── Page Component ────────────────────────────────────────────────────
export type FitnessCardPdfProps = {
  brand: Brand;
  pack: Pack;
  card: FitnessCard;
  totalCards: number;
  heroDataUri: string | null;
  qrDataUri: string | null;
  hideCardIndex?: boolean;
};

export function FitnessCardPdfPage(props: FitnessCardPdfProps) {
  const { brand, pack, card } = props;

  if (!isExerciseCard(card)) {
    // Minimal-Fallback fuer andere Card-Types (Workout/Weekplan/Mindset).
    return (
      <Page size="A4" style={styles.page}>
        <View style={styles.heroSection}>
          {props.heroDataUri ? (
            <>
              <Image src={props.heroDataUri} style={styles.heroImage} />
              <View style={styles.heroGradient} />
            </>
          ) : (
            <View style={styles.heroEmpty}>
              <Text style={styles.heroEmptyMega}>
                {(card.number ?? 1).toString().padStart(2, "0")}
              </Text>
            </View>
          )}
          <View style={styles.raceStrip}>
            <Text style={styles.brandMark}>{brand.handle ?? brand.name}</Text>
          </View>
          <View style={styles.titleOverlay}>
            <Text style={styles.title}>{card.title}</Text>
            {card.subtitle ? (
              <Text style={styles.subtitleOverlay}>{card.subtitle}</Text>
            ) : null}
          </View>
        </View>
        <View style={styles.content}>
          <Text style={styles.sectionLabel}>Layout in Arbeit</Text>
          <Text style={styles.cueText}>
            Card-Type &quot;{card.type}&quot; bekommt sein eigenes Layout in
            einem spaeteren Schritt.
          </Text>
        </View>
        <FooterRow {...props} />
      </Page>
    );
  }

  const ex = card as ExerciseCard;
  const bodyParts = ex.bodyParts ?? [];
  const cues = ex.exercise.cues ?? [];
  const mistakes = ex.exercise.commonMistakes ?? [];
  const stationNum = ex.number ?? 1;
  const stationNumStr = stationNum.toString().padStart(2, "0");

  return (
    <Page size="A4" style={styles.page}>
      {/* ── HERO SECTION ──────────────────────────────────────────── */}
      <View style={styles.heroSection}>
        {props.heroDataUri ? (
          <>
            <Image src={props.heroDataUri} style={styles.heroImage} />
            <View style={styles.heroVignetteTop} />
            <View style={styles.heroGradient} />
          </>
        ) : (
          <View style={styles.heroEmpty}>
            <Text style={styles.heroEmptyMega}>{stationNumStr}</Text>
          </View>
        )}

        {/* Race-Strip oben */}
        <View style={styles.raceStrip}>
          <Text style={styles.brandMark}>{brand.handle ?? brand.name}</Text>
          {stationNum <= 8 ? (
            <View style={styles.stationsBar}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                <View
                  key={s}
                  style={
                    s === stationNum
                      ? styles.stationBoxActive
                      : styles.stationBox
                  }
                />
              ))}
              <Text style={styles.stationBoxLabel}>
                STATION {stationNumStr}
              </Text>
            </View>
          ) : props.hideCardIndex ? null : (
            <Text style={styles.stationBoxLabel}>
              {stationNumStr} / {props.totalCards.toString().padStart(2, "0")}
            </Text>
          )}
        </View>

        {/* Title-Overlay unten */}
        <View style={styles.titleOverlay}>
          <Text style={styles.ghostNumber}>{stationNumStr}</Text>
          {bodyParts.length > 0 ? (
            <View style={styles.pillRow}>
              {bodyParts.slice(0, 3).map((bp) => (
                <View key={bp} style={styles.pill}>
                  <Text style={styles.pillText}>{bp}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <Text style={styles.title}>{ex.title}</Text>
          {ex.subtitle ? (
            <Text style={styles.subtitleOverlay}>{ex.subtitle}</Text>
          ) : null}
        </View>
      </View>

      {/* ── PACE-BLOCK ────────────────────────────────────────────── */}
      <View style={styles.paceBlock}>
        <View style={styles.paceColumn}>
          <Text style={styles.paceLabel}>Volumen</Text>
          <Text style={styles.paceValue}>{ex.exercise.setsReps}</Text>
          {ex.exercise.load ? (
            <Text style={styles.paceUnit}>{ex.exercise.load}</Text>
          ) : null}
        </View>
        <View style={styles.paceColumnMid}>
          <Text style={styles.paceLabel}>Pause</Text>
          <Text style={styles.paceValueAccent}>
            {ex.exercise.rest ?? "—"}
          </Text>
          {ex.exercise.tempo ? (
            <Text style={styles.paceUnit}>{ex.exercise.tempo}</Text>
          ) : null}
        </View>
        <View style={styles.paceColumnLast}>
          <Text style={styles.paceLabel}>Level</Text>
          <Text style={styles.paceValue}>
            {(ex.level ?? "—").toUpperCase()}
          </Text>
          {ex.durationMinutes ? (
            <Text style={styles.paceUnit}>{ex.durationMinutes} min</Text>
          ) : null}
        </View>
      </View>

      {/* ── CONTENT SECTION (2 columns) ──────────────────────────── */}
      <View style={styles.content}>
        {/* Linke Spalte: Cues + Mistakes */}
        <View style={styles.contentLeft}>
          {cues.length > 0 ? (
            <View>
              <Text style={styles.sectionLabel}>Technik</Text>
              {cues.slice(0, 6).map((cue, i) => {
                const isLast =
                  i === Math.min(cues.length, 6) - 1 && mistakes.length === 0;
                return (
                  <View
                    key={i}
                    style={isLast ? styles.cueRowLast : styles.cueRow}
                  >
                    <Text style={styles.cueNumber}>
                      {i.toString().padStart(2, "0")}
                    </Text>
                    <Text style={styles.cueText}>{cue}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}

          {mistakes.length > 0 ? (
            <View style={styles.mistakesBlock}>
              <Text style={styles.mistakesLabel}>Watch Out</Text>
              {mistakes.slice(0, 3).map((m, i) => (
                <View key={i} style={styles.mistakeRow}>
                  <Text style={styles.mistakeBullet}>×</Text>
                  <Text style={styles.mistakeText}>{m}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {/* Rechte Spalte: Variations + Spec */}
        <View style={styles.contentRight}>
          {ex.exercise.beginnerVariation ? (
            <View style={styles.variationBlock}>
              <Text style={styles.variationLabel}>Scaled</Text>
              <Text style={styles.variationText}>
                {ex.exercise.beginnerVariation}
              </Text>
            </View>
          ) : null}
          {ex.exercise.advancedVariation ? (
            <View style={styles.variationBlock}>
              <Text style={styles.variationLabel}>Rx+ / Pro</Text>
              <Text style={styles.variationText}>
                {ex.exercise.advancedVariation}
              </Text>
            </View>
          ) : null}

          {(ex.exercise.primaryMuscles ||
            ex.exercise.secondaryMuscles ||
            ex.exercise.workoutType) && (
            <View style={styles.specBlock}>
              <Text style={styles.sectionLabel}>Spec</Text>
              {ex.exercise.workoutType ? (
                <View style={styles.specRow}>
                  <Text style={styles.specRowLabel}>Type</Text>
                  <Text style={styles.specRowValue}>
                    {ex.exercise.workoutType}
                  </Text>
                </View>
              ) : null}
              {ex.exercise.primaryMuscles ? (
                <View style={styles.specRow}>
                  <Text style={styles.specRowLabel}>Primary</Text>
                  <Text style={styles.specRowValue}>
                    {ex.exercise.primaryMuscles}
                  </Text>
                </View>
              ) : null}
              {ex.exercise.secondaryMuscles ? (
                <View style={styles.specRow}>
                  <Text style={styles.specRowLabel}>Secondary</Text>
                  <Text style={styles.specRowValue}>
                    {ex.exercise.secondaryMuscles}
                  </Text>
                </View>
              ) : null}
            </View>
          )}
        </View>
      </View>

      {/* ── FOOTER ───────────────────────────────────────────────── */}
      <FooterRow {...props} />
    </Page>
  );
}

function FooterRow(props: FitnessCardPdfProps) {
  const { brand, pack, card, qrDataUri, totalCards } = props;
  const stationNum = card.number ?? 1;
  return (
    <View style={styles.footer}>
      <View style={styles.footerLeft}>
        <Text style={styles.footerSig}>{brand.signature}</Text>
        <Text style={styles.footerLine}>
          {pack.title} · {card.sourceLabel ?? brand.handle}
        </Text>
      </View>

      {/* Stations-Map: bei Packs mit <=12 Karten zeigen wir alle als Mini-Map. */}
      {totalCards <= 12 ? (
        <View style={styles.stationsMap}>
          <Text style={styles.stationsMapLabel}>Programme</Text>
          {Array.from({ length: totalCards }).map((_, i) => (
            <View
              key={i}
              style={
                i + 1 === stationNum
                  ? styles.stationMapBoxActive
                  : styles.stationMapBox
              }
            />
          ))}
        </View>
      ) : null}

      {qrDataUri ? (
        <View style={styles.qrWrap}>
          <Text style={styles.qrLabel}>Source</Text>
          <Image src={qrDataUri} style={styles.qr} />
        </View>
      ) : null}
    </View>
  );
}

// ─── Document Wrapper ──────────────────────────────────────────────────
export function FitnessCardPdfDocument(props: FitnessCardPdfProps) {
  return (
    <Document
      title={`${props.card.title} · ${props.pack.title}`}
      author={props.brand.fullName ?? props.brand.name}
      subject={props.card.subtitle ?? props.pack.title}
      keywords={`${props.brand.handle ?? ""},${props.pack.title},${props.card.title}`}
      creator="Recipe Card Builder"
      producer="Recipe Card Builder · Fitness · Race-Day-Programme"
    >
      <FitnessCardPdfPage {...props} hideCardIndex />
    </Document>
  );
}

export const FITNESS_PAGE = A4;
