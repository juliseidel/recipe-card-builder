import { Page, View, Text, Image } from "@react-pdf/renderer";
import type { Brand } from "@/lib/brands";
import type { Pack, CardLayout } from "@/lib/packs";
import type { PackForewordContent } from "@/lib/ai/generate-foreword";
import { packTheme, fontFamilyForPack, blendWithWhite } from "./theme";

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
        gap: 16,
        paddingTop: 18,
        borderTopWidth: 0.5,
        borderTopColor: t.divider,
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
              width: 44,
              height: 44,
              borderRadius: 22,
              overflow: "hidden",
              borderWidth: 1.5,
              borderColor: t.accent,
            }}
          >
            <Image
              src={avatarDataUri}
              style={{ width: 41, height: 41, objectFit: "cover" }}
            />
          </View>
        ) : null}
        <View>
          <Text
            style={{
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: 1.4,
              color: t.inkSoft,
              textTransform: "uppercase",
            }}
          >
            {brand.name}
          </Text>
          <Text
            style={{ fontSize: 8.5, color: t.inkSoft, marginTop: 1 }}
          >
            {brand.handle}
          </Text>
        </View>
      </View>
      {align === "between" ? (
        <Text
          style={{
            fontFamily: "Fraunces",
            fontStyle: "italic",
            fontSize: 18,
            color: t.ink,
          }}
        >
          {brand.signature}
        </Text>
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
        {rightLabel ??
          `Pack ${pack.number.toString().padStart(2, "0")} · ${pack.title}`}
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
function SportForewordPage({
  brand,
  pack,
  content,
  imageDataUri,
  avatarDataUri,
}: ForewordPageProps) {
  const t = packTheme(pack);
  const accentSoft = blendWithWhite(t.accent, 0.55);

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
                fontSize: 30,
                fontWeight: 700,
                lineHeight: 1.05,
                color: t.ink,
                letterSpacing: -0.6,
                textTransform: "none",
              }}
            >
              {content.greeting}
            </Text>
            <Text
              style={{
                fontFamily: "Inter",
                fontSize: 13,
                fontWeight: 400,
                lineHeight: 1.6,
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

          {/* Right: sharp-cornered hero with thick accent rim */}
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
            {imageDataUri ? (
              <Image
                src={imageDataUri}
                style={{ width: 228, height: 285, objectFit: "cover" }}
              />
            ) : (
              <View
                style={{
                  width: 228,
                  height: 285,
                  backgroundColor: blendWithWhite(t.accent, 0.85),
                }}
              />
            )}
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

          {/* Subtiler dunkler Verlauf am unteren Rand fuer Avatar-
              Lesbarkeit, falls das Stillleben sehr hell ist. */}
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: HERO_HEIGHT * 0.4,
              backgroundColor: "rgba(0, 0, 0, 0.18)",
            }}
          />

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
              Pack {pack.number.toString().padStart(2, "0")} · {pack.title}
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
                style={{ width: 55, height: 55, objectFit: "cover" }}
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
            paddingBottom: 28,
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

        <AuthorStrip
          brand={brand}
          pack={pack}
          avatarDataUri={avatarDataUri}
        />
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
// Magazine-spread feel. Big still-life on top, two-column body underneath
// with greeting as italic Fraunces drop-cap and pull-quote signoff.
function EditorialForewordPage({
  brand,
  pack,
  content,
  imageDataUri,
  avatarDataUri,
}: ForewordPageProps) {
  const t = packTheme(pack);

  return (
    <Page
      size="A4"
      style={{ backgroundColor: t.bg, fontFamily: "Inter", color: t.ink }}
    >
      <View
        style={{
          flex: 1,
          paddingHorizontal: 50,
          paddingTop: 36,
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
            paddingTop: 14,
            paddingBottom: 12,
            gap: 18,
          }}
        >
          {/* Wide hero band */}
          <View style={{ width: "100%", height: 220, overflow: "hidden" }}>
            {imageDataUri ? (
              <Image
                src={imageDataUri}
                style={{ width: "100%", height: 220, objectFit: "cover" }}
              />
            ) : (
              <View
                style={{
                  width: "100%",
                  height: 220,
                  backgroundColor: blendWithWhite(t.accent, 0.85),
                }}
              />
            )}
          </View>

          {/* Greeting — italic Fraunces, generous size, sits below hero */}
          <Text
            style={{
              fontFamily: "Fraunces",
              fontStyle: "italic",
              fontSize: 36,
              lineHeight: 1.05,
              color: t.ink,
              letterSpacing: -0.6,
            }}
          >
            {content.greeting}
          </Text>

          {/* Two-column body for editorial-magazine feel */}
          <View
            style={{
              flexDirection: "row",
              gap: 24,
              alignItems: "flex-start",
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: "Inter",
                  fontSize: 11.5,
                  lineHeight: 1.65,
                  color: t.ink,
                }}
              >
                {content.story}
              </Text>
            </View>
            <View
              style={{
                flex: 1,
                paddingLeft: 18,
                borderLeftWidth: 2,
                borderLeftColor: t.accent,
              }}
            >
              <Text
                style={{
                  fontFamily: "Fraunces",
                  fontStyle: "italic",
                  fontSize: 16,
                  lineHeight: 1.45,
                  color: t.ink,
                }}
              >
                {content.signoff}
              </Text>
            </View>
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
