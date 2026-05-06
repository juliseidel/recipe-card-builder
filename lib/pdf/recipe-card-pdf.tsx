import { Page, View, Text, Image } from "@react-pdf/renderer";
import type { Brand } from "@/lib/brands";
import type { Pack, CardLayout } from "@/lib/packs";
import type { Recipe } from "@/lib/recipes";
import {
  groupIngredients,
  totalTime,
  pad2,
  portionsLabel,
} from "./helpers";
import { A4, packTheme, withAlpha, blendWithWhite } from "./theme";

// ─────────────────────────────────────────────────────────────────────────────
// Public entry — returns a single A4 page rendered in the matching layout.
// Used both for single-recipe PDFs and for the recipe pages inside a pack PDF.
// ─────────────────────────────────────────────────────────────────────────────
export type RecipeCardPdfProps = {
  brand: Brand;
  pack: Pack;
  recipe: Recipe;
  totalRecipes: number;
  heroDataUri: string | null;
};

export function RecipeCardPdfPage(props: RecipeCardPdfProps) {
  const layout = props.pack.cardLayout;
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
// Cookbook-Spread: warm pack-mood band at top, framed hero, 3-tile portion bar,
// group-aware ingredients on the left, numbered steps on the right, macro bars.
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
      style={{
        backgroundColor: "#ffffff",
        fontFamily: "Inter",
        color: t.ink,
      }}
    >
      {/* HEADER BAND */}
      <View
        style={{
          backgroundColor: t.paper,
          borderBottomWidth: 1,
          borderBottomColor: t.divider,
          paddingHorizontal: 36,
          paddingTop: 28,
          paddingBottom: 22,
        }}
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
            fontSize: 32,
            lineHeight: 1.04,
            letterSpacing: -0.3,
            color: t.ink,
            textTransform: "uppercase",
            marginTop: 14,
          }}
        >
          {recipe.title}
        </Text>
        <Text
          style={{
            fontFamily: "Fraunces",
            fontStyle: "italic",
            fontSize: 13,
            color: t.inkSoft,
            lineHeight: 1.35,
            marginTop: 6,
          }}
        >
          {recipe.subtitle}
        </Text>

        {recipe.description ? (
          <Text
            style={{
              fontSize: 9.5,
              lineHeight: 1.55,
              color: t.ink,
              opacity: 0.85,
              marginTop: 10,
              maxWidth: 460,
            }}
          >
            {recipe.description}
          </Text>
        ) : null}

        {recipe.tags?.length ? (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              marginTop: 12,
              gap: 4,
            }}
          >
            {recipe.tags.slice(0, 5).map((tag) => (
              <Text
                key={tag}
                style={{
                  fontSize: 7,
                  fontWeight: 600,
                  letterSpacing: 0.8,
                  textTransform: "uppercase",
                  color: t.ink,
                  backgroundColor: t.bg,
                  paddingHorizontal: 6,
                  paddingVertical: 2.5,
                  borderRadius: 999,
                }}
              >
                {tag}
              </Text>
            ))}
          </View>
        ) : null}
      </View>

      {/* HERO IMAGE */}
      {heroDataUri ? (
        <View
          style={{
            paddingHorizontal: 36,
            paddingTop: 18,
            paddingBottom: 4,
            backgroundColor: t.paper,
          }}
        >
          <View
            style={{
              borderRadius: 12,
              overflow: "hidden",
              alignSelf: "center",
              width: 460,
              height: 200,
            }}
          >
            <Image src={heroDataUri} style={{ width: 460, height: 200, objectFit: "cover" }} />
          </View>
        </View>
      ) : null}

      {/* PORTIONS HERO BAR — 3 tiles */}
      <View
        style={{
          flexDirection: "row",
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: t.divider,
        }}
      >
        <PortionTile
          label="REZEPT ERGIBT"
          value={`${recipe.servings}×`}
          sub={pl}
          theme={t}
          borderRight
        />
        <PortionTile
          label="PRO PORTION"
          value={String(recipe.nutrition.kcal)}
          sub={`kcal · ${recipe.nutrition.protein}g Eiweiß`}
          theme={t}
          highlight
          borderRight
          accentLabel
        />
        <PortionTile
          label="GESAMTZEIT"
          value={String(time)}
          sub={`Min · ${recipe.difficulty}`}
          theme={t}
        />
      </View>

      {/* BODY: Ingredients (group-aware) | Steps */}
      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: 36,
          paddingVertical: 22,
          gap: 24,
        }}
      >
        {/* Ingredients column */}
        <View style={{ width: 200 }}>
          <SectionHeader
            label="MAN NEHME"
            right={`für ${recipe.servings} ${pl}`}
            theme={t}
          />
          <View style={{ marginTop: 10 }}>
            {grouped.map((g, gi) => (
              <View key={g.name ?? `m${gi}`} style={{ marginBottom: 12 }}>
                {g.name ? (
                  <Text
                    style={{
                      fontSize: 7,
                      letterSpacing: 1.4,
                      fontWeight: 600,
                      color: t.inkSoft,
                      marginBottom: 5,
                      textTransform: "uppercase",
                    }}
                  >
                    Für {g.name.toLowerCase()}
                  </Text>
                ) : null}
                {g.items.map((ing, ii) => (
                  <View
                    key={`${ing.name}-${ii}`}
                    style={{
                      flexDirection: "row",
                      borderBottomWidth: 0.5,
                      borderBottomColor: withAlpha(t.ink, 0.08),
                      paddingVertical: 4,
                      gap: 6,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Inter",
                        fontSize: 8,
                        color: t.inkSoft,
                        width: 56,
                      }}
                    >
                      {ing.amount}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{ fontSize: 9.5, lineHeight: 1.35, color: t.ink }}
                      >
                        {ing.name}
                      </Text>
                      {ing.note ? (
                        <Text
                          style={{
                            fontSize: 7.5,
                            fontStyle: "italic",
                            color: t.inkSoft,
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
        </View>

        {/* Steps column */}
        <View style={{ flex: 1 }}>
          <SectionHeader
            label="ZUBEREITUNG"
            right={`${recipe.steps.length} Schritte`}
            theme={t}
          />
          <View style={{ marginTop: 10 }}>
            {recipe.steps.map((step, idx) => (
              <View
                key={idx}
                style={{
                  flexDirection: "row",
                  marginBottom: 10,
                  gap: 8,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Fraunces",
                    fontSize: 22,
                    color: t.accent,
                    width: 22,
                    lineHeight: 1,
                  }}
                >
                  {idx + 1}
                </Text>
                <Text
                  style={{
                    flex: 1,
                    fontSize: 10,
                    lineHeight: 1.5,
                    color: t.ink,
                  }}
                >
                  {step}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* MACROS — bar chart */}
      <MacrosHero recipe={recipe} theme={t} />

      <CardFooter brand={brand} pack={pack} recipe={recipe} theme={t} />
    </Page>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// LAYOUT 2: PATISSERIE — Pack 2 (Backwelt, Lavender)
// Boutique-Editorial: tinted page background, italic display, polaroid hero,
// macro pills, two-column body on white surface.
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
      {/* HEAD */}
      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: 40,
          paddingTop: 36,
          paddingBottom: 22,
          gap: 24,
        }}
      >
        <View style={{ flex: 1.4 }}>
          <Text
            style={{
              fontSize: 8,
              letterSpacing: 1.6,
              fontWeight: 600,
              color: t.inkSoft,
            }}
          >
            № {pad2(recipe.number)} / {pad2(totalRecipes)} · {pack.title.toUpperCase()}
          </Text>
          <Text
            style={{
              fontFamily: "Fraunces",
              fontStyle: "italic",
              fontSize: 44,
              lineHeight: 1,
              letterSpacing: -0.4,
              color: t.ink,
              marginTop: 14,
            }}
          >
            {recipe.title}
          </Text>
          <Text
            style={{
              fontFamily: "Fraunces",
              fontStyle: "italic",
              fontSize: 16,
              lineHeight: 1.3,
              color: t.inkSoft,
              marginTop: 8,
            }}
          >
            «&nbsp;{recipe.subtitle}&nbsp;»
          </Text>
          <View
            style={{
              flexDirection: "row",
              gap: 10,
              marginTop: 14,
              flexWrap: "wrap",
            }}
          >
            <Text style={{ fontSize: 9, color: t.inkSoft }}>{time} Minuten</Text>
            <Text style={{ fontSize: 9, color: t.inkSoft }}>·</Text>
            <Text style={{ fontSize: 9, color: t.inkSoft }}>
              ergibt {recipe.servings} {stueck}
            </Text>
            <Text style={{ fontSize: 9, color: t.inkSoft }}>·</Text>
            <Text style={{ fontSize: 9, color: t.inkSoft }}>{recipe.difficulty}</Text>
          </View>
        </View>

        {/* Polaroid */}
        <View style={{ flex: 1 }}>
          {heroDataUri ? (
            <View
              style={{
                borderWidth: 6,
                borderColor: "#ffffff",
                borderRadius: 14,
                overflow: "hidden",
                width: 170,
                height: 170,
                alignSelf: "flex-end",
                backgroundColor: "#ffffff",
              }}
            >
              <Image
                src={heroDataUri}
                style={{ width: 158, height: 158, objectFit: "cover" }}
              />
            </View>
          ) : null}
        </View>
      </View>

      {/* MACRO PILLS */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          paddingHorizontal: 40,
          paddingVertical: 14,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: t.divider,
          flexWrap: "wrap",
        }}
      >
        <View
          style={{
            backgroundColor: t.ink,
            borderRadius: 999,
            paddingHorizontal: 12,
            paddingVertical: 5,
          }}
        >
          <Text style={{ color: t.bg, fontSize: 10, fontWeight: 600 }}>
            {recipe.nutrition.kcal} kcal{" "}
            <Text style={{ fontSize: 7.5, fontStyle: "italic", opacity: 0.85 }}>
              pro {stueck === "Stücke" ? "Stück" : "Stück"}
            </Text>
          </Text>
        </View>
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
          gap: 28,
          paddingHorizontal: 40,
          paddingTop: 28,
          paddingBottom: 28,
        }}
      >
        <View style={{ width: 200 }}>
          <Text
            style={{
              fontSize: 9,
              letterSpacing: 1.8,
              fontWeight: 600,
              fontStyle: "italic",
              color: t.accent,
              fontFamily: "Fraunces",
            }}
          >
            MAN NEHME
          </Text>
          <View style={{ marginTop: 12 }}>
            {recipe.ingredients.map((ing, i) => (
              <View
                key={`${ing.name}-${i}`}
                style={{
                  flexDirection: "row",
                  borderBottomWidth: 0.5,
                  borderBottomColor: withAlpha(t.ink, 0.1),
                  paddingVertical: 4.5,
                  gap: 6,
                }}
              >
                <Text style={{ fontSize: 8, color: t.inkSoft, width: 52 }}>
                  {ing.amount}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 9.5, color: t.ink }}>{ing.name}</Text>
                  {ing.note ? (
                    <Text
                      style={{
                        fontSize: 7.5,
                        fontStyle: "italic",
                        color: t.inkSoft,
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
        </View>

        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 9,
              letterSpacing: 1.8,
              fontWeight: 600,
              fontStyle: "italic",
              color: t.accent,
              fontFamily: "Fraunces",
            }}
          >
            ZUBEREITUNG
          </Text>
          <View style={{ marginTop: 12 }}>
            {recipe.steps.map((s, idx) => (
              <View
                key={idx}
                style={{ flexDirection: "row", marginBottom: 10, gap: 8 }}
              >
                <Text
                  style={{
                    fontFamily: "Fraunces",
                    fontSize: 22,
                    color: t.accent,
                    width: 22,
                    lineHeight: 1,
                  }}
                >
                  {idx + 1}
                </Text>
                <Text
                  style={{ flex: 1, fontSize: 10, lineHeight: 1.55, color: t.ink }}
                >
                  {s}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <CardFooter brand={brand} pack={pack} recipe={recipe} theme={t} italic />
    </Page>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// LAYOUT 3: MINIMAL — Pack 3 (Snacks, Pistachio)
// Apple-vibe: massive number, bold sans title, square image, compact stats.
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
    <Page size="A4" style={{ backgroundColor: "#ffffff", fontFamily: "Inter", color: t.ink }}>
      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: 40,
          paddingTop: 40,
          paddingBottom: 20,
          gap: 24,
        }}
      >
        <View style={{ flex: 1.5 }}>
          <Text
            style={{
              fontSize: 8,
              letterSpacing: 1.8,
              fontWeight: 600,
              color: t.inkSoft,
            }}
          >
            {pack.title.toUpperCase()} · {pad2(recipe.number)} / {pad2(totalRecipes)}
          </Text>
          <Text
            style={{
              fontFamily: "Fraunces",
              fontSize: 96,
              color: t.accent,
              lineHeight: 0.86,
              marginTop: 14,
              letterSpacing: -2,
            }}
          >
            {pad2(recipe.number)}
          </Text>
          <Text
            style={{
              fontSize: 28,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: -0.4,
              color: t.ink,
              marginTop: 16,
              lineHeight: 1.02,
            }}
          >
            {recipe.title}
          </Text>
          <Text
            style={{ fontSize: 11, color: t.inkSoft, marginTop: 6, lineHeight: 1.35 }}
          >
            {recipe.subtitle}
          </Text>
          <Text
            style={{
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: 1.2,
              color: t.accent,
              marginTop: 10,
              textTransform: "uppercase",
            }}
          >
            ergibt {recipe.servings} {pl}
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          {heroDataUri ? (
            <View
              style={{
                borderRadius: 12,
                overflow: "hidden",
                width: 200,
                height: 200,
                alignSelf: "flex-end",
              }}
            >
              <Image src={heroDataUri} style={{ width: 200, height: 200, objectFit: "cover" }} />
            </View>
          ) : null}
          <View
            style={{
              flexDirection: "row",
              marginTop: 10,
              borderRadius: 12,
              borderWidth: 0.5,
              borderColor: withAlpha(t.ink, 0.1),
              backgroundColor: blendWithWhite(t.bg, 0.5),
              paddingVertical: 10,
              alignSelf: "flex-end",
              width: 200,
            }}
          >
            <MinStat value={String(recipe.nutrition.kcal)} label="kcal" theme={t} />
            <MinStat
              value={`${recipe.nutrition.protein}g`}
              label="Eiweiß"
              theme={t}
            />
            <MinStat value={`${time}'`} label="Min" theme={t} />
          </View>
        </View>
      </View>

      <View
        style={{
          flex: 1,
          flexDirection: "row",
          gap: 32,
          paddingHorizontal: 40,
          paddingTop: 24,
          paddingBottom: 24,
          borderTopWidth: 1,
          borderTopColor: t.divider,
        }}
      >
        <View style={{ width: 200 }}>
          <Text
            style={{
              fontSize: 9,
              letterSpacing: 1.8,
              fontWeight: 700,
              color: t.accent,
              textTransform: "uppercase",
            }}
          >
            Man nehme
          </Text>
          <View style={{ marginTop: 12 }}>
            {recipe.ingredients.map((ing, i) => (
              <View
                key={`${ing.name}-${i}`}
                style={{ flexDirection: "row", paddingVertical: 4, gap: 6 }}
              >
                <Text style={{ fontSize: 8, color: t.inkSoft, width: 52 }}>
                  {ing.amount}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 9.5, color: t.ink }}>{ing.name}</Text>
                  {ing.note ? (
                    <Text
                      style={{
                        fontSize: 7.5,
                        fontStyle: "italic",
                        color: t.inkSoft,
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

        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 9,
              letterSpacing: 1.8,
              fontWeight: 700,
              color: t.accent,
              textTransform: "uppercase",
            }}
          >
            Zubereitung
          </Text>
          <View style={{ marginTop: 12 }}>
            {recipe.steps.map((s, idx) => (
              <View
                key={idx}
                style={{ flexDirection: "row", marginBottom: 10, gap: 8 }}
              >
                <Text
                  style={{
                    fontFamily: "Fraunces",
                    fontSize: 22,
                    color: t.accent,
                    width: 22,
                    lineHeight: 1,
                  }}
                >
                  {idx + 1}
                </Text>
                <Text
                  style={{ flex: 1, fontSize: 10, lineHeight: 1.55, color: t.ink }}
                >
                  {s}
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

// ═════════════════════════════════════════════════════════════════════════════
// LAYOUT 4: SPORT — Pack 4 (Volumen, Sage Green)
// Athletic: dark hero overlay with kcal-trophy + bold uppercase title.
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
      {/* HERO */}
      <View
        style={{
          height: 280,
          position: "relative",
          backgroundColor: t.ink,
        }}
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
        {/* Gradient overlay simulated as solid tinted block */}
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
            padding: 30,
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
                fontSize: 8,
                letterSpacing: 1.8,
                color: "#ffffff",
                fontWeight: 600,
              }}
            >
              PACK {pad2(pack.number)} · KARTE {pad2(recipe.number)} / {pad2(totalRecipes)}
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
                  fontSize: 8,
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
                  fontSize: 60,
                  fontWeight: 700,
                  color: "#ffffff",
                  letterSpacing: -1.5,
                  lineHeight: 1,
                }}
              >
                {recipe.nutrition.kcal}
              </Text>
              <View>
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: 1.4,
                    color: "rgba(255,255,255,0.85)",
                    textTransform: "uppercase",
                  }}
                >
                  kcal pro Portion
                </Text>
                <Text style={{ fontSize: 8, color: "rgba(255,255,255,0.65)" }}>
                  {recipe.servings === 1 ? "1 Portion" : `Rezept ergibt ${recipe.servings} Portionen`}
                </Text>
              </View>
            </View>
            <Text
              style={{
                fontSize: 32,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: -0.5,
                color: "#ffffff",
                marginTop: 10,
                lineHeight: 1,
              }}
            >
              {recipe.title}
            </Text>
            <Text
              style={{
                fontSize: 10,
                letterSpacing: 1.4,
                color: "rgba(255,255,255,0.85)",
                marginTop: 6,
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
              paddingVertical: 14,
              borderRightWidth: i === arr.length - 1 ? 0 : 1,
              borderRightColor: t.divider,
            }}
          >
            <Text
              style={{ fontSize: 18, fontWeight: 700, color: t.ink }}
            >
              {m.value}
            </Text>
            <Text
              style={{
                fontSize: 8,
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
          gap: 28,
          paddingHorizontal: 36,
          paddingTop: 26,
          paddingBottom: 26,
        }}
      >
        <View style={{ width: 200 }}>
          <Text
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 1.8,
              color: t.accent,
              textTransform: "uppercase",
            }}
          >
            Man nehme
          </Text>
          <View style={{ marginTop: 12 }}>
            {recipe.ingredients.map((ing, i) => (
              <View
                key={`${ing.name}-${i}`}
                style={{
                  flexDirection: "row",
                  borderBottomWidth: 0.5,
                  borderBottomColor: withAlpha(t.ink, 0.1),
                  paddingVertical: 4.5,
                  gap: 6,
                }}
              >
                <Text style={{ fontSize: 8, color: t.inkSoft, width: 52, fontWeight: 600 }}>
                  {ing.amount}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 9.5, fontWeight: 600, color: t.ink }}>
                    {ing.name}
                  </Text>
                  {ing.note ? (
                    <Text
                      style={{
                        fontSize: 7.5,
                        fontStyle: "italic",
                        color: t.inkSoft,
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

        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 1.8,
              color: t.accent,
              textTransform: "uppercase",
            }}
          >
            Zubereitung
          </Text>
          <View style={{ marginTop: 12 }}>
            {recipe.steps.map((s, idx) => (
              <View
                key={idx}
                style={{ flexDirection: "row", marginBottom: 10, gap: 8 }}
              >
                <Text
                  style={{
                    fontFamily: "Fraunces",
                    fontSize: 22,
                    fontWeight: 700,
                    color: t.accent,
                    width: 22,
                    lineHeight: 1,
                  }}
                >
                  {idx + 1}
                </Text>
                <Text
                  style={{ flex: 1, fontSize: 10, lineHeight: 1.55, color: t.ink }}
                >
                  {s}
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

// ═════════════════════════════════════════════════════════════════════════════
// LAYOUT 5: DASHBOARD — Pack 5 (Meal-Prep, Sky Blue)
// Notion-style: weekday tag, structured data rows, image strip, checklist body.
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
          paddingHorizontal: 36,
          paddingVertical: 12,
          backgroundColor: blendWithWhite(t.bg, 0.6),
          borderBottomWidth: 1,
          borderBottomColor: t.divider,
        }}
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
              fontSize: 8,
              fontWeight: 600,
              letterSpacing: 1.4,
              color: t.ink,
              textTransform: "uppercase",
            }}
          >
            {weekDay}
          </Text>
        </View>
        <Text style={{ fontSize: 9, color: t.inkSoft }}>
          Pack {pad2(pack.number)} · {pack.title} · Karte {pad2(recipe.number)} /{" "}
          {pad2(totalRecipes)}
        </Text>
        <View style={{ flex: 1 }} />
        <Text style={{ fontSize: 9, color: t.accent, fontWeight: 600 }}>
          ✓ Mealprep-Ready
        </Text>
      </View>

      {/* TITLE + IMAGE STRIP */}
      <View style={{ flexDirection: "row" }}>
        <View
          style={{
            flex: 1.4,
            paddingHorizontal: 36,
            paddingTop: 28,
            paddingBottom: 24,
          }}
        >
          <Text
            style={{
              fontFamily: "Fraunces",
              fontSize: 30,
              lineHeight: 1.04,
              letterSpacing: -0.3,
              color: t.ink,
            }}
          >
            {recipe.title}
          </Text>
          <Text
            style={{ fontSize: 11, color: t.inkSoft, lineHeight: 1.35, marginTop: 6 }}
          >
            {recipe.subtitle}
          </Text>

          {/* DATA ROWS */}
          <View
            style={{
              marginTop: 14,
              borderRadius: 8,
              borderWidth: 0.5,
              borderColor: t.divider,
              overflow: "hidden",
            }}
          >
            <DashRow icon="🍴" label="Ergibt" value={`${recipe.servings} ${pl}`} theme={t} />
            <DashRow
              icon="🔥"
              label="Pro Portion"
              value={`${recipe.nutrition.kcal} kcal`}
              theme={t}
              highlight
            />
            <DashRow
              icon="💪"
              label="Eiweiß / Portion"
              value={`${recipe.nutrition.protein} g`}
              theme={t}
            />
            <DashRow icon="⏱" label="Zubereitung" value={`${time} Min`} theme={t} />
            <DashRow
              icon="📊"
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
            minHeight: 220,
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
          gap: 28,
          paddingHorizontal: 36,
          paddingVertical: 22,
          borderTopWidth: 1,
          borderTopColor: t.divider,
        }}
      >
        <View style={{ width: 200 }}>
          <Text
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 1.6,
              color: t.accent,
              textTransform: "uppercase",
            }}
          >
            Man nehme
          </Text>
          <View style={{ marginTop: 12 }}>
            {recipe.ingredients.map((ing, i) => (
              <View
                key={`${ing.name}-${i}`}
                style={{ flexDirection: "row", paddingVertical: 4, gap: 6 }}
              >
                <Text style={{ fontSize: 8, color: t.inkSoft, width: 50 }}>
                  {ing.amount}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 9.5, color: t.ink }}>
                    <Text style={{ color: t.inkSubtle }}>☐ </Text>
                    {ing.name}
                  </Text>
                  {ing.note ? (
                    <Text
                      style={{
                        fontSize: 7.5,
                        fontStyle: "italic",
                        color: t.inkSoft,
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

        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 1.6,
              color: t.accent,
              textTransform: "uppercase",
            }}
          >
            Zubereitung
          </Text>
          <View style={{ marginTop: 12 }}>
            {recipe.steps.map((s, idx) => (
              <View
                key={idx}
                style={{ flexDirection: "row", marginBottom: 10, gap: 8 }}
              >
                <Text
                  style={{
                    fontFamily: "Fraunces",
                    fontSize: 20,
                    color: t.accent,
                    width: 20,
                    lineHeight: 1,
                  }}
                >
                  {idx + 1}
                </Text>
                <Text style={{ flex: 1, fontSize: 10, lineHeight: 1.55, color: t.ink }}>
                  <Text style={{ color: t.inkSubtle }}>☐ </Text>
                  {s}
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

// ─── Sub-components ──────────────────────────────────────────────────────────

function PortionTile({
  label,
  value,
  sub,
  theme,
  highlight = false,
  borderRight = false,
  accentLabel = false,
}: {
  label: string;
  value: string;
  sub: string;
  theme: ReturnType<typeof packTheme>;
  highlight?: boolean;
  borderRight?: boolean;
  accentLabel?: boolean;
}) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        paddingVertical: 16,
        paddingHorizontal: 6,
        backgroundColor: highlight ? blendWithWhite(theme.bg, 0.65) : "transparent",
        borderRightWidth: borderRight ? 1 : 0,
        borderRightColor: theme.divider,
      }}
    >
      <Text
        style={{
          fontSize: 7,
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
          fontSize: 26,
          color: theme.ink,
          marginTop: 4,
          lineHeight: 1,
        }}
      >
        {value}
      </Text>
      <Text style={{ fontSize: 8, color: theme.inkSoft, marginTop: 3 }}>
        {sub}
      </Text>
    </View>
  );
}

function SectionHeader({
  label,
  right,
  theme,
}: {
  label: string;
  right?: string;
  theme: ReturnType<typeof packTheme>;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
        borderBottomWidth: 1,
        borderBottomColor: withAlpha(theme.ink, 0.15),
        paddingBottom: 4,
      }}
    >
      <Text
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: 1.8,
          color: theme.accent,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
      {right ? (
        <Text
          style={{
            fontSize: 7.5,
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

function MacrosHero({
  recipe,
  theme,
}: {
  recipe: Recipe;
  theme: ReturnType<typeof packTheme>;
}) {
  const bars = [
    { label: "Eiweiß", value: recipe.nutrition.protein, max: 60, unit: "g" },
    { label: "Kohlenhydrate", value: recipe.nutrition.carbs, max: 100, unit: "g" },
    { label: "Fett", value: recipe.nutrition.fat, max: 40, unit: "g" },
  ];
  if (recipe.nutrition.fiber !== undefined) {
    bars.push({
      label: "Ballaststoffe",
      value: recipe.nutrition.fiber,
      max: 15,
      unit: "g",
    });
  }
  return (
    <View
      style={{
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: withAlpha(theme.ink, 0.15),
        paddingHorizontal: 36,
        paddingVertical: 16,
        backgroundColor: blendWithWhite(theme.bg, 0.85),
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 8,
        }}
      >
        <Text
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 1.8,
            color: theme.accent,
            textTransform: "uppercase",
          }}
        >
          Makronährstoffe
        </Text>
        <Text
          style={{
            fontSize: 7.5,
            letterSpacing: 1,
            color: theme.inkSoft,
            textTransform: "uppercase",
          }}
        >
          pro Portion ({recipe.nutrition.kcal} kcal)
        </Text>
      </View>
      {bars.map((b) => (
        <View
          key={b.label}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            marginBottom: 4,
          }}
        >
          <Text
            style={{
              fontSize: 8,
              fontWeight: 600,
              letterSpacing: 1.2,
              color: theme.inkSoft,
              width: 80,
              textTransform: "uppercase",
            }}
          >
            {b.label}
          </Text>
          <View
            style={{
              flex: 1,
              height: 5,
              borderRadius: 3,
              backgroundColor: withAlpha(theme.ink, 0.08),
              overflow: "hidden",
            }}
          >
            <View
              style={{
                width: `${Math.min((b.value / b.max) * 100, 100)}%`,
                height: 5,
                backgroundColor: theme.accent,
              }}
            />
          </View>
          <Text
            style={{
              fontFamily: "Fraunces",
              fontSize: 12,
              color: theme.ink,
              width: 28,
              textAlign: "right",
            }}
          >
            {b.value}
            {b.unit}
          </Text>
        </View>
      ))}
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
      <Text style={{ fontSize: 14, fontWeight: 700, color: theme.ink }}>
        {value}
      </Text>
      <Text
        style={{
          fontSize: 7,
          fontWeight: 600,
          letterSpacing: 1.2,
          color: theme.inkSoft,
          marginTop: 2,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function DashRow({
  icon,
  label,
  value,
  theme,
  highlight = false,
  last = false,
}: {
  icon: string;
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
        paddingVertical: 7,
        gap: 8,
        backgroundColor: highlight
          ? blendWithWhite(theme.bg, 0.6)
          : "rgba(255,255,255,0.6)",
        borderBottomWidth: last ? 0 : 0.5,
        borderBottomColor: theme.divider,
      }}
    >
      <Text style={{ fontSize: 11, width: 18 }}>{icon}</Text>
      <Text
        style={{
          flex: 1,
          fontSize: highlight ? 10 : 9.5,
          color: highlight ? theme.ink : theme.inkSoft,
          fontWeight: highlight ? 600 : 400,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: highlight ? 10 : 9,
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
        paddingHorizontal: 36,
        paddingVertical: 12,
        marginTop: "auto",
      }}
      fixed
    >
      <Text
        style={{
          fontFamily: "Fraunces",
          fontSize: 14,
          fontStyle: italic ? "italic" : "normal",
          color: brand.tokens.ink,
        }}
      >
        {brand.signature}
      </Text>
      <Text
        style={{
          fontSize: 7.5,
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
