import {
  Page,
  View,
  Text,
  Document,
  StyleSheet,
  Image as PDFImage,
} from "@react-pdf/renderer";
import { getTheme, type Theme } from "@/lib/themes";
import type { Recipe, RecipePack } from "@/types/recipe";
import { registerPdfFonts, pdfFontFamily } from "./fonts";

registerPdfFonts();

const A4 = { width: 595.28, height: 841.89 };

function makeStyles(theme: Theme) {
  const display = pdfFontFamily(theme.fonts.display);
  const body = pdfFontFamily(theme.fonts.body);
  const accent = "Caveat";

  return StyleSheet.create({
    page: {
      backgroundColor: theme.palette.paper,
      color: theme.palette.ink,
      fontFamily: body,
      fontSize: 10,
      padding: 0,
      flexDirection: "column",
    },
    accentStrip: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 6,
      backgroundColor: theme.palette.accent,
    },
    body: {
      flex: 1,
      padding: 36,
      paddingTop: 40,
    },
    header: {
      borderBottomWidth: 0.5,
      borderBottomColor: theme.palette.hairline,
      paddingBottom: 16,
      marginBottom: 16,
    },
    eyebrow: {
      fontSize: 7,
      letterSpacing: 2,
      textTransform: "uppercase",
      color: theme.palette.inkSoft,
      marginBottom: 6,
    },
    title: {
      fontFamily: display,
      fontSize: 36,
      fontWeight: 500,
      lineHeight: 1.04,
      color: theme.palette.ink,
    },
    subtitle: {
      fontSize: 13,
      color: theme.palette.inkSoft,
      marginTop: 6,
      fontFamily: display,
    },
    metaRow: {
      flexDirection: "row",
      gap: 14,
      marginTop: 10,
    },
    meta: {
      fontSize: 7.5,
      letterSpacing: 1.6,
      textTransform: "uppercase",
      color: theme.palette.inkSoft,
    },
    twoCol: {
      flexDirection: "row",
      gap: 24,
      flex: 1,
    },
    leftCol: {
      flex: 1.4,
    },
    rightCol: {
      flex: 1,
      borderLeftWidth: 0.5,
      borderLeftColor: theme.palette.hairline,
      paddingLeft: 18,
    },
    photo: {
      width: "100%",
      aspectRatio: 4 / 3,
      backgroundColor: theme.palette.paperDeep,
      borderRadius: 2,
      marginBottom: 12,
      objectFit: "cover",
    },
    description: {
      fontSize: 10.5,
      lineHeight: 1.45,
      color: theme.palette.inkSoft,
      marginBottom: 10,
    },
    chipsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 5,
    },
    chip: {
      borderWidth: 0.5,
      borderColor: theme.palette.hairline,
      borderRadius: 999,
      paddingHorizontal: 7,
      paddingVertical: 2,
      fontSize: 7,
      letterSpacing: 1,
      textTransform: "uppercase",
      color: theme.palette.inkSoft,
    },
    nutritionWrap: {
      backgroundColor: theme.palette.paperDeep,
      borderRadius: 3,
      padding: 10,
      marginBottom: 14,
    },
    nutritionLabel: {
      fontSize: 7,
      letterSpacing: 1.6,
      textTransform: "uppercase",
      color: theme.palette.inkSoft,
      marginBottom: 6,
    },
    nutritionGrid: {
      flexDirection: "row",
    },
    nutritionCol: {
      flex: 1,
      alignItems: "center",
      borderRightWidth: 0.5,
      borderRightColor: theme.palette.hairline,
    },
    nutritionColLast: {
      flex: 1,
      alignItems: "center",
    },
    nutritionValue: {
      fontFamily: display,
      fontSize: 18,
      fontWeight: 500,
      color: theme.palette.ink,
    },
    nutritionUnit: {
      fontSize: 6.5,
      letterSpacing: 1.6,
      textTransform: "uppercase",
      marginTop: 3,
      color: theme.palette.inkSoft,
    },
    sectionHeading: {
      fontSize: 8,
      letterSpacing: 2.5,
      textTransform: "uppercase",
      fontWeight: 600,
      marginBottom: 8,
      color: theme.palette.ink,
    },
    ingredientGroup: {
      marginBottom: 8,
    },
    ingredientGroupLabel: {
      fontSize: 7,
      letterSpacing: 1.4,
      textTransform: "uppercase",
      color: theme.palette.inkSoft,
      marginBottom: 4,
    },
    ingredientRow: {
      flexDirection: "row",
      marginBottom: 3,
      fontSize: 9.5,
    },
    ingredientAmount: {
      width: 60,
      color: theme.palette.inkSoft,
    },
    ingredientName: {
      flex: 1,
      color: theme.palette.ink,
    },
    stepsRow: {
      borderTopWidth: 0.5,
      borderTopColor: theme.palette.hairline,
      paddingTop: 14,
      marginTop: 12,
      flexDirection: "row",
      gap: 24,
    },
    stepsCol: {
      flex: 1,
    },
    step: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 6,
      fontSize: 9.5,
      lineHeight: 1.45,
    },
    stepNumber: {
      fontFamily: display,
      width: 22,
      fontSize: 12,
      color: theme.palette.accent,
    },
    stepText: {
      flex: 1,
      color: theme.palette.ink,
    },
    note: {
      fontFamily: accent,
      fontSize: 13,
      color: theme.palette.inkSoft,
      borderLeftWidth: 1.5,
      borderLeftColor: theme.palette.accent,
      paddingLeft: 10,
    },
    footer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
      marginTop: 12,
    },
    signature: {
      fontFamily: accent,
      fontSize: 18,
      color: theme.palette.ink,
    },
    pageNumber: {
      fontSize: 7,
      letterSpacing: 1.4,
      textTransform: "uppercase",
      color: theme.palette.inkSoft,
    },
  });
}

export function RecipeCardPage({
  recipe,
  themeId,
  packTitle,
  pageNumber,
  totalPages,
}: {
  recipe: Recipe;
  themeId: string;
  packTitle: string;
  pageNumber: number;
  totalPages: number;
}) {
  const theme = getTheme(themeId);
  const styles = makeStyles(theme);

  const groupMap = new Map<string, typeof recipe.ingredients>();
  for (const ing of recipe.ingredients) {
    const key = ing.group ?? "_default";
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(ing);
  }
  const groups = Array.from(groupMap.entries());

  return (
    <Page size={[A4.width, A4.height]} style={styles.page}>
      <View style={styles.accentStrip} />
      <View style={styles.body}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>
            {packTitle} · Recipe {String(pageNumber).padStart(2, "0")} /
            {String(totalPages).padStart(2, "0")}
          </Text>
          <Text style={styles.title}>{recipe.title}</Text>
          {recipe.subtitle && (
            <Text style={styles.subtitle}>{recipe.subtitle}</Text>
          )}
          <View style={styles.metaRow}>
            <Text style={styles.meta}>
              {recipe.totalMinutes ?? recipe.prepMinutes} Min.
            </Text>
            <Text style={styles.meta}>
              {recipe.servings} Portion{recipe.servings > 1 ? "en" : ""}
            </Text>
            {recipe.difficulty && (
              <Text style={styles.meta}>
                {recipe.difficulty === "easy"
                  ? "Einfach"
                  : recipe.difficulty === "medium"
                    ? "Mittel"
                    : "Anspruchsvoll"}
              </Text>
            )}
          </View>
        </View>

        {/* Two-column body */}
        <View style={styles.twoCol}>
          <View style={styles.leftCol}>
            {recipe.imageUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <PDFImage src={recipe.imageUrl} style={styles.photo} />
            ) : (
              <View style={styles.photo} />
            )}
            {recipe.description && (
              <Text style={styles.description}>{recipe.description}</Text>
            )}
            {recipe.highlights.length > 0 && (
              <View style={styles.chipsRow}>
                {recipe.highlights.map((h, i) => (
                  <Text key={i} style={styles.chip}>
                    ✓ {h}
                  </Text>
                ))}
              </View>
            )}
          </View>

          <View style={styles.rightCol}>
            <View style={styles.nutritionWrap}>
              <Text style={styles.nutritionLabel}>Nährwerte pro Portion</Text>
              <View style={styles.nutritionGrid}>
                <View style={styles.nutritionCol}>
                  <Text style={styles.nutritionValue}>
                    {recipe.nutrition.kcal}
                  </Text>
                  <Text style={styles.nutritionUnit}>kcal</Text>
                </View>
                <View style={styles.nutritionCol}>
                  <Text style={styles.nutritionValue}>
                    {recipe.nutrition.protein}g
                  </Text>
                  <Text style={styles.nutritionUnit}>Eiweiß</Text>
                </View>
                <View style={styles.nutritionCol}>
                  <Text style={styles.nutritionValue}>
                    {recipe.nutrition.carbs}g
                  </Text>
                  <Text style={styles.nutritionUnit}>Kohlenh.</Text>
                </View>
                <View style={styles.nutritionColLast}>
                  <Text style={styles.nutritionValue}>
                    {recipe.nutrition.fat}g
                  </Text>
                  <Text style={styles.nutritionUnit}>Fett</Text>
                </View>
              </View>
            </View>

            <Text style={styles.sectionHeading}>Man nehme</Text>
            {groups.map(([group, ings]) => (
              <View style={styles.ingredientGroup} key={group}>
                {group !== "_default" && (
                  <Text style={styles.ingredientGroupLabel}>{group}</Text>
                )}
                {ings.map((ing, i) => (
                  <View style={styles.ingredientRow} key={i}>
                    <Text style={styles.ingredientAmount}>
                      {ing.amount}
                      {ing.unit ? ` ${ing.unit}` : ""}
                    </Text>
                    <Text style={styles.ingredientName}>{ing.name}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>

        {/* Steps */}
        <View style={styles.stepsRow}>
          <View style={styles.stepsCol}>
            <Text style={styles.sectionHeading}>Zubereitung</Text>
            {recipe.steps.map((step) => (
              <View style={styles.step} key={step.index}>
                <Text style={styles.stepNumber}>
                  {String(step.index).padStart(2, "0")}
                </Text>
                <Text style={styles.stepText}>{step.text}</Text>
              </View>
            ))}
          </View>
          <View style={styles.stepsCol}>
            {recipe.notes && <Text style={styles.note}>{recipe.notes}</Text>}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.pageNumber}>
            bienesfitlife · Seite {pageNumber} / {totalPages}
          </Text>
          {recipe.signature && (
            <Text style={styles.signature}>{recipe.signature}</Text>
          )}
        </View>
      </View>
    </Page>
  );
}

function CoverPage({ pack }: { pack: RecipePack }) {
  const theme = getTheme(pack.themeId);
  const styles = makeStyles(theme);
  const display = pdfFontFamily(theme.fonts.display);
  const accent = "Caveat";

  return (
    <Page size={[A4.width, A4.height]} style={styles.page}>
      <View style={styles.accentStrip} />
      <View
        style={{
          flex: 1,
          padding: 56,
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <View>
          <Text
            style={{
              fontSize: 8,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: theme.palette.inkSoft,
            }}
          >
            Recipe Pack · {pack.recipes.length} Rezepte
          </Text>
        </View>

        <View>
          <Text
            style={{
              fontFamily: display,
              fontSize: 80,
              lineHeight: 0.92,
              fontWeight: 500,
              color: theme.palette.ink,
              maxWidth: 380,
            }}
          >
            {pack.title}
          </Text>
          <Text
            style={{
              fontFamily: display,
              fontSize: 22,
              color: theme.palette.accent,
              marginTop: 18,
            }}
          >
            {pack.tagline}
          </Text>
          <Text
            style={{
              fontSize: 11.5,
              lineHeight: 1.55,
              color: theme.palette.inkSoft,
              marginTop: 24,
              maxWidth: 380,
            }}
          >
            {pack.description}
          </Text>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View>
            <Text
              style={{
                fontSize: 8,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: theme.palette.inkSoft,
                marginBottom: 4,
              }}
            >
              Von
            </Text>
            <Text
              style={{
                fontFamily: accent,
                fontSize: 26,
                color: theme.palette.ink,
              }}
            >
              {pack.creator.signature}
            </Text>
            <Text
              style={{
                fontSize: 9,
                color: theme.palette.inkSoft,
                marginTop: 2,
              }}
            >
              {pack.creator.handle}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text
              style={{
                fontSize: 8,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: theme.palette.inkSoft,
              }}
            >
              Wolf Family Office Edition
            </Text>
            <Text
              style={{
                fontSize: 8,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: theme.palette.inkSoft,
                marginTop: 2,
              }}
            >
              Mai 2026
            </Text>
          </View>
        </View>
      </View>
    </Page>
  );
}

function IndexPage({ pack }: { pack: RecipePack }) {
  const theme = getTheme(pack.themeId);
  const styles = makeStyles(theme);
  const display = pdfFontFamily(theme.fonts.display);

  return (
    <Page size={[A4.width, A4.height]} style={styles.page}>
      <View style={styles.body}>
        <Text style={styles.eyebrow}>Inhalt</Text>
        <Text
          style={{
            fontFamily: display,
            fontSize: 36,
            fontWeight: 500,
            color: theme.palette.ink,
            marginBottom: 28,
          }}
        >
          Alle Rezepte
        </Text>

        <View
          style={{ borderTopWidth: 0.5, borderTopColor: theme.palette.hairline }}
        >
          {pack.recipes.map((r, i) => (
            <View
              key={r.id}
              style={{
                flexDirection: "row",
                alignItems: "baseline",
                paddingVertical: 12,
                borderBottomWidth: 0.5,
                borderBottomColor: theme.palette.hairline,
              }}
            >
              <Text
                style={{
                  fontFamily: display,
                  fontSize: 18,
                  width: 36,
                  color: theme.palette.accent,
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </Text>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 15,
                    color: theme.palette.ink,
                    fontWeight: 500,
                  }}
                >
                  {r.title}
                </Text>
                {r.subtitle && (
                  <Text
                    style={{
                      fontSize: 9.5,
                      color: theme.palette.inkSoft,
                      marginTop: 2,
                    }}
                  >
                    {r.subtitle}
                  </Text>
                )}
              </View>
              <Text
                style={{
                  fontSize: 9,
                  letterSpacing: 1.4,
                  textTransform: "uppercase",
                  color: theme.palette.inkSoft,
                  width: 72,
                  textAlign: "right",
                }}
              >
                {r.nutrition.kcal} kcal
              </Text>
              <Text
                style={{
                  fontSize: 9,
                  letterSpacing: 1.4,
                  textTransform: "uppercase",
                  color: theme.palette.inkSoft,
                  width: 50,
                  textAlign: "right",
                }}
              >
                {r.nutrition.protein}g P
              </Text>
              <Text
                style={{
                  fontSize: 9,
                  letterSpacing: 1.4,
                  textTransform: "uppercase",
                  color: theme.palette.inkSoft,
                  width: 50,
                  textAlign: "right",
                }}
              >
                {r.totalMinutes ?? r.prepMinutes} Min
              </Text>
            </View>
          ))}
        </View>
      </View>
    </Page>
  );
}

function NutritionOverviewPage({ pack }: { pack: RecipePack }) {
  const theme = getTheme(pack.themeId);
  const styles = makeStyles(theme);
  const display = pdfFontFamily(theme.fonts.display);

  const sumKcal = pack.recipes.reduce((s, r) => s + r.nutrition.kcal, 0);
  const sumProtein = pack.recipes.reduce((s, r) => s + r.nutrition.protein, 0);
  const sumCarbs = pack.recipes.reduce((s, r) => s + r.nutrition.carbs, 0);
  const sumFat = pack.recipes.reduce((s, r) => s + r.nutrition.fat, 0);

  return (
    <Page size={[A4.width, A4.height]} style={styles.page}>
      <View style={styles.body}>
        <Text style={styles.eyebrow}>Übersicht</Text>
        <Text
          style={{
            fontFamily: display,
            fontSize: 36,
            fontWeight: 500,
            marginBottom: 4,
          }}
        >
          Nährwert-Tabelle
        </Text>
        <Text
          style={{
            fontSize: 11,
            color: theme.palette.inkSoft,
            marginBottom: 26,
          }}
        >
          Alle Rezepte im Überblick — Werte pro Portion.
        </Text>

        <View
          style={{
            flexDirection: "row",
            paddingBottom: 6,
            borderBottomWidth: 1,
            borderBottomColor: theme.palette.ink,
          }}
        >
          <Text
            style={{
              flex: 2,
              fontSize: 8,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            Rezept
          </Text>
          {["kcal", "Eiweiß", "KH", "Fett", "Zeit"].map((c) => (
            <Text
              key={c}
              style={{
                flex: 1,
                fontSize: 8,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                fontWeight: 600,
                textAlign: "right",
              }}
            >
              {c}
            </Text>
          ))}
        </View>

        {pack.recipes.map((r) => (
          <View
            key={r.id}
            style={{
              flexDirection: "row",
              paddingVertical: 8,
              borderBottomWidth: 0.5,
              borderBottomColor: theme.palette.hairline,
              alignItems: "baseline",
            }}
          >
            <Text style={{ flex: 2, fontSize: 10 }}>{r.title}</Text>
            <Text style={{ flex: 1, fontSize: 10, textAlign: "right" }}>
              {r.nutrition.kcal}
            </Text>
            <Text style={{ flex: 1, fontSize: 10, textAlign: "right" }}>
              {r.nutrition.protein} g
            </Text>
            <Text style={{ flex: 1, fontSize: 10, textAlign: "right" }}>
              {r.nutrition.carbs} g
            </Text>
            <Text style={{ flex: 1, fontSize: 10, textAlign: "right" }}>
              {r.nutrition.fat} g
            </Text>
            <Text style={{ flex: 1, fontSize: 10, textAlign: "right" }}>
              {r.totalMinutes ?? r.prepMinutes} Min
            </Text>
          </View>
        ))}

        <View
          style={{
            flexDirection: "row",
            paddingVertical: 12,
            borderTopWidth: 1,
            borderTopColor: theme.palette.ink,
            marginTop: 4,
          }}
        >
          <Text style={{ flex: 2, fontSize: 11, fontWeight: 600 }}>
            Gesamt-Pack
          </Text>
          {[sumKcal, `${sumProtein} g`, `${sumCarbs} g`, `${sumFat} g`, "—"].map(
            (v, i) => (
              <Text
                key={i}
                style={{
                  flex: 1,
                  fontSize: 11,
                  fontWeight: 600,
                  textAlign: "right",
                }}
              >
                {v}
              </Text>
            ),
          )}
        </View>
      </View>
    </Page>
  );
}

export function PackPDF({ pack }: { pack: RecipePack }) {
  const totalPages = pack.recipes.length;
  return (
    <Document
      title={`${pack.title} – ${pack.creator.name}`}
      author={pack.creator.name}
      subject={pack.tagline}
      creator="Recipe Card Builder · Wolf Family Office"
      producer="Recipe Card Builder"
    >
      <CoverPage pack={pack} />
      <IndexPage pack={pack} />
      {pack.recipes.map((recipe, idx) => (
        <RecipeCardPage
          key={recipe.id}
          recipe={recipe}
          themeId={pack.themeId}
          packTitle={pack.title}
          pageNumber={idx + 1}
          totalPages={totalPages}
        />
      ))}
      <NutritionOverviewPage pack={pack} />
    </Document>
  );
}
