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
import { formatIngredientAmount } from "@/lib/format-ingredient";
import {
  FEATURE_DENSITY,
  PAGE_USABLE_PT,
  featureGroupLabel,
  featurePlanIngredientColumns,
  featureMacroEntries,
  featureStepFontShrink,
  featureTitleScale,
  pickFeatureDensity,
  type FeatureDensityTier,
  type FeatureRenderMode,
} from "./feature-fit";

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
  // pack.cardLayout ist die Single Source of Truth — same rule as the web
  // renderer in components/recipe-card-full.tsx (geaendert 2026-05-19).
  // recipe.cardLayout war nur eine redundante Kopie (kein per-Card-UI), die
  // den Pack-Layout-Wechsel blockierte. Jetzt gewinnt das Pack-Layout immer;
  // recipe.cardLayout bleibt nur Fallback falls ein Pack kein Layout hat.
  const layout =
    props.pack.cardLayout ?? props.recipe.cardLayout ?? "editorial";
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
  newspaper: NewspaperPage,
  restaurant: RestaurantPage,
  studio: StudioPage,
  feature: FeaturePage,
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
  // Einheit folgt nutritionBasis — ein piece-Rezept liest "ergibt 9 Stücke",
  // nie "9 Portionen" (sonst widerspricht der Header dem "PRO STÜCK"-Tile).
  const pl =
    recipe.nutritionBasis === "piece"
      ? recipe.servings === 1
        ? "Stück"
        : "Stücke"
      : portionsLabel(recipe.servings);
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
          // Mehr Luft oben als unten: die Caps-Schrift sitzt sonst optisch
          // gedrueckt am oberen Rand (Leon-Feedback "oben weniger space als
          // unter der Schrift, wirkt gedrungen"). Asymmetrisches Padding
          // (oben > unten) zentriert den Text optisch in der Leiste.
          paddingTop: 13,
          paddingBottom: 9,
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
        {/* alignSelf flex-start + feste Hoehe: sonst streckt der row-Parent
            (alignItems default "stretch") den Bild-Slot auf die Section-
            Hoehe — bei dichten Karten wuchs das Hero dadurch sichtbar. */}
        <View style={{ width: 165, height: 165, alignSelf: "flex-start" }}>
          {heroDataUri ? (
            <View
              style={{
                borderRadius: 10,
                overflow: "hidden",
                width: 165,
                height: 165,
              }}
            >
              <Image
                src={heroDataUri}
                style={{ width: 165, height: 165, objectFit: "cover" }}
              />
            </View>
          ) : null}
        </View>

        <View style={{ flex: 1.4, justifyContent: "space-between" }}>
          <View>
            <Text
              style={{
                fontFamily: "Fraunces",
                fontSize: titleFontSize + titleFontSizeOffset(recipe),
                // lineHeight 1.02 war zu eng: bei 2-zeiligen Titeln (Rezept
                // 2,10,11) ueberlappten die Grossbuchstaben-Oberlaengen der
                // zweiten Zeile mit der ersten. 1.15 gibt jeder Zeile Luft.
                lineHeight: 1.15,
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
          {recipe.tags?.length || recipe.mealSize ? (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                marginTop: 8,
                gap: 4,
              }}
            >
              {/* Mahlzeitengröße-Badge zuerst, gefüllt in Akzentfarbe als
                  klares aber cleanes Label (Creatorin-Wunsch). */}
              {recipe.mealSize ? (
                <Text
                  style={{
                    fontSize: 6.5,
                    fontWeight: 700,
                    letterSpacing: 0.8,
                    textTransform: "uppercase",
                    color: "#ffffff",
                    backgroundColor: t.accent,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 999,
                  }}
                >
                  {recipe.mealSize === "klein" ? "Kleine Mahlzeit" : "Große Mahlzeit"}
                </Text>
              ) : null}
              {recipe.tags.slice(0, 4).map((tag) => (
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
      {shouldShowMicros(recipe) ? (
        <EditorialMicrosBanner recipe={recipe} theme={t} density={density} />
      ) : null}

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
          value={`${recipe.nutrition.kcal} kcal`}
          sub={`${recipe.nutrition.carbs} g KH · ${recipe.nutrition.fat} g Fett`}
          theme={t}
          highlight
          borderRight
          accentLabel
          compact
        />
        <PortionTile
          label="EIWEISS"
          value={`${recipe.nutrition.protein} g`}
          sub={nutritionBasisInline(recipe.nutritionBasis)}
          theme={t}
          borderRight
          compact
        />
        <PortionTile
          label="GESAMTZEIT"
          value={`${time} Min`}
          sub={recipe.difficulty}
          theme={t}
          compact
        />
      </View>

      {/* BIENES STORY — pull-quote with «»-quotes, honey-tinted.
          Density-aware padding: bei compact reduzieren wir den Block
          damit lange Recipes auf eine Seite passen. */}
      {shouldShowStory(recipe) && recipe.description ? (
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
  // Spec-strip-Einheit folgt nutritionBasis, nicht nur servings — ein
  // portion-basiertes Rezept muss "2 Portionen" lesen, nie "2 Stücke".
  const stueckSing = recipe.nutritionBasis === "piece" ? "Stück" : "Portion";
  const stueck =
    recipe.servings === 1
      ? stueckSing
      : recipe.nutritionBasis === "piece"
        ? "Stücke"
        : "Portionen";
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

  // Story-Block wird gezeigt sobald der User eine Description gepflegt hat
  // (shouldShowStory checkt hideStory-Tweak + ingredient-Heuristik). Nur bei
  // density="compact" unterdruecken — da hat die Karte sowieso schon zu viel
  // Inhalt und der Story-Block wuerde echten Body-Overflow erzeugen.
  // Frueher war hier "density === spacious", was Story-Edits unsichtbar
  // gemacht hat sobald die Karte balanced wurde (z. B. 9 Ingredients + 4
  // Steps wie bei der High-Protein-White-Pizza).
  const showStoryHere =
    shouldShowStory(recipe) && density !== "compact";

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
                fontSize: titleFontSize + titleFontSizeOffset(recipe),
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
              «&nbsp;{recipe.subtitle} »
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
            {shouldShowMicros(recipe) && micros.length > 0 ? (
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
                    width: 46,
                    height: 46,
                    borderRadius: 23,
                    overflow: "hidden",
                    borderWidth: 1.5,
                    borderColor: t.accent,
                  }}
                >
                  {/* Bewusst kleiner als der QR-Stempel (50pt) — ein groesserer
                      Avatar drueckte optisch ueber den QR-Code (User-Feedback).
                      objectPosition faengt den Portrait-Crop ab. */}
                  <Image
                    src={avatarDataUri}
                    style={{
                      width: 43,
                      height: 43,
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
              // gap 5 (vorher 14): "X Portionen … kcal pro Portion" ist
              // breiter als die Stueck-Variante und kippte sonst in eine
              // zweite Zeile — der Strip bleibt jetzt auch beim breitesten
              // Rezept einzeilig.
              gap: 5,
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
                value: `${recipe.nutrition.protein} g`,
              },
              {
                label: "Kohlenhydrate",
                value: `${recipe.nutrition.carbs} g`,
              },
              { label: "Fett", value: `${recipe.nutrition.fat} g` },
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

          {/* Story-Block — bei balanced kompakter, bei spacious grosszuegig.
              Density-aware Padding verhindert Body-Overflow auf der dichteren
              Stufe (vorher war der Block deshalb komplett unterdrueckt). */}
          {showStoryHere ? (
            <View
              style={{
                marginTop: density === "spacious" ? 22 : 16,
                paddingTop: density === "spacious" ? 14 : 10,
                paddingBottom: density === "spacious" ? 14 : 10,
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
                  fontSize: density === "spacious" ? 11.5 : 10.5,
                  lineHeight: density === "spacious" ? 1.5 : 1.42,
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
  // Komplexitaets-basierte Auto-Fit-Logik (2026-05-19, Bug-Report Laetitia):
  // Multi-Section-Recipes mit vielen Zutaten + Steps haben den Body ueber
  // den Mikros-Strip rendern lassen — sichtbare Ueberlappung "150g Skyr"
  // ueber "Bereite in der Zwischenzeit..." bei Butterkeks Wildberry
  // Cheesecake (5 Sektionen × ~14 Zutaten + 8 Steps).
  //
  // Score = ingredients + sections × 2 + steps × 1.5
  // - normal   (< 22): Hero bleibt 360pt, normale Density (Cookbook-Cover-Look)
  // - complex  (22-29): Hero auf 300pt, compact-Density mit engerem Padding
  // - ultra    (>= 30): Hero auf 240pt, extra-compact + kleinere Fonts +
  //                     reduzierter Mikros-Strip — Body bekommt 120pt mehr
  //                     Platz fuer die uebervolle Section-Liste.
  const baseDensity = getDensity(recipe);
  const stepCount = recipe.steps?.length ?? 0;
  const grouped = groupIngredients(recipe.ingredients);
  const sectionCount = grouped.length;
  const ingredientCount = recipe.ingredients.length;
  const complexityScore =
    ingredientCount + sectionCount * 2 + stepCount * 1.5;
  const isUltraComplex = complexityScore >= 30;
  const isComplex = complexityScore >= 22;
  const density =
    isComplex || stepCount >= 6 ? "compact" : baseDensity;
  const dBase = MINIMAL_DENSITY[density];
  const d = isUltraComplex
    ? {
        ...dBase,
        stepMarginBottom: Math.max(2, dBase.stepMarginBottom - 3),
        stepFontSize: dBase.stepFontSize - 1.5,
        ingRowPadV: Math.max(1.5, dBase.ingRowPadV - 1),
        ingFontSize: dBase.ingFontSize - 1,
        bodyPadTop: Math.max(8, dBase.bodyPadTop - 6),
        bodyPadBottom: Math.max(8, dBase.bodyPadBottom - 6),
      }
    : isComplex || stepCount >= 6
      ? {
          ...dBase,
          stepMarginBottom: Math.max(3, dBase.stepMarginBottom - 2),
          stepFontSize: dBase.stepFontSize - 0.5,
        }
      : dBase;

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

  // Hero-Hoehe dynamisch nach Komplexitaet — bei ultra-komplexen Recipes
  // (Multi-Section + viele Steps) geben wir 120pt mehr an den Body ab,
  // damit der nicht ueberlaeuft. Normal-Recipes behalten den vollen
  // Cookbook-Cover-Hero (360pt = obere Haelfte der A4-Seite).
  const HERO_HEIGHT = isUltraComplex ? 240 : isComplex ? 300 : 360;

  // Mikros-Limit komplexitaets-aware — ultra-komplexe Recipes bekommen
  // weniger Mikros-Pills, damit der Strip nicht in den Body laeuft.
  const microsLimit = isUltraComplex
    ? 4
    : density === "compact"
      ? 5
      : density === "balanced"
        ? 7
        : 9;
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
//
// Char-Bonus: zaehlt zusaetzlich die TATSAECHLICHEN Textlaengen von Steps,
// Zutaten und Story. Ein Recipe mit 5 sehr langen Steps (jeweils 200+ Zeichen)
// wird damit hoeher klassifiziert als 5 kurze Steps (~50 Zeichen). Ohne den
// Bonus klemmte die item-count-Heuristik bei langen Step-Beschreibungen.
// Schwellen bleiben unveraendert (22/14), nur der Score wird smarter.
// recipe.tweaks.densityOverride wins over the score when the user has
// manually picked a density in the editor.
export function getDensity(recipe: Recipe): Density {
  if (recipe.tweaks?.densityOverride) {
    return recipe.tweaks.densityOverride;
  }
  const score = computeDensityScore(recipe);
  if (score >= 22) return "compact";
  if (score <= 14) return "spacious";
  return "balanced";
}

// Gemeinsamer Score-Compute fuer getDensity (alle Layouts) und
// getStudioDensity (Studio-spezifisch). Studio nutzt andere Schwellen aber
// dieselbe Score-Formel — so verhalten sich beide kohaerent.
//
// Berechnung:
//   base       = ingredients.length + steps.length * 1.5
//   stepBonus  = +1 pro 80 chars step-text ueber erwartetem Mittel (80/Step)
//   ingBonus   = +1 pro 30 chars ingredient-text ueber erwartetem Mittel (30/Item)
//   storyBonus = +0.5 pro 100 chars story ueber 150 Basis-Chars
//
// Beispiel: 8 Zutaten + 7 Steps mit normalen Laengen -> base 18.5, kein Bonus
// = 18.5 (balanced bei Studio, balanced bei globalem getDensity).
// Beispiel: 5 Zutaten + 5 Steps aber Steps avg 250 chars -> base 12.5,
// stepBonus = (5*250 - 5*80)/80 = 10.6 -> score 23.1 (compact statt sparse).
export function computeDensityScore(recipe: Recipe): number {
  const base = recipe.ingredients.length + recipe.steps.length * 1.5;
  const totalStepChars = recipe.steps.reduce((acc, s) => {
    const text = typeof s === "string" ? s : s.text;
    return acc + text.length;
  }, 0);
  const totalIngredientChars = recipe.ingredients.reduce((acc, i) => {
    return acc + i.amount.length + i.name.length + (i.note?.length ?? 0);
  }, 0);
  const storyChars = recipe.description?.length ?? 0;
  const stepBonus = Math.max(
    0,
    (totalStepChars - recipe.steps.length * 80) / 80
  );
  const ingredientBonus = Math.max(
    0,
    (totalIngredientChars - recipe.ingredients.length * 30) / 30
  );
  const storyBonus = Math.max(0, (storyChars - 150) / 100) * 0.5;
  return base + stepBonus + ingredientBonus + storyBonus;
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
              fontSize: d.titleFontSize + titleFontSizeOffset(recipe),
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
            «&nbsp;{recipe.subtitle} »
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
              fontSize: d.titleFontSize + titleFontSizeOffset(recipe),
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
              fontSize: d.titleFontSize + titleFontSizeOffset(recipe),
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
              «&nbsp;{recipe.subtitle} »
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
          {shouldShowMicros(recipe) && micros.length > 0 ? (
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
              {group.items.map((ing, ii) => {
                const displayAmount =
                  formatIngredientAmount(ing.amount) || "Nach Geschmack";
                // Lange Amounts ("Nach Geschmack") brauchen in der breiteren
                // 64-pt-Spalte eine Stufe kleinere Schrift, sonst brechen
                // sie auf zwei Zeilen um, ueberlappen den Zutaten-Namen und
                // schieben ganze Karten auf eine zweite Seite (User-Feedback
                // "Schüttel Salat auf zwei Seiten").
                const amountIsLong = displayAmount.length > 10;
                return (
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
                      width: 64,
                      fontSize: amountIsLong
                        ? d.ingFontSize - 2
                        : d.ingFontSize,
                      fontWeight: 600,
                      color: t.accent,
                      letterSpacing: 0.2,
                    }}
                  >
                    {displayAmount}
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
            fontSize: d.titleFontSize + titleFontSizeOffset(recipe),
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
            «&nbsp;{recipe.subtitle} »
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
                        // Einheitliche Mengen-Typografie: ob "250 g" oder
                        // "Nach Geschmack" — jede Menge rendert gleich
                        // (Fraunces italic, dezent, eine Stufe kleiner).
                        // Vorher war quantitativ Inter/fett/Akzentfarbe und
                        // qualitativ Fraunces/italic/grau — der Stilbruch in
                        // derselben Spalte fiel auf (User-Feedback). 58 pt
                        // Breite haelt auch "Nach Geschmack" einzeilig.
                        width: 58,
                        fontFamily: "Fraunces",
                        fontSize: d.ingFontSize - 2,
                        fontStyle: "italic",
                        fontWeight: 400,
                        color: t.inkSoft,
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
      {shouldShowMicros(recipe) && micros.length > 0 ? (
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
          // Letzte Zeile der Gruppe: kein Bottom-Strich. Sonst liegt er
          // direkt ueber dem Gruppen-Trenner zur naechsten Sektion ("Sauce")
          // = doppelte Linie (Leon-Feedback). Der grosse Trenner bleibt.
          isLast={i === items.length - 1}
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
  isLast = false,
}: {
  ing: IngredientGroup["items"][number];
  theme: ReturnType<typeof packTheme>;
  bold: boolean;
  checklist: boolean;
  compact?: boolean;
  rowPadV?: number;
  nameFontSize?: number;
  noteFontSize?: number;
  isLast?: boolean;
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
        borderBottomWidth: isLast ? 0 : 0.5,
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
  // Fortlaufende Nummerierung in RENDER-Reihenfolge (1..N über alle Gruppen
  // hinweg), NICHT item.index. groupSteps zieht ungruppierte Steps nach vorn
  // und gruppierte dahinter — die Original-Position (item.index) wuerde dann
  // springen (z.B. 3,4 dann 1,2 bei "Brownie Schicht"/"Cheesecake Schicht").
  // Ein lauffender Zaehler garantiert, dass die sichtbaren Zahlen immer der
  // tatsaechlichen Lese-Reihenfolge der Karte entsprechen.
  let stepCounter = 0;
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
          {group.items.map((item) => {
            const displayNum = ++stepCounter;
            return (
            <View
              key={item.index}
              style={{
                flexDirection: "row",
                // Mehr Vertikal-Abstand zwischen den Steps, damit jeder
                // Step optisch "atmet" und die Number-Glyph nicht von der
                // naechsten Step-Zeile bedraengt wirkt. User-Feedback war:
                // "lass zwischen den Zahlen mehr Platz".
                marginBottom: stepMarginBottom + 4,
                // Nummer naeher am Text (Leon: "naeher am entsprechenden
                // Paragraphen dran"). Vorher gap 10 + width 22 = grosse Luecke.
                gap: 6,
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
                  width: 14,
                  lineHeight: 1.45,
                }}
              >
                {displayNum}.
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
            );
          })}
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
      {(() => {
        // Wert in Zahl + Einheit trennen, damit die Einheit ("g", "×", "Min")
        // als kleinerer, fest angekoppelter Span neben der Zahl sitzt statt
        // umzubrechen. Vorher: "40 g" mit lineHeight 1 ist umgebrochen → das
        // "g" rutschte in die "pro Portion"-Zeile darunter (Leon-Feedback).
        const m = /^(\S+?)\s*(g|kcal|×|Min)$/.exec(value);
        const num = m ? m[1] : value;
        const unit = m ? m[2] : null;
        // Zahl-Schrift adaptiv: "358 kcal" ist breiter als "40 g". Bei
        // langer Zahl+Einheit etwas kleiner, damit nichts umbricht oder
        // ueber die schmale Kachel hinausragt.
        const combinedLen = num.length + (unit ? unit.length : 0);
        const numSize = combinedLen >= 6 ? 19 : 22;
        const unitSize = unit && unit.length >= 3 ? 10.5 : 13;
        return (
          <View
            style={{
              flexDirection: "row",
              alignItems: "baseline",
              justifyContent: "center",
            }}
            wrap={false}
          >
            <Text
              style={{
                fontFamily: "Fraunces",
                fontSize: numSize,
                color: theme.ink,
                lineHeight: 1.1,
              }}
            >
              {num}
            </Text>
            {unit ? (
              <Text
                style={{
                  fontFamily: "Fraunces",
                  fontSize: unitSize,
                  color: theme.ink,
                  lineHeight: 1.1,
                  marginLeft: 2,
                }}
              >
                {unit}
              </Text>
            ) : null}
          </View>
        );
      })()}
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

        {/* Seitenzahl — echte PDF-Seitennummer via render-Prop (zaehlt
            Cover/Vorwort/Index automatisch mit, passt damit zum
            Inhaltsverzeichnis). Mittig in der fixed-Fusszeile. */}
        <Text
          fixed
          style={{
            position: "absolute",
            bottom: hasQr ? 8 : 10,
            left: 0,
            right: 0,
            textAlign: "center",
            fontSize: 7.5,
            fontWeight: 600,
            letterSpacing: 1,
            color: brand.tokens.inkMuted,
          }}
          render={({ pageNumber }: { pageNumber: number }) => `${pageNumber}`}
        />

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
  // visibleMicros respektiert recipe.tweaks.hideMicros zentral — bei
  // hideMicros: true gibt's ein leeres Array zurueck, der early-return
  // schluckt die ganze Strip. Damit wirkt der User-Toggle "Mikros
  // ausblenden" automatisch in allen Layouts die diesen Shared-Footer
  // nutzen (Patisserie/Sport/Dashboard/Vital ueber CardFooter).
  const micros = recipe ? visibleMicros(recipe) : null;
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
              fontSize: D.headlineFontSize + titleFontSizeOffset(recipe),
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
        {shouldShowMicros(recipe) && topMicros.length > 0 ? (
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
//   - editorial: Banner ueber Hero
//   - patisserie: Vertikale Liste in Sidebar
//   - vital: Pearl-Strip mittig
//   - amber: Vertikale Bars rechts
//   - minimal: Capsule-Pills horizontal
//   - dashboard: Data-Rows mit Icons
//   - sport: Macro-Bars mit Emojis
//   - newspaper: Spreadsheet-Footer-Row mit Doppellinien
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
            fontSize: D.titleFontSize + titleFontSizeOffset(recipe),
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
      {shouldShowMicros(recipe) && topMicros.length > 0 ? (
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

// ═════════════════════════════════════════════════════════════════════════════
// LAYOUT 12 (Phase D): STUDIO — Step-First Choreographie
// ═════════════════════════════════════════════════════════════════════════════
// Komplett andere Design-Sprache als alle anderen 9 Layouts. Die Zubereitung
// wird zum Helden: Big-Number-Stepliste links, kleiner Portrait-Hero rechts
// oben, Zutaten als fluide Inline-Linie unten, Nährwerte als prose im Footer.
//
//   ┌────────────────────────────────────────────────────────────────────┐
//   │  No 03  ·  DOLCE  ·  03/12                              [recipe id] │  ← Eyebrow
//   │  ──────────────────────────────────────────────────────────────── │
//   │                                                                     │
//   │   Pasta al Limone                          ┌─────────────┐         │
//   │   ──                                       │             │         │
//   │   Cremig, schnell, sommerlich              │   HERO 4:5  │         │
//   │                                            │   Portrait  │         │
//   │   ⏱ 25 MIN · 4 PORT. · EINFACH             │             │         │
//   │                                            └─────────────┘         │
//   │  ──────────────────────────────────────────────────────────────── │
//   │                                                                     │
//   │            ─────── DIE CHOREOGRAPHIE ───────                       │
//   │                                                                     │
//   │   01  │  Spaghetti in reichlich gesalzenem Wasser kochen.          │
//   │       │                                                            │
//   │   02  │  Butter aufschäumen, Zitronenschale dazugeben.             │
//   │       │                                                            │
//   │   03  │  Pasta abgießen, in die Butter geben, Parmesan einreiben.  │
//   │       │                                                            │
//   │   …                                                                 │
//   │                                                                     │
//   │   [optional: Story-Pull-Quote bei spacious-Density]                 │
//   │                                                                     │
//   │            ─────── ZUTATEN ───────                                  │
//   │                                                                     │
//   │   500 g  Spaghetti  ·  150 g  Parmesan  ·  80 g  Butter            │
//   │   1  Bio-Zitrone (Schale)  ·  2 EL  Olivenöl  ·  Salz              │
//   │                                                                     │
//   │  ──────────────────────────────────────────────────────────────── │
//   │   300 KCAL  ·  18 g PROTEIN  ·  42 g KH  ·  8 g FETT               │
//   │   Reich an Vitamin C 44 % · Calcium 23 % · Eisen 18 %.              │
//   │   @brand · pack                                            [QR]     │
//   └────────────────────────────────────────────────────────────────────┘
//
// Signature-Moves vs den anderen 9 Layouts:
//   - Step-First: Steps sind der größte Visual-Block (vs alle anderen die
//     Zutaten + Hero gleichberechtigt behandeln)
//   - Portrait-Hero 4:5 (alle anderen: square oder full-bleed)
//   - Mikros als prose ("Reich an …") — restaurant macht das auch, aber
//     in einem Wine-Notes-Block mit Gold-Diamonds; studio macht es als
//     pure Editorial-Bildunterschrift ohne Ornamente.
//   - Zutaten als horizontale Inline-Linie statt Liste/Tabelle (alle
//     anderen Layouts: vertikale Liste oder zweispaltiges Grid)
//   - Stepnummern mit vertikalem Strich als visueller Pace-Beat
//
// Auto-Fit garantiert Single-Page:
//   - 3 Density-Stufen via getDensity() — score = ingredients + 1.5·steps
//   - Title-Auto-Shrink basierend auf title.length (Faktor 1.0 / 0.85 / 0.72)
//   - Steps schalten ab 10+ Steps auf 2-Spalten um (Step-Splitter)
//   - Zutaten-Inline-Linie wrappt natürlich (mehr Zeilen bei 16+)
//   - Story-Block nur bei spacious + shouldShowStory (sonst Platz nehmen)
//   - Mikros max 4 sichtbar, fallen weg wenn nicht vorhanden
//
// Color-Strategy:
//   - Background pure white (#ffffff) — Editorial-Buchstil, kein Tint
//   - Ink #1a1a1a für Body, #4a4a4a für Sekundär, #9a9a9a für Eyebrow
//   - Accent: theme.accent (vom Pack-Mood) für Step-Nummern, Section-Linien,
//     vertikale Step-Strich-Akzente
//
// Anti-Patterns aus LAYOUT_RULES.md alle adressiert:
//   - keine Em-dashes (–/—) im Body, nur · und einfache -
//   - StepsList baseline-aligned via flexDirection:row + alignItems:baseline
//   - Pack-Nummerierung nicht im Card-Druck (Eyebrow zeigt Recipe-Index,
//     der wird per hideRecipeIndex unterdrückt für Single-PDF-Export)
//   - Footer-Mikros-Zeile bricht nicht um (max 4 Mikros enforced)

// Studio-Farben werden dynamisch aus dem Pack-Mood abgeleitet — der
// Hintergrund nimmt mood.background auf, die Schrift folgt mood.ink/inkSoft.
// Inkfaint + Divider sind alpha-Variationen des mood.ink fuer Konsistenz
// ueber alle Pack-Farben hinweg (Lavender, Sage, Honey, etc).
function studioColors(pack: Pack): {
  bg: string;
  ink: string;
  inkSoft: string;
  inkSubtle: string;
  inkFaint: string;
  divider: string;
} {
  return {
    bg: pack.mood.background,
    ink: pack.mood.ink,
    inkSoft: pack.mood.inkSoft,
    inkSubtle: withAlpha(pack.mood.ink, 0.58),
    inkFaint: withAlpha(pack.mood.ink, 0.32),
    divider: withAlpha(pack.mood.ink, 0.18),
  };
}

// Studio-eigene Density-Heuristik. STRIKT auf One-Page-Garantie kalibriert
// — Mehrseitigkeit ist absoluter No-Go. Schwellen:
//   global: spacious <= 14, compact >= 22
//   studio: spacious <= 16, compact >= 20
// Compact-Schwelle aggressiv (>= 20): sobald ein Recipe ~8 Zutaten + 8 Steps
// (score 20) hat, greift compact mit kleinen Sizes damit nichts ueberlaeuft.
// Spacious wirklich nur fuer kurze Recipes (3 Zutaten + 4 Steps = score 9,
// 6 Zutaten + 4 Steps = score 12). Mittelfeld (17-19) ist balanced mit
// moderaten Sizes. Aus dem letzten Live-Test: 8 Zutaten + 7 Steps (score
// 18.5) = balanced jetzt, nicht spacious — sonst lief der Body ueber.
function getStudioDensity(recipe: Recipe): Density {
  if (recipe.tweaks?.densityOverride) return recipe.tweaks.densityOverride;
  // Nutzt den char-aware Score (siehe computeDensityScore) damit Studio
  // auf lange Step-Texte und ueberlange Zutaten-Namen genauso reagiert
  // wie die anderen Layouts — nur mit eigenen Schwellen.
  const score = computeDensityScore(recipe);
  if (score >= 20) return "compact";
  if (score <= 16) return "spacious";
  return "balanced";
}

const STUDIO_DENSITY: Record<
  Density,
  {
    heroWidth: number;
    heroHeight: number;
    headerGap: number;
    titleFontSize: number;
    subtitleFontSize: number;
    specFontSize: number;
    sectionLabelFontSize: number;
    sectionGap: number;
    sectionGapAfterLabel: number;
    stepNumSize: number;
    stepNumColWidth: number;
    stepFontSize: number;
    stepLineHeight: number;
    stepGap: number;
    stepGroupLabelFontSize: number;
    ingredientFontSize: number;
    ingredientLineHeight: number;
    ingredientGroupLabelFontSize: number;
    storyFontSize: number;
    storyLineHeight: number;
    macroFontSize: number;
    macroLabelFontSize: number;
    microsFontSize: number;
    footerFontSize: number;
    eyebrowFontSize: number;
    paddingTop: number;
    paddingBottom: number;
  }
> = {
  // Kompakt: dichte Recipes (score >= 20 — z.B. 8 Zutaten + 8 Steps,
  // oder 12 Zutaten + 6 Steps). Hero klein, Steps + Zutaten kompakter,
  // KEINE Story (zu wenig Platz). Worst-Case-Budget: 16 Zutaten + 10 Steps
  // (score 31) muss auf eine Seite passen.
  compact: {
    // Hero ist jetzt "bleed" in die obere rechte Ecke der Seite — größer
    // als bisher und absolute positioniert. Magazin-Spread-Look.
    heroWidth: 130,
    heroHeight: 156,
    headerGap: 12,
    titleFontSize: 21,
    subtitleFontSize: 8.5,
    specFontSize: 7.5,
    sectionLabelFontSize: 7,
    sectionGap: 10,
    sectionGapAfterLabel: 8,
    // stepNumSize = stepFontSize: gleiche Glyph-Metriken garantieren
    // Baseline-Alignment zwischen Number und Body-Text. Visuelle
    // Prominenz kommt aus Font (Fraunces Italic Bold) + Akzent-Farbe.
    stepNumSize: 8.5,
    stepNumColWidth: 20,
    stepFontSize: 8.5,
    stepLineHeight: 1.42,
    stepGap: 5,
    stepGroupLabelFontSize: 8,
    ingredientFontSize: 8.5,
    ingredientLineHeight: 1.55,
    ingredientGroupLabelFontSize: 7.5,
    storyFontSize: 9,
    storyLineHeight: 1.45,
    macroFontSize: 9,
    macroLabelFontSize: 7,
    microsFontSize: 7.5,
    footerFontSize: 7,
    eyebrowFontSize: 7,
    paddingTop: 28,
    paddingBottom: 22,
  },
  // Balanced — score 17-19 (typischer Mainstream, z.B. 8 Zutaten + 7
  // Steps = score 18.5 wie der Milky-Hazelnut-Eis im letzten Test).
  // Moderater Hero, klare Step-Choreographie, optionale Story. Worst-Case:
  // 9 Zutaten + 7 Steps muss noch sauber auf eine Seite passen.
  balanced: {
    heroWidth: 165,
    heroHeight: 198,
    headerGap: 18,
    titleFontSize: 26,
    subtitleFontSize: 10,
    specFontSize: 8.5,
    sectionLabelFontSize: 7.5,
    sectionGap: 14,
    sectionGapAfterLabel: 11,
    stepNumSize: 10,
    stepNumColWidth: 24,
    stepFontSize: 10,
    stepLineHeight: 1.5,
    stepGap: 9,
    stepGroupLabelFontSize: 9,
    ingredientFontSize: 9.5,
    ingredientLineHeight: 1.6,
    ingredientGroupLabelFontSize: 8.5,
    storyFontSize: 10,
    storyLineHeight: 1.55,
    macroFontSize: 10.5,
    macroLabelFontSize: 8,
    microsFontSize: 8.5,
    footerFontSize: 8,
    eyebrowFontSize: 7.5,
    paddingTop: 34,
    paddingBottom: 26,
  },
  // Spacious — score <= 16 (kurze Recipes, z.B. 3-Zutaten-Eisbowl, 4
  // Zutaten + 4 Steps, 6 Zutaten + 4 Steps). Hero größer, Sizes etwas
  // großzügiger, Story sichtbar. Worst-Case: 7 Zutaten + 6 Steps muss
  // noch entspannt passen. Konservativ kalibriert sodass flex:1-Spacer
  // den Restraum schluckt ohne dass Body ueberlaeuft.
  spacious: {
    heroWidth: 195,
    heroHeight: 234,
    headerGap: 22,
    titleFontSize: 32,
    subtitleFontSize: 11.5,
    specFontSize: 9.5,
    sectionLabelFontSize: 8,
    sectionGap: 18,
    sectionGapAfterLabel: 14,
    stepNumSize: 11,
    stepNumColWidth: 26,
    stepFontSize: 11,
    stepLineHeight: 1.6,
    stepGap: 12,
    stepGroupLabelFontSize: 9.5,
    ingredientFontSize: 10.5,
    ingredientLineHeight: 1.75,
    ingredientGroupLabelFontSize: 9,
    storyFontSize: 10.5,
    storyLineHeight: 1.65,
    macroFontSize: 11.5,
    macroLabelFontSize: 8.5,
    microsFontSize: 9,
    footerFontSize: 8.5,
    eyebrowFontSize: 8,
    paddingTop: 40,
    paddingBottom: 32,
  },
};

// Title-Auto-Shrink: lange Recipe-Titel (z.B. "Bienes lebensverändernder
// Frühlings-Sommer-Salat") überfüllen sonst die linke Header-Spalte und
// brechen in 4+ Zeilen um. Diese Skalierung wird auf titleFontSize multipliziert.
function studioTitleScale(title: string): number {
  const len = title.length;
  if (len <= 18) return 1;
  if (len <= 30) return 0.88;
  if (len <= 45) return 0.76;
  return 0.66;
}

// Step-Splitter: ab 10 Steps wird die Choreographie zwei-spaltig. Verhindert
// dass eine 14-Schritt-Anleitung 250 vertikale pt schluckt und Zutaten/Mikros
// auf eine zweite Seite drückt. Splittet so dass die linke Spalte minimal
// schwerer ist als die rechte (Magazinregel: linke Spalte voll, rechte atmet).
function splitStepsForChoreo<T>(items: T[]): { left: T[]; right: T[] } {
  if (items.length < 10) return { left: items, right: [] };
  const mid = Math.ceil(items.length / 2);
  return { left: items.slice(0, mid), right: items.slice(mid) };
}

// Macro-Stat-Helper: nur Werte > 0 werden gerendert (vermeidet "0 g Fett"-
// Bullshit bei Smoothies wo Macros teils unvollständig sind). Outputs eine
// Liste von Label/Value-Paaren in Print-Reihenfolge.
function studioMacroEntries(recipe: Recipe): Array<{ label: string; value: string }> {
  const n = recipe.nutrition;
  const entries: Array<{ label: string; value: string }> = [];
  if (n.kcal > 0) entries.push({ label: "KCAL", value: String(n.kcal) });
  if (n.protein > 0) entries.push({ label: "PROTEIN", value: `${n.protein} g` });
  if (n.carbs > 0) entries.push({ label: "KH", value: `${n.carbs} g` });
  if (n.fat > 0) entries.push({ label: "FETT", value: `${n.fat} g` });
  return entries;
}

function StudioSectionLabel({
  label,
  density,
  accent,
  divider,
}: {
  label: string;
  density: (typeof STUDIO_DENSITY)["balanced"];
  accent: string;
  divider: string;
}) {
  // Sektion-Header zentriert, mit horizontalen Linien links + rechts. Caps
  // + Letterspacing geben dem Layout den Editorial-Beat.
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginBottom: density.sectionGapAfterLabel,
      }}
    >
      <View style={{ flex: 1, height: 0.5, backgroundColor: divider }} />
      <Text
        style={{
          fontFamily: "Inter",
          fontSize: density.sectionLabelFontSize,
          fontWeight: 600,
          color: accent,
          letterSpacing: 2.4,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
      <View style={{ flex: 1, height: 0.5, backgroundColor: divider }} />
    </View>
  );
}

function StudioStepRow({
  index,
  text,
  density,
  accent,
  ink,
  divider,
  isLast,
}: {
  index: number;
  text: string;
  density: (typeof STUDIO_DENSITY)["balanced"];
  accent: string;
  ink: string;
  divider: string;
  isLast: boolean;
}) {
  // Number-Glyph + Text-Glyph werden mit IDENTISCHER fontSize, fontFamily
  // und lineHeight gerendert. Yoga aligned damit beide Baselines garantiert
  // auf derselben Y-Linie — das ist der gleiche Trick wie in StepsList
  // (siehe Editorial/Patisserie/Vital). Die Number wirkt trotz gleicher
  // Größe als statementiges Pace-Beat-Element, weil sie in Fraunces Italic
  // Bold und Akzent-Farbe gerendert wird gegen Inter Regular Body-Text.
  // Step-Num-FontSize ist ueber STUDIO_DENSITY nun = stepFontSize.
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        marginBottom: isLast ? 0 : density.stepGap,
      }}
    >
      <Text
        style={{
          width: density.stepNumColWidth,
          fontFamily: "Fraunces",
          fontSize: density.stepNumSize,
          fontStyle: "italic",
          fontWeight: 700,
          color: accent,
          lineHeight: density.stepLineHeight,
        }}
      >
        {pad2(index + 1)}
      </Text>
      <View
        style={{
          width: 0.6,
          alignSelf: "stretch",
          backgroundColor: divider,
          marginRight: 12,
          marginTop: 2,
        }}
      />
      <Text
        style={{
          flex: 1,
          fontFamily: "Inter",
          fontSize: density.stepFontSize,
          lineHeight: density.stepLineHeight,
          color: ink,
        }}
      >
        {text}
      </Text>
    </View>
  );
}

// Spalten-Heuristik: passt sich automatisch der Zutaten-Anzahl an damit
// kurze Listen nicht in 3 schmalen Spalten gequetscht aussehen und lange
// Listen nicht ueber halbe Seite Vertikalflaeche fressen.
function pickIngredientColumns(itemCount: number): 1 | 2 | 3 {
  if (itemCount <= 4) return 1;
  if (itemCount >= 11) return 3;
  return 2;
}

function StudioIngredientsGrid({
  groups,
  density,
  accent,
  ink,
  inkSoft,
}: {
  groups: IngredientGroup[];
  density: (typeof STUDIO_DENSITY)["balanced"];
  accent: string;
  ink: string;
  inkSoft: string;
}) {
  // Editorial-Stil: kleiner accent-farbiger Punkt vor jeder Zutat, Mengen
  // in Fraunces Italic Bold (gleicher Stil wie die Step-Numbers — gibt
  // einen visuellen Reim zwischen Zubereitung und Zutaten). Spalten-Anzahl
  // skaliert mit der Zutaten-Menge (siehe pickIngredientColumns). Group-
  // Labels ("Für die Soße") spannen jeweils volle Breite, dann beginnt
  // das Grid darunter von Neuem.
  const amountColWidth = density.ingredientFontSize * 3.4;
  const dotSize = Math.max(2.5, density.ingredientFontSize * 0.3);
  return (
    <View>
      {groups.map((group, gi) => {
        const cols = pickIngredientColumns(group.items.length);
        const perCol = Math.ceil(group.items.length / cols);
        const columns: typeof group.items[] = [];
        for (let i = 0; i < cols; i++) {
          columns.push(group.items.slice(i * perCol, (i + 1) * perCol));
        }
        return (
          <View
            key={gi}
            style={{
              marginBottom: gi === groups.length - 1 ? 0 : 12,
            }}
          >
            {group.name ? (
              <Text
                style={{
                  fontFamily: "Inter",
                  fontSize: density.ingredientGroupLabelFontSize,
                  fontWeight: 600,
                  color: inkSoft,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                {studioGroupLabel(group.name)}
              </Text>
            ) : null}
            <View style={{ flexDirection: "row", gap: 18 }}>
              {columns.map((colItems, ci) => (
                <View key={ci} style={{ flex: 1 }}>
                  {colItems.map((it, ii) => {
                    const amount = formatIngredientAmount(it.amount);
                    const itemSpacing = density.ingredientFontSize * 0.55;
                    return (
                      <View
                        key={ii}
                        style={{
                          flexDirection: "row",
                          alignItems: "flex-start",
                          marginBottom:
                            ii === colItems.length - 1 ? 0 : itemSpacing,
                        }}
                      >
                        {/* Akzent-Dot vor jedem Item — vertikal mit der
                            Text-Baseline ausgerichtet via marginTop = ca.
                            erste-Zeile-Mitte minus halbe Dot-Höhe. */}
                        <View
                          style={{
                            width: dotSize,
                            height: dotSize,
                            borderRadius: dotSize / 2,
                            backgroundColor: accent,
                            marginTop: density.ingredientFontSize * 0.55,
                            marginRight: 7,
                          }}
                        />
                        <Text
                          style={{
                            width: amountColWidth,
                            fontFamily: "Fraunces",
                            fontStyle: "italic",
                            fontWeight: 700,
                            fontSize: density.ingredientFontSize,
                            lineHeight: density.ingredientLineHeight,
                            color: accent,
                            textAlign: "right",
                            paddingRight: 8,
                          }}
                        >
                          {amount || ""}
                        </Text>
                        <Text
                          style={{
                            flex: 1,
                            fontFamily: "Inter",
                            fontSize: density.ingredientFontSize,
                            lineHeight: density.ingredientLineHeight,
                            color: ink,
                          }}
                        >
                          {it.name}
                          {it.note ? (
                            <Text
                              style={{
                                color: inkSoft,
                                fontStyle: "italic",
                              }}
                            >
                              {" "}
                              ({it.note})
                            </Text>
                          ) : null}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// "Für" nur bei den/die/das — analog zu restaurantGroupLabel, einheitliche
// Regel über alle Layouts (LAYOUT_RULES.md §5).
function studioGroupLabel(name: string): string {
  return /^(den|die|das)\s/i.test(name)
    ? `Für ${name.toLowerCase()}`
    : name;
}

function StudioPage({
  brand,
  pack,
  recipe,
  totalRecipes,
  heroDataUri,
  qrDataUri,
  hideRecipeIndex,
}: RecipeCardPdfProps) {
  const t = packTheme(pack);
  const c = studioColors(pack);
  // Studio nutzt eine eigene Density-Heuristik mit grosszuegigerer
  // Spacious-Schwelle (siehe getStudioDensity) — kurze Recipes sollen
  // grossen Hero + grossen Title bekommen statt mit balanced-Sizes
  // halbleer auf der Karte zu sitzen.
  const density = getStudioDensity(recipe);
  const d = STUDIO_DENSITY[density];
  const showStory =
    shouldShowStory(recipe) && density !== "compact";
  const titleScale =
    studioTitleScale(recipe.title) +
    (recipe.tweaks?.titleScale ?? 0) * 0.03;
  // titleScale ist Multiplikator (~0.66 – 1.0), titleScale-tweak schiebt
  // den Faktor in 3%-Schritten — hält die Bandbreite gezielt klein.
  const finalTitleSize = Math.round(d.titleFontSize * titleScale * 10) / 10;

  const ingredientGroups = groupIngredients(recipe.ingredients);
  const stepGroups = groupSteps(recipe.steps);

  // Flatten steps in render order, but preserve group-boundary labels.
  // Bei sehr wenigen Sub-Gruppen (typisch 1) ist das Ergebnis identisch zur
  // alten Linear-Liste; bei Bake-Recipes mit "Für den Teig" + "Glasur" bekommt
  // jede Gruppe ihren eigenen Label-Header.
  const flatSteps: Array<
    | { kind: "group-label"; label: string }
    | { kind: "step"; index: number; text: string }
  > = [];
  stepGroups.forEach((g) => {
    if (g.name) {
      flatSteps.push({ kind: "group-label", label: studioGroupLabel(g.name) });
    }
    g.items.forEach((it) => {
      flatSteps.push({ kind: "step", index: it.index, text: it.text });
    });
  });

  const { left: leftSteps, right: rightSteps } = splitStepsForChoreo(flatSteps);

  const micros = visibleMicros(recipe);
  const showMicros = micros.length > 0;
  // Max 4 Mikros in der Footer-Prose — sonst bricht die Zeile um und stört
  // den Rhythmus. Sortierung kommt schon nach %-Daily aus dem Server-Side
  // Enrichment.
  const microsToShow = micros.slice(0, 4);

  const macros = studioMacroEntries(recipe);

  const totalMin = totalTime(recipe);
  const difficultyLabel = recipe.difficulty.toUpperCase();
  const servings = servingsCountLabel(recipe);
  const specs: string[] = [];
  if (totalMin > 0) specs.push(`${totalMin} MIN`);
  specs.push(servings.toUpperCase());
  specs.push(difficultyLabel);

  const indexLabel =
    hideRecipeIndex || totalRecipes <= 0
      ? null
      : `${pad2(recipe.number)} / ${pad2(totalRecipes)}`;

  // Title-Spalte muss vor dem Bleed-Hero enden. headerColPaddingRight wird
  // an Eyebrow + Title-Block angewendet damit Texte sich nicht unter den
  // Hero schieben. Hero ragt von right=0 bis x=pageWidth-heroWidth.
  const headerColPaddingRight = d.heroWidth + 14 - PAGE_PADDING;

  return (
    <Page
      size="A4"
      style={{
        backgroundColor: c.bg,
        // Padding komplett raus — Hero kann jetzt bis in die obere rechte
        // Ecke "bleeden". Content-Wrapper kuemmert sich um Innenabstaende.
        padding: 0,
        fontFamily: "Inter",
      }}
    >
      {/* ───── Hero "Bleed" — top-right corner, bis zur Page-Kante ───── */}
      {/* absolute top:0, right:0 — Hero ragt bis in die Ecke wie ein
          Magazin-Spread. Die innere Ecke (unten-links) ist abgerundet,
          damit das Bild organisch in die Karte fliesst statt scharfes
          Quadrat. Die anderen drei Ecken bleiben buendig mit der Page-Kante. */}
      <View
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: d.heroWidth,
          height: d.heroHeight,
          borderBottomLeftRadius: 28,
          backgroundColor: blendWithWhite(t.accent, 0.85),
          overflow: "hidden",
        }}
      >
        {heroDataUri ? (
          <Image
            src={heroDataUri}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          <View
            style={{
              width: "100%",
              height: "100%",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontFamily: "Fraunces",
                fontSize: d.heroWidth * 0.45,
                color: withAlpha(t.accent, 0.4),
                lineHeight: 1,
              }}
            >
              {recipe.title.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      {/* ───── Content-Wrapper mit flex:1 fuer Footer-am-Bottom ─────── */}
      <View
        style={{
          flexGrow: 1,
          paddingTop: d.paddingTop,
          paddingHorizontal: PAGE_PADDING,
          paddingBottom: d.paddingBottom,
        }}
      >
      {/* ───── Eyebrow-Strip ───────────────────────────────────────────── */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
          paddingRight: headerColPaddingRight,
        }}
      >
        <Text
          style={{
            fontFamily: "Inter",
            fontSize: d.eyebrowFontSize,
            fontWeight: 600,
            color: c.inkSubtle,
            letterSpacing: 2.5,
            textTransform: "uppercase",
          }}
        >
          {pack.category} · {pack.title}
        </Text>
        {indexLabel ? (
          <Text
            style={{
              fontFamily: "Inter",
              fontSize: d.eyebrowFontSize,
              fontWeight: 500,
              color: c.inkFaint,
              letterSpacing: 1.5,
            }}
          >
            {indexLabel}
          </Text>
        ) : null}
      </View>
      <View
        style={{
          height: 0.5,
          backgroundColor: c.divider,
          marginBottom: d.headerGap,
          marginRight: headerColPaddingRight,
        }}
      />

      {/* ───── Header: Title-Spalte links, Hero ist bereits Bleed-Bild ─ */}
      <View
        style={{
          paddingRight: headerColPaddingRight,
        }}
      >
        <Text
          style={{
            fontFamily: "Fraunces",
            fontSize: finalTitleSize,
            fontWeight: 500,
            color: c.ink,
            lineHeight: 1.05,
            marginBottom: 8,
          }}
        >
          {recipe.title}
        </Text>
        {/* Kurzer accent-farbiger Strich als Title-Akzent. */}
        <View
          style={{
            width: 24,
            height: 1.5,
            backgroundColor: t.accent,
            marginBottom: 10,
          }}
        />
        {recipe.subtitle ? (
          <Text
            style={{
              fontFamily: "Fraunces",
              fontSize: d.subtitleFontSize,
              fontStyle: "italic",
              color: c.inkSoft,
              lineHeight: 1.45,
              marginBottom: 12,
            }}
          >
            {recipe.subtitle}
          </Text>
        ) : null}
        <Text
          style={{
            fontFamily: "Inter",
            fontSize: d.specFontSize,
            fontWeight: 600,
            color: c.inkSoft,
            letterSpacing: 2,
          }}
        >
          {specs.join("  ·  ")}
        </Text>
      </View>

      {/* Spacer 1: Header → Trennlinie/Story. Bei compact fix, sonst
          flex-grow damit der Raum sich proportional verteilt. */}
      {density === "compact" ? (
        <View style={{ height: d.sectionGap }} />
      ) : (
        <View style={{ flexGrow: 0.35, minHeight: d.sectionGap }} />
      )}

      <View
        style={{
          height: 0.5,
          backgroundColor: c.divider,
        }}
      />

      {/* ───── Story als Lead-Paragraph (vor Zubereitung) ─────────────── */}
      {/* Story sitzt UNTER dem Header und VOR der Zubereitung — wie ein
          redaktioneller Lead in Editorial-Magazinen. Italic Fraunces
          zentriert mit Akzent-Strich darueber. */}
      {showStory ? (
        <View
          style={{
            paddingTop: 18,
            paddingHorizontal: 18,
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: 14,
              height: 0.8,
              backgroundColor: t.accent,
              marginBottom: 10,
            }}
          />
          <Text
            style={{
              fontFamily: "Fraunces",
              fontSize: d.storyFontSize,
              fontStyle: "italic",
              color: c.inkSoft,
              lineHeight: d.storyLineHeight,
              textAlign: "center",
            }}
          >
            {recipe.description}
          </Text>
        </View>
      ) : null}

      {/* Spacer 2: Story/Trennlinie → Zubereitung. */}
      {density === "compact" ? (
        <View style={{ height: d.sectionGap }} />
      ) : (
        <View style={{ flexGrow: 0.45, minHeight: d.sectionGap }} />
      )}

      {/* ───── Zubereitung (Big-Number Steps) ─────────────────────────── */}
      <StudioSectionLabel
        label="Zubereitung"
        density={d}
        accent={t.accent}
        divider={c.divider}
      />
      {rightSteps.length === 0 ? (
        <View>
          {leftSteps.map((item, i) => {
            if (item.kind === "group-label") {
              return (
                <Text
                  key={`gl-${i}`}
                  style={{
                    fontFamily: "Inter",
                    fontSize: d.stepGroupLabelFontSize,
                    fontWeight: 600,
                    color: c.inkSoft,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    marginTop: i === 0 ? 0 : d.stepGap,
                    marginBottom: d.stepGap - 2,
                  }}
                >
                  {item.label}
                </Text>
              );
            }
            const isLast = i === leftSteps.length - 1;
            return (
              <StudioStepRow
                key={`s-${item.index}`}
                index={item.index}
                text={item.text}
                density={d}
                accent={t.accent}
                ink={c.ink}
                divider={c.divider}
                isLast={isLast}
              />
            );
          })}
        </View>
      ) : (
        // 2-Spalten-Choreographie ab 10+ Steps. Lückenbreite 18pt.
        <View style={{ flexDirection: "row", gap: 18 }}>
          <View style={{ flex: 1 }}>
            {leftSteps.map((item, i) => {
              if (item.kind === "group-label") {
                return (
                  <Text
                    key={`lgl-${i}`}
                    style={{
                      fontFamily: "Inter",
                      fontSize: d.stepGroupLabelFontSize,
                      fontWeight: 600,
                      color: c.inkSoft,
                      letterSpacing: 1.5,
                      textTransform: "uppercase",
                      marginTop: i === 0 ? 0 : d.stepGap,
                      marginBottom: d.stepGap - 2,
                    }}
                  >
                    {item.label}
                  </Text>
                );
              }
              return (
                <StudioStepRow
                  key={`ls-${item.index}`}
                  index={item.index}
                  text={item.text}
                  density={d}
                  accent={t.accent}
                  ink={c.ink}
                  divider={c.divider}
                  isLast={i === leftSteps.length - 1}
                />
              );
            })}
          </View>
          <View style={{ flex: 1 }}>
            {rightSteps.map((item, i) => {
              if (item.kind === "group-label") {
                return (
                  <Text
                    key={`rgl-${i}`}
                    style={{
                      fontFamily: "Inter",
                      fontSize: d.stepGroupLabelFontSize,
                      fontWeight: 600,
                      color: c.inkSoft,
                      letterSpacing: 1.5,
                      textTransform: "uppercase",
                      marginTop: i === 0 ? 0 : d.stepGap,
                      marginBottom: d.stepGap - 2,
                    }}
                  >
                    {item.label}
                  </Text>
                );
              }
              return (
                <StudioStepRow
                  key={`rs-${item.index}`}
                  index={item.index}
                  text={item.text}
                  density={d}
                  accent={t.accent}
                  ink={c.ink}
                  divider={c.divider}
                  isLast={i === rightSteps.length - 1}
                />
              );
            })}
          </View>
        </View>
      )}

      {/* Spacer 3: Zubereitung → Zutaten. */}
      {density === "compact" ? (
        <View style={{ height: d.sectionGap }} />
      ) : (
        <View style={{ flexGrow: 0.6, minHeight: d.sectionGap }} />
      )}

      {/* ───── Zutaten (responsive 1/2/3-Spalten-Grid) ────────────────── */}
      <StudioSectionLabel
        label="Zutaten"
        density={d}
        accent={t.accent}
        divider={c.divider}
      />
      <StudioIngredientsGrid
        groups={ingredientGroups}
        density={d}
        accent={t.accent}
        ink={c.ink}
        inkSoft={c.inkSoft}
      />

      {/* ───── Footer: Macros + Mikros prose + handle + QR ───────────── */}
      {/* Spacer 4 (vor Footer): das groesste Gewicht, damit der Footer am
          Page-Bottom klebt. Bei balanced/spacious verteilt sich der freie
          Raum proportional zu den anderen Spacern (0.35 + 0.45 + 0.6 + 1.0
          = 2.4 gesamt; dieser Spacer kriegt ~42% des Restraums). Bei
          compact: flex:1 vor Footer + alle anderen sind fixed sectionGaps. */}
      <View style={{ flexGrow: 1, minHeight: d.sectionGap }} />
      <View
        style={{
          height: 0.5,
          backgroundColor: c.divider,
          marginBottom: 10,
        }}
      />
      {macros.length > 0 ? (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "baseline",
            gap: 14,
            marginBottom: showMicros ? 6 : 10,
          }}
        >
          {macros.map((m, i) => (
            <View
              key={m.label}
              style={{
                flexDirection: "row",
                alignItems: "baseline",
                gap: 4,
              }}
            >
              <Text
                style={{
                  fontFamily: "Fraunces",
                  fontSize: d.macroFontSize,
                  fontWeight: 500,
                  color: c.ink,
                }}
              >
                {m.value}
              </Text>
              <Text
                style={{
                  fontFamily: "Inter",
                  fontSize: d.macroLabelFontSize,
                  fontWeight: 600,
                  color: c.inkSubtle,
                  letterSpacing: 1.5,
                }}
              >
                {m.label}
              </Text>
              {i < macros.length - 1 ? (
                <Text
                  style={{
                    fontFamily: "Inter",
                    fontSize: d.macroLabelFontSize,
                    color: c.inkFaint,
                    marginLeft: 6,
                  }}
                >
                  ·
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
      {showMicros ? (
        <Text
          style={{
            fontFamily: "Fraunces",
            fontSize: d.microsFontSize,
            fontStyle: "italic",
            color: c.inkSoft,
            textAlign: "center",
            marginBottom: 10,
            lineHeight: 1.4,
          }}
        >
          Reich an{" "}
          {microsToShow
            .map(
              (m) =>
                `${m.name}${
                  typeof m.pctDaily === "number" ? ` ${m.pctDaily} %` : ""
                }`
            )
            .join(" · ")}
          .
        </Text>
      ) : null}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text
          style={{
            fontFamily: "Inter",
            fontSize: d.footerFontSize,
            fontWeight: 500,
            color: c.inkSubtle,
            letterSpacing: 1.5,
          }}
        >
          {brand.handle} · {pack.title}
        </Text>
        {qrDataUri ? (
          <Image
            src={qrDataUri}
            style={{
              width: 26,
              height: 26,
            }}
          />
        ) : null}
      </View>
      </View>{/* end of Content-Wrapper */}
    </Page>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// LAYOUT 11: FEATURE — Cinematic Split (Phase D, ab 2026-05-15)
// ═════════════════════════════════════════════════════════════════════════════
// Editorial-Magazin-Split: Content links (~42 %) auf warmem Cream-Tint (vom
// Pack-Mood abgeleitet), grosses Hero-Foto rechts (~58 %) full-bleed mit
// Soft-Fade in den Content-Bereich. Sans-Serif, ruhige Hierarchie, foto-
// zentriert. Vorlage: User-Mockup mit Vegetable-Saute-Pasta.
//
// Was Feature einzigartig macht (klare Distinktion zu den 10 anderen):
//   - Foto rechts dominiert (alle anderen Layouts: Foto klein/zentriert/
//     oben/in-Card; Feature: full-bleed asymmetrisch)
//   - Soft-Fade zwischen Foto und Content via Svg-LinearGradient — kein
//     hartes Edge, das Foto blendet sanft in den Content
//   - Content-Background warmes Cream aus Pack-Mood (blendWithWhite),
//     nicht white/cream-static — passt zur Brand-Color des Packs
//   - Zutaten in adaptiven 2 Spalten (Hauptzutaten + Sub-Group oder
//     Item-Split), bei <6 Items auf 1 Spalte zusammen
//   - Mikros als kompakter Italic-Strip ZWISCHEN Zutaten und Steps —
//     nicht am Footer wie Studio, nicht im Body wie Editorial
//   - Steps nummeriert mit kleinen "1." Numerals (nicht Big-Number wie
//     Studio, nicht Roman wie Restaurant)
//   - Meta-Row mit echten Icons (Clock + People) statt Text-Strip
//
// Auto-Fit garantiert Single-Page:
//   - 3 Density-Stufen via getDensity() (compact / balanced / spacious)
//   - Title-Auto-Shrink via featureTitleScale() (1.0 / 0.85 / 0.72 / 0.62)
//   - Step-Font-Shrink ab 8+ Steps (-1 pt) und ab 12+ Steps (-2 pt) —
//     Content-Bereich ist zu schmal fuer 2-Spalten-Steps wie Studio
//   - Ingredients-Auto-Layout: 1 Spalte bei <6 Items, 2 Spalten sonst
//   - Story-Block nur bei spacious + shouldShowStory
//   - Mikros max 4 sichtbar, fallen weg wenn nicht vorhanden
//   - Story/Mikros koennen einzeln fehlen ohne dass Whitespace entsteht —
//     flex-Spacer schiebt Footer immer an die untere Page-Kante
//
// Hero-Fade-Implementation:
//   - Foto liegt absolut rechts (heroLeft .. PAGE_WIDTH), full-height
//   - Daneben ein 70 pt breites Svg-Overlay mit LinearGradient vom
//     Content-BG (Opacity 1) zu transparent — masked die linke Foto-Kante
//   - Render-order: Page-BG (cream) → Hero (absolute, right) → Fade-Svg
//     (absolute, at-edge) → Content (oben, links)
//
// Color-Strategy:
//   - contentBg: blendWithWhite(t.bg, 0.62) — warmer Cream-Tint aus Mood
//   - ink: t.ink (dark warm aus Mood, ueber alle Packs schwarz-genug)
//   - inkSoft / inkSubtle: aus Mood abgeleitet (60/45 % Opacity-Schritte)
//   - accent: t.accent (Pack-Mood-Akzent fuer Title-Strich + Section-Caps)
//
// Anti-Patterns aus LAYOUT_RULES.md adressiert:
//   - Em-dashes (–/—) im Body durch · ersetzt
//   - Pack-Nummerierung nicht im Card-Druck (Eyebrow zeigt Recipe-Index)
//   - Footer-Strip bricht nicht um (max 4 Mikros enforced)
//   - Title-Wrap via softWrapTitle (Bindestrich-Words werden brechbar)

const FEATURE_COLORS = {
  // Static fallback wenn Mood-Mix fehlschlaegt. Wird ueberschrieben vom
  // dynamischen contentBg im FeaturePage-Renderer.
  contentBg: "#f0e2d2",
  ink: "#2a1f15",
  inkSoft: "#5e4b3a",
  inkSubtle: "#8a7964",
  inkFaint: "#bba898",
  divider: "#d5c4ad",
} as const;

// ─── Inline-SVG-Icons (Clock + People) — sans-serif clean, scaled by size ─
function FeatureClockIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle
        cx="12"
        cy="12"
        r="9.5"
        stroke={color}
        strokeWidth="1.5"
        fill="none"
      />
      <Path
        d="M12 6.5 L12 12 L15.5 13.8"
        stroke={color}
        strokeWidth="1.5"
        fill="none"
      />
    </Svg>
  );
}

function FeaturePeopleIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle
        cx="9"
        cy="8.5"
        r="3"
        stroke={color}
        strokeWidth="1.5"
        fill="none"
      />
      <Circle
        cx="16.5"
        cy="9.5"
        r="2.4"
        stroke={color}
        strokeWidth="1.5"
        fill="none"
      />
      <Path
        d="M3.5 20.5 C 3.5 16, 6 14.5, 9 14.5 C 12 14.5, 14.5 16, 14.5 20.5"
        stroke={color}
        strokeWidth="1.5"
        fill="none"
      />
      <Path
        d="M15 20.5 C 15 17.5, 17 16.5, 18.5 16.5 C 20 16.5, 20.5 17.5, 20.5 20.5"
        stroke={color}
        strokeWidth="1.5"
        fill="none"
      />
    </Svg>
  );
}

// Section-Label im Feature-Stil: kleiner Accent-Punkt links + caps-Label.
// Im Gegensatz zu Studio (Linien beidseitig) hier links-bündig, weil
// Content-Spalte schmal ist und beidseitige Linien zu eng wirken.
function FeatureSectionLabel({
  label,
  density,
  accent,
}: {
  label: string;
  density: (typeof FEATURE_DENSITY)["balanced"];
  accent: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
        marginTop: density.sectionLabelGapTop,
        marginBottom: density.sectionLabelGapBottom,
      }}
    >
      <View
        style={{
          width: 5,
          height: 5,
          backgroundColor: accent,
        }}
      />
      <Text
        style={{
          fontFamily: "Inter",
          fontSize: density.sectionLabelFontSize,
          fontWeight: 700,
          color: accent,
          letterSpacing: 2.2,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function FeatureIngredientBlock({
  group,
  density,
  inkPrimary,
  inkSecondary,
  isLast,
}: {
  group: IngredientGroup;
  density: (typeof FEATURE_DENSITY)["balanced"];
  inkPrimary: string;
  inkSecondary: string;
  isLast: boolean;
}) {
  return (
    <View style={{ marginBottom: isLast ? 0 : density.ingredientGap + 4 }}>
      {group.name ? (
        <Text
          style={{
            fontFamily: "Inter",
            fontSize: density.ingredientGroupLabelFontSize,
            fontWeight: 700,
            color: inkSecondary,
            letterSpacing: 1.4,
            textTransform: "uppercase",
            marginBottom: 4,
          }}
        >
          {featureGroupLabel(group.name)}
        </Text>
      ) : null}
      {group.items.map((it, i) => {
        const amount = formatIngredientAmount(it.amount);
        // Zutaten-Zeile: amount + name + note in EINEM Text-Block (inline)
        // damit der Wrap natuerlich am Wortrand passiert. Frueheres Layout
        // mit flexDirection: row + flexWrap: wrap und 2 Text-Elementen hat
        // bei schmalen 2-Spalten amount und name auf SEPARATE Zeilen
        // gepusht ("80 ml" oben, "Mandelmilch" auf naechster Zeile) — das
        // sah broken aus. Inline-Nested-Text wraps wie eine echte Zeile.
        return (
          <Text
            key={`ing-${i}`}
            style={{
              fontFamily: "Inter",
              fontSize: density.ingredientFontSize,
              lineHeight: density.ingredientLineHeight,
              color: inkPrimary,
              marginBottom: density.ingredientGap,
            }}
          >
            {amount ? (
              <Text style={{ fontWeight: 600, color: inkPrimary }}>
                {amount}
              </Text>
            ) : null}
            {amount ? "  " : ""}
            {it.name}
            {it.note ? (
              <Text
                style={{
                  fontStyle: "italic",
                  color: inkSecondary,
                  fontSize: density.ingredientFontSize - 0.5,
                }}
              >
                {` (${it.note})`}
              </Text>
            ) : null}
          </Text>
        );
      })}
    </View>
  );
}

function FeaturePage({
  brand,
  pack,
  recipe,
  totalRecipes,
  heroDataUri,
  qrDataUri,
  hideRecipeIndex,
}: RecipeCardPdfProps) {
  const t = packTheme(pack);
  // Pixel-Estimation-basierter Density-Picker. Garantiert One-Page-Output:
  // iteriert spacious -> extreme und nimmt die erste Stufe deren geschaetzte
  // Content-Hoehe auf 842 pt passt. Bei extreme + truncation: Story und
  // Subtitle werden hart weggekuerzt (FeatureRenderMode.truncate* Flags).
  const mode = pickFeatureDensity(recipe);
  const baseDensity = mode.density;
  const d = FEATURE_DENSITY[baseDensity];
  const isDense = mode.microsInline;

  // ─── Dynamische Mood-Farben fuer Content-BG + Ink ─────────────────────
  // Cream-Tint vom Pack-Mood — beige bei honey, sage-creme bei sage etc.
  // 62 % Weiss-Mix gibt warmes Pastell ohne den Mood zu verfaelschen.
  // Fallback auf statisches Cream wenn Mix-Operation fehlt.
  const contentBg = blendWithWhite(t.bg, 0.62);
  const ink = t.ink;
  const inkSoft = t.inkSoft;
  const inkSubtle = blendWithWhite(t.ink, 0.45);
  const inkFaint = blendWithWhite(t.ink, 0.65);
  const divider = blendWithWhite(t.accent, 0.6);

  // ─── Title-Scale + Auto-Shrink ────────────────────────────────────────
  const titleScale =
    featureTitleScale(recipe.title) + (recipe.tweaks?.titleScale ?? 0) * 0.03;
  const finalTitleSize = Math.round(d.titleFontSize * titleScale * 10) / 10;

  // ─── Step-Font-Shrink basierend auf Step-Count ─────────────────────────
  const stepShrink = featureStepFontShrink(recipe.steps.length);
  const stepFontSize = d.stepFontSize + stepShrink;
  const stepNumFontSize = d.stepNumFontSize + stepShrink;
  const stepGap = Math.max(d.stepGap + stepShrink * 0.5, 3);

  // ─── Daten vorbereiten ────────────────────────────────────────────────
  const grouped = groupIngredients(recipe.ingredients);
  const ingPlan = featurePlanIngredientColumns(grouped);
  const stepGroups = groupSteps(recipe.steps);
  const flatSteps: Array<
    | { kind: "group-label"; label: string }
    | { kind: "step"; index: number; text: string }
  > = [];
  stepGroups.forEach((g) => {
    if (g.name) {
      flatSteps.push({ kind: "group-label", label: featureGroupLabel(g.name) });
    }
    g.items.forEach((it) => {
      flatSteps.push({ kind: "step", index: it.index, text: it.text });
    });
  });

  const micros = visibleMicros(recipe);
  const showMicros = micros.length > 0 && shouldShowMicros(recipe);
  const microsToShow = micros.slice(0, 4);

  const macros = featureMacroEntries(recipe);
  // Story/Subtitle/Mikros-Position kommen direkt aus dem render-mode (vom
  // Picker entschieden). truncateStory/truncateSubtitle sind Flags die in
  // extreme + insufficient-fit gesetzt werden — der Renderer skippt dann
  // einfach Story / Subtitle. Smart-Truncation als letzter Safety-Net.
  const showStory = mode.showStory && !mode.truncateStory;
  const showSubtitle = mode.showSubtitle && !mode.truncateSubtitle;
  const microsInline = showMicros && mode.microsInline;
  const microsAsSection = showMicros && mode.microsAsSection;
  const totalMin = totalTime(recipe);
  const servings = servingsCountLabel(recipe);

  const indexLabel =
    hideRecipeIndex || totalRecipes <= 0
      ? null
      : `${pad2(recipe.number)} / ${pad2(totalRecipes)}`;

  // ─── Page-Geometrie ───────────────────────────────────────────────────
  // A4: 595 x 842 pt. Content links, Hero rechts.
  const PAGE_WIDTH = 595;
  const PAGE_HEIGHT = 842;
  const contentWidth = Math.round(PAGE_WIDTH * d.contentWidthPct);
  // Fade-Overlay ist auf der LINKEN Foto-Kante positioniert. 1pt-Overlap
  // gegen Pixel-Saum zwischen Content-BG und Foto.
  const fadeLeft = contentWidth - 1;

  // Wichtig: Page nutzt flexDirection: "row" damit Content links und Hero
  // rechts als zwei NORMAL-FLOW-Flex-Children nebeneinander gerendert
  // werden. Vorherige Version hatte den Content-View mit `height: 842 pt`
  // plus padding — zusammen mit der default column-Page hat react-pdf das
  // als Overflow interpretiert und auf 2-3 Folgeseiten umbrochen (User-Bug
  // 2026-05-15). Mit row-Layout strecken sich beide Spalten automatisch
  // auf die volle Page-Hoehe (align-items stretch), kein explicit height
  // mehr noetig. Das Fade-Svg bleibt absolute, kommt als letztes Child
  // damit es im z-order ueber Content + Hero liegt.
  return (
    <Page
      size="A4"
      style={{
        backgroundColor: contentBg,
        fontFamily: "Inter",
        color: ink,
        flexDirection: "row",
      }}
    >
      {/* ─── Content-Spalte links (erstes Flex-Child) ─────────────────── */}
      <View
        style={{
          width: contentWidth,
          paddingTop: d.contentPadTop,
          paddingBottom: d.contentPadBottom,
          paddingLeft: d.contentPadH,
          paddingRight: d.contentPadH,
          flexDirection: "column",
        }}
      >
        {/* Eyebrow oben (Pack-Title · Index) */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <Text
            style={{
              fontFamily: "Inter",
              fontSize: d.eyebrowFontSize,
              fontWeight: 700,
              color: inkSubtle,
              letterSpacing: 2.2,
              textTransform: "uppercase",
            }}
          >
            {pack.title}
          </Text>
          {indexLabel ? (
            <Text
              style={{
                fontFamily: "Inter",
                fontSize: d.eyebrowFontSize,
                fontWeight: 500,
                color: inkFaint,
                letterSpacing: 1.4,
              }}
            >
              {indexLabel}
            </Text>
          ) : null}
        </View>

        {/* Title + Akzent-Strich */}
        <Text
          style={{
            fontFamily: "Inter",
            fontSize: finalTitleSize,
            fontWeight: 700,
            color: ink,
            lineHeight: 1.05,
            letterSpacing: -0.4,
          }}
        >
          {softWrapTitle(recipe.title)}
        </Text>
        <View
          style={{
            width: 28,
            height: 2,
            backgroundColor: t.accent,
            marginTop: 8,
            marginBottom: 12,
          }}
        />

        {/* Subtitle — nur bei showSubtitle (Truncation-Fallback skippt
            das bei extreme + insufficient-fit). */}
        {recipe.subtitle && showSubtitle ? (
          <Text
            style={{
              fontFamily: "Inter",
              fontStyle: "italic",
              fontSize: d.storyFontSize + 0.5,
              color: inkSoft,
              lineHeight: 1.4,
              marginBottom: 8,
            }}
          >
            {recipe.subtitle}
          </Text>
        ) : null}

        {/* Optional Story — nur wenn shouldShowStory && nicht compact */}
        {showStory ? (
          <Text
            style={{
              fontFamily: "Inter",
              fontSize: d.storyFontSize,
              color: inkSoft,
              lineHeight: d.storyLineHeight,
              marginBottom: 6,
            }}
          >
            {recipe.description}
          </Text>
        ) : null}

        {/* Meta-Row: Clock-Icon + Zeit | People-Icon + Portionen */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: d.metaRowGap,
            marginTop: 14,
            marginBottom: 14,
          }}
        >
          {totalMin > 0 ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 7,
              }}
            >
              <FeatureClockIcon size={d.metaIconSize} color={inkSoft} />
              <Text
                style={{
                  fontFamily: "Inter",
                  fontSize: d.metaFontSize,
                  fontWeight: 500,
                  color: inkSoft,
                }}
              >
                {totalMin} Min
              </Text>
            </View>
          ) : null}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 7,
            }}
          >
            <FeaturePeopleIcon size={d.metaIconSize} color={inkSoft} />
            <Text
              style={{
                fontFamily: "Inter",
                fontSize: d.metaFontSize,
                fontWeight: 500,
                color: inkSoft,
              }}
            >
              {servings}
            </Text>
          </View>
        </View>

        {/* Makro-Stat-Strip — Editorial-Tile-Layout: jeder Wert in einer
            eigenen Zelle, Big-Number in Fraunces medium oben, Caps-Label
            in Inter unten. Dezente vertikale Trennlinien zwischen den
            Tiles geben dem Strip den editorial-magazine-Beat (ersetzt die
            alten Inline-Pills, die zu "billig" wirkten — User-Feedback
            2026-05-15). */}
        {macros.length > 0 || microsInline ? (
          <View
            style={{
              paddingTop: 12,
              borderTopWidth: 0.5,
              borderTopColor: divider,
            }}
          >
            {macros.length > 0 ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "stretch",
                }}
              >
                {macros.map((m, i) => (
                  <View
                    key={m.label}
                    style={{
                      flex: 1,
                      paddingLeft: i === 0 ? 0 : 6,
                      paddingRight: i === macros.length - 1 ? 0 : 6,
                      borderLeftWidth: i === 0 ? 0 : 0.4,
                      borderLeftColor: divider,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Fraunces",
                        fontSize: d.macroFontSize + 1.5,
                        fontWeight: 500,
                        color: ink,
                        lineHeight: 1.1,
                      }}
                    >
                      {m.value}
                    </Text>
                    <Text
                      style={{
                        fontFamily: "Inter",
                        fontSize: d.macroLabelFontSize,
                        fontWeight: 600,
                        color: inkSubtle,
                        letterSpacing: 1.4,
                        textTransform: "uppercase",
                        marginTop: 2,
                      }}
                    >
                      {m.label}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
            {microsInline ? (
              <Text
                style={{
                  fontFamily: "Fraunces",
                  fontStyle: "italic",
                  fontSize: d.microsFontSize,
                  color: inkSoft,
                  lineHeight: d.microsLineHeight,
                  marginTop: macros.length > 0 ? 8 : 0,
                  paddingTop: macros.length > 0 ? 6 : 0,
                  borderTopWidth: macros.length > 0 ? 0.3 : 0,
                  borderTopColor: divider,
                }}
              >
                Reich an{" "}
                {microsToShow
                  .map(
                    (m) =>
                      `${m.name}${
                        typeof m.pctDaily === "number" ? ` ${m.pctDaily} %` : ""
                      }`
                  )
                  .join(" · ")}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* Section: Zutaten */}
        <FeatureSectionLabel
          label="Zutaten"
          density={d}
          accent={t.accent}
        />
        {ingPlan.twoCol ? (
          <View
            style={{
              flexDirection: "row",
              gap: d.ingredientColumnGap,
              alignItems: "flex-start",
            }}
          >
            <View style={{ flex: 1 }}>
              {ingPlan.leftBlocks.map((g, i) => (
                <FeatureIngredientBlock
                  key={`L-${i}`}
                  group={g}
                  density={d}
                  inkPrimary={ink}
                  inkSecondary={inkSoft}
                  isLast={i === ingPlan.leftBlocks.length - 1}
                />
              ))}
            </View>
            <View style={{ flex: 1 }}>
              {ingPlan.rightBlocks.map((g, i) => (
                <FeatureIngredientBlock
                  key={`R-${i}`}
                  group={g}
                  density={d}
                  inkPrimary={ink}
                  inkSecondary={inkSoft}
                  isLast={i === ingPlan.rightBlocks.length - 1}
                />
              ))}
            </View>
          </View>
        ) : (
          <View>
            {ingPlan.leftBlocks.map((g, i) => (
              <FeatureIngredientBlock
                key={`S-${i}`}
                group={g}
                density={d}
                inkPrimary={ink}
                inkSecondary={inkSoft}
                isLast={i === ingPlan.leftBlocks.length - 1}
              />
            ))}
          </View>
        )}

        {/* Section: Mikros (zwischen Zutaten und Steps — nur bei sparse-
            Modi balanced/spacious. Bei compact/ultra ist die Mikros-Zeile
            schon im Macro-Stripe oben gerendert (microsInline). */}
        {microsAsSection ? (
          <>
            <FeatureSectionLabel
              label="Reich an"
              density={d}
              accent={t.accent}
            />
            <Text
              style={{
                fontFamily: "Fraunces",
                fontStyle: "italic",
                fontSize: d.microsFontSize + 0.5,
                color: inkSoft,
                lineHeight: d.microsLineHeight,
              }}
            >
              {microsToShow
                .map(
                  (m) =>
                    `${m.name}${
                      typeof m.pctDaily === "number" ? ` ${m.pctDaily} %` : ""
                    }`
                )
                .join(" · ")}
            </Text>
          </>
        ) : null}

        {/* Section: Zubereitung */}
        <FeatureSectionLabel
          label="Zubereitung"
          density={d}
          accent={t.accent}
        />
        <View>
          {flatSteps.map((item, i) => {
            if (item.kind === "group-label") {
              return (
                <Text
                  key={`sgl-${i}`}
                  style={{
                    fontFamily: "Inter",
                    fontSize: d.ingredientGroupLabelFontSize,
                    fontWeight: 700,
                    color: inkSoft,
                    letterSpacing: 1.4,
                    textTransform: "uppercase",
                    marginTop: i === 0 ? 0 : stepGap + 2,
                    marginBottom: Math.max(stepGap - 2, 3),
                  }}
                >
                  {item.label}
                </Text>
              );
            }
            return (
              <View
                key={`s-${item.index}`}
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  marginBottom: stepGap,
                }}
              >
                {/* Step-Number in Fraunces italic statt Inter-bold —
                    editorial-magazine-feel statt Bullet-Liste. Padding-Top
                    aligned die Number an die Baseline der ersten Body-
                    Zeile damit der Strich rechts daneben sauber sitzt. */}
                <Text
                  style={{
                    width: d.stepNumColWidth,
                    fontFamily: "Fraunces",
                    fontStyle: "italic",
                    fontSize: stepNumFontSize + 1,
                    fontWeight: 500,
                    color: t.accent,
                    lineHeight: 1.15,
                    paddingTop: 0.5,
                  }}
                >
                  {item.index + 1}
                </Text>
                <Text
                  style={{
                    flex: 1,
                    fontFamily: "Inter",
                    fontSize: stepFontSize,
                    lineHeight: d.stepLineHeight,
                    color: ink,
                  }}
                >
                  {item.text}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Spacer + Footer — flex:1 schiebt Footer immer an die Page-Kante */}
        <View style={{ flex: 1, minHeight: 8 }} />
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 10,
            borderTopWidth: 0.5,
            borderTopColor: divider,
          }}
        >
          <Text
            style={{
              fontFamily: "Inter",
              fontSize: d.footerFontSize,
              fontWeight: 600,
              color: inkSubtle,
              letterSpacing: 1.3,
            }}
          >
            {brand.handle}
          </Text>
          {qrDataUri ? (
            <Image
              src={qrDataUri}
              style={{
                width: 22,
                height: 22,
              }}
            />
          ) : null}
        </View>
      </View>

      {/* ─── Hero-Spalte rechts (zweites Flex-Child, flex:1 fuellt Rest) ─
          Image bekommt opacity: 0.88 + ein subtle contentBg-Overlay mit
          opacity: 0.14 damit das Foto nicht zu aggressiv wirkt und sich
          in den Content-BG einbettet (User-Feedback 2026-05-15: "Bild
          muss transparenter sein, sonst zu aggressiv"). */}
      <View
        style={{
          flex: 1,
          backgroundColor: blendWithWhite(t.accent, 0.9),
          position: "relative",
        }}
      >
        {heroDataUri ? (
          <Image
            src={heroDataUri}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: 0.88,
            }}
          />
        ) : (
          <View
            style={{
              width: "100%",
              height: "100%",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontFamily: "Fraunces",
                fontSize: 140,
                color: withAlpha(t.accent, 0.35),
                lineHeight: 1,
              }}
            >
              {recipe.title.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        {heroDataUri ? (
          <View
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              right: 0,
              bottom: 0,
              backgroundColor: contentBg,
              opacity: 0.14,
            }}
          />
        ) : null}
      </View>

      {/* ─── Soft-Fade-Overlay an der linken Foto-Kante (z-top) ────────── */}
      <Svg
        width={d.fadeWidth}
        height={PAGE_HEIGHT}
        viewBox={`0 0 ${d.fadeWidth} ${PAGE_HEIGHT}`}
        style={{
          position: "absolute",
          left: fadeLeft,
          top: 0,
        }}
      >
        <Defs>
          <LinearGradient
            id="feature-fade"
            x1="0"
            y1="0"
            x2={String(d.fadeWidth)}
            y2="0"
          >
            <Stop offset="0" stopColor={contentBg} stopOpacity={1} />
            <Stop offset="0.5" stopColor={contentBg} stopOpacity={0.78} />
            <Stop offset="1" stopColor={contentBg} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect
          x="0"
          y="0"
          width={d.fadeWidth}
          height={PAGE_HEIGHT}
          fill="url(#feature-fade)"
        />
      </Svg>
    </Page>
  );
}
