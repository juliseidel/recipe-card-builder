import { Page, View, Text, Image, Svg, Circle, Path } from "@react-pdf/renderer";
import type { Brand } from "@/lib/brands";
import type { Pack, CardLayout } from "@/lib/packs";
import type { PackForewordContent } from "@/lib/ai/generate-foreword";
import { packTheme, fontFamilyForPack, blendWithWhite } from "./theme";
import { BeeIcon } from "./bee-icon";

// Foreword page sits between cover and index. The booklet moment — what
// turns a recipe collection into a published-feeling mini-cookbook.
//
// One variant per pack-cardLayout so the foreword spread feels of-a-piece
// with the recipe pages that follow it. All five share the same
// vocabulary (still-life image, avatar anchor, greeting/story/signoff
// fields) but the composition is layout-DNA-specific.

export type ForewordPageProps = {
  brand: Brand;
  pack: Pack;
  content: PackForewordContent;
  // Pre-loaded data URIs — same convention as RecipeCardPdfPage.
  imageDataUri: string | null;
  avatarDataUri: string | null;
};

const VARIANTS: Record<
  CardLayout,
  (p: ForewordPageProps) => React.JSX.Element
> = {
  patisserie: PatisserieForewordPage,
  sport: SportForewordPage,
  // Vital ist das neue Pack-2-Layout (Card-Stack mit Donut-Ringen). Foreword
  // teilt den Sport-Style — Sage-Green-Accent + Bold-Sans-Greeting + Stillleben
  // mit Akzent-Border passt visuell zur Vital-Recipe-Card.
  vital: SportForewordPage,
  minimal: MinimalForewordPage,
  dashboard: DashboardForewordPage,
  editorial: EditorialForewordPage,
  // Amber ist das neue Pack-5-Layout (Sunset-Editorial mit Honey-Halo).
  // Editorial-Foreword passt visuell — Honey-Mood, Stillleben in Frame,
  // Editorial-Magazine-Tonalitaet.
  amber: EditorialForewordPage,
  // Vinyl-Foreword: dediziert. Album-Sleeve-Look mit Hero als grossem
  // Cover + LP halb rausgezogen, Liner-Notes-Drop-Cap, "Pressed by"-
  // Footer mit "Side B Coming Up"-Hinweis.
  vinyl: VinylForewordPage,
  // Newspaper-Foreword: dediziert. Broadsheet-Editorial mit Masthead,
  // Doppellinien, italic Drop-Cap, Author-Box-Footer mit Avatar.
  newspaper: NewspaperForewordPage,
  // Constellation-Foreword: dediziert. Dark-Sky mit Background-Sternen,
  // Hero rund mit Glow-Halo, italic Drop-Cap-Story in cream-Text, Planet-
  // Akzent als kleiner Anker. Kein brand.signature (wie Vinyl/Newspaper).
  constellation: ConstellationForewordPage,
  // Restaurant-Foreword: dediziert. Fine-Dining-Speisekarte mit Cream-BG,
  // Gold-Ornamenten, quadr. Hero mit Gold-Border, italic Drop-Cap-Story.
  // Author-Box im Footer mit Avatar (KEIN brand.signature).
  restaurant: RestaurantForewordPage,
};

export function ForewordPage(props: ForewordPageProps) {
  const layout = props.pack.cardLayout;
  const Variant = VARIANTS[layout] ?? PatisserieForewordPage;
  return <Variant {...props} />;
}

// Shared bottom strip — small avatar + signature. Each variant lays the
// rest of the page differently, but the closing handshake stays
// consistent so a reader who flips through all 5 packs back-to-back
// recognises Biene immediately on every foreword page.
function AuthorStrip({
  brand,
  pack,
  avatarDataUri,
  align = "between",
}: {
  brand: Brand;
  pack: Pack;
  avatarDataUri: string | null;
  align?: "between" | "center";
}) {
  const t = packTheme(pack);
  const justifyContent: "space-between" | "center" =
    align === "center" ? "center" : "space-between";
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent,
        gap: 18,
        paddingTop: 22,
        borderTopWidth: 0.5,
        borderTopColor: t.divider,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
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
            <Image
              src={avatarDataUri}
              style={{ width: 43, height: 43, objectFit: "cover", objectPosition: "center 25%" }}
            />
          </View>
        ) : null}
        <View>
          <Text
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 1.6,
              color: t.ink,
              textTransform: "uppercase",
            }}
          >
            {brand.name}
          </Text>
          <Text
            style={{ fontSize: 9.5, color: t.inkSoft, marginTop: 3 }}
          >
            {brand.handle}
          </Text>
        </View>
      </View>
      {align === "between" ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 7,
          }}
        >
          <Text
            style={{
              fontFamily: "Fraunces",
              fontStyle: "italic",
              fontSize: 16,
              color: t.ink,
            }}
          >
            {brand.signature}
          </Text>
          <BeeIcon brandSlug={brand.slug} size={18} />
        </View>
      ) : null}
    </View>
  );
}

function TopStrip({
  pack,
  rightLabel,
}: {
  pack: Pack;
  rightLabel?: string;
}) {
  const t = packTheme(pack);
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <Text
        style={{
          fontSize: 8.5,
          fontWeight: 600,
          letterSpacing: 1.8,
          color: t.inkSoft,
          textTransform: "uppercase",
        }}
      >
        Vorwort
      </Text>
      <Text
        style={{
          fontSize: 8.5,
          fontWeight: 500,
          letterSpacing: 1.4,
          color: t.inkSoft,
          textTransform: "uppercase",
        }}
      >
        {/* Vorher: "Pack 03 · Airfryer Lieblinge". Die "Pack XX" Nummerierung
            ist tool-intern, gehoert nicht aufs Druck-PDF. Jetzt nur der
            Pack-Titel. */}
        {rightLabel ?? pack.title}
      </Text>
    </View>
  );
}

// ─── PATISSERIE — Pack 1 (Bienes Backwelt) ──────────────────────────────────
// Polaroid frame for the still-life, -2° tilt, italic Fraunces body,
// lavender mood. The original prototype layout — kept intact since user
// signed it off.
function PatisserieForewordPage({
  brand,
  pack,
  content,
  imageDataUri,
  avatarDataUri,
}: ForewordPageProps) {
  const t = packTheme(pack);
  const titleFont = fontFamilyForPack(pack);
  const polaroidPaper = blendWithWhite(t.bg, 0.7);

  return (
    <Page
      size="A4"
      style={{ backgroundColor: t.bg, fontFamily: "Inter", color: t.ink }}
    >
      <View
        style={{
          flex: 1,
          paddingHorizontal: 50,
          paddingTop: 44,
          paddingBottom: 36,
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <TopStrip pack={pack} />

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 36,
            flex: 1,
            paddingTop: 8,
            paddingBottom: 8,
          }}
        >
          <View
            style={{
              width: 250,
              padding: 12,
              paddingBottom: 36,
              backgroundColor: polaroidPaper,
              borderRadius: 3,
              transform: "rotate(-2deg)",
            }}
          >
            {imageDataUri ? (
              <Image
                src={imageDataUri}
                style={{ width: 226, height: 226, objectFit: "cover" }}
              />
            ) : (
              <View
                style={{
                  width: 226,
                  height: 226,
                  backgroundColor: blendWithWhite(t.accent, 0.85),
                }}
              />
            )}
            <Text
              style={{
                marginTop: 10,
                fontFamily: "Fraunces",
                fontStyle: "italic",
                fontSize: 11,
                color: t.inkSoft,
                textAlign: "center",
              }}
            >
              {pack.subtitle}
            </Text>
          </View>

          <View style={{ flex: 1, paddingTop: 12 }}>
            <Text
              style={{
                fontFamily: titleFont,
                fontSize: 26,
                lineHeight: 1.05,
                color: t.ink,
                letterSpacing: -0.3,
              }}
            >
              {content.greeting}
            </Text>
            <Text
              style={{
                marginTop: 18,
                fontFamily: "Fraunces",
                fontStyle: "italic",
                fontSize: 14,
                lineHeight: 1.55,
                color: t.ink,
              }}
            >
              {content.story}
            </Text>
            <Text
              style={{
                marginTop: 16,
                fontSize: 11,
                lineHeight: 1.55,
                color: t.inkSoft,
              }}
            >
              {content.signoff}
            </Text>
          </View>
        </View>

        <AuthorStrip
          brand={brand}
          pack={pack}
          avatarDataUri={avatarDataUri}
        />
      </View>
    </Page>
  );
}

// ─── SPORT — Pack 2 (Volumen-Wunder) ────────────────────────────────────────
// Square hero image right with sage-green accent border, bold sans
// greeting in Inter-Tight, macro-bar-inspired info strip.
//
// Image-Less-Mode: Wenn kein imageDataUri vorhanden ist, render keine
// Placeholder-Box — der Text-Block nimmt die ganze Breite, mit pack.subtitle
// als Stat-Strip oben statt unter dem Bild. Custom-Packs koennen so ein
// rein-textliches Vorwort haben, das visuell als "Mini-Editorial" wirkt
// statt als "Bild fehlt".
function SportForewordPage({
  brand,
  pack,
  content,
  imageDataUri,
  avatarDataUri,
}: ForewordPageProps) {
  const t = packTheme(pack);
  const accentSoft = blendWithWhite(t.accent, 0.55);
  const hasImage = Boolean(imageDataUri);

  return (
    <Page
      size="A4"
      style={{ backgroundColor: t.bg, fontFamily: "Inter", color: t.ink }}
    >
      <View
        style={{
          flex: 1,
          paddingHorizontal: 50,
          paddingTop: 44,
          paddingBottom: 36,
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <TopStrip pack={pack} />

        <View
          style={{
            flexDirection: "row",
            alignItems: "stretch",
            gap: 32,
            flex: 1,
            paddingTop: 16,
            paddingBottom: 16,
          }}
        >
          {/* Left: bold greeting + story stack */}
          <View
            style={{
              flex: 1,
              flexDirection: "column",
              justifyContent: "center",
              gap: 12,
              maxWidth: hasImage ? undefined : 460,
            }}
          >
            <View
              style={{
                width: 36,
                height: 4,
                backgroundColor: t.accent,
              }}
            />
            <Text
              style={{
                fontFamily: "Inter",
                fontSize: hasImage ? 30 : 36,
                fontWeight: 700,
                lineHeight: 1.05,
                color: t.ink,
                letterSpacing: -0.6,
                textTransform: "none",
              }}
            >
              {content.greeting}
            </Text>
            {!hasImage ? (
              <Text
                style={{
                  fontFamily: "Inter",
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: 1.8,
                  color: t.accent,
                  textTransform: "uppercase",
                  marginTop: 2,
                }}
              >
                {pack.subtitle}
              </Text>
            ) : null}
            <Text
              style={{
                fontFamily: "Inter",
                fontSize: hasImage ? 13 : 14,
                fontWeight: 400,
                lineHeight: 1.65,
                color: t.ink,
                marginTop: 4,
              }}
            >
              {content.story}
            </Text>
            <View
              style={{
                marginTop: 8,
                paddingTop: 12,
                borderTopWidth: 0.5,
                borderTopColor: t.divider,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: t.accent,
                }}
              />
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: t.ink,
                  letterSpacing: 0.2,
                }}
              >
                {content.signoff}
              </Text>
            </View>
          </View>

          {/* Right: sharp-cornered hero with thick accent rim — only when
              an image is available. Without image we skip the whole column
              so the text-block can breathe across the full width. */}
          {hasImage ? (
            <View
              style={{
                width: 240,
                padding: 6,
                backgroundColor: accentSoft,
                borderTopWidth: 4,
                borderTopColor: t.accent,
                borderRadius: 2,
                alignSelf: "center",
              }}
            >
              <Image
                src={imageDataUri as string}
                style={{ width: 228, height: 285, objectFit: "cover" }}
              />
              <Text
                style={{
                  marginTop: 8,
                  fontSize: 8,
                  fontWeight: 700,
                  letterSpacing: 1.6,
                  color: t.inkSoft,
                  textTransform: "uppercase",
                  textAlign: "center",
                }}
              >
                {pack.subtitle}
              </Text>
            </View>
          ) : null}
        </View>

        <AuthorStrip
          brand={brand}
          pack={pack}
          avatarDataUri={avatarDataUri}
        />
      </View>
    </Page>
  );
}

// ─── MINIMAL — Pack 3 (Bienes Snacks) ───────────────────────────────────────
// Huge "Hi" as display anchor, lots of breathing room, modest still-life
// in a small clean square. Mint mood, Apple-store calm.
// Cookbook-Cover-Vorwort fuer Pack 3 — Mirror der Recipe-Card-Vorlage:
// Stillleben fuellt die obere Haelfte, Greeting + Story sitzen darunter
// auf weissem Hintergrund mit Mint-Akzent-Streifen, Avatar als runder
// Stempel rechts unten auf dem Stillleben (genau wie auf der Recipe-
// Karte, damit Vorwort und Karten als zusammengehoerig gelesen werden).
function MinimalForewordPage({
  brand,
  pack,
  content,
  imageDataUri,
  avatarDataUri,
}: ForewordPageProps) {
  const t = packTheme(pack);
  const HERO_HEIGHT = 360;

  return (
    <Page
      size="A4"
      style={{ backgroundColor: "#ffffff", fontFamily: "Inter", color: t.ink }}
    >
      <View style={{ flex: 1, flexDirection: "column" }}>
        {/* HERO STILLLEBEN — full-bleed mit Top-Caption + Avatar-Stempel */}
        <View
          style={{
            position: "relative",
            width: "100%",
            height: HERO_HEIGHT,
            backgroundColor: blendWithWhite(t.bg, 0.7),
          }}
        >
          {imageDataUri ? (
            <Image
              src={imageDataUri}
              style={{ width: "100%", height: HERO_HEIGHT, objectFit: "cover" }}
            />
          ) : null}

          {/* (Vorher: 18% black overlay im unteren Drittel fuer Avatar-
              Lesbarkeit. Entfernt — User-Feedback: "die Haelfte ist dunkler
              als die andere, das sieht komisch aus". Avatar hat eigenen
              weissen Rand, Top-Caption hat eigene Lesbarkeit auch ohne
              Overlay.) */}

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
              Vorwort
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
              {pack.title}
            </Text>
          </View>

          {avatarDataUri ? (
            <View
              style={{
                position: "absolute",
                bottom: 26,
                right: 36,
                width: 60,
                height: 60,
                borderRadius: 30,
                overflow: "hidden",
                borderWidth: 2.5,
                borderColor: "#ffffff",
              }}
            >
              <Image
                src={avatarDataUri}
                style={{ width: 55, height: 55, objectFit: "cover", objectPosition: "center 25%" }}
              />
            </View>
          ) : null}
        </View>

        {/* MINT-AKZENT-STREIFEN — kurzes Spec-Band, parallel zur Recipe-
            Card. Macht den Vorwort als pack-zugehoerig erkennbar. */}
        <View
          style={{
            backgroundColor: t.bg,
            paddingHorizontal: 48,
            paddingVertical: 14,
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
          }}
        >
          <View style={{ width: 24, height: 2, backgroundColor: t.accent }} />
          <Text
            style={{
              fontSize: 8.5,
              fontWeight: 700,
              letterSpacing: 2,
              color: t.accent,
              textTransform: "uppercase",
            }}
          >
            {pack.subtitle}
          </Text>
        </View>

        {/* BODY — Greeting + Story + Signoff in einer Spalte, viel Luft */}
        <View
          style={{
            flex: 1,
            paddingHorizontal: 56,
            paddingTop: 36,
            paddingBottom: 44,
            flexDirection: "column",
            justifyContent: "center",
            gap: 22,
          }}
        >
          <Text
            style={{
              fontFamily: "Inter",
              fontSize: 38,
              fontWeight: 700,
              lineHeight: 1.04,
              color: t.ink,
              letterSpacing: -1,
            }}
          >
            {content.greeting}
          </Text>

          <Text
            style={{
              fontFamily: "Inter",
              fontSize: 14,
              lineHeight: 1.7,
              color: t.ink,
              maxWidth: 460,
            }}
          >
            {content.story}
          </Text>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              marginTop: 4,
            }}
          >
            <View style={{ width: 14, height: 2, backgroundColor: t.accent }} />
            <Text
              style={{
                fontFamily: "Fraunces",
                fontStyle: "italic",
                fontSize: 14,
                color: t.ink,
              }}
            >
              {content.signoff}
            </Text>
          </View>
        </View>

        {/* (AuthorStrip entfernt — Hero-Bild zeigt schon Avatar als Stempel
            rechts unten, die explizite Author-Zeile am Seitenende war
            redundant und hat das Vorwort auf zwei Seiten gedrueckt.
            User-Feedback: weglassen.) */}
      </View>
    </Page>
  );
}

// ─── DASHBOARD — Pack 4 (Meal-Prep Heroes) ──────────────────────────────────
// Notion-style tile composition. Hero image in a structured tile grid,
// data-row metadata underneath, sky-blue mood, grid-aligned text.
function DashboardForewordPage({
  brand,
  pack,
  content,
  imageDataUri,
  avatarDataUri,
}: ForewordPageProps) {
  const t = packTheme(pack);
  const tileBg = "#ffffff";

  return (
    <Page
      size="A4"
      style={{ backgroundColor: t.bg, fontFamily: "Inter", color: t.ink }}
    >
      <View
        style={{
          flex: 1,
          paddingHorizontal: 50,
          paddingTop: 44,
          paddingBottom: 36,
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <TopStrip pack={pack} />

        <View
          style={{
            flex: 1,
            flexDirection: "column",
            paddingTop: 16,
            paddingBottom: 16,
            gap: 14,
          }}
        >
          {/* Tile 1 — hero */}
          <View
            style={{
              backgroundColor: tileBg,
              borderRadius: 6,
              overflow: "hidden",
              flexDirection: "row",
              alignItems: "stretch",
              borderWidth: 0.5,
              borderColor: t.divider,
            }}
          >
            <View style={{ width: 200, height: 200 }}>
              {imageDataUri ? (
                <Image
                  src={imageDataUri}
                  style={{ width: 200, height: 200, objectFit: "cover" }}
                />
              ) : (
                <View
                  style={{
                    width: 200,
                    height: 200,
                    backgroundColor: blendWithWhite(t.accent, 0.85),
                  }}
                />
              )}
            </View>
            <View
              style={{
                flex: 1,
                paddingHorizontal: 22,
                paddingVertical: 22,
                justifyContent: "center",
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
                Vorwort · Wochenplan
              </Text>
              <Text
                style={{
                  marginTop: 6,
                  fontFamily: "Fraunces",
                  fontSize: 26,
                  lineHeight: 1.05,
                  color: t.ink,
                  letterSpacing: -0.4,
                }}
              >
                {content.greeting}
              </Text>
            </View>
          </View>

          {/* Tile 2 — story body */}
          <View
            style={{
              backgroundColor: tileBg,
              borderRadius: 6,
              padding: 22,
              borderWidth: 0.5,
              borderColor: t.divider,
            }}
          >
            <Text
              style={{
                fontFamily: "Inter",
                fontSize: 12.5,
                lineHeight: 1.65,
                color: t.ink,
              }}
            >
              {content.story}
            </Text>
          </View>

          {/* Tile 3 — signoff data row */}
          <View
            style={{
              backgroundColor: tileBg,
              borderRadius: 6,
              paddingHorizontal: 22,
              paddingVertical: 14,
              borderWidth: 0.5,
              borderColor: t.divider,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: t.accent,
              }}
            />
            <Text
              style={{
                fontFamily: "Inter",
                fontSize: 11,
                fontWeight: 500,
                color: t.ink,
                flex: 1,
              }}
            >
              {content.signoff}
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
              {pack.subtitle}
            </Text>
          </View>
        </View>

        <AuthorStrip
          brand={brand}
          pack={pack}
          avatarDataUri={avatarDataUri}
        />
      </View>
    </Page>
  );
}

// ─── EDITORIAL — Pack 5 (Feierabend-Klassiker) ─────────────────────────────
// Card-Centered Design (v2): die gesamte Vorwort-Komposition sitzt in
// einer weissen Card auf dem Pack-Mood-Background. Hero-Bild oben in
// der Card, Greeting + Story + Signoff stacked als single-column unter
// dem Bild. Das fuehlt sich wie eine Premium-Kochbuch-Innenseite an,
// vermeidet die asymmetrische Zwei-Spalten-Verteilung mit ihrem grossen
// Whitespace rechts, und gibt dem Pack-Mood-Color einen Frame-Rolle
// statt komplettes Page-Fill.
function EditorialForewordPage({
  brand,
  pack,
  content,
  imageDataUri,
  avatarDataUri,
}: ForewordPageProps) {
  const t = packTheme(pack);
  // Adaptive Hero-Höhe: bei Bild im Stack höher (270pt), ohne Bild
  // schrumpft die Card und gibt dem Greeting + Body mehr Atemraum.
  const heroHeight = imageDataUri ? 270 : 0;

  return (
    <Page
      size="A4"
      style={{ backgroundColor: t.bg, fontFamily: "Inter", color: t.ink }}
    >
      {/* Eyebrow oben (Vorwort · Pack-Title) — sitzt direkt auf dem
          Pack-Background, nicht in der Card. Dezent, dient als
          Kapitel-Marker. */}
      <View
        style={{
          paddingHorizontal: 44,
          paddingTop: 30,
          paddingBottom: 14,
        }}
      >
        <TopStrip pack={pack} />
      </View>

      {/* WHITE CARD — der eigentliche Inhalt. Margin schafft den
          Pack-Mood-Frame, borderRadius gibt der Card editorial-Pop. */}
      <View
        style={{
          marginHorizontal: 40,
          marginBottom: 16,
          flex: 1,
          backgroundColor: "#ffffff",
          borderRadius: 10,
          overflow: "hidden",
          flexDirection: "column",
        }}
      >
        {imageDataUri ? (
          <Image
            src={imageDataUri}
            style={{
              width: "100%",
              height: heroHeight,
              objectFit: "cover",
            }}
          />
        ) : null}

        <View
          style={{
            flex: 1,
            paddingHorizontal: 38,
            paddingTop: 32,
            paddingBottom: 28,
            flexDirection: "column",
            gap: 18,
          }}
        >
          {/* Greeting — italic Fraunces, prominent als Vorwort-Anker */}
          <Text
            style={{
              fontFamily: "Fraunces",
              fontStyle: "italic",
              fontSize: 30,
              lineHeight: 1.08,
              color: t.ink,
              letterSpacing: -0.5,
            }}
          >
            {content.greeting}
          </Text>

          {/* Story — single column, generous lineHeight, leftright-Atmen
              durch padding-Right max-width-aehnlichen Effekt. */}
          <Text
            style={{
              fontFamily: "Inter",
              fontSize: 11.5,
              lineHeight: 1.7,
              color: t.ink,
              maxWidth: 480,
            }}
          >
            {content.story}
          </Text>

          {/* Signoff als italic Fraunces mit Accent-Bar links — pull-quote-
              feel ohne zweite Spalte. */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              marginTop: 6,
            }}
          >
            <View
              style={{
                width: 22,
                height: 2,
                backgroundColor: t.accent,
              }}
            />
            <Text
              style={{
                fontFamily: "Fraunces",
                fontStyle: "italic",
                fontSize: 14.5,
                color: t.ink,
              }}
            >
              {content.signoff}
            </Text>
          </View>
        </View>
      </View>

      {/* Author-Strip aussen unter der Card auf dem Pack-Mood-Background.
          Mit eigenem padding fuer Atemraum (paddingHorizontal matched
          mit Card margin damit Avatar nicht visuell raus-haengt). */}
      <View
        style={{
          paddingHorizontal: 44,
          paddingTop: 4,
          paddingBottom: 28,
        }}
      >
        <AuthorStrip
          brand={brand}
          pack={pack}
          avatarDataUri={avatarDataUri}
        />
      </View>
    </Page>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Newspaper Broadsheet Foreword — Times/NYT-Editorial-Look
// ═════════════════════════════════════════════════════════════════════════════
// Komplett anderes Vorwort als die anderen Layouts: Print-Newspaper-
// Editorial. Masthead, italic Drop-Cap, 2-Spalten Hero/Lead, Doppellinien.
// Cream-Background für Print-Feel.

function NewspaperForewordPage({
  brand,
  pack,
  content,
  imageDataUri,
  avatarDataUri,
}: ForewordPageProps) {
  const t = packTheme(pack);
  const newspaperBg = "#fafaf5";
  const greeting = content.greeting?.trim() || "Vorwort";
  const story = content.story?.trim() ?? "";
  const signoff = content.signoff?.trim() ?? "";
  const storyFirstChar = story.charAt(0);
  const storyRest = story.slice(1);

  return (
    <Page
      size="A4"
      style={{
        backgroundColor: newspaperBg,
        fontFamily: "Fraunces",
        color: t.ink,
      }}
    >
      {/* Masthead */}
      <View
        style={{
          paddingHorizontal: 36,
          paddingTop: 30,
          paddingBottom: 6,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "baseline",
            justifyContent: "space-between",
            borderBottomWidth: 2,
            borderBottomColor: t.ink,
            paddingBottom: 5,
          }}
        >
          <Text
            style={{
              fontFamily: "Fraunces",
              fontSize: 28,
              fontWeight: 700,
              fontStyle: "italic",
              color: t.ink,
              letterSpacing: -0.3,
            }}
          >
            {brand.name} Times
          </Text>
          <Text
            style={{
              fontFamily: "Inter",
              fontSize: 8,
              color: t.inkSoft,
              letterSpacing: 1.8,
              textTransform: "uppercase",
            }}
          >
            Sonderausgabe · {pack.title}
          </Text>
        </View>
        <View
          style={{
            height: 0.5,
            backgroundColor: t.ink,
            marginTop: 2,
          }}
        />
      </View>

      {/* Section-Label */}
      <View
        style={{
          paddingHorizontal: 36,
          paddingTop: 16,
        }}
      >
        <Text
          style={{
            fontFamily: "Inter",
            fontSize: 8.5,
            fontWeight: 700,
            letterSpacing: 2.4,
            color: t.accent,
            textTransform: "uppercase",
          }}
        >
          Vorwort · Von {brand.name}
        </Text>
      </View>

      {/* 2-Col: Image left, Greeting + Lead right */}
      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: 36,
          marginTop: 12,
          gap: 24,
          flex: 1,
        }}
      >
        {/* Hero-Image (Collage oder Stillleben) */}
        {imageDataUri ? (
          <View style={{ width: "50%" }}>
            <View
              style={{
                width: "100%",
                aspectRatio: 4 / 5,
                overflow: "hidden",
                backgroundColor: t.paper,
              }}
            >
              <Image
                src={imageDataUri}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </View>
            <Text
              style={{
                fontFamily: "Fraunces",
                fontSize: 8,
                fontStyle: "italic",
                color: t.inkSoft,
                marginTop: 4,
                lineHeight: 1.35,
              }}
            >
              Rezepte aus {brand.name}s Küche, exklusiv für dieses Pack.
            </Text>
          </View>
        ) : null}

        {/* Right column — vertikal verteilt: Headline oben, Signoff unten */}
        <View style={{ flex: 1, justifyContent: "space-between" }}>
          {/* Oberer Block: Headline + Rule + Story */}
          <View>
            {/* Italic Headline (greeting als Kurz-Headline) */}
            <Text
              style={{
                fontFamily: "Fraunces",
                fontSize: 32,
                fontWeight: 700,
                fontStyle: "italic",
                color: t.ink,
                lineHeight: 1.05,
                letterSpacing: -0.4,
                marginBottom: 14,
              }}
            >
              {greeting}
            </Text>
            {/* Byline-Rule */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginBottom: 16,
              }}
            >
              <View
                style={{ flex: 1, height: 0.5, backgroundColor: t.divider }}
              />
            </View>
            {/* Story mit Drop-Cap */}
            {story.length > 0 ? (
              <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                <Text
                  style={{
                    fontFamily: "Fraunces",
                    fontSize: 54,
                    fontWeight: 700,
                    fontStyle: "italic",
                    color: t.accent,
                    lineHeight: 0.85,
                    marginRight: 6,
                    marginTop: -4,
                    width: 38,
                  }}
                >
                  {storyFirstChar}
                </Text>
                <Text
                  style={{
                    flex: 1,
                    fontFamily: "Fraunces",
                    fontSize: 12.5,
                    color: t.ink,
                    lineHeight: 1.65,
                    textAlign: "justify",
                  }}
                >
                  {storyRest}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Signoff als Pull-Quote-Strip am unteren Rand der Spalte */}
          {signoff ? (
            <View style={{ marginTop: 18 }}>
              <View
                style={{ height: 0.5, backgroundColor: t.divider, marginBottom: 12 }}
              />
              <Text
                style={{
                  fontFamily: "Fraunces",
                  fontSize: 14,
                  fontStyle: "italic",
                  fontWeight: 600,
                  color: t.accent,
                  lineHeight: 1.4,
                  letterSpacing: -0.1,
                }}
              >
                {signoff}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Footer-Strip mit Doppellinie + Avatar (Newspaper Author-Box) */}
      <View
        style={{
          position: "absolute",
          left: 36,
          right: 36,
          bottom: 30,
        }}
      >
        <View style={{ height: 1.5, backgroundColor: t.ink, marginBottom: 1 }} />
        <View style={{ height: 0.5, backgroundColor: t.ink, marginBottom: 14 }} />
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
          }}
        >
          {avatarDataUri ? (
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                overflow: "hidden",
                borderWidth: 1.5,
                borderColor: t.accent,
              }}
            >
              <Image
                src={avatarDataUri}
                style={{
                  width: 39,
                  height: 39,
                  objectFit: "cover",
                  objectPosition: "center 25%",
                }}
              />
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: "Fraunces",
                fontSize: 13,
                fontStyle: "italic",
                color: t.ink,
              }}
            >
              {brand.name}
            </Text>
            <Text
              style={{
                fontFamily: "Inter",
                fontSize: 8,
                color: t.inkSoft,
                marginTop: 2,
                letterSpacing: 1.4,
                textTransform: "uppercase",
              }}
            >
              {brand.handle} · Redaktion
            </Text>
          </View>
        </View>
      </View>
    </Page>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Vinyl Album-Sleeve Foreword
// ═════════════════════════════════════════════════════════════════════════════
// Vinyl-Recipe-Cards haben den Album-Sleeve-Look. Das Vorwort soll diese
// Design-Sprache fortsetzen: Hero als großes Album-Cover, schwarze
// LP-Disc halb rausgezogen rechts, Greeting + Story als "Side A" Liner
// Notes mit Drop-Cap, Footer "Pressed by Brand · Side B Coming Up".

function VinylForewordPage({
  brand,
  pack,
  content,
  imageDataUri,
  avatarDataUri,
}: ForewordPageProps) {
  const t = packTheme(pack);
  const greeting = content.greeting?.trim() || "Vorwort";
  const story = content.story?.trim() ?? "";
  const signoff = content.signoff?.trim() ?? "";
  const storyFirstChar = story.charAt(0);
  const storyRest = story.slice(1);

  // Pack-Mood als dezenter Hintergrund
  return (
    <Page
      size="A4"
      style={{ backgroundColor: t.bg, fontFamily: "Inter", color: t.ink }}
    >
      {/* Masthead */}
      <View
        style={{
          paddingHorizontal: 36,
          paddingTop: 30,
          paddingBottom: 10,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Svg width={16} height={16} viewBox="0 0 16 16">
              <Circle cx={8} cy={8} r={7.5} fill="#0a0a0a" />
              <Circle cx={8} cy={8} r={2.5} fill={t.accent} />
              <Circle cx={8} cy={8} r={0.8} fill="#fff" />
            </Svg>
            <Text
              style={{
                fontFamily: "Inter",
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 2.4,
                color: t.ink,
                textTransform: "uppercase",
              }}
            >
              Pressed by {brand.name}
            </Text>
          </View>
          <Text
            style={{
              fontFamily: "Inter",
              fontSize: 8,
              letterSpacing: 1.8,
              color: t.inkSoft,
              textTransform: "uppercase",
            }}
          >
            {pack.title} · LP-Edition
          </Text>
        </View>
        <View
          style={{
            height: 1.5,
            backgroundColor: t.ink,
            marginTop: 8,
          }}
        />
      </View>

      {/* Album-Sleeve mit LP halb rausgezogen */}
      <View
        style={{
          alignItems: "center",
          paddingTop: 14,
        }}
      >
        <View
          style={{
            width: 290,
            height: 220,
            position: "relative",
          }}
        >
          {/* LP-Disc rechts halb sichtbar */}
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 220 - 16,
              width: 220,
              height: 220,
              backgroundColor: "#0a0a0a",
              borderRadius: 110,
            }}
          />
          {/* Grooves */}
          <Svg
            style={{ position: "absolute", top: 0, left: 220 - 16 }}
            width={220}
            height={220}
          >
            {[100, 88, 76, 64].map((r) => (
              <Circle
                key={r}
                cx={110}
                cy={110}
                r={r}
                fill="none"
                stroke="#1a1a1a"
                strokeWidth={0.5}
              />
            ))}
          </Svg>
          {/* Center Label */}
          <View
            style={{
              position: "absolute",
              top: 110 - 40,
              left: 220 - 16 + 110 - 40,
              width: 80,
              height: 80,
              backgroundColor: t.accent,
              borderRadius: 40,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontFamily: "Fraunces",
                fontSize: 14,
                fontWeight: 700,
                fontStyle: "italic",
                color: "#fafafa",
              }}
            >
              {brand.name}
            </Text>
            <Text
              style={{
                fontFamily: "Inter",
                fontSize: 7,
                letterSpacing: 1.4,
                color: "#fafafa",
                marginTop: 3,
                opacity: 0.85,
              }}
            >
              SIDE A
            </Text>
          </View>
          {/* Spindle hole */}
          <View
            style={{
              position: "absolute",
              top: 110 - 3,
              left: 220 - 16 + 110 - 3,
              width: 6,
              height: 6,
              backgroundColor: "#fafafa",
              borderRadius: 3,
            }}
          />

          {/* Album-Cover (Hero) */}
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: 220,
              height: 220,
              overflow: "hidden",
              backgroundColor: t.paper,
            }}
          >
            {imageDataUri ? (
              <Image
                src={imageDataUri}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <View
                style={{
                  width: "100%",
                  height: "100%",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: t.accent,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Fraunces",
                    fontSize: 80,
                    fontWeight: 700,
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

      {/* Title + Side-Label */}
      <View style={{ paddingHorizontal: 48, marginTop: 16 }}>
        <Text
          style={{
            fontFamily: "Inter",
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: 2.4,
            color: t.accent,
            textTransform: "uppercase",
            textAlign: "center",
          }}
        >
          Side A · Vorwort
        </Text>
        <Text
          style={{
            fontFamily: "Fraunces",
            fontSize: 26,
            fontWeight: 700,
            color: t.ink,
            textAlign: "center",
            marginTop: 6,
            lineHeight: 1.1,
          }}
        >
          {greeting}
        </Text>
      </View>

      {/* Story als Liner-Notes mit Drop-Cap */}
      <View
        style={{
          paddingHorizontal: 56,
          marginTop: 18,
        }}
      >
        {story.length > 0 ? (
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            <Text
              style={{
                fontFamily: "Fraunces",
                fontSize: 42,
                fontWeight: 700,
                fontStyle: "italic",
                color: t.accent,
                lineHeight: 0.85,
                marginRight: 4,
                marginTop: -3,
                width: 30,
              }}
            >
              {storyFirstChar}
            </Text>
            <Text
              style={{
                flex: 1,
                fontFamily: "Fraunces",
                fontSize: 11,
                color: t.ink,
                lineHeight: 1.55,
                textAlign: "justify",
              }}
            >
              {storyRest}
            </Text>
          </View>
        ) : null}

        {signoff ? (
          <Text
            style={{
              fontFamily: "Fraunces",
              fontSize: 11,
              fontStyle: "italic",
              color: t.accent,
              marginTop: 14,
              textAlign: "center",
            }}
          >
            {signoff}
          </Text>
        ) : null}
      </View>

      {/* Footer mit "Side B Coming Up" */}
      <View
        style={{
          position: "absolute",
          left: 36,
          right: 36,
          bottom: 30,
        }}
      >
        <View
          style={{
            height: 0.5,
            backgroundColor: t.divider,
            marginBottom: 12,
          }}
        />
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            {avatarDataUri ? (
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  overflow: "hidden",
                  borderWidth: 1.5,
                  borderColor: t.accent,
                }}
              >
                <Image
                  src={avatarDataUri}
                  style={{
                    width: 35,
                    height: 35,
                    objectFit: "cover",
                    objectPosition: "center 25%",
                  }}
                />
              </View>
            ) : null}
            <View>
              <Text
                style={{
                  fontFamily: "Inter",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 1.6,
                  color: t.ink,
                  textTransform: "uppercase",
                }}
              >
                {brand.name}
              </Text>
              <Text
                style={{
                  fontFamily: "Inter",
                  fontSize: 8,
                  color: t.inkSoft,
                  marginTop: 2,
                  letterSpacing: 1.2,
                }}
              >
                {brand.handle}
              </Text>
            </View>
          </View>
          <Text
            style={{
              fontFamily: "Inter",
              fontSize: 8,
              fontWeight: 600,
              letterSpacing: 1.8,
              color: t.inkSoft,
              textTransform: "uppercase",
            }}
          >
            Side B · Coming Up
          </Text>
        </View>
      </View>
    </Page>
  );
}

// ─── CONSTELLATION — Sternkarten-Vorwort ────────────────────────────────────
// Dark-Sky-Background, Hero rund mit Glow-Halo, italic Drop-Cap-Story in
// cream-Text. Background-Sterne als Atmosphäre. Author-Box im Footer mit
// Avatar + Brand (KEIN brand.signature — wie Vinyl/Newspaper).
const CONSTELLATION_FOREWORD_COLORS = {
  bg: "#0a0e1f",
  inkPrimary: "#e8e6dc",
  inkSoft: "#9b9bb0",
  inkSubtle: "#5e6480",
  divider: "#2a2e44",
  star: "#fafaf5",
} as const;

function buildForewordStars(seed: string): {
  x: number;
  y: number;
  r: number;
  opacity: number;
}[] {
  let s = 0;
  for (let i = 0; i < seed.length; i++) {
    s = (s * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const stars: { x: number; y: number; r: number; opacity: number }[] = [];
  for (let i = 0; i < 110; i++) {
    const x = rand() * 595;
    const y = rand() * 842;
    const r = 0.3 + rand() * 1.0;
    const opacity = 0.2 + rand() * 0.55;
    stars.push({ x, y, r, opacity });
  }
  return stars;
}

function ConstellationForewordPage({
  brand,
  pack,
  content,
  imageDataUri,
  avatarDataUri,
}: ForewordPageProps) {
  const t = packTheme(pack);
  const greeting = content.greeting?.trim() || "Vorwort";
  const story = content.story?.trim() ?? "";
  const signoff = content.signoff?.trim() ?? "";
  const storyFirstChar = story.charAt(0);
  const storyRest = story.slice(1);

  const bgStars = buildForewordStars(pack.slug + greeting);

  return (
    <Page
      size="A4"
      style={{
        backgroundColor: CONSTELLATION_FOREWORD_COLORS.bg,
        fontFamily: "Inter",
        color: CONSTELLATION_FOREWORD_COLORS.inkPrimary,
      }}
    >
      {/* Background-Sterne */}
      <Svg
        width={595}
        height={842}
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        {bgStars.map((s, i) => (
          <Circle
            key={`bg-${i}`}
            cx={s.x}
            cy={s.y}
            r={s.r}
            fill={CONSTELLATION_FOREWORD_COLORS.star}
            opacity={s.opacity}
          />
        ))}
      </Svg>

      {/* Masthead */}
      <View
        style={{
          paddingHorizontal: 36,
          paddingTop: 30,
          paddingBottom: 8,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            borderBottomWidth: 0.5,
            borderBottomColor: CONSTELLATION_FOREWORD_COLORS.divider,
            paddingBottom: 8,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Svg width={14} height={14} viewBox="0 0 14 14">
              <Path
                d="M 7 0.5 L 8.2 5.3 L 13 6.5 L 8.8 8.2 L 9.4 13 L 7 10 L 4.6 13 L 5.2 8.2 L 1 6.5 L 5.8 5.3 Z"
                fill={t.accent}
              />
            </Svg>
            <Text
              style={{
                fontFamily: "Inter",
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 2.4,
                color: CONSTELLATION_FOREWORD_COLORS.inkPrimary,
                textTransform: "uppercase",
              }}
            >
              ✦ Constellation · {brand.name}
            </Text>
          </View>
          <Text
            style={{
              fontFamily: "Inter",
              fontSize: 8,
              letterSpacing: 1.8,
              color: CONSTELLATION_FOREWORD_COLORS.inkSoft,
              textTransform: "uppercase",
            }}
          >
            {pack.title} · Stellar-Edition
          </Text>
        </View>
      </View>

      {/* Hero rund mit Glow-Halo, zentriert */}
      <View style={{ alignItems: "center", paddingTop: 22 }}>
        <View
          style={{
            width: 226,
            height: 226,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Glow-Halo: konzentrische Akzent-Kreise */}
          <Svg
            width={226}
            height={226}
            style={{ position: "absolute", top: 0, left: 0 }}
          >
            <Circle
              cx={113}
              cy={113}
              r={110}
              fill={t.accent}
              opacity={0.08}
            />
            <Circle
              cx={113}
              cy={113}
              r={102}
              fill={t.accent}
              opacity={0.15}
            />
            <Circle
              cx={113}
              cy={113}
              r={95}
              fill="none"
              stroke={t.accent}
              strokeWidth={0.75}
              opacity={0.55}
            />
          </Svg>
          {/* Hero-Bild rund */}
          <View
            style={{
              width: 180,
              height: 180,
              borderRadius: 90,
              overflow: "hidden",
              backgroundColor: "#1a1d33",
            }}
          >
            {imageDataUri ? (
              <Image
                src={imageDataUri}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <View
                style={{
                  width: "100%",
                  height: "100%",
                  backgroundColor: t.accent,
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
                    color: CONSTELLATION_FOREWORD_COLORS.star,
                  }}
                >
                  {brand.name.charAt(0)}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Eyebrow + Greeting */}
      <View style={{ paddingHorizontal: 56, marginTop: 18 }}>
        <Text
          style={{
            fontFamily: "Inter",
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: 2.6,
            color: t.accent,
            textTransform: "uppercase",
            textAlign: "center",
          }}
        >
          ✦ Vorwort · Stellar Map
        </Text>
        <Text
          style={{
            fontFamily: "Fraunces",
            fontSize: 28,
            fontWeight: 700,
            fontStyle: "italic",
            color: CONSTELLATION_FOREWORD_COLORS.inkPrimary,
            textAlign: "center",
            marginTop: 8,
            lineHeight: 1.1,
            letterSpacing: -0.3,
          }}
        >
          {greeting}
        </Text>
      </View>

      {/* Story als italic Drop-Cap-Block */}
      <View
        style={{
          paddingHorizontal: 64,
          marginTop: 20,
        }}
      >
        {story.length > 0 ? (
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            <Text
              style={{
                fontFamily: "Fraunces",
                fontSize: 44,
                fontWeight: 700,
                fontStyle: "italic",
                color: t.accent,
                lineHeight: 0.85,
                marginRight: 6,
                marginTop: -3,
                width: 32,
              }}
            >
              {storyFirstChar}
            </Text>
            <Text
              style={{
                flex: 1,
                fontFamily: "Fraunces",
                fontSize: 11,
                color: CONSTELLATION_FOREWORD_COLORS.inkPrimary,
                lineHeight: 1.6,
                textAlign: "justify",
                opacity: 0.92,
              }}
            >
              {storyRest}
            </Text>
          </View>
        ) : null}

        {signoff ? (
          <Text
            style={{
              fontFamily: "Fraunces",
              fontSize: 11,
              fontStyle: "italic",
              color: t.accent,
              marginTop: 16,
              textAlign: "center",
            }}
          >
            {signoff}
          </Text>
        ) : null}
      </View>

      {/* Footer mit Author-Strip (KEIN brand.signature) */}
      <View
        style={{
          position: "absolute",
          left: 36,
          right: 36,
          bottom: 30,
        }}
      >
        <View
          style={{
            height: 0.5,
            backgroundColor: CONSTELLATION_FOREWORD_COLORS.divider,
            marginBottom: 14,
          }}
        />
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            {avatarDataUri ? (
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  overflow: "hidden",
                  borderWidth: 1.5,
                  borderColor: t.accent,
                }}
              >
                <Image
                  src={avatarDataUri}
                  style={{
                    width: 35,
                    height: 35,
                    objectFit: "cover",
                    objectPosition: "center 25%",
                  }}
                />
              </View>
            ) : null}
            <View>
              <Text
                style={{
                  fontFamily: "Inter",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 1.6,
                  color: CONSTELLATION_FOREWORD_COLORS.inkPrimary,
                  textTransform: "uppercase",
                }}
              >
                {brand.name}
              </Text>
              <Text
                style={{
                  fontFamily: "Inter",
                  fontSize: 8,
                  color: CONSTELLATION_FOREWORD_COLORS.inkSoft,
                  marginTop: 2,
                  letterSpacing: 1.2,
                }}
              >
                {brand.handle}
              </Text>
            </View>
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Svg width={12} height={12} viewBox="0 0 12 12">
              <Path
                d="M 6 0.5 L 7 4.5 L 11 5.5 L 7.5 7 L 8 11 L 6 8.5 L 4 11 L 4.5 7 L 1 5.5 L 5 4.5 Z"
                fill={t.accent}
              />
            </Svg>
            <Text
              style={{
                fontFamily: "Inter",
                fontSize: 8,
                fontWeight: 600,
                letterSpacing: 1.8,
                color: CONSTELLATION_FOREWORD_COLORS.inkSoft,
                textTransform: "uppercase",
              }}
            >
              Trajectory Beginnt
            </Text>
          </View>
        </View>
      </View>
    </Page>
  );
}

// ─── RESTAURANT — Fine-Dining-Speisekarte-Vorwort ────────────────────────────
// Cream-BG, Gold-Ornamente, quadr. Hero mit Gold-Border, italic Drop-Cap-
// Story, ◆-Diamanten als Section-Marker. Author-Box im Footer mit Avatar
// (KEIN brand.signature — wie Vinyl/Newspaper/Constellation).
const RESTAURANT_FOREWORD_COLORS = {
  bg: "#fcf9f3",
  paper: "#f5f1e8",
  ink: "#2c2418",
  inkSoft: "#665544",
  inkSubtle: "#9a8a76",
  gold: "#b08842",
  divider: "#d8cdb8",
} as const;

function RestaurantForewordPage({
  brand,
  pack,
  content,
  imageDataUri,
  avatarDataUri,
}: ForewordPageProps) {
  const t = packTheme(pack);
  void t;
  const greeting = content.greeting?.trim() || "Vorwort";
  const story = content.story?.trim() ?? "";
  const signoff = content.signoff?.trim() ?? "";
  const storyFirstChar = story.charAt(0);
  const storyRest = story.slice(1);

  return (
    <Page
      size="A4"
      style={{
        backgroundColor: RESTAURANT_FOREWORD_COLORS.bg,
        fontFamily: "Fraunces",
        color: RESTAURANT_FOREWORD_COLORS.ink,
      }}
    >
      {/* Masthead */}
      <View
        style={{
          paddingHorizontal: 36,
          paddingTop: 30,
          alignItems: "center",
        }}
      >
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
              backgroundColor: RESTAURANT_FOREWORD_COLORS.gold,
            }}
          />
          <Text
            style={{
              fontFamily: "Inter",
              fontSize: 7.5,
              fontWeight: 700,
              letterSpacing: 3,
              color: RESTAURANT_FOREWORD_COLORS.gold,
              textTransform: "uppercase",
            }}
          >
            Le Menu · Vorwort
          </Text>
          <View
            style={{
              flex: 1,
              height: 0.5,
              backgroundColor: RESTAURANT_FOREWORD_COLORS.gold,
            }}
          />
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            marginTop: 8,
          }}
        >
          <Text style={{ fontSize: 7, color: RESTAURANT_FOREWORD_COLORS.gold }}>
            ◆
          </Text>
          <Text
            style={{
              fontFamily: "Fraunces",
              fontSize: 12,
              fontStyle: "italic",
              fontWeight: 600,
              letterSpacing: 2,
              color: RESTAURANT_FOREWORD_COLORS.ink,
              textTransform: "uppercase",
            }}
          >
            {brand.name}
          </Text>
          <Text style={{ fontSize: 7, color: RESTAURANT_FOREWORD_COLORS.gold }}>
            ◆
          </Text>
        </View>
        <Text
          style={{
            fontFamily: "Inter",
            fontSize: 7,
            letterSpacing: 1.8,
            color: RESTAURANT_FOREWORD_COLORS.inkSubtle,
            textTransform: "uppercase",
            marginTop: 3,
          }}
        >
          {pack.title}
        </Text>
      </View>

      {/* Hero quadratisch mit Gold-Border, zentriert */}
      <View
        style={{
          alignItems: "center",
          paddingTop: 22,
        }}
      >
        <View
          style={{
            width: 208,
            height: 208,
            padding: 4,
            borderWidth: 0.75,
            borderColor: RESTAURANT_FOREWORD_COLORS.gold,
          }}
        >
          <View
            style={{
              width: 200,
              height: 200,
              overflow: "hidden",
              backgroundColor: RESTAURANT_FOREWORD_COLORS.paper,
            }}
          >
            {imageDataUri ? (
              <Image
                src={imageDataUri}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <View
                style={{
                  width: "100%",
                  height: "100%",
                  backgroundColor: RESTAURANT_FOREWORD_COLORS.gold,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    fontFamily: "Fraunces",
                    fontSize: 86,
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

      {/* Eyebrow + Greeting */}
      <View style={{ paddingHorizontal: 64, marginTop: 18, alignItems: "center" }}>
        <Text
          style={{
            fontFamily: "Inter",
            fontSize: 8,
            fontWeight: 600,
            letterSpacing: 3,
            color: RESTAURANT_FOREWORD_COLORS.gold,
            textTransform: "uppercase",
          }}
        >
          Préface · Bienvenue
        </Text>
        <Text
          style={{
            fontFamily: "Fraunces",
            fontSize: 30,
            fontStyle: "italic",
            fontWeight: 600,
            color: RESTAURANT_FOREWORD_COLORS.ink,
            textAlign: "center",
            marginTop: 8,
            lineHeight: 1.1,
            letterSpacing: 0.3,
          }}
        >
          {greeting}
        </Text>
        {/* Ornamental Rule unter Greeting */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            marginTop: 10,
          }}
        >
          <View
            style={{
              width: 36,
              height: 0.5,
              backgroundColor: RESTAURANT_FOREWORD_COLORS.gold,
            }}
          />
          <Text style={{ fontSize: 7, color: RESTAURANT_FOREWORD_COLORS.gold }}>
            ◇
          </Text>
          <View
            style={{
              width: 36,
              height: 0.5,
              backgroundColor: RESTAURANT_FOREWORD_COLORS.gold,
            }}
          />
        </View>
      </View>

      {/* Story als italic Drop-Cap-Block */}
      <View
        style={{
          paddingHorizontal: 72,
          marginTop: 18,
        }}
      >
        {story.length > 0 ? (
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            <Text
              style={{
                fontFamily: "Fraunces",
                fontSize: 46,
                fontWeight: 700,
                fontStyle: "italic",
                color: RESTAURANT_FOREWORD_COLORS.gold,
                lineHeight: 0.85,
                marginRight: 6,
                marginTop: -3,
                width: 34,
              }}
            >
              {storyFirstChar}
            </Text>
            <Text
              style={{
                flex: 1,
                fontFamily: "Fraunces",
                fontSize: 11,
                color: RESTAURANT_FOREWORD_COLORS.ink,
                lineHeight: 1.65,
                textAlign: "justify",
                letterSpacing: 0.2,
              }}
            >
              {storyRest}
            </Text>
          </View>
        ) : null}

        {signoff ? (
          <Text
            style={{
              fontFamily: "Fraunces",
              fontSize: 11,
              fontStyle: "italic",
              color: RESTAURANT_FOREWORD_COLORS.gold,
              marginTop: 18,
              textAlign: "center",
              letterSpacing: 0.3,
            }}
          >
            {signoff}
          </Text>
        ) : null}
      </View>

      {/* Footer mit Author-Strip (KEIN brand.signature) */}
      <View
        style={{
          position: "absolute",
          left: 36,
          right: 36,
          bottom: 30,
        }}
      >
        <View
          style={{
            height: 0.5,
            backgroundColor: RESTAURANT_FOREWORD_COLORS.gold,
            marginBottom: 14,
          }}
        />
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            {avatarDataUri ? (
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  overflow: "hidden",
                  borderWidth: 1.5,
                  borderColor: RESTAURANT_FOREWORD_COLORS.gold,
                }}
              >
                <Image
                  src={avatarDataUri}
                  style={{
                    width: 35,
                    height: 35,
                    objectFit: "cover",
                    objectPosition: "center 25%",
                  }}
                />
              </View>
            ) : null}
            <View>
              <Text
                style={{
                  fontFamily: "Fraunces",
                  fontSize: 11,
                  fontStyle: "italic",
                  fontWeight: 600,
                  letterSpacing: 1.6,
                  color: RESTAURANT_FOREWORD_COLORS.ink,
                  textTransform: "uppercase",
                }}
              >
                {brand.name}
              </Text>
              <Text
                style={{
                  fontFamily: "Inter",
                  fontSize: 8,
                  color: RESTAURANT_FOREWORD_COLORS.inkSoft,
                  marginTop: 2,
                  letterSpacing: 1.2,
                }}
              >
                {brand.handle}
              </Text>
            </View>
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 7,
            }}
          >
            <Text style={{ fontSize: 7, color: RESTAURANT_FOREWORD_COLORS.gold }}>
              ◆
            </Text>
            <Text
              style={{
                fontFamily: "Inter",
                fontSize: 8,
                fontWeight: 600,
                letterSpacing: 1.8,
                color: RESTAURANT_FOREWORD_COLORS.inkSoft,
                textTransform: "uppercase",
              }}
            >
              Le Menu Commence
            </Text>
          </View>
        </View>
      </View>
    </Page>
  );
}
