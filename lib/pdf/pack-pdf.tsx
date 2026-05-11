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
  // Show foreword only when text is cached AND the still-life image
  // loaded successfully. Anything less and we fall through to the legacy
  // cover→index sequence.
  const showForeword = Boolean(
    forewordContent && forewordImageDataUri
  );
  const t = packTheme(pack);
  const titleFont = fontFamilyForPack(pack);

  return (
    <Document
      title={`${pack.title} · ${brand.name}`}
      author={brand.fullName}
      subject={pack.tagline}
      keywords={`${brand.handle},${pack.category},Bienesfitlife,Rezepte,High-Protein`}
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
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: 1.8,
              color: t.inkSoft,
              textTransform: "uppercase",
            }}
          >
            Pack {pad2(pack.number)} · {pack.category}
          </Text>
          <Text
            style={{
              fontSize: 9,
              fontWeight: 500,
              letterSpacing: 1.4,
              color: t.inkSoft,
              textTransform: "uppercase",
            }}
          >
            {brand.handle}
          </Text>
        </View>

        {/* Hero image */}
        {coverDataUri ? (
          <View
            style={{
              alignSelf: "center",
              width: 380,
              height: 380,
              borderRadius: 12,
              overflow: "hidden",
              marginVertical: 12,
            }}
          >
            <Image
              src={coverDataUri}
              style={{ width: 380, height: 380, objectFit: "cover" }}
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
            <Text style={{ fontSize: 10, color: t.inkSoft, opacity: 0.4 }}>·</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Text
                style={{
                  fontFamily: "Fraunces",
                  fontSize: 12,
                  color: t.ink,
                }}
              >
                {brand.signature}
              </Text>
              <BeeIcon size={13} />
            </View>
            <Text style={{ fontSize: 10, color: t.inkSoft, opacity: 0.4 }}>·</Text>
            <Text style={{ fontSize: 10, color: t.inkSoft }}>{brand.handle}</Text>
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
          Inhaltsverzeichnis
        </Text>
        <Text
          style={{
            fontFamily: "Fraunces",
            fontSize: 36,
            color: t.ink,
            marginTop: 8,
            letterSpacing: -0.4,
          }}
        >
          {recipes.length} Rezepte
        </Text>
        <Text
          style={{
            fontFamily: "Fraunces",
            fontStyle: "italic",
            fontSize: 13,
            color: t.inkSoft,
            marginTop: 4,
          }}
        >
          {pack.tagline}
        </Text>
      </View>

      <View style={{ paddingHorizontal: 40, paddingTop: 24, paddingBottom: 40 }}>
        {recipes.map((r, i) => (
          <View
            key={r.slug}
            style={{
              flexDirection: "row",
              alignItems: "baseline",
              borderBottomWidth: 0.5,
              borderBottomColor: t.divider,
              paddingVertical: 8,
              gap: 10,
            }}
          >
            <Text
              style={{
                fontFamily: "Fraunces",
                fontSize: 14,
                color: t.accent,
                width: 28,
              }}
            >
              {pad2(r.number)}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11.5, fontWeight: 600, color: t.ink }}>
                {r.title}
              </Text>
              <Text style={{ fontSize: 8.5, color: t.inkSoft, marginTop: 1 }}>
                {r.subtitle}
              </Text>
            </View>
            <Text
              style={{
                fontFamily: "Inter",
                fontSize: 9,
                color: t.inkSoft,
                width: 60,
                textAlign: "right",
              }}
            >
              {totalTime(r)} Min
            </Text>
            <Text
              style={{
                fontFamily: "Fraunces",
                fontSize: 12,
                color: t.ink,
                width: 60,
                textAlign: "right",
              }}
            >
              {r.nutrition.kcal} kcal
            </Text>
            <Text
              style={{
                fontSize: 9,
                color: t.inkSoft,
                width: 30,
                textAlign: "right",
              }}
            >
              S. {i + 3}
            </Text>
          </View>
        ))}
      </View>

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
          letzten Zeile. Werte basieren auf Bienes Original-Rezepten und können je
          nach verwendeten Marken (z. B. MORE Sahne Protein) leicht abweichen.
        </Text>
      </View>

      <PageFooter brand={brand} pack={pack} pageLabel="Nährwerte" />
    </Page>
  );
}

// ─── OUTRO ───────────────────────────────────────────────────────────────────
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
          <BeeIcon size={38} />
        </View>
        <Text
          style={{
            fontSize: 11,
            color: t.inkSoft,
            marginTop: 16,
            textAlign: "center",
            lineHeight: 1.55,
            maxWidth: 360,
          }}
        >
          Danke, dass du mit mir kochst. Wenn dir die Karten gefallen, schick sie
          gerne weiter — und teil dein Ergebnis auf Instagram. Ich liebe es, eure
          Versionen zu sehen.
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
function PageFooter({
  brand,
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
        justifyContent: "space-between",
        alignItems: "center",
        borderTopWidth: 1,
        borderTopColor: t.divider,
        backgroundColor: "#ffffff",
        paddingHorizontal: 40,
        paddingVertical: 12,
      }}
      fixed
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        <Text
          style={{
            fontFamily: "Fraunces",
            fontSize: 12,
            color: brand.tokens.ink,
          }}
        >
          {brand.signature}
        </Text>
        <BeeIcon size={13} />
      </View>
      <Text
        style={{
          fontSize: 7.5,
          fontWeight: 500,
          letterSpacing: 1.4,
          color: brand.tokens.inkMuted,
          textTransform: "uppercase",
        }}
      >
        {pageLabel} · {pack.title}
      </Text>
    </View>
  );
}
