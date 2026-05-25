import { Page, View, Text, Image } from "@react-pdf/renderer";
import type { Brand } from "@/lib/brands";
import type { Pack, StoryPage } from "@/lib/packs";
import { packTheme, fontFamilyForPack, blendWithWhite } from "./theme";
import { restoreGermanUmlauts } from "@/lib/restore-umlauts";

// Story-Page-PDF (Guide-Modus). Ganze A4-Seite pro Story-Eintrag, sitzt
// zwischen Vorwort und Inhaltsverzeichnis. Pro Page: grosses Hero-Bild
// (optional, wenn imageDataUri null → themed Background-Block) + Title
// + Body als Fliesstext.
//
// Inkrement 1: Ein generischer "magazine-editorial"-Look — Bild oben
// (45% der Seite), Text-Block unten mit Fraunces-Title + Inter-Body.
// Themed via packTheme. Pack-cardLayout-spezifische Varianten koennen
// spaeter dazukommen, falls nuetzlich.

export type StoryPagePdfProps = {
  brand: Brand;
  pack: Pack;
  story: StoryPage;
  /** Pre-loaded image data URI. Null → themed Placeholder-Block.
   *  Convention wie heroDataUris in pack-pdf.tsx. */
  imageDataUri: string | null;
  /** 1-indexed Position der Page innerhalb der Story-Pages-Liste. */
  positionIndex: number;
  totalStories: number;
};

export function StoryPagePdf({
  brand,
  pack,
  story,
  imageDataUri,
  positionIndex,
  totalStories,
}: StoryPagePdfProps) {
  const t = packTheme(pack);
  const titleFont = fontFamilyForPack(pack);

  // Umlaut-Restore als letzte Defense gegen alte Records ohne Korrektur.
  const safeTitle = restoreGermanUmlauts(story.title ?? "");
  const safeBody = restoreGermanUmlauts(story.body ?? "");

  // Body in Absaetze splitten (Generator schreibt "\n\n"-getrennte Absaetze).
  const paragraphs = safeBody
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  return (
    <Page
      size="A4"
      style={{ backgroundColor: t.bg, fontFamily: "Inter", color: t.ink }}
    >
      <View style={{ flex: 1, flexDirection: "column" }}>
        {/* ── HERO: 45% der Seite ─────────────────────────────────────── */}
        <View
          style={{
            width: "100%",
            height: "45%",
            backgroundColor: blendWithWhite(t.bg, 0.55),
            position: "relative",
          }}
        >
          {imageDataUri ? (
            <Image
              src={imageDataUri}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            // Placeholder-Block in Pack-Mood-Farbe. Zeigt Eyebrow auch ohne
            // Bild, damit die Seite nicht leer wirkt.
            <View
              style={{
                width: "100%",
                height: "100%",
                backgroundColor: blendWithWhite(t.accent, 0.7),
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontFamily: "Fraunces",
                  fontStyle: "italic",
                  fontSize: 56,
                  color: blendWithWhite(t.accent, 0.3),
                }}
              >
                {pack.title.charAt(0)}
              </Text>
            </View>
          )}

          {/* Eyebrow oben links auf dem Bild — "Story · 01 von 03" */}
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
                color: imageDataUri ? "#ffffff" : t.inkSoft,
                textTransform: "uppercase",
              }}
            >
              Story · {String(positionIndex).padStart(2, "0")} von{" "}
              {String(totalStories).padStart(2, "0")}
            </Text>
            <Text
              style={{
                fontSize: 8.5,
                fontWeight: 600,
                letterSpacing: 1.4,
                color: imageDataUri ? "#ffffff" : t.inkSoft,
                textTransform: "uppercase",
              }}
            >
              {pack.title}
            </Text>
          </View>
        </View>

        {/* ── BODY-AREA: 55% der Seite ────────────────────────────────── */}
        <View
          style={{
            flex: 1,
            paddingHorizontal: 56,
            paddingTop: 36,
            paddingBottom: 40,
            flexDirection: "column",
            justifyContent: "flex-start",
            gap: 18,
          }}
        >
          {/* TITLE als Display */}
          <Text
            style={{
              fontFamily: titleFont,
              fontStyle: titleFont === "Fraunces" ? "italic" : "normal",
              fontSize: 30,
              fontWeight: titleFont === "Inter" ? 700 : 400,
              lineHeight: 1.1,
              color: t.ink,
              letterSpacing: -0.4,
            }}
          >
            {safeTitle}
          </Text>

          {/* Accent-Bar als visueller Anker zwischen Title und Body */}
          <View
            style={{
              width: 40,
              height: 2,
              backgroundColor: t.accent,
            }}
          />

          {/* BODY-Paragraphs — jeweils <Text> mit marginTop fuer
              klare Absatztrennung. */}
          {paragraphs.map((p, i) => (
            <Text
              key={i}
              style={{
                fontFamily: "Inter",
                fontSize: 11.5,
                lineHeight: 1.65,
                color: t.ink,
                marginTop: i === 0 ? 0 : 4,
                maxWidth: 480,
              }}
            >
              {p}
            </Text>
          ))}
        </View>
      </View>
    </Page>
  );
}
