import { Document, Page, View, Text, Image } from "@react-pdf/renderer";
import type { Brand } from "@/lib/brands";
import type { Pack, StoryPage } from "@/lib/packs";
import type { Recipe } from "@/lib/recipes";
import type { PackForewordContent } from "@/lib/ai/generate-foreword";
import { extractForewordParts } from "@/lib/foreword-adapter";
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
  storyImageDataUris,
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
  // Premium-Buch-Modus: drei Rahmen-Seiten (Cover/Vorwort/Schluss) rendern im
  // Premium-Layout statt der Standard-Seiten. Nur fuer Packs mit gesetztem
  // premiumBook — alle anderen unveraendert.
  const premium = pack.premiumBook ?? null;

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
  // Mahlzeitengröße-Modus: aktiv wenn die Rezepte mealSize tragen (vom
  // render-book --group-by-size gesetzt). Dann verschmolzenes Makro-Index
  // vorne + keine separate Nährwert-Seite hinten.
  const sizeGrouped = recipes.some((r) => Boolean(r.mealSize));

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
      {/* PAGE 1 — COVER (Premium-Scrim-Cover oder Standard-CoverPage) */}
      {premium ? (
        <PremiumCoverPage
          brand={brand}
          pack={pack}
          coverDataUri={coverDataUri}
          recipeCount={recipes.length}
          premium={premium}
        />
      ) : (
        <CoverPage
          brand={brand}
          pack={pack}
          coverDataUri={coverDataUri}
          recipes={recipes}
          titleFont={titleFont}
        />
      )}

      {/* PAGE 2 — FOREWORD (User-Korrektur 2026-05-24: Vorwort gehoert
          REIN, nicht das was der User vorher als 'Vorwort' kritisiert
          hatte. Das war die alte CoverPage mit Text-Overlay. ForewordPage
          ist das richtige Vorwort mit greeting/story/signoff und sollte
          wieder gerendert werden wenn pack.foreword vorhanden ist). */}
      {showForeword && forewordContent ? (
        premium ? (
          <PremiumForewordPage
            brand={brand}
            pack={pack}
            content={forewordContent}
            imageDataUri={forewordImageDataUri ?? null}
            premium={premium}
          />
        ) : (
          <ForewordPage
            brand={brand}
            pack={pack}
            content={forewordContent}
            imageDataUri={forewordImageDataUri ?? null}
            avatarDataUri={avatarDataUri ?? null}
          />
        )
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

      {/* INDEX — bei Mahlzeitengröße-Gruppierung (Biene) das verschmolzene
          Makro-Inhaltsverzeichnis, sonst das klassische. */}
      {sizeGrouped ? (
        <MacroIndexPage
          brand={brand}
          pack={pack}
          recipes={recipes}
          recipePageNumbers={recipePageNumbers}
        />
      ) : (
        <IndexPage
          brand={brand}
          pack={pack}
          recipes={recipes}
          showForeword={showForeword}
          recipePageNumbers={recipePageNumbers}
        />
      )}

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

      {/* NUTRITION OVERVIEW — entfällt bei sizeGrouped, da Makros bereits
          vorne im verschmolzenen Inhaltsverzeichnis stehen (Creatorin-Wunsch). */}
      {sizeGrouped ? null : (
        <NutritionOverviewPage brand={brand} pack={pack} recipes={recipes} />
      )}

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

      {/* OUTRO — Premium-Schluss-Seite oder Standard-Outro */}
      {premium ? (
        <PremiumOutroPage
          brand={brand}
          pack={pack}
          content={forewordContent ?? null}
          outroImageDataUri={outroImageDataUri ?? null}
        />
      ) : (
        <OutroPage
          brand={brand}
          pack={pack}
          titleFont={titleFont}
          outroImageDataUri={outroImageDataUri ?? null}
        />
      )}
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

  // ─── Creator-Cover (v10, Mai 2026): Pure Image (Gemini 3 Pro Image) ──────
  // v3-v7: Text im Bild via Gemini 2.5 Flash Image (Nano Banana) — Text
  //        oft mit deutschen Rechtschreibfehlern + broken Umlauts.
  // v8-v9: Bild text-frei + react-pdf Overlay — Text perfekt, aber
  //        Composition zu simpel, User wollte verspieltes Cookbook-Cover-
  //        Design mit Badges, Brushstrokes, mehrfarbigem Title.
  // v10:   Modell-Switch auf gemini-3-pro-image-preview (Nano Banana Pro)
  //        mit komplettem Cover-Design-Prompt (Title + Subtitle + Badge +
  //        Bottom-Strip + Decoration). Pro Image hat best-in-class
  //        typography rendering — German Umlauts sollten endlich klappen.
  //        CoverPage ist wieder pure full-bleed image.
  if (hasCover && pack.coverStyle === "creator") {
    return (
      <Page
        size="A4"
        style={{ backgroundColor: t.ink, fontFamily: "Inter" }}
      >
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

// ═════════════════════════════════════════════════════════════════════════════
// PREMIUM-BUCH-SEITEN (Auslieferungs-Qualität, pack.premiumBook)
// ═════════════════════════════════════════════════════════════════════════════
// Exakter Port der drei Rahmen-Seiten aus scripts/perfektion/render-premium.tsx
// (mit dem die finalen Auslieferungs-PDFs gebaut wurden) in die Web-Pipeline.
// Damit ergibt der Web-Download dasselbe Buch wie der lokale Premium-Workflow:
// full-bleed HD-Bild mit eingebranntem Scrim + Vektor-Text-Overlay (Cover/
// Schluss) bzw. Bild-Banner oben + Textblock auf hellem Rose (Vorwort).
//
// Palette kommt aus packTheme(pack) — ink/inkSoft/accent stimmen mit der
// finalen Premium-Config ueberein (Biene-Rose). Der Scrim ist ins Cover-/
// Outro-Bild gebrannt (scripts/perfektion/add-scrim.mjs), daher kein
// Overlay-Block noetig und dunkler ink-Text bleibt lesbar. Nur aktiv wenn
// pack.premiumBook gesetzt ist — alle anderen Packs rendern unveraendert ueber
// CoverPage/ForewordPage/OutroPage.

// ─── PREMIUM COVER: Full-bleed Scrim-Bild + Text-Overlay unten ───
function PremiumCoverPage({
  brand,
  pack,
  coverDataUri,
  recipeCount,
  premium,
}: {
  brand: Brand;
  pack: Pack;
  coverDataUri: string | null;
  recipeCount: number;
  premium: NonNullable<Pack["premiumBook"]>;
}) {
  const t = packTheme(pack);
  const kicker = premium.coverKicker ?? "Meine Lieblingsrezepte";
  const subtitle = premium.coverSubtitle ?? pack.subtitle;
  const footer = `${brand.handle} · ${recipeCount} Rezepte`;
  return (
    <Page
      size="A4"
      style={{ position: "relative", backgroundColor: t.ink, fontFamily: "Inter" }}
    >
      {coverDataUri ? (
        <Image
          src={coverDataUri}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            // Explizite 595x840pt (NICHT "100%"/841.89): react-pdf wirft sonst
            // eine leere "Geister-Seite" hinter dem Bild, weil das Vollhoehen-
            // Bild als nicht-umbrechbar + groesser-als-Seite gewertet wird.
            // 2pt Sicherheitsmarge zur A4-Hoehe verhindert den Page-Break
            // (identisch zu scripts/perfektion/render-premium.tsx).
            width: 595,
            height: 840,
            objectFit: "cover",
          }}
        />
      ) : null}
      {/* Scrim ist ins Bild gebrannt → kein Overlay-Block. Text-Overlay unten. */}
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
            fontFamily: "Inter",
            fontWeight: 700,
            fontSize: 11,
            letterSpacing: 3,
            color: t.ink,
            marginBottom: 14,
            textTransform: "uppercase",
          }}
        >
          {kicker}
        </Text>
        <Text
          style={{
            fontFamily: "Fraunces",
            fontWeight: 700,
            fontSize: 56,
            lineHeight: 0.98,
            letterSpacing: -0.8,
            color: t.ink,
            maxWidth: 470,
          }}
        >
          {pack.title}
        </Text>
        {subtitle ? (
          <Text
            style={{
              fontFamily: "Fraunces",
              fontStyle: "italic",
              fontSize: 15,
              lineHeight: 1.4,
              color: t.inkSoft,
              marginTop: 16,
              maxWidth: 430,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
        <Text
          style={{
            fontFamily: "Inter",
            fontWeight: 500,
            fontSize: 10,
            letterSpacing: 2,
            color: t.inkSoft,
            marginTop: 22,
            textTransform: "uppercase",
          }}
        >
          {footer}
        </Text>
      </View>
    </Page>
  );
}

// ─── PREMIUM VORWORT: Bild-Banner oben (Crop) + Textblock unten ───
function PremiumForewordPage({
  brand,
  pack,
  content,
  imageDataUri,
  premium,
}: {
  brand: Brand;
  pack: Pack;
  content: PackForewordContent;
  imageDataUri: string | null;
  premium: NonNullable<Pack["premiumBook"]>;
}) {
  const t = packTheme(pack);
  const bg = premium.paperBg ?? t.bg;
  const bannerH = 384;
  // greeting + getrennte Absaetze + Pullquote + signoff aus blocks (v3) ODER
  // Legacy-story (v2) ziehen — extractForewordParts erhaelt die Absatz-
  // Struktur und den Pullquote, die der Legacy-Extractor flachklopfen wuerde.
  const { greeting, paragraphs, pullquote, signoff } =
    extractForewordParts(content);
  const signature = brand.signature;
  return (
    <Page
      size="A4"
      style={{ position: "relative", backgroundColor: bg, fontFamily: "Inter" }}
    >
      {imageDataUri ? (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: bannerH,
            overflow: "hidden",
          }}
        >
          <Image
            src={imageDataUri}
            style={{
              width: 595,
              height: 797,
              objectFit: "cover",
              objectPosition: "center 32%",
            }}
          />
        </View>
      ) : null}
      <View
        style={{
          position: "absolute",
          top: imageDataUri ? bannerH : 56,
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: 56,
          paddingTop: 38,
        }}
      >
        <Text
          style={{
            fontFamily: "Inter",
            fontWeight: 600,
            fontSize: 10,
            letterSpacing: 3,
            color: t.accent,
            textTransform: "uppercase",
            marginBottom: 16,
          }}
        >
          Vorwort
        </Text>
        {greeting ? (
          <Text
            style={{
              fontFamily: "Fraunces",
              fontWeight: 600,
              fontStyle: "italic",
              fontSize: 25,
              lineHeight: 1.18,
              color: t.ink,
              maxWidth: 430,
              marginBottom: 20,
            }}
          >
            {greeting}
          </Text>
        ) : null}
        {paragraphs.map((para, i) => (
          <Text
            key={i}
            style={{
              fontFamily: "Inter",
              fontWeight: 400,
              fontSize: 11.5,
              lineHeight: 1.62,
              color: t.inkSoft,
              marginBottom: 14,
              maxWidth: 452,
            }}
          >
            {para}
          </Text>
        ))}
        {pullquote ? (
          <View
            style={{
              borderLeftWidth: 2,
              borderLeftColor: t.accent,
              paddingLeft: 16,
              marginTop: 6,
              marginBottom: 18,
            }}
          >
            <Text
              style={{
                fontFamily: "Fraunces",
                fontStyle: "italic",
                fontSize: 14.5,
                lineHeight: 1.4,
                color: t.ink,
                maxWidth: 420,
              }}
            >
              {pullquote}
            </Text>
          </View>
        ) : null}
        {signoff ? (
          <Text
            style={{
              fontFamily: "Inter",
              fontWeight: 400,
              fontSize: 11.5,
              lineHeight: 1.6,
              color: t.inkSoft,
              marginBottom: 4,
            }}
          >
            {signoff}
          </Text>
        ) : null}
        {signature ? (
          <Text
            style={{
              fontFamily: "Fraunces",
              fontStyle: "italic",
              fontSize: 18,
              color: t.ink,
              marginTop: 10,
            }}
          >
            {signature}
          </Text>
        ) : null}
      </View>
    </Page>
  );
}

// ─── PREMIUM SCHLUSS: Full-bleed Scrim-Bild + zentrierter Text-Overlay ───
function PremiumOutroPage({
  brand,
  pack,
  content,
  outroImageDataUri,
}: {
  brand: Brand;
  pack: Pack;
  content: PackForewordContent | null;
  outroImageDataUri: string | null;
}) {
  const t = packTheme(pack);
  const title = brand.signature;
  const body = content?.outro?.trim() || DEFAULT_OUTRO;
  const footer = `${brand.handle} · ${pack.title}`;
  return (
    <Page
      size="A4"
      style={{ position: "relative", backgroundColor: t.ink, fontFamily: "Inter" }}
    >
      {outroImageDataUri ? (
        <Image
          src={outroImageDataUri}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            // Explizite 595x840pt gegen die leere Geister-Seite (siehe
            // PremiumCoverPage). Vollhoehen-Bild als "100%" triggert den
            // Page-Break sonst auch hier.
            width: 595,
            height: 840,
            objectFit: "cover",
          }}
        />
      ) : null}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: 52,
          paddingBottom: 58,
          alignItems: "center",
        }}
      >
        <Text
          style={{
            fontFamily: "Fraunces",
            fontWeight: 700,
            fontStyle: "italic",
            fontSize: 40,
            color: t.ink,
            marginBottom: 18,
            textAlign: "center",
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontFamily: "Inter",
            fontWeight: 400,
            fontSize: 12,
            lineHeight: 1.62,
            color: t.inkSoft,
            textAlign: "center",
            maxWidth: 400,
            marginBottom: 22,
          }}
        >
          {body}
        </Text>
        <Text
          style={{
            fontFamily: "Inter",
            fontWeight: 600,
            fontSize: 10,
            letterSpacing: 2,
            color: t.accent,
            textTransform: "uppercase",
          }}
        >
          {footer}
        </Text>
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
// Verschmolzenes Inhaltsverzeichnis + Nährwert-Übersicht, nach Mahlzeiten-
// größe gruppiert (Biene-Wunsch der Creatorin via Ingo): "Die Übersicht mit
// Makros nach vorne als Inhaltsverzeichnis ziehen." Ersetzt sowohl die alte
// IndexPage als auch die hintere NutritionOverviewPage in EINER Seite vorne.
// Gruppen-Sektionen "Kleine Mahlzeiten" / "Große Mahlzeiten", pro Rezept
// Makros + Seitenzahl. Aktiv nur wenn recipes mealSize tragen.
function MacroIndexPage({
  brand,
  pack,
  recipes,
  recipePageNumbers,
}: {
  brand: Brand;
  pack: Pack;
  recipes: Recipe[];
  recipePageNumbers: number[];
}) {
  const t = packTheme(pack);
  // Reihenfolge-erhaltende Gruppierung (recipes sind schon klein→groß sortiert)
  const groups: Array<{ label: string; items: { r: Recipe; idx: number }[] }> = [];
  recipes.forEach((r, idx) => {
    const label = r.mealSize === "gross" ? "Große Mahlzeiten" : "Kleine Mahlzeiten";
    let g = groups.find((x) => x.label === label);
    if (!g) { g = { label, items: [] }; groups.push(g); }
    g.items.push({ r, idx });
  });
  const col = { kcal: 42, ew: 38, kh: 38, fat: 34, page: 30 };
  return (
    <Page size="A4" style={{ backgroundColor: "#ffffff", fontFamily: "Inter", color: t.ink }}>
      <View style={{ backgroundColor: t.paper, borderBottomWidth: 1, borderBottomColor: t.divider, paddingHorizontal: 40, paddingTop: 28, paddingBottom: 18 }}>
        <Text style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1.6, color: t.inkSoft, textTransform: "uppercase" }}>
          Inhalt & Nährwerte · {recipes.length} Rezepte
        </Text>
        <Text style={{ fontFamily: "Fraunces", fontSize: 28, color: t.ink, marginTop: 4, letterSpacing: -0.3 }}>
          {pack.title}
        </Text>
      </View>
      <View style={{ paddingHorizontal: 40, paddingTop: 16, paddingBottom: 24 }}>
        {/* Spalten-Kopf */}
        <View style={{ flexDirection: "row", alignItems: "flex-end", paddingBottom: 5, paddingHorizontal: 4 }}>
          <Text style={{ flex: 1, fontSize: 7, fontWeight: 600, letterSpacing: 1, color: t.inkSoft, textTransform: "uppercase" }}>Rezept</Text>
          <Text style={{ width: col.kcal, fontSize: 7, fontWeight: 600, letterSpacing: 0.8, color: t.inkSoft, textAlign: "right", textTransform: "uppercase" }}>kcal</Text>
          <Text style={{ width: col.ew, fontSize: 7, fontWeight: 600, letterSpacing: 0.8, color: t.inkSoft, textAlign: "right", textTransform: "uppercase" }}>EW</Text>
          <Text style={{ width: col.kh, fontSize: 7, fontWeight: 600, letterSpacing: 0.8, color: t.inkSoft, textAlign: "right", textTransform: "uppercase" }}>KH</Text>
          <Text style={{ width: col.fat, fontSize: 7, fontWeight: 600, letterSpacing: 0.8, color: t.inkSoft, textAlign: "right", textTransform: "uppercase" }}>Fett</Text>
          <Text style={{ width: col.page, fontSize: 7, fontWeight: 600, letterSpacing: 0.8, color: t.inkSoft, textAlign: "right", textTransform: "uppercase" }}>S.</Text>
        </View>
        {groups.map((g, gi) => (
          <View key={g.label} style={{ marginTop: gi === 0 ? 4 : 14 }}>
            {/* Gruppen-Header */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <View style={{ width: 5, height: 5, backgroundColor: t.accent, transform: "rotate(45deg)" }} />
              <Text style={{ fontFamily: "Fraunces", fontSize: 13, fontWeight: 600, color: t.ink }}>{g.label}</Text>
              <View style={{ flex: 1, height: 0.8, backgroundColor: t.divider }} />
              <Text style={{ fontSize: 7.5, color: t.inkSoft }}>{g.items.length} Rezepte</Text>
            </View>
            {g.items.map(({ r, idx }, j) => (
              <View key={r.slug} style={{ flexDirection: "row", alignItems: "center", borderBottomWidth: j < g.items.length - 1 ? 0.5 : 0, borderBottomColor: t.divider, paddingVertical: 6.5, paddingHorizontal: 4 }}>
                <Text style={{ fontFamily: "Fraunces", fontSize: 11, color: t.accent, width: 22 }}>{pad2(r.number)}</Text>
                <Text style={{ flex: 1, fontSize: 10.5, fontWeight: 500, color: t.ink }}>{r.title}</Text>
                <Text style={{ width: col.kcal, fontFamily: "Fraunces", fontSize: 10.5, color: t.ink, textAlign: "right" }}>{r.nutrition.kcal}</Text>
                <Text style={{ width: col.ew, fontSize: 9.5, color: t.inkSoft, textAlign: "right" }}>{r.nutrition.protein} g</Text>
                <Text style={{ width: col.kh, fontSize: 9.5, color: t.inkSoft, textAlign: "right" }}>{r.nutrition.carbs} g</Text>
                <Text style={{ width: col.fat, fontSize: 9.5, color: t.inkSoft, textAlign: "right" }}>{r.nutrition.fat} g</Text>
                <Text style={{ width: col.page, fontSize: 9, fontWeight: 600, color: t.inkSoft, textAlign: "right" }}>{recipePageNumbers[idx] ?? ""}</Text>
              </View>
            ))}
          </View>
        ))}
        <Text style={{ fontSize: 8.5, color: t.inkSoft, marginTop: 16, lineHeight: 1.5, fontStyle: "italic" }}>
          Alle Werte gelten pro Portion bzw. pro Stück und sind Richtwerte.
          Je nach den Produkten, die du verwendest, können sie leicht abweichen.
        </Text>
      </View>
    </Page>
  );
}

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
              // Jede zweite 5er-Gruppe (also die Mitte: Rezept 6-10, bei mehr
              // Rezepten auch 16-20 etc.) zart pink hinterlegen — hebt die
              // Gruppe zusaetzlich zu den Trennern ab.
              const tinted = Math.floor(i / 5) % 2 === 1;
              const groupBg = tinted ? blendWithWhite(t.bg, 0.72) : "transparent";
              const isGroupStart = i % 5 === 0;
              const isGroupEnd = i % 5 === 4 || i === recipes.length - 1;
              return (
              <View key={r.slug}>
              {showSep ? <GroupSeparator theme={t} marginV={rowPadV - 1} /> : null}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: groupBg,
                  borderTopLeftRadius: tinted && isGroupStart ? 7 : 0,
                  borderTopRightRadius: tinted && isGroupStart ? 7 : 0,
                  borderBottomLeftRadius: tinted && isGroupEnd ? 7 : 0,
                  borderBottomRightRadius: tinted && isGroupEnd ? 7 : 0,
                  borderBottomWidth: showRowLine ? 0.5 : 0,
                  borderBottomColor: t.divider,
                  paddingVertical: rowPadV,
                  paddingHorizontal: 12,
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
        {/* Durchschnitts-Zeile hier entfernt — stand doppelt: identische
            Info ("Ø pro Rezept") schon als letzte Tabellenzeile unten. */}
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
          const tinted = Math.floor(i / 5) % 2 === 1;
          const groupBg = tinted ? blendWithWhite(t.bg, 0.72) : "transparent";
          const isGroupStart = i % 5 === 0;
          const isGroupEnd = i % 5 === 4 || i === recipes.length - 1;
          return (
          <View key={r.slug}>
          {showSep ? <GroupSeparator theme={t} marginV={5} /> : null}
          <View
            style={{
              flexDirection: "row",
              backgroundColor: groupBg,
              borderTopLeftRadius: tinted && isGroupStart ? 7 : 0,
              borderTopRightRadius: tinted && isGroupStart ? 7 : 0,
              borderBottomLeftRadius: tinted && isGroupEnd ? 7 : 0,
              borderBottomRightRadius: tinted && isGroupEnd ? 7 : 0,
              borderBottomWidth: showRowLine ? 0.5 : 0,
              borderBottomColor: t.divider,
              paddingVertical: 8,
              paddingHorizontal: 12,
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

        {/* Durchschnitt pro Rezept statt Pack-Summe (Leon: "Pack-Total
            macht keinen Sinn, niemand isst alles auf einmal"). Der Schnitt
            je Rezept ist die sinnvolle Kennzahl zum Abschluss der Tabelle. */}
        <View
          style={{
            flexDirection: "row",
            backgroundColor: blendWithWhite(t.bg, 0.45),
            paddingVertical: 10,
            paddingHorizontal: 12,
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
            Ø pro Rezept
          </Text>
          <Text style={{ width: 48, fontSize: 10, fontWeight: 700, color: t.ink, textAlign: "right" }}>
            {avg.kcal}
          </Text>
          <Text style={{ width: 60, fontSize: 10, fontWeight: 700, color: t.ink, textAlign: "right" }}>
            {avg.protein} g
          </Text>
          <Text style={{ width: 60, fontSize: 10, fontWeight: 700, color: t.ink, textAlign: "right" }}>
            {avg.carbs} g
          </Text>
          <Text style={{ width: 48, fontSize: 10, fontWeight: 700, color: t.ink, textAlign: "right" }}>
            {avg.fat} g
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
          Alle Werte gelten pro Portion bzw. pro Stück und sind Richtwerte.
          Je nach den Produkten, die du verwendest, können sie leicht
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
