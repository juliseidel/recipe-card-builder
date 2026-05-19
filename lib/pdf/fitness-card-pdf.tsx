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

// Studio-Performance-Layout — der erste Fitness-Card-Stil. Dunkel,
// Performance-fokussiert. Passt fuer Bodybuilding (Marvin, Johny),
// Hyrox/Functional (Simon), Krafttraining-Female-Coaches (Jessica,
// Laetitia). Aendert sich spaeter pro Sub-Niche (pilates-soft fuer
// Alina, abnehm-guide fuer Tim, etc.).
//
// Layout:
//   Top-Bar:    Brand-Mark + Card-Nummer + Body-Parts-Pills
//   Main:       Linke Spalte (Content) + Rechte Spalte (Hero)
//   Footer:     Source + QR-Code + Brand-Signature
//
// Pure ExerciseCard fuer Schritt 5. Andere Card-Types (Workout,
// Weekplan, Mindset, Progress, Nutrition-Tip) werden in spaeteren
// Schritten ergaenzt.

const COLORS = {
  // Dunkler Page-Bg (anthracite) — Performance-Aesthetik. Nicht reines
  // Schwarz, weil das im Druck zu hart wirkt und bei OLED-Screens zu
  // viel Kontrast macht.
  bg: "#0f0f12",
  // Card-Surface — minimaler Helligkeitsunterschied zum Bg, gibt nur
  // Tiefe ohne klare Trennung.
  surface: "#16161a",
  // Akzent: warmes Amber. Performance-Tonalitaet. Funktioniert auf dunkel.
  accent: "#f4a338",
  accentSoft: "#3a2a14",
  // Text-Hierarchie
  ink: "#f5f5f7",
  inkMuted: "#9c9ca5",
  inkSubtle: "#6a6a73",
  // Mistakes-Box — gedaempftes Rot, kein knalliges Warning-Red
  warn: "#e87363",
  warnSoft: "#3a1a16",
  // Divider
  divider: "#28282e",
} as const;

const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: COLORS.bg,
    fontFamily: "Inter",
    color: COLORS.ink,
    padding: 0,
  },
  // ─── Top-Bar (Brand + Card-Nr + Body-Part-Pills) ────────────────────
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: PAGE_PADDING,
    paddingTop: PAGE_PADDING - 4,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  brandMark: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSize: 9,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: COLORS.inkMuted,
  },
  topRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardNumber: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSize: 9,
    letterSpacing: 1.5,
    color: COLORS.accent,
  },
  pill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 2,
    backgroundColor: COLORS.accentSoft,
  },
  pillText: {
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 8,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: COLORS.accent,
  },
  // ─── Main: Content + Hero side-by-side ──────────────────────────────
  main: {
    flexDirection: "row",
    flex: 1,
    minHeight: 0,
  },
  contentCol: {
    width: 252,
    paddingTop: 28,
    paddingLeft: PAGE_PADDING,
    paddingRight: 22,
    paddingBottom: 24,
    flexDirection: "column",
    gap: 18,
  },
  heroCol: {
    flex: 1,
    backgroundColor: COLORS.surface,
    overflow: "hidden",
    position: "relative",
  },
  hero: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  heroEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroEmptyText: {
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: COLORS.inkSubtle,
  },
  // ─── Content-Bloecke ────────────────────────────────────────────────
  // Mega-Number oben links — "01" als visueller Anker, Card-Position
  megaNumber: {
    fontFamily: "Fraunces",
    fontWeight: 700,
    fontSize: 64,
    lineHeight: 1,
    color: COLORS.accent,
    letterSpacing: -2,
    marginBottom: -8, // schliesst den Gap zum Titel
  },
  // Titel: Uebungs-Name. Inter Black mit Letter-Spacing fuer Display-Feel
  title: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSize: 26,
    lineHeight: 1.05,
    color: COLORS.ink,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: "Inter",
    fontWeight: 500,
    fontSize: 11,
    lineHeight: 1.3,
    color: COLORS.inkMuted,
    marginTop: 4,
  },
  // Sets x Reps als Display-Number-Block
  setsBlock: {
    flexDirection: "column",
    gap: 4,
    paddingTop: 6,
    paddingBottom: 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  setsLabel: {
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 7,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: COLORS.inkSubtle,
  },
  setsValue: {
    fontFamily: "Fraunces",
    fontWeight: 700,
    fontSize: 36,
    lineHeight: 1,
    color: COLORS.ink,
    letterSpacing: -1,
  },
  setsMeta: {
    fontFamily: "Inter",
    fontWeight: 500,
    fontSize: 10,
    color: COLORS.inkMuted,
    marginTop: 4,
  },
  // Drei-Spalten-Mini-Stats (Pause, Last, Tempo) unter Sets
  miniStatsRow: {
    flexDirection: "row",
    gap: 14,
    marginTop: -6,
  },
  miniStat: {
    flexDirection: "column",
    gap: 2,
  },
  miniStatLabel: {
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 7,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: COLORS.inkSubtle,
  },
  miniStatValue: {
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 11,
    color: COLORS.ink,
  },
  // Cues-Liste — numerierte Schritte
  cuesHeader: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSize: 8,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: COLORS.accent,
    marginBottom: 4,
  },
  cueRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 6,
  },
  cueNumber: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSize: 10,
    color: COLORS.accent,
    width: 16,
  },
  cueText: {
    flex: 1,
    fontFamily: "Inter",
    fontWeight: 400,
    fontSize: 9.5,
    lineHeight: 1.4,
    color: COLORS.ink,
  },
  // Common-Mistakes Box
  mistakesBox: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: COLORS.warnSoft,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.warn,
  },
  mistakesHeader: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSize: 7,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: COLORS.warn,
    marginBottom: 4,
  },
  mistakeText: {
    fontFamily: "Inter",
    fontWeight: 400,
    fontSize: 9,
    lineHeight: 1.35,
    color: COLORS.ink,
    marginBottom: 2,
  },
  // Variation-Tipps am Ende — kleines 2-Spalten-Grid
  variationsRow: {
    flexDirection: "row",
    gap: 10,
  },
  variation: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 7,
    backgroundColor: COLORS.surface,
    borderLeftWidth: 1,
    borderLeftColor: COLORS.divider,
  },
  variationLabel: {
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 7,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: COLORS.accent,
    marginBottom: 3,
  },
  variationText: {
    fontFamily: "Inter",
    fontWeight: 400,
    fontSize: 8.5,
    lineHeight: 1.35,
    color: COLORS.inkMuted,
  },
  // ─── Footer ──────────────────────────────────────────────────────────
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: PAGE_PADDING,
    paddingTop: 14,
    paddingBottom: PAGE_PADDING - 4,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  footerLeft: {
    flexDirection: "column",
    gap: 2,
  },
  footerLine: {
    fontFamily: "Inter",
    fontWeight: 500,
    fontSize: 9,
    color: COLORS.inkMuted,
  },
  footerSig: {
    fontFamily: "Fraunces",
    fontStyle: "italic",
    fontSize: 11,
    color: COLORS.ink,
  },
  qrBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  qrLabel: {
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 7,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: COLORS.inkSubtle,
    textAlign: "right",
  },
  qr: {
    width: 38,
    height: 38,
    backgroundColor: "#ffffff",
    padding: 2,
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
  /** True bei Single-Card-Export → "01 / 10" Anzeige wird ausgeblendet. */
  hideCardIndex?: boolean;
};

export function FitnessCardPdfPage(props: FitnessCardPdfProps) {
  const { brand, pack, card } = props;

  // Schritt 5 deckt nur ExerciseCard ab. Andere Types werden in spaeteren
  // Schritten ergaenzt. Bei unbekanntem Type: minimaler Fallback-Render
  // (Title + Hero) damit das PDF nicht crasht.
  if (!isExerciseCard(card)) {
    return (
      <Page size="A4" style={styles.page}>
        <View style={styles.topBar}>
          <Text style={styles.brandMark}>{brand.handle}</Text>
          <Text style={styles.cardNumber}>{cardIndexLabel(props)}</Text>
        </View>
        <View style={styles.main}>
          <View style={styles.contentCol}>
            <Text style={styles.title}>{card.title}</Text>
            {card.subtitle ? (
              <Text style={styles.subtitle}>{card.subtitle}</Text>
            ) : null}
            <Text style={styles.subtitle}>
              Layout fuer Card-Type &quot;{card.type}&quot; folgt in einem
              spaeteren Schritt.
            </Text>
          </View>
          <View style={styles.heroCol}>
            {props.heroDataUri ? (
              <Image src={props.heroDataUri} style={styles.hero} />
            ) : (
              <View style={styles.heroEmpty}>
                <Text style={styles.heroEmptyText}>Kein Hero</Text>
              </View>
            )}
          </View>
        </View>
        <FooterRow {...props} />
      </Page>
    );
  }

  const ex = card as ExerciseCard;
  const bodyParts = ex.bodyParts ?? [];
  const cues = ex.exercise.cues ?? [];
  const mistakes = ex.exercise.commonMistakes ?? [];

  return (
    <Page size="A4" style={styles.page}>
      {/* ── Top-Bar ───────────────────────────────────────────────── */}
      <View style={styles.topBar}>
        <Text style={styles.brandMark}>{brand.handle ?? brand.name}</Text>
        <View style={styles.topRight}>
          {bodyParts.slice(0, 3).map((bp) => (
            <View key={bp} style={styles.pill}>
              <Text style={styles.pillText}>{bp}</Text>
            </View>
          ))}
          {props.hideCardIndex ? null : (
            <Text style={styles.cardNumber}>{cardIndexLabel(props)}</Text>
          )}
        </View>
      </View>

      {/* ── Main: Content + Hero ──────────────────────────────────── */}
      <View style={styles.main}>
        {/* Content-Spalte */}
        <View style={styles.contentCol}>
          <View>
            <Text style={styles.megaNumber}>
              {(ex.number ?? 1).toString().padStart(2, "0")}
            </Text>
            <Text style={styles.title}>{ex.title}</Text>
            {ex.subtitle ? (
              <Text style={styles.subtitle}>{ex.subtitle}</Text>
            ) : null}
          </View>

          {/* Sets x Reps Hero-Block */}
          <View style={styles.setsBlock}>
            <Text style={styles.setsLabel}>Sätze × Wdh</Text>
            <Text style={styles.setsValue}>{ex.exercise.setsReps}</Text>
            {ex.exercise.load || ex.exercise.distance ? (
              <Text style={styles.setsMeta}>
                {[ex.exercise.load, ex.exercise.distance]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            ) : null}
          </View>

          {/* Mini-Stats: Pause / Tempo / Difficulty */}
          {(ex.exercise.rest || ex.exercise.tempo || ex.level) && (
            <View style={styles.miniStatsRow}>
              {ex.exercise.rest ? (
                <View style={styles.miniStat}>
                  <Text style={styles.miniStatLabel}>Pause</Text>
                  <Text style={styles.miniStatValue}>{ex.exercise.rest}</Text>
                </View>
              ) : null}
              {ex.exercise.tempo ? (
                <View style={styles.miniStat}>
                  <Text style={styles.miniStatLabel}>Tempo</Text>
                  <Text style={styles.miniStatValue}>{ex.exercise.tempo}</Text>
                </View>
              ) : null}
              {ex.level ? (
                <View style={styles.miniStat}>
                  <Text style={styles.miniStatLabel}>Level</Text>
                  <Text style={styles.miniStatValue}>{ex.level}</Text>
                </View>
              ) : null}
            </View>
          )}

          {/* Technik-Cues */}
          {cues.length > 0 ? (
            <View>
              <Text style={styles.cuesHeader}>Technik</Text>
              {cues.slice(0, 6).map((cue, i) => (
                <View key={i} style={styles.cueRow}>
                  <Text style={styles.cueNumber}>{i + 1}.</Text>
                  <Text style={styles.cueText}>{cue}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Common Mistakes */}
          {mistakes.length > 0 ? (
            <View style={styles.mistakesBox}>
              <Text style={styles.mistakesHeader}>Vermeide</Text>
              {mistakes.slice(0, 3).map((m, i) => (
                <Text key={i} style={styles.mistakeText}>
                  – {m}
                </Text>
              ))}
            </View>
          ) : null}

          {/* Variations: Beginner / Advanced */}
          {(ex.exercise.beginnerVariation || ex.exercise.advancedVariation) && (
            <View style={styles.variationsRow}>
              {ex.exercise.beginnerVariation ? (
                <View style={styles.variation}>
                  <Text style={styles.variationLabel}>Anfänger</Text>
                  <Text style={styles.variationText}>
                    {ex.exercise.beginnerVariation}
                  </Text>
                </View>
              ) : null}
              {ex.exercise.advancedVariation ? (
                <View style={styles.variation}>
                  <Text style={styles.variationLabel}>Pro</Text>
                  <Text style={styles.variationText}>
                    {ex.exercise.advancedVariation}
                  </Text>
                </View>
              ) : null}
            </View>
          )}
        </View>

        {/* Hero-Spalte */}
        <View style={styles.heroCol}>
          {props.heroDataUri ? (
            <Image src={props.heroDataUri} style={styles.hero} />
          ) : (
            <View style={styles.heroEmpty}>
              <Text style={styles.heroEmptyText}>
                {ex.exercise.primaryMuscles ?? "Hero folgt"}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <FooterRow {...props} />
    </Page>
  );
}

function FooterRow(props: FitnessCardPdfProps) {
  const { brand, pack, card, qrDataUri } = props;
  return (
    <View style={styles.footer}>
      <View style={styles.footerLeft}>
        <Text style={styles.footerSig}>{brand.signature}</Text>
        <Text style={styles.footerLine}>
          {pack.title} · {card.sourceLabel ?? brand.handle}
        </Text>
      </View>
      {qrDataUri ? (
        <View style={styles.qrBlock}>
          <Text style={styles.qrLabel}>Original{"\n"}Reel</Text>
          <Image src={qrDataUri} style={styles.qr} />
        </View>
      ) : null}
    </View>
  );
}

function cardIndexLabel(props: FitnessCardPdfProps): string {
  const n = (props.card.number ?? 1).toString().padStart(2, "0");
  const t = (props.totalCards ?? 1).toString().padStart(2, "0");
  return `${n} / ${t}`;
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
      producer="Recipe Card Builder · Fitness-Variante"
    >
      <FitnessCardPdfPage {...props} hideCardIndex />
    </Document>
  );
}

// A4 export fuer den render-Layer.
export const FITNESS_PAGE = A4;
