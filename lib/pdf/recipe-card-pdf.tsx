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
            Bienes Story
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
          Mikronährstoffe {nutritionBasisInline(recipe.nutritionBasis)} · % Tagesbedarf
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
  // "Virale KI-Suesskartoffel-Muffins" am Rand abgeschnitten. Die
  // Skala bringt den Titel selbst bei 32+ Zeichen sicher in 2-3 Zeilen.
  const titleLen = recipe.title.length;
  const titleFontSize =
    titleLen <= 18
      ? d.titleFontSize
      : titleLen <= 24
        ? Math.max(d.titleFontSize - 4, 18)
        : titleLen <= 30
          ? Math.max(d.titleFontSize - 8, 16)
          : Math.max(d.titleFontSize - 12, 14);

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
              {recipe.title}
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
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    overflow: "hidden",
                    borderWidth: 1.5,
                    borderColor: t.accent,
                  }}
                >
                  <Image
                    src={avatarDataUri}
                    style={{ width: 37, height: 37, objectFit: "cover" }}
                  />
                </View>
              ) : null}
              <View style={{ flex: 1 }}>
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
        <View
          style={{
            flex: 1,
            backgroundColor: "#ffffff",
            paddingHorizontal: 32,
            paddingTop: 32,
            paddingBottom: 24,
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

          {/* Bienes Story — nur bei wirklich kurzen Recipes (spacious-
              Density), wo Body-Hoehe Reserve hat. Bei mittel+langen
              Recipes braucht der Body den Platz fuer Zutaten + Steps. */}
          {showStoryHere ? (
            <View
              style={{
                marginTop: 14,
                paddingTop: 12,
                paddingBottom: 12,
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

          {/* MAN NEHME — full ingredients list with sub-group headers */}
          <View style={{ marginTop: 18 }}>
            <SectionHeader label="Man nehme" theme={t} italic />
            <IngredientsList
              grouped={grouped}
              theme={t}
              rowPadV={d.ingRowPadV}
              nameFontSize={d.ingFontSize}
              noteFontSize={d.ingNoteFontSize}
            />
          </View>

          {/* ZUBEREITUNG — numbered steps */}
          <View style={{ marginTop: 14 }}>
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
}: RecipeCardPdfProps) {
  const t = packTheme(pack);
  const time = totalTime(recipe);
  const pl = recipe.servings === 1 ? "Portion" : "Stücke";
  const stueckSing = recipe.servings === 1 ? "Portion" : "Stück";
  const density = getDensity(recipe);
  const d = MINIMAL_DENSITY[density];
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

          {/* Dunkler Gradient unten — echter SVG linear-gradient damit
              der Uebergang weich ist, statt einer harten Trennlinie wie
              bei einem semi-transparent Rechteck. Das @react-pdf
              backgroundColor unterstuetzt keinen CSS-gradient, deshalb
              nutzen wir hier Svg+LinearGradient. Der Gradient laeuft von
              0.62 Opacity unten zu 0 Opacity bei 60% — Title sitzt im
              starken Bereich, der Hero-Bildinhalt darueber bleibt klar
              sichtbar. */}
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
                  id="heroGrad"
                  x1="0"
                  y1={HERO_HEIGHT}
                  x2="0"
                  y2="0"
                >
                  <Stop offset="0" stopColor="#000" stopOpacity={0.62} />
                  <Stop offset="0.45" stopColor="#000" stopOpacity={0.18} />
                  <Stop offset="1" stopColor="#000" stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <Rect
                x="0"
                y="0"
                width="595"
                height={HERO_HEIGHT}
                fill="url(#heroGrad)"
              />
            </Svg>
          </View>

          {/* Top strip — Pack-Caption + Recipe-Number, weiss */}
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
                style={{ width: 51, height: 51, objectFit: "cover" }}
              />
            </View>
          ) : null}

          {/* Title overlay unten links — Bold Inter-Tight, weiss */}
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
                opacity: 0.92,
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
            gap: 28,
            paddingHorizontal: 36,
            paddingTop: 18,
            paddingBottom: 14,
          }}
        >
          {/* MAN NEHME */}
          <View style={{ width: 200 }}>
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
                Mikronährstoffe pro {stueckSing} · % Tagesbedarf
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
                  style={{ width: 30, height: 30, objectFit: "cover" }}
                />
              </View>
            ) : null}
            <View>
              <Text
                style={{
                  fontFamily: "Fraunces",
                  fontStyle: "italic",
                  fontSize: 13,
                  color: t.ink,
                  lineHeight: 1.05,
                }}
              >
                {brand.signature}
              </Text>
              <Text
                style={{
                  fontSize: 7,
                  fontWeight: 600,
                  letterSpacing: 1.4,
                  color: t.inkSoft,
                  textTransform: "uppercase",
                  marginTop: 2,
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
  compact: {
    headPadTop: 22,
    headPadBottom: 12,
    titleFontSize: 30,
    subtitleFontSize: 12,
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
  // balanced is the legacy default — bit-identical to the previous patisserie
  // hard-coded values so the 3 mid-range Backwelt recipes (Süßkartoffel-
  // Muffins, Mini Franzbrötchen, Protein-Brot) render exactly as before.
  balanced: {
    headPadTop: 28,
    headPadBottom: 16,
    titleFontSize: 36,
    subtitleFontSize: 14,
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
  // spacious — reserved for future short bake recipes; gives the body more
  // air and a slightly larger title so the card doesn't look halbleer.
  spacious: {
    headPadTop: 34,
    headPadBottom: 20,
    titleFontSize: 40,
    subtitleFontSize: 15,
    bodyPadTop: 22,
    bodyPadBottom: 20,
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
            Bienes Story
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
            Bienes Story
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
        // sichtbaren Abstand zur vorherigen Group, sonst stoesst der
        // Sub-Group-Header an die letzte Item-Note der vorigen Group
        // (gerade in Pack 3 mit "Fuer Teig"/"Fuer Topping"/"Fuer Streusel"
        // und Notes wie "oder Obst nach Wahl" haben wir Ueberlapp gesehen).
        const isFirstGroup = gi === 0;
        const isNamedGroup = Boolean(g.name);
        return (
          <View
            key={g.name ?? `m${gi}`}
            style={{
              marginBottom: 8,
              // Header braucht Atemraum oben — bei der ersten Group nicht
              // noetig, danach verlaesslich extra padding-top.
              paddingTop: !isFirstGroup && isNamedGroup ? 10 : 0,
            }}
          >
            {g.name ? (
              <Text
                style={{
                  fontSize: 7,
                  letterSpacing: 1.4,
                  fontWeight: 700,
                  color: theme.accent,
                  marginBottom: 6,
                  textTransform: "uppercase",
                }}
              >
                Für {g.name.toLowerCase()}
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
  // any callers that haven't migrated yet.
  const padV = rowPadV ?? (compact ? 2.5 : 3.5);
  const amountFont = compact ? 7 : 7.5;
  const amountW = compact ? 38 : 50;
  const nameFont = nameFontSize ?? (compact ? 8.5 : 9.5);
  const noteFont = noteFontSize ?? (compact ? 6.5 : 7);
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
        {ing.amount}
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
                marginBottom: stepMarginBottom,
                gap: 6,
              }}
            >
              <Text
                style={{
                  fontFamily: "Fraunces",
                  fontSize: stepNumFontSize,
                  fontWeight: bold ? 700 : 400,
                  color: theme.accent,
                  width: 18,
                  lineHeight: 1,
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
        <Text
          style={{
            fontFamily: "Fraunces",
            fontSize: 13,
            fontStyle: italic ? "italic" : "normal",
            color: brand.tokens.ink,
          }}
        >
          {brand.signature}
        </Text>

        <Text
          style={{
            flex: 1,
            fontSize: 7,
            fontWeight: 500,
            letterSpacing: 1.4,
            color: brand.tokens.inkMuted,
            textTransform: "uppercase",
            textAlign: hasQr ? "right" : "right",
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
