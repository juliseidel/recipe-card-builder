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
  visibleMicros,
  type Recipe,
  type Micronutrient,
} from "@/lib/recipes";
import {
  groupIngredients,
  groupSteps,
  totalTime,
  pad2,
  portionsLabel,
  servingsCountLabel,
  type IngredientGroup,
} from "./helpers";
import { packTheme, withAlpha, blendWithWhite, PAGE_PADDING } from "./theme";
import { BeeIcon } from "./bee-icon";
import { formatIngredientAmount, isQualitativeAmount } from "@/lib/format-ingredient";

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
  vinyl: VinylPage,
  newspaper: NewspaperPage,
  constellation: ConstellationPage,
  restaurant: RestaurantPage,
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
    headerPadTop: 16,
    headerPadBottom: 10,
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
    microsPadBottom: 11,
  },
  balanced: {
    headerPadTop: 28,
    headerPadBottom: 22,
    titleFontSize: 28,
    subtitleFontSize: 12,
    bodyPadTop: 26,
    bodyPadBottom: 20,
    ingRowPadV: 4.5,
    ingFontSize: 9.5,
    ingNoteFontSize: 7,
    stepMarginBottom: 10,
    stepFontSize: 9.5,
    stepNumFontSize: 18,
    microsPadTop: 16,
    microsPadBottom: 18,
  },
  spacious: {
    headerPadTop: 34,
    headerPadBottom: 26,
    titleFontSize: 32,
    subtitleFontSize: 13,
    bodyPadTop: 32,
    bodyPadBottom: 26,
    ingRowPadV: 6,
    ingFontSize: 10,
    ingNoteFontSize: 7.5,
    stepMarginBottom: 12,
    stepFontSize: 10,
    stepNumFontSize: 20,
    microsPadTop: 20,
    microsPadBottom: 22,
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
  // Editorial-spezifischer Density-Cap: spacious kann den Body wegen
  // der grosszuegigen Header/Mikros/Stats/Story-Paddings ueberlaufen
  // (auch bei moderat komplexen Recipes mit 8 Zutaten + 3 Schritten).
  // Wenn React-PDF overflowt, erzeugt es eine leere Page zwischen
  // diesem Recipe und dem naechsten. Daher cap auf "balanced" max.
  const rawDensity = getDensity(recipe);
  const density = rawDensity === "spacious" ? "balanced" : rawDensity;
  const d = EDITORIAL_DENSITY[density];
  // Adaptive Title-FontSize bei langen Titles (analog Patisserie). Plus
  // softWrapTitle damit Bindestriche ("Parmesan-Chicken-Sticks") als
  // wrap-Punkt funktionieren und der Title nicht hinten abgeschnitten
  // wird.
  const titleLen = recipe.title.length;
  const titleFontSize =
    titleLen <= 14
      ? d.titleFontSize
      : titleLen <= 19
        ? Math.max(d.titleFontSize - 2, 20)
        : titleLen <= 25
          ? Math.max(d.titleFontSize - 5, 18)
          : titleLen <= 32
            ? Math.max(d.titleFontSize - 8, 16)
            : Math.max(d.titleFontSize - 10, 14);
  const titleDisplay = softWrapTitle(recipe.title);

  return (
    <Page
      size="A4"
      style={{ backgroundColor: "#ffffff", fontFamily: "Inter", color: t.ink }}
    >
      {/* TOP MARKER BAR — kompakt. Nur Pack-Title + Recipe-Position.
          Pack-Tagline wurde entfernt: bei Custom-Packs ist die tagline
          oft sehr lang (z.B. "Probiere 'X', 'Y', 'Z' und mehr") und
          ueberlappte mit dem Pack-Title. Recipe-Position dafuer rechts
          (analog zu Vital/Amber), als Navigation-Anker. */}
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
            fontWeight: 600,
            letterSpacing: 1.4,
            color: t.inkSoft,
          }}
        >
          {pad2(recipe.number)} / {pad2(totalRecipes)}
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
                fontSize: titleFontSize,
                lineHeight: 1.02,
                letterSpacing: -0.3,
                color: t.ink,
                textTransform: "uppercase",
              }}
            >
              {titleDisplay}
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
      <EditorialMicrosBanner recipe={recipe} theme={t} density={density} />

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

      {/* BIENES STORY — pull-quote with «»-quotes, honey-tinted.
          Density-aware padding: bei compact reduzieren wir den Block
          damit lange Recipes auf eine Seite passen. */}
      {recipe.description ? (
        <View
          style={{
            paddingHorizontal: 32,
            paddingTop: density === "compact" ? 10 : 18,
            paddingBottom: density === "compact" ? 12 : 22,
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
              marginBottom: density === "compact" ? 5 : 8,
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
  density = "balanced",
}: {
  recipe: Recipe;
  theme: ReturnType<typeof packTheme>;
  density?: Density;
}) {
  const micros = visibleMicros(recipe);
  if (!micros || micros.length === 0) return null;
  const top = [...micros]
    .sort((a, b) => (b.pctDaily ?? 0) - (a.pctDaily ?? 0))
    .slice(0, 6);
  // Density-aware padding: bei compact (lange Recipes wie Tikka Masala
  // mit 12+8 ingredients/steps) reduzieren wir die Mikros-Banner-Hoehe
  // damit das ganze Recipe sauber auf eine Seite passt.
  const isCompact = density === "compact";
  const padTop = isCompact ? 9 : 16;
  const padBottom = isCompact ? 11 : 20;
  const headerMb = isCompact ? 7 : 12;

  return (
    <View
      style={{
        paddingHorizontal: 32,
        paddingTop: padTop,
        paddingBottom: padBottom,
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
          marginBottom: headerMb,
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
          Mikronährstoffe {nutritionBasisInline(recipe?.nutritionBasis)} · % Tagesbedarf
        </Text>
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
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
                {/* brand.signature ("Deine Julia") + BeeIcon entfernt —
                    User-Feedback, kam an zu vielen Stellen vor. Avatar
                    links + Handle/Pack-Caption reichen. */}
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
  // Singular + Plural-Label basis-aware (nicht mehr nur servings-basiert).
  // Vorher waren Spec-Strip ("KCAL PRO STÜCK · 8 STÜCKE") und Subtitle
  // ("190 kcal pro Portion") inkonsistent — der Strip nutzte
  // servings-based "Stück", der Subtitle-Text "Portion". Jetzt folgt
  // alles dem nutritionBasis-Feld: bei basis="portion" steht ueberall
  // "Portion", bei basis="piece" ueberall "Stück".
  const basis = recipe.nutritionBasis ?? "portion";
  const stueckSing =
    basis === "piece"
      ? "Stück"
      : basis === "per100g"
        ? "100 g"
        : basis === "total"
          ? "gesamt"
          : "Portion";
  const pl =
    basis === "piece"
      ? recipe.servings === 1
        ? "Stück"
        : "Stücke"
      : basis === "per100g"
        ? "100 g"
        : basis === "total"
          ? "gesamt"
          : recipe.servings === 1
            ? "Portion"
            : "Portionen";
  // Bei vielen Steps (>=6) override auf compact-density UND zusaetzlich
  // enger (kleinerer stepMarginBottom + stepFontSize). Sonst ueberlaufen
  // lange Step-Texte den Body-Slot und ueberlappen sich. Loaded Süßkartoffel
  // (6 Schritte mit teils 3-4 Zeilen Text) war genau dieser Worst-Case.
  const baseDensity = getDensity(recipe);
  const stepCount = recipe.steps?.length ?? 0;
  const density = stepCount >= 6 ? "compact" : baseDensity;
  const dBase = MINIMAL_DENSITY[density];
  const d =
    stepCount >= 6
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
// recipe.tweaks.densityOverride wins over the score when the user has
// manually picked a density in the editor.
export function getDensity(recipe: Recipe): Density {
  if (recipe.tweaks?.densityOverride) {
    return recipe.tweaks.densityOverride;
  }
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
// recipe.tweaks.hideStory always forces the block off when the user has
// explicitly hidden it in the editor.
export function shouldShowStory(recipe: Recipe): boolean {
  if (recipe.tweaks?.hideStory) return false;
  return (
    recipe.ingredients.length <= 10 && Boolean(recipe.description?.trim())
  );
}

// Single source-of-truth for the title-scale tweak. Renderers add this to
// their density-based titleFontSize before drawing. Range: -2..+2 pt.
export function titleFontSizeOffset(recipe: Recipe): number {
  return recipe.tweaks?.titleScale ?? 0;
}

// Whether the layout-specific micros block (Wine Notes, Planet Column,
// Audio-Spec-Strip, Newspaper-Spreadsheet-Row, etc.) should be drawn at
// all. Returns true by default; tweaks.hideMicros forces it off.
export function shouldShowMicros(recipe: Recipe): boolean {
  return !recipe.tweaks?.hideMicros;
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
                  {formatIngredientAmount(ing.amount)}
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

  const micros = visibleMicros(recipe).slice(0, 8);

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
                    {formatIngredientAmount(ing.amount) || "Nach Geschmack"}
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
          {/* brand.signature ("Deine Julia") + BeeIcon entfernt —
              User-Feedback, kam an zu vielen Stellen vor. */}
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
    heroHeight: 100,
    heroPadding: 5,
    titleFontSize: 22,
    subtitleFontSize: 10.5,
    titleBlockPadding: 8,
    statRibbonPadV: 9,
    statBigSize: 19,
    statRibbonGap: 12,
    bodyGap: 10,
    ingRowPadV: 2,
    ingFontSize: 8.5,
    ingNoteFontSize: 6.5,
    stepFontSize: 8.5,
    stepGap: 4,
    microRowPadV: 1.5,
    microFontSize: 8,
  },
  balanced: {
    heroHeight: 124,
    heroPadding: 6,
    titleFontSize: 26,
    subtitleFontSize: 11.5,
    titleBlockPadding: 10,
    statRibbonPadV: 11,
    statBigSize: 22,
    statRibbonGap: 16,
    bodyGap: 14,
    ingRowPadV: 2.5,
    ingFontSize: 9,
    ingNoteFontSize: 7,
    stepFontSize: 9,
    stepGap: 6,
    microRowPadV: 2,
    microFontSize: 8.5,
  },
  spacious: {
    heroHeight: 138,
    heroPadding: 7,
    titleFontSize: 30,
    subtitleFontSize: 12,
    titleBlockPadding: 12,
    statRibbonPadV: 13,
    statBigSize: 24,
    statRibbonGap: 18,
    bodyGap: 16,
    ingRowPadV: 3,
    ingFontSize: 9.5,
    ingNoteFontSize: 7.5,
    stepFontSize: 9.5,
    stepGap: 7,
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
  const micros = visibleMicros(recipe).slice(0, 6);

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

      {/* STAT-RIBBON — typografisch, ohne Boxes. marginTop fuer Luft zwischen
          Title und Makros (sonst kleben sie aufeinander). */}
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
          marginTop: Math.round(d.bodyGap * 0.5),
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
          grosszuegigen Hero halbleer. Matche das Web-Amber-Pattern.
          Paddings bewusst tight gehalten — sonst frisst die Story-Box
          den Body-Space bei mittel-langen Rezepten. */}
      {shouldShowStory(recipe) ? (
        <View
          style={{
            paddingHorizontal: 14,
            paddingTop: 9,
            paddingBottom: 10,
            marginBottom: 6,
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
              marginBottom: 4,
            }}
          >
            {`${brand.name}s Story`}
          </Text>
          <Text
            style={{
              fontFamily: "Fraunces",
              fontStyle: "italic",
              fontSize: 11,
              lineHeight: 1.45,
              color: t.ink,
              textAlign: "center",
              maxWidth: 440,
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
              {group.items.map((ing, ii) => {
                const amountDisplay =
                  formatIngredientAmount(ing.amount) || "Nach Geschmack";
                const amountQualitative = isQualitativeAmount(amountDisplay);
                return (
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
                        fontFamily: amountQualitative ? "Fraunces" : "Inter",
                        fontSize: amountQualitative
                          ? d.ingFontSize - 1.5
                          : d.ingFontSize,
                        fontStyle: amountQualitative ? "italic" : "normal",
                        fontWeight: amountQualitative ? 400 : 600,
                        color: amountQualitative ? t.inkSoft : t.accent,
                        letterSpacing: amountQualitative ? 0 : 0.2,
                      }}
                    >
                      {amountDisplay}
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
                );
              })}
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
            {/* brand.signature ("Deine Julia") + BeeIcon entfernt — kam
                an zu vielen Stellen vor (User-Feedback, generisch).
                Avatar links + Handle/Pack-Caption reichen als Footer. */}
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
  const amountW = compact ? 46 : 54;
  // formatIngredientAmount: "n. A." → "Nach Geschmack", plus
  // Capitalize-First. Konsistent ueber alle 8 Layouts + Web.
  const displayAmount = formatIngredientAmount(ing.amount);
  // Lange Amounts wie "Nach Geschmack" passen bei voller Schriftgroesse
  // nicht in die schmale Amount-Spalte (46-54 pt) und wrappen auf zwei
  // Zeilen ("Nach" / "Geschmack") — das sah unsauber aus (User-Feedback
  // Curly Fries Salat). Gegenmassnahme: lange Amounts rendern eine Stufe
  // kleiner, dann bleibt "Nach Geschmack" einzeilig. Falls ein Amount
  // trotzdem wrappt (selten, z.B. "Saft einer halben"), zentriert
  // alignItems "center" den Namen vertikal zwischen den beiden Zeilen.
  const amountIsLong = Boolean(displayAmount) && displayAmount.length > 10;
  const amountFont = amountIsLong
    ? compact
      ? 6.5
      : 7
    : compact
      ? 7.5
      : 8;
  const rowAlign: "center" | "flex-start" = amountIsLong
    ? "center"
    : "flex-start";
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
        alignItems: rowAlign,
      }}
    >
      <Text
        style={{
          fontSize: amountFont,
          color: theme.inkSoft,
          width: amountW,
          fontWeight: bold ? 600 : 400,
          paddingTop: amountIsLong ? 0 : 1,
          lineHeight: amountIsLong ? 1.3 : undefined,
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
        paddingVertical: compact ? 14 : 22,
        paddingHorizontal: 8,
        gap: compact ? 3 : 5,
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
          lineHeight: 1,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          fontSize: 7.5,
          color: theme.inkSoft,
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
          Mikronährstoffe {nutritionBasisInline(recipe?.nutritionBasis)} · % Tagesbedarf
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

// ═════════════════════════════════════════════════════════════════════════════
// LAYOUT 8 (Phase C, neu): VINYL — 12"-Schallplatte
// ═════════════════════════════════════════════════════════════════════════════
// Komplett neue Design-Sprache (Musik / Audio-Engineering). Konzept:
//
//   ┌─────────────────────────────────────────────────────┐
//   │  PACK-TITLE · 03/07                                 │  Header
//   ├─────────────────────────────────────────────────────┤
//   │           ╭───────────────────╮                     │
//   │          ╱ ┌─────┐    ╲                              │  Vinyl-Disc:
//   │         │ │HERO │     │                              │  schwarz mit
//   │         │ │     │     │                              │  Grooves, Hero
//   │          ╲ └─────┘    ╱                              │  als Center-
//   │           ╰───────────╯                             │  Label
//   │            "RECIPE TITLE"                             │
//   │  ╔═══╗ 245 KCAL │ 12 MIN │ HIGH-PROTEIN              │  Audio-Spec
//   │  Top-Mikros: ZINK 18% │ EISEN 22% │ KALIUM 30%        │
//   ├─────────────────────────────────────────────────────┤
//   │  SIDE A              │  SIDE B                       │  Steps als
//   │  ─────────           │  ─────────                    │  Tracklist
//   │  A1   Anbraten…      │  B1   Mischen…                │
//   │  A2   Würzen…        │  B2   Backen…                 │
//   │  A3   Ofen vorheiz…  │  B3   Anrichten…              │
//   ├─────────────────────────────────────────────────────┤
//   │  LINER NOTES · INGREDIENTS                            │  Ingredients
//   │  200 g  Quark           1 TL  Salz                    │  in 2 Spalten
//   │  100 g  Skyr            1 TL  Pfeffer                 │
//   │  …                                                     │
//   ├─────────────────────────────────────────────────────┤
//   │  ⊙  Pressed by Biene · @bienesfitlife                │  Footer
//   └─────────────────────────────────────────────────────┘
//
// Mikronaehrstoffe in EIGENER Position: als Audio-Spec-Stats direkt unter
// dem Title (vs. amber=vertikale-Bars, editorial=oben-Banner, vital=Pearl-
// Strip, minimal=Capsule-Pills). Keine Ueberlappung mit existierenden 7.
//
// Anti-Patterns alle adressiert (siehe docs/LAYOUT_RULES.md):
//   - Step-Number (A1/A2…) identische font/fontSize/lineHeight wie Body
//   - Density-System: discSize + 8 weitere Werte skalieren
//   - Sparse-Detection: ≤10 Zutaten → "Liner Notes"-Story-Block
//   - IngredientRow adaptive bei langem amount
//   - Top-aligned, "Für" nur bei den/die/das
//   - brand.name dynamisch
//   - softWrapTitle fuer Compound-Substantive

const VINYL_DENSITY: Record<
  Density,
  {
    /** Quadratisches Album-Cover (Hero-Bild). LP-Disc hat denselben Diameter
     *  und steht halb rechts heraus. */
    albumSize: number;
    /** Radius des LP-Center-Labels (mood-accent-Scheibe mit Brand-Name). */
    labelRadius: number;
    titleFontSize: number;
    audioSpecFontSize: number;
    trackFontSize: number;
    trackMarginBottom: number;
    ingredientFontSize: number;
    ingredientRowPadV: number;
    ingredientNoteFontSize: number;
    sectionLabelFontSize: number;
    sectionGap: number;
  }
> = {
  compact: {
    albumSize: 175,
    labelRadius: 32,
    titleFontSize: 22,
    audioSpecFontSize: 8.5,
    trackFontSize: 9,
    trackMarginBottom: 5,
    ingredientFontSize: 9,
    ingredientRowPadV: 2.5,
    ingredientNoteFontSize: 6.5,
    sectionLabelFontSize: 7.5,
    sectionGap: 10,
  },
  balanced: {
    albumSize: 210,
    labelRadius: 38,
    titleFontSize: 28,
    audioSpecFontSize: 9.5,
    trackFontSize: 9.5,
    trackMarginBottom: 8,
    ingredientFontSize: 9.5,
    ingredientRowPadV: 4,
    ingredientNoteFontSize: 7,
    sectionLabelFontSize: 8,
    sectionGap: 14,
  },
  spacious: {
    albumSize: 240,
    labelRadius: 44,
    titleFontSize: 32,
    audioSpecFontSize: 10,
    trackFontSize: 10,
    trackMarginBottom: 10,
    ingredientFontSize: 10,
    ingredientRowPadV: 5.5,
    ingredientNoteFontSize: 7.5,
    sectionLabelFontSize: 8.5,
    sectionGap: 18,
  },
};
function vinylAudioKey(recipe: Recipe): string {
  const tags = (recipe.tags ?? []).map((t) => t.toLowerCase());
  if (tags.some((t) => t.includes("vegan"))) return "VEGAN";
  if (tags.some((t) => t.includes("high-protein") || t.includes("protein")))
    return "HIGH-PROTEIN";
  if (tags.some((t) => t.includes("low-carb"))) return "LOW-CARB";
  if (tags.some((t) => t.includes("vegetarisch"))) return "VEGETARISCH";
  if (tags.some((t) => t.includes("dessert") || t.includes("kuchen")))
    return "SÜSS";
  if (tags.some((t) => t.includes("snack"))) return "SNACK";
  if (tags.some((t) => t.includes("mealprep"))) return "MEALPREP";
  return "ORIGINAL";
}

function VinylPage({
  brand,
  pack,
  recipe,
  totalRecipes,
  heroDataUri,
  qrDataUri,
  hideRecipeIndex,
}: RecipeCardPdfProps) {
  const theme = packTheme(pack);
  const density = getDensity(recipe);
  const D = VINYL_DENSITY[density];
  const showStory = shouldShowStory(recipe);
  const recipePosition = recipe.number;

  // Steps mit A1/A2/B1/B2-Labels durchsequenzieren (Tracklist-Style)
  const stepGroups = groupSteps(recipe.steps);
  const flatSteps: { label: string; text: string }[] = [];
  let runningIndex = 0;
  for (const group of stepGroups) {
    for (const item of group.items) {
      const half = Math.ceil(recipe.steps.length / 2);
      const sidePrefix = runningIndex < half ? "A" : "B";
      const sideIdx =
        sidePrefix === "A" ? runningIndex + 1 : runningIndex - half + 1;
      flatSteps.push({ label: `${sidePrefix}${sideIdx}`, text: item.text });
      runningIndex += 1;
    }
  }
  const sideASize = Math.ceil(flatSteps.length / 2);
  const sideA = flatSteps.slice(0, sideASize);
  const sideB = flatSteps.slice(sideASize);

  // Ingredients
  const ingredientGroups = groupIngredients(recipe.ingredients);
  const flatIngredients = ingredientGroups.flatMap((g) => g.items);
  const halfIngs = Math.ceil(flatIngredients.length / 2);

  // Audio-Spec
  const time = totalTime(recipe);
  const audioKey = vinylAudioKey(recipe);
  const topMicros = visibleMicros(recipe)
    .slice()
    .sort(
      (a: Micronutrient, b: Micronutrient) =>
        (b.pctDaily ?? 0) - (a.pctDaily ?? 0)
    )
    .slice(0, 3);

  const titleSafe = softWrapTitle(recipe.title);

  // Album-Sleeve: Hero quadratisch + LP halb-rausgezogen rechts
  const albumSize = D.albumSize;
  const lpRadius = albumSize / 2;
  // LP-Disc-Position: 50% rausgezogen (links überlappt Hero, rechts steht raus)
  const lpOffsetLeft = albumSize - lpRadius;

  return (
    <Page
      size="A4"
      style={{ backgroundColor: theme.bg, fontFamily: "Inter", color: theme.ink }}
    >
      {/* ── Header ── */}
      <View
        style={{
          paddingHorizontal: PAGE_PADDING,
          paddingTop: density === "compact" ? 14 : 20,
          paddingBottom: 8,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text
          style={{
            fontFamily: "Inter",
            fontSize: 8.5,
            fontWeight: 700,
            letterSpacing: 2,
            color: theme.accent,
            textTransform: "uppercase",
          }}
        >
          {pack.title}
        </Text>
        {!hideRecipeIndex ? (
          <Text
            style={{
              fontFamily: "Inter",
              fontSize: 8.5,
              fontWeight: 600,
              letterSpacing: 1.6,
              color: theme.inkSoft,
            }}
          >
            {pad2(recipePosition)} / {pad2(totalRecipes)}
          </Text>
        ) : null}
      </View>

      {/* ── Album-Sleeve: Hero gross + LP halb-rausgezogen ── */}
      <View
        style={{
          alignItems: "center",
          paddingHorizontal: PAGE_PADDING,
          paddingTop: density === "compact" ? 6 : 12,
        }}
      >
        <View
          style={{
            width: albumSize + lpOffsetLeft,
            height: albumSize,
            position: "relative",
          }}
        >
          {/* Vinyl-Disc rechts (z-index: hinter Hero, rechts halb sichtbar) */}
          <View
            style={{
              position: "absolute",
              top: 0,
              left: albumSize - 16,
              width: albumSize,
              height: albumSize,
              backgroundColor: "#0a0a0a",
              borderRadius: albumSize / 2,
            }}
          />
          {/* Grooves */}
          <Svg
            style={{
              position: "absolute",
              top: 0,
              left: albumSize - 16,
            }}
            width={albumSize}
            height={albumSize}
          >
            {Array.from({ length: 8 }, (_, i) => {
              const r = (albumSize / 2) - 8 - i * 10;
              if (r <= D.labelRadius) return null;
              return (
                <Circle
                  key={i}
                  cx={albumSize / 2}
                  cy={albumSize / 2}
                  r={r}
                  fill="none"
                  stroke={i % 3 === 0 ? "#1f1f1f" : "#141414"}
                  strokeWidth={0.5}
                />
              );
            })}
            {/* Reflection-Highlight */}
            <Path
              d={`M ${albumSize * 0.62} ${albumSize * 0.2}
                  A ${albumSize * 0.4} ${albumSize * 0.4} 0 0 1
                  ${albumSize * 0.78} ${albumSize * 0.32}`}
              stroke="#2a2a2a"
              strokeWidth={1}
              fill="none"
            />
          </Svg>
          {/* LP Center-Label */}
          <View
            style={{
              position: "absolute",
              top: albumSize / 2 - D.labelRadius,
              left: albumSize - 16 + albumSize / 2 - D.labelRadius,
              width: D.labelRadius * 2,
              height: D.labelRadius * 2,
              backgroundColor: theme.accent,
              borderRadius: D.labelRadius,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontFamily: "Fraunces",
                fontSize: D.labelRadius * 0.32,
                fontWeight: 700,
                color: "#fafafa",
                textAlign: "center",
                paddingHorizontal: 4,
                lineHeight: 1.0,
              }}
            >
              {brand.name.toUpperCase()}
            </Text>
            <Text
              style={{
                fontFamily: "Inter",
                fontSize: D.labelRadius * 0.16,
                letterSpacing: 1.2,
                color: "#fafafa",
                marginTop: 4,
                opacity: 0.85,
              }}
            >
              {pad2(recipePosition)} · SEITE A
            </Text>
          </View>
          {/* Spindle hole */}
          <View
            style={{
              position: "absolute",
              top: albumSize / 2 - 3,
              left: albumSize - 16 + albumSize / 2 - 3,
              width: 6,
              height: 6,
              backgroundColor: "#fafafa",
              borderRadius: 3,
            }}
          />

          {/* Album-Cover (Hero) LINKS — ueberlappt die LP teilweise */}
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: albumSize,
              height: albumSize,
              borderRadius: 2,
              overflow: "hidden",
              backgroundColor: theme.paper,
            }}
          >
            {heroDataUri ? (
              <Image
                src={heroDataUri}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <View
                style={{
                  width: "100%",
                  height: "100%",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: theme.accent,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Fraunces",
                    fontSize: 96,
                    fontWeight: 700,
                    color: "#fafafa",
                    opacity: 0.85,
                  }}
                >
                  {brand.name.charAt(0)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Recipe-Title */}
        <Text
          style={{
            fontFamily: "Fraunces",
            fontSize: D.titleFontSize,
            fontWeight: 700,
            color: theme.ink,
            textAlign: "center",
            marginTop: density === "compact" ? 14 : 20,
            marginBottom: 6,
            lineHeight: 1.1,
            maxWidth: 460,
          }}
        >
          {titleSafe}
        </Text>

        {/* Audio-Spec-Strip */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            marginTop: 2,
            paddingHorizontal: 24,
            flexWrap: "wrap",
          }}
        >
          <Text
            style={{
              fontFamily: "Inter",
              fontSize: D.audioSpecFontSize,
              fontWeight: 700,
              letterSpacing: 1.6,
              color: theme.ink,
              textTransform: "uppercase",
            }}
          >
            {Math.round(recipe.nutrition.kcal)} KCAL
          </Text>
          <Text
            style={{
              fontFamily: "Inter",
              fontSize: 9,
              color: theme.divider,
            }}
          >
            │
          </Text>
          <Text
            style={{
              fontFamily: "Inter",
              fontSize: D.audioSpecFontSize,
              fontWeight: 600,
              letterSpacing: 1.6,
              color: theme.inkSoft,
              textTransform: "uppercase",
            }}
          >
            {time} MIN
          </Text>
          <Text
            style={{
              fontFamily: "Inter",
              fontSize: 9,
              color: theme.divider,
            }}
          >
            │
          </Text>
          <Text
            style={{
              fontFamily: "Inter",
              fontSize: D.audioSpecFontSize,
              fontWeight: 700,
              letterSpacing: 1.6,
              color: theme.accent,
              textTransform: "uppercase",
            }}
          >
            {audioKey}
          </Text>
        </View>

        {/* Top-3 Mikros */}
        {topMicros.length > 0 ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 14,
              marginTop: 6,
              opacity: 0.85,
            }}
          >
            {topMicros.map((m: Micronutrient, i: number) => (
              <View
                key={`${m.name}-${i}`}
                style={{
                  flexDirection: "row",
                  alignItems: "baseline",
                  gap: 4,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Inter",
                    fontSize: D.audioSpecFontSize - 1,
                    fontWeight: 600,
                    letterSpacing: 1.2,
                    color: theme.accent,
                    textTransform: "uppercase",
                  }}
                >
                  {m.name}
                </Text>
                {typeof m.pctDaily === "number" ? (
                  <Text
                    style={{
                      fontFamily: "Inter",
                      fontSize: D.audioSpecFontSize - 1,
                      fontWeight: 700,
                      color: theme.ink,
                    }}
                  >
                    {m.pctDaily}%
                  </Text>
                ) : null}
                {i < topMicros.length - 1 ? (
                  <Text
                    style={{
                      fontFamily: "Inter",
                      fontSize: D.audioSpecFontSize - 1,
                      color: theme.divider,
                      marginLeft: 6,
                    }}
                  >
                    │
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
        <Text
          style={{
            fontFamily: "Inter",
            fontSize: 6.5,
            letterSpacing: 1.4,
            color: theme.inkSubtle,
            textTransform: "uppercase",
            marginTop: 4,
          }}
        >
          {nutritionBasisInline(recipe.nutritionBasis)}
        </Text>
      </View>

      {/* ── ZUTATEN (Liner Notes) ── */}
      <View
        style={{
          paddingHorizontal: PAGE_PADDING,
          marginTop: D.sectionGap + 4,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            marginBottom: 6,
          }}
        >
          <Text
            style={{
              fontFamily: "Inter",
              fontSize: D.sectionLabelFontSize,
              fontWeight: 700,
              letterSpacing: 2,
              color: theme.accent,
              textTransform: "uppercase",
            }}
          >
            Zutaten
          </Text>
          <View
            style={{ flex: 1, height: 0.5, backgroundColor: theme.divider }}
          />
          <Text
            style={{
              fontFamily: "Inter",
              fontSize: D.sectionLabelFontSize - 1,
              letterSpacing: 1.4,
              color: theme.inkSoft,
              textTransform: "uppercase",
            }}
          >
            {recipe.ingredients.length} {recipe.ingredients.length === 1 ? "Zutat" : "Zutaten"}
          </Text>
        </View>

        {ingredientGroups.length > 1 ? (
          <View>
            {ingredientGroups.map((group, gIdx) => (
              <View
                key={`g-${gIdx}`}
                style={{ marginTop: gIdx > 0 ? 6 : 0 }}
              >
                {group.name ? (
                  <Text
                    style={{
                      fontFamily: "Inter",
                      fontSize: 7.5,
                      fontWeight: 600,
                      letterSpacing: 1.4,
                      color: theme.inkSoft,
                      textTransform: "uppercase",
                      marginBottom: 3,
                    }}
                  >
                    {ingredientGroupLabel(group.name)}
                  </Text>
                ) : null}
                <VinylIngredientGrid
                  items={group.items}
                  theme={theme}
                  density={D}
                />
              </View>
            ))}
          </View>
        ) : (
          <View style={{ flexDirection: "row", gap: 16 }}>
            <View style={{ flex: 1 }}>
              {flatIngredients.slice(0, halfIngs).map((ing, i) => (
                <VinylIngredientRow
                  key={`la-${i}`}
                  amount={ing.amount}
                  name={ing.name}
                  note={ing.note}
                  theme={theme}
                  density={D}
                />
              ))}
            </View>
            <View style={{ flex: 1 }}>
              {flatIngredients.slice(halfIngs).map((ing, i) => (
                <VinylIngredientRow
                  key={`lb-${i}`}
                  amount={ing.amount}
                  name={ing.name}
                  note={ing.note}
                  theme={theme}
                  density={D}
                />
              ))}
            </View>
          </View>
        )}
      </View>

      {/* ── ZUBEREITUNG (Tracklist Seite A / Seite B) ── */}
      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: PAGE_PADDING,
          marginTop: D.sectionGap,
          gap: 20,
        }}
      >
        <VinylSideColumn
          sideLabel="Seite A"
          tracks={sideA}
          theme={theme}
          density={D}
        />
        <View
          style={{
            width: 0.5,
            backgroundColor: theme.divider,
            marginVertical: 4,
          }}
        />
        <VinylSideColumn
          sideLabel="Seite B"
          tracks={sideB.length > 0 ? sideB : [{ label: "—", text: "(nur Seite A)" }]}
          theme={theme}
          density={D}
          dimmedIfEmpty={sideB.length === 0}
        />
      </View>

      {/* ── Sparse-Story-Block ── */}
      {showStory ? (
        <View
          style={{
            paddingHorizontal: PAGE_PADDING,
            marginTop: D.sectionGap - 2,
          }}
        >
          <View
            style={{
              borderLeftWidth: 2,
              borderLeftColor: theme.accent,
              paddingLeft: 10,
              paddingVertical: 4,
            }}
          >
            <Text
              style={{
                fontFamily: "Fraunces",
                fontSize: 9.5,
                fontStyle: "italic",
                color: theme.ink,
                lineHeight: 1.4,
              }}
            >
              {recipe.description}
            </Text>
          </View>
        </View>
      ) : null}

      {/* ── Footer mit QR-Code ── */}
      <View
        style={{
          position: "absolute",
          left: PAGE_PADDING,
          right: PAGE_PADDING,
          bottom: 22,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: 8,
          gap: 12,
          borderTopWidth: 0.5,
          borderTopColor: theme.divider,
        }}
        fixed
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Svg width={14} height={14} viewBox="0 0 14 14">
            <Circle cx={7} cy={7} r={6.5} fill="#0a0a0a" />
            <Circle cx={7} cy={7} r={2.2} fill={theme.accent} />
            <Circle cx={7} cy={7} r={0.7} fill="#fff" />
          </Svg>
          <Text
            style={{
              fontFamily: "Inter",
              fontSize: 8,
              fontWeight: 600,
              letterSpacing: 1.4,
              color: theme.inkSoft,
              textTransform: "uppercase",
            }}
          >
            {brand.handle} · {pack.title}
          </Text>
        </View>
        {qrDataUri ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text
              style={{
                fontFamily: "Inter",
                fontSize: 7,
                letterSpacing: 1.2,
                color: theme.inkSubtle,
                textTransform: "uppercase",
                textAlign: "right",
              }}
            >
              Scan{"\n"}für{"\n"}Original
            </Text>
            <Image
              src={qrDataUri}
              style={{ width: 32, height: 32 }}
            />
          </View>
        ) : (
          <Text
            style={{
              fontFamily: "Inter",
              fontSize: 8,
              letterSpacing: 1.4,
              color: theme.inkSubtle,
              textTransform: "uppercase",
            }}
          >
            {recipe.sourceLabel ?? "Original auf Instagram"}
          </Text>
        )}
      </View>
    </Page>
  );
}

// ─── Vinyl-Sub-Components ────────────────────────────────────────────────

// Vinyl-Tracklist-Column mit Glyph-Center-Lock (LAYOUT_RULES.md §1)
function VinylSideColumn({
  sideLabel,
  tracks,
  theme,
  density,
  dimmedIfEmpty = false,
}: {
  sideLabel: string;
  tracks: { label: string; text: string }[];
  theme: ReturnType<typeof packTheme>;
  density: (typeof VINYL_DENSITY)["balanced"];
  dimmedIfEmpty?: boolean;
}) {
  return (
    <View style={{ flex: 1, opacity: dimmedIfEmpty ? 0.35 : 1 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginBottom: 6,
        }}
      >
        <Text
          style={{
            fontFamily: "Inter",
            fontSize: density.sectionLabelFontSize,
            fontWeight: 700,
            letterSpacing: 2,
            color: theme.accent,
            textTransform: "uppercase",
          }}
        >
          {sideLabel}
        </Text>
        <View style={{ flex: 1, height: 0.5, backgroundColor: theme.divider }} />
      </View>
      {tracks.map((track, i) => (
        <View
          key={`${sideLabel}-${i}`}
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 8,
            marginBottom: density.trackMarginBottom,
          }}
        >
          <Text
            style={{
              fontSize: density.trackFontSize,
              lineHeight: 1.45,
              fontStyle: "italic",
              fontWeight: 700,
              color: theme.accent,
              width: 22,
            }}
          >
            {track.label}
          </Text>
          <Text
            style={{
              flex: 1,
              fontSize: density.trackFontSize,
              lineHeight: 1.45,
              color: theme.ink,
            }}
          >
            {track.text}
          </Text>
        </View>
      ))}
    </View>
  );
}

function VinylIngredientRow({
  amount,
  name,
  note,
  theme,
  density,
}: {
  amount: string;
  name: string;
  note?: string;
  theme: ReturnType<typeof packTheme>;
  density: (typeof VINYL_DENSITY)["balanced"];
}) {
  const displayAmount = formatIngredientAmount(amount);
  const amountIsLong = displayAmount.length > 10;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: amountIsLong ? "center" : "flex-start",
        paddingVertical: density.ingredientRowPadV,
        borderBottomWidth: 0.4,
        borderBottomColor: theme.divider,
        gap: 8,
      }}
    >
      <Text
        style={{
          fontSize: density.ingredientFontSize,
          fontWeight: 700,
          color: theme.accent,
          width: 60,
          lineHeight: amountIsLong ? 1.3 : undefined,
          paddingTop: amountIsLong ? 0 : 1,
        }}
      >
        {displayAmount}
      </Text>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: density.ingredientFontSize,
            color: theme.ink,
            lineHeight: 1.3,
          }}
        >
          {name}
        </Text>
        {note ? (
          <Text
            style={{
              fontSize: density.ingredientNoteFontSize,
              color: theme.inkSubtle,
              fontStyle: "italic",
              marginTop: 1,
            }}
          >
            {note}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function VinylIngredientGrid({
  items,
  theme,
  density,
}: {
  items: IngredientGroup["items"];
  theme: ReturnType<typeof packTheme>;
  density: (typeof VINYL_DENSITY)["balanced"];
}) {
  const useColumns = items.length >= 3;
  if (!useColumns) {
    return (
      <View>
        {items.map((ing, i) => (
          <VinylIngredientRow
            key={`gi-${i}`}
            amount={ing.amount}
            name={ing.name}
            note={ing.note}
            theme={theme}
            density={density}
          />
        ))}
      </View>
    );
  }
  const half = Math.ceil(items.length / 2);
  return (
    <View style={{ flexDirection: "row", gap: 16 }}>
      <View style={{ flex: 1 }}>
        {items.slice(0, half).map((ing, i) => (
          <VinylIngredientRow
            key={`gia-${i}`}
            amount={ing.amount}
            name={ing.name}
            note={ing.note}
            theme={theme}
            density={density}
          />
        ))}
      </View>
      <View style={{ flex: 1 }}>
        {items.slice(half).map((ing, i) => (
          <VinylIngredientRow
            key={`gib-${i}`}
            amount={ing.amount}
            name={ing.name}
            note={ing.note}
            theme={theme}
            density={density}
          />
        ))}
      </View>
    </View>
  );
}

// "Fuer" nur bei den/die/das — LAYOUT_RULES.md §5
function ingredientGroupLabel(name: string): string {
  return /^(den|die|das)\s/i.test(name)
    ? `Für ${name.toLowerCase()}`
    : name;
}

// ═════════════════════════════════════════════════════════════════════════════
// LAYOUT 9 (Phase C): NEWSPAPER — Broadsheet-Editorial
// ═════════════════════════════════════════════════════════════════════════════
// Komplett andere Design-Sprache als alle anderen 8 Layouts. Konzept:
//
//   ┌────────────────────────────────────────────────────────────────┐
//   │  JULIA TIMES · DAS REZEPT-MAGAZIN · TASTE OF ITALY · No 02     │
//   │  ════════════════════════════════════════════════════════════  │
//   │                              │                                  │
//   │                              │  HAUPTGERICHT                    │
//   │       HERO-BILD              │                                  │
//   │       (55% width)            │  Pasta-Hits, die                 │  Italic Headline
//   │                              │  jeder kennt                     │  + Drop-Cap
//   │                              │                                  │
//   │                              │  Von Julia Breitenfeld           │  Byline
//   │                              │  ─────────                       │
//   │                              │                                  │
//   │  Bildunterschrift italic     │  D as ist eine cremige Pasta...  │  Lead mit Drop-Cap
//   │                              │                                  │
//   ├──────────────────────────────┴──────────────────────────────────┤
//   │  ZUTATEN                                       7 Zutaten        │
//   │  ─────────────────────────────────────────────────────────────  │
//   │  500 g  Magerquark   │  200 ml Creme Fine  │  1 EL  Ajvar       │  3-Col
//   │  150 g  Skyr         │  150 g  Frischkäse  │  1/2   Zitrone     │
//   ├──────────────────────────────────────────────────────────────────┤
//   │  ZUBEREITUNG                                                     │
//   │  ─────────────                                                   │
//   │  1  Magerquark, Schmand   │  3  Eine Schicht der Löffel-         │  2-Col Steps
//   │     und Creme verrühren.  │     biskuits in eine Form...         │
//   │  2  Die Mandarinen unter  │  4  Den Pudding gleichmäßig...       │
//   │     die Creme heben.      │                                      │
//   ├──────────────────────────────────────────────────────────────────┤
//   │  ═══════════════════════════════════════════════════════════     │
//   │  NÄHRWERTE PRO PORTION                                            │  Spreadsheet
//   │  KCAL  PROTEIN  KOHLENH  FETT  │  C 44%  B12 28%  Calcium 23%   │  Mikros HIER
//   │  ────  ───────  ───────  ────  │  ──────  ───────  ──────────   │  (anders als
//   │  300   23g      30g       10g  │                                 │  alle anderen)
//   ├──────────────────────────────────────────────────────────────────┤
//   │  @itsonlyme.julia · Taste of Italy                  [QR]         │  Footer
//   └────────────────────────────────────────────────────────────────┘
//
// Mikros in EIGENER Position vs allen anderen Layouts:
//   - vinyl: Audio-Spec-Strip oben
//   - editorial: Banner ueber dem Hero
//   - patisserie: Vertikale Liste in Sidebar
//   - vital: Pearl-Strip mittig
//   - amber: Vertikale Bars
//   - minimal: Capsule-Pills horizontal
//   - dashboard: Data-Rows mit Icons
//   - sport: Macro-Bars mit Emojis
//   - newspaper: Spreadsheet-Footer-Row mit Doppellinien
//
// Anti-Patterns aus LAYOUT_RULES.md alle adressiert.

const NEWSPAPER_DENSITY: Record<
  Density,
  {
    heroAspectRatio: number; // breite/hoehe — Hero im Magazine-Verhaeltnis
    headlineFontSize: number;
    eyebrowFontSize: number;
    bylineFontSize: number;
    leadFontSize: number;
    leadDropCapSize: number;
    ingredientFontSize: number;
    ingredientRowPadV: number;
    stepFontSize: number;
    stepMarginBottom: number;
    sectionLabelFontSize: number;
    macrosLabelFontSize: number;
    macrosValueFontSize: number;
    microsFontSize: number;
    topPadding: number;
    sectionGap: number;
  }
> = {
  compact: {
    heroAspectRatio: 16 / 9,
    headlineFontSize: 22,
    eyebrowFontSize: 7.5,
    bylineFontSize: 8.5,
    leadFontSize: 8.5,
    leadDropCapSize: 26,
    ingredientFontSize: 9,
    ingredientRowPadV: 2,
    stepFontSize: 9,
    stepMarginBottom: 4,
    sectionLabelFontSize: 8,
    macrosLabelFontSize: 6.5,
    macrosValueFontSize: 13,
    microsFontSize: 7,
    topPadding: 14,
    sectionGap: 10,
  },
  balanced: {
    heroAspectRatio: 3 / 2,
    headlineFontSize: 28,
    eyebrowFontSize: 8,
    bylineFontSize: 9.5,
    leadFontSize: 9.5,
    leadDropCapSize: 32,
    ingredientFontSize: 9.5,
    ingredientRowPadV: 3.5,
    stepFontSize: 9.5,
    stepMarginBottom: 7,
    sectionLabelFontSize: 8.5,
    macrosLabelFontSize: 7,
    macrosValueFontSize: 15,
    microsFontSize: 7.5,
    topPadding: 20,
    sectionGap: 14,
  },
  spacious: {
    heroAspectRatio: 3 / 2,
    headlineFontSize: 30,
    eyebrowFontSize: 8.5,
    bylineFontSize: 10,
    leadFontSize: 10,
    leadDropCapSize: 35,
    ingredientFontSize: 9.5,
    ingredientRowPadV: 4,
    stepFontSize: 9.5,
    stepMarginBottom: 8,
    sectionLabelFontSize: 9,
    macrosLabelFontSize: 7.5,
    macrosValueFontSize: 16,
    microsFontSize: 8,
    topPadding: 22,
    sectionGap: 16,
  },
};

function NewspaperPage({
  brand,
  pack,
  recipe,
  totalRecipes,
  heroDataUri,
  qrDataUri,
  hideRecipeIndex,
}: RecipeCardPdfProps) {
  const theme = packTheme(pack);
  const density = getDensity(recipe);
  const D = NEWSPAPER_DENSITY[density];
  const showStory = shouldShowStory(recipe);
  const recipePosition = recipe.number;
  const titleSafe = softWrapTitle(recipe.title);

  const ingredientGroups = groupIngredients(recipe.ingredients);
  const flatIngredients = ingredientGroups.flatMap((g) => g.items);

  const stepGroups = groupSteps(recipe.steps);
  const flatSteps: { num: number; text: string }[] = [];
  let runningStep = 0;
  for (const g of stepGroups) {
    for (const item of g.items) {
      runningStep += 1;
      flatSteps.push({ num: runningStep, text: item.text });
    }
  }

  // Top-3 Mikros nach %-EU-Bedarf sortiert
  const topMicros = visibleMicros(recipe)
    .slice()
    .sort(
      (a: Micronutrient, b: Micronutrient) =>
        (b.pctDaily ?? 0) - (a.pctDaily ?? 0)
    )
    .slice(0, 3);

  const time = totalTime(recipe);

  // Lead-Paragraph: Drop-Cap mit erstem Buchstaben vom description
  const leadText = recipe.description?.trim() ?? "";
  const leadFirstChar = leadText.charAt(0);
  const leadRest = leadText.slice(1);

  // Newspaper-Background: dezenter cream-tinted Off-White (typisch Print)
  const newspaperBg = "#fafaf5";

  return (
    <Page
      size="A4"
      style={{
        backgroundColor: newspaperBg,
        fontFamily: "Fraunces",
        color: theme.ink,
        flexDirection: "column",
      }}
    >
      {/* ── Masthead ── */}
      <View
        style={{
          paddingHorizontal: PAGE_PADDING,
          paddingTop: D.topPadding,
          paddingBottom: 6,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "baseline",
            justifyContent: "space-between",
            borderBottomWidth: 2,
            borderBottomColor: theme.ink,
            paddingBottom: 5,
          }}
        >
          <Text
            style={{
              fontFamily: "Fraunces",
              fontSize: 22,
              fontWeight: 700,
              fontStyle: "italic",
              color: theme.ink,
              letterSpacing: -0.3,
            }}
          >
            {brand.name} Times
          </Text>
          <Text
            style={{
              fontFamily: "Inter",
              fontSize: 7.5,
              color: theme.inkSoft,
              letterSpacing: 1.6,
              textTransform: "uppercase",
            }}
          >
            Das Rezept-Magazin · {pack.title}
            {hideRecipeIndex
              ? ""
              : ` · No ${pad2(recipePosition)} / ${pad2(totalRecipes)}`}
          </Text>
        </View>
        {/* Doppellinie unter Masthead (Newspaper-typisch) */}
        <View
          style={{
            height: 0.5,
            backgroundColor: theme.ink,
            marginTop: 2,
          }}
        />
      </View>

      {/* ── Top-Section: Hero + Headline mit Drop-Cap-Lead ── */}
      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: PAGE_PADDING,
          marginTop: 14,
          gap: 16,
        }}
      >
        {/* Hero — links (~55%) */}
        <View style={{ width: "55%" }}>
          <View
            style={{
              width: "100%",
              aspectRatio: D.heroAspectRatio,
              overflow: "hidden",
              backgroundColor: theme.paper,
            }}
          >
            {heroDataUri ? (
              <Image
                src={heroDataUri}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <View
                style={{
                  width: "100%",
                  height: "100%",
                  backgroundColor: theme.accent,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    fontFamily: "Fraunces",
                    fontSize: 72,
                    fontWeight: 700,
                    fontStyle: "italic",
                    color: "#fafafa",
                  }}
                >
                  {brand.name.charAt(0)}
                </Text>
              </View>
            )}
          </View>
          {/* Bildunterschrift italic (typisch Magazin) */}
          <Text
            style={{
              fontFamily: "Fraunces",
              fontSize: 7.5,
              fontStyle: "italic",
              color: theme.inkSoft,
              marginTop: 4,
              lineHeight: 1.35,
            }}
          >
            {recipe.subtitle ||
              `Eine Aufnahme aus ${brand.name}s Küche, exklusiv für dieses Pack.`}
          </Text>
        </View>

        {/* Rechte Spalte: Headline + Byline + Lead */}
        <View style={{ flex: 1, justifyContent: "flex-start" }}>
          {/* Eyebrow (Kategorie wie Section-Label) */}
          <Text
            style={{
              fontFamily: "Inter",
              fontSize: D.eyebrowFontSize,
              fontWeight: 700,
              letterSpacing: 2,
              color: theme.accent,
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            {pack.category}
          </Text>
          {/* Italic Headline mit großem Display-Look */}
          <Text
            style={{
              fontFamily: "Fraunces",
              fontSize: D.headlineFontSize,
              fontWeight: 700,
              fontStyle: "italic",
              color: theme.ink,
              lineHeight: 1.0,
              letterSpacing: -0.5,
              marginBottom: 8,
            }}
          >
            {titleSafe}
          </Text>
          {/* Byline + Rule */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginBottom: 10,
            }}
          >
            <Text
              style={{
                fontFamily: "Fraunces",
                fontSize: D.bylineFontSize,
                fontStyle: "italic",
                color: theme.inkSoft,
              }}
            >
              Von {brand.name}
            </Text>
            <View
              style={{ flex: 1, height: 0.5, backgroundColor: theme.divider }}
            />
            <Text
              style={{
                fontFamily: "Inter",
                fontSize: 7,
                letterSpacing: 1.4,
                color: theme.inkSoft,
                textTransform: "uppercase",
              }}
            >
              {time} Min
            </Text>
          </View>
          {/* Lead-Paragraph mit Drop-Cap */}
          {leadText.length > 0 ? (
            <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
              <Text
                style={{
                  fontFamily: "Fraunces",
                  fontSize: D.leadDropCapSize,
                  fontWeight: 700,
                  fontStyle: "italic",
                  color: theme.accent,
                  lineHeight: 0.85,
                  marginRight: 4,
                  marginTop: -2,
                  width: D.leadDropCapSize * 0.7,
                }}
              >
                {leadFirstChar}
              </Text>
              <Text
                style={{
                  flex: 1,
                  fontFamily: "Fraunces",
                  fontSize: D.leadFontSize,
                  color: theme.ink,
                  lineHeight: 1.45,
                  textAlign: "justify",
                }}
              >
                {leadRest}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* ── Zutaten-Section ── */}
      <View
        style={{
          paddingHorizontal: PAGE_PADDING,
          marginTop: D.sectionGap,
        }}
      >
        <NewspaperSectionHeader
          label="Zutaten"
          right={`${recipe.ingredients.length} ${recipe.ingredients.length === 1 ? "Zutat" : "Zutaten"}`}
          theme={theme}
          density={D}
        />
        {ingredientGroups.length > 1 ? (
          <View>
            {ingredientGroups.map((group, gIdx) => (
              <View
                key={`g-${gIdx}`}
                style={{ marginTop: gIdx > 0 ? 10 : 4 }}
              >
                {group.name ? (
                  <Text
                    style={{
                      fontFamily: "Inter",
                      fontSize: 7.5,
                      fontWeight: 600,
                      letterSpacing: 1.4,
                      color: theme.inkSoft,
                      textTransform: "uppercase",
                      marginBottom: 4,
                    }}
                  >
                    {newspaperGroupLabel(group.name)}
                  </Text>
                ) : null}
                <NewspaperIngredientGrid
                  items={group.items}
                  theme={theme}
                  density={D}
                />
              </View>
            ))}
          </View>
        ) : (
          <NewspaperIngredientGrid
            items={flatIngredients}
            theme={theme}
            density={D}
          />
        )}
      </View>

      {/* ── Zubereitung-Section ── */}
      <View
        style={{
          paddingHorizontal: PAGE_PADDING,
          marginTop: D.sectionGap,
        }}
      >
        <NewspaperSectionHeader
          label="Zubereitung"
          right={`${flatSteps.length} ${flatSteps.length === 1 ? "Schritt" : "Schritte"}`}
          theme={theme}
          density={D}
        />
        <NewspaperStepsGrid
          steps={flatSteps}
          theme={theme}
          density={D}
        />
      </View>

      {/* ── Sparse-Story-Block (≤10 Zutaten + Story) ── */}
      {showStory && leadText.length === 0 ? (
        <View
          style={{
            paddingHorizontal: PAGE_PADDING,
            marginTop: D.sectionGap - 2,
          }}
        >
          <View
            style={{
              borderLeftWidth: 2,
              borderLeftColor: theme.accent,
              paddingLeft: 10,
              paddingVertical: 4,
            }}
          >
            <Text
              style={{
                fontFamily: "Fraunces",
                fontSize: 9.5,
                fontStyle: "italic",
                color: theme.ink,
                lineHeight: 1.45,
              }}
            >
              {recipe.description}
            </Text>
          </View>
        </View>
      ) : null}

      {/* ── Flex-Spacer: schiebt Spreadsheet+Footer ans untere Seitenende. ── */}
      {/* Bei kurzem Content waechst der Spacer, bei langem Content wird er 0. */}
      {/* Verhindert Overlap mit dem Hauptcontent (vorher: position absolute). */}
      <View style={{ flex: 1, minHeight: 14 }} />

      {/* ── Spreadsheet-Nährwerte (im Flow, vor Footer) ── */}
      <View
        style={{
          paddingHorizontal: PAGE_PADDING,
          paddingBottom: 6,
        }}
      >
        {/* Doppellinie ueber Spreadsheet (Newspaper-typisch) */}
        <View style={{ height: 1.5, backgroundColor: theme.ink, marginBottom: 1 }} />
        <View style={{ height: 0.5, backgroundColor: theme.ink, marginBottom: 7 }} />
        {/* Master-Label + dezenter Basis-Hinweis rechts */}
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
              fontFamily: "Inter",
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: 2.2,
              color: theme.ink,
              textTransform: "uppercase",
            }}
          >
            Nährwerte {nutritionBasisInline(recipe.nutritionBasis)}
          </Text>
        </View>
        {/* MAKROS — prominenter Block in eigener Sub-Zeile */}
        <View style={{ marginBottom: topMicros.length > 0 ? 7 : 0 }}>
          <Text
            style={{
              fontFamily: "Inter",
              fontSize: 6.5,
              fontWeight: 700,
              letterSpacing: 1.6,
              color: theme.inkSubtle,
              textTransform: "uppercase",
              marginBottom: 3,
            }}
          >
            Makros
          </Text>
          <View style={{ flexDirection: "row", gap: 22 }}>
            <NewspaperMacroCell
              label="KCAL"
              value={String(Math.round(recipe.nutrition.kcal))}
              theme={theme}
              density={D}
            />
            <NewspaperMacroCell
              label="Protein"
              value={`${recipe.nutrition.protein}g`}
              theme={theme}
              density={D}
            />
            <NewspaperMacroCell
              label="Kohlenh."
              value={`${recipe.nutrition.carbs}g`}
              theme={theme}
              density={D}
            />
            <NewspaperMacroCell
              label="Fett"
              value={`${recipe.nutrition.fat}g`}
              theme={theme}
              density={D}
            />
          </View>
        </View>
        {/* MIKROS — dezenter, kompakter Block darunter mit Trennlinie */}
        {topMicros.length > 0 ? (
          <View>
            <View
              style={{
                height: 0.5,
                backgroundColor: theme.divider,
                marginBottom: 5,
              }}
            />
            <Text
              style={{
                fontFamily: "Inter",
                fontSize: 6.5,
                fontWeight: 700,
                letterSpacing: 1.6,
                color: theme.inkSubtle,
                textTransform: "uppercase",
                marginBottom: 3,
              }}
            >
              Mikros
            </Text>
            <View style={{ flexDirection: "row", gap: 22 }}>
              {topMicros.map((m: Micronutrient, i: number) => (
                <NewspaperMicroCell
                  key={`${m.name}-${i}`}
                  name={m.name}
                  pct={m.pctDaily}
                  theme={theme}
                  density={D}
                />
              ))}
            </View>
          </View>
        ) : null}
      </View>

      {/* ── Footer mit QR-Code (im Flow am unteren Rand) ── */}
      <View
        style={{
          marginHorizontal: PAGE_PADDING,
          marginBottom: 22,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: 8,
          borderTopWidth: 0.5,
          borderTopColor: theme.divider,
          gap: 12,
        }}
      >
        <Text
          style={{
            fontFamily: "Inter",
            fontSize: 8,
            fontWeight: 600,
            letterSpacing: 1.4,
            color: theme.inkSoft,
            textTransform: "uppercase",
          }}
        >
          {brand.handle} · {pack.title}
        </Text>
        {qrDataUri ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text
              style={{
                fontFamily: "Inter",
                fontSize: 7,
                letterSpacing: 1.2,
                color: theme.inkSubtle,
                textTransform: "uppercase",
                textAlign: "right",
              }}
            >
              Original{"\n"}scannen
            </Text>
            <Image src={qrDataUri} style={{ width: 32, height: 32 }} />
          </View>
        ) : (
          <Text
            style={{
              fontFamily: "Inter",
              fontSize: 7.5,
              letterSpacing: 1.4,
              color: theme.inkSubtle,
              textTransform: "uppercase",
            }}
          >
            {recipe.sourceLabel ?? "Erstausgabe"}
          </Text>
        )}
      </View>
    </Page>
  );
}

// ─── Newspaper Sub-Components ────────────────────────────────────────────

function NewspaperSectionHeader({
  label,
  right,
  theme,
  density,
}: {
  label: string;
  right: string;
  theme: ReturnType<typeof packTheme>;
  density: (typeof NEWSPAPER_DENSITY)["balanced"];
}) {
  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginBottom: 11,
        }}
      >
        <Text
          style={{
            fontFamily: "Inter",
            fontSize: density.sectionLabelFontSize,
            fontWeight: 700,
            letterSpacing: 2,
            color: theme.ink,
            textTransform: "uppercase",
          }}
        >
          {label}
        </Text>
        <View
          style={{ flex: 1, height: 0.5, backgroundColor: theme.divider }}
        />
        <Text
          style={{
            fontFamily: "Inter",
            fontSize: density.sectionLabelFontSize - 1,
            letterSpacing: 1.4,
            color: theme.inkSoft,
            textTransform: "uppercase",
          }}
        >
          {right}
        </Text>
      </View>
    </View>
  );
}

// 3-Column Ingredient-Grid (Newspaper-typisch)
function NewspaperIngredientGrid({
  items,
  theme,
  density,
}: {
  items: IngredientGroup["items"];
  theme: ReturnType<typeof packTheme>;
  density: (typeof NEWSPAPER_DENSITY)["balanced"];
}) {
  // Bei <= 4 Items: 2 Spalten. Sonst 3 Spalten (Newspaper-Standard).
  const useThree = items.length > 4;
  const cols = useThree ? 3 : 2;
  const perCol = Math.ceil(items.length / cols);
  const columns: (typeof items)[] = [];
  for (let c = 0; c < cols; c++) {
    columns.push(items.slice(c * perCol, (c + 1) * perCol));
  }
  return (
    <View style={{ flexDirection: "row", gap: 14 }}>
      {columns.map((col, ci) => (
        <View key={`col-${ci}`} style={{ flex: 1 }}>
          {col.map((ing, i) => (
            <NewspaperIngredientRow
              key={`${ci}-${i}`}
              amount={ing.amount}
              name={ing.name}
              note={ing.note}
              theme={theme}
              density={density}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function NewspaperIngredientRow({
  amount,
  name,
  note,
  theme,
  density,
}: {
  amount: string;
  name: string;
  note?: string;
  theme: ReturnType<typeof packTheme>;
  density: (typeof NEWSPAPER_DENSITY)["balanced"];
}) {
  const displayAmount = formatIngredientAmount(amount);
  // Einheitliche Mengen-Typografie: ob "150 g" oder "Nach Geschmack" — jede
  // Menge rendert in derselben Schrift, Groesse, Stil und Farbe. Vorher war
  // die quantitative Variante gross/fett/Inter/Akzent, die qualitative
  // klein/italic/Fraunces/grau — zwei Welten in einer Spalte, das wirkte
  // verworren. Jetzt durchgaengig dezent; die Zutat selbst ist ueber
  // Groesse + 500er-Gewicht der klare primaere Lesepunkt.
  const amountIsLong = displayAmount.length > 10;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: amountIsLong ? "center" : "flex-start",
        paddingVertical: density.ingredientRowPadV,
        borderBottomWidth: 0.4,
        borderBottomColor: theme.divider,
        gap: 6,
      }}
    >
      <Text
        style={{
          fontFamily: "Fraunces",
          fontSize: density.ingredientFontSize - 2,
          fontStyle: "italic",
          fontWeight: 400,
          color: theme.inkSoft,
          width: 50,
          lineHeight: amountIsLong ? 1.3 : undefined,
          paddingTop: 1,
        }}
      >
        {displayAmount}
      </Text>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: "Fraunces",
            fontSize: density.ingredientFontSize,
            fontWeight: 500,
            color: theme.ink,
            lineHeight: 1.3,
          }}
        >
          {name}
        </Text>
        {note ? (
          <Text
            style={{
              fontFamily: "Fraunces",
              fontSize: density.ingredientFontSize - 2,
              fontStyle: "italic",
              color: theme.inkSubtle,
              marginTop: 1,
            }}
          >
            {note}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// 2-Column Steps mit italic Nummern (Glyph-Center-Lock §1)
function NewspaperStepsGrid({
  steps,
  theme,
  density,
}: {
  steps: { num: number; text: string }[];
  theme: ReturnType<typeof packTheme>;
  density: (typeof NEWSPAPER_DENSITY)["balanced"];
}) {
  const half = Math.ceil(steps.length / 2);
  const colA = steps.slice(0, half);
  const colB = steps.slice(half);
  return (
    <View style={{ flexDirection: "row", gap: 20 }}>
      <NewspaperStepColumn steps={colA} theme={theme} density={density} />
      <View
        style={{
          width: 0.5,
          backgroundColor: theme.divider,
          marginVertical: 4,
        }}
      />
      {colB.length > 0 ? (
        <NewspaperStepColumn steps={colB} theme={theme} density={density} />
      ) : (
        <View style={{ flex: 1 }} />
      )}
    </View>
  );
}

function NewspaperStepColumn({
  steps,
  theme,
  density,
}: {
  steps: { num: number; text: string }[];
  theme: ReturnType<typeof packTheme>;
  density: (typeof NEWSPAPER_DENSITY)["balanced"];
}) {
  return (
    <View style={{ flex: 1 }}>
      {steps.map((step) => (
        <View
          key={`s-${step.num}`}
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 8,
            marginBottom: density.stepMarginBottom,
          }}
        >
          {/* Step-Nummer — gleiche font/fontSize/lineHeight wie Body (§1) */}
          <Text
            style={{
              fontSize: density.stepFontSize, // identisch
              lineHeight: 1.45, // identisch
              fontStyle: "italic",
              fontWeight: 700,
              color: theme.accent,
              width: 16,
            }}
          >
            {step.num}
          </Text>
          <Text
            style={{
              flex: 1,
              fontFamily: "Fraunces",
              fontSize: density.stepFontSize,
              lineHeight: 1.45,
              color: theme.ink,
            }}
          >
            {step.text}
          </Text>
        </View>
      ))}
    </View>
  );
}

function NewspaperMacroCell({
  label,
  value,
  theme,
  density,
}: {
  label: string;
  value: string;
  theme: ReturnType<typeof packTheme>;
  density: (typeof NEWSPAPER_DENSITY)["balanced"];
}) {
  return (
    <View style={{ flexDirection: "column", gap: 2, flex: 1 }}>
      <Text
        style={{
          fontFamily: "Inter",
          fontSize: density.macrosLabelFontSize,
          fontWeight: 600,
          letterSpacing: 1.6,
          color: theme.inkSoft,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: "Fraunces",
          fontSize: density.macrosValueFontSize,
          fontWeight: 700,
          color: theme.ink,
          letterSpacing: -0.3,
          lineHeight: 1.05,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

// Mikros: dezent, kompakt, einzeilig "Name 44%" — bewusst KEIN Macro-Look.
function NewspaperMicroCell({
  name,
  pct,
  theme,
  density,
}: {
  name: string;
  pct?: number;
  theme: ReturnType<typeof packTheme>;
  density: (typeof NEWSPAPER_DENSITY)["balanced"];
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "baseline",
        gap: 6,
        flex: 1,
      }}
    >
      <Text
        style={{
          fontFamily: "Inter",
          fontSize: density.microsFontSize,
          fontWeight: 600,
          letterSpacing: 1.2,
          color: theme.inkSoft,
          textTransform: "uppercase",
        }}
      >
        {name}
      </Text>
      <Text
        style={{
          fontFamily: "Fraunces",
          fontSize: density.microsFontSize + 1,
          fontWeight: 700,
          fontStyle: "italic",
          color: theme.accent,
        }}
      >
        {typeof pct === "number" ? `${pct}%` : "—"}
      </Text>
    </View>
  );
}

// "Fuer" nur bei den/die/das — LAYOUT_RULES.md §5
function newspaperGroupLabel(name: string): string {
  return /^(den|die|das)\s/i.test(name)
    ? `Für ${name.toLowerCase()}`
    : name;
}

// ═════════════════════════════════════════════════════════════════════════════
// LAYOUT 10 (Phase C): CONSTELLATION — Sternkarten-Look
// ═════════════════════════════════════════════════════════════════════════════
// Komplett andere Design-Sprache als alle anderen 9 Layouts. Konzept:
//
//   ┌────────────────────────────────────────────────────────────────────┐
//   │ ✦ · · ✦ Background-Sterne ·                                      ✦│
//   │ ✦ CONSTELLATION ─── PASTA AL LIMONE ─── 03 / 07                    │
//   │ ────────────────────────────────────────────────────────────────── │
//   │                                                                     │
//   │  ┌────────┐    Eyebrow             ──────────────                  │
//   │  │ ◯ Hero │    PASTA AL LIMONE     ⊙ Vitamin C  44%               │
//   │  │ (rund, │    (italic Fraunces)   │                               │
//   │  │ Glow)  │    Subtitle italic     ⊙ Calcium    28%               │
//   │  └────────┘                        │                               │
//   │                                    ⊙ Eisen      23%                │
//   │              ★ 300 KCAL · ⏱ 25 MIN · ✦ HIGH-PROTEIN                │
//   │                                                                     │
//   │  ✦ ZUTATEN ─────────────────────────────────────── 7 STERNE        │
//   │                                                                     │
//   │  ✦ 500g  Magerquark        ✦ 200ml  Creme Fine                     │
//   │  ✦ 150g  Skyr              ✦ 150g   Frischkäse                     │
//   │                                                                     │
//   │  ◐ TRAJECTORY ──────────────────────────────────── 4 STATIONEN     │
//   │                                                                     │
//   │  ●─────●─────●─────●                                                │
//   │  01    02    03    04                                               │
//   │                                                                     │
//   │  Magerq.   Mandari   Schicht   Pudding                              │
//   │  verrüh-   unter     der Löf-  gleichm.                             │
//   │  ren.      die Cre-  felbisk.  verteil.                             │
//   │                                                                     │
//   │  @handle · pack                                          [QR]       │
//   └────────────────────────────────────────────────────────────────────┘
//
// Mikros in EIGENER Position vs allen anderen Layouts:
//   - vinyl: Audio-Spec-Strip oben
//   - editorial: Banner ueber dem Hero
//   - patisserie: Vertikale Liste in Sidebar
//   - vital: Pearl-Strip mittig
//   - amber: Vertikale Bars rechts
//   - minimal: Capsule-Pills horizontal
//   - dashboard: Data-Rows mit Icons
//   - sport: Macro-Bars mit Emojis
//   - newspaper: Spreadsheet-Footer-Row mit Doppellinien
//   - constellation: Planeten-Symbole als vertikale Liste rechts neben dem Hero
//                     (kleine Akzent-Kreise mit %-Text, Connection-Line dazwischen)
//
// Background ist hardcoded `#0a0e1f` (dunkles Marineblau) statt theme.bg —
// das Layout ist per Definition "Dark-Sky". theme.accent (mood-color) bleibt
// als Stern-Akzent gegen den dunklen Hintergrund.
//
// Anti-Patterns aus LAYOUT_RULES.md alle adressiert.

// Constellation-spezifische Farbpalette (override theme.bg, theme.ink etc.)
const CONSTELLATION_COLORS = {
  bg: "#0a0e1f",
  inkPrimary: "#e8e6dc",
  inkSoft: "#9b9bb0",
  inkSubtle: "#5e6480",
  divider: "#2a2e44",
  star: "#fafaf5",
} as const;

const CONSTELLATION_DENSITY: Record<
  Density,
  {
    /** Durchmesser des runden Hero-Disks. */
    heroSize: number;
    /** Glow-Halo extra-radius (= heroSize/2 + halo). */
    halo: number;
    titleFontSize: number;
    eyebrowFontSize: number;
    subtitleFontSize: number;
    specFontSize: number;
    ingredientFontSize: number;
    ingredientRowPadV: number;
    ingredientNoteFontSize: number;
    stepFontSize: number;
    stepMarginBottom: number;
    sectionLabelFontSize: number;
    planetSize: number;
    planetGap: number;
    topPadding: number;
    sectionGap: number;
  }
> = {
  compact: {
    heroSize: 130,
    halo: 12,
    titleFontSize: 22,
    eyebrowFontSize: 7.5,
    subtitleFontSize: 9,
    specFontSize: 8.5,
    ingredientFontSize: 9,
    ingredientRowPadV: 2.5,
    ingredientNoteFontSize: 6.5,
    stepFontSize: 8.5,
    stepMarginBottom: 4,
    sectionLabelFontSize: 7.5,
    planetSize: 16,
    planetGap: 10,
    topPadding: 14,
    sectionGap: 10,
  },
  balanced: {
    heroSize: 160,
    halo: 16,
    titleFontSize: 28,
    eyebrowFontSize: 8,
    subtitleFontSize: 10,
    specFontSize: 9.5,
    ingredientFontSize: 9.5,
    ingredientRowPadV: 4,
    ingredientNoteFontSize: 7,
    stepFontSize: 9,
    stepMarginBottom: 6,
    sectionLabelFontSize: 8,
    planetSize: 18,
    planetGap: 14,
    topPadding: 20,
    sectionGap: 14,
  },
  spacious: {
    heroSize: 180,
    halo: 20,
    titleFontSize: 32,
    eyebrowFontSize: 8.5,
    subtitleFontSize: 11,
    specFontSize: 10,
    ingredientFontSize: 10,
    ingredientRowPadV: 5.5,
    ingredientNoteFontSize: 7.5,
    stepFontSize: 9.5,
    stepMarginBottom: 8,
    sectionLabelFontSize: 8.5,
    planetSize: 20,
    planetGap: 18,
    topPadding: 26,
    sectionGap: 18,
  },
};

function constellationKey(recipe: Recipe): string {
  const tags = (recipe.tags ?? []).map((t) => t.toLowerCase());
  if (tags.some((t) => t.includes("vegan"))) return "VEGAN";
  if (tags.some((t) => t.includes("high-protein") || t.includes("protein")))
    return "HIGH-PROTEIN";
  if (tags.some((t) => t.includes("low-carb"))) return "LOW-CARB";
  if (tags.some((t) => t.includes("vegetarisch"))) return "VEGETARISCH";
  if (tags.some((t) => t.includes("dessert") || t.includes("kuchen")))
    return "SÜSS";
  if (tags.some((t) => t.includes("snack"))) return "SNACK";
  if (tags.some((t) => t.includes("mealprep"))) return "MEALPREP";
  return "STELLAR";
}

function ConstellationPage({
  brand,
  pack,
  recipe,
  totalRecipes,
  heroDataUri,
  qrDataUri,
  hideRecipeIndex,
}: RecipeCardPdfProps) {
  const theme = packTheme(pack);
  const density = getDensity(recipe);
  const D = CONSTELLATION_DENSITY[density];
  const showStory = shouldShowStory(recipe);
  const recipePosition = recipe.number;
  const titleSafe = softWrapTitle(recipe.title);

  // Steps mit fortlaufender Nummer als Stationen entlang der Trajectory
  const stepGroups = groupSteps(recipe.steps);
  const flatSteps: { num: number; text: string }[] = [];
  let runningStep = 0;
  for (const g of stepGroups) {
    for (const item of g.items) {
      runningStep += 1;
      flatSteps.push({ num: runningStep, text: item.text });
    }
  }

  const ingredientGroups = groupIngredients(recipe.ingredients);
  const flatIngredients = ingredientGroups.flatMap((g) => g.items);

  // Top-3 Mikros als Planeten
  const topMicros = visibleMicros(recipe)
    .slice()
    .sort(
      (a: Micronutrient, b: Micronutrient) =>
        (b.pctDaily ?? 0) - (a.pctDaily ?? 0)
    )
    .slice(0, 3);

  const time = totalTime(recipe);
  const constKey = constellationKey(recipe);

  // Background-Sterne (deterministische Positionen damit reproducible)
  const bgStars = buildConstellationStars(recipe.slug + recipe.title);

  return (
    <Page
      size="A4"
      style={{
        backgroundColor: CONSTELLATION_COLORS.bg,
        fontFamily: "Inter",
        color: CONSTELLATION_COLORS.inkPrimary,
      }}
    >
      {/* ── Background-Sterne (subtile Atmosphäre) ── */}
      <Svg
        width={595}
        height={842}
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        {bgStars.map((s, i) => (
          <Circle
            key={`bg-${i}`}
            cx={s.x}
            cy={s.y}
            r={s.r}
            fill={CONSTELLATION_COLORS.star}
            opacity={s.opacity}
          />
        ))}
      </Svg>

      {/* ── Masthead ── */}
      <View
        style={{
          paddingHorizontal: PAGE_PADDING,
          paddingTop: D.topPadding,
          paddingBottom: 4,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingBottom: 6,
            borderBottomWidth: 0.5,
            borderBottomColor: CONSTELLATION_COLORS.divider,
          }}
        >
          <Text
            style={{
              fontFamily: "Inter",
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: 2.4,
              color: theme.accent,
              textTransform: "uppercase",
            }}
          >
            ✦ Constellation
          </Text>
          <View
            style={{
              flex: 1,
              height: 0.5,
              backgroundColor: CONSTELLATION_COLORS.divider,
            }}
          />
          <Text
            style={{
              fontFamily: "Inter",
              fontSize: 7.5,
              fontWeight: 600,
              letterSpacing: 1.6,
              color: CONSTELLATION_COLORS.inkSoft,
              textTransform: "uppercase",
            }}
          >
            {pack.title}
          </Text>
          {!hideRecipeIndex ? (
            <>
              <Text
                style={{
                  fontFamily: "Inter",
                  fontSize: 7,
                  color: CONSTELLATION_COLORS.inkSubtle,
                }}
              >
                ·
              </Text>
              <Text
                style={{
                  fontFamily: "Inter",
                  fontSize: 7.5,
                  fontWeight: 600,
                  letterSpacing: 1.6,
                  color: CONSTELLATION_COLORS.inkSoft,
                }}
              >
                {pad2(recipePosition)} / {pad2(totalRecipes)}
              </Text>
            </>
          ) : null}
        </View>
      </View>

      {/* ── Hero-Section: 3 Spalten (Hero | Title | Planeten) ── */}
      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: PAGE_PADDING,
          paddingTop: density === "compact" ? 12 : 18,
          gap: 18,
          alignItems: "flex-start",
        }}
      >
        {/* Hero — rund mit Glow-Halo */}
        <View
          style={{
            width: D.heroSize + D.halo * 2,
            height: D.heroSize + D.halo * 2,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Glow-Halo: konzentrische Kreise mit niedriger Opacity */}
          <Svg
            width={D.heroSize + D.halo * 2}
            height={D.heroSize + D.halo * 2}
            style={{ position: "absolute", top: 0, left: 0 }}
          >
            <Circle
              cx={(D.heroSize + D.halo * 2) / 2}
              cy={(D.heroSize + D.halo * 2) / 2}
              r={D.heroSize / 2 + D.halo}
              fill={theme.accent}
              opacity={0.08}
            />
            <Circle
              cx={(D.heroSize + D.halo * 2) / 2}
              cy={(D.heroSize + D.halo * 2) / 2}
              r={D.heroSize / 2 + D.halo * 0.55}
              fill={theme.accent}
              opacity={0.16}
            />
            <Circle
              cx={(D.heroSize + D.halo * 2) / 2}
              cy={(D.heroSize + D.halo * 2) / 2}
              r={D.heroSize / 2 + 2}
              fill="none"
              stroke={theme.accent}
              strokeWidth={0.75}
              opacity={0.55}
            />
          </Svg>
          {/* Hero-Bild rund clipped */}
          <View
            style={{
              width: D.heroSize,
              height: D.heroSize,
              borderRadius: D.heroSize / 2,
              overflow: "hidden",
              backgroundColor: "#1a1d33",
            }}
          >
            {heroDataUri ? (
              <Image
                src={heroDataUri}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <View
                style={{
                  width: "100%",
                  height: "100%",
                  backgroundColor: theme.accent,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    fontFamily: "Fraunces",
                    fontSize: D.heroSize * 0.42,
                    fontWeight: 700,
                    fontStyle: "italic",
                    color: CONSTELLATION_COLORS.star,
                  }}
                >
                  {brand.name.charAt(0)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Title-Block (Mitte) */}
        <View style={{ flex: 1, paddingTop: 4 }}>
          {/* Eyebrow */}
          <Text
            style={{
              fontFamily: "Inter",
              fontSize: D.eyebrowFontSize,
              fontWeight: 700,
              letterSpacing: 2.2,
              color: theme.accent,
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            {pack.category}
          </Text>
          {/* Italic Headline */}
          <Text
            style={{
              fontFamily: "Fraunces",
              fontSize: D.titleFontSize,
              fontWeight: 700,
              fontStyle: "italic",
              color: CONSTELLATION_COLORS.inkPrimary,
              lineHeight: 1.05,
              letterSpacing: -0.4,
              marginBottom: 8,
            }}
          >
            {titleSafe}
          </Text>
          {recipe.subtitle ? (
            <Text
              style={{
                fontFamily: "Fraunces",
                fontSize: D.subtitleFontSize,
                fontStyle: "italic",
                color: CONSTELLATION_COLORS.inkSoft,
                lineHeight: 1.35,
                marginBottom: 10,
              }}
            >
              {recipe.subtitle}
            </Text>
          ) : null}
          {/* Spec-Strip: KCAL · MIN · KEY mit Sternen-Glyphs */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "baseline",
              gap: 8,
              flexWrap: "wrap",
              marginTop: 2,
            }}
          >
            <ConstellationSpecCell
              icon="★"
              value={`${Math.round(recipe.nutrition.kcal)}`}
              label="kcal"
              density={D}
              accent={theme.accent}
            />
            <Text
              style={{
                fontFamily: "Inter",
                fontSize: D.specFontSize,
                color: CONSTELLATION_COLORS.divider,
              }}
            >
              ·
            </Text>
            <ConstellationSpecCell
              icon="✦"
              value={`${time}`}
              label="min"
              density={D}
              accent={theme.accent}
            />
            <Text
              style={{
                fontFamily: "Inter",
                fontSize: D.specFontSize,
                color: CONSTELLATION_COLORS.divider,
              }}
            >
              ·
            </Text>
            <ConstellationSpecCell
              icon="✶"
              value={constKey}
              label=""
              density={D}
              accent={theme.accent}
            />
          </View>
          <Text
            style={{
              fontFamily: "Inter",
              fontSize: 6.5,
              letterSpacing: 1.4,
              color: CONSTELLATION_COLORS.inkSubtle,
              textTransform: "uppercase",
              marginTop: 6,
            }}
          >
            {nutritionBasisInline(recipe.nutritionBasis)}
          </Text>
        </View>

        {/* Planet-Column (Mikros) — eigene Position */}
        {topMicros.length > 0 ? (
          <View
            style={{
              width: 96,
              paddingTop: 4,
              borderLeftWidth: 0.5,
              borderLeftColor: CONSTELLATION_COLORS.divider,
              paddingLeft: 10,
            }}
          >
            <Text
              style={{
                fontFamily: "Inter",
                fontSize: 6.5,
                fontWeight: 700,
                letterSpacing: 2,
                color: CONSTELLATION_COLORS.inkSubtle,
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              Planeten
            </Text>
            {topMicros.map((m: Micronutrient, i: number) => (
              <ConstellationPlanetRow
                key={`p-${i}`}
                name={m.name}
                pct={m.pctDaily}
                accent={theme.accent}
                density={D}
                isLast={i === topMicros.length - 1}
              />
            ))}
          </View>
        ) : null}
      </View>

      {/* ── Zutaten-Section ── */}
      <View
        style={{
          paddingHorizontal: PAGE_PADDING,
          marginTop: D.sectionGap + 6,
        }}
      >
        <ConstellationSectionHeader
          label="Zutaten"
          right={`${recipe.ingredients.length} ${recipe.ingredients.length === 1 ? "Stern" : "Sterne"}`}
          accent={theme.accent}
          density={D}
        />
        {ingredientGroups.length > 1 ? (
          <View>
            {ingredientGroups.map((group, gIdx) => (
              <View key={`g-${gIdx}`} style={{ marginTop: gIdx > 0 ? 8 : 4 }}>
                {group.name ? (
                  <Text
                    style={{
                      fontFamily: "Inter",
                      fontSize: 7.5,
                      fontWeight: 600,
                      letterSpacing: 1.4,
                      color: CONSTELLATION_COLORS.inkSoft,
                      textTransform: "uppercase",
                      marginBottom: 4,
                    }}
                  >
                    {constellationGroupLabel(group.name)}
                  </Text>
                ) : null}
                <ConstellationIngredientGrid
                  items={group.items}
                  accent={theme.accent}
                  density={D}
                />
              </View>
            ))}
          </View>
        ) : (
          <ConstellationIngredientGrid
            items={flatIngredients}
            accent={theme.accent}
            density={D}
          />
        )}
      </View>

      {/* ── Trajectory (Steps) ── */}
      <View
        style={{
          paddingHorizontal: PAGE_PADDING,
          marginTop: D.sectionGap + 2,
        }}
      >
        <ConstellationSectionHeader
          label="◐ Trajectory"
          right={`${flatSteps.length} ${flatSteps.length === 1 ? "Station" : "Stationen"}`}
          accent={theme.accent}
          density={D}
        />
        <ConstellationTrajectory
          steps={flatSteps}
          accent={theme.accent}
          density={D}
        />
      </View>

      {/* ── Sparse-Story-Block ── */}
      {showStory ? (
        <View
          style={{
            paddingHorizontal: PAGE_PADDING,
            marginTop: D.sectionGap - 2,
          }}
        >
          <View
            style={{
              borderLeftWidth: 2,
              borderLeftColor: theme.accent,
              paddingLeft: 10,
              paddingVertical: 4,
            }}
          >
            <Text
              style={{
                fontFamily: "Fraunces",
                fontSize: 9.5,
                fontStyle: "italic",
                color: CONSTELLATION_COLORS.inkPrimary,
                lineHeight: 1.45,
                opacity: 0.88,
              }}
            >
              {recipe.description}
            </Text>
          </View>
        </View>
      ) : null}

      {/* ── Footer mit QR-Code ── */}
      <View
        style={{
          position: "absolute",
          left: PAGE_PADDING,
          right: PAGE_PADDING,
          bottom: 22,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: 8,
          borderTopWidth: 0.5,
          borderTopColor: CONSTELLATION_COLORS.divider,
          gap: 12,
        }}
        fixed
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Svg width={12} height={12} viewBox="0 0 12 12">
            <Path
              d="M 6 0.5 L 7 4.5 L 11 5.5 L 7.5 7 L 8 11 L 6 8.5 L 4 11 L 4.5 7 L 1 5.5 L 5 4.5 Z"
              fill={theme.accent}
            />
          </Svg>
          <Text
            style={{
              fontFamily: "Inter",
              fontSize: 8,
              fontWeight: 600,
              letterSpacing: 1.4,
              color: CONSTELLATION_COLORS.inkSoft,
              textTransform: "uppercase",
            }}
          >
            {brand.handle} · {pack.title}
          </Text>
        </View>
        {qrDataUri ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text
              style={{
                fontFamily: "Inter",
                fontSize: 7,
                letterSpacing: 1.2,
                color: CONSTELLATION_COLORS.inkSubtle,
                textTransform: "uppercase",
                textAlign: "right",
              }}
            >
              Scan{"\n"}für{"\n"}Original
            </Text>
            <View
              style={{
                padding: 3,
                backgroundColor: CONSTELLATION_COLORS.star,
                borderRadius: 2,
              }}
            >
              <Image src={qrDataUri} style={{ width: 30, height: 30 }} />
            </View>
          </View>
        ) : (
          <Text
            style={{
              fontFamily: "Inter",
              fontSize: 7.5,
              letterSpacing: 1.4,
              color: CONSTELLATION_COLORS.inkSubtle,
              textTransform: "uppercase",
            }}
          >
            {recipe.sourceLabel ?? "Original auf Instagram"}
          </Text>
        )}
      </View>
    </Page>
  );
}

// ─── Constellation Sub-Components ─────────────────────────────────────────

function ConstellationSectionHeader({
  label,
  right,
  accent,
  density,
}: {
  label: string;
  right: string;
  accent: string;
  density: (typeof CONSTELLATION_DENSITY)["balanced"];
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 8,
      }}
    >
      <Text
        style={{
          fontFamily: "Inter",
          fontSize: density.sectionLabelFontSize,
          fontWeight: 700,
          letterSpacing: 2.4,
          color: accent,
          textTransform: "uppercase",
        }}
      >
        ✦ {label}
      </Text>
      <View
        style={{
          flex: 1,
          height: 0.5,
          backgroundColor: CONSTELLATION_COLORS.divider,
        }}
      />
      <Text
        style={{
          fontFamily: "Inter",
          fontSize: density.sectionLabelFontSize - 1,
          letterSpacing: 1.6,
          color: CONSTELLATION_COLORS.inkSoft,
          textTransform: "uppercase",
        }}
      >
        {right}
      </Text>
    </View>
  );
}

function ConstellationSpecCell({
  icon,
  value,
  label,
  density,
  accent,
}: {
  icon: string;
  value: string;
  label: string;
  density: (typeof CONSTELLATION_DENSITY)["balanced"];
  accent: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "baseline",
        gap: 4,
      }}
    >
      <Text
        style={{
          fontFamily: "Inter",
          fontSize: density.specFontSize - 1,
          color: accent,
        }}
      >
        {icon}
      </Text>
      <Text
        style={{
          fontFamily: "Inter",
          fontSize: density.specFontSize,
          fontWeight: 700,
          letterSpacing: 1.4,
          color: CONSTELLATION_COLORS.inkPrimary,
          textTransform: "uppercase",
        }}
      >
        {value}
      </Text>
      {label ? (
        <Text
          style={{
            fontFamily: "Inter",
            fontSize: density.specFontSize - 1.5,
            letterSpacing: 1.4,
            color: CONSTELLATION_COLORS.inkSoft,
            textTransform: "uppercase",
          }}
        >
          {label}
        </Text>
      ) : null}
    </View>
  );
}

function ConstellationPlanetRow({
  name,
  pct,
  accent,
  density,
  isLast,
}: {
  name: string;
  pct?: number;
  accent: string;
  density: (typeof CONSTELLATION_DENSITY)["balanced"];
  isLast: boolean;
}) {
  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingVertical: 2,
        }}
      >
        {/* Planet-Symbol: kleiner Akzent-Kreis mit Innenpunkt */}
        <Svg width={density.planetSize} height={density.planetSize}>
          <Circle
            cx={density.planetSize / 2}
            cy={density.planetSize / 2}
            r={density.planetSize / 2 - 1}
            fill="none"
            stroke={accent}
            strokeWidth={0.8}
            opacity={0.55}
          />
          <Circle
            cx={density.planetSize / 2}
            cy={density.planetSize / 2}
            r={density.planetSize / 2 - 4}
            fill={accent}
          />
        </Svg>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: "Inter",
              fontSize: 7,
              fontWeight: 600,
              letterSpacing: 1.4,
              color: CONSTELLATION_COLORS.inkSoft,
              textTransform: "uppercase",
            }}
          >
            {name}
          </Text>
          <Text
            style={{
              fontFamily: "Fraunces",
              fontSize: 11,
              fontWeight: 700,
              color: CONSTELLATION_COLORS.inkPrimary,
              lineHeight: 1.0,
              marginTop: 1,
            }}
          >
            {typeof pct === "number" ? `${pct}%` : "—"}
          </Text>
        </View>
      </View>
      {/* Connection-Line zwischen Planeten */}
      {!isLast ? (
        <View
          style={{
            width: 1,
            height: density.planetGap - 4,
            backgroundColor: accent,
            opacity: 0.35,
            marginLeft: density.planetSize / 2,
            marginVertical: 2,
          }}
        />
      ) : null}
    </View>
  );
}

function ConstellationIngredientGrid({
  items,
  accent,
  density,
}: {
  items: IngredientGroup["items"];
  accent: string;
  density: (typeof CONSTELLATION_DENSITY)["balanced"];
}) {
  const useColumns = items.length >= 4;
  if (!useColumns) {
    return (
      <View>
        {items.map((ing, i) => (
          <ConstellationIngredientRow
            key={`gi-${i}`}
            amount={ing.amount}
            name={ing.name}
            note={ing.note}
            accent={accent}
            density={density}
          />
        ))}
      </View>
    );
  }
  const half = Math.ceil(items.length / 2);
  return (
    <View style={{ flexDirection: "row", gap: 18 }}>
      <View style={{ flex: 1 }}>
        {items.slice(0, half).map((ing, i) => (
          <ConstellationIngredientRow
            key={`ca-${i}`}
            amount={ing.amount}
            name={ing.name}
            note={ing.note}
            accent={accent}
            density={density}
          />
        ))}
      </View>
      <View style={{ flex: 1 }}>
        {items.slice(half).map((ing, i) => (
          <ConstellationIngredientRow
            key={`cb-${i}`}
            amount={ing.amount}
            name={ing.name}
            note={ing.note}
            accent={accent}
            density={density}
          />
        ))}
      </View>
    </View>
  );
}

function ConstellationIngredientRow({
  amount,
  name,
  note,
  accent,
  density,
}: {
  amount: string;
  name: string;
  note?: string;
  accent: string;
  density: (typeof CONSTELLATION_DENSITY)["balanced"];
}) {
  const displayAmount = formatIngredientAmount(amount);
  const amountIsLong = displayAmount.length > 10;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: amountIsLong ? "center" : "flex-start",
        paddingVertical: density.ingredientRowPadV,
        borderBottomWidth: 0.4,
        borderBottomColor: CONSTELLATION_COLORS.divider,
        gap: 6,
      }}
    >
      {/* ✦ Stern-Bullet */}
      <Text
        style={{
          fontFamily: "Inter",
          fontSize: density.ingredientFontSize,
          color: accent,
          width: 10,
          lineHeight: amountIsLong ? 1.3 : undefined,
          paddingTop: amountIsLong ? 0 : 1,
        }}
      >
        ✦
      </Text>
      <Text
        style={{
          fontFamily: "Inter",
          fontSize: density.ingredientFontSize,
          fontWeight: 700,
          color: accent,
          width: 50,
          lineHeight: amountIsLong ? 1.3 : undefined,
          paddingTop: amountIsLong ? 0 : 1,
        }}
      >
        {displayAmount}
      </Text>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: "Inter",
            fontSize: density.ingredientFontSize,
            color: CONSTELLATION_COLORS.inkPrimary,
            lineHeight: 1.3,
          }}
        >
          {name}
        </Text>
        {note ? (
          <Text
            style={{
              fontFamily: "Inter",
              fontSize: density.ingredientNoteFontSize,
              fontStyle: "italic",
              color: CONSTELLATION_COLORS.inkSubtle,
              marginTop: 1,
            }}
          >
            {note}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function ConstellationTrajectory({
  steps,
  accent,
  density,
}: {
  steps: { num: number; text: string }[];
  accent: string;
  density: (typeof CONSTELLATION_DENSITY)["balanced"];
}) {
  if (steps.length === 0) return null;
  // Bei kompakten Layouts/vielen Schritten: 2-Spalten Grid statt einer Linie.
  // Bei wenigen Schritten (≤4): horizontale Trajectory-Linie mit Stationen.
  const useTrajectoryLine = steps.length <= 4;

  if (useTrajectoryLine) {
    return (
      <View>
        {/* Trajectory-Linie mit Station-Markern */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginVertical: 6,
            paddingHorizontal: 4,
          }}
        >
          {steps.map((step, i) => (
            <View
              key={`tr-${step.num}`}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              {i > 0 ? (
                <View
                  style={{
                    flex: 1,
                    height: 0.75,
                    backgroundColor: accent,
                    opacity: 0.55,
                  }}
                />
              ) : null}
              <Svg width={10} height={10}>
                <Circle cx={5} cy={5} r={4} fill={accent} />
                <Circle
                  cx={5}
                  cy={5}
                  r={4.6}
                  fill="none"
                  stroke={accent}
                  strokeWidth={0.6}
                  opacity={0.55}
                />
              </Svg>
              {i < steps.length - 1 ? (
                <View
                  style={{
                    flex: 1,
                    height: 0.75,
                    backgroundColor: accent,
                    opacity: 0.55,
                  }}
                />
              ) : null}
            </View>
          ))}
        </View>
        {/* Step-Inhalt in einer Row mit gleichen Spalten */}
        <View
          style={{
            flexDirection: "row",
            gap: 10,
            marginTop: 4,
          }}
        >
          {steps.map((step) => (
            <View key={`txt-${step.num}`} style={{ flex: 1 }}>
              {/* Number + Body: gleiche font/fontSize/lineHeight (§1) */}
              <Text
                style={{
                  fontSize: density.stepFontSize,
                  lineHeight: 1.45,
                  fontStyle: "italic",
                  fontWeight: 700,
                  color: accent,
                  marginBottom: 2,
                }}
              >
                {pad2(step.num)}
              </Text>
              <Text
                style={{
                  fontSize: density.stepFontSize,
                  lineHeight: 1.45,
                  color: CONSTELLATION_COLORS.inkPrimary,
                }}
              >
                {step.text}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  // Mehr als 4 Schritte: 2-Spalten Grid mit ●-Stations und italic Nummern (§1)
  const half = Math.ceil(steps.length / 2);
  const colA = steps.slice(0, half);
  const colB = steps.slice(half);
  return (
    <View style={{ flexDirection: "row", gap: 20 }}>
      <ConstellationStepColumn steps={colA} accent={accent} density={density} />
      <View
        style={{
          width: 0.5,
          backgroundColor: CONSTELLATION_COLORS.divider,
          marginVertical: 4,
        }}
      />
      {colB.length > 0 ? (
        <ConstellationStepColumn
          steps={colB}
          accent={accent}
          density={density}
        />
      ) : (
        <View style={{ flex: 1 }} />
      )}
    </View>
  );
}

function ConstellationStepColumn({
  steps,
  accent,
  density,
}: {
  steps: { num: number; text: string }[];
  accent: string;
  density: (typeof CONSTELLATION_DENSITY)["balanced"];
}) {
  return (
    <View style={{ flex: 1 }}>
      {steps.map((step) => (
        <View
          key={`s-${step.num}`}
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 8,
            marginBottom: density.stepMarginBottom + 2,
          }}
        >
          {/* Step-Nummer mit Glyph-Center-Lock (§1) */}
          <Text
            style={{
              fontSize: density.stepFontSize,
              lineHeight: 1.45,
              fontStyle: "italic",
              fontWeight: 700,
              color: accent,
              width: 18,
            }}
          >
            {pad2(step.num)}
          </Text>
          <Text
            style={{
              flex: 1,
              fontSize: density.stepFontSize,
              lineHeight: 1.45,
              color: CONSTELLATION_COLORS.inkPrimary,
            }}
          >
            {step.text}
          </Text>
        </View>
      ))}
    </View>
  );
}

// "Fuer" nur bei den/die/das — LAYOUT_RULES.md §5
function constellationGroupLabel(name: string): string {
  return /^(den|die|das)\s/i.test(name)
    ? `Für ${name.toLowerCase()}`
    : name;
}

// Deterministische Background-Sterne basierend auf Recipe-Slug-Hash.
// LCG-PRNG damit dieselbe Karte beim Re-Render dieselben Sterne hat.
function buildConstellationStars(seed: string): {
  x: number;
  y: number;
  r: number;
  opacity: number;
}[] {
  let s = 0;
  for (let i = 0; i < seed.length; i++) {
    s = (s * 31 + seed.charCodeAt(i)) >>> 0;
  }
  // Mulberry32-Variante als kleines PRNG
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const stars: { x: number; y: number; r: number; opacity: number }[] = [];
  // 80 Sterne über die ganze Seite
  for (let i = 0; i < 80; i++) {
    const x = rand() * 595;
    const y = rand() * 842;
    const r = 0.3 + rand() * 0.9;
    const opacity = 0.18 + rand() * 0.45;
    stars.push({ x, y, r, opacity });
  }
  return stars;
}

// ═════════════════════════════════════════════════════════════════════════════
// LAYOUT 11 (Phase C): RESTAURANT MENU — Fine-Dining-Speisekarte
// ═════════════════════════════════════════════════════════════════════════════
// Komplett andere Design-Sprache als alle anderen 10 Layouts. Konzept:
//
//   ┌────────────────────────────────────────────────────────────────────┐
//   │  ─────────────  LE MENU  ─────────────                              │
//   │              ◆  {BRAND_NAME}  ◆                                     │
//   │                                                                     │
//   │                  ┌─────────────┐                                    │
//   │                  │             │ ← Hero quadratisch                 │
//   │                  │    HERO     │   mit Gold-Border                  │
//   │                  │             │                                    │
//   │                  └─────────────┘                                    │
//   │                                                                     │
//   │                ENTREE · I. PLAT                                     │
//   │                                                                     │
//   │           Pasta al Limone                                           │
//   │                                                                     │
//   │      ─── ◇ ───────────────── ◇ ───                                 │
//   │                                                                     │
//   │                Subtitle italic                                      │
//   │                                                                     │
//   │           25 MIN · 300 KCAL · 4 PORTIONEN                          │
//   │                                                                     │
//   │  ──────────────────────────────────────────                        │
//   │   ZUTATEN                                                           │
//   │   ─────────                                                         │
//   │   Magerquark.....................................500 g             │
//   │   Skyr...........................................150 g             │
//   │   Frischkäse.....................................150 g             │
//   │   Creme Fine....................................200 ml             │
//   │                                                                     │
//   │   ZUBEREITUNG                                                       │
//   │   ────────────                                                      │
//   │   I.   Magerquark, Schmand und Creme verrühren.                    │
//   │   II.  Die Mandarinen unter die Creme heben.                       │
//   │   III. Eine Schicht der Löffelbiskuits einlegen.                   │
//   │   IV.  Den Pudding gleichmäßig verteilen.                          │
//   │                                                                     │
//   │      ─── ◇ ─── WINE NOTES ─── ◇ ───                                │
//   │                                                                     │
//   │   Reich an Vitamin C, Calcium und Eisen, frisch und                │
//   │   fokussiert wie ein leichter Sommerwein.                          │
//   │                                                                     │
//   │   VITAMIN C 44%  ·  CALCIUM 28%  ·  EISEN 23%                       │
//   │                                                                     │
//   │  ──────────────────────────────────────────                        │
//   │  @handle · pack                                          [QR]       │
//   └────────────────────────────────────────────────────────────────────┘
//
// Mikros in EIGENER Position vs allen anderen Layouts:
//   - vinyl: Audio-Spec-Strip oben
//   - editorial: Banner ueber Hero
//   - patisserie: Vertikale Liste in Sidebar
//   - vital: Pearl-Strip mittig
//   - amber: Vertikale Bars rechts
//   - minimal: Capsule-Pills horizontal
//   - dashboard: Data-Rows mit Icons
//   - sport: Macro-Bars mit Emojis
//   - newspaper: Spreadsheet-Footer-Row mit Doppellinien
//   - constellation: Planet-Column rechts neben Hero
//   - restaurant: Italic "Wine Notes"-Block unten — als beschreibender Satz
//                  ("Reich an X, Y, Z, frisch wie ein Sommerwein") plus
//                  dezenter Subline mit %-Werten. Kein Grid, keine Tabelle.
//
// Background ist hardcoded `#fcf9f3` (Cream), Gold `#b08842` als Ornament-
// Akzent (◆ Diamanten, Wine-Notes-Trennlinien, Hero-Border) plus theme.accent
// fuer Pack-Mood-Akzent (Title-Highlights, Section-Headers).
//
// Anti-Patterns aus LAYOUT_RULES.md alle adressiert.

const RESTAURANT_COLORS = {
  bg: "#fcf9f3",
  paper: "#f5f1e8",
  ink: "#2c2418",
  inkSoft: "#665544",
  inkSubtle: "#9a8a76",
  gold: "#b08842",
  goldSoft: "#d4b478",
  divider: "#d8cdb8",
} as const;

// Kleine Diamond-Glyph als SVG. Unicode ◆/◇ rendert in Fraunces/Inter
// als Replacement-Char (Æ/ç), weil die Fonts keine Diamond-Glyphen haben.
// SVG umgeht das komplett — pixelgenau, Druck-sicher, scaliert. Re-used
// by foreword-page.tsx via named import — kein Duplikat noetig.
export function GoldDiamond({
  size = 6,
  outline = false,
  color = RESTAURANT_COLORS.gold,
}: {
  size?: number;
  outline?: boolean;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 10 10">
      <Path
        d="M5 0 L10 5 L5 10 L0 5 Z"
        fill={outline ? "none" : color}
        stroke={outline ? color : "none"}
        strokeWidth={outline ? 1.4 : 0}
      />
    </Svg>
  );
}

const RESTAURANT_DENSITY: Record<
  Density,
  {
    heroSize: number;
    titleFontSize: number;
    eyebrowFontSize: number;
    subtitleFontSize: number;
    specFontSize: number;
    ingredientFontSize: number;
    ingredientRowPadV: number;
    ingredientNoteFontSize: number;
    stepFontSize: number;
    stepMarginBottom: number;
    sectionLabelFontSize: number;
    wineNotesFontSize: number;
    topPadding: number;
    sectionGap: number;
  }
> = {
  // Compact: aggressive Kompaktheit fuer Recipes >= 14 Zutaten oder >= 8
  // Schritten. Sweet-Balance "Donauwellen im Glas" (10 Zutaten + 9
  // Schritte) und "Himbeer Tiramisu" (14 Zutaten + 6 Schritte mit 3
  // Gruppen) muessen mit dem 2-zeiligen Spec-Strip (incl. Makros) auf
  // EINE A4-Seite passen.
  compact: {
    heroSize: 95,
    titleFontSize: 21,
    eyebrowFontSize: 7,
    subtitleFontSize: 8.5,
    specFontSize: 8,
    ingredientFontSize: 8.5,
    ingredientRowPadV: 1.4,
    ingredientNoteFontSize: 6.5,
    stepFontSize: 8.5,
    stepMarginBottom: 3,
    sectionLabelFontSize: 7.5,
    wineNotesFontSize: 9,
    topPadding: 8,
    sectionGap: 6,
  },
  balanced: {
    heroSize: 140,
    titleFontSize: 26,
    eyebrowFontSize: 7.5,
    subtitleFontSize: 10,
    specFontSize: 8.5,
    ingredientFontSize: 9.5,
    ingredientRowPadV: 2.5,
    ingredientNoteFontSize: 7,
    stepFontSize: 9.5,
    stepMarginBottom: 5,
    sectionLabelFontSize: 8,
    wineNotesFontSize: 10.5,
    topPadding: 14,
    sectionGap: 10,
  },
  spacious: {
    heroSize: 165,
    titleFontSize: 30,
    eyebrowFontSize: 8,
    subtitleFontSize: 11,
    specFontSize: 9,
    ingredientFontSize: 10,
    ingredientRowPadV: 4,
    ingredientNoteFontSize: 7.5,
    stepFontSize: 10,
    stepMarginBottom: 7,
    sectionLabelFontSize: 8.5,
    wineNotesFontSize: 12,
    topPadding: 20,
    sectionGap: 14,
  },
};

// Fixed-Höhe für die Bottom-Stack (Wine-Notes + Footer). Content-Body
// reserviert diesen Platz via paddingBottom, damit Zutaten/Steps NIE
// unter die Wine-Notes laufen. Wert grosszuegig gewaehlt — bei 3 Mikros
// + Beschreibungssatz ist Wine-Notes ca 50pt, Footer ca 40pt, plus 22
// Bottom-Padding der Page.
const RESTAURANT_BOTTOM_RESERVE = 130;

// Roman-Numerals fuer Steps. Bis L (50) ist mehr als genug — kein Rezept
// hat 50 Schritte. Format: "I", "II", "III", "IV", ... ohne Punkt
// (Punkt kommt vom Renderer als Suffix, damit "IV." richtig aussieht).
function toRoman(n: number): string {
  const r: [number, string][] = [
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let out = "";
  let v = n;
  for (const [val, sym] of r) {
    while (v >= val) {
      out += sym;
      v -= val;
    }
  }
  return out;
}

// Wine-Notes-Satz aus den Top-Mikros + Recipe-Charakter generieren.
// Keine Em/En-dashes (LAYOUT_RULES §8) — nur Komma + Punkt.
function buildWineNotes(micros: Micronutrient[], recipe: Recipe): string {
  if (micros.length === 0) return "";
  const names = micros.map((m) => m.name);
  const microPart =
    names.length === 1
      ? `Reich an ${names[0]}`
      : names.length === 2
        ? `Reich an ${names[0]} und ${names[1]}`
        : `Reich an ${names.slice(0, -1).join(", ")} und ${names[names.length - 1]}`;

  const tags = (recipe.tags ?? []).map((t) => t.toLowerCase());
  let character: string;
  if (tags.some((t) => t.includes("dessert") || t.includes("süß") || t.includes("kuchen"))) {
    character = "süß und vollmundig wie ein edler Dessertwein";
  } else if (tags.some((t) => t.includes("protein") || t.includes("high-protein"))) {
    character = "kräftig und sättigend wie ein vollmundiger Roter";
  } else if (tags.some((t) => t.includes("vegan") || t.includes("salat") || t.includes("bowl"))) {
    character = "frisch und fokussiert wie ein leichter Sommerwein";
  } else if (tags.some((t) => t.includes("mealprep"))) {
    character = "ausgewogen und harmonisch wie ein klassischer Cuvée";
  } else if (tags.some((t) => t.includes("snack"))) {
    character = "spritzig und unkompliziert wie ein junger Schaumwein";
  } else {
    character = "ausgewogen und feinsinnig wie ein gut gereifter Jahrgang";
  }
  return `${microPart}, ${character}.`;
}

function RestaurantPage({
  brand,
  pack,
  recipe,
  totalRecipes,
  heroDataUri,
  qrDataUri,
  hideRecipeIndex,
}: RecipeCardPdfProps) {
  const theme = packTheme(pack);
  const density = getDensity(recipe);
  const D = RESTAURANT_DENSITY[density];
  const showStory = shouldShowStory(recipe);
  const recipePosition = recipe.number;
  const titleSafe = softWrapTitle(recipe.title);

  const ingredientGroups = groupIngredients(recipe.ingredients);
  const flatIngredients = ingredientGroups.flatMap((g) => g.items);

  const stepGroups = groupSteps(recipe.steps);
  const flatSteps: { num: number; text: string }[] = [];
  let runningStep = 0;
  for (const g of stepGroups) {
    for (const item of g.items) {
      runningStep += 1;
      flatSteps.push({ num: runningStep, text: item.text });
    }
  }

  const topMicros = visibleMicros(recipe)
    .slice()
    .sort(
      (a: Micronutrient, b: Micronutrient) =>
        (b.pctDaily ?? 0) - (a.pctDaily ?? 0)
    )
    .slice(0, 3);

  const time = totalTime(recipe);
  const wineNotes = buildWineNotes(topMicros, recipe);
  // Roman-Width adaptiv: ab 10 Schritten wird "XIII." breit
  const romanWidth = flatSteps.length >= 10 ? 32 : 22;

  return (
    <Page
      size="A4"
      style={{
        backgroundColor: RESTAURANT_COLORS.bg,
        fontFamily: "Fraunces",
        color: RESTAURANT_COLORS.ink,
      }}
    >
      {/* ── Masthead ── */}
      <View
        style={{
          paddingHorizontal: PAGE_PADDING,
          paddingTop: D.topPadding,
          alignItems: "center",
        }}
      >
        {/* Ornamental Top-Rule mit Pack-Title + Recipe-Index */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            width: "100%",
          }}
        >
          <View
            style={{
              flex: 1,
              height: 0.5,
              backgroundColor: RESTAURANT_COLORS.gold,
            }}
          />
          <Text
            style={{
              fontFamily: "Inter",
              fontSize: 7.5,
              fontWeight: 700,
              letterSpacing: 3,
              color: RESTAURANT_COLORS.gold,
              textTransform: "uppercase",
            }}
          >
            Le Menu
          </Text>
          <View
            style={{
              flex: 1,
              height: 0.5,
              backgroundColor: RESTAURANT_COLORS.gold,
            }}
          />
        </View>
        {/* Brand-Mark zwischen zwei SVG-Diamanten */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            marginTop: 8,
          }}
        >
          <GoldDiamond size={6} />
          <Text
            style={{
              fontFamily: "Fraunces",
              fontSize: 11,
              fontStyle: "italic",
              fontWeight: 600,
              letterSpacing: 2,
              color: RESTAURANT_COLORS.ink,
              textTransform: "uppercase",
            }}
          >
            {brand.name}
          </Text>
          <GoldDiamond size={6} />
        </View>
        {/* Pack-Title + Index als sehr feine Sub-Eyebrow. "N°"-Praefix
            weg fuer kompakteren Header — die /-Separation macht die
            Nummerierung schon klar genug. */}
        <Text
          style={{
            fontFamily: "Inter",
            fontSize: 6,
            letterSpacing: 1.6,
            color: RESTAURANT_COLORS.inkSubtle,
            textTransform: "uppercase",
            marginTop: 2,
          }}
        >
          {pack.title}
          {!hideRecipeIndex
            ? `  ·  ${pad2(recipePosition)} / ${pad2(totalRecipes)}`
            : ""}
        </Text>
      </View>

      {/* ── Hero quadratisch mit Gold-Border ── */}
      <View
        style={{
          alignItems: "center",
          paddingTop: density === "compact" ? 6 : 14,
        }}
      >
        <View
          style={{
            width: D.heroSize + 8,
            height: D.heroSize + 8,
            padding: 4,
            borderWidth: 0.75,
            borderColor: RESTAURANT_COLORS.gold,
          }}
        >
          <View
            style={{
              width: D.heroSize,
              height: D.heroSize,
              overflow: "hidden",
              backgroundColor: RESTAURANT_COLORS.paper,
            }}
          >
            {heroDataUri ? (
              <Image
                src={heroDataUri}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <View
                style={{
                  width: "100%",
                  height: "100%",
                  backgroundColor: theme.accent,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    fontFamily: "Fraunces",
                    fontSize: 80,
                    fontWeight: 700,
                    fontStyle: "italic",
                    color: "#fafafa",
                  }}
                >
                  {brand.name.charAt(0)}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* ── Title-Block ── */}
      <View
        style={{
          alignItems: "center",
          paddingHorizontal: 56, // Title bleibt etwas eingerueckt fuer
          // schoeneres center-aligned-Lesegefuehl; nur Content-Body
          // unten nutzt full PAGE_PADDING fuer maximale Zeilenbreite.
          paddingTop: density === "compact" ? 4 : 10,
        }}
      >
        {/* Eyebrow: Kategorie + Roman-Position */}
        <Text
          style={{
            fontFamily: "Inter",
            fontSize: D.eyebrowFontSize,
            fontWeight: 600,
            letterSpacing: 3,
            color: RESTAURANT_COLORS.gold,
            textTransform: "uppercase",
            marginBottom: density === "compact" ? 3 : 5,
          }}
        >
          {pack.category}
          {!hideRecipeIndex ? `  ·  ${toRoman(recipePosition)}. Gang` : ""}
        </Text>
        {/* Italic Title in serif */}
        <Text
          style={{
            fontFamily: "Fraunces",
            fontSize: D.titleFontSize,
            fontStyle: "italic",
            fontWeight: 600,
            color: RESTAURANT_COLORS.ink,
            textAlign: "center",
            lineHeight: 1.1,
            letterSpacing: 0.3,
          }}
        >
          {titleSafe}
        </Text>
        {/* Ornamental Rule unter Title */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            marginTop: density === "compact" ? 4 : 7,
            marginBottom: density === "compact" ? 4 : 7,
          }}
        >
          <View
            style={{
              width: 40,
              height: 0.5,
              backgroundColor: RESTAURANT_COLORS.gold,
            }}
          />
          <GoldDiamond size={6} outline />
          <View
            style={{
              width: 40,
              height: 0.5,
              backgroundColor: RESTAURANT_COLORS.gold,
            }}
          />
        </View>
        {recipe.subtitle ? (
          <Text
            style={{
              fontFamily: "Fraunces",
              fontSize: D.subtitleFontSize,
              fontStyle: "italic",
              color: RESTAURANT_COLORS.inkSoft,
              textAlign: "center",
              lineHeight: 1.4,
              maxWidth: 380,
            }}
          >
            {recipe.subtitle}
          </Text>
        ) : null}
        {/* Spec-Strip — Zeile 1: ZEIT · KCAL · PORTIONEN. Zeile 2: die
            drei verbleibenden Makros (Protein/KH/Fett). User-Feedback
            Sweet-Balance-Review: Makros muessen sichtbar sein, nicht nur
            in der Wine-Notes-Box unten. Aber alles soll auf eine Seite
            passen — daher Zeile 2 etwas kleiner und mit kleinerem
            marginTop. */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "baseline",
            gap: 10,
            marginTop: 8,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              fontFamily: "Inter",
              fontSize: D.specFontSize,
              fontWeight: 700,
              letterSpacing: 2,
              color: RESTAURANT_COLORS.ink,
              textTransform: "uppercase",
            }}
          >
            {time} Min
          </Text>
          <Text style={{ fontSize: 7, color: RESTAURANT_COLORS.gold }}>·</Text>
          <Text
            style={{
              fontFamily: "Inter",
              fontSize: D.specFontSize,
              fontWeight: 700,
              letterSpacing: 2,
              color: RESTAURANT_COLORS.ink,
              textTransform: "uppercase",
            }}
          >
            {Math.round(recipe.nutrition.kcal)} Kcal
          </Text>
          <Text style={{ fontSize: 7, color: RESTAURANT_COLORS.gold }}>·</Text>
          <Text
            style={{
              fontFamily: "Inter",
              fontSize: D.specFontSize,
              fontWeight: 700,
              letterSpacing: 2,
              color: RESTAURANT_COLORS.ink,
              textTransform: "uppercase",
            }}
          >
            {servingsCountLabel(recipe)}
          </Text>
        </View>
        {/* Spec-Strip Zeile 2: Makros (Protein/KH/Fett). Dezenter Farbton
            (inkSoft statt ink), gleiche font-size — visuell als Sub-
            Zeile lesbar. Werte als "18g · 24g · 5g" mit dezenten Labels
            davor. */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "baseline",
            gap: 8,
            marginTop: 5,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              fontFamily: "Inter",
              fontSize: D.specFontSize - 1,
              fontWeight: 600,
              letterSpacing: 1.6,
              color: RESTAURANT_COLORS.inkSoft,
              textTransform: "uppercase",
            }}
          >
            <Text style={{ color: RESTAURANT_COLORS.gold }}>Protein </Text>
            {recipe.nutrition.protein}g
          </Text>
          <Text style={{ fontSize: 6, color: RESTAURANT_COLORS.gold }}>·</Text>
          <Text
            style={{
              fontFamily: "Inter",
              fontSize: D.specFontSize - 1,
              fontWeight: 600,
              letterSpacing: 1.6,
              color: RESTAURANT_COLORS.inkSoft,
              textTransform: "uppercase",
            }}
          >
            <Text style={{ color: RESTAURANT_COLORS.gold }}>Kohlenh. </Text>
            {recipe.nutrition.carbs}g
          </Text>
          <Text style={{ fontSize: 6, color: RESTAURANT_COLORS.gold }}>·</Text>
          <Text
            style={{
              fontFamily: "Inter",
              fontSize: D.specFontSize - 1,
              fontWeight: 600,
              letterSpacing: 1.6,
              color: RESTAURANT_COLORS.inkSoft,
              textTransform: "uppercase",
            }}
          >
            <Text style={{ color: RESTAURANT_COLORS.gold }}>Fett </Text>
            {recipe.nutrition.fat}g
          </Text>
        </View>
      </View>

      {/* ── Content-Body: Zutaten + Zubereitung. paddingBottom reserviert
            Platz fuer den fixed Wine-Notes+Footer-Stack damit Zutaten/
            Steps NIE darunter laufen. paddingHorizontal von 56 zu
            PAGE_PADDING (36) reduziert — mehr Breite fuer Zutaten-Dot-
            Leader und 9+ Step-Texte ohne overflow. ── */}
      <View
        style={{
          paddingHorizontal: PAGE_PADDING,
          paddingBottom: RESTAURANT_BOTTOM_RESERVE,
        }}
      >
        {/* Zutaten mit Dot-Leader */}
        <View style={{ marginTop: D.sectionGap + 4 }}>
          <RestaurantSectionHeader
            label="Zutaten"
            right={`${recipe.ingredients.length} ${recipe.ingredients.length === 1 ? "Zutat" : "Zutaten"}`}
            density={D}
          />
          {ingredientGroups.length > 1 ? (
            <View>
              {ingredientGroups.map((group, gIdx) => (
                <View key={`g-${gIdx}`} style={{ marginTop: gIdx > 0 ? 6 : 2 }}>
                  {group.name ? (
                    <Text
                      style={{
                        fontFamily: "Fraunces",
                        fontSize: 8,
                        fontStyle: "italic",
                        letterSpacing: 1.4,
                        color: RESTAURANT_COLORS.gold,
                        textTransform: "uppercase",
                        marginBottom: 3,
                        marginTop: 2,
                      }}
                    >
                      {restaurantGroupLabel(group.name)}
                    </Text>
                  ) : null}
                  {group.items.map((ing, i) => (
                    <RestaurantIngredientRow
                      key={`gi-${gIdx}-${i}`}
                      amount={ing.amount}
                      name={ing.name}
                      note={ing.note}
                      density={D}
                    />
                  ))}
                </View>
              ))}
            </View>
          ) : (
            <View>
              {flatIngredients.map((ing, i) => (
                <RestaurantIngredientRow
                  key={`fi-${i}`}
                  amount={ing.amount}
                  name={ing.name}
                  note={ing.note}
                  density={D}
                />
              ))}
            </View>
          )}
        </View>

        {/* Zubereitung mit Roman-Numerals */}
        <View style={{ marginTop: D.sectionGap + 2 }}>
          <RestaurantSectionHeader
            label="Zubereitung"
            right={`${flatSteps.length} ${flatSteps.length === 1 ? "Schritt" : "Schritte"}`}
            density={D}
          />
          <View>
            {flatSteps.map((step) => (
              <View
                key={`s-${step.num}`}
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: 6,
                  marginBottom: D.stepMarginBottom,
                }}
              >
                {/* Roman-Numeral mit Glyph-Center-Lock §1 */}
                <Text
                  style={{
                    fontSize: D.stepFontSize,
                    lineHeight: 1.45,
                    fontStyle: "italic",
                    fontWeight: 600,
                    color: RESTAURANT_COLORS.gold,
                    width: romanWidth,
                  }}
                >
                  {toRoman(step.num)}.
                </Text>
                <Text
                  style={{
                    flex: 1,
                    fontFamily: "Fraunces",
                    fontSize: D.stepFontSize,
                    lineHeight: 1.45,
                    color: RESTAURANT_COLORS.ink,
                  }}
                >
                  {step.text}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Sparse-Story-Block — fuellt die Whitespace auf duennen Karten.
            Nur bei spacious density (score <= 14, z.B. Crema mit 1 Schritt
            oder 0-Punkte-Eis mit 3 Schritten): da ist garantiert genug
            Platz, der Pull-Quote laeuft nie unter den fixed Genussprofil-
            Stack. balanced/compact Karten fuellen die Seite schon ueber
            Steps + Zutaten und brauchen ihn nicht. */}
        {showStory && density === "spacious" ? (
          <View
            style={{
              marginTop: D.sectionGap - 2,
              borderLeftWidth: 1.5,
              borderLeftColor: RESTAURANT_COLORS.gold,
              paddingLeft: 10,
              paddingVertical: 2,
            }}
          >
            <Text
              style={{
                fontFamily: "Fraunces",
                fontSize: 9.5,
                fontStyle: "italic",
                color: RESTAURANT_COLORS.inkSoft,
                lineHeight: 1.45,
              }}
            >
              {recipe.description}
            </Text>
          </View>
        ) : null}
      </View>

      {/* ── Genussprofil (Mikronaehrstoffe) als FIXED bottom-stack.
            Sitzt oberhalb vom Footer und unterhalb vom Content. Reserviert
            durch RESTAURANT_BOTTOM_RESERVE-paddingBottom auf dem Content-
            Wrapper, damit Zutaten/Steps nie hier reinlaufen. ── */}
      {topMicros.length > 0 ? (
        <View
          style={{
            position: "absolute",
            left: PAGE_PADDING,
            right: PAGE_PADDING,
            bottom: 72,
          }}
          fixed
        >
          {/* Ornamental Section-Header mit SVG-Diamond */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              justifyContent: "center",
              marginBottom: 6,
            }}
          >
            <View
              style={{
                flex: 1,
                height: 0.5,
                backgroundColor: RESTAURANT_COLORS.gold,
              }}
            />
            <GoldDiamond size={6} outline />
            <Text
              style={{
                fontFamily: "Inter",
                fontSize: 7.5,
                fontWeight: 700,
                letterSpacing: 3,
                color: RESTAURANT_COLORS.gold,
                textTransform: "uppercase",
              }}
            >
              Genussprofil
            </Text>
            <GoldDiamond size={6} outline />
            <View
              style={{
                flex: 1,
                height: 0.5,
                backgroundColor: RESTAURANT_COLORS.gold,
              }}
            />
          </View>
          <Text
            style={{
              fontFamily: "Fraunces",
              fontSize: D.wineNotesFontSize,
              fontStyle: "italic",
              color: RESTAURANT_COLORS.ink,
              textAlign: "center",
              lineHeight: 1.4,
              letterSpacing: 0.2,
              marginBottom: 6,
            }}
          >
            {wineNotes}
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "baseline",
              gap: 10,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            {topMicros.map((m: Micronutrient, i: number) => (
              <View
                key={`wn-${i}`}
                style={{
                  flexDirection: "row",
                  alignItems: "baseline",
                  gap: 4,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Inter",
                    fontSize: 7.5,
                    fontWeight: 600,
                    letterSpacing: 1.8,
                    color: RESTAURANT_COLORS.gold,
                    textTransform: "uppercase",
                  }}
                >
                  {m.name}
                </Text>
                {typeof m.pctDaily === "number" ? (
                  <Text
                    style={{
                      fontFamily: "Inter",
                      fontSize: 8,
                      fontWeight: 700,
                      color: RESTAURANT_COLORS.ink,
                    }}
                  >
                    {m.pctDaily}%
                  </Text>
                ) : null}
                {i < topMicros.length - 1 ? (
                  <Text
                    style={{
                      fontSize: 7,
                      color: RESTAURANT_COLORS.gold,
                      marginLeft: 6,
                    }}
                  >
                    ·
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
          <Text
            style={{
              fontFamily: "Inter",
              fontSize: 6.5,
              letterSpacing: 1.4,
              color: RESTAURANT_COLORS.inkSubtle,
              textTransform: "uppercase",
              textAlign: "center",
              marginTop: 3,
            }}
          >
            {nutritionBasisInline(recipe.nutritionBasis)}
          </Text>
        </View>
      ) : null}

      {/* ── Footer mit QR ── */}
      <View
        style={{
          position: "absolute",
          left: PAGE_PADDING,
          right: PAGE_PADDING,
          bottom: 22,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: 8,
          borderTopWidth: 0.5,
          borderTopColor: RESTAURANT_COLORS.divider,
          gap: 12,
        }}
        fixed
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <GoldDiamond size={8} />
          <Text
            style={{
              fontFamily: "Inter",
              fontSize: 8,
              fontWeight: 600,
              letterSpacing: 1.6,
              color: RESTAURANT_COLORS.inkSoft,
              textTransform: "uppercase",
            }}
          >
            {brand.handle} · {pack.title}
          </Text>
        </View>
        {qrDataUri ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text
              style={{
                fontFamily: "Inter",
                fontSize: 7,
                letterSpacing: 1.2,
                color: RESTAURANT_COLORS.inkSubtle,
                textTransform: "uppercase",
                textAlign: "right",
              }}
            >
              Scan{"\n"}für{"\n"}Original
            </Text>
            <Image src={qrDataUri} style={{ width: 32, height: 32 }} />
          </View>
        ) : (
          <Text
            style={{
              fontFamily: "Inter",
              fontSize: 7.5,
              letterSpacing: 1.4,
              color: RESTAURANT_COLORS.inkSubtle,
              textTransform: "uppercase",
            }}
          >
            {recipe.sourceLabel ?? "Originalrezept"}
          </Text>
        )}
      </View>
    </Page>
  );
}

// ─── Restaurant Sub-Components ────────────────────────────────────────────

function RestaurantSectionHeader({
  label,
  right,
  density,
}: {
  label: string;
  right: string;
  density: (typeof RESTAURANT_DENSITY)["balanced"];
}) {
  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "baseline",
          gap: 8,
        }}
      >
        <Text
          style={{
            fontFamily: "Inter",
            fontSize: density.sectionLabelFontSize,
            fontWeight: 700,
            letterSpacing: 2.6,
            color: RESTAURANT_COLORS.ink,
            textTransform: "uppercase",
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            fontFamily: "Fraunces",
            fontSize: density.sectionLabelFontSize,
            fontStyle: "italic",
            color: RESTAURANT_COLORS.inkSubtle,
          }}
        >
          {right}
        </Text>
      </View>
      <View
        style={{
          height: 0.5,
          backgroundColor: RESTAURANT_COLORS.gold,
          marginTop: 3,
          marginBottom: 6,
        }}
      />
    </View>
  );
}

function RestaurantIngredientRow({
  amount,
  name,
  note,
  density,
}: {
  amount: string;
  name: string;
  note?: string;
  density: (typeof RESTAURANT_DENSITY)["balanced"];
}) {
  const displayAmount = formatIngredientAmount(amount);
  const amountIsLong = displayAmount.length > 10;
  // Dot-Leader: ein langer "·"-String mit fixer Färbung, durch overflow im
  // mittleren View clipped. Funktioniert in react-pdf zuverlaessig — eine
  // dotted-Border wird nicht von allen PDF-Renderern korrekt dargestellt.
  return (
    <View
      style={{
        paddingVertical: density.ingredientRowPadV,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: amountIsLong ? "center" : "flex-end",
          gap: 4,
        }}
      >
        <Text
          style={{
            fontFamily: "Fraunces",
            fontSize: density.ingredientFontSize,
            color: RESTAURANT_COLORS.ink,
            lineHeight: 1.3,
          }}
        >
          {name}
        </Text>
        {/* Dot-Leader-Mitte: overflow hidden damit langer String genau die
            freie Breite fuellt */}
        <View
          style={{
            flex: 1,
            overflow: "hidden",
            paddingBottom: 2,
          }}
        >
          <Text
            style={{
              fontFamily: "Inter",
              fontSize: density.ingredientFontSize - 1,
              color: RESTAURANT_COLORS.gold,
              opacity: 0.55,
              letterSpacing: 2.5,
            }}
            // Hint an react-pdf: keine Zeilenumbrueche im Dot-String
            wrap={false}
          >
            {"·".repeat(80)}
          </Text>
        </View>
        <Text
          style={{
            fontFamily: "Inter",
            fontSize: density.ingredientFontSize,
            fontWeight: 600,
            color: RESTAURANT_COLORS.ink,
            lineHeight: amountIsLong ? 1.3 : undefined,
            paddingTop: amountIsLong ? 0 : 1,
            textAlign: "right",
          }}
        >
          {displayAmount}
        </Text>
      </View>
      {note ? (
        <Text
          style={{
            fontFamily: "Fraunces",
            fontSize: density.ingredientNoteFontSize,
            fontStyle: "italic",
            color: RESTAURANT_COLORS.inkSubtle,
            marginTop: 1,
          }}
        >
          {note}
        </Text>
      ) : null}
    </View>
  );
}

// "Fuer" nur bei den/die/das — LAYOUT_RULES.md §5
function restaurantGroupLabel(name: string): string {
  return /^(den|die|das)\s/i.test(name)
    ? `Für ${name.toLowerCase()}`
    : name;
}
