import { Page, View, Text, Image } from "@react-pdf/renderer";
import type { Brand } from "@/lib/brands";
import type { Pack, CardLayout } from "@/lib/packs";
import type { Recipe } from "@/lib/recipes";
import {
  groupIngredients,
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
};

export function RecipeCardPdfPage(props: RecipeCardPdfProps) {
  return LAYOUTS[props.pack.cardLayout](props);
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
          PACK {pad2(pack.number)} · {pack.title.toUpperCase()}
        </Text>
        <Text
          style={{
            fontSize: 7.5,
            letterSpacing: 1.6,
            color: t.inkSoft,
            fontWeight: 600,
          }}
        >
          KARTE {pad2(recipe.number)} / {pad2(totalRecipes)}
        </Text>
      </View>

      {/* TITLE BLOCK — title + meta left, square photo right */}
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
                marginTop: 8,
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
                marginTop: 10,
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

        {/* Square photo — fits portrait food shots without crop */}
        <View style={{ width: 140 }}>
          {heroDataUri ? (
            <View
              style={{
                borderRadius: 10,
                overflow: "hidden",
                width: 140,
                height: 140,
              }}
            >
              <Image
                src={heroDataUri}
                style={{ width: 140, height: 140, objectFit: "cover" }}
              />
            </View>
          ) : null}
        </View>
      </View>

      {/* BIENES STORY — always shown for Pack 5, honey-tinted pull-quote */}
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
          label="PRO PORTION"
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
          sub="pro Portion"
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
        microsPadTop={d.microsPadTop}
        microsPadBottom={d.microsPadBottom}
      />
    </Page>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// LAYOUT 2: PATISSERIE — Pack 2 (Backwelt, Lavender)
// ═════════════════════════════════════════════════════════════════════════════
function PatisseriePage({
  brand,
  pack,
  recipe,
  totalRecipes,
  heroDataUri,
}: RecipeCardPdfProps) {
  const t = packTheme(pack);
  const time = totalTime(recipe);
  const stueck = recipe.servings === 1 ? "Stück" : "Stücke";
  const density = getDensity(recipe);
  const d = PATISSERIE_DENSITY[density];

  return (
    <Page
      size="A4"
      style={{ backgroundColor: t.bg, fontFamily: "Inter", color: t.ink }}
    >
      {/* HEAD — title left, polaroid right */}
      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: 36,
          paddingTop: d.headPadTop,
          paddingBottom: d.headPadBottom,
          gap: 20,
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
            № {pad2(recipe.number)} / {pad2(totalRecipes)} ·{" "}
            {pack.title.toUpperCase()}
          </Text>
          <Text
            style={{
              fontFamily: "Fraunces",
              fontStyle: "italic",
              fontSize: d.titleFontSize,
              lineHeight: 1,
              letterSpacing: -0.4,
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
              fontSize: d.subtitleFontSize,
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
              marginTop: 10,
              flexWrap: "wrap",
            }}
          >
            <Text style={{ fontSize: 9, color: t.inkSoft }}>{time} Minuten</Text>
            <Text style={{ fontSize: 9, color: t.inkSoft }}>·</Text>
            <Text style={{ fontSize: 9, color: t.inkSoft }}>
              {recipe.servings} {stueck}
            </Text>
            <Text style={{ fontSize: 9, color: t.inkSoft }}>·</Text>
            <Text style={{ fontSize: 9, color: t.inkSoft }}>
              {recipe.difficulty}
            </Text>
            <Text style={{ fontSize: 9, color: t.inkSoft }}>·</Text>
            <Text style={{ fontSize: 9, color: t.ink, fontWeight: 600 }}>
              {recipe.nutrition.kcal} kcal pro {stueck === "Stücke" ? "Stück" : "Stück"}
            </Text>
          </View>
        </View>

        {/* Polaroid — compact */}
        <View style={{ width: 130 }}>
          {heroDataUri ? (
            <View
              style={{
                borderWidth: 5,
                borderColor: "#ffffff",
                borderRadius: 10,
                overflow: "hidden",
                width: 130,
                height: 130,
                backgroundColor: "#ffffff",
              }}
            >
              <Image
                src={heroDataUri}
                style={{ width: 120, height: 120, objectFit: "cover" }}
              />
            </View>
          ) : null}
        </View>
      </View>

      {/* BIENES STORY — only when the recipe is sparse (low score). Renders
          recipe.description as an editorial pull-quote in italic Fraunces,
          tinted with the pack's lavender. Fills the bottom whitespace short
          recipes (e.g. KI-Süßkartoffel-Muffins, 8 ings + 4 steps) would
          otherwise leave below the body — direct fix for "darf nicht
          halbleer aussehen". */}
      {shouldShowStory(recipe) ? (
        <View
          style={{
            paddingHorizontal: 36,
            paddingTop: 12,
            paddingBottom: 14,
            backgroundColor: blendWithWhite(t.bg, 0.4),
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

      {/* MACRO STRIP — single line, compact */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          paddingHorizontal: 36,
          paddingVertical: 8,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: t.divider,
          flexWrap: "wrap",
        }}
        wrap={false}
      >
        {[
          { label: "Eiweiß", value: `${recipe.nutrition.protein}g` },
          { label: "Kohlenhydrate", value: `${recipe.nutrition.carbs}g` },
          { label: "Fett", value: `${recipe.nutrition.fat}g` },
        ].map((m) => (
          <View
            key={m.label}
            style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}
          >
            <Text
              style={{
                fontFamily: "Fraunces",
                fontStyle: "italic",
                fontSize: 13,
                color: t.ink,
              }}
            >
              {m.value}
            </Text>
            <Text style={{ fontSize: 9, color: t.inkSoft }}>{m.label}</Text>
          </View>
        ))}
      </View>

      {/* BODY on white surface */}
      <View
        style={{
          flex: 1,
          backgroundColor: "#ffffff",
          flexDirection: "row",
          gap: 22,
          paddingHorizontal: 36,
          paddingTop: d.bodyPadTop,
          paddingBottom: d.bodyPadBottom,
        }}
      >
        <View style={{ width: 220 }}>
          <SectionHeader label="MAN NEHME" theme={t} italic />
          <IngredientsList
            grouped={[{ name: null, items: recipe.ingredients }]}
            theme={t}
            rowPadV={d.ingRowPadV}
            nameFontSize={d.ingFontSize}
            noteFontSize={d.ingNoteFontSize}
          />
        </View>
        <View style={{ flex: 1 }}>
          <SectionHeader label="ZUBEREITUNG" theme={t} italic />
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
        italic
        microsPadTop={d.microsPadTop}
        microsPadBottom={d.microsPadBottom}
      />
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

function MinimalPage({
  brand,
  pack,
  recipe,
  totalRecipes,
  heroDataUri,
}: RecipeCardPdfProps) {
  const t = packTheme(pack);
  const time = totalTime(recipe);
  const pl = recipe.servings === 1 ? "Portion" : "Stücke";
  const density = getDensity(recipe);
  const d = MINIMAL_DENSITY[density];

  return (
    <Page
      size="A4"
      style={{ backgroundColor: "#ffffff", fontFamily: "Inter", color: t.ink }}
    >
      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: 36,
          paddingTop: d.headPadTop,
          paddingBottom: d.headPadBottom,
          gap: 20,
        }}
        wrap={false}
      >
        <View style={{ flex: 1.5 }}>
          <Text
            style={{
              fontSize: 7.5,
              letterSpacing: 1.6,
              fontWeight: 600,
              color: t.inkSoft,
            }}
          >
            {pack.title.toUpperCase()} · {pad2(recipe.number)} /{" "}
            {pad2(totalRecipes)}
          </Text>
          <Text
            style={{
              fontFamily: "Fraunces",
              fontSize: d.bigNumberFontSize,
              color: t.accent,
              lineHeight: 0.86,
              marginTop: 10,
              letterSpacing: -1.5,
            }}
          >
            {pad2(recipe.number)}
          </Text>
          <Text
            style={{
              fontSize: d.titleFontSize,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: -0.4,
              color: t.ink,
              marginTop: 12,
              lineHeight: 1.02,
            }}
          >
            {recipe.title}
          </Text>
          <Text
            style={{
              fontSize: d.subtitleFontSize,
              color: t.inkSoft,
              marginTop: 4,
              lineHeight: 1.35,
            }}
          >
            {recipe.subtitle}
          </Text>
          <Text
            style={{
              fontSize: 8.5,
              fontWeight: 600,
              letterSpacing: 1.2,
              color: t.accent,
              marginTop: 8,
              textTransform: "uppercase",
            }}
          >
            ergibt {recipe.servings} {pl} · {time} Min
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          {heroDataUri ? (
            <View
              style={{
                borderRadius: 10,
                overflow: "hidden",
                width: 150,
                height: 150,
                alignSelf: "flex-end",
              }}
            >
              <Image
                src={heroDataUri}
                style={{ width: 150, height: 150, objectFit: "cover" }}
              />
            </View>
          ) : null}
          <View
            style={{
              flexDirection: "row",
              marginTop: 8,
              borderRadius: 10,
              borderWidth: 0.5,
              borderColor: withAlpha(t.ink, 0.1),
              backgroundColor: blendWithWhite(t.bg, 0.5),
              paddingVertical: 10,
              alignSelf: "flex-end",
              width: 150,
            }}
          >
            <MinStat
              value={String(recipe.nutrition.kcal)}
              label="kcal"
              theme={t}
            />
            <MinStat
              value={`${recipe.nutrition.protein}g`}
              label="Eiweiß"
              theme={t}
            />
            <MinStat
              value={`${recipe.nutrition.fat}g`}
              label="Fett"
              theme={t}
            />
          </View>
        </View>
      </View>

      {/* BIENES STORY — only for sparse snacks (≤14 score). Most Bienes
          snacks are short (5–7 ings + 3–5 steps) which leaves the body
          empty; rendering recipe.description as an editorial pull-quote
          fills that space with brand-on content. */}
      {shouldShowStory(recipe) ? (
        <View
          style={{
            paddingHorizontal: 36,
            paddingTop: 12,
            paddingBottom: 14,
            backgroundColor: blendWithWhite(t.bg, 0.5),
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

      <View
        style={{
          flex: 1,
          flexDirection: "row",
          gap: 24,
          paddingHorizontal: 36,
          paddingTop: d.bodyPadTop,
          paddingBottom: d.bodyPadBottom,
          borderTopWidth: 1,
          borderTopColor: t.divider,
        }}
      >
        <View style={{ width: 220 }}>
          <SectionHeader label="MAN NEHME" theme={t} bold />
          <IngredientsList
            grouped={[{ name: null, items: recipe.ingredients }]}
            theme={t}
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
        microsPadTop={d.microsPadTop}
        microsPadBottom={d.microsPadBottom}
      />
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
            PACK {pad2(pack.number)} · {pack.title.toUpperCase()} · KARTE{" "}
            {pad2(recipe.number)} / {pad2(totalRecipes)}
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
          label="kcal pro Portion"
          theme={t}
          borderRight
          highlight
          padV={d.statsPadV}
        />
        <VolumenStatTile
          dotColor={t.accent}
          value={`${recipe.nutrition.protein}g`}
          label="Eiweiß pro Portion"
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
            pro Portion · von 50 / 80 / 35 g Skala
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
            {recipe.steps.map((step, idx) => (
              <View
                key={idx}
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
                    {idx + 1}
                  </Text>
                  {idx < recipe.steps.length - 1 ? (
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
                  {step}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <CardFooter brand={brand} pack={pack} recipe={recipe} theme={t} />
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
        <Text style={{ fontSize: 8.5, color: t.inkSoft }}>
          Pack {pad2(pack.number)} · {pack.title} · Karte {pad2(recipe.number)} /{" "}
          {pad2(totalRecipes)}
        </Text>
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
              label="Pro Portion"
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
      {grouped.map((g, gi) => (
        <View key={g.name ?? `m${gi}`} style={{ marginBottom: 8 }}>
          {g.name ? (
            <Text
              style={{
                fontSize: 7,
                letterSpacing: 1.4,
                fontWeight: 600,
                color: theme.inkSoft,
                marginBottom: 4,
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
      ))}
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
  return (
    <View
      style={{
        flexDirection: "row",
        borderBottomWidth: 0.5,
        borderBottomColor: withAlpha(theme.ink, 0.08),
        paddingVertical: padV,
        gap: 5,
      }}
    >
      <Text
        style={{
          fontSize: amountFont,
          color: theme.inkSoft,
          width: amountW,
          fontWeight: bold ? 600 : 400,
        }}
      >
        {ing.amount}
      </Text>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: nameFont,
            lineHeight: 1.3,
            color: theme.ink,
            fontWeight: bold ? 600 : 400,
          }}
        >
          {checklist ? <Text style={{ color: theme.inkSubtle }}>☐ </Text> : null}
          {ing.name}
        </Text>
        {ing.note ? (
          <Text
            style={{
              fontSize: noteFont,
              fontStyle: "italic",
              color: theme.inkSoft,
              marginTop: 0.5,
            }}
          >
            {ing.note}
          </Text>
        ) : null}
      </View>
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
  steps: string[];
  theme: ReturnType<typeof packTheme>;
  bold?: boolean;
  checklist?: boolean;
  stepMarginBottom?: number;
  stepFontSize?: number;
  stepNumFontSize?: number;
}) {
  return (
    <View style={{ marginTop: 8 }}>
      {steps.map((step, idx) => (
        <View
          key={idx}
          style={{ flexDirection: "row", marginBottom: stepMarginBottom, gap: 6 }}
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
            {idx + 1}
          </Text>
          <Text
            style={{
              flex: 1,
              fontSize: stepFontSize,
              lineHeight: 1.45,
              color: theme.ink,
            }}
          >
            {checklist ? <Text style={{ color: theme.inkSubtle }}>☐ </Text> : null}
            {step}
          </Text>
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
}: {
  brand: Brand;
  pack: Pack;
  recipe?: Recipe;
  theme: ReturnType<typeof packTheme>;
  italic?: boolean;
  microsPadTop?: number;
  microsPadBottom?: number;
}) {
  return (
    <>
      <MicrosStrip
        recipe={recipe}
        theme={theme}
        padTop={microsPadTop}
        padBottom={microsPadBottom}
      />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          borderTopWidth: 1,
          borderTopColor: theme.divider,
          backgroundColor: "#ffffff",
          paddingHorizontal: 32,
          paddingVertical: 10,
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
          fontSize: 7,
          fontWeight: 500,
          letterSpacing: 1.4,
          color: brand.tokens.inkMuted,
          textTransform: "uppercase",
        }}
      >
        {brand.handle} · {pack.title}
        {recipe?.sourceUrl ? `  ·  ${recipe.sourceLabel ?? "Original-Reel"}` : ""}
      </Text>
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
