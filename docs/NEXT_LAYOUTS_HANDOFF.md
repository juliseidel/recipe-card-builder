# Layout-Builder Handoff — die nächsten 8 Layouts

**Status:** Vinyl + Newspaper sind fertig (2/10). Diese Datei ist dein vollständiger Startpunkt für die verbleibenden 8 Layouts. Sie ist so geschrieben, dass du sofort produktiv bist ohne zurückscrollen zu müssen.

> **Eiserne Regel:** Jedes neue Layout MUSS von Anfang an alle Anti-Patterns aus [`docs/LAYOUT_RULES.md`](LAYOUT_RULES.md) einhalten. Wir haben in 30+ Iterations die Lessons hart erarbeitet — kein neues Layout darf das wiederholen.

---

## Bereits fertig

| # | Codename | Mikros-Position | Schrift |
|---|---|---|---|
| 1 | **Vinyl** | Audio-Spec-Strip oben unter Title | Fraunces (Italic-Center-Label) |
| 2 | **Newspaper Broadsheet** | Spreadsheet-Footer-Row mit Doppellinie | Fraunces Italic Headline + Inter Eyebrow |

**Beide sind deine besten Code-Vorlagen.** Schau dir den Pattern in [`lib/pdf/recipe-card-pdf.tsx`](../lib/pdf/recipe-card-pdf.tsx) (suche `function VinylPage` / `function NewspaperPage`) und [`components/recipe-card-full.tsx`](../components/recipe-card-full.tsx) an. Die Struktur ist dort identisch — du kannst sie kopieren und das visuelle Konzept ersetzen.

---

## Die 8 verbleibenden Layouts (in empfohlener Reihenfolge)

### 3. **Constellation Map** — Sternkarten-Look 🌌

| Aspekt | Detail |
|---|---|
| **Konzept** | Dark-Sky-Astronomie. Zutaten als Sterne mit Verbindungslinien zur Konstellation, Schritte als chronologische Stationen entlang einer Trajectory-Linie. |
| **Hintergrund** | Sehr dunkles Marineblau `#0a0e1f` oder near-black `#0d0d18`. Weiße/cream Sterne + Akzent-Farbe als Constellation-Lines. |
| **Hero-Bild** | Rund clipped, mit subtilem Glow-Halo. Sitzt links oben oder mittig oben. Kleiner als bei Vinyl. |
| **Mikronährstoffe-Position** | **Als Planeten-Symbole am rechten Rand** (kleine farbige Kreise mit %-Innenring, vertikal gestapelt). Jeder Mikronutrient ist ein Planet mit Name + % daneben. |
| **Schrift** | Fraunces für Title (italic, weiß), Inter für Body (light, weiß mit reduzierter Opacity). Tracking-wide für UPPERCASE-Labels. |
| **Best für** | Premium-Mealprep-Packs, Show-Off-Sammlungen, alles wo Dark-Mode pop machen soll. |
| **Tracking-Anker** | Schritte mit "01 ─── 02 ─── 03" als Trajectory-Pfeil. Zutaten als Sterne `✦` mit Connection-Lines (Svg `<line>`). |

### 4. **Restaurant Menu** — Fine-Dining-Speisekarte 🍷

| Aspekt | Detail |
|---|---|
| **Konzept** | Elegante Restaurant-Speisekarte. Dot-Leader zwischen Zutat und Menge (klassisches Menu-Pattern). Gold-Accent. |
| **Hintergrund** | Sehr helles Cream `#fcf9f3` oder pale Stone `#f5f1e8`. Gold-Akzent (`#b08842`) für Highlights. |
| **Hero-Bild** | Quadratisch, eingerahmt mit dünner Gold-Border. Sitzt zentriert oben. |
| **Mikronährstoffe-Position** | **Italic "Wine Notes"-Block unten** ("Reich an Vitamin C, Calcium, Eisen — wie ein leichter Sommerwein, frisch und fokussiert."). Beschreibungs-Stil statt Tabelle. |
| **Schrift** | Cormorant Garamond für Display (italic, premium-serif). Wenn nicht ladbar: Fraunces Italic mit `letterSpacing: 0.5`. |
| **Best für** | Date-Night-Packs, festliche Dinners, Premium-Hauptmahlzeiten, edle Desserts. |
| **Tracking-Anker** | Dot-Leader-Pattern `....................` zwischen Zutaten-Name und Menge. Steps mit Roman-Numerals (I, II, III, IV...). |

### 5. **Apothecary Card** — Apotheker-Stempel-Style 💊

| Aspekt | Detail |
|---|---|
| **Konzept** | Apothekenkarte aus den 1920ern. Schreibmaschine + handschriftliche Etiketten. Cork-Brown auf Cream-Background. |
| **Hintergrund** | Warmer Cream `#f5ecd9` mit subtilem Paper-Texture-Feeling. |
| **Hero-Bild** | In ovaler oder rechteckiger Etiketten-Form mit "Stempel"-Border (gestrichelte Linie). |
| **Mikronährstoffe-Position** | **Als handgeschriebene Etiketten links unten** mit Faden-Anker (kleine ASCII-Schnur `╳━━━━`). "ZINK 18%" / "EISEN 22%" als gestempelte Marken. |
| **Schrift** | Schreibmaschine-Look: monospace (Iosevka oder Inter Mono) für Stempel-Text. Fraunces Italic für Recipe-Title. |
| **Best für** | High-Protein-Packs (Pharmacy/Wellness-Aesthetik), Heilkräuter, "alte Rezepte"-Packs. |
| **Tracking-Anker** | Etikette-Border-Style. Recipe-Title als "Rx Nr. 02 — RECIPE-NAME". Steps als nummerierte "Indikation"-Anweisungen. |

### 6. **Manga Panel** — Comic-Panel-Style 💥

| Aspekt | Detail |
|---|---|
| **Konzept** | Japanischer Manga-Look. Dynamische Panel-Borders, Speech-Bubbles für Schritte. Hero als Splash-Panel. |
| **Hintergrund** | Reines Weiß `#fdfdfb` mit schwarzen Tinten-Borders. Akzent-Farbe nur als Halftone-Pattern für Highlights. |
| **Hero-Bild** | Großer Splash-Panel oben mit diagonalen Action-Lines drumherum (Svg). Wirkt wie Comic-Cover. |
| **Mikronährstoffe-Position** | **Als "Power-Stats"-Block unten** im RPG-/Anime-Style. Mikros als horizontale "Skill-Bars" oder Star-Rating-Reihe. |
| **Schrift** | Bebas Neue für Headlines (bold, condensed, ALL-CAPS). Wenn nicht verfügbar: Inter mit `fontWeight: 900`. Caveat-Style für Speech-Bubble-Text → Fraunces Italic als Substitute. |
| **Best für** | Sport-/Energy-Packs, Snacks für Gen-Z, alles mit "Pop-Art"-Charakter. |
| **Tracking-Anker** | Steps in echten Speech-Bubble-Containern (Svg-Path mit Tail). Action-Lines zwischen Panels. |

### 7. **Bauhaus Constructivist** — El-Lissitzky-Geometrie 🔴🔵🟡

| Aspekt | Detail |
|---|---|
| **Konzept** | Russisches Avantgarde + Bauhaus. Diagonale rote Linien, Primary-Color-Blöcke (Rot/Blau/Gelb), strikte geometrische Komposition. |
| **Hintergrund** | Off-White `#f5f0e6`. Primary-Color-Blöcke als Akzent-Elemente (große rote Diagonale, gelber Kreis, blaues Rechteck). |
| **Hero-Bild** | In ein perfektes Quadrat oder Kreis gemasked, asymmetrisch platziert (z.B. links unten, mit rotem Quadrat überlappend). |
| **Mikronährstoffe-Position** | **Geometrische Charts (eines pro Mikro)** — Dreieck für eines, Quadrat für eines, Kreis für eines. Größen proportional zu %-EU-Bedarf. Bauhaus-typische Komposition. |
| **Schrift** | Futura Bold für Display (geometric sans). Fallback: Inter Tight mit `fontWeight: 800`. Roboto Slab für Body als Kontrast. |
| **Best für** | Mealprep-Packs (strukturiert), Editorial-Premium, Designer-affinity-Packs. |
| **Tracking-Anker** | Diagonal-Linien als Compositional-Anchors. Recipe-Title in DIN-ähnlicher Bold-Geometric. |

### 8. **Subway Map** — U-Bahn-Plan 🚇

| Aspekt | Detail |
|---|---|
| **Konzept** | Massimo Vignelli's NYC-Subway-Style. Steps als Stationen entlang einer Line, Zutaten als Connecting-Stations. |
| **Hintergrund** | Reines Weiß `#ffffff`. Pack-Mood-Akzent als Line-Color (rot, blau, grün, je nach Mood). |
| **Hero-Bild** | Rund clipped, sitzt als "Terminal-Station" am Anfang oder Ende der Line. |
| **Mikronährstoffe-Position** | **Als Legend-Box unten links** mit Symbol-Erklärung (wie U-Bahn-Plan-Legenden). Mikros als horizontale Bars mit Station-Markern. |
| **Schrift** | Helvetica oder Inter (rein geometrisch). Tracking gleichmäßig wide. Recipe-Title sehr klein und sachlich (keine italics, kein decorative). |
| **Best für** | Mealprep-Packs, How-To-Packs, alles wo der "Schritt-für-Schritt"-Charakter im Vordergrund steht. |
| **Tracking-Anker** | Steps als runde Station-Marker (•) entlang einer Line (Svg `<line>`). Zutaten als kleinere Stationen mit "Transfer-Markern". |

### 9. **Botanical Plate** — 19. Jahrhundert Lehrbuch 🌿

| Aspekt | Detail |
|---|---|
| **Konzept** | Botanisches Lehrbuch aus dem 1800er. Zutaten mit lateinischen Namen darunter italic. Cream-Paper-Look. |
| **Hintergrund** | Sehr warmer Cream `#f4ecd8` mit Sepia-Tönen. Akzent in `#7a5530` (Sepia-Braun). |
| **Hero-Bild** | Wie eine botanische Illustration eingerahmt mit Hairline-Border + italic Caption "Plate IV — Pasta al limone". |
| **Mikronährstoffe-Position** | **Als wissenschaftliche Daten-Tabelle** mit lateinischen Namen ("Acidum ascorbicum" für Vitamin C) und Werten in einer kleinen Side-Box rechts. |
| **Schrift** | Cardo für Body (Old-Style Serif). Fallback: Fraunces. Italic-Script für lateinische Namen + Captions. |
| **Best für** | Healthy-Packs, Veggie/Vegan-Packs, alles mit Wellness-/Educational-Charakter. |
| **Tracking-Anker** | Steps als nummerierte römische Ziffern. Zutaten mit Genus/Species-Subline (kann hardcoded sein für common ingredients oder weggelassen). |

### 10. **Cassette Mixtape** — 80er J-Card-Cover 📼

| Aspekt | Detail |
|---|---|
| **Konzept** | Cassette-Tape-Cover wie aus den 80ern. Handgeschriebene Setlist, Pastel-Retro-Colors, "Side A / Side B"-Layout. |
| **Hintergrund** | Pastel Pink/Mint/Apricot je nach Mood. Akzent in komplementärer Farbe. |
| **Hero-Bild** | Quadratisch, ⌐sticker-style mit weißer Border und leichter Drehung (-2°). |
| **Mikronährstoffe-Position** | **Als VU-Meter-Bars** unten (Audio-Track-Levels-Look). Vertikale Bars mit dB-Markern, eine pro Mikro. |
| **Schrift** | Caveat (handgeschrieben) für Setlist → falls nicht ladbar: Fraunces Italic. Inter Bold für Labels. |
| **Best für** | Trendige Packs, Snack-Compilations, "Best of"-Pakete, jüngere Zielgruppe. |
| **Tracking-Anker** | "MIX 02 · MAI 2026" als Cassette-Title. Tracklist mit Time-Markern (z.B. "0:45 — Schritt 1"). VU-Meters als animierbare Bars (im PDF statisch). |

---

## Checklist pro Layout (KEINE Schritte überspringen!)

Beim Bauen eines neuen Layouts gehst du IMMER diese Reihenfolge durch:

### Phase 1 — PDF
1. **CardLayout-Enum erweitern** in [`lib/packs.ts`](../lib/packs.ts) → das neue Layout hinzufügen
2. **`LAYOUTS`-Map** in [`lib/pdf/recipe-card-pdf.tsx`](../lib/pdf/recipe-card-pdf.tsx) → neuen Eintrag
3. **`{NAME}_DENSITY`-Konstante** definieren — 3 Tiers (compact/balanced/spacious). Skaliert ALLE FontSizes/Paddings/Margins.
4. **`{Name}Page`-Funktion** schreiben mit allen Anti-Patterns von Anfang an drin
5. **Sub-Components** für Layout-spezifische Patterns (z.B. `NewspaperIngredientGrid`, `VinylSideColumn`)
6. **TS-Check:** `npx tsc --noEmit` muss clean sein

### Phase 2 — Web (recipe-card-full.tsx)
1. **Switch-Case** im `RecipeCardFull`-Dispatcher
2. **`{Name}Layout`-Komponente** — Web-Mirror der PDF mit Tailwind/CSS
3. **Sub-Components** parallel zur PDF-Version
4. **TS-Check** wieder

### Phase 3 — Foreword
1. **VARIANTS-Map** in [`lib/pdf/foreword-page.tsx`](../lib/pdf/foreword-page.tsx) → neuer Eintrag
2. **Entscheidung:** eigene Foreword-Page bauen ODER eine bestehende reusen?
   - **Eigene** bauen für: Vinyl-artige, Newspaper-artige, klar visuell-andersartige Layouts (Constellation, Apothecary, Manga, Bauhaus, Cassette)
   - **Reuse** für: ähnliche Editorial-Layouts (Restaurant, Botanical, Subway → können EditorialForewordPage reusen)
3. Wenn eigene: am Ende von foreword-page.tsx anhängen, NICHT brand.signature rendern (nur OutroPage)

### Phase 4 — Registry
1. **`layoutPresets`** in [`lib/pack-presets.ts`](../lib/pack-presets.ts) → mit `id`, `title`, `description`, `bestFor`
2. **`LAYOUT_OPTIONS`** in [`lib/ai/suggest-pack-design.ts`](../lib/ai/suggest-pack-design.ts) → KI-Suggestion erweitern
3. **`LayoutThumbnail`-Switch-Case** in [`components/auto-pack-form.tsx`](../components/auto-pack-form.tsx) → SVG-Mini-Vorschau (70×52)
4. **`VALID_LAYOUTS`** in BEIDEN Routes:
   - [`app/api/packs/generate-auto/route.ts`](../app/api/packs/generate-auto/route.ts)
   - [`app/api/pack-suggestions/[id]/accept/route.ts`](../app/api/pack-suggestions/[id]/accept/route.ts)

### Phase 5 — Verify
1. `npx tsc --noEmit` clean
2. Commit mit ausführlicher Beschreibung (siehe Vinyl/Newspaper-Commit-Pattern)
3. `git push origin HEAD:main` → Vercel deployt automatisch
4. User testet, gibt Feedback, dann nächstes Layout

---

## Anti-Patterns (KRITISCH — niemals brechen!)

Siehe [`docs/LAYOUT_RULES.md`](LAYOUT_RULES.md) für die volle Liste. Die wichtigsten beim Layout-Bau:

### §1 Step-Number-Glyph-Centering
Number + Body-Text rendern mit **IDENTISCHEN** `fontFamily` + `fontSize` + `lineHeight`. Nur `fontStyle/fontWeight/color` dürfen unterscheiden. Math-Tricks via `marginTop/paddingTop` funktionieren NICHT.

```tsx
// ✅ KORREKT
<Text style={{ fontSize: 9.5, lineHeight: 1.45, fontStyle: "italic", fontWeight: 700, color: theme.accent, width: 22 }}>
  {step.num}
</Text>
<Text style={{ flex: 1, fontSize: 9.5, lineHeight: 1.45, color: theme.ink }}>
  {step.text}
</Text>
```

### §2 Density-System
3 Tiers: `compact` / `balanced` / `spacious`. Selector: `getDensity(recipe)` aus [`recipe-card-pdf.tsx`](../lib/pdf/recipe-card-pdf.tsx).
- spacious: ≤6 Zutaten ODER ≤4 Schritte
- compact: ≥14 Zutaten ODER ≥8 Schritte
- balanced: dazwischen

ALLE FontSizes, Paddings, Margins skalieren mit Density. Bei spacious darf NICHTS umbrechen.

### §3 Sparse-Detection
Bei `recipe.ingredients.length <= 10` UND `recipe.description?.trim()` → Story-Pull-Quote-Block einfügen. Helper: `shouldShowStory(recipe)`.

### §4 IngredientRow Adaptive bei langem Amount
```tsx
const displayAmount = formatIngredientAmount(amount); // "n.a." → "Nach Geschmack"
const amountIsLong = displayAmount.length > 10;
// alignItems: amountIsLong ? "center" : "flex-start"
```

### §5 "Für" nur bei den/die/das
```tsx
const label = /^(den|die|das)\s/i.test(g.name)
  ? `Für ${g.name.toLowerCase()}`
  : g.name;
```

### §6 Keine Pack-Nummerierung auf der Karte
"Pack 03"-Caption NICHT rendern. Erlaubt: Recipe-Position innerhalb des Packs ("02 / 07") als Navigation.

### §7 Keine brand.signature
NICHT in Web-Layouts, NICHT im Foreword. Nur in OutroPage (PDF).

### §8 Keine Em-Dashes
"—" und "–" sind verboten in KI-Text. `generate-foreword.ts` sanitized das schon, du musst nur darauf achten dass du es nicht hardcodest.

### §15 softWrapTitle für Recipe-Titel
Kompositionsnamen wie "Erdbeer-Kuppeltorte" brauchen `softWrapTitle(recipe.title)` damit sie sauber umbrechen.

### Mikros-Position MUSS einzigartig sein
Jedes Layout hat seine **EIGENE** Mikronährstoffe-Position. Diese sind belegt:
- vinyl: Audio-Spec-Strip oben
- editorial: Banner über Hero
- patisserie: Vertikal in Sidebar
- vital: Pearl-Strip mittig
- amber: Vertikale Bars rechts
- minimal: Capsule-Pills horizontal
- dashboard: Data-Rows mit Icons
- sport: Macro-Bars mit Emojis
- newspaper: Spreadsheet-Footer-Row

Für deine 8 Layouts (vorgeschlagene Positionen aus der Spec oben):
- constellation: Planeten-Symbole rechter Rand
- restaurant-menu: Italic Wine-Notes-Block unten
- apothecary: Handgeschriebene Etiketten mit Faden-Anker
- manga: Power-Stats-Block unten (RPG-Style)
- bauhaus: Geometrische Charts (Dreiecke/Quadrate/Kreise pro Mikro)
- subway: Legend-Box unten links mit Station-Markern
- botanical: Wissenschaftliche Daten-Tabelle in Side-Box
- mixtape: VU-Meter-Bars als Audio-Track-Levels

**Wenn du eine andere Position wählen willst, ist das OK — solange sie sich von ALLEN bisherigen unterscheidet.**

---

## Existing Helper & Tooling

### Helper-Funktionen (IMMER nutzen!)
| Helper | Wo | Wofür |
|---|---|---|
| `formatIngredientAmount(amount)` | `lib/format-ingredient.ts` | "n.a." → "Nach Geschmack", auto-capitalize |
| `softWrapTitle(title)` | in recipe-card-pdf.tsx | Compound-Substantive wrappen sauber |
| `getDensity(recipe)` | in recipe-card-pdf.tsx | Liefert compact/balanced/spacious |
| `shouldShowStory(recipe)` | in recipe-card-pdf.tsx | ≤10 Zutaten + Story vorhanden |
| `groupIngredients(ingredients)` | `lib/pdf/helpers.ts` | Ingredient-Groups parsen |
| `groupSteps(steps)` | `lib/pdf/helpers.ts` | Step-Groups parsen |
| `totalTime(recipe)` | `lib/pdf/helpers.ts` | prepTime + cookTime |
| `nutritionBasisInline(basis)` | `lib/recipes.ts` | "pro Portion", "pro Stück", etc. |
| `pad2(n)` | `lib/pdf/helpers.ts` | "02" statt "2" |
| `restoreGermanUmlauts(text)` | `lib/restore-umlauts.ts` | "fuer" → "für" (für KI-Text) |

### Theme-System
[`lib/pdf/theme.ts`](../lib/pdf/theme.ts) → `packTheme(pack)` liefert:
- `bg`, `surface`, `ink`, `inkSoft`, `inkSubtle`, `accent`, `accentSoft`, `paper`, `divider`

### Pattern-System (Phase B, Pack-Hintergrund)
[`lib/pack-surface.ts`](../lib/pack-surface.ts) → Surface kann sein `solid` / `gradient` / `pattern` (8 Patterns: polka, honeycomb, crosshatch, topo, marble, stripes, grid, confetti). PDF rendert immer als solid (CMYK-Print-sicher), Web mit voller Pracht. **Layouts müssen das nicht extra implementieren** — `packTheme()` returnt schon den richtigen Wert.

### Hero-Image-Pipeline
Recipes haben `recipe.hero` (URL zu Supabase Storage). PDF bekommt `heroDataUri` als Prop (data-URI eines geladenen Buffers). NIE direkt `recipe.hero` im PDF rendern — immer `heroDataUri` nutzen.

### QR-Code
`qrDataUri` ist eine optionale Prop. Wenn gesetzt → im Footer rendern (32×32 mit "Scan / für / Original"-Label). Wenn null → Fallback-Text wie "Erstausgabe" / "Original auf Instagram".

---

## Code-Vorlage (von Vinyl/Newspaper abkopieren)

Wenn du ein neues Layout startest:
1. Kopiere die `VinylPage` ODER `NewspaperPage` aus `recipe-card-pdf.tsx`
2. Rename zu `{Name}Page`
3. Ersetze das visuelle Konzept Schritt für Schritt
4. Behalte: Density-System, Step-Glyph-Lock, IngredientRow-Logic, Sparse-Detection, Footer-mit-QR, alle Anti-Patterns

Der gleiche Pattern gilt für Web (`recipe-card-full.tsx`) — `VinylLayout` oder `NewspaperLayout` als Vorlage.

---

## Wichtige Files in diesem Projekt

| Datei | Zweck |
|---|---|
| `lib/packs.ts` | CardLayout-Enum + Pack-Type |
| `lib/pdf/recipe-card-pdf.tsx` | PDF-Layouts (alle 10) |
| `components/recipe-card-full.tsx` | Web-Layouts (alle 10) |
| `lib/pdf/foreword-page.tsx` | Foreword-Variants pro Layout |
| `lib/pack-presets.ts` | layoutPresets (UI-Picker) |
| `lib/ai/suggest-pack-design.ts` | KI-Suggestions LAYOUT_OPTIONS |
| `components/auto-pack-form.tsx` | LayoutThumbnail SVG-Vorschau |
| `app/api/packs/generate-auto/route.ts` | VALID_LAYOUTS-Whitelist |
| `app/api/pack-suggestions/[id]/accept/route.ts` | VALID_LAYOUTS-Whitelist |
| `docs/LAYOUT_RULES.md` | Anti-Patterns + Glyph-Lock-Spec |
| `lib/format-ingredient.ts` | Amount-Helper |
| `lib/restore-umlauts.ts` | KI-Text-Umlauts-Sanitize |
| `lib/ai/generate-foreword.ts` | Foreword-Text-Pipeline |
| `lib/ai/generate-foreword-collage.ts` | Hero-Collage statt Stillleben |

---

## Foreword-Text-Pipeline (Stand jetzt)

`generatePackForeword(pack, brand, recipeTitles[])` macht:
1. Gemini Flash mit System-Instruction (in korrektem Deutsch geschrieben — Gemini imitiert)
2. Recipe-Titel werden in Prompt mitgegeben — Story erwähnt sie konkret
3. Output durch `restoreGermanUmlauts()` (Wörterbuch-Sanitize: "fuer"→"für")
4. Em-Dashes (—/–) werden zu Komma replaced
5. Max-Length-Cut auf Satzende

**Wenn du ein neues Foreword-Design baust:** NICHT brand.signature rendern. NICHT Em-Dashes hardcoden. NICHT "Deine X". Author-Box im Footer mit Avatar + Brand-Name + Brand-Handle (ohne signature) ist OK.

---

## Hero-Collage als Vorwort-Bild

`generateForewordCollage(heroBuffers, packMood)` macht eine 2×2 Grid-Collage aus 4 Recipe-Heroes mit Sharp. Wird in `/api/packs/enrich` automatisch gewählt wenn **≥3 Brand-Heroes** im Pack existieren. Filename-Marker: `{packId}-collage.jpg` vs `{packId}.jpg`. Pack-Detail-Page-Visit triggert Upgrade von Flux-Stillleben zu Collage wenn Heroes inzwischen da sind.

---

## Commit-Pattern

Pro Layout EIN Commit, ausführlich:

```
feat(layouts): {Codename} — Layout N von 10 ({Design-Sprache})

Drittes neues Layout aus Phase C. Design-Sprache: {kurze Beschreibung}.

Konzept:
- {Hauptelement}
- {2-3 weitere wichtige visuelle Elemente}
- Mikronährstoffe in EIGENER Position: {Position}
  vs bisherige Positionen aufgelistet

Alle Anti-Patterns aus LAYOUT_RULES.md von Anfang an drin:
- Step-Glyph-Centering (§1)
- Density-System (§2)
- Sparse-Detection (§3)
- IngredientRow Adaptive (§4)
- "Für" nur bei den/die/das (§5)
- Pack-Nummerierung nur als Navigation (§6)
- Keine brand.signature (§7)
- Em-Dash-frei (§8)
- formatIngredientAmount Helper

Registriert in:
- CardLayout enum
- LAYOUTS-Map (PDF)
- VARIANTS-Map (foreword) — {eigene oder reuse}
- layoutPresets
- LAYOUT_OPTIONS (KI-Suggestion)
- LayoutThumbnail
- VALID_LAYOUTS (2 Routes)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## Workflow für nächsten Chat

1. **Lies diese Datei**
2. **Lies [`docs/LAYOUT_RULES.md`](LAYOUT_RULES.md)** für die vollen Anti-Pattern-Details
3. **Schau dir Vinyl + Newspaper an** als Code-Vorlage:
   - PDF: `lib/pdf/recipe-card-pdf.tsx` — suche `function VinylPage` und `function NewspaperPage`
   - Web: `components/recipe-card-full.tsx` — suche `function VinylLayout` und `function NewspaperLayout`
   - Foreword: `lib/pdf/foreword-page.tsx` — suche `function VinylForewordPage` und `function NewspaperForewordPage`
4. **Frage den User welches Layout als nächstes** (von der Liste 3-10)
5. **Baue es ENTLANG der Checkliste** Phase 1-5 (Schritt für Schritt, kein Phase überspringen)
6. **Verify TS + Push** nach jedem Layout
7. **Warte auf User-Feedback** bevor du das nächste anfängst — er hat sehr klare visuelle Vorstellungen, sein Auge ist der finale Check

---

## Letzte Hinweise vom User (aus dem aktuellen Chat)

- **Alle Texte Deutsch** mit korrekten Umlauten (ä/ö/ü/ß), niemals ae/oe/ue
- **QR-Code muss in jedem Layout-Footer sein** wenn `recipe.sourceUrl` da ist
- **"Deine [Brand]" überall raus** — nur in der OutroPage am Ende des Packs
- **Vorwort-Bild als Collage** der Recipe-Heroes (passiert automatisch, du musst nichts tun)
- **Vorwort-Text muss konkrete Rezept-Namen erwähnen** (passiert automatisch durch generatePackForeword)
- **Jedes Layout muss von Anfang an perfekt sein** — User hat hart-erarbeitete Patterns und will keine Iterations mehr
- **Schriftgröße + Aufteilung müssen sich an Recipe-Länge anpassen** (Density-System macht das)
- **Niemals weiße halbleere Seiten** — Sparse-Detection mit Story-Block fängt das ab
- **Layouts müssen wirklich komplett unterschiedlich aussehen** — kein "ist ja fast wie X"

Viel Erfolg. Du baust gerade das innovativste Recipe-Card-Tool der Welt.
