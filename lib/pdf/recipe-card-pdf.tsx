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

  return (
    <Page
      size="A4"
      style={{ backgroundColor: "#ffffff", fontFamily: "Inter", color: t.ink }}
    >
      {/* HEADER BAND */}
      <View
        style={{
          backgroundColor: t.paper,
          borderBottomWidth: 1,
          borderBottomColor: t.divider,
          paddingHorizontal: 32,
          paddingTop: 22,
          paddingBottom: 16,
        }}
        wrap={false}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            fontSize: 7.5,
            letterSpacing: 1.6,
          }}
        >
          <Text style={{ color: t.inkSoft, fontWeight: 600 }}>
            PACK {pad2(pack.number)} · {pack.title.toUpperCase()}
          </Text>
          <Text style={{ color: t.inkSoft, fontWeight: 600 }}>
            KARTE {pad2(recipe.number)} / {pad2(totalRecipes)}
          </Text>
        </View>

        <Text
          style={{
            fontFamily: "Fraunces",
            fontSize: 28,
            lineHeight: 1.04,
            letterSpacing: -0.3,
            color: t.ink,
            textTransform: "uppercase",
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
            color: t.inkSoft,
            lineHeight: 1.3,
            marginTop: 4,
          }}
        >
          {recipe.subtitle}
        </Text>

        {recipe.tags?.length ? (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              marginTop: 8,
              gap: 4,
            }}
          >
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

      {/* HERO IMAGE — compact */}
      {heroDataUri ? (
        <View
          style={{
            paddingHorizontal: 32,
            paddingTop: 12,
            paddingBottom: 4,
            backgroundColor: t.paper,
          }}
          wrap={false}
        >
          <View
            style={{
              borderRadius: 10,
              overflow: "hidden",
              alignSelf: "center",
              width: 380,
              height: 130,
            }}
          >
            <Image
              src={heroDataUri}
              style={{ width: 380, height: 130, objectFit: "cover" }}
            />
          </View>
        </View>
      ) : null}

      {/* PORTIONS HERO BAR — 3 tiles, compact */}
      <View
        style={{
          flexDirection: "row",
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: t.divider,
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
          sub={`kcal · ${recipe.nutrition.protein}g Eiweiß · ${recipe.nutrition.carbs}g KH · ${recipe.nutrition.fat}g Fett`}
          theme={t}
          highlight
          borderRight
          accentLabel
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
          paddingTop: 16,
          paddingBottom: 12,
          gap: 22,
        }}
      >
        <View style={{ width: 220 }}>
          <SectionHeader
            label="MAN NEHME"
            right={`für ${recipe.servings} ${pl}`}
            theme={t}
          />
          <IngredientsList grouped={grouped} theme={t} />
        </View>

        <View style={{ flex: 1 }}>
          <SectionHeader
            label="ZUBEREITUNG"
            right={`${recipe.steps.length} Schritte`}
            theme={t}
          />
          <StepsList steps={recipe.steps} theme={t} />
        </View>
      </View>

      <CardFooter brand={brand} pack={pack} recipe={recipe} theme={t} />
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
          paddingTop: 28,
          paddingBottom: 16,
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
              fontSize: 36,
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
              fontSize: 14,
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
          paddingTop: 18,
          paddingBottom: 16,
        }}
      >
        <View style={{ width: 220 }}>
          <SectionHeader label="MAN NEHME" theme={t} italic />
          <IngredientsList
            grouped={[{ name: null, items: recipe.ingredients }]}
            theme={t}
          />
        </View>
        <View style={{ flex: 1 }}>
          <SectionHeader label="ZUBEREITUNG" theme={t} italic />
          <StepsList steps={recipe.steps} theme={t} />
        </View>
      </View>

      <CardFooter brand={brand} pack={pack} recipe={recipe} theme={t} italic />
    </Page>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// LAYOUT 3: MINIMAL — Pack 3 (Snacks, Pistachio)
// ═════════════════════════════════════════════════════════════════════════════
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

  return (
    <Page
      size="A4"
      style={{ backgroundColor: "#ffffff", fontFamily: "Inter", color: t.ink }}
    >
      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: 36,
          paddingTop: 32,
          paddingBottom: 16,
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
              fontSize: 76,
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
              fontSize: 24,
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
              fontSize: 11,
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

      <View
        style={{
          flex: 1,
          flexDirection: "row",
          gap: 24,
          paddingHorizontal: 36,
          paddingTop: 18,
          paddingBottom: 16,
          borderTopWidth: 1,
          borderTopColor: t.divider,
        }}
      >
        <View style={{ width: 220 }}>
          <SectionHeader label="MAN NEHME" theme={t} bold />
          <IngredientsList
            grouped={[{ name: null, items: recipe.ingredients }]}
            theme={t}
          />
        </View>
        <View style={{ flex: 1 }}>
          <SectionHeader label="ZUBEREITUNG" theme={t} bold />
          <StepsList steps={recipe.steps} theme={t} />
        </View>
      </View>

      <CardFooter brand={brand} pack={pack} recipe={recipe} theme={t} />
    </Page>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// LAYOUT 4: SPORT — Pack 4 (Volumen, Sage Green)
// ═════════════════════════════════════════════════════════════════════════════
function SportPage({
  brand,
  pack,
  recipe,
  totalRecipes,
  heroDataUri,
}: RecipeCardPdfProps) {
  const t = packTheme(pack);
  const time = totalTime(recipe);

  return (
    <Page
      size="A4"
      style={{ backgroundColor: "#ffffff", fontFamily: "Inter", color: t.ink }}
    >
      {/* HERO — compact dark overlay */}
      <View
        style={{
          height: 200,
          position: "relative",
          backgroundColor: t.ink,
        }}
        wrap={false}
      >
        {heroDataUri ? (
          <Image
            src={heroDataUri}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: 0.55,
            }}
          />
        ) : null}
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: withAlpha(pack.mood.ink, 0.55),
          }}
        />
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            padding: 24,
            justifyContent: "space-between",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <Text
              style={{
                fontSize: 7.5,
                letterSpacing: 1.8,
                color: "#ffffff",
                fontWeight: 600,
              }}
            >
              PACK {pad2(pack.number)} · KARTE {pad2(recipe.number)} /{" "}
              {pad2(totalRecipes)}
            </Text>
            <View
              style={{
                backgroundColor: "#ffffff",
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
              }}
            >
              <Text
                style={{
                  fontSize: 7.5,
                  fontWeight: 700,
                  letterSpacing: 1.2,
                  color: t.ink,
                }}
              >
                {time} MIN · {recipe.difficulty.toUpperCase()}
              </Text>
            </View>
          </View>

          <View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "baseline",
                gap: 10,
              }}
            >
              <Text
                style={{
                  fontSize: 50,
                  fontWeight: 700,
                  color: "#ffffff",
                  letterSpacing: -1.2,
                  lineHeight: 1,
                }}
              >
                {recipe.nutrition.kcal}
              </Text>
              <View>
                <Text
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    letterSpacing: 1.4,
                    color: "rgba(255,255,255,0.85)",
                    textTransform: "uppercase",
                  }}
                >
                  kcal pro Portion
                </Text>
                <Text
                  style={{ fontSize: 8, color: "rgba(255,255,255,0.65)" }}
                >
                  {recipe.servings === 1
                    ? "1 Portion"
                    : `Rezept ergibt ${recipe.servings} Portionen`}
                </Text>
              </View>
            </View>
            <Text
              style={{
                fontSize: 26,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: -0.4,
                color: "#ffffff",
                marginTop: 6,
                lineHeight: 1,
              }}
            >
              {recipe.title}
            </Text>
            <Text
              style={{
                fontSize: 9,
                letterSpacing: 1.2,
                color: "rgba(255,255,255,0.85)",
                marginTop: 4,
                textTransform: "uppercase",
              }}
            >
              {recipe.subtitle}
            </Text>
          </View>
        </View>
      </View>

      {/* MACROS — bold strip */}
      <View
        style={{
          flexDirection: "row",
          backgroundColor: t.bg,
          borderBottomWidth: 1,
          borderBottomColor: t.divider,
        }}
        wrap={false}
      >
        {[
          { label: "Eiweiß", value: `${recipe.nutrition.protein}g` },
          { label: "Kohlenhydrate", value: `${recipe.nutrition.carbs}g` },
          { label: "Fett", value: `${recipe.nutrition.fat}g` },
        ].map((m, i, arr) => (
          <View
            key={m.label}
            style={{
              flex: 1,
              flexDirection: "row",
              justifyContent: "center",
              alignItems: "baseline",
              gap: 6,
              paddingVertical: 10,
              borderRightWidth: i === arr.length - 1 ? 0 : 1,
              borderRightColor: t.divider,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: 700, color: t.ink }}>
              {m.value}
            </Text>
            <Text
              style={{
                fontSize: 7.5,
                fontWeight: 600,
                letterSpacing: 1.2,
                color: t.inkSoft,
                textTransform: "uppercase",
              }}
            >
              {m.label}
            </Text>
          </View>
        ))}
      </View>

      {/* BODY */}
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          gap: 22,
          paddingHorizontal: 32,
          paddingTop: 18,
          paddingBottom: 14,
        }}
      >
        <View style={{ width: 220 }}>
          <SectionHeader label="MAN NEHME" theme={t} bold />
          <IngredientsList
            grouped={[{ name: null, items: recipe.ingredients }]}
            theme={t}
            bold
          />
        </View>
        <View style={{ flex: 1 }}>
          <SectionHeader label="ZUBEREITUNG" theme={t} bold />
          <StepsList steps={recipe.steps} theme={t} bold />
        </View>
      </View>

      <CardFooter brand={brand} pack={pack} recipe={recipe} theme={t} />
    </Page>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// LAYOUT 5: DASHBOARD — Pack 5 (Meal-Prep, Sky Blue)
// ═════════════════════════════════════════════════════════════════════════════
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
            paddingTop: 22,
            paddingBottom: 16,
          }}
        >
          <Text
            style={{
              fontFamily: "Fraunces",
              fontSize: 26,
              lineHeight: 1.04,
              letterSpacing: -0.3,
              color: t.ink,
            }}
          >
            {recipe.title}
          </Text>
          <Text
            style={{
              fontSize: 10.5,
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
            minHeight: 180,
            position: "relative",
          }}
        >
          {heroDataUri ? (
            <Image
              src={heroDataUri}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : null}
        </View>
      </View>

      {/* CHECKLIST BODY */}
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          gap: 22,
          paddingHorizontal: 32,
          paddingVertical: 16,
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
          />
        </View>
        <View style={{ flex: 1 }}>
          <SectionHeader label="ZUBEREITUNG" theme={t} bold />
          <StepsList steps={recipe.steps} theme={t} checklist />
        </View>
      </View>

      <CardFooter brand={brand} pack={pack} recipe={recipe} theme={t} />
    </Page>
  );
}

// ─── Shared building blocks ──────────────────────────────────────────────────

// Renders the ingredients list. When a single (ungrouped) list has more than
// 8 items, automatically switches to a 2-column layout to avoid overflow on
// long recipes (16+ ingredients still fit on one A4 page). Subgroups stack
// vertically and each can independently flip to 2-col when long.
function IngredientsList({
  grouped,
  theme,
  bold = false,
  checklist = false,
}: {
  grouped: IngredientGroup[];
  theme: ReturnType<typeof packTheme>;
  bold?: boolean;
  checklist?: boolean;
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
}: {
  items: IngredientGroup["items"];
  theme: ReturnType<typeof packTheme>;
  bold: boolean;
  checklist: boolean;
}) {
  // Auto 2-col when 9+ items — keeps long recipes on one page.
  const useTwoCol = items.length >= 9;
  if (!useTwoCol) {
    return (
      <View>
        {items.map((ing, i) => (
          <IngredientRow
            key={`${ing.name}-${i}`}
            ing={ing}
            theme={theme}
            bold={bold}
            checklist={checklist}
          />
        ))}
      </View>
    );
  }
  const half = Math.ceil(items.length / 2);
  const left = items.slice(0, half);
  const right = items.slice(half);
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      <View style={{ flex: 1 }}>
        {left.map((ing, i) => (
          <IngredientRow
            key={`L-${ing.name}-${i}`}
            ing={ing}
            theme={theme}
            bold={bold}
            checklist={checklist}
            compact
          />
        ))}
      </View>
      <View style={{ flex: 1 }}>
        {right.map((ing, i) => (
          <IngredientRow
            key={`R-${ing.name}-${i}`}
            ing={ing}
            theme={theme}
            bold={bold}
            checklist={checklist}
            compact
          />
        ))}
      </View>
    </View>
  );
}

function IngredientRow({
  ing,
  theme,
  bold,
  checklist,
  compact = false,
}: {
  ing: IngredientGroup["items"][number];
  theme: ReturnType<typeof packTheme>;
  bold: boolean;
  checklist: boolean;
  compact?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        borderBottomWidth: 0.5,
        borderBottomColor: withAlpha(theme.ink, 0.08),
        paddingVertical: compact ? 2.5 : 3.5,
        gap: 5,
      }}
    >
      <Text
        style={{
          fontSize: compact ? 7 : 7.5,
          color: theme.inkSoft,
          width: compact ? 38 : 50,
          fontWeight: bold ? 600 : 400,
        }}
      >
        {ing.amount}
      </Text>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: compact ? 8.5 : 9.5,
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
              fontSize: compact ? 6.5 : 7,
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
}: {
  steps: string[];
  theme: ReturnType<typeof packTheme>;
  bold?: boolean;
  checklist?: boolean;
}) {
  return (
    <View style={{ marginTop: 8 }}>
      {steps.map((step, idx) => (
        <View
          key={idx}
          style={{ flexDirection: "row", marginBottom: 8, gap: 6 }}
        >
          <Text
            style={{
              fontFamily: "Fraunces",
              fontSize: 18,
              fontWeight: bold ? 700 : 400,
              color: theme.accent,
              width: 18,
              lineHeight: 1,
            }}
          >
            {idx + 1}
          </Text>
          <Text style={{ flex: 1, fontSize: 9.5, lineHeight: 1.45, color: theme.ink }}>
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
          : "rgba(255,255,255,0.6)",
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
}: {
  brand: Brand;
  pack: Pack;
  recipe?: Recipe;
  theme: ReturnType<typeof packTheme>;
  italic?: boolean;
}) {
  return (
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
        marginTop: "auto",
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
  );
}
