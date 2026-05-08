import { Page, View, Text, Image } from "@react-pdf/renderer";
import type { Brand } from "@/lib/brands";
import type { Pack } from "@/lib/packs";
import type { PackForewordContent } from "@/lib/ai/generate-foreword";
import { packTheme, fontFamilyForPack, blendWithWhite } from "./theme";

// The foreword page sits between the pack cover and the index. It's the
// "booklet moment" — the spread that turns a recipe collection into
// something that feels like a published mini-cookbook. Layout DNA is
// chosen by the pack's cardLayout so each pack's foreword page feels
// of-a-piece with its recipe pages.
//
// One layout is implemented per pass; ratherthan all five at once. We
// start with patisserie (Pack 1 — Bienes Backwelt), test it on a real
// PDF, then add the other four. The component falls back to patisserie
// for unsupported layouts so a missing variant never crashes the render.

export type ForewordPageProps = {
  brand: Brand;
  pack: Pack;
  content: PackForewordContent;
  // Pre-loaded data URIs — same convention as RecipeCardPdfPage and
  // PackPdfDocument. The render-pipeline (lib/pdf/render.ts) loads them
  // before invoking renderToBuffer.
  imageDataUri: string | null;
  avatarDataUri: string | null;
};

export function ForewordPage(props: ForewordPageProps) {
  // For now every pack uses the patisserie variant — it's the most
  // booklet-y of the five layouts (polaroid-style hero, italic Fraunces
  // body, magazine warmth) and works well even when paired with packs
  // whose recipe-cards use a different layout. We'll add per-layout
  // variants once Pack 1 is signed off.
  return <PatisserieForewordPage {...props} />;
}

// ─── PATISSERIE VARIANT ──────────────────────────────────────────────────────
// Polaroid frame for the still-life image, -2° tilt, italic Fraunces 32 pt
// for the body, lavender pack-mood background. Mirrors the patisserie
// recipe-card look so Pack 1 (Bienes Backwelt) has a coherent feel from
// foreword through to the last recipe.
function PatisserieForewordPage({
  brand,
  pack,
  content,
  imageDataUri,
  avatarDataUri,
}: ForewordPageProps) {
  const t = packTheme(pack);
  const titleFont = fontFamilyForPack(pack);

  // The polaroid frame needs a softer-than-white inner so it doesn't look
  // like a clipped sticker against the page. We blend the pack mood
  // background with white at 70 % to land somewhere creamy and warm.
  const polaroidPaper = blendWithWhite(t.bg, 0.7);

  return (
    <Page
      size="A4"
      style={{
        backgroundColor: t.bg,
        fontFamily: "Inter",
        color: t.ink,
      }}
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
        {/* TOP STRIP — small section label, mirrors the cover */}
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
            Pack {pack.number.toString().padStart(2, "0")} · {pack.title}
          </Text>
        </View>

        {/* CENTER ROW — Polaroid still-life left, story right */}
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
          {/* Polaroid frame with the still-life. -2° tilt + soft drop
              shadow (faked via padding + blended-paper background) so it
              feels physical rather than digitally pasted in. */}
          <View
            style={{
              width: 250,
              padding: 12,
              paddingBottom: 36,
              backgroundColor: polaroidPaper,
              borderRadius: 3,
              transform: "rotate(-2deg)",
              // react-pdf doesn't render box-shadow, so the implied
              // depth comes from the rim of pack-mood background visible
              // around the polaroid against the page background.
            }}
          >
            {imageDataUri ? (
              <Image
                src={imageDataUri}
                style={{
                  width: 226,
                  height: 226,
                  objectFit: "cover",
                }}
              />
            ) : (
              // Empty placeholder if image asset is missing — keeps the
              // layout intact during local dev when the PNG hasn't been
              // generated yet. Production builds always have the image.
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

          {/* Right column: greeting · story · signoff */}
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

        {/* BOTTOM STRIP — Avatar (small, round, the human anchor) +
            handwritten signature on the right. Echoes how a real
            cookbook intro page closes off. */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
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
                style={{
                  fontSize: 8.5,
                  color: t.inkSoft,
                  marginTop: 1,
                }}
              >
                {brand.handle}
              </Text>
            </View>
          </View>
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
        </View>
      </View>
    </Page>
  );
}
