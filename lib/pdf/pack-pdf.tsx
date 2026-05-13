import { Document, Page, View, Text, Image } from "@react-pdf/renderer";
import type { Brand } from "@/lib/brands";
import type { Pack } from "@/lib/packs";
import type { Recipe } from "@/lib/recipes";
import type { PackForewordContent } from "@/lib/ai/generate-foreword";
import { packTheme, withAlpha, blendWithWhite, fontFamilyForPack } from "./theme";
import { pad2, totalTime } from "./helpers";
import { RecipeCardPdfPage } from "./recipe-card-pdf";
import { ForewordPage } from "./foreword-page";
import { BeeIcon } from "./bee-icon";

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
}: PackPdfProps) {
  // Show foreword whenever cached text is available. The still-life image
  // is optional — Variants render a graceful Text-Only-Layout wenn
  // forewordImageDataUri null ist. So bleibt das Vorwort fuer Custom-Packs
  // verfuegbar, auch wenn die Flux-Bild-Generierung gefailt ist oder der
  // User das Bild bewusst weglassen will.
  const showForeword = Boolean(forewordContent);
  const t = packTheme(pack);
  const titleFont = fontFamilyForPack(pack);

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

      {/* INDEX (page 2 without foreword, page 3 with foreword) */}
      <IndexPage brand={brand} pack={pack} recipes={recipes} />

      {/* PAGES 3..N+2 — RECIPES */}
      {recipes.map((recipe, idx) => (
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
      ))}

      {/* PAGE N+3 — NUTRITION OVERVIEW */}
      <NutritionOverviewPage brand={brand} pack={pack} recipes={recipes} />

      {/* PAGE N+4 — OUTRO */}
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

// ─── INDEX / INHALTSVERZEICHNIS ──────────────────────────────────────────────
function IndexPage({
  brand,
  pack,
  recipes,
}: {
  brand: Brand;
  pack: Pack;
  recipes: Recipe[];
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
            {recipes.map((r, i) => (
              <View
                key={r.slug}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  borderBottomWidth: 0.5,
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
                  S. {i + 3}
                </Text>
              </View>
            ))}
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
          Ø {avg.kcal} kcal · Ø {avg.protein}g Eiweiß pro Portion
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

        {/* Body rows */}
        {recipes.map((r) => (
          <View
            key={r.slug}
            style={{
              flexDirection: "row",
              borderBottomWidth: 0.5,
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
        ))}

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
          Alle Werte gelten pro Portion (kcal-Spalte) bzw. als Pack-Summe in der
          letzten Zeile. Werte basieren auf {brand.name}s Original-Rezepten und
          können je nach verwendeten Marken leicht abweichen.
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
  "Danke, dass du mit mir kochst. Wenn dir die Karten gefallen, schick sie gerne weiter — und teil dein Ergebnis auf Instagram. Ich liebe es, eure Versionen zu sehen.";

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
        <Text
          style={{
            fontSize: 11,
            color: t.inkSoft,
            marginTop: 16,
            textAlign: "center",
            lineHeight: 1.55,
            maxWidth: 380,
          }}
        >
          {outroText}
        </Text>
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
