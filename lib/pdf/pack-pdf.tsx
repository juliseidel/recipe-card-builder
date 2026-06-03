import { Document, Page, View, Text, Image } from "@react-pdf/renderer";
import type { Brand } from "@/lib/brands";
import type { Pack, StoryPage } from "@/lib/packs";
import type { Recipe } from "@/lib/recipes";
import type { PackForewordContent } from "@/lib/ai/generate-foreword";
import { packTheme, withAlpha, blendWithWhite, fontFamilyForPack } from "./theme";
import { pad2, totalTime } from "./helpers";
import { RecipeCardPdfPage } from "./recipe-card-pdf";
import { ForewordPage } from "./foreword-page";
import { StoryPagePdf } from "./story-page-pdf";
import { BeeIcon } from "./bee-icon";

// ─── Story-Page-Position-Bucketing ───────────────────────────────────────
// User-Wunsch (Inkrement 3): Story-Pages haben Position-Slots — manche
// kommen direkt nach dem Vorwort, andere zwischen Rezepten, andere vor
// dem Outro. Wir bucketen die storyPages-Liste nach Slot, behalten aber
// die User-definierte Reihenfolge innerhalb eines Slots bei.
type StoryBuckets = {
  afterForeword: StoryPage[];
  beforeRecipe: Map<number, StoryPage[]>;
  beforeOutro: StoryPage[];
};

function bucketStoryPages(pages: StoryPage[]): StoryBuckets {
  const buckets: StoryBuckets = {
    afterForeword: [],
    beforeRecipe: new Map(),
    beforeOutro: [],
  };
  for (const page of pages) {
    const pos = page.position ?? { slot: "after-foreword" };
    if (pos.slot === "before-recipe") {
      const list = buckets.beforeRecipe.get(pos.recipeNumber) ?? [];
      list.push(page);
      buckets.beforeRecipe.set(pos.recipeNumber, list);
    } else if (pos.slot === "before-outro") {
      buckets.beforeOutro.push(page);
    } else {
      // Default + explicit after-foreword
      buckets.afterForeword.push(page);
    }
  }
  return buckets;
}

export type PackPdfProps = {
  brand: Brand;
  pack: Pack;
  recipes: Recipe[];
  coverDataUri: string | null;
  // hero data URIs in the same order as `recipes`
  heroDataUris: Array<string | null>;
  // QR-code data URIs in the same order as `recipes`. Null entries skip
  // the QR strip in the footer (recipe has no sourceUrl).
  qrDataUris: Array<string | null>;
  // Foreword section. All three pieces must be present for the foreword
  // page to render — if any is missing (no cached text, image not on
  // disk yet, avatar not loaded), the cover-to-index sequence stays
  // exactly as it was before. This keeps the four packs we haven't
  // generated forewords for yet identical to their pre-foreword PDFs.
  forewordContent?: PackForewordContent | null;
  forewordImageDataUri?: string | null;
  avatarDataUri?: string | null;
  // Story-Pages (Guide-Modus). Nur gerendert wenn pack.packMode==='guide'
  // UND pack.storyPages?.length > 0. storyImageDataUris in derselben
  // Reihenfolge wie pack.storyPages — null-Entries rendern Placeholder.
  storyImageDataUris?: Array<string | null>;
};

export function PackPdfDocument({
  brand,
  pack,
  recipes,
  coverDataUri,
  heroDataUris,
  qrDataUris,
  forewordContent,
  forewordImageDataUri,
  avatarDataUri,
  storyImageDataUris,
}: PackPdfProps) {
  // Show foreword whenever cached text is available. The still-life image
  // is optional — Variants render a graceful Text-Only-Layout wenn
  // forewordImageDataUri null ist. So bleibt das Vorwort fuer Custom-Packs
  // verfuegbar, auch wenn die Flux-Bild-Generierung gefailt ist oder der
  // User das Bild bewusst weglassen will.
  const showForeword = Boolean(forewordContent);
  const t = packTheme(pack);
  const titleFont = fontFamilyForPack(pack);

  // Story-Pages aktiv nur im Guide-Modus mit mind. 1 Page.
  const storyPages =
    pack.packMode === "guide" && pack.storyPages && pack.storyPages.length > 0
      ? pack.storyPages
      : [];
  const storyBuckets = bucketStoryPages(storyPages);

  // Helper: finde imageDataUri zu einer StoryPage (anhand der storyPages-
  // Reihenfolge — storyImageDataUris ist parallel-indiziert).
  function getStoryImage(page: StoryPage): string | null {
    if (!storyImageDataUris) return null;
    const idx = storyPages.indexOf(page);
    return idx >= 0 ? storyImageDataUris[idx] ?? null : null;
  }

  // Page-Nummerierung fuer das Inhaltsverzeichnis. Mit Story-Pages an
  // beliebigen Slots muss IndexPage wissen welche Recipe-Page auf welcher
  // PDF-Seite landet. Wir berechnen das jetzt einmal und reichen es durch.
  //
  // Layout-Sequenz:
  //   1 Cover
  //   2 Foreword (wenn showForeword)
  //   ... afterForewordPages
  //   ... IndexPage
  //   ... fuer jedes Recipe: erst beforeRecipePages[recipe.number], dann Recipe
  //   ... NutritionOverview
  //   ... beforeOutroPages
  //   ... OutroPage
  const recipePageNumbers: number[] = [];
  let cursor = 1; // Cover = Seite 1
  if (showForeword) cursor += 1; // Foreword
  cursor += storyBuckets.afterForeword.length;
  cursor += 1; // IndexPage selbst belegt eine Seite
  // cursor zeigt jetzt AUF die Index-Seite. Das erste Rezept kommt danach,
  // also vor dem Push erst auf die naechste Seite ruecken. (Bugfix: vorher
  // wurde die Index-Seitennummer als erste Rezept-Seite gepusht → ganzes
  // Inhaltsverzeichnis war um 1 zu niedrig vs. echte Fusszeilen-Seitenzahl.)
  for (const r of recipes) {
    const before = storyBuckets.beforeRecipe.get(r.number) ?? [];
    cursor += before.length;
    cursor += 1; // auf die Recipe-Seite ruecken
    recipePageNumbers.push(cursor);
  }

  return (
    <Document
      title={`${pack.title} · ${brand.name}`}
      author={brand.fullName}
      subject={pack.tagline}
      keywords={`${brand.handle},${brand.name},${pack.category},Rezepte`}
      creator="Recipe Card Builder"
      producer="Recipe Card Builder · Wolf Family Office Test Week"
    >
      {/* PAGE 1 — COVER */}
      <CoverPage
        brand={brand}
        pack={pack}
        coverDataUri={coverDataUri}
        recipes={recipes}
        titleFont={titleFont}
      />

      {/* PAGE 2 — FOREWORD (only when both text and still-life are
          available; otherwise this page is omitted and the index slides
          back into position 2 like in the original layout). */}
      {showForeword && forewordContent ? (
        <ForewordPage
          brand={brand}
          pack={pack}
          content={forewordContent}
          imageDataUri={forewordImageDataUri ?? null}
          avatarDataUri={avatarDataUri ?? null}
        />
      ) : null}

      {/* STORY PAGES — Slot "after-foreword" (Default). Sitzen zwischen
          Foreword und Index. */}
      {storyBuckets.afterForeword.map((story) => (
        <StoryPagePdf
          key={story.id}
          brand={brand}
          pack={pack}
          story={story}
          imageDataUri={getStoryImage(story)}
          positionIndex={storyPages.indexOf(story) + 1}
          totalStories={storyPages.length}
        />
      ))}

      {/* INDEX — Position abhaengig von Foreword + after-foreword Stories */}
      <IndexPage
        brand={brand}
        pack={pack}
        recipes={recipes}
        showForeword={showForeword}
        recipePageNumbers={recipePageNumbers}
      />

      {/* RECIPES — pro Recipe ggf. davor "before-recipe" Story-Seiten */}
      {recipes.map((recipe, idx) => {
        const before = storyBuckets.beforeRecipe.get(recipe.number) ?? [];
        return (
          <>
            {before.map((story) => (
              <StoryPagePdf
                key={story.id}
                brand={brand}
                pack={pack}
                story={story}
                imageDataUri={getStoryImage(story)}
                positionIndex={storyPages.indexOf(story) + 1}
                totalStories={storyPages.length}
              />
            ))}
            <RecipeCardPdfPage
              key={recipe.slug}
              brand={brand}
              pack={pack}
              recipe={recipe}
              totalRecipes={recipes.length}
              heroDataUri={heroDataUris[idx] ?? null}
              qrDataUri={qrDataUris[idx] ?? null}
              avatarDataUri={avatarDataUri ?? null}
            />
          </>
        );
      })}

      {/* NUTRITION OVERVIEW */}
      <NutritionOverviewPage brand={brand} pack={pack} recipes={recipes} />

      {/* STORY PAGES — Slot "before-outro". Sitzen zwischen
          Naehrwertuebersicht und Outro. */}
      {storyBuckets.beforeOutro.map((story) => (
        <StoryPagePdf
          key={story.id}
          brand={brand}
          pack={pack}
          story={story}
          imageDataUri={getStoryImage(story)}
          positionIndex={storyPages.indexOf(story) + 1}
          totalStories={storyPages.length}
        />
      ))}

      {/* OUTRO */}
      <OutroPage brand={brand} pack={pack} titleFont={titleFont} />
    </Document>
  );
}

// ─── COVER PAGE ──────────────────────────────────────────────────────────────
function CoverPage({
  brand,
  pack,
  coverDataUri,
  recipes,
  titleFont,
}: {
  brand: Brand;
  pack: Pack;
  coverDataUri: string | null;
  recipes: Recipe[];
  titleFont: "Fraunces" | "Inter";
}) {
  const t = packTheme(pack);
  return (
    <Page
      size="A4"
      style={{ backgroundColor: t.bg, fontFamily: "Inter", color: t.ink }}
    >
      <View style={{ flex: 1, padding: 40, justifyContent: "space-between" }}>
        {/* Top strip leer — Brand-Handle oben rechts entfernt
            (User-Feedback: kam auch auf jedem Recipe-Footer + im
            Bottom-Strip vor, war redundant). Lassen wir das Cover oben
            atmen. */}
        <View style={{ height: 0 }} />

        {/* Hero image — Container etwas hoeher als breit (320x420 = 4:5
            Portrait), damit hochformatige Selfie-Cover ohne Crop
            angezeigt werden. Vorher 380x380 quadratisch → Julias Kopf
            wurde oben weggeschnitten weil das Original-Foto 1122x1402
            ist. Mit 4:5 matched der Container die haeufigste Portrait-
            Ratio; landscape oder square Cover bleiben centered. */}
        {coverDataUri ? (
          <View
            style={{
              alignSelf: "center",
              width: 320,
              height: 420,
              borderRadius: 12,
              overflow: "hidden",
              marginVertical: 12,
            }}
          >
            <Image
              src={coverDataUri}
              style={{
                width: 320,
                height: 420,
                objectFit: "cover",
                objectPosition: "center 15%",
              }}
            />
          </View>
        ) : null}

        <View>
          <Text
            style={{
              fontFamily: titleFont,
              fontWeight: titleFont === "Inter" ? 700 : 400,
              fontSize: titleFont === "Inter" ? 56 : 64,
              lineHeight: 0.96,
              letterSpacing: titleFont === "Inter" ? -1.4 : -0.6,
              color: t.ink,
            }}
          >
            {pack.title}
          </Text>
          {pack.subtitle ? (
            <Text
              style={{
                fontFamily: "Fraunces",
                fontStyle: "italic",
                fontSize: 18,
                lineHeight: 1.3,
                color: t.inkSoft,
                marginTop: 10,
              }}
            >
              {pack.subtitle}
            </Text>
          ) : null}

          {/* Description — nur rendern wenn ein echter Pack-Text vorhanden,
              NICHT die generische Default-Phrase aus dem internen Editor
              ("Eigene Sammlung in ... Welt. Karten kannst du im Editor
              erstellen ..."). Die ist Tool-Onboarding-Text, nicht
              Druck-Material. */}
          {pack.description &&
          !/Karten kannst du im Editor/.test(pack.description) ? (
            <Text
              style={{
                fontSize: 11,
                lineHeight: 1.55,
                color: t.inkSoft,
                marginTop: 16,
                maxWidth: 460,
              }}
            >
              {pack.description}
            </Text>
          ) : null}

          {/* Recipe-Count alleine. brand.signature ("Deine Julia") und
              brand.handle (@juliabreitenfeld) entfernt — beide kamen auf
              jedem Recipe-Footer + auf der Outro-Page nochmal vor, das
              war "zu viel" (User-Feedback). Auf der Cover-Page steht
              jetzt nur noch der Recipe-Count als ruhige Schlusszeile. */}
          <View
            style={{
              flexDirection: "row",
              gap: 18,
              marginTop: 18,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 10, color: t.inkSoft }}>
              {recipes.length} Rezepte
            </Text>
          </View>
        </View>
      </View>
    </Page>
  );
}

// 5er-Gruppen-Separator: feine Linie links+rechts mit zentrierter Raute.
// Klassisch-edler Kochbuch-Trenner statt einer durchgehenden Strich-Linie
// (Leon-Feedback). Wird im Inhaltsverzeichnis + in der Pack-Uebersicht vor
// jeder neuen 5er-Gruppe eingesetzt.
function GroupSeparator({
  theme,
  marginV = 7,
}: {
  theme: ReturnType<typeof packTheme>;
  marginV?: number;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 9,
        marginVertical: marginV,
        paddingHorizontal: 4,
      }}
    >
      <View style={{ flex: 1, height: 0.8, backgroundColor: theme.divider }} />
      {/* Kleine Raute als gedrehtes Quadrat (View, nicht Schrift-Glyph —
          Fraunces hat kein ◆-Zeichen, das wuerde als Ersatzglyph "Æ"
          rendern). 4x4 pt um 45° gedreht = sauberer Diamant in Akzentfarbe. */}
      <View
        style={{
          width: 4,
          height: 4,
          backgroundColor: theme.accent,
          transform: "rotate(45deg)",
        }}
      />
      <View style={{ flex: 1, height: 0.8, backgroundColor: theme.divider }} />
    </View>
  );
}

// ─── INDEX / INHALTSVERZEICHNIS ──────────────────────────────────────────────
function IndexPage({
  brand,
  pack,
  recipes,
  showForeword: _showForeword,
  recipePageNumbers,
}: {
  brand: Brand;
  pack: Pack;
  recipes: Recipe[];
  showForeword: boolean;
  /** Pre-berechnete Page-Nummer pro Recipe (parallel-indiziert zu recipes).
   *  PackPdfDocument berechnet das mit Foreword + Story-Buckets-Offsets. */
  recipePageNumbers: number[];
}) {
  const t = packTheme(pack);
  return (
    <Page
      size="A4"
      style={{ backgroundColor: "#ffffff", fontFamily: "Inter", color: t.ink }}
    >
      {/* Header kompakter (vorher paddingTop 36 + Mega-"N Rezepte"-Headline,
          das hat bei 14+ Recipes das Inhaltsverzeichnis auf zwei Seiten
          gedrueckt). Jetzt nur Eyebrow + Pack-Title + Rezept-Anzahl in
          einer Zeile. */}
      <View
        style={{
          backgroundColor: t.paper,
          borderBottomWidth: 1,
          borderBottomColor: t.divider,
          paddingHorizontal: 40,
          paddingTop: 28,
          paddingBottom: 18,
        }}
      >
        <Text
          style={{
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: 1.6,
            color: t.inkSoft,
            textTransform: "uppercase",
          }}
        >
          Inhaltsverzeichnis · {recipes.length} Rezepte
        </Text>
        <Text
          style={{
            fontFamily: "Fraunces",
            fontSize: 28,
            color: t.ink,
            marginTop: 4,
            letterSpacing: -0.3,
          }}
        >
          {pack.title}
        </Text>
      </View>

      {/* Adaptive Inhaltsverzeichnis — Rows werden so dimensioniert, dass
          die ganze Seite gut gefuellt wird (nicht halb-leer wie vorher)
          und gleichzeitig alles auf eine Seite passt:
          - 1-6 Recipes:    sehr grosszuegig (paddingV 14, fontSize 14)
          - 7-10:           grosszuegig (paddingV 11, fontSize 13)
          - 11-14:          komfortabel (paddingV 9, fontSize 12)
          - 15-18:          balanced (paddingV 6, fontSize 11)
          - 19-22:          kompakt (paddingV 4, fontSize 10, Subtitle aus)
          - 23+:            maximal kompakt (paddingV 3, fontSize 9, Subtitle aus) */}
      {(() => {
        const count = recipes.length;
        let rowPadV: number;
        let numFont: number;
        let titleFont: number;
        let subFont: number;
        let sideFont: number;
        let kcalFont: number;
        let bodyPadTop: number;
        let bodyPadBottom: number;
        if (count <= 6) {
          rowPadV = 14; numFont = 16; titleFont = 14; subFont = 10;
          sideFont = 10; kcalFont = 13;
          bodyPadTop = 22; bodyPadBottom = 60;
        } else if (count <= 10) {
          rowPadV = 11; numFont = 15; titleFont = 13; subFont = 9.5;
          sideFont = 9.5; kcalFont = 12.5;
          bodyPadTop = 18; bodyPadBottom = 50;
        } else if (count <= 14) {
          rowPadV = 9; numFont = 14; titleFont = 12; subFont = 9;
          sideFont = 9; kcalFont = 12;
          bodyPadTop = 16; bodyPadBottom = 40;
        } else if (count <= 18) {
          rowPadV = 6; numFont = 13; titleFont = 11; subFont = 8.5;
          sideFont = 8.5; kcalFont = 11;
          bodyPadTop = 14; bodyPadBottom = 30;
        } else if (count <= 22) {
          rowPadV = 4; numFont = 12; titleFont = 10; subFont = 0;
          sideFont = 8; kcalFont = 10;
          bodyPadTop = 12; bodyPadBottom = 22;
        } else {
          rowPadV = 3; numFont = 11; titleFont = 9; subFont = 0;
          sideFont = 7.5; kcalFont = 9.5;
          bodyPadTop = 10; bodyPadBottom = 16;
        }
        return (
          <View
            style={{
              paddingHorizontal: 40,
              paddingTop: bodyPadTop,
              paddingBottom: bodyPadBottom,
            }}
          >
            {recipes.map((r, i) => {
              // Ornament-Separator vor jeder neuen 5er-Gruppe (Leon: alle 5
              // Rezepte). Feine Linie + Raute statt durchgehendem Strich.
              const showSep = i > 0 && i % 5 === 0;
              // Zeilen-Trennlinie nur INNERHALB der Gruppe (nicht direkt vor
              // einem Separator und nicht nach der letzten Zeile).
              const showRowLine = i < recipes.length - 1 && (i + 1) % 5 !== 0;
              return (
              <View key={r.slug}>
              {showSep ? <GroupSeparator theme={t} marginV={rowPadV - 1} /> : null}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  borderBottomWidth: showRowLine ? 0.5 : 0,
                  borderBottomColor: t.divider,
                  paddingVertical: rowPadV,
                  gap: 10,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Fraunces",
                    fontSize: numFont,
                    color: t.accent,
                    width: 24,
                  }}
                >
                  {pad2(r.number)}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: titleFont, fontWeight: 600, color: t.ink }}>
                    {r.title}
                  </Text>
                  {r.subtitle && subFont > 0 ? (
                    <Text style={{ fontSize: subFont, color: t.inkSoft, marginTop: 1 }}>
                      {r.subtitle}
                    </Text>
                  ) : null}
                </View>
                <Text
                  style={{
                    fontFamily: "Inter",
                    fontSize: sideFont,
                    color: t.inkSoft,
                    width: 56,
                    textAlign: "right",
                  }}
                >
                  {totalTime(r)} Min
                </Text>
                <Text
                  style={{
                    fontFamily: "Fraunces",
                    fontSize: kcalFont,
                    color: t.ink,
                    width: 56,
                    textAlign: "right",
                  }}
                >
                  {r.nutrition.kcal} kcal
                </Text>
                <Text
                  style={{
                    fontSize: sideFont,
                    color: t.inkSoft,
                    width: 28,
                    textAlign: "right",
                  }}
                >
                  {/* Page-Nummer kommt pre-berechnet aus PackPdfDocument,
                      damit verteilte Story-Pages (before-recipe) korrekt
                      eingerechnet werden. Fallback auf trivialen Offset
                      falls Array-Lookup leer. */}
                  S. {recipePageNumbers[i] ?? i + 4}
                </Text>
              </View>
              </View>
              );
            })}
          </View>
        );
      })()}

      <PageFooter brand={brand} pack={pack} pageLabel="Inhaltsverzeichnis" />
    </Page>
  );
}

// ─── NUTRITION OVERVIEW ──────────────────────────────────────────────────────
function NutritionOverviewPage({
  brand,
  pack,
  recipes,
}: {
  brand: Brand;
  pack: Pack;
  recipes: Recipe[];
}) {
  const t = packTheme(pack);
  const totals = recipes.reduce(
    (acc, r) => ({
      kcal: acc.kcal + r.nutrition.kcal,
      protein: acc.protein + r.nutrition.protein,
      carbs: acc.carbs + r.nutrition.carbs,
      fat: acc.fat + r.nutrition.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
  const avg = {
    kcal: Math.round(totals.kcal / recipes.length),
    protein: Math.round(totals.protein / recipes.length),
    carbs: Math.round(totals.carbs / recipes.length),
    fat: Math.round(totals.fat / recipes.length),
  };

  return (
    <Page
      size="A4"
      style={{ backgroundColor: "#ffffff", fontFamily: "Inter", color: t.ink }}
    >
      <View
        style={{
          backgroundColor: t.paper,
          borderBottomWidth: 1,
          borderBottomColor: t.divider,
          paddingHorizontal: 40,
          paddingTop: 36,
          paddingBottom: 24,
        }}
      >
        <Text
          style={{
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: 1.6,
            color: t.inkSoft,
            textTransform: "uppercase",
          }}
        >
          Nährwerte im Überblick
        </Text>
        <Text
          style={{
            fontFamily: "Fraunces",
            fontSize: 30,
            color: t.ink,
            marginTop: 8,
            letterSpacing: -0.3,
          }}
        >
          Pack-Übersicht · alle {recipes.length} Karten
        </Text>
        <Text
          style={{
            fontSize: 11,
            color: t.inkSoft,
            marginTop: 6,
          }}
        >
          Ø {avg.kcal} kcal · Ø {avg.protein} g Eiweiß je Rezept
        </Text>
      </View>

      <View style={{ paddingHorizontal: 40, paddingTop: 22 }}>
        {/* Header row */}
        <View
          style={{
            flexDirection: "row",
            backgroundColor: blendWithWhite(t.bg, 0.6),
            paddingVertical: 8,
            paddingHorizontal: 8,
            borderRadius: 6,
          }}
        >
          <Text style={{ flex: 1, fontSize: 8, fontWeight: 600, letterSpacing: 1.2, color: t.inkSoft, textTransform: "uppercase" }}>
            Rezept
          </Text>
          <Text style={{ width: 48, fontSize: 8, fontWeight: 600, letterSpacing: 1.2, color: t.inkSoft, textAlign: "right", textTransform: "uppercase" }}>
            kcal
          </Text>
          <Text style={{ width: 60, fontSize: 8, fontWeight: 600, letterSpacing: 1.2, color: t.inkSoft, textAlign: "right", textTransform: "uppercase" }}>
            Eiweiß
          </Text>
          <Text style={{ width: 60, fontSize: 8, fontWeight: 600, letterSpacing: 1.2, color: t.inkSoft, textAlign: "right", textTransform: "uppercase" }}>
            Kohlenh.
          </Text>
          <Text style={{ width: 48, fontSize: 8, fontWeight: 600, letterSpacing: 1.2, color: t.inkSoft, textAlign: "right", textTransform: "uppercase" }}>
            Fett
          </Text>
        </View>

        {/* Body rows — Ornament-Separator (Linie + Raute) vor jeder neuen
            5er-Gruppe (Leon: alle 5 Rezepte). Feine Zeilen-Trennlinie nur
            INNERHALB der Gruppe. */}
        {recipes.map((r, i) => {
          const showSep = i > 0 && i % 5 === 0;
          const showRowLine = i < recipes.length - 1 && (i + 1) % 5 !== 0;
          return (
          <View key={r.slug}>
          {showSep ? <GroupSeparator theme={t} marginV={5} /> : null}
          <View
            style={{
              flexDirection: "row",
              borderBottomWidth: showRowLine ? 0.5 : 0,
              borderBottomColor: t.divider,
              paddingVertical: 8,
              paddingHorizontal: 8,
              alignItems: "center",
            }}
          >
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 8, color: t.inkSoft, width: 18, fontWeight: 600 }}>
                {pad2(r.number)}
              </Text>
              <Text style={{ fontSize: 10, color: t.ink, fontWeight: 500 }}>
                {r.title}
              </Text>
            </View>
            <Text style={{ width: 48, fontSize: 10, color: t.ink, fontWeight: 500, textAlign: "right" }}>
              {r.nutrition.kcal}
            </Text>
            <Text style={{ width: 60, fontSize: 10, color: t.ink, textAlign: "right" }}>
              {r.nutrition.protein} g
            </Text>
            <Text style={{ width: 60, fontSize: 10, color: t.ink, textAlign: "right" }}>
              {r.nutrition.carbs} g
            </Text>
            <Text style={{ width: 48, fontSize: 10, color: t.ink, textAlign: "right" }}>
              {r.nutrition.fat} g
            </Text>
          </View>
          </View>
          );
        })}

        {/* Totals row */}
        <View
          style={{
            flexDirection: "row",
            backgroundColor: blendWithWhite(t.bg, 0.45),
            paddingVertical: 10,
            paddingHorizontal: 8,
            marginTop: 4,
            borderRadius: 6,
          }}
        >
          <Text
            style={{
              flex: 1,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 1.2,
              color: t.ink,
              textTransform: "uppercase",
            }}
          >
            Pack-Total
          </Text>
          <Text style={{ width: 48, fontSize: 10, fontWeight: 700, color: t.ink, textAlign: "right" }}>
            {totals.kcal}
          </Text>
          <Text style={{ width: 60, fontSize: 10, fontWeight: 700, color: t.ink, textAlign: "right" }}>
            {totals.protein} g
          </Text>
          <Text style={{ width: 60, fontSize: 10, fontWeight: 700, color: t.ink, textAlign: "right" }}>
            {totals.carbs} g
          </Text>
          <Text style={{ width: 48, fontSize: 10, fontWeight: 700, color: t.ink, textAlign: "right" }}>
            {totals.fat} g
          </Text>
        </View>

        <Text
          style={{
            fontSize: 8.5,
            color: t.inkSoft,
            marginTop: 18,
            lineHeight: 1.5,
            fontStyle: "italic",
          }}
        >
          Die kcal-Spalte zeigt den Wert pro Portion bzw. pro Stück, die letzte
          Zeile die Pack-Summe. Werte basieren auf {brand.name}s
          Original-Rezepten und können je nach verwendeter Marke leicht
          abweichen.
        </Text>
      </View>

      <PageFooter brand={brand} pack={pack} pageLabel="Nährwerte" />
    </Page>
  );
}

// ─── OUTRO ───────────────────────────────────────────────────────────────────
// Default-Abschiedstext fuer den Fall, dass das Pack keinen persoenlichen
// outro-Text mitbringt (z.B. Bienen Code-Brand-Packs in pack-forewords.ts,
// die das Feld nie kannten). Fuer Custom-Packs schreibt Gemini den Outro
// Pack- und Saison-spezifisch — siehe lib/ai/generate-foreword.ts.
const DEFAULT_OUTRO =
  "Danke, dass du mit mir kochst. Wenn dir die Karten gefallen, schick sie gerne weiter und teil dein Ergebnis auf Instagram. Ich liebe es, eure Versionen zu sehen.";

function OutroPage({
  brand,
  pack,
  titleFont,
}: {
  brand: Brand;
  pack: Pack;
  titleFont: "Fraunces" | "Inter";
}) {
  const t = packTheme(pack);
  const outroText = pack.foreword?.outro?.trim() || DEFAULT_OUTRO;
  return (
    <Page
      size="A4"
      style={{ backgroundColor: t.bg, fontFamily: "Inter", color: t.ink }}
    >
      <View style={{ flex: 1, padding: 60, justifyContent: "center", alignItems: "center" }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
          }}
        >
          <Text
            style={{
              fontFamily: "Fraunces",
              fontStyle: "italic",
              fontSize: 36,
              color: t.ink,
              textAlign: "center",
              lineHeight: 1.15,
            }}
          >
            {brand.signature}
          </Text>
          <BeeIcon brandSlug={brand.slug} size={38} />
        </View>
        {/* Outro-Text in fester View-Width statt maxWidth direkt am Text.
            react-pdf wrappt sonst CHARACTER-level statt word-level (User-
            Report: "SPAGHETTI PROTEIN E\nIS", "fü\nr", "pa\nckt" mitten
            im Wort gebrochen). View-Container loest das, Text rendert
            mit normalem word-wrap. */}
        <View style={{ width: 420, marginTop: 16 }}>
          <Text
            style={{
              fontSize: 11,
              color: t.inkSoft,
              textAlign: "center",
              lineHeight: 1.55,
            }}
          >
            {outroText}
          </Text>
        </View>
        <Text
          style={{
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: 1.6,
            color: t.inkSoft,
            marginTop: 28,
            textTransform: "uppercase",
          }}
        >
          {brand.handle} · {pack.title}
        </Text>
      </View>
    </Page>
  );
}

// ─── REUSABLE PAGE FOOTER ────────────────────────────────────────────────────
// Genutzt von IndexPage (Inhaltsverzeichnis) + NutritionOverviewPage. Zeigt
// nur "{pageLabel} · {pack.title}" — brand.signature ("Deine Julia") + BeeIcon
// entfernt, das stand sonst auf mehreren Seiten redundant.
function PageFooter({
  brand: _brand,
  pack,
  pageLabel,
}: {
  brand: Brand;
  pack: Pack;
  pageLabel: string;
}) {
  const t = packTheme(pack);
  return (
    <View
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: "row",
        justifyContent: "flex-end",
        alignItems: "center",
        borderTopWidth: 1,
        borderTopColor: t.divider,
        backgroundColor: "#ffffff",
        paddingHorizontal: 40,
        paddingVertical: 12,
      }}
      fixed
    >
      <Text
        style={{
          fontSize: 7.5,
          fontWeight: 500,
          letterSpacing: 1.4,
          color: t.inkSoft,
          textTransform: "uppercase",
        }}
      >
        {pageLabel} · {pack.title}
      </Text>
    </View>
  );
}
