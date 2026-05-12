import {
  Page,
  View,
  Text,
  Image,
  Svg,
  Defs,
  LinearGradient,
  Stop,
  Rect,
  Circle,
  Path,
} from "@react-pdf/renderer";
import type { Brand } from "@/lib/brands";
import type { Pack, CardLayout } from "@/lib/packs";
import {
  nutritionBasisLabel,
  nutritionBasisLabelShort,
  nutritionBasisInline,
  type Recipe,
} from "@/lib/recipes";
import {
  groupIngredients,
  groupSteps,
  totalTime,
  pad2,
  portionsLabel,
  type IngredientGroup,
} from "./helpers";
import { packTheme, withAlpha, blendWithWhite } from "./theme";
import { BeeIcon } from "./bee-icon";

// ─────────────────────────────────────────────────────────────────────────────
// Public entry — returns a single A4 page rendered in the matching layout.
// EVERY recipe is designed to fit on exactly ONE page (3 to 16+ ingredients).
// ─────────────────────────────────────────────────────────────────────────────
export type RecipeCardPdfProps = {
  brand: Brand;
  pack: Pack;
  recipe: Recipe;
  totalRecipes: number;
  heroDataUri: string | null;
  // Pre-rendered QR code (PNG data URI) pointing to recipe.sourceUrl.
  // Generated in lib/pdf/render.ts — null when the recipe has no source.
  qrDataUri: string | null;
  // Brand avatar (data URI). Patisserie uses it as a circular face anchor
  // in the footer; other layouts ignore it. Optional so layouts that don't
  // need it stay byte-identical to before.
  avatarDataUri?: string | null;
  // Wenn true, wird die "01/07"-Recipe-Index-Anzeige unterdrueckt. Use-Case:
  // Single-Recipe-PDF-Export (renderRecipePdf) und Web-Detail-Page — dort
  // ist der Pack-Index-Kontext nicht hilfreich, sondern verwirrend. Bei der
  // Pack-Komplett-PDF (Cover + Index + N Karten + Outro) bleibt es sichtbar,
  // weil der Reader durch den Pack blaettert.
  hideRecipeIndex?: boolean;
};

export function RecipeCardPdfPage(props: RecipeCardPdfProps) {
  // Per-recipe layout override wins over pack.cardLayout — same rule as
  // the web renderer in components/recipe-card-full.tsx.
  const layout = props.recipe.cardLayout ?? props.pack.cardLayout;
  return LAYOUTS[layout](props);
}

const LAYOUTS: Record<CardLayout, (p: RecipeCardPdfProps) => React.JSX.Element> = {
  editorial: EditorialPage,
  patisserie: PatisseriePage,
  minimal: MinimalPage,
  sport: SportPage,
  dashboard: DashboardPage,
  vital: VitalPage,
  amber: AmberPage,
};

// ═════════════════════════════════════════════════════════════════════════════
// LAYOUT 1: EDITORIAL — Pack 1 (Feierabend, Honey)
// ═════════════════════════════════════════════════════════════════════════════
// Editorial tuning — Cookbook-Spread look, used by Pack 5 (Feierabend-
// Klassiker). Compact pulls in the header & body when long savory
// recipes pile up; spacious gives the cover-spread the editorial breathing
// room and is paired with the Bienes-Story block on shorter recipes.
const EDITORIAL_DENSITY: Record<
  Density,
  {
    headerPadTop: number;
    headerPadBottom: number;
    titleFontSize: number;
    subtitleFontSize: number;
    bodyPadTop: number;
    bodyPadBottom: number;
    ingRowPadV: number;
    ingFontSize: number;
    ingNoteFontSize: number;
    stepMarginBottom: number;
    stepFontSize: number;
    stepNumFontSize: number;
    microsPadTop: number;
    microsPadBottom: number;
  }
> = {
  compact: {
    headerPadTop: 18,
    headerPadBottom: 12,
    titleFontSize: 24,
    subtitleFontSize: 10.5,
    bodyPadTop: 12,
    bodyPadBottom: 9,
    ingRowPadV: 2.5,
    ingFontSize: 9,
    ingNoteFontSize: 6.5,
    stepMarginBottom: 6,
    stepFontSize: 9,
    stepNumFontSize: 16,
    microsPadTop: 9,
    microsPadBottom: 10,
  },
  balanced: {
    headerPadTop: 22,
    headerPadBottom: 16,
    titleFontSize: 28,
    subtitleFontSize: 12,
    bodyPadTop: 16,
    bodyPadBottom: 12,
    ingRowPadV: 3.5,
    ingFontSize: 9.5,
    ingNoteFontSize: 7,
    stepMarginBottom: 8,
    stepFontSize: 9.5,
    stepNumFontSize: 18,
    microsPadTop: 8,
    microsPadBottom: 9,
  },
  spacious: {
    headerPadTop: 28,
    headerPadBottom: 20,
    titleFontSize: 32,
    subtitleFontSize: 13,
    bodyPadTop: 20,
    bodyPadBottom: 16,
    ingRowPadV: 5,
    ingFontSize: 10,
    ingNoteFontSize: 7.5,
    stepMarginBottom: 10,
    stepFontSize: 10,
    stepNumFontSize: 20,
    microsPadTop: 11,
    microsPadBottom: 12,
  },
};

function EditorialPage({
  brand,
  pack,
  recipe,
  totalRecipes,
  heroDataUri,
  qrDataUri,
}: RecipeCardPdfProps) {
  const t = packTheme(pack);
  const grouped = groupIngredients(recipe.ingredients);
  const time = totalTime(recipe);
  const pl = portionsLabel(recipe.servings);
  const density = getDensity(recipe);
  const d = EDITORIAL_DENSITY[density];

  return (
    <Page
      size="A4"
      style={{ backgroundColor: "#ffffff", fontFamily: "Inter", color: t.ink }}
    >
      {/* TOP MARKER BAR — kompakt, only Pack-Info */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: blendWithWhite(t.bg, 0.6),
          borderBottomWidth: 1,
          borderBottomColor: t.divider,
          paddingHorizontal: 32,
          paddingVertical: 8,
        }}
        wrap={false}
      >
        <Text
          style={{
            fontSize: 7.5,
            letterSpacing: 1.6,
            color: t.inkSoft,
            fontWeight: 600,
          }}
        >
          {pack.title.toUpperCase()}
        </Text>
        <Text
          style={{
            fontSize: 7.5,
            letterSpacing: 1.4,
            color: t.inkSoft,
            fontStyle: "italic",
            fontFamily: "Fraunces",
          }}
        >
          {pack.tagline ?? ""}
        </Text>
      </View>

      {/* TITLE SECTION — square photo LEFT, title content RIGHT. Mirrors
          Patisserie/Sport but reversed (photo is on the left side instead
          of the right). Compact 130×130 photo so source quality always
          looks crisp — no aggressive crops or up-scaling. */}
      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: 32,
          paddingTop: d.headerPadTop,
          paddingBottom: d.headerPadBottom,
          gap: 18,
          backgroundColor: t.paper,
          borderBottomWidth: 1,
          borderBottomColor: t.divider,
        }}
        wrap={false}
      >
        <View style={{ width: 130 }}>
          {heroDataUri ? (
            <View
              style={{
                borderRadius: 10,
                overflow: "hidden",
                width: 130,
                height: 130,
              }}
            >
              <Image
                src={heroDataUri}
                style={{ width: 130, height: 130, objectFit: "cover" }}
              />
            </View>
          ) : null}
        </View>

        <View style={{ flex: 1.4, justifyContent: "space-between" }}>
          <View>
            <Text
              style={{
                fontFamily: "Fraunces",
                fontSize: d.titleFontSize,
                lineHeight: 1.02,
                letterSpacing: -0.3,
                color: t.ink,
                textTransform: "uppercase",
              }}
            >
              {recipe.title}
            </Text>
            <Text
              style={{
                fontFamily: "Fraunces",
                fontStyle: "italic",
                fontSize: d.subtitleFontSize,
                color: t.inkSoft,
                lineHeight: 1.3,
                marginTop: 6,
              }}
            >
              {recipe.subtitle}
            </Text>
            <View
              style={{
                flexDirection: "row",
                gap: 8,
                marginTop: 6,
                flexWrap: "wrap",
              }}
            >
              <Text style={{ fontSize: 8.5, color: t.inkSoft }}>
                {time} Min
              </Text>
              <Text style={{ fontSize: 8.5, color: t.inkSoft }}>·</Text>
              <Text style={{ fontSize: 8.5, color: t.inkSoft }}>
                ergibt {recipe.servings} {pl}
              </Text>
              <Text style={{ fontSize: 8.5, color: t.inkSoft }}>·</Text>
              <Text style={{ fontSize: 8.5, color: t.inkSoft }}>
                {recipe.difficulty}
              </Text>
            </View>
          </View>
          {recipe.tags?.length ? (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                marginTop: 8,
                gap: 4,
              }}
            >
              {recipe.tags.slice(0, 5).map((tag) => (
                <Text
                  key={tag}
                  style={{
                    fontSize: 6.5,
                    fontWeight: 600,
                    letterSpacing: 0.8,
                    textTransform: "uppercase",
                    color: t.ink,
                    backgroundColor: t.bg,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 999,
                  }}
                >
                  {tag}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      </View>

      {/* NUTRIENT BANNER — pack-5 signature: Mikros surfaced HERE, right
          after the title, with mini progress bars. No other pack gives
          micros this kind of editorial billing — they're always tucked
          into the footer strip. */}
      <EditorialMicrosBanner recipe={recipe} theme={t} />

      {/* 4-TILE STATS BAR — Portionen · kcal · Eiweiß · Zeit */}
      <View
        style={{
          flexDirection: "row",
          borderBottomWidth: 1,
          borderBottomColor: t.divider,
        }}
        wrap={false}
      >
        <PortionTile
          label="REZEPT ERGIBT"
          value={`${recipe.servings}×`}
          sub={pl}
          theme={t}
          borderRight
          compact
        />
        <PortionTile
          label={nutritionBasisLabel(recipe.nutritionBasis)}
          value={String(recipe.nutrition.kcal)}
          sub={`kcal · ${recipe.nutrition.carbs}g KH · ${recipe.nutrition.fat}g Fett`}
          theme={t}
          highlight
          borderRight
          accentLabel
          compact
        />
        <PortionTile
          label="EIWEISS"
          value={`${recipe.nutrition.protein}g`}
          sub={nutritionBasisInline(recipe.nutritionBasis)}
          theme={t}
          borderRight
          compact
        />
        <PortionTile
          label="GESAMTZEIT"
          value={String(time)}
          sub={`Min · ${recipe.difficulty}`}
          theme={t}
          compact
        />
      </View>

      {/* BIENES STORY — pull-quote with «»-quotes, honey-tinted */}
      {recipe.description ? (
        <View
          style={{
            paddingHorizontal: 32,
            paddingTop: 11,
            paddingBottom: 13,
            backgroundColor: blendWithWhite(t.bg, 0.4),
            borderBottomWidth: 1,
            borderBottomColor: t.divider,
          }}
          wrap={false}
        >
          <Text
            style={{
              fontSize: 7,
              fontWeight: 700,
              letterSpacing: 1.6,
              color: t.accent,
              textTransform: "uppercase",
              marginBottom: 5,
            }}
          >
            {`${brand.name}s Story`}
          </Text>
          <Text
            style={{
              fontFamily: "Fraunces",
              fontStyle: "italic",
              fontSize: 11.5,
              lineHeight: 1.5,
              color: t.ink,
            }}
          >
            «&nbsp;{recipe.description}&nbsp;»
          </Text>
        </View>
      ) : null}

      {/* BODY: Ingredients (group-aware) | Steps */}
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          paddingHorizontal: 32,
          paddingTop: d.bodyPadTop,
          paddingBottom: d.bodyPadBottom,
          gap: 22,
        }}
      >
        <View style={{ width: 220 }}>
          <SectionHeader
            label="MAN NEHME"
            right={`für ${recipe.servings} ${pl}`}
            theme={t}
          />
          <IngredientsList
            grouped={grouped}
            theme={t}
            rowPadV={d.ingRowPadV}
            nameFontSize={d.ingFontSize}
            noteFontSize={d.ingNoteFontSize}
          />
        </View>

        <View style={{ flex: 1 }}>
          <SectionHeader
            label="ZUBEREITUNG"
            right={`${recipe.steps.length} Schritte`}
            theme={t}
          />
          <StepsList
            steps={recipe.steps}
            theme={t}
            stepMarginBottom={d.stepMarginBottom}
            stepFontSize={d.stepFontSize}
            stepNumFontSize={d.stepNumFontSize}
          />
        </View>
      </View>

      <CardFooter
        brand={brand}
        pack={pack}
        recipe={recipe}
        theme={t}
        qrDataUri={qrDataUri}
        hideMicros
      />
    </Page>
  );
}

// Pack-5 nutrient banner — 6-column grid with mini progress bars. Each
// micro shows name, amount, a tiny pack-accent bar and the % daily value.
// Renders in the position usually reserved for a hero strip, making it
// the most visible piece of micronutrient data in the whole document.
function EditorialMicrosBanner({
  recipe,
  theme,
}: {
  recipe: Recipe;
  theme: ReturnType<typeof packTheme>;
}) {
  const micros = recipe.nutrition.micros;
  if (!micros || micros.length === 0) return null;
  const top = [...micros]
    .sort((a, b) => (b.pctDaily ?? 0) - (a.pctDaily ?? 0))
    .slice(0, 6);

  return (
    <View
      style={{
        paddingHorizontal: 32,
        paddingTop: 10,
        paddingBottom: 12,
        backgroundColor: blendWithWhite(theme.bg, 0.55),
        borderBottomWidth: 1,
        borderBottomColor: theme.divider,
      }}
      wrap={false}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 7,
        }}
      >
        <Text
          style={{
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: 1.6,
            color: theme.accent,
            textTransform: "uppercase",
          }}
        >
          Reich an
        </Text>
        <Text
          style={{
            fontSize: 6.5,
            letterSpacing: 1,
            color: theme.inkSoft,
            textTransform: "uppercase",
          }}
        >
          Mikronährstoffe pro Portion · % Tagesbedarf
        </Text>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {top.map((m) => {
          const pct = Math.min(100, Math.max(0, m.pctDaily ?? 0));
          return (
            <View
              key={m.name}
              style={{ flex: 1, justifyContent: "flex-start" }}
            >
              <Text
                style={{ fontSize: 7, fontWeight: 600, color: theme.ink }}
              >
                {m.name}
              </Text>
              <Text
                style={{ fontSize: 6, color: theme.inkSoft, marginTop: 1 }}
              >
                {m.amount}
              </Text>
              <View
                style={{
                  marginTop: 3,
                  height: 3,
                  backgroundColor: withAlpha(theme.ink, 0.1),
                  borderRadius: 999,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    width: `${pct}%`,
                    height: 3,
                    backgroundColor: theme.accent,
                    borderRadius: 999,
                  }}
                />
              </View>
              <Text
                style={{
                  fontSize: 7,
                  fontWeight: 700,
                  color: theme.accent,
                  marginTop: 2,
                }}
              >
                {pct}%
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// LAYOUT 2: PATISSERIE — Pack 1 (Bienes Backwelt, Lavender)
// ═════════════════════════════════════════════════════════════════════════════
// Total redesign: split-page magazine spread with a lavender sidebar (40 %)
// holding identity (title, polaroid, micros, author/QR) and a cream body
// column (60 %) holding the actual cooking instructions.
//
// Why this layout, not the standard "title-top + 2-column-body":
// • The other four packs (sport, minimal, dashboard, editorial) all run
//   horizontal stacks (header → macros → ingredients/steps → footer).
//   Patisserie running the same pattern with just a different colour
//   would not be a "different design" — Ingo's feedback was that the
//   layouts felt interchangeable.
// • A vertical split gives Pack 1 a real identity move: the lavender
//   column stays visually heavy on every recipe page, the cream body
//   stays calm and reading-focused. The micros, which were the legacy
//   bottom banner that looked the same in every pack, now live mid-
//   sidebar as a vertical list — a different shape entirely.
// • The footer is replaced with a sidebar-bottom block that houses
//   Bienes face (avatar in a lavender-rim circle), her signature, and
//   the QR code as a stamp-style framed block — addresses both the
//   "QR sieht billig aus" and the "Bienes-symbol statt face" feedback.
// • Hero stays as a polaroid (-2° tilt) — that part of the original
//   patisserie DNA worked.
//
// Density-aware: long recipes shrink the polaroid + drop the subtitle
// quote; short recipes get a Bienes-Story block in the body column.
function PatisseriePage({
  brand,
  pack,
  recipe,
  totalRecipes,
  heroDataUri,
  qrDataUri,
  avatarDataUri,
  hideRecipeIndex,
}: RecipeCardPdfProps) {
  const t = packTheme(pack);
  const time = totalTime(recipe);
  const stueck = recipe.servings === 1 ? "Stück" : "Stücke";
  const stueckSing = "Stück";
  const density = getDensity(recipe);
  const d = PATISSERIE_DENSITY[density];

  // Sub-group support: ingredients with `group: "Glasur"` etc. become
  // their own sub-section in the MAN NEHME column. Recipes without
  // sub-groups normalise to a single "Hauptgruppe".
  const grouped = groupIngredients(recipe.ingredients);

  // Title-Size dynamisch nach Laenge des Recipe-Titels. Die Sidebar ist
  // nur 186 pt breit (innen), und @react-pdf/renderer macht keinen
  // automatischen Word-Break an Bindestrichen — dadurch wurden Titel wie
  // "Erdbeer-Kuppeltorte" oder "Virale KI-Suesskartoffel-Muffins" am
  // Rand abgeschnitten ("Erdbeer-Kuppeltor", "Virale KI-Suesskartoffe").
  //
  // Loesung in zwei Stufen:
  //   1. softWrapTitle (unten): fuegt einen Zero-Width-Space nach
  //      jedem Bindestrich ein, damit react-pdf an dieser Stelle
  //      sauber umbrechen kann — sichtbar bleibt nur der Bindestrich.
  //   2. Granulare Skala mit feineren Stufen (alle 6 Zeichen statt
  //      6/12/12+) und niedrigerem Minimum, damit selbst lange
  //      Pack-1-Titel auf 2-3 Zeilen passen, ohne dass kurze Titel
  //      proportional zu klein werden.
  const titleLen = recipe.title.length;
  const titleFontSize =
    titleLen <= 14
      ? d.titleFontSize
      : titleLen <= 20
        ? Math.max(d.titleFontSize - 3, 18)
        : titleLen <= 26
          ? Math.max(d.titleFontSize - 6, 16)
          : titleLen <= 32
            ? Math.max(d.titleFontSize - 9, 15)
            : titleLen <= 40
              ? Math.max(d.titleFontSize - 12, 14)
              : Math.max(d.titleFontSize - 14, 13);
  const titleDisplay = softWrapTitle(recipe.title);

  // Mikros-Anzahl an Recipe-Density koppeln. Lange Recipes (16+ Zutaten,
  // 9+ Steps) brauchen die ganze Body-Spalte; entsprechend bekommt die
  // Sidebar weniger vertikalen Platz. 6 Mikros bei compact verhindert
  // dass die Sidebar mehr Hoehe braucht als 842 pt — was sonst zu einer
  // leeren Overflow-Seite fuehrt (passierte z.B. bei Oster-Zupfkuchen).
  const microsLimit =
    density === "compact" ? 5 : density === "balanced" ? 6 : 8;
  const micros = (recipe.nutrition?.micros ?? []).slice(0, microsLimit);

  // Story-Block nur bei wirklich kurzen Recipes — bei mittleren und
  // langen frisst er Body-Hoehe, die wir fuer Zutaten + Steps brauchen.
  const showStoryHere =
    shouldShowStory(recipe) && density === "spacious";

  // Sidebar dimensions — A4 is 595 pt wide. 40 % gives 238 pt for the
  // lavender column, 60 % (357 pt) for the cream body. The body is
  // where the actual cooking instructions live, so it gets the larger
  // share even though the visual weight sits left.
  const SIDEBAR_WIDTH = 238;
  const SIDEBAR_PAD = 26;
  const POLAROID_W = SIDEBAR_WIDTH - SIDEBAR_PAD * 2; // = 186 pt
  const polaroidPaper = "#ffffff"; // crisp white frame against lavender

  return (
    <Page
      size="A4"
      style={{
        backgroundColor: "#ffffff",
        fontFamily: "Inter",
        color: t.ink,
      }}
    >
      {/* wrap={false} verhindert dass eine zu hohe Recipe-Card auf eine
          zweite Seite fliesst — leere Lavender/Cream-Halb-Seite war die
          Folge bei einzelnen Recipes (Pack 1 ging plötzlich auf 16 statt
          15 Seiten). titleFontSize + microsLimit + showStoryHere sind
          Density-aware getuned, sodass die Card auch ohne Auto-Wrap auf
          eine A4 passt. */}
      <View style={{ flex: 1, flexDirection: "row" }} wrap={false}>
        {/* ─── LEFT: LAVENDER SIDEBAR ─────────────────────────────── */}
        <View
          style={{
            width: SIDEBAR_WIDTH,
            backgroundColor: t.bg,
            paddingHorizontal: SIDEBAR_PAD,
            paddingTop: 32,
            paddingBottom: 24,
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <View>
            {/* Pack caption + recipe number */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 14,
              }}
            >
              <Text
                style={{
                  fontSize: 7.5,
                  fontWeight: 600,
                  letterSpacing: 1.8,
                  color: t.inkSoft,
                  textTransform: "uppercase",
                }}
              >
                {pack.title}
              </Text>
              {hideRecipeIndex ? null : (
                <Text
                  style={{
                    fontFamily: "Fraunces",
                    fontSize: 11,
                    color: t.inkSoft,
                    fontStyle: "italic",
                  }}
                >
                  {pad2(recipe.number)} / {pad2(totalRecipes)}
                </Text>
              )}
            </View>

            {/* Recipe title — the visual anchor. Italic Fraunces, large
                but sized down for long titles so they fit on 2-3 lines. */}
            <Text
              style={{
                fontFamily: "Fraunces",
                fontStyle: "italic",
                fontSize: titleFontSize,
                lineHeight: 1.02,
                letterSpacing: -0.5,
                color: t.ink,
              }}
            >
              {titleDisplay}
            </Text>
            <Text
              style={{
                fontFamily: "Fraunces",
                fontStyle: "italic",
                fontSize: 11,
                lineHeight: 1.35,
                color: t.inkSoft,
                marginTop: 8,
              }}
            >
              «&nbsp;{recipe.subtitle}&nbsp;»
            </Text>

            {/* Polaroid — slight tilt, white frame against lavender so
                it reads as a physical photo dropped onto the spread. */}
            {heroDataUri ? (
              <View
                style={{
                  marginTop: 18,
                  marginBottom: 4,
                  alignSelf: "center",
                  width: POLAROID_W,
                  padding: 8,
                  paddingBottom: 18,
                  backgroundColor: polaroidPaper,
                  transform: "rotate(-2deg)",
                  borderRadius: 2,
                }}
              >
                <Image
                  src={heroDataUri}
                  style={{
                    width: POLAROID_W - 16,
                    height: POLAROID_W - 16,
                    objectFit: "cover",
                  }}
                />
              </View>
            ) : null}

            {/* Micronutrients — vertical list. This is the move that
                differentiates Pack 1 from every other pack: micros aren't
                a footer banner, they're a sidebar block with the pack
                accent driving the % bars. Up to 8 entries shown. */}
            {micros.length > 0 ? (
              <View style={{ marginTop: 18 }}>
                <Text
                  style={{
                    fontSize: 7,
                    fontWeight: 700,
                    letterSpacing: 1.6,
                    color: t.accent,
                    textTransform: "uppercase",
                    marginBottom: 8,
                  }}
                >
                  Reich an
                </Text>
                {micros.map((m) => {
                  const pct = Math.min(Math.max(m.pctDaily ?? 0, 0), 100);
                  return (
                    <View
                      key={m.name}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        paddingVertical: 3.5,
                        borderBottomWidth: 0.5,
                        borderBottomColor: blendWithWhite(t.accent, 0.6),
                      }}
                    >
                      <Text
                        style={{
                          flex: 1,
                          fontSize: 9,
                          color: t.ink,
                          fontWeight: 500,
                        }}
                      >
                        {m.name}
                      </Text>
                      <Text
                        style={{
                          fontSize: 8,
                          color: t.inkSoft,
                          fontFamily: "Inter",
                        }}
                      >
                        {m.amount}
                      </Text>
                      {typeof m.pctDaily === "number" ? (
                        <Text
                          style={{
                            fontFamily: "Fraunces",
                            fontStyle: "italic",
                            fontSize: 11,
                            color: t.ink,
                            width: 32,
                            textAlign: "right",
                          }}
                        >
                          {pct}%
                        </Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>

          {/* Author block — Bienes face anchored as the closing visual
              instead of just the bee emoji. Plus a stamp-style QR card
              that doesn't read as a tossed-in barcode the way the old
              footer-strip did. */}
          <View style={{ marginTop: 16 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingTop: 14,
                borderTopWidth: 1,
                borderTopColor: blendWithWhite(t.accent, 0.55),
              }}
            >
              {avatarDataUri ? (
                <View
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    overflow: "hidden",
                    borderWidth: 1.5,
                    borderColor: t.accent,
                  }}
                >
                  {/* 64x64 statt 50x50 — bei Portrait-Avataren (Julia hat
                      Schultern + Gesicht im 320x320 Original) bleibt im
                      groesseren Circle mehr vom Kopf sichtbar. */}
                  <Image
                    src={avatarDataUri}
                    style={{
                      width: 61,
                      height: 61,
                      objectFit: "cover",
                      objectPosition: "center 30%",
                    }}
                  />
                </View>
              ) : null}
              <View style={{ flex: 1 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Fraunces",
                      fontStyle: "italic",
                      fontSize: 14,
                      color: t.ink,
                      lineHeight: 1.05,
                    }}
                  >
                    {brand.signature}
                  </Text>
                  <BeeIcon brandSlug={brand.slug} size={15} />
                </View>
                <Text
                  style={{
                    fontSize: 7.5,
                    fontWeight: 500,
                    letterSpacing: 1.4,
                    color: t.inkSoft,
                    textTransform: "uppercase",
                    marginTop: 2,
                  }}
                >
                  {brand.handle}
                </Text>
              </View>
            </View>

            {qrDataUri ? (
              <View
                style={{
                  marginTop: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  padding: 10,
                  backgroundColor: blendWithWhite(t.accent, 0.78),
                  borderRadius: 5,
                  borderWidth: 0.5,
                  borderColor: blendWithWhite(t.accent, 0.45),
                }}
              >
                <View
                  style={{
                    width: 50,
                    height: 50,
                    padding: 3,
                    backgroundColor: "#ffffff",
                    borderRadius: 3,
                  }}
                >
                  <Image
                    src={qrDataUri}
                    style={{ width: 44, height: 44 }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: "Fraunces",
                      fontStyle: "italic",
                      fontSize: 11,
                      color: t.ink,
                      lineHeight: 1.15,
                    }}
                  >
                    {recipe.sourceLabel ?? "Original-Reel"}
                  </Text>
                  <Text
                    style={{
                      fontSize: 6.5,
                      fontWeight: 700,
                      letterSpacing: 1.4,
                      color: t.inkSoft,
                      textTransform: "uppercase",
                      marginTop: 3,
                    }}
                  >
                    Mit dem Smartphone scannen
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        </View>

        {/* ─── RIGHT: CREAM BODY ───────────────────────────────────── */}
        {/* User-Feedback: justifyContent "center" bei spacious hat dafuer
            gesorgt dass kurze Karten ihren Inhalt MITTIG hatten waehrend
            laengere Karten oben starteten — Layout sah von Karte zu
            Karte unterschiedlich aus. Konsistenz schlaegt Whitespace-
            Optimierung. Alle Karten starten jetzt top-aligned mit
            denselben Abstaenden, egal ob Story dabei oder nicht. Bei
            sehr kurzen Recipes bleibt unten ein bisschen Raum — das ist
            ok, dafuer sind ALLE Karten einheitlich angeordnet. */}
        <View
          style={{
            flex: 1,
            backgroundColor: "#ffffff",
            paddingHorizontal: 32,
            paddingTop: d.bodyPadTop,
            paddingBottom: d.bodyPadBottom,
          }}
        >
          {/* Top stats strip — identity-relevant numbers, on the body
              side because the sidebar already carries the title and
              repeating those values would feel redundant. */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "baseline",
              gap: 14,
              flexWrap: "wrap",
              paddingBottom: 12,
              borderBottomWidth: 0.5,
              borderBottomColor: t.divider,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
              <Text
                style={{
                  fontFamily: "Fraunces",
                  fontStyle: "italic",
                  fontSize: 18,
                  color: t.ink,
                  letterSpacing: -0.4,
                }}
              >
                {time}
              </Text>
              <Text style={{ fontSize: 8, color: t.inkSoft }}>Min</Text>
            </View>
            <Text style={{ fontSize: 9, color: t.inkSoft, opacity: 0.5 }}>·</Text>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
              <Text
                style={{
                  fontFamily: "Fraunces",
                  fontStyle: "italic",
                  fontSize: 18,
                  color: t.ink,
                  letterSpacing: -0.4,
                }}
              >
                {recipe.servings}
              </Text>
              <Text style={{ fontSize: 8, color: t.inkSoft }}>{stueck}</Text>
            </View>
            <Text style={{ fontSize: 9, color: t.inkSoft, opacity: 0.5 }}>·</Text>
            <Text
              style={{
                fontSize: 9,
                color: t.inkSoft,
                fontWeight: 500,
                letterSpacing: 0.4,
                textTransform: "uppercase",
              }}
            >
              {recipe.difficulty}
            </Text>
            <View
              style={{
                marginLeft: "auto",
                flexDirection: "row",
                alignItems: "baseline",
                gap: 4,
              }}
            >
              <Text
                style={{
                  fontFamily: "Fraunces",
                  fontSize: 18,
                  color: t.ink,
                  letterSpacing: -0.4,
                }}
              >
                {recipe.nutrition.kcal}
              </Text>
              <Text style={{ fontSize: 8, color: t.inkSoft }}>
                kcal pro {stueckSing}
              </Text>
            </View>
          </View>

          {/* Macros — three pills directly under the stats strip */}
          <View
            style={{
              flexDirection: "row",
              gap: 8,
              marginTop: 12,
              flexWrap: "wrap",
            }}
          >
            {[
              {
                label: "Eiweiß",
                value: `${recipe.nutrition.protein}g`,
              },
              {
                label: "Kohlenhydrate",
                value: `${recipe.nutrition.carbs}g`,
              },
              { label: "Fett", value: `${recipe.nutrition.fat}g` },
            ].map((m) => (
              <View
                key={m.label}
                style={{
                  flexDirection: "row",
                  alignItems: "baseline",
                  gap: 5,
                  paddingHorizontal: 11,
                  paddingVertical: 5,
                  backgroundColor: blendWithWhite(t.bg, 0.5),
                  borderRadius: 100,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Fraunces",
                    fontStyle: "italic",
                    fontSize: 12,
                    color: t.ink,
                  }}
                >
                  {m.value}
                </Text>
                <Text style={{ fontSize: 8, color: t.inkSoft }}>{m.label}</Text>
              </View>
            ))}
          </View>

          {/* Story-Block — Konstante padding/margin. Konsistenz first. */}
          {showStoryHere ? (
            <View
              style={{
                marginTop: 22,
                paddingTop: 14,
                paddingBottom: 14,
                paddingLeft: 14,
                borderLeftWidth: 2,
                borderLeftColor: t.accent,
              }}
              wrap={false}
            >
              <Text
                style={{
                  fontFamily: "Fraunces",
                  fontStyle: "italic",
                  fontSize: 11.5,
                  lineHeight: 1.5,
                  color: t.ink,
                }}
              >
                {recipe.description}
              </Text>
            </View>
          ) : null}

          {/* MAN NEHME — konstanter, groesserer marginTop fuer Atmung */}
          <View style={{ marginTop: 28 }}>
            <SectionHeader label="Man nehme" theme={t} italic />
            <IngredientsList
              grouped={grouped}
              theme={t}
              rowPadV={d.ingRowPadV}
              nameFontSize={d.ingFontSize}
              noteFontSize={d.ingNoteFontSize}
            />
          </View>

          {/* ZUBEREITUNG — konstanter, groesserer marginTop fuer Atmung */}
          <View style={{ marginTop: 24 }}>
            <SectionHeader label="Zubereitung" theme={t} italic />
            <StepsList
              steps={recipe.steps}
              theme={t}
              stepMarginBottom={d.stepMarginBottom}
              stepFontSize={d.stepFontSize}
              stepNumFontSize={d.stepNumFontSize}
            />
          </View>
        </View>
      </View>
    </Page>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// LAYOUT 3: MINIMAL — Pack 3 (Snacks, Pistachio)
// ═════════════════════════════════════════════════════════════════════════════
// Minimal tuning — Apple-vibe layout. Compact pulls in padding/fonts a touch
// for long snack recipes; spacious adds breathing room and renders a Bienes
// Story block since most snacks are short (≤8 ings) and the steps column
// runs out fast otherwise. Pack 3 has 2 spacious + 3 balanced today.
const MINIMAL_DENSITY: Record<
  Density,
  {
    headPadTop: number;
    headPadBottom: number;
    bigNumberFontSize: number;
    titleFontSize: number;
    subtitleFontSize: number;
    bodyPadTop: number;
    bodyPadBottom: number;
    ingRowPadV: number;
    ingFontSize: number;
    ingNoteFontSize: number;
    stepMarginBottom: number;
    stepFontSize: number;
    stepNumFontSize: number;
    microsPadTop: number;
    microsPadBottom: number;
  }
> = {
  compact: {
    headPadTop: 24,
    headPadBottom: 12,
    bigNumberFontSize: 64,
    titleFontSize: 21,
    subtitleFontSize: 10,
    bodyPadTop: 14,
    bodyPadBottom: 12,
    ingRowPadV: 2.5,
    ingFontSize: 9,
    ingNoteFontSize: 6.5,
    stepMarginBottom: 6,
    stepFontSize: 9,
    stepNumFontSize: 16,
    microsPadTop: 9,
    microsPadBottom: 10,
  },
  balanced: {
    headPadTop: 32,
    headPadBottom: 16,
    bigNumberFontSize: 76,
    titleFontSize: 24,
    subtitleFontSize: 11,
    bodyPadTop: 18,
    bodyPadBottom: 16,
    ingRowPadV: 3.5,
    ingFontSize: 9.5,
    ingNoteFontSize: 7,
    stepMarginBottom: 8,
    stepFontSize: 9.5,
    stepNumFontSize: 18,
    microsPadTop: 8,
    microsPadBottom: 9,
  },
  spacious: {
    headPadTop: 38,
    headPadBottom: 18,
    bigNumberFontSize: 84,
    titleFontSize: 26,
    subtitleFontSize: 12,
    bodyPadTop: 22,
    bodyPadBottom: 18,
    ingRowPadV: 5,
    ingFontSize: 10,
    ingNoteFontSize: 7.5,
    stepMarginBottom: 10,
    stepFontSize: 10,
    stepNumFontSize: 20,
    microsPadTop: 11,
    microsPadBottom: 12,
  },
};

// ─── Cookbook-Cover layout for Pack 3 (Bienes Snacks) ──────────────────────
// Komplett anderer Move als die anderen vier Layouts: Hero-Bild fuellt
// die obere Haelfte als Cookbook-Cover (full-bleed, ~380 pt), Title als
// Mega-Display-Overlay unten links auf dem Bild, Pack-Caption oben
// links, Avatar als runder Stempel rechts. Darunter: Apple-Spec-Strip
// (Mint-Tile mit kcal/Eiweiss/Fett/Zeit/Stueck), Body in 2 Spalten,
// Mikros als horizontale Capsule-Pills. Footer mit Avatar + Signature +
// Mint-getoentem QR-Stempel.
//
// Title-Sicherheit von Anfang an: dynamische Schriftgroesse je Laenge,
// damit "Frozen Coconut & Strawberry Cups" (32 chars) genauso passt wie
// "Marzipankartoffeln" (18 chars). Kein Auto-Page-Break — wrap={false}
// auf den Page-Wrapper plus Density-aware Skala der Body-Spalten.
function MinimalPage({
  brand,
  pack,
  recipe,
  totalRecipes,
  heroDataUri,
  qrDataUri,
  avatarDataUri,
  hideRecipeIndex,
}: RecipeCardPdfProps) {
  const t = packTheme(pack);
  const time = totalTime(recipe);
  const pl = recipe.servings === 1 ? "Portion" : "Stücke";
  const stueckSing = recipe.servings === 1 ? "Portion" : "Stück";
  // Bei vielen Steps (>=6) override auf compact-density. Bei sehr vielen
  // Steps (>=7) zusaetzlich noch enger — sonst ueberlaufen lange Step-Texte
  // den verfuegbaren Body-Slot. Solero-Tiramisu (7 Schritte mit 3-4 Zeilen
  // Anweisungstext) ist der Worst-Case.
  const baseDensity = getDensity(recipe);
  const stepCount = recipe.steps?.length ?? 0;
  const density = stepCount >= 6 ? "compact" : baseDensity;
  const dBase = MINIMAL_DENSITY[density];
  const d =
    stepCount >= 7
      ? {
          ...dBase,
          stepMarginBottom: Math.max(3, dBase.stepMarginBottom - 2),
          stepFontSize: dBase.stepFontSize - 0.5,
        }
      : dBase;
  const grouped = groupIngredients(recipe.ingredients);

  // Hero-Title-Skala: Bold Inter-Tight, weiss auf Hero-Bild. Schmale
  // Zeichen-Zaehler-Steps damit auch zusammengesetzte Substantive
  // ("Frozen Coconut & Strawberry Cups") immer in 2 Zeilen passen.
  const titleLen = recipe.title.length;
  const heroTitleSize =
    titleLen <= 18
      ? 56
      : titleLen <= 24
        ? 46
        : titleLen <= 32
          ? 38
          : titleLen <= 40
            ? 32
            : 26;

  // Hero ist 380 pt hoch — full-bleed, mit dunklem Gradient unten damit
  // die Title-Overlay sicher lesbar bleibt egal wie hell das Hero-Bild
  // gerade ist. Der Gradient ist als zwei gestapelte Views simuliert
  // weil @react-pdf keinen CSS-Gradient unterstuetzt.
  const HERO_HEIGHT = 360;

  // Mikros-Limit density-aware — bei langen Snacks (selten in Pack 3,
  // aber moeglich bei Custom-Packs mit minimal Layout) bekommt der
  // Mikros-Strip weniger Pills.
  const microsLimit =
    density === "compact" ? 5 : density === "balanced" ? 7 : 9;
  const micros = (recipe.nutrition?.micros ?? []).slice(0, microsLimit);

  return (
    <Page
      size="A4"
      style={{ backgroundColor: "#ffffff", fontFamily: "Inter", color: t.ink }}
    >
      <View style={{ flex: 1, flexDirection: "column" }} wrap={false}>
        {/* ─── HERO ──────────────────────────────────────────────────── */}
        <View
          style={{
            position: "relative",
            width: "100%",
            height: HERO_HEIGHT,
            backgroundColor: blendWithWhite(t.bg, 0.7),
          }}
        >
          {heroDataUri ? (
            <Image
              src={heroDataUri}
              style={{
                width: "100%",
                height: HERO_HEIGHT,
                objectFit: "cover",
              }}
            />
          ) : null}

          {/* Zwei-Layer-Gradient fuer maximale Lesbarkeit der weissen
              Texte ohne textShadow (react-pdf unterstuetzt das nicht):
              (1) Top-Gradient — kleiner dunkler Band oben fuer Pack-
                  Caption + Recipe-Number.
              (2) Bottom-Gradient — aggressiverer dunkler Band unten (92 %
                  schwarz) damit Title + Subtitle auf JEDEM Foto klar
                  lesbar sind, egal wie hell oder bunt das Hero-Bild ist. */}
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: HERO_HEIGHT,
            }}
          >
            <Svg
              width="595"
              height={HERO_HEIGHT}
              viewBox={`0 0 595 ${HERO_HEIGHT}`}
            >
              <Defs>
                <LinearGradient
                  id="heroGradTop"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2={HERO_HEIGHT}
                >
                  <Stop offset="0" stopColor="#000" stopOpacity={0.55} />
                  <Stop offset="0.25" stopColor="#000" stopOpacity={0.15} />
                  <Stop offset="0.45" stopColor="#000" stopOpacity={0} />
                </LinearGradient>
                <LinearGradient
                  id="heroGradBottom"
                  x1="0"
                  y1={HERO_HEIGHT}
                  x2="0"
                  y2="0"
                >
                  <Stop offset="0" stopColor="#000" stopOpacity={0.92} />
                  <Stop offset="0.35" stopColor="#000" stopOpacity={0.4} />
                  <Stop offset="0.7" stopColor="#000" stopOpacity={0.05} />
                  <Stop offset="1" stopColor="#000" stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <Rect
                x="0"
                y="0"
                width="595"
                height={HERO_HEIGHT}
                fill="url(#heroGradTop)"
              />
              <Rect
                x="0"
                y="0"
                width="595"
                height={HERO_HEIGHT}
                fill="url(#heroGradBottom)"
              />
            </Svg>
          </View>

          {/* Top strip — Pack-Caption + Recipe-Number in Weiss. Der
              Top-Gradient darunter sorgt fuer Lesbarkeit. */}
          <View
            style={{
              position: "absolute",
              top: 28,
              left: 36,
              right: 36,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontSize: 8.5,
                fontWeight: 700,
                letterSpacing: 2.2,
                color: "#ffffff",
                textTransform: "uppercase",
              }}
            >
              {pack.title}
            </Text>
            {hideRecipeIndex ? null : (
              <Text
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  letterSpacing: 1.4,
                  color: "#ffffff",
                  textTransform: "uppercase",
                }}
              >
                Rezept {pad2(recipe.number)} / {pad2(totalRecipes)}
              </Text>
            )}
          </View>

          {/* Avatar Stempel rechts unten auf dem Hero — Mint-Border, der
              "echte Biene"-Anker. */}
          {avatarDataUri ? (
            <View
              style={{
                position: "absolute",
                bottom: 26,
                right: 36,
                width: 56,
                height: 56,
                borderRadius: 28,
                overflow: "hidden",
                borderWidth: 2.5,
                borderColor: "#ffffff",
              }}
            >
              <Image
                src={avatarDataUri}
                style={{ width: 51, height: 51, objectFit: "cover", objectPosition: "center 25%" }}
              />
            </View>
          ) : null}

          {/* Title overlay unten links — Weiss auf aggressivem Bottom-
              Gradient. Bei einem 92 %-schwarzen Untergrund garantiert
              lesbar, egal welches Foto. */}
          <View
            style={{
              position: "absolute",
              left: 36,
              right: 110,
              bottom: 32,
            }}
          >
            <Text
              style={{
                fontFamily: "Inter",
                fontSize: heroTitleSize,
                fontWeight: 700,
                letterSpacing: -0.6,
                lineHeight: 1.02,
                color: "#ffffff",
                textTransform: "none",
              }}
            >
              {recipe.title}
            </Text>
            <Text
              style={{
                fontFamily: "Fraunces",
                fontStyle: "italic",
                fontSize: 12,
                color: "#ffffff",
                opacity: 0.95,
                marginTop: 6,
                lineHeight: 1.35,
              }}
            >
              {recipe.subtitle}
            </Text>
          </View>
        </View>

        {/* ─── SPEC STRIP ────────────────────────────────────────────── */}
        <View
          style={{
            flexDirection: "row",
            backgroundColor: t.bg,
            paddingVertical: 12,
            paddingHorizontal: 36,
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          {[
            { value: String(recipe.nutrition.kcal), label: `kcal pro ${stueckSing}` },
            { value: `${recipe.nutrition.protein}g`, label: "Eiweiß" },
            { value: `${recipe.nutrition.carbs}g`, label: "Kohlenhydrate" },
            { value: `${recipe.nutrition.fat}g`, label: "Fett" },
            { value: `${time}`, label: "Min total" },
            { value: String(recipe.servings), label: pl },
          ].map((s, i) => (
            <View
              key={i}
              style={{ flexDirection: "column", alignItems: "center", gap: 1 }}
            >
              <Text
                style={{
                  fontFamily: "Inter",
                  fontSize: 18,
                  fontWeight: 700,
                  color: t.ink,
                  letterSpacing: -0.4,
                }}
              >
                {s.value}
              </Text>
              <Text
                style={{
                  fontSize: 7,
                  fontWeight: 600,
                  letterSpacing: 1.2,
                  color: t.inkSoft,
                  textTransform: "uppercase",
                }}
              >
                {s.label}
              </Text>
            </View>
          ))}
        </View>

        {/* ─── BODY: 2 Spalten ───────────────────────────────────────── */}
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            gap: 24,
            paddingHorizontal: 36,
            paddingTop: 18,
            paddingBottom: 14,
          }}
        >
          {/* MAN NEHME — 230 pt fuer komfortablen Platz fuer lange
              Zutaten-Namen ("MORE Chunky Vanilla Perfection") plus
              italic Notes ("oder Obst nach Wahl") ohne dass der Text
              an der Spalten-Grenze umbricht und kollabiert. */}
          <View style={{ width: 230 }}>
            <Text
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 2,
                color: t.accent,
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              Man nehme
            </Text>
            <View
              style={{
                width: 24,
                height: 2,
                backgroundColor: t.accent,
                marginBottom: 10,
              }}
            />
            <IngredientsList
              grouped={grouped}
              theme={t}
              rowPadV={d.ingRowPadV}
              nameFontSize={d.ingFontSize}
              noteFontSize={d.ingNoteFontSize}
            />
          </View>

          {/* ZUBEREITUNG */}
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 2,
                color: t.accent,
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              Zubereitung
            </Text>
            <View
              style={{
                width: 24,
                height: 2,
                backgroundColor: t.accent,
                marginBottom: 10,
              }}
            />
            <StepsList
              steps={recipe.steps}
              theme={t}
              stepMarginBottom={d.stepMarginBottom}
              stepFontSize={d.stepFontSize}
              stepNumFontSize={d.stepNumFontSize}
            />
          </View>
        </View>

        {/* ─── MIKROS-STRIP als Capsule-Pills ────────────────────────── */}
        {micros.length > 0 ? (
          <View
            style={{
              paddingHorizontal: 36,
              paddingTop: 12,
              paddingBottom: 14,
              backgroundColor: blendWithWhite(t.bg, 0.55),
              borderTopWidth: 1,
              borderTopColor: blendWithWhite(t.accent, 0.5),
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 7,
              }}
            >
              <Text
                style={{
                  fontSize: 8,
                  fontWeight: 700,
                  letterSpacing: 1.8,
                  color: t.accent,
                  textTransform: "uppercase",
                }}
              >
                Reich an
              </Text>
              <Text
                style={{
                  fontSize: 7,
                  fontWeight: 600,
                  letterSpacing: 1.2,
                  color: t.inkSoft,
                  textTransform: "uppercase",
                }}
              >
                Mikronährstoffe {nutritionBasisInline(recipe.nutritionBasis)} · % Tagesbedarf
              </Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 5,
              }}
            >
              {micros.map((m) => (
                <View
                  key={m.name}
                  style={{
                    flexDirection: "row",
                    alignItems: "baseline",
                    gap: 4,
                    paddingHorizontal: 9,
                    paddingVertical: 4,
                    backgroundColor: "#ffffff",
                    borderRadius: 100,
                    borderWidth: 0.5,
                    borderColor: blendWithWhite(t.accent, 0.6),
                  }}
                >
                  <Text
                    style={{
                      fontSize: 8,
                      fontWeight: 600,
                      color: t.ink,
                    }}
                  >
                    {m.name}
                  </Text>
                  <Text style={{ fontSize: 7.5, color: t.inkSoft }}>
                    {m.amount}
                  </Text>
                  {typeof m.pctDaily === "number" ? (
                    <Text
                      style={{
                        fontFamily: "Inter",
                        fontSize: 8,
                        fontWeight: 700,
                        color: t.accent,
                      }}
                    >
                      {Math.min(Math.max(m.pctDaily, 0), 100)}%
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* ─── FOOTER mit Avatar + Signatur + QR-Stempel ─────────────── */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 36,
            paddingVertical: 12,
            borderTopWidth: 1,
            borderTopColor: t.divider,
            backgroundColor: "#ffffff",
            gap: 16,
          }}
        >
          {/* Linker Footer-Block: Avatar + Handle-+-Pack-Caption.
              brand.signature ("Deine Julia") + BeeIcon entfernt — kam
              an zu vielen Stellen vor (User-Feedback). Text rechts neben
              dem Avatar ist jetzt vertikal mittig (alignItems "center"),
              sodass das Layout sauber ausbalanciert wirkt. */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            {avatarDataUri ? (
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  overflow: "hidden",
                  borderWidth: 1.2,
                  borderColor: t.accent,
                }}
              >
                <Image
                  src={avatarDataUri}
                  style={{ width: 30, height: 30, objectFit: "cover", objectPosition: "center 25%" }}
                />
              </View>
            ) : null}
            <Text
              style={{
                fontSize: 8.5,
                fontWeight: 600,
                letterSpacing: 1.6,
                color: t.inkSoft,
                textTransform: "uppercase",
              }}
            >
              {brand.handle} · {pack.title}
            </Text>
          </View>

          {qrDataUri ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingHorizontal: 10,
                paddingVertical: 7,
                backgroundColor: blendWithWhite(t.accent, 0.78),
                borderRadius: 5,
                borderWidth: 0.5,
                borderColor: blendWithWhite(t.accent, 0.45),
              }}
            >
              <View
                style={{
                  alignItems: "flex-end",
                  maxWidth: 84,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Fraunces",
                    fontStyle: "italic",
                    fontSize: 10,
                    color: t.ink,
                    lineHeight: 1.15,
                    textAlign: "right",
                  }}
                >
                  {recipe.sourceLabel ?? "Original-Reel"}
                </Text>
                <Text
                  style={{
                    fontSize: 6,
                    fontWeight: 700,
                    letterSpacing: 1.4,
                    color: t.inkSoft,
                    textTransform: "uppercase",
                    marginTop: 2,
                  }}
                >
                  Smartphone scannen
                </Text>
              </View>
              <View
                style={{
                  width: 36,
                  height: 36,
                  padding: 2,
                  backgroundColor: "#ffffff",
                  borderRadius: 3,
                }}
              >
                <Image
                  src={qrDataUri}
                  style={{ width: 32, height: 32 }}
                />
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </Page>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// LAYOUT 4: SPORT (Volumen-Editorial) — Pack 2 (Volumen-Wunder, Sage Green)
//
// Mirrors components/recipe-card-full.tsx#SportLayout. The web uses emoji
// glyphs in stat tiles + macro bars, but the bundled @react-pdf fonts
// (Inter/Fraunces) don't carry an emoji table — they'd render as tofu. So
// the PDF version replaces emojis with a tinted accent dot beside each row,
// keeping the same hierarchy and visual rhythm.
//
// SPORT_DENSITY adapts paddings + font sizes to ingredient count so a
// 16-ingredient Mexican Bowl fits one A4 page just like a 3-ingredient Eis-
// Bowl does — direct fix for the brief's "Beide Extreme müssen gut funktio-
// nieren" requirement. Subtle adjustments only — the layout structure is
// identical across modes, just slightly tighter or looser typography.
// ═════════════════════════════════════════════════════════════════════════════
// Generic density classifier — used by every layout that opts in (Sport &
// Patisserie today; remaining layouts can adopt it incrementally). Each
// layout owns its own DENSITY-tuning table so the visual character stays
// pack-specific. New custom recipes pick up the right mode automatically
// based on ingredient count — no manual configuration needed.
export type Density = "compact" | "balanced" | "spacious";

// react-pdf bricht Text nur an Whitespace, nicht an Bindestrichen. Lange
// zusammengesetzte Substantive ("Erdbeer-Kuppeltorte", "Süßkartoffel-
// Muffins", "Cheeseburger-Auflauf") werden dadurch in der schmalen
// Patisserie-Sidebar (186 pt innen) am Rand abgeschnitten — der User
// sieht "Erdbeer-Kuppeltor..." statt "Erdbeer-\nKuppeltorte".
//
// Trick: nach jedem Bindestrich einen Zero-Width-Space (​). Der ist
// visuell unsichtbar, react-pdf erkennt ihn aber als optionale Bruch-
// stelle. Wenn das Wort zu breit ist, bricht die Engine sauber nach dem
// Bindestrich um, sonst verhält es sich wie ein normales Wort.
//
// Wir lassen Bindestriche, die am Wortrand stehen ("- Spekulatius") in
// Ruhe — die haben sowieso schon ein Whitespace-Anker. Nur Inline-
// Bindestriche zwischen zwei Buchstaben bekommen den Zero-Width-Space.
export function softWrapTitle(title: string): string {
  return title.replace(/(\p{L})-(\p{L})/gu, "$1-​$2");
}

// Score weighs steps slightly higher than ingredients because each step is
// usually 2–3 lines of body copy, while an ingredient is 1–2 short lines.
// A recipe with 8 ingredients but only 4 steps (e.g. KI-Süßkartoffel-Muffins)
// ends up sparse-feeling on A4 — the steps column runs out fast and leaves
// half the page white. Score-based classification catches that.
export function getDensity(recipe: Recipe): Density {
  const score = recipe.ingredients.length + recipe.steps.length * 1.5;
  if (score >= 22) return "compact";
  if (score <= 14) return "spacious";
  return "balanced";
}

// Whether to render the editorial "Bienes Story" pull-quote. Decoupled from
// density on purpose: the story block fixes the *ingredient column* looking
// thin (visually short left side), regardless of whether the steps column
// happens to fill the page. So it triggers on ingredient count alone, with
// a generous threshold — anything with 10 or fewer ingredients gets the
// story treatment so no card ever looks halbleer.
export function shouldShowStory(recipe: Recipe): boolean {
  return (
    recipe.ingredients.length <= 10 && Boolean(recipe.description?.trim())
  );
}

const SPORT_DENSITY: Record<
  Density,
  {
    heroPadTop: number;
    heroPadBottom: number;
    statsPadV: number;
    macrosPadTop: number;
    macrosPadBottom: number;
    macrosBarMargin: number;
    bodyPadTop: number;
    bodyPadBottom: number;
    ingRowPadV: number;
    ingFontSize: number;
    ingNoteFontSize: number;
    stepMarginBottom: number;
    stepFontSize: number;
    titleFontSize: number;
  }
> = {
  compact: {
    heroPadTop: 16,
    heroPadBottom: 10,
    statsPadV: 9,
    macrosPadTop: 7,
    macrosPadBottom: 8,
    macrosBarMargin: 2.5,
    bodyPadTop: 8,
    bodyPadBottom: 6,
    ingRowPadV: 2,
    ingFontSize: 8.5,
    ingNoteFontSize: 6,
    stepMarginBottom: 3,
    stepFontSize: 8.5,
    titleFontSize: 22,
  },
  balanced: {
    heroPadTop: 24,
    heroPadBottom: 16,
    statsPadV: 14,
    macrosPadTop: 11,
    macrosPadBottom: 13,
    macrosBarMargin: 4,
    bodyPadTop: 14,
    bodyPadBottom: 12,
    ingRowPadV: 3.5,
    ingFontSize: 9.5,
    ingNoteFontSize: 7,
    stepMarginBottom: 5,
    stepFontSize: 9.5,
    titleFontSize: 30,
  },
  spacious: {
    heroPadTop: 28,
    heroPadBottom: 18,
    statsPadV: 16,
    macrosPadTop: 12,
    macrosPadBottom: 14,
    macrosBarMargin: 5,
    bodyPadTop: 16,
    bodyPadBottom: 14,
    ingRowPadV: 5.5,
    ingFontSize: 10,
    ingNoteFontSize: 7.5,
    stepMarginBottom: 7,
    stepFontSize: 10,
    titleFontSize: 32,
  },
};

// Patisserie tuning — calibrated more conservatively than Sport because the
// Backwelt layout is simpler (no macro bars, no stat tiles, no story block).
// Compact mode is mainly there to give the micros band breathing room on
// the long bake recipes (Schoko-Biskuitrolle, Oster-Zupfkuchen) without
// changing the typography character.
const PATISSERIE_DENSITY: Record<
  Density,
  {
    headPadTop: number;
    headPadBottom: number;
    titleFontSize: number;
    subtitleFontSize: number;
    bodyPadTop: number;
    bodyPadBottom: number;
    ingRowPadV: number;
    ingFontSize: number;
    ingNoteFontSize: number;
    stepMarginBottom: number;
    stepFontSize: number;
    stepNumFontSize: number;
    microsPadTop: number;
    microsPadBottom: number;
  }
> = {
  // v4 (User-Feedback): kurze Karten sahen "halbleer" aus weil Content
  // nur ~50% der A4-Hoehe fuellte. Spacious bekommt deutlich mehr Air
  // pro Ingredient-Row und pro Step (ingRowPadV 5→9, stepMarginBottom
  // 11→20) — dadurch fuellt das Content die Karte natuerlich ohne
  // dass wir vertikales Zentrieren brauchen (das hatte die Konsistenz
  // gebrochen). Step-Number-Sizes auf max 18 reduziert, damit die "1"
  // visuell weniger gegenueber dem Step-Text "fett oben" wirkt.
  compact: {
    headPadTop: 22,
    headPadBottom: 12,
    titleFontSize: 30,
    subtitleFontSize: 12,
    bodyPadTop: 30,
    bodyPadBottom: 28,
    ingRowPadV: 3,
    ingFontSize: 9,
    ingNoteFontSize: 6.5,
    stepMarginBottom: 8,
    stepFontSize: 9,
    stepNumFontSize: 14,
    microsPadTop: 9,
    microsPadBottom: 10,
  },
  balanced: {
    headPadTop: 28,
    headPadBottom: 16,
    titleFontSize: 36,
    subtitleFontSize: 14,
    bodyPadTop: 34,
    bodyPadBottom: 32,
    ingRowPadV: 5,
    ingFontSize: 9.5,
    ingNoteFontSize: 7,
    stepMarginBottom: 12,
    stepFontSize: 9.5,
    stepNumFontSize: 16,
    microsPadTop: 8,
    microsPadBottom: 9,
  },
  spacious: {
    headPadTop: 34,
    headPadBottom: 20,
    titleFontSize: 40,
    subtitleFontSize: 15,
    bodyPadTop: 38,
    bodyPadBottom: 36,
    ingRowPadV: 9,
    ingFontSize: 10,
    ingNoteFontSize: 7.5,
    stepMarginBottom: 20,
    stepFontSize: 10,
    stepNumFontSize: 18,
    microsPadTop: 11,
    microsPadBottom: 12,
  },
};

function SportPage({
  brand,
  pack,
  recipe,
  totalRecipes,
  heroDataUri,
  qrDataUri,
}: RecipeCardPdfProps) {
  const t = packTheme(pack);
  const time = totalTime(recipe);
  const portionsLabel = recipe.servings === 1 ? "Portion" : "Portionen";
  const density = getDensity(recipe);
  const d = SPORT_DENSITY[density];

  const macroBars = [
    { label: "Eiweiß", value: recipe.nutrition.protein, max: 50, unit: "g" },
    { label: "Kohlenhydrate", value: recipe.nutrition.carbs, max: 80, unit: "g" },
    { label: "Fett", value: recipe.nutrition.fat, max: 35, unit: "g" },
  ];

  return (
    <Page
      size="A4"
      style={{ backgroundColor: "#ffffff", fontFamily: "Inter", color: t.ink }}
    >
      {/* HERO — title left (italic Fraunces), square photo right, no overlay */}
      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: 32,
          paddingTop: d.heroPadTop,
          paddingBottom: d.heroPadBottom,
          gap: 18,
          backgroundColor: blendWithWhite(t.bg, 0.7),
          borderBottomWidth: 1,
          borderBottomColor: t.divider,
        }}
        wrap={false}
      >
        <View style={{ flex: 1.4 }}>
          <Text
            style={{
              fontSize: 7.5,
              letterSpacing: 1.6,
              fontWeight: 600,
              color: t.inkSoft,
            }}
          >
            {pack.title.toUpperCase()}
          </Text>
          <Text
            style={{
              fontFamily: "Fraunces",
              fontStyle: "italic",
              fontSize: d.titleFontSize,
              lineHeight: 1.02,
              letterSpacing: -0.3,
              color: t.ink,
              marginTop: 10,
            }}
          >
            {recipe.title}
          </Text>
          <Text
            style={{
              fontFamily: "Fraunces",
              fontStyle: "italic",
              fontSize: 12,
              lineHeight: 1.3,
              color: t.inkSoft,
              marginTop: 6,
            }}
          >
            «&nbsp;{recipe.subtitle}&nbsp;»
          </Text>
          <View
            style={{
              flexDirection: "row",
              gap: 8,
              marginTop: 8,
              flexWrap: "wrap",
            }}
          >
            <Text style={{ fontSize: 8.5, color: t.inkSoft }}>{time} Min</Text>
            <Text style={{ fontSize: 8.5, color: t.inkSoft }}>·</Text>
            <Text style={{ fontSize: 8.5, color: t.inkSoft }}>
              {recipe.difficulty}
            </Text>
            <Text style={{ fontSize: 8.5, color: t.inkSoft }}>·</Text>
            <Text style={{ fontSize: 8.5, color: t.inkSoft }}>
              ergibt {recipe.servings} {portionsLabel}
            </Text>
          </View>
        </View>

        <View style={{ width: 130 }}>
          {heroDataUri ? (
            <View
              style={{
                borderRadius: 8,
                overflow: "hidden",
                width: 130,
                height: 130,
              }}
            >
              <Image
                src={heroDataUri}
                style={{ width: 130, height: 130, objectFit: "cover" }}
              />
            </View>
          ) : null}
        </View>
      </View>

      {/* BIENES STORY (sparse only) — fills the gap short recipes leave */}
      {shouldShowStory(recipe) ? (
        <View
          style={{
            paddingHorizontal: 32,
            paddingTop: 10,
            paddingBottom: 12,
            backgroundColor: blendWithWhite(t.bg, 0.85),
            borderBottomWidth: 1,
            borderBottomColor: t.divider,
          }}
          wrap={false}
        >
          <Text
            style={{
              fontSize: 7,
              fontWeight: 700,
              letterSpacing: 1.6,
              color: t.accent,
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            {`${brand.name}s Story`}
          </Text>
          <Text
            style={{
              fontFamily: "Fraunces",
              fontStyle: "italic",
              fontSize: 10.5,
              lineHeight: 1.5,
              color: t.ink,
            }}
          >
            {recipe.description}
          </Text>
        </View>
      ) : null}

      {/* VOLUMEN-STATS — 3 prominent tiles with accent dots (emojis on web) */}
      <View
        style={{
          flexDirection: "row",
          borderBottomWidth: 1,
          borderBottomColor: t.divider,
        }}
        wrap={false}
      >
        <VolumenStatTile
          dotColor={t.accent}
          value={`${recipe.servings}×`}
          label={portionsLabel}
          theme={t}
          borderRight
          padV={d.statsPadV}
        />
        <VolumenStatTile
          dotColor={t.accent}
          value={String(recipe.nutrition.kcal)}
          label={`kcal ${nutritionBasisInline(recipe.nutritionBasis)}`}
          theme={t}
          borderRight
          highlight
          padV={d.statsPadV}
        />
        <VolumenStatTile
          dotColor={t.accent}
          value={`${recipe.nutrition.protein}g`}
          label={`Eiweiß ${nutritionBasisInline(recipe.nutritionBasis)}`}
          theme={t}
          padV={d.statsPadV}
        />
      </View>

      {/* MACRO BARS — visual protein-density */}
      <View
        style={{
          paddingHorizontal: 32,
          paddingTop: d.macrosPadTop,
          paddingBottom: d.macrosPadBottom,
          borderBottomWidth: 1,
          borderBottomColor: t.divider,
        }}
        wrap={false}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 6,
          }}
        >
          <Text
            style={{
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: 1.6,
              color: t.accent,
              textTransform: "uppercase",
            }}
          >
            Makros
          </Text>
          <Text
            style={{
              fontSize: 6.5,
              letterSpacing: 1,
              color: t.inkSoft,
              textTransform: "uppercase",
            }}
          >
            {nutritionBasisInline(recipe.nutritionBasis)} · von 50 / 80 / 35 g Skala
          </Text>
        </View>
        {macroBars.map((m) => (
          <View
            key={m.label}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginTop: d.macrosBarMargin,
            }}
          >
            <Text
              style={{
                fontSize: 7.5,
                fontWeight: 600,
                letterSpacing: 1.2,
                color: t.inkSoft,
                textTransform: "uppercase",
                width: 90,
              }}
            >
              {m.label}
            </Text>
            <View
              style={{
                flex: 1,
                height: 5,
                borderRadius: 999,
                backgroundColor: withAlpha(t.ink, 0.08),
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width: `${Math.min((m.value / m.max) * 100, 100)}%`,
                  height: 5,
                  backgroundColor: t.accent,
                  borderRadius: 999,
                }}
              />
            </View>
            <Text
              style={{
                fontFamily: "Fraunces",
                fontSize: 13,
                color: t.ink,
                width: 36,
                textAlign: "right",
              }}
            >
              {m.value}
              {m.unit}
            </Text>
          </View>
        ))}
      </View>

      {/* BODY — Zutaten-Cart (☐) + Schritt-Timeline */}
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          gap: 22,
          paddingHorizontal: 32,
          paddingTop: d.bodyPadTop,
          paddingBottom: d.bodyPadBottom,
        }}
      >
        {/* Zutaten-Cart with checkboxes */}
        <View style={{ width: 220 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-end",
              justifyContent: "space-between",
              borderBottomWidth: 1,
              borderBottomColor: withAlpha(t.ink, 0.15),
              paddingBottom: 3,
            }}
          >
            <Text
              style={{
                fontSize: 8.5,
                fontWeight: 700,
                letterSpacing: 1.6,
                color: t.accent,
                textTransform: "uppercase",
              }}
            >
              Zutaten-Cart
            </Text>
            <Text
              style={{
                fontSize: 6.5,
                fontWeight: 500,
                letterSpacing: 1,
                color: t.inkSoft,
                textTransform: "uppercase",
              }}
            >
              {recipe.ingredients.length} Items
            </Text>
          </View>
          <View style={{ marginTop: 8 }}>
            {recipe.ingredients.map((ing, i) => (
              <View
                key={`${ing.name}-${i}`}
                style={{
                  flexDirection: "row",
                  borderBottomWidth: 0.5,
                  borderBottomColor: withAlpha(t.ink, 0.08),
                  paddingVertical: d.ingRowPadV,
                  gap: 5,
                  alignItems: "flex-start",
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    color: withAlpha(t.accent, 0.7),
                    width: 12,
                    lineHeight: 1.2,
                  }}
                >
                  ☐
                </Text>
                <Text
                  style={{
                    fontSize: 7.5,
                    color: t.inkSoft,
                    width: 50,
                  }}
                >
                  {ing.amount}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: d.ingFontSize,
                      lineHeight: 1.3,
                      color: t.ink,
                    }}
                  >
                    {ing.name}
                  </Text>
                  {ing.note ? (
                    <Text
                      style={{
                        fontSize: d.ingNoteFontSize,
                        fontStyle: "italic",
                        color: t.inkSoft,
                        marginTop: 0.5,
                      }}
                    >
                      {ing.note}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Timeline-Steps with connecting lines */}
        <View style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-end",
              justifyContent: "space-between",
              borderBottomWidth: 1,
              borderBottomColor: withAlpha(t.ink, 0.15),
              paddingBottom: 3,
            }}
          >
            <Text
              style={{
                fontSize: 8.5,
                fontWeight: 700,
                letterSpacing: 1.6,
                color: t.accent,
                textTransform: "uppercase",
              }}
            >
              Timeline
            </Text>
            <Text
              style={{
                fontSize: 6.5,
                fontWeight: 500,
                letterSpacing: 1,
                color: t.inkSoft,
                textTransform: "uppercase",
              }}
            >
              {recipe.steps.length} Schritte · {time} Min
            </Text>
          </View>
          <View style={{ marginTop: 8 }}>
            {groupSteps(recipe.steps).map((group, gIdx) => (
              <View key={`sg-${gIdx}`}>
                {group.name ? (
                  <Text
                    style={{
                      fontFamily: "Inter",
                      fontSize: 8,
                      fontWeight: 600,
                      letterSpacing: 1.4,
                      color: t.accent,
                      textTransform: "uppercase",
                      marginTop: gIdx > 0 ? 6 : 0,
                      marginBottom: 5,
                    }}
                  >
                    {group.name}
                  </Text>
                ) : null}
                {group.items.map((item) => {
                  const isLast = item.index === recipe.steps.length - 1;
                  return (
                    <View
                      key={item.index}
                      style={{
                        flexDirection: "row",
                        marginBottom: d.stepMarginBottom,
                        gap: 8,
                      }}
                    >
                      <View style={{ width: 22, alignItems: "center" }}>
                        <Text
                          style={{
                            fontFamily: "Fraunces",
                            fontSize: 18,
                            color: t.accent,
                            lineHeight: 1,
                          }}
                        >
                          {item.index + 1}
                        </Text>
                        {!isLast ? (
                          <View
                            style={{
                              marginTop: 4,
                              width: 1.5,
                              flex: 1,
                              minHeight: 18,
                              backgroundColor: withAlpha(t.accent, 0.3),
                            }}
                          />
                        ) : null}
                      </View>
                      <Text
                        style={{
                          flex: 1,
                          fontSize: d.stepFontSize,
                          lineHeight: 1.45,
                          color: t.ink,
                          paddingBottom: 4,
                        }}
                      >
                        {item.text}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </View>

      <CardFooter brand={brand} pack={pack} recipe={recipe} theme={t} qrDataUri={qrDataUri} />
    </Page>
  );
}

function VolumenStatTile({
  dotColor,
  value,
  label,
  theme,
  highlight = false,
  borderRight = false,
  padV = 14,
}: {
  dotColor: string;
  value: string;
  label: string;
  theme: ReturnType<typeof packTheme>;
  highlight?: boolean;
  borderRight?: boolean;
  padV?: number;
}) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        paddingVertical: padV,
        paddingHorizontal: 6,
        backgroundColor: highlight
          ? blendWithWhite(theme.bg, 0.65)
          : "transparent",
        borderRightWidth: borderRight ? 1 : 0,
        borderRightColor: theme.divider,
      }}
    >
      {/* accent dot — fills the space the web's emoji takes, since
          @react-pdf's bundled fonts don't carry emoji glyphs. */}
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          backgroundColor: dotColor,
          marginBottom: 6,
        }}
      />
      <Text
        style={{
          fontFamily: "Fraunces",
          fontSize: 24,
          color: theme.ink,
          lineHeight: 1,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          fontSize: 6.5,
          fontWeight: 600,
          letterSpacing: 1.4,
          color: highlight ? theme.accent : theme.inkSoft,
          marginTop: 4,
          textAlign: "center",
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// LAYOUT 5: DASHBOARD — Pack 5 (Meal-Prep, Sky Blue)
// ═════════════════════════════════════════════════════════════════════════════
// Dashboard tuning — Notion-template look. Most Pack 5 (Meal-Prep)
// recipes are mid-density (3–6 steps + 7–13 ings), so spacious carries the
// brunt of the work: when ingredients ≤ 10 we surface the story block too.
const DASHBOARD_DENSITY: Record<
  Density,
  {
    titleStripPadTop: number;
    titleStripPadBottom: number;
    titleFontSize: number;
    subtitleFontSize: number;
    bodyPadV: number;
    ingRowPadV: number;
    ingFontSize: number;
    ingNoteFontSize: number;
    stepMarginBottom: number;
    stepFontSize: number;
    stepNumFontSize: number;
    microsPadTop: number;
    microsPadBottom: number;
  }
> = {
  compact: {
    titleStripPadTop: 18,
    titleStripPadBottom: 12,
    titleFontSize: 22,
    subtitleFontSize: 9.5,
    bodyPadV: 12,
    ingRowPadV: 2.5,
    ingFontSize: 9,
    ingNoteFontSize: 6.5,
    stepMarginBottom: 6,
    stepFontSize: 9,
    stepNumFontSize: 16,
    microsPadTop: 9,
    microsPadBottom: 10,
  },
  balanced: {
    titleStripPadTop: 22,
    titleStripPadBottom: 16,
    titleFontSize: 26,
    subtitleFontSize: 10.5,
    bodyPadV: 16,
    ingRowPadV: 3.5,
    ingFontSize: 9.5,
    ingNoteFontSize: 7,
    stepMarginBottom: 8,
    stepFontSize: 9.5,
    stepNumFontSize: 18,
    microsPadTop: 8,
    microsPadBottom: 9,
  },
  spacious: {
    titleStripPadTop: 28,
    titleStripPadBottom: 20,
    titleFontSize: 30,
    subtitleFontSize: 11.5,
    bodyPadV: 20,
    ingRowPadV: 5,
    ingFontSize: 10,
    ingNoteFontSize: 7.5,
    stepMarginBottom: 10,
    stepFontSize: 10,
    stepNumFontSize: 20,
    microsPadTop: 11,
    microsPadBottom: 12,
  },
};

function DashboardPage({
  brand,
  pack,
  recipe,
  totalRecipes,
  heroDataUri,
  qrDataUri,
}: RecipeCardPdfProps) {
  const t = packTheme(pack);
  const time = totalTime(recipe);
  const pl = portionsLabel(recipe.servings);
  const density = getDensity(recipe);
  const d = DASHBOARD_DENSITY[density];
  const weekDays = [
    "Montag",
    "Dienstag",
    "Mittwoch",
    "Donnerstag",
    "Freitag",
    "Samstag",
    "Sonntag",
  ];
  const weekDay = weekDays[(recipe.number - 1) % 7];

  return (
    <Page
      size="A4"
      style={{ backgroundColor: "#ffffff", fontFamily: "Inter", color: t.ink }}
    >
      {/* TAG ROW */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingHorizontal: 32,
          paddingVertical: 10,
          backgroundColor: blendWithWhite(t.bg, 0.6),
          borderBottomWidth: 1,
          borderBottomColor: t.divider,
        }}
        wrap={false}
      >
        <View
          style={{
            backgroundColor: t.bg,
            borderRadius: 4,
            paddingHorizontal: 8,
            paddingVertical: 3,
          }}
        >
          <Text
            style={{
              fontSize: 7.5,
              fontWeight: 600,
              letterSpacing: 1.2,
              color: t.ink,
              textTransform: "uppercase",
            }}
          >
            {weekDay}
          </Text>
        </View>
        <Text style={{ fontSize: 8.5, color: t.inkSoft }}>{pack.title}</Text>
        <View style={{ flex: 1 }} />
        <Text style={{ fontSize: 8.5, color: t.accent, fontWeight: 600 }}>
          MEALPREP-READY
        </Text>
      </View>

      {/* TITLE + IMAGE STRIP */}
      <View style={{ flexDirection: "row" }} wrap={false}>
        <View
          style={{
            flex: 1.4,
            paddingHorizontal: 32,
            paddingTop: d.titleStripPadTop,
            paddingBottom: d.titleStripPadBottom,
          }}
        >
          <Text
            style={{
              fontFamily: "Fraunces",
              fontSize: d.titleFontSize,
              lineHeight: 1.04,
              letterSpacing: -0.3,
              color: t.ink,
            }}
          >
            {recipe.title}
          </Text>
          <Text
            style={{
              fontSize: d.subtitleFontSize,
              color: t.inkSoft,
              lineHeight: 1.35,
              marginTop: 4,
            }}
          >
            {recipe.subtitle}
          </Text>

          <View
            style={{
              marginTop: 10,
              borderRadius: 8,
              borderWidth: 0.5,
              borderColor: t.divider,
              overflow: "hidden",
            }}
          >
            <DashRow label="Ergibt" value={`${recipe.servings} ${pl}`} theme={t} />
            <DashRow
              label={nutritionBasisLabelShort(recipe.nutritionBasis)}
              value={`${recipe.nutrition.kcal} kcal`}
              theme={t}
              highlight
            />
            <DashRow
              label="Eiweiß / Portion"
              value={`${recipe.nutrition.protein} g`}
              theme={t}
            />
            <DashRow
              label="Zubereitung"
              value={`${time} Min`}
              theme={t}
            />
            <DashRow
              label="Schwierigkeit"
              value={recipe.difficulty}
              theme={t}
              last
            />
          </View>
        </View>

        <View
          style={{
            flex: 1,
            backgroundColor: t.bg,
            // Hard-cap the image height. Without this, the @react-pdf
            // flexbox stretches the right column to fit the source image's
            // intrinsic height (often 1500+ px) and pushes the body off
            // the page. 220 pt matches the height the left column lands at
            // with the dash-row table, so the strip looks balanced.
            height: 220,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {heroDataUri ? (
            <Image
              src={heroDataUri}
              style={{ width: "100%", height: 220, objectFit: "cover" }}
            />
          ) : null}
        </View>
      </View>

      {/* BIENES STORY (≤10 Zutaten) — sits between header strip and the
          checklist body. Sage-blue tinted to match the dashboard mood, italic
          Fraunces pull-quote of recipe.description. Stops short Meal-Prep
          cards from looking halbleer below the data table. */}
      {shouldShowStory(recipe) ? (
        <View
          style={{
            paddingHorizontal: 32,
            paddingTop: 12,
            paddingBottom: 14,
            backgroundColor: blendWithWhite(t.bg, 0.55),
            borderTopWidth: 1,
            borderTopColor: t.divider,
          }}
          wrap={false}
        >
          <Text
            style={{
              fontSize: 7,
              fontWeight: 700,
              letterSpacing: 1.6,
              color: t.accent,
              textTransform: "uppercase",
              marginBottom: 5,
            }}
          >
            {`${brand.name}s Story`}
          </Text>
          <Text
            style={{
              fontFamily: "Fraunces",
              fontStyle: "italic",
              fontSize: 12,
              lineHeight: 1.5,
              color: t.ink,
            }}
          >
            {recipe.description}
          </Text>
        </View>
      ) : null}

      {/* CHECKLIST BODY */}
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          gap: 22,
          paddingHorizontal: 32,
          paddingVertical: d.bodyPadV,
          borderTopWidth: 1,
          borderTopColor: t.divider,
        }}
      >
        <View style={{ width: 220 }}>
          <SectionHeader label="MAN NEHME" theme={t} bold />
          <IngredientsList
            grouped={[{ name: null, items: recipe.ingredients }]}
            theme={t}
            checklist
            rowPadV={d.ingRowPadV}
            nameFontSize={d.ingFontSize}
            noteFontSize={d.ingNoteFontSize}
          />
        </View>
        <View style={{ flex: 1 }}>
          <SectionHeader label="ZUBEREITUNG" theme={t} bold />
          <StepsList
            steps={recipe.steps}
            theme={t}
            checklist
            stepMarginBottom={d.stepMarginBottom}
            stepFontSize={d.stepFontSize}
            stepNumFontSize={d.stepNumFontSize}
          />
        </View>
      </View>

      <CardFooter
        brand={brand}
        pack={pack}
        recipe={recipe}
        theme={t}
        qrDataUri={qrDataUri}
        microsPadTop={d.microsPadTop}
        microsPadBottom={d.microsPadBottom}
      />
    </Page>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// LAYOUT 6: VITAL — Pack 2 (Volumen-Wunder, Sage Green) — NEW
// ═════════════════════════════════════════════════════════════════════════════
// Premium-Stack-Layout. Drei gestapelte Cards (Hero, Nutrition, Recipe)
// mit subtiler Sage-Green-Border und White-Background — hebt sich vom
// Pack-Mood-Hintergrund ab und gibt dem Layout einen "Apple-Health-meets-
// Cookbook"-Look.
//
// Differentiators vs. den anderen 5 Layouts:
//   - Donut-Ringe fuer Macros (SVG arc-paths) statt Bars/Pills/Tiles
//   - Card-Stack-Architektur mit subtle Drop-Frame statt Single-Page
//   - Avatar als Stempel oben-rechts auf der Hero-Card (anders als Pack 3
//     wo der Avatar unten-rechts auf dem Hero-Bild sitzt)
//   - Mikronaehrstoffe als horizontaler Pearl-Strip in der Nutrition-Card,
//     nicht im Footer (anders als alle anderen)
//   - Zutaten als Menu-Card-Style mit Dot-Leader-Pattern
//   - Steps mit Time-Marker prominent davor
// ═════════════════════════════════════════════════════════════════════════════

// SVG arc-path generator. Beginnt am 12-Uhr-Punkt (cx, cy-r) und sweept
// im Uhrzeigersinn um sweepDeg Grad. largeArc-Flag wechselt bei > 180°.
// Returns leeren String bei sweepDeg <= 0 (kein Arc rendern).
function vitalArcPath(
  cx: number,
  cy: number,
  r: number,
  sweepDeg: number
): string {
  if (sweepDeg <= 0) return "";
  const clamped = Math.min(360, sweepDeg);
  if (clamped >= 359.9) {
    // Fast-full ring — split in two halves to avoid arc-degenerate path.
    return `M ${cx},${cy - r} A ${r},${r} 0 1,1 ${cx - 0.001},${cy - r}`;
  }
  const sweepRad = (clamped * Math.PI) / 180;
  const endX = cx + r * Math.sin(sweepRad);
  const endY = cy - r * Math.cos(sweepRad);
  const largeArc = clamped > 180 ? 1 : 0;
  return `M ${cx},${cy - r} A ${r},${r} 0 ${largeArc},1 ${endX.toFixed(3)},${endY.toFixed(3)}`;
}

// Density-config — wie bei sport, drei Stufen je nach Recipe-Laenge.
// Steuert Card-Padding, Font-Sizes und Listen-Spacing in der Body-Card,
// damit 3-Zutaten-Eisbowl genauso gut aussieht wie die 16-Zutaten-Mexican-Bowl.
const VITAL_DENSITY: Record<
  Density,
  {
    cardGap: number;
    heroCardPadding: number;
    nutritionCardPadding: number;
    bodyCardPadding: number;
    titleFontSize: number;
    subtitleFontSize: number;
    donutRadius: number;
    donutValueSize: number;
    ingRowPadV: number;
    ingFontSize: number;
    ingNoteFontSize: number;
    stepFontSize: number;
    stepGap: number;
  }
> = {
  compact: {
    cardGap: 6,
    heroCardPadding: 14,
    nutritionCardPadding: 12,
    bodyCardPadding: 14,
    titleFontSize: 22,
    subtitleFontSize: 9.5,
    donutRadius: 19,
    donutValueSize: 9.5,
    ingRowPadV: 2.5,
    ingFontSize: 8.5,
    ingNoteFontSize: 6.5,
    stepFontSize: 8.5,
    stepGap: 5,
  },
  balanced: {
    cardGap: 8,
    heroCardPadding: 16,
    nutritionCardPadding: 14,
    bodyCardPadding: 16,
    titleFontSize: 26,
    subtitleFontSize: 10.5,
    donutRadius: 22,
    donutValueSize: 10.5,
    ingRowPadV: 3.5,
    ingFontSize: 9.5,
    ingNoteFontSize: 7,
    stepFontSize: 9.5,
    stepGap: 7,
  },
  spacious: {
    cardGap: 10,
    heroCardPadding: 18,
    nutritionCardPadding: 16,
    bodyCardPadding: 18,
    titleFontSize: 30,
    subtitleFontSize: 11.5,
    donutRadius: 24,
    donutValueSize: 12,
    ingRowPadV: 5,
    ingFontSize: 10,
    ingNoteFontSize: 7.5,
    stepFontSize: 10,
    stepGap: 9,
  },
};

function VitalPage({
  brand,
  pack,
  recipe,
  totalRecipes,
  heroDataUri,
  qrDataUri,
  avatarDataUri,
  hideRecipeIndex,
}: RecipeCardPdfProps) {
  const t = packTheme(pack);
  const time = totalTime(recipe);
  const portionsLbl = portionsLabel(recipe.servings);
  const density = getDensity(recipe);
  const d = VITAL_DENSITY[density];
  const grouped = groupIngredients(recipe.ingredients);
  const stepGroups = groupSteps(recipe.steps ?? []);

  // Macro-Donut-Werte. Skala = sport-Layout fuer Konsistenz: 50/80/35 g
  // ist Bienes typische Volumen-Mahlzeit. Werte ueber dem Skala-Max
  // capped auf 100 % — sieht aufgeraeumt aus statt durchgesweept.
  const macros = [
    { label: "Eiweiß", value: recipe.nutrition.protein, max: 50, unit: "g" },
    { label: "Kohlenh.", value: recipe.nutrition.carbs, max: 80, unit: "g" },
    { label: "Fett", value: recipe.nutrition.fat, max: 35, unit: "g" },
  ];

  const micros = (recipe.nutrition.micros ?? []).slice(0, 8);

  // Card-Style: weiss auf Pack-Mood-BG, Sage-Akzent als duenne Border,
  // 2 px subtle outer Schatten via doppelter Border-Trick.
  const cardStyle = {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 0.6,
    borderColor: blendWithWhite(t.accent, 0.55),
  } as const;

  return (
    <Page
      size="A4"
      style={{
        backgroundColor: blendWithWhite(t.bg, 0.4),
        fontFamily: "Inter",
        color: t.ink,
        paddingHorizontal: 22,
        paddingTop: 18,
        paddingBottom: 16,
      }}
    >
      {/* TOP STRIP — Pack-Title + Recipe-Number. "Pack XX"-Praefix entfernt
          (tool-interne Nummerierung gehoert nicht aufs Druck-PDF). */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingHorizontal: 6,
          paddingBottom: 8,
        }}
        wrap={false}
      >
        <Text
          style={{
            fontSize: 7.5,
            fontWeight: 600,
            letterSpacing: 1.6,
            color: t.inkSoft,
            textTransform: "uppercase",
          }}
        >
          {pack.title}
        </Text>
        {hideRecipeIndex ? null : (
          <Text
            style={{
              fontSize: 7.5,
              fontWeight: 600,
              letterSpacing: 1.6,
              color: t.inkSoft,
            }}
          >
            {pad2(recipe.number)} / {pad2(totalRecipes)}
          </Text>
        )}
      </View>

      {/* CARD 1 — HERO */}
      <View
        style={{
          ...cardStyle,
          padding: d.heroCardPadding,
          flexDirection: "row",
          gap: 14,
          alignItems: "center",
          marginBottom: d.cardGap,
        }}
        wrap={false}
      >
        {/* Hero-Foto links, square mit subtle Sage-Frame */}
        {heroDataUri ? (
          <View
            style={{
              width: 110,
              height: 110,
              borderRadius: 10,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: blendWithWhite(t.accent, 0.5),
            }}
          >
            <Image
              src={heroDataUri}
              style={{ width: 110, height: 110, objectFit: "cover" }}
            />
          </View>
        ) : (
          <View
            style={{
              width: 110,
              height: 110,
              borderRadius: 10,
              backgroundColor: blendWithWhite(t.accent, 0.85),
            }}
          />
        )}

        {/* Title-Block in der Mitte */}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 7,
              fontWeight: 700,
              letterSpacing: 1.6,
              color: t.accent,
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            High Protein · Volumen
          </Text>
          <Text
            style={{
              fontFamily: "Fraunces",
              fontStyle: "italic",
              fontSize: d.titleFontSize,
              lineHeight: 1.02,
              letterSpacing: -0.3,
              color: t.ink,
            }}
          >
            {recipe.title}
          </Text>
          {recipe.subtitle ? (
            <Text
              style={{
                fontFamily: "Fraunces",
                fontStyle: "italic",
                fontSize: d.subtitleFontSize,
                lineHeight: 1.3,
                color: t.inkSoft,
                marginTop: 4,
              }}
            >
              «&nbsp;{recipe.subtitle}&nbsp;»
            </Text>
          ) : null}
          <View
            style={{
              flexDirection: "row",
              gap: 6,
              marginTop: 8,
              flexWrap: "wrap",
            }}
          >
            <VitalMetaPill label={`${time} Min`} theme={t} />
            <VitalMetaPill label={recipe.difficulty} theme={t} />
            <VitalMetaPill
              label={`${recipe.servings}× ${portionsLbl}`}
              theme={t}
            />
          </View>
        </View>

        {/* Avatar-Stempel rechts */}
        {avatarDataUri ? (
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              borderWidth: 2,
              borderColor: t.accent,
              padding: 2,
              backgroundColor: "#ffffff",
            }}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                overflow: "hidden",
              }}
            >
              <Image
                src={avatarDataUri}
                style={{ width: 48, height: 48, objectFit: "cover", objectPosition: "center 25%" }}
              />
            </View>
          </View>
        ) : null}
      </View>

      {/* CARD 1.5 — BIENES STORY (sparse-only). Eigene Card im Stack-
          Rhythmus, nur bei kurzen Volumen-Wundern (≤10 Zutaten via
          shouldShowStory). Sage-Akzent + italic Fraunces, matche das
          Web-Vital. Sonst wuerde die Karte zwischen XL-Hero und 3-Zutaten-
          Liste optisch durchhaengen. */}
      {shouldShowStory(recipe) ? (
        <View
          style={{
            ...cardStyle,
            padding: 18,
            marginBottom: d.cardGap,
          }}
          wrap={false}
        >
          <Text
            style={{
              fontSize: 7.5,
              fontWeight: 700,
              letterSpacing: 1.6,
              color: t.accent,
              textTransform: "uppercase",
              marginBottom: 5,
            }}
          >
            {`${brand.name}s Story`}
          </Text>
          <Text
            style={{
              fontFamily: "Fraunces",
              fontStyle: "italic",
              fontSize: 12,
              lineHeight: 1.5,
              color: t.ink,
            }}
          >
            {recipe.description}
          </Text>
        </View>
      ) : null}

      {/* CARD 2 — NUTRITION (Donuts + Mikros) */}
      <View
        style={{
          ...cardStyle,
          padding: d.nutritionCardPadding,
          marginBottom: d.cardGap,
        }}
        wrap={false}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <Text
            style={{
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: 1.6,
              color: t.inkSoft,
              textTransform: "uppercase",
            }}
          >
            Nährstoff-Profil ·{" "}
            {nutritionBasisInline(recipe.nutritionBasis)}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
            <Text
              style={{
                fontFamily: "Fraunces",
                fontSize: 22,
                color: t.ink,
                lineHeight: 1,
              }}
            >
              {recipe.nutrition.kcal}
            </Text>
            <Text
              style={{
                fontSize: 8,
                fontWeight: 700,
                letterSpacing: 1.4,
                color: t.inkSoft,
                textTransform: "uppercase",
              }}
            >
              kcal
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 16 }}>
          {/* Drei Donut-Ringe links */}
          <View
            style={{
              flexDirection: "row",
              gap: 14,
              alignItems: "flex-start",
            }}
          >
            {macros.map((m) => (
              <VitalMacroDonut
                key={m.label}
                label={m.label}
                value={m.value}
                max={m.max}
                unit={m.unit}
                radius={d.donutRadius}
                valueFontSize={d.donutValueSize}
                theme={t}
              />
            ))}
          </View>

          {/* Mikros als horizontaler Pearl-Strip rechts */}
          {micros.length > 0 ? (
            <View
              style={{
                flex: 1,
                paddingLeft: 16,
                borderLeftWidth: 0.5,
                borderLeftColor: blendWithWhite(t.accent, 0.45),
              }}
            >
              <Text
                style={{
                  fontSize: 7,
                  fontWeight: 700,
                  letterSpacing: 1.4,
                  color: t.inkSoft,
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                Reich an · % Tagesbedarf
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 5,
                }}
              >
                {micros.map((m) => (
                  <VitalMicroPearl key={m.name} micro={m} theme={t} />
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </View>

      {/* CARD 3 — RECIPE BODY (Zutaten + Steps) */}
      <View
        style={{
          ...cardStyle,
          padding: d.bodyCardPadding,
          flexDirection: "row",
          gap: 16,
          flex: 1,
          marginBottom: d.cardGap,
        }}
      >
        {/* ZUTATEN — Menu-Card mit Dot-Leader */}
        <View
          style={{
            width: "44%",
            paddingRight: 14,
            borderRightWidth: 0.5,
            borderRightColor: blendWithWhite(t.accent, 0.45),
          }}
        >
          <Text
            style={{
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: 1.6,
              color: t.accent,
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            Zutaten · {recipe.ingredients.length} Items
          </Text>
          {grouped.map((group, gi) => (
            <View key={gi} style={{ marginBottom: gi < grouped.length - 1 ? 9 : 0 }}>
              {group.name ? (
                <Text
                  style={{
                    fontFamily: "Fraunces",
                    fontStyle: "italic",
                    fontSize: 9.5,
                    color: t.inkSoft,
                    marginBottom: 4,
                  }}
                >
                  {group.name}
                </Text>
              ) : null}
              {group.items.map((ing, ii) => (
                <View
                  key={ii}
                  style={{
                    flexDirection: "row",
                    alignItems: "baseline",
                    paddingVertical: d.ingRowPadV,
                    gap: 10,
                    borderBottomWidth: 0.4,
                    borderBottomColor: blendWithWhite(t.accent, 0.55),
                  }}
                  wrap={false}
                >
                  <Text
                    style={{
                      width: 48,
                      fontSize: d.ingFontSize,
                      fontWeight: 600,
                      color: t.accent,
                      letterSpacing: 0.2,
                    }}
                  >
                    {ing.amount || "n. A."}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: d.ingFontSize,
                        color: t.ink,
                        lineHeight: 1.25,
                      }}
                    >
                      {ing.name}
                    </Text>
                    {ing.note ? (
                      <Text
                        style={{
                          fontSize: d.ingNoteFontSize,
                          fontStyle: "italic",
                          color: t.inkSoft,
                          lineHeight: 1.3,
                          marginTop: 1,
                        }}
                      >
                        {ing.note}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>

        {/* ANWEISUNGEN — Numbered with Time-Marker */}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: 1.6,
              color: t.accent,
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            Anweisungen · {(recipe.steps ?? []).length} Schritte · {time} Min
          </Text>
          {stepGroups.map((group, gi) => (
            <View key={gi} style={{ marginBottom: gi < stepGroups.length - 1 ? 9 : 0 }}>
              {group.name ? (
                <Text
                  style={{
                    fontFamily: "Fraunces",
                    fontStyle: "italic",
                    fontSize: 9.5,
                    color: t.inkSoft,
                    marginBottom: 4,
                  }}
                >
                  {group.name}
                </Text>
              ) : null}
              {group.items.map((step, si) => (
                <View
                  key={si}
                  style={{
                    flexDirection: "row",
                    gap: 10,
                    marginBottom: d.stepGap + 4,
                    alignItems: "flex-start",
                  }}
                  wrap={false}
                >
                  {/* Number rendert in DERSELBEN Font + fontSize + lineHeight
                      wie der Body-Text. Damit sind Glyph-Metriken IDENTISCH
                      und Baselines garantiert auf gleicher Y-Linie. Pop
                      durch Italic + Bold + Akzent-Farbe statt durch
                      groessere Schrift oder andere Font. */}
                  <Text
                    style={{
                      fontSize: d.stepFontSize,
                      fontStyle: "italic",
                      fontWeight: 700,
                      color: t.accent,
                      width: 22,
                      lineHeight: 1.45,
                    }}
                  >
                    {pad2(si + 1)}
                  </Text>
                  <Text
                    style={{
                      flex: 1,
                      fontSize: d.stepFontSize,
                      lineHeight: 1.45,
                      color: t.ink,
                    }}
                  >
                    {typeof step === "string" ? step : step.text}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </View>

      {/* FOOTER — Brand-Signatur + QR-Stempel-Card */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 6,
          paddingTop: 4,
        }}
        wrap={false}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text
            style={{
              fontFamily: "Fraunces",
              fontStyle: "italic",
              fontSize: 13,
              color: t.ink,
            }}
          >
            {brand.signature}
          </Text>
          <BeeIcon brandSlug={brand.slug} size={14} />
          <Text
            style={{
              fontSize: 7,
              fontWeight: 700,
              letterSpacing: 1.4,
              color: t.inkSoft,
              textTransform: "uppercase",
            }}
          >
            {brand.handle} · {pack.title}
          </Text>
        </View>

        {qrDataUri ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingHorizontal: 9,
              paddingVertical: 6,
              backgroundColor: blendWithWhite(t.accent, 0.78),
              borderRadius: 5,
              borderWidth: 0.5,
              borderColor: blendWithWhite(t.accent, 0.45),
            }}
          >
            <View style={{ alignItems: "flex-end", maxWidth: 80 }}>
              <Text
                style={{
                  fontFamily: "Fraunces",
                  fontStyle: "italic",
                  fontSize: 9.5,
                  color: t.ink,
                  lineHeight: 1.15,
                  textAlign: "right",
                }}
              >
                {recipe.sourceLabel ?? "Original-Reel"}
              </Text>
              <Text
                style={{
                  fontSize: 6,
                  fontWeight: 700,
                  letterSpacing: 1.4,
                  color: t.inkSoft,
                  textTransform: "uppercase",
                  marginTop: 2,
                }}
              >
                Smartphone scannen
              </Text>
            </View>
            <View
              style={{
                width: 34,
                height: 34,
                padding: 2,
                backgroundColor: "#ffffff",
                borderRadius: 3,
              }}
            >
              <Image
                src={qrDataUri}
                style={{ width: 30, height: 30 }}
              />
            </View>
          </View>
        ) : null}
      </View>
    </Page>
  );
}

// Vital-Layout helper components ──────────────────────────────────────────

function VitalMetaPill({
  label,
  theme,
}: {
  label: string;
  theme: ReturnType<typeof packTheme>;
}) {
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        backgroundColor: blendWithWhite(theme.accent, 0.82),
        borderWidth: 0.5,
        borderColor: blendWithWhite(theme.accent, 0.55),
      }}
    >
      <Text
        style={{
          fontSize: 7.5,
          fontWeight: 600,
          letterSpacing: 0.6,
          color: theme.ink,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function VitalMacroDonut({
  label,
  value,
  max,
  unit,
  radius,
  valueFontSize,
  theme,
}: {
  label: string;
  value: number;
  max: number;
  unit: string;
  radius: number;
  valueFontSize: number;
  theme: ReturnType<typeof packTheme>;
}) {
  const stroke = 4.5;
  const size = radius * 2 + stroke * 2 + 4;
  const cx = size / 2;
  const cy = size / 2;
  const sweepDeg = Math.min(360, (value / max) * 360);
  const path = vitalArcPath(cx, cy, radius, sweepDeg);
  const ringBg = blendWithWhite(theme.accent, 0.82);
  return (
    <View style={{ alignItems: "center", gap: 5 }}>
      <View style={{ width: size, height: size, position: "relative" }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Circle
            cx={cx}
            cy={cy}
            r={radius}
            stroke={ringBg}
            strokeWidth={stroke}
            fill="none"
          />
          {path ? (
            <Path
              d={path}
              stroke={theme.accent}
              strokeWidth={stroke}
              fill="none"
              strokeLinecap="round"
            />
          ) : null}
        </Svg>
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              fontFamily: "Fraunces",
              fontSize: valueFontSize + 1,
              fontWeight: 600,
              color: theme.ink,
              lineHeight: 1,
            }}
          >
            {value}
            {unit}
          </Text>
        </View>
      </View>
      <Text
        style={{
          fontSize: 7,
          fontWeight: 700,
          letterSpacing: 1.2,
          color: theme.inkSoft,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function VitalMicroPearl({
  micro,
  theme,
}: {
  micro: { name: string; amount: string; pctDaily?: number };
  theme: ReturnType<typeof packTheme>;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        borderWidth: 0.5,
        borderColor: blendWithWhite(theme.accent, 0.45),
        backgroundColor: blendWithWhite(theme.accent, 0.88),
        borderRadius: 999,
        paddingHorizontal: 6,
        paddingVertical: 2,
      }}
    >
      <View
        style={{
          width: 4,
          height: 4,
          borderRadius: 2,
          backgroundColor: theme.accent,
        }}
      />
      <Text style={{ fontSize: 7.5, fontWeight: 600, color: theme.ink }}>
        {micro.name}
      </Text>
      <Text style={{ fontSize: 6.5, color: theme.inkSoft }}>
        {micro.amount}
      </Text>
      {micro.pctDaily ? (
        <Text
          style={{
            fontSize: 6.5,
            fontWeight: 700,
            color: theme.accent,
          }}
        >
          {micro.pctDaily}%
        </Text>
      ) : null}
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// LAYOUT 7: AMBER — Pack 5 (Feierabend-Klassiker, Honey) — NEW
// ═════════════════════════════════════════════════════════════════════════════
// Sunset-Editorial Premium-Spread. Wie eine Doppelseite aus Bon Appétit /
// Saveur Magazine. Differenziert sich von allen 6 anderen Layouts durch:
//   - Hero ZENTRIERT mit Honey-Glow-Halo (SVG radial gradient) — gibt es
//     nirgends sonst, alle anderen haben Hero links/rechts/full-bleed
//   - Avatar als runder Stempel mit Honey-Ring oben rechts auf dem Hero
//     (analog zu Pack 3 Cookbook-Cover, aber mit Honey statt Mint)
//   - Macros als TYPOGRAFISCHER Stat-Ribbon — Big Display-Numbers in einer
//     Zeile, OHNE Tiles/Donuts/Bars/Pills, nur reine Typografie
//   - Mikronaehrstoffe als VERTIKALE BAR-LIST — jeder Mikro mit
//     horizontalem %-Bar rechts daneben, gestapelt wie ein Diagnostik-
//     Report. Anders als alle Pills/Pearls/Banner-Loesungen
//   - QR-Stempel-Card mit Honey-getoenter BG (analog Pack 1+3+Vital)
// ═════════════════════════════════════════════════════════════════════════════

const AMBER_DENSITY: Record<
  Density,
  {
    heroHeight: number;
    heroPadding: number;
    titleFontSize: number;
    subtitleFontSize: number;
    titleBlockPadding: number;
    statRibbonPadV: number;
    statBigSize: number;
    statRibbonGap: number;
    bodyGap: number;
    ingRowPadV: number;
    ingFontSize: number;
    ingNoteFontSize: number;
    stepFontSize: number;
    stepGap: number;
    microRowPadV: number;
    microFontSize: number;
  }
> = {
  compact: {
    heroHeight: 110,
    heroPadding: 6,
    titleFontSize: 22,
    subtitleFontSize: 10.5,
    titleBlockPadding: 6,
    statRibbonPadV: 7,
    statBigSize: 19,
    statRibbonGap: 12,
    bodyGap: 8,
    ingRowPadV: 2,
    ingFontSize: 8.5,
    ingNoteFontSize: 6.5,
    stepFontSize: 8.5,
    stepGap: 4,
    microRowPadV: 1.5,
    microFontSize: 8,
  },
  balanced: {
    heroHeight: 134,
    heroPadding: 7,
    titleFontSize: 28,
    subtitleFontSize: 11.5,
    titleBlockPadding: 8,
    statRibbonPadV: 8,
    statBigSize: 23,
    statRibbonGap: 16,
    bodyGap: 11,
    ingRowPadV: 2.5,
    ingFontSize: 9,
    ingNoteFontSize: 7,
    stepFontSize: 9,
    stepGap: 6,
    microRowPadV: 2,
    microFontSize: 8.5,
  },
  spacious: {
    heroHeight: 162,
    heroPadding: 8,
    titleFontSize: 34,
    subtitleFontSize: 12.5,
    titleBlockPadding: 12,
    statRibbonPadV: 10,
    statBigSize: 27,
    statRibbonGap: 20,
    bodyGap: 14,
    ingRowPadV: 3.5,
    ingFontSize: 9.5,
    ingNoteFontSize: 7.5,
    stepFontSize: 9.5,
    stepGap: 8,
    microRowPadV: 2.5,
    microFontSize: 9,
  },
};

function AmberPage({
  brand,
  pack,
  recipe,
  totalRecipes,
  heroDataUri,
  qrDataUri,
  avatarDataUri,
  hideRecipeIndex,
}: RecipeCardPdfProps) {
  const t = packTheme(pack);
  const time = totalTime(recipe);
  const portionsLbl = portionsLabel(recipe.servings);
  const density = getDensity(recipe);
  const d = AMBER_DENSITY[density];
  const grouped = groupIngredients(recipe.ingredients);
  const stepGroups = groupSteps(recipe.steps ?? []);
  const micros = (recipe.nutrition.micros ?? []).slice(0, 6);

  // Stat-Ribbon-Werte. Nur kcal + 3 Macros, alles inline.
  const stats = [
    { value: String(recipe.nutrition.kcal), label: "kcal" },
    { value: `${recipe.nutrition.protein}g`, label: "Eiweiß" },
    { value: `${recipe.nutrition.carbs}g`, label: "Kohlenh." },
    { value: `${recipe.nutrition.fat}g`, label: "Fett" },
  ];

  // Honey-Halo via tinted wrapper-View (statt SVG-Gradient als absolute
  // child) — react-pdf macht den page-break-flow stabiler, wenn alles
  // im natural-flow liegt. Die Honey-Tönung als padding rund ums Hero
  // gibt visuell das gleiche "Glow"-Gefühl wie ein radial gradient.
  const heroWidth = 290;
  const heroHeight = d.heroHeight;

  return (
    <Page
      size="A4"
      style={{
        backgroundColor: blendWithWhite(t.bg, 0.55),
        fontFamily: "Inter",
        color: t.ink,
        paddingHorizontal: 36,
        paddingTop: 16,
        paddingBottom: 14,
      }}
    >
      {/* TOP STRIP — Pack-Title + Recipe-Number. "Pack XX"-Praefix entfernt
          (tool-interne Nummerierung gehoert nicht aufs Druck-PDF). */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingBottom: 4,
        }}
        wrap={false}
      >
        <Text
          style={{
            fontSize: 7.5,
            fontWeight: 600,
            letterSpacing: 1.6,
            color: t.inkSoft,
            textTransform: "uppercase",
          }}
        >
          {pack.title}
        </Text>
        {hideRecipeIndex ? null : (
          <Text
            style={{
              fontSize: 7.5,
              fontWeight: 600,
              letterSpacing: 1.6,
              color: t.inkSoft,
            }}
          >
            {pad2(recipe.number)} / {pad2(totalRecipes)}
          </Text>
        )}
      </View>

      {/* HERO mit HONEY-HALO + AVATAR-STEMPEL */}
      <View
        style={{
          alignItems: "center",
          paddingTop: 6,
          paddingBottom: 6,
        }}
        wrap={false}
      >
        {/* Halo-Wrapper: Honey-tinted padding ums Hero. Avatar absolute
            relativ zum Wrapper, damit overlap auf der Hero-Ecke sitzt. */}
        <View
          style={{
            position: "relative",
            padding: d.heroPadding,
            backgroundColor: blendWithWhite(t.accent, 0.86),
            borderRadius: 14,
          }}
        >
          <View
            style={{
              width: heroWidth,
              height: heroHeight,
              borderRadius: 9,
              overflow: "hidden",
              borderWidth: 0.5,
              borderColor: blendWithWhite(t.accent, 0.4),
            }}
          >
            {heroDataUri ? (
              <Image
                src={heroDataUri}
                style={{ width: heroWidth, height: heroHeight, objectFit: "cover" }}
              />
            ) : (
              <View
                style={{
                  width: heroWidth,
                  height: heroHeight,
                  backgroundColor: blendWithWhite(t.accent, 0.7),
                }}
              />
            )}
          </View>

          {/* Avatar-Stempel oben rechts auf dem Hero */}
          {avatarDataUri ? (
            <View
              style={{
                position: "absolute",
                top: -8,
                right: -8,
                width: 50,
                height: 50,
                borderRadius: 25,
                borderWidth: 2.2,
                borderColor: t.accent,
                padding: 1.8,
                backgroundColor: "#ffffff",
              }}
            >
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  overflow: "hidden",
                }}
              >
                <Image
                  src={avatarDataUri}
                  style={{ width: 42, height: 42, objectFit: "cover", objectPosition: "center 25%" }}
                />
              </View>
            </View>
          ) : null}
        </View>
      </View>

      {/* TITLE-BLOCK — zentriert */}
      <View
        style={{ alignItems: "center", paddingTop: 4, paddingBottom: d.titleBlockPadding }}
        wrap={false}
      >
        <Text
          style={{
            fontSize: 7.5,
            fontWeight: 700,
            letterSpacing: 1.8,
            color: t.accent,
            textTransform: "uppercase",
            marginBottom: 4,
          }}
        >
          {pack.category}
        </Text>
        <Text
          style={{
            fontFamily: "Fraunces",
            fontStyle: "italic",
            fontSize: d.titleFontSize,
            lineHeight: 1.04,
            letterSpacing: -0.4,
            color: t.ink,
            textAlign: "center",
          }}
        >
          {recipe.title}
        </Text>
        {recipe.subtitle ? (
          <Text
            style={{
              fontFamily: "Fraunces",
              fontStyle: "italic",
              fontSize: d.subtitleFontSize,
              lineHeight: 1.35,
              color: t.inkSoft,
              marginTop: 3,
              textAlign: "center",
            }}
          >
            «&nbsp;{recipe.subtitle}&nbsp;»
          </Text>
        ) : null}
        <Text
          style={{
            fontSize: 8.5,
            color: t.inkSoft,
            marginTop: 4,
            letterSpacing: 0.4,
          }}
        >
          {time} Min · {recipe.difficulty} · {recipe.servings}× {portionsLbl}
        </Text>
      </View>

      {/* STAT-RIBBON — typografisch, ohne Boxes */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "baseline",
          justifyContent: "center",
          gap: d.statRibbonGap,
          paddingTop: d.statRibbonPadV,
          paddingBottom: d.statRibbonPadV,
          borderTopWidth: 0.7,
          borderBottomWidth: 0.7,
          borderTopColor: blendWithWhite(t.accent, 0.45),
          borderBottomColor: blendWithWhite(t.accent, 0.45),
          marginBottom: d.bodyGap,
        }}
        wrap={false}
      >
        {stats.map((s, i) => (
          <View
            key={s.label}
            style={{
              flexDirection: "row",
              alignItems: "baseline",
              gap: 4,
            }}
          >
            <Text
              style={{
                fontFamily: "Fraunces",
                fontSize: d.statBigSize,
                color: t.ink,
                lineHeight: 1,
              }}
            >
              {s.value}
            </Text>
            <Text
              style={{
                fontSize: 8,
                fontWeight: 700,
                letterSpacing: 1.4,
                color: t.inkSoft,
                textTransform: "uppercase",
              }}
            >
              {s.label}
            </Text>
            {i < stats.length - 1 ? (
              <Text
                style={{
                  fontSize: 11,
                  color: t.accent,
                  marginLeft: 6,
                  marginRight: -8,
                }}
              >
                ·
              </Text>
            ) : null}
          </View>
        ))}
      </View>

      {/* BIENES STORY (sparse-only) — Honey-tinted Pull-Quote zwischen
          Stat-Ribbon und Body. Bei kurzen Feierabend-Klassikern (≤10
          Zutaten via shouldShowStory) sonst wirkt der Body unter dem
          grosszuegigen Hero halbleer. Matche das Web-Amber-Pattern. */}
      {shouldShowStory(recipe) ? (
        <View
          style={{
            paddingHorizontal: 14,
            paddingTop: 12,
            paddingBottom: 14,
            marginBottom: 8,
            backgroundColor: blendWithWhite(t.accent, 0.88),
            borderTopWidth: 0.6,
            borderBottomWidth: 0.6,
            borderColor: blendWithWhite(t.accent, 0.55),
            alignItems: "center",
          }}
          wrap={false}
        >
          <Text
            style={{
              fontSize: 7.5,
              fontWeight: 700,
              letterSpacing: 1.8,
              color: t.accent,
              textTransform: "uppercase",
              marginBottom: 5,
            }}
          >
            {`${brand.name}s Story`}
          </Text>
          <Text
            style={{
              fontFamily: "Fraunces",
              fontStyle: "italic",
              fontSize: 12,
              lineHeight: 1.5,
              color: t.ink,
              textAlign: "center",
              maxWidth: 460,
            }}
          >
            {recipe.description}
          </Text>
        </View>
      ) : null}

      {/* BODY — 2-Spalten */}
      <View
        style={{
          flexDirection: "row",
          gap: 22,
          flex: 1,
          paddingBottom: d.bodyGap,
        }}
      >
        {/* ZUTATEN */}
        <View
          style={{
            width: "44%",
            paddingRight: 14,
            borderRightWidth: 0.5,
            borderRightColor: blendWithWhite(t.accent, 0.4),
          }}
        >
          <Text
            style={{
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: 1.6,
              color: t.accent,
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            Zutaten · {recipe.ingredients.length} Items
          </Text>
          {grouped.map((group, gi) => (
            <View key={gi} style={{ marginBottom: gi < grouped.length - 1 ? 9 : 0 }}>
              {group.name ? (
                <Text
                  style={{
                    fontFamily: "Fraunces",
                    fontStyle: "italic",
                    fontSize: 9.5,
                    color: t.inkSoft,
                    marginBottom: 4,
                  }}
                >
                  {group.name}
                </Text>
              ) : null}
              {group.items.map((ing, ii) => (
                <View
                  key={ii}
                  style={{
                    flexDirection: "row",
                    alignItems: "baseline",
                    paddingVertical: d.ingRowPadV,
                    gap: 10,
                    borderBottomWidth: 0.4,
                    borderBottomColor: blendWithWhite(t.accent, 0.4),
                  }}
                  wrap={false}
                >
                  <Text
                    style={{
                      width: 48,
                      fontSize: d.ingFontSize,
                      fontWeight: 600,
                      color: t.accent,
                      letterSpacing: 0.2,
                    }}
                  >
                    {ing.amount || "n. A."}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: d.ingFontSize,
                        color: t.ink,
                        lineHeight: 1.25,
                      }}
                    >
                      {ing.name}
                    </Text>
                    {ing.note ? (
                      <Text
                        style={{
                          fontSize: d.ingNoteFontSize,
                          fontStyle: "italic",
                          color: t.inkSoft,
                          lineHeight: 1.3,
                          marginTop: 1,
                        }}
                      >
                        {ing.note}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>

        {/* ZUBEREITUNG */}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: 1.6,
              color: t.accent,
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            Zubereitung · {(recipe.steps ?? []).length} Schritte · {time} Min
          </Text>
          {stepGroups.map((group, gi) => (
            <View key={gi} style={{ marginBottom: gi < stepGroups.length - 1 ? 9 : 0 }}>
              {group.name ? (
                <Text
                  style={{
                    fontFamily: "Fraunces",
                    fontStyle: "italic",
                    fontSize: 9.5,
                    color: t.inkSoft,
                    marginBottom: 4,
                  }}
                >
                  {group.name}
                </Text>
              ) : null}
              {group.items.map((step, si) => (
                <View
                  key={si}
                  style={{
                    flexDirection: "row",
                    gap: 10,
                    marginBottom: d.stepGap + 4,
                    alignItems: "flex-start",
                  }}
                  wrap={false}
                >
                  {/* Number rendert in DERSELBEN Font + fontSize + lineHeight
                      wie der Body-Text — Glyph-Metriken IDENTISCH, Baselines
                      garantiert auf gleicher Y-Linie. Pop durch Italic +
                      Bold + Akzent-Farbe. */}
                  <Text
                    style={{
                      fontSize: d.stepFontSize,
                      fontStyle: "italic",
                      fontWeight: 700,
                      color: t.accent,
                      width: 22,
                      lineHeight: 1.45,
                    }}
                  >
                    {pad2(si + 1)}
                  </Text>
                  <Text
                    style={{
                      flex: 1,
                      fontSize: d.stepFontSize,
                      lineHeight: 1.45,
                      color: t.ink,
                    }}
                  >
                    {typeof step === "string" ? step : step.text}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </View>

      {/* MIKROS als VERTIKALE BAR-LIST */}
      {micros.length > 0 ? (
        <View
          style={{
            paddingTop: 7,
            paddingBottom: 6,
            borderTopWidth: 0.7,
            borderTopColor: blendWithWhite(t.accent, 0.45),
            marginBottom: 4,
          }}
          wrap={false}
        >
          <Text
            style={{
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: 1.6,
              color: t.accent,
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            Nährstoff-Profil ·{" "}
            {nutritionBasisInline(recipe.nutritionBasis)}
          </Text>
          <View
            style={{
              flexDirection: "row",
              gap: 18,
            }}
          >
            {/* Zwei Spalten: erste 3 Mikros links, naechste 3 rechts */}
            <View style={{ flex: 1, gap: 4 }}>
              {micros.slice(0, 3).map((m) => (
                <AmberMicroBar key={m.name} micro={m} theme={t} fontSize={d.microFontSize} padV={d.microRowPadV} />
              ))}
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              {micros.slice(3, 6).map((m) => (
                <AmberMicroBar key={m.name} micro={m} theme={t} fontSize={d.microFontSize} padV={d.microRowPadV} />
              ))}
            </View>
          </View>
        </View>
      ) : null}

      {/* FOOTER — Brand-Signatur + QR-Stempel-Card */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: 4,
        }}
        wrap={false}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          {avatarDataUri ? (
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                borderWidth: 1.2,
                borderColor: t.accent,
                padding: 1.5,
                backgroundColor: "#ffffff",
              }}
            >
              <View
                style={{
                  width: 21,
                  height: 21,
                  borderRadius: 10.5,
                  overflow: "hidden",
                }}
              >
                <Image
                  src={avatarDataUri}
                  style={{ width: 21, height: 21, objectFit: "cover", objectPosition: "center 25%" }}
                />
              </View>
            </View>
          ) : null}
          <View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Text
                style={{
                  fontFamily: "Fraunces",
                  fontStyle: "italic",
                  fontSize: 13,
                  color: t.ink,
                  lineHeight: 1.1,
                }}
              >
                {brand.signature}
              </Text>
              <BeeIcon brandSlug={brand.slug} size={14} />
            </View>
            <Text
              style={{
                fontSize: 7,
                fontWeight: 700,
                letterSpacing: 1.4,
                color: t.inkSoft,
                textTransform: "uppercase",
                marginTop: 1,
              }}
            >
              {brand.handle} · {pack.title}
            </Text>
          </View>
        </View>

        {qrDataUri ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingHorizontal: 9,
              paddingVertical: 6,
              backgroundColor: blendWithWhite(t.accent, 0.78),
              borderRadius: 5,
              borderWidth: 0.5,
              borderColor: blendWithWhite(t.accent, 0.45),
            }}
          >
            <View style={{ alignItems: "flex-end", maxWidth: 84 }}>
              <Text
                style={{
                  fontFamily: "Fraunces",
                  fontStyle: "italic",
                  fontSize: 10,
                  color: t.ink,
                  lineHeight: 1.15,
                  textAlign: "right",
                }}
              >
                {recipe.sourceLabel ?? "Original-Reel"}
              </Text>
              <Text
                style={{
                  fontSize: 6,
                  fontWeight: 700,
                  letterSpacing: 1.4,
                  color: t.inkSoft,
                  textTransform: "uppercase",
                  marginTop: 2,
                }}
              >
                Smartphone scannen
              </Text>
            </View>
            <View
              style={{
                width: 36,
                height: 36,
                padding: 2,
                backgroundColor: "#ffffff",
                borderRadius: 3,
              }}
            >
              <Image
                src={qrDataUri}
                style={{ width: 32, height: 32 }}
              />
            </View>
          </View>
        ) : null}
      </View>
    </Page>
  );
}

// Amber helper — vertikale Mikro-Bar-Row
function AmberMicroBar({
  micro,
  theme,
  fontSize,
  padV,
}: {
  micro: { name: string; amount: string; pctDaily?: number };
  theme: ReturnType<typeof packTheme>;
  fontSize: number;
  padV: number;
}) {
  const pct = Math.max(0, Math.min(100, micro.pctDaily ?? 0));
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingVertical: padV,
      }}
    >
      <Text
        style={{
          width: 64,
          fontSize: fontSize,
          fontWeight: 600,
          color: theme.ink,
        }}
      >
        {micro.name}
      </Text>
      <Text
        style={{
          fontSize: fontSize - 1,
          color: theme.inkSoft,
          minWidth: 42,
        }}
      >
        {micro.amount}
      </Text>
      {/* Bar */}
      <View
        style={{
          flex: 1,
          height: 5,
          borderRadius: 3,
          backgroundColor: blendWithWhite(theme.accent, 0.82),
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${pct}%`,
            height: 5,
            backgroundColor: theme.accent,
          }}
        />
      </View>
      <Text
        style={{
          width: 30,
          fontSize: fontSize - 1,
          fontWeight: 700,
          color: theme.accent,
          textAlign: "right",
        }}
      >
        {pct}%
      </Text>
    </View>
  );
}

// ─── Shared building blocks ──────────────────────────────────────────────────

// Renders the ingredients list. Optional row/font overrides let layouts
// pick up density-aware sizing without touching internal helpers — defaults
// match the legacy hard-coded values, so layouts that don't pass them are
// bit-identical to before.
function IngredientsList({
  grouped,
  theme,
  bold = false,
  checklist = false,
  rowPadV,
  nameFontSize,
  noteFontSize,
}: {
  grouped: IngredientGroup[];
  theme: ReturnType<typeof packTheme>;
  bold?: boolean;
  checklist?: boolean;
  rowPadV?: number;
  nameFontSize?: number;
  noteFontSize?: number;
}) {
  return (
    <View style={{ marginTop: 8 }}>
      {grouped.map((g, gi) => {
        // Sub-group separation: bei nicht-erstem Group brauchen wir
        // klar sichtbaren Abstand zur vorherigen Group, sonst stoesst
        // der Sub-Group-Header an den letzten Note der vorigen Group
        // (Pack 3 mit "Fuer Teig"/"Fuer Topping"/"Fuer Streusel" + Notes
        // wie "oder Obst nach Wahl" und "gerne grosszuegig" hatte das
        // Problem). 14 pt paddingTop + 14 pt marginBottom = 28 pt klare
        // Trennung zwischen jedem Group-Block — dazu noch eine duenne
        // Akzent-Linie als visueller Separator.
        const isFirstGroup = gi === 0;
        const isNamedGroup = Boolean(g.name);
        return (
          <View
            key={g.name ?? `m${gi}`}
            style={{
              marginBottom: gi === grouped.length - 1 ? 0 : 14,
              paddingTop: !isFirstGroup && isNamedGroup ? 14 : 0,
              borderTopWidth: !isFirstGroup && isNamedGroup ? 0.6 : 0,
              borderTopColor: withAlpha(theme.accent, 0.35),
            }}
          >
            {g.name ? (
              <Text
                style={{
                  fontSize: 7,
                  letterSpacing: 1.4,
                  fontWeight: 700,
                  color: theme.accent,
                  marginBottom: 8,
                  textTransform: "uppercase",
                }}
              >
                {/* "Für den Teig" / "Für die Glasur" sind korrekte Genitiv-
                    Konstruktionen — bei Gruppen-Namen die mit "den/die/das"
                    anfangen ergaenzen wir "Für" davor. Bei One-Word-Gruppen
                    ("Optional", "Topping", "Garnish") wuerde "Für Optional"
                    grammatikalisch falsch klingen — dann rendern wir nur
                    den Namen pur. */}
                {/^(den|die|das)\s/i.test(g.name)
                  ? `Für ${g.name.toLowerCase()}`
                  : g.name}
              </Text>
            ) : null}
            <IngredientGroupBody
              items={g.items}
              theme={theme}
              bold={bold}
              checklist={checklist}
              rowPadV={rowPadV}
              nameFontSize={nameFontSize}
              noteFontSize={noteFontSize}
            />
          </View>
        );
      })}
    </View>
  );
}

function IngredientGroupBody({
  items,
  theme,
  bold,
  checklist,
  rowPadV,
  nameFontSize,
  noteFontSize,
}: {
  items: IngredientGroup["items"];
  theme: ReturnType<typeof packTheme>;
  bold: boolean;
  checklist: boolean;
  rowPadV?: number;
  nameFontSize?: number;
  noteFontSize?: number;
}) {
  // Always single-column to mirror the web layout. Long recipes (16+
  // ingredients) still fit on one A4 page with the compact row spacing.
  return (
    <View>
      {items.map((ing, i) => (
        <IngredientRow
          key={`${ing.name}-${i}`}
          ing={ing}
          theme={theme}
          bold={bold}
          checklist={checklist}
          rowPadV={rowPadV}
          nameFontSize={nameFontSize}
          noteFontSize={noteFontSize}
        />
      ))}
    </View>
  );
}

function IngredientRow({
  ing,
  theme,
  bold,
  checklist,
  compact = false,
  rowPadV,
  nameFontSize,
  noteFontSize,
}: {
  ing: IngredientGroup["items"][number];
  theme: ReturnType<typeof packTheme>;
  bold: boolean;
  checklist: boolean;
  compact?: boolean;
  rowPadV?: number;
  nameFontSize?: number;
  noteFontSize?: number;
}) {
  // Density overrides take precedence; legacy `compact` boolean kept for
  // any callers that haven't migrated yet. Werte hier so gewaehlt, dass
  // jede Row mindestens genug vertikalen Atemraum hat um einen 2-zeiligen
  // Notes-Text aufzunehmen ohne in die naechste Row zu rutschen — auch
  // bei compact density. Amount-Spalte 50 pt damit Werte wie "1 Prise",
  // "2-3 EL", "1 Pck" oder "100 ml" nicht selber wrappen und damit zwei
  // Zeilen erzwingen, die dann mit dem Note-Text der gleichen Row
  // kollidieren wuerden.
  const padV = rowPadV ?? (compact ? 3.5 : 4.5);
  const amountFont = compact ? 7.5 : 8;
  // amountW zurueck auf 46/54 — "nach Geschmack" darf bewusst auf zwei
  // Zeilen wrappen ("Nach \n Geschmack"), das sieht eleganter aus als
  // einzeilig durchgezogen. alignItems "flex-start" stellt sicher, dass
  // die Border-Bottom-Linie sauber unter dem ganzen Row liegt (nicht
  // zwischen "Nach" und "Geschmack").
  const amountW = compact ? 46 : 54;
  // Capitalize-First fuer text-only amounts ("nach Geschmack" -> "Nach
  // Geschmack", "etwas" -> "Etwas"). Numeric amounts ("1", "15 g") bleiben
  // unveraendert.
  const displayAmount = ing.amount
    ? ing.amount.charAt(0).toUpperCase() + ing.amount.slice(1)
    : ing.amount;
  const nameFont = nameFontSize ?? (compact ? 9 : 9.5);
  const noteFont = noteFontSize ?? (compact ? 7 : 7.5);
  // Name + Note werden in EINEM Text-Element gerendert mit nested
  // <Text> fuer die italic Note. Vorher waren das zwei separate
  // <Text>-Elemente in einer flex-View — @react-pdf hat die Hoehe der
  // Inner-View dann nicht zuverlaessig berechnet, was zur sichtbaren
  // Ueberlappung von Name und Note fuehrte (bei Pack 3 Zimt-Streuseltaler
  // lagen "Pflaumen" und "oder Obst nach Wahl" auf derselben Zeile).
  // Mit dem nested Text + erzwungenem \n rendert @react-pdf den Note
  // verlaesslich auf einer neuen Zeile innerhalb desselben Text-Blocks
  // und reserviert die Hoehe korrekt.
  return (
    <View
      style={{
        flexDirection: "row",
        borderBottomWidth: 0.5,
        borderBottomColor: withAlpha(theme.ink, 0.08),
        paddingVertical: padV,
        gap: 5,
        alignItems: "flex-start",
      }}
    >
      <Text
        style={{
          fontSize: amountFont,
          color: theme.inkSoft,
          width: amountW,
          fontWeight: bold ? 600 : 400,
          paddingTop: 1,
        }}
      >
        {displayAmount}
      </Text>
      <Text
        style={{
          flex: 1,
          fontSize: nameFont,
          lineHeight: 1.3,
          color: theme.ink,
          fontWeight: bold ? 600 : 400,
        }}
      >
        {checklist ? (
          <Text style={{ color: theme.inkSubtle }}>☐ </Text>
        ) : null}
        {ing.name}
        {ing.note ? (
          <Text
            style={{
              fontSize: noteFont,
              fontStyle: "italic",
              color: theme.inkSoft,
              fontWeight: 400,
            }}
          >
            {"\n"}
            {ing.note}
          </Text>
        ) : null}
      </Text>
    </View>
  );
}

function StepsList({
  steps,
  theme,
  bold = false,
  checklist = false,
  stepMarginBottom = 8,
  stepFontSize = 9.5,
  stepNumFontSize = 18,
}: {
  steps: Recipe["steps"];
  theme: ReturnType<typeof packTheme>;
  bold?: boolean;
  checklist?: boolean;
  stepMarginBottom?: number;
  stepFontSize?: number;
  stepNumFontSize?: number;
}) {
  const groups = groupSteps(steps);
  return (
    <View style={{ marginTop: 8 }}>
      {groups.map((group, gIdx) => (
        <View key={`g-${gIdx}`}>
          {group.name ? (
            <Text
              style={{
                fontFamily: "Inter",
                fontSize: 8,
                fontWeight: 600,
                letterSpacing: 1.4,
                color: theme.accent,
                textTransform: "uppercase",
                marginTop: gIdx > 0 ? 6 : 0,
                marginBottom: 5,
              }}
            >
              {group.name}
            </Text>
          ) : null}
          {group.items.map((item) => (
            <View
              key={item.index}
              style={{
                flexDirection: "row",
                // Mehr Vertikal-Abstand zwischen den Steps, damit jeder
                // Step optisch "atmet" und die Number-Glyph nicht von der
                // naechsten Step-Zeile bedraengt wirkt. User-Feedback war:
                // "lass zwischen den Zahlen mehr Platz".
                marginBottom: stepMarginBottom + 4,
                gap: 10,
                alignItems: "flex-start",
              }}
            >
              {/* Number rendert in DERSELBEN Font wie der Body-Text (Inter),
                  nur Italic + Bold + Akzent-Farbe fuer visuelle Prominenz.
                  Damit sind die Glyph-Metriken (Cap-Height, x-Height,
                  Baseline-Position innerhalb der Line-Box) IDENTISCH zur
                  Body-Text-Spalte — und Yoga aligned beide Baselines
                  garantiert auf derselben Y-Linie. Vorher in Fraunces:
                  Fraunces-Italic-Numerals und Inter-Regular-Letters haben
                  unterschiedliche Y-Position innerhalb der gleich hohen
                  Box, was zu sichtbarem Offset gefuehrt hat. */}
              <Text
                style={{
                  fontSize: stepFontSize,
                  fontStyle: "italic",
                  fontWeight: 700,
                  color: theme.accent,
                  width: 22,
                  lineHeight: 1.45,
                }}
              >
                {item.index + 1}
              </Text>
              <Text
                style={{
                  flex: 1,
                  fontSize: stepFontSize,
                  lineHeight: 1.45,
                  color: theme.ink,
                }}
              >
                {checklist ? (
                  <Text style={{ color: theme.inkSubtle }}>☐ </Text>
                ) : null}
                {item.text}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function PortionTile({
  label,
  value,
  sub,
  theme,
  highlight = false,
  borderRight = false,
  accentLabel = false,
  compact = false,
}: {
  label: string;
  value: string;
  sub: string;
  theme: ReturnType<typeof packTheme>;
  highlight?: boolean;
  borderRight?: boolean;
  accentLabel?: boolean;
  compact?: boolean;
}) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        paddingVertical: compact ? 12 : 16,
        paddingHorizontal: 6,
        backgroundColor: highlight ? blendWithWhite(theme.bg, 0.65) : "transparent",
        borderRightWidth: borderRight ? 1 : 0,
        borderRightColor: theme.divider,
      }}
    >
      <Text
        style={{
          fontSize: 6.5,
          fontWeight: 600,
          letterSpacing: 1.6,
          color: accentLabel ? theme.accent : theme.inkSoft,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: "Fraunces",
          fontSize: 22,
          color: theme.ink,
          marginTop: 2,
          lineHeight: 1,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          fontSize: 7.5,
          color: theme.inkSoft,
          marginTop: 2,
          textAlign: "center",
        }}
      >
        {sub}
      </Text>
    </View>
  );
}

function SectionHeader({
  label,
  right,
  theme,
  bold = false,
  italic = false,
}: {
  label: string;
  right?: string;
  theme: ReturnType<typeof packTheme>;
  bold?: boolean;
  italic?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
        borderBottomWidth: 1,
        borderBottomColor: withAlpha(theme.ink, 0.15),
        paddingBottom: 3,
      }}
    >
      <Text
        style={{
          fontSize: 8.5,
          fontWeight: bold ? 700 : 600,
          letterSpacing: 1.8,
          color: theme.accent,
          textTransform: "uppercase",
          fontFamily: italic ? "Fraunces" : "Inter",
          fontStyle: italic ? "italic" : "normal",
        }}
      >
        {label}
      </Text>
      {right ? (
        <Text
          style={{
            fontSize: 7,
            fontWeight: 500,
            letterSpacing: 1,
            color: theme.inkSoft,
            textTransform: "uppercase",
          }}
        >
          {right}
        </Text>
      ) : null}
    </View>
  );
}

function MinStat({
  value,
  label,
  theme,
}: {
  value: string;
  label: string;
  theme: ReturnType<typeof packTheme>;
}) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={{ fontSize: 13, fontWeight: 700, color: theme.ink }}>
        {value}
      </Text>
      <Text
        style={{
          fontSize: 6.5,
          fontWeight: 600,
          letterSpacing: 1.2,
          color: theme.inkSoft,
          marginTop: 1,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function DashRow({
  label,
  value,
  theme,
  highlight = false,
  last = false,
}: {
  label: string;
  value: string;
  theme: ReturnType<typeof packTheme>;
  highlight?: boolean;
  last?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 10,
        paddingVertical: 6,
        gap: 8,
        backgroundColor: highlight
          ? blendWithWhite(theme.bg, 0.6)
          : "#ffffff",
        borderBottomWidth: last ? 0 : 0.5,
        borderBottomColor: theme.divider,
      }}
    >
      <Text
        style={{
          flex: 1,
          fontSize: highlight ? 9.5 : 9,
          color: highlight ? theme.ink : theme.inkSoft,
          fontWeight: highlight ? 600 : 400,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: highlight ? 9.5 : 9,
          fontWeight: highlight ? 700 : 600,
          color: theme.ink,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function CardFooter({
  brand,
  pack,
  recipe,
  theme,
  italic = false,
  microsPadTop,
  microsPadBottom,
  hideMicros = false,
  qrDataUri = null,
}: {
  brand: Brand;
  pack: Pack;
  recipe?: Recipe;
  theme: ReturnType<typeof packTheme>;
  italic?: boolean;
  microsPadTop?: number;
  microsPadBottom?: number;
  // Pack 5 (Editorial) renders the micros banner up top instead of in
  // the footer — set this to skip the default MicrosStrip rendering.
  hideMicros?: boolean;
  // Pre-rendered QR code (PNG data URI) for recipe.sourceUrl. When set,
  // the footer renders a 3-column layout with the QR on the right; when
  // null, falls back to the legacy 2-column text-only layout. Same for
  // every layout — patisserie/sport/dashboard/etc. all share this footer.
  qrDataUri?: string | null;
}) {
  // Layout choice: a recipe with a sourceUrl gets the QR variant (taller,
  // 3-column). A recipe without one keeps the original 2-column text band
  // — keeps the 3 curated recipes that have no sourceUrl from getting a
  // visual hole where the QR would sit. The MicrosStrip stays on top in
  // both cases.
  const hasQr = Boolean(qrDataUri);
  return (
    <>
      {hideMicros ? null : (
        <MicrosStrip
          recipe={recipe}
          theme={theme}
          padTop={microsPadTop}
          padBottom={microsPadBottom}
        />
      )}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          borderTopWidth: 1,
          borderTopColor: theme.divider,
          backgroundColor: "#ffffff",
          paddingHorizontal: 32,
          // Slightly taller when a QR is shown — 32 px QR + breathing
          // padding. Without QR we keep the historic 10 pt to match the
          // first 22 PDF builds shipped to the user.
          paddingVertical: hasQr ? 8 : 10,
          gap: 16,
        }}
        fixed
      >
        {/* brand.signature ("Deine Julia") + BeeIcon hier entfernt — kam
            auf jedem Recipe-Footer und war zusammen mit Cover + Outro
            "zu viel" (User-Feedback). Footer zeigt jetzt nur noch Brand-
            Handle + Pack-Title + ggf. QR-Stempel. */}
        <Text
          style={{
            flex: 1,
            fontSize: 7,
            fontWeight: 500,
            letterSpacing: 1.4,
            color: brand.tokens.inkMuted,
            textTransform: "uppercase",
            textAlign: "left",
          }}
        >
          {brand.handle} · {pack.title}
          {!hasQr && recipe?.sourceUrl
            ? `  ·  ${recipe.sourceLabel ?? "Original-Reel"}`
            : ""}
        </Text>

        {hasQr ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 7,
            }}
          >
            <View
              style={{
                alignItems: "flex-end",
                maxWidth: 70,
              }}
            >
              <Text
                style={{
                  fontFamily: "Fraunces",
                  fontStyle: "italic",
                  fontSize: 8.5,
                  color: brand.tokens.ink,
                  lineHeight: 1.15,
                  textAlign: "right",
                }}
              >
                {recipe?.sourceLabel ?? "Original-Reel"}
              </Text>
              <Text
                style={{
                  fontSize: 6,
                  fontWeight: 600,
                  letterSpacing: 1.2,
                  color: brand.tokens.inkMuted,
                  textTransform: "uppercase",
                  marginTop: 2,
                  textAlign: "right",
                }}
              >
                Scannen
              </Text>
            </View>
            <View
              style={{
                width: 32,
                height: 32,
                padding: 1.5,
                backgroundColor: "#ffffff",
                borderWidth: 0.5,
                borderColor: theme.divider,
                borderRadius: 3,
              }}
            >
              <Image
                src={qrDataUri as string}
                style={{ width: 29, height: 29 }}
              />
            </View>
          </View>
        ) : null}
      </View>
    </>
  );
}

// Compact micros band for the PDF — same place across all 5 layouts. Sits
// above the footer in normal flow. Hides if no micros yet. Density-aware
// padding lets layouts give the strip more breathing room (Patisserie
// compact mode in particular — long bake recipes had this band squashed).
function MicrosStrip({
  recipe,
  theme,
  padTop = 8,
  padBottom = 9,
}: {
  recipe?: Recipe;
  theme: ReturnType<typeof packTheme>;
  padTop?: number;
  padBottom?: number;
}) {
  const micros = recipe?.nutrition?.micros;
  if (!micros || micros.length === 0) return null;
  // Top 8 micros — keeps the strip to one wrapping row even on long recipes
  const top = [...micros]
    .sort((a, b) => (b.pctDaily ?? 0) - (a.pctDaily ?? 0))
    .slice(0, 8);

  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: withAlpha(theme.ink, 0.18),
        backgroundColor: blendWithWhite(theme.bg, 0.78),
        paddingHorizontal: 32,
        paddingTop: padTop,
        paddingBottom: padBottom,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 4,
        }}
      >
        <Text
          style={{
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: 1.6,
            color: theme.accent,
            textTransform: "uppercase",
          }}
        >
          Reich an
        </Text>
        <Text
          style={{
            fontSize: 6.5,
            letterSpacing: 1,
            color: theme.inkSoft,
            textTransform: "uppercase",
          }}
        >
          Mikronährstoffe pro Portion · % Tagesbedarf
        </Text>
      </View>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 6,
        }}
      >
        {top.map((m) => (
          <View
            key={m.name}
            style={{
              flexDirection: "row",
              alignItems: "baseline",
              borderWidth: 0.5,
              borderColor: withAlpha(theme.ink, 0.18),
              borderRadius: 999,
              paddingHorizontal: 7,
              paddingVertical: 2,
              backgroundColor: "#ffffff",
              gap: 4,
            }}
          >
            <Text style={{ fontSize: 8, color: theme.ink, fontWeight: 600 }}>
              {m.name}
            </Text>
            <Text style={{ fontSize: 7, color: theme.inkSoft }}>{m.amount}</Text>
            {m.pctDaily ? (
              <Text
                style={{
                  fontSize: 7,
                  fontWeight: 700,
                  color: theme.accent,
                  marginLeft: 2,
                }}
              >
                {m.pctDaily}%
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}
