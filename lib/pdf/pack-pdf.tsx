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
  // Outro-Bild (Pack-Schlussseite). Optional — wenn null/undefined rendert
  // OutroPage im alten Look (Solid-Backdrop + zentrierter Text statt
  // Full-bleed + Quote-Card-Overlay). Backward-Compat für Bestands-Packs
  // ohne generiertes Outro-Bild.
  outroImageDataUri?: string | null;
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
  outroImageDataUri,
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

      {/* PAGE 2 — FOREWORD (User-Korrektur 2026-05-24: Vorwort gehoert
          REIN, nicht das was der User vorher als 'Vorwort' kritisiert
          hatte. Das war die alte CoverPage mit Text-Overlay. ForewordPage
          ist das richtige Vorwort mit greeting/story/signoff und sollte
          wieder gerendert werden wenn pack.foreword vorhanden ist). */}
      {showForeword && forewordContent ? (
        <ForewordPage
          brand={brand}
          pack={pack}
          content={forewordContent}
          imageDataUri={forewordImageDataUri ?? null}
          avatarDataUri={avatarDataUri ?? null}
        />
      ) : null}

      {/* INDEX (page 2 ohne Foreword, page 3 mit Foreword) */}
      <IndexPage
        brand={brand}
        pack={pack}
        recipes={recipes}
        showForeword={showForeword}
      />

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
      <OutroPage
        brand={brand}
        pack={pack}
        titleFont={titleFont}
        outroImageDataUri={outroImageDataUri ?? null}
      />
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
  // Light text-color für Overlay über dem dunklen Image-Gradient.
  // Cream-white statt pure-white damit's nicht zu klinisch wirkt.
  const TEXT_LIGHT = "#fdfaf2";
  const hasCover = !!coverDataUri;

  // ─── Creator-Cover (v8, Mai 2026): Image + react-pdf Text-Overlay ──────
  // v3-v7: Gemini sollte Text direkt ins Bild rendern. Funktioniert für
  // englischen Text okay, aber bei deutschem Text mit Umlauten unreliable
  // (User-Befund: "Eiwes reiche Rezepte" statt "Eiweißreiche Rezepte",
  // "öh" statt "öl"). Gemini-2.5-Flash-Image-Doku warnt explizit:
  // "struggles with precise typography compared to Gemini 3 variants".
  //
  // v8 Lösung: Bild ist text-frei (Prompt hat "ABSOLUTELY NO TEXT") und
  // wir legen Title + Subtitle + Handle in Brand-Fonts via react-pdf
  // drüber — 100% korrekte Rechtschreibung, perfekte Umlaute. Bild bleibt
  // weiterhin Creator-Cover (Lifestyle + Person), nur Text wird unten in
  // einem dezenten Band gerendert.
  if (hasCover && pack.coverStyle === "creator") {
    return (
      <Page
        size="A4"
        style={{ backgroundColor: t.ink, fontFamily: "Inter" }}
      >
        {/* Full-bleed Image (Gemini-generated, text-free) */}
        <Image
          src={coverDataUri!}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
          }}
        />

        {/* Bottom shadow band für Text-Lesbarkeit. 3 gestapelte halb-
            transparente Layers approximieren einen smoothen Gradient
            (react-pdf hat keine native linear-gradient). */}
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 260,
            height: 120,
            backgroundColor: "rgba(0,0,0,0.15)",
          }}
        />
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 130,
            height: 130,
            backgroundColor: "rgba(0,0,0,0.40)",
          }}
        />
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 130,
            backgroundColor: "rgba(0,0,0,0.62)",
          }}
        />

        {/* Text-Overlay bottom-left, Brand-Fonts */}
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            padding: 44,
            paddingBottom: 50,
          }}
        >
          <Text
            style={{
              fontSize: 9,
              letterSpacing: 2.4,
              textTransform: "uppercase",
              color: TEXT_LIGHT,
              opacity: 0.88,
              marginBottom: 14,
            }}
          >
            {recipes.length} Rezepte · {brand.handle}
          </Text>

          <Text
            style={{
              fontFamily: titleFont,
              fontWeight: titleFont === "Inter" ? 700 : 400,
              fontSize: titleFont === "Inter" ? 56 : 64,
              lineHeight: 0.96,
              letterSpacing: titleFont === "Inter" ? -1.5 : -0.7,
              color: TEXT_LIGHT,
              maxWidth: 480,
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
                color: TEXT_LIGHT,
                opacity: 0.94,
                marginTop: 12,
                maxWidth: 460,
              }}
            >
              {pack.subtitle}
            </Text>
          ) : null}
        </View>
      </Page>
    );
  }

  // ─── Hybrid-Variante (Lifestyle-Image + react-pdf Text-Overlay) ──────────
  // Fallback fuer Bestands-Packs (coverStyle undefined oder "lifestyle"/
  // "legacy"). Bild wird leicht abgedunkelt, Text als react-pdf View dr-
  // ueber gerendert. So bleibt der Print-Output lesbar wenn das alte
  // 1:1 Bild oder das v2-Lifestyle-Bild im DB liegt.
  return (
    <Page
      size="A4"
      // Wenn kein Cover-Image da ist, Page-Background bleibt der Pack-Mood;
      // dann rendert der Text-Overlay in t.ink (dunkel) — klassisches
      // Editorial-Cover ohne Bild. Sobald ein Cover-Image da ist, ziehen
      // wir t.ink als Backdrop hinter das Bild (sichtbar nur falls
      // Image-Load fehlschlägt) und switchen Text auf cream-white.
      style={{
        backgroundColor: hasCover ? t.ink : t.bg,
        fontFamily: "Inter",
      }}
    >
      {/* ─── Layer 1: Full-bleed Image ──────────────────────────────────
          Image ist 3:4 (1:1.333), A4 ist 1:1.414. Mit objectFit cover
          zieht react-pdf das Bild über die ganze Seite und beschneidet
          ~6% oben+unten gleichmässig. objectPosition "center 35%" bias-t
          den Crop leicht nach oben, damit das Haupt-Subject (typisch
          mid-frame) nicht unter den Title-Overlay fällt. */}
      {hasCover ? (
        <Image
          src={coverDataUri!}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center 35%",
          }}
        />
      ) : null}

      {/* ─── Layer 2: globaler subtiler Tint ──────────────────────────────
          Das Bild ist leicht insgesamt abgedunkelt (12%), damit die
          Aufmerksamkeit zur Text-Zone unten wandert und nicht im hellen
          Bild verloren geht. */}
      {hasCover ? (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0,0,0,0.12)",
          }}
        />
      ) : null}

      {/* ─── Layer 3: Bottom-Gradient für Text-Lesbarkeit ────────────────
          react-pdf hat keine native linear-gradient — wir stacken drei
          semi-transparente schwarze Rechtecke (140pt hoch je, Opacity
          0.18 → 0.42 → 0.62 von oben nach unten). Total ~420pt =
          untere Hälfte der Seite. Pseudo-Gradient, visuell stabil. */}
      {hasCover ? (
        <>
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 280,
              height: 140,
              backgroundColor: "rgba(0,0,0,0.18)",
            }}
          />
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 140,
              height: 140,
              backgroundColor: "rgba(0,0,0,0.42)",
            }}
          />
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: 140,
              backgroundColor: "rgba(0,0,0,0.62)",
            }}
          />
        </>
      ) : null}

      {/* ─── Layer 4: Text-Overlay (bottom-left) ─────────────────────────
          Sitzt direkt auf der untersten Gradient-Stufe. Eyebrow oben,
          dann Title, optional Subtitle, optional Description. Author-
          Signatur bleibt der OutroPage vorbehalten (siehe Memory-Regel:
          brand.signature nur an EINER Stelle pro Pack). */}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: 48,
          paddingBottom: 54,
        }}
      >
        <Text
          style={{
            fontSize: 9,
            letterSpacing: 2.4,
            textTransform: "uppercase",
            color: hasCover ? TEXT_LIGHT : t.inkSoft,
            opacity: 0.88,
            marginBottom: 14,
          }}
        >
          {recipes.length} Rezepte · {brand.handle}
        </Text>

        <Text
          style={{
            fontFamily: titleFont,
            fontWeight: titleFont === "Inter" ? 700 : 400,
            fontSize: titleFont === "Inter" ? 60 : 68,
            lineHeight: 0.96,
            letterSpacing: titleFont === "Inter" ? -1.6 : -0.8,
            color: hasCover ? TEXT_LIGHT : t.ink,
            maxWidth: 480,
          }}
        >
          {pack.title}
        </Text>

        {pack.subtitle ? (
          <Text
            style={{
              fontFamily: "Fraunces",
              fontStyle: "italic",
              fontSize: 19,
              lineHeight: 1.3,
              color: hasCover ? TEXT_LIGHT : t.inkSoft,
              opacity: 0.94,
              marginTop: 12,
              maxWidth: 460,
            }}
          >
            {pack.subtitle}
          </Text>
        ) : null}

        {/* Description — Default-Editor-Phrase ("Karten kannst du im
            Editor erstellen …") aktiv ausfiltern, ist Tool-Onboarding-
            Text, kein Druck-Material. */}
        {pack.description &&
        !/Karten kannst du im Editor/.test(pack.description) ? (
          <Text
            style={{
              fontSize: 11,
              lineHeight: 1.55,
              color: hasCover ? TEXT_LIGHT : t.inkSoft,
              opacity: 0.86,
              marginTop: 14,
              maxWidth: 440,
            }}
          >
            {pack.description}
          </Text>
        ) : null}
      </View>
    </Page>
  );
}

// ─── INDEX / INHALTSVERZEICHNIS ──────────────────────────────────────────────
function IndexPage({
  brand,
  pack,
  recipes,
  showForeword,
}: {
  brand: Brand;
  pack: Pack;
  recipes: Recipe[];
  showForeword: boolean;
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
                  S. {i + (showForeword ? 4 : 3)}
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
  titleFont: _titleFont,
  outroImageDataUri,
}: {
  brand: Brand;
  pack: Pack;
  titleFont: "Fraunces" | "Inter";
  outroImageDataUri: string | null;
}) {
  const t = packTheme(pack);
  const outroText = pack.foreword?.outro?.trim() || DEFAULT_OUTRO;
  const hasImage = !!outroImageDataUri;

  // ─── Image-loser Fallback ──────────────────────────────────────────────
  // Wenn keine outroImage da ist (Bestands-Packs, Image-Gen failed) rendern
  // wir den alten Solid-Backdrop-Look. Keine harten Crashes.
  if (!hasImage) {
    return (
      <Page
        size="A4"
        style={{ backgroundColor: t.bg, fontFamily: "Inter", color: t.ink }}
      >
        <View
          style={{
            flex: 1,
            padding: 60,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
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

  // ─── Full-bleed-Variante mit Floating Quote-Card ──────────────────────
  // Image full-bleed (Aspect 3:4 in A4 1:1.414 via objectFit cover, minimaler
  // Top/Bottom-Crop). Subtiler globaler Tint damit das Auge in die Mitte
  // gezogen wird, wo eine semi-transparente Quote-Card mit Signatur,
  // Outro-Text und Handle-Strip schwebt.
  //
  // Card-Position: vertikal zentriert (top: ~38%, height: auto via padding).
  // Width: 360pt (60% von A4-Width 595pt) — schmal genug damit das Bild
  // links/rechts ungestört wirkt, breit genug für 3-4 Zeilen lesbaren Text.
  return (
    <Page
      size="A4"
      style={{ backgroundColor: t.ink, fontFamily: "Inter" }}
    >
      {/* Full-bleed Image */}
      <Image
        src={outroImageDataUri!}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center 30%",
        }}
      />

      {/* Globaler subtiler Tint (10%) — wenig genug damit das Bild atmet,
          genug damit die Card visuell trennt. */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          backgroundColor: "rgba(0,0,0,0.10)",
        }}
      />

      {/* Floating Quote-Card — vertikal zentriert. Semi-transparenter Cream-
          Backdrop mit dezenter Border, sanfter Schatten via doppelte View
          (react-pdf hat keine box-shadow — eine größere View leicht
          versetzt darunter simuliert subtle elevation). */}
      <View
        style={{
          position: "absolute",
          top: 290,
          left: 75,
          right: 75,
          // Schatten-Layer (etwas tiefer, ganz leicht versetzt nach unten)
          height: 280,
        }}
      >
        {/* Shadow-Layer */}
        <View
          style={{
            position: "absolute",
            top: 8,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.18)",
          }}
        />
        {/* Card-Layer */}
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(253, 250, 242, 0.94)",
            padding: 36,
            paddingHorizontal: 38,
            justifyContent: "center",
            alignItems: "center",
            borderWidth: 0.5,
            borderColor: "rgba(26, 18, 11, 0.10)",
          }}
        >
            {/* Signatur + Bee */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
              }}
            >
              <Text
                style={{
                  fontFamily: "Fraunces",
                  fontStyle: "italic",
                  fontSize: 30,
                  color: t.ink,
                  textAlign: "center",
                  lineHeight: 1.15,
                }}
              >
                {brand.signature}
              </Text>
              <BeeIcon brandSlug={brand.slug} size={32} />
            </View>

            {/* Outro-Text — 3-5 Sätze, persönlich, KI-generiert über
                generatePackForeword.outro. Container-Width sichert
                word-level wrap (siehe Memory-Regel). */}
            <View style={{ width: 320, marginTop: 14 }}>
              <Text
                style={{
                  fontSize: 11,
                  color: t.inkSoft,
                  textAlign: "center",
                  lineHeight: 1.6,
                }}
              >
                {outroText}
              </Text>
            </View>

            {/* Handle-Strip — dezent, Uppercase, kleiner. */}
            <Text
              style={{
                fontSize: 8.5,
                fontWeight: 600,
                letterSpacing: 1.8,
                color: t.inkSoft,
                marginTop: 20,
                textTransform: "uppercase",
              }}
            >
              {brand.handle} · {pack.title}
            </Text>
          </View>
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
