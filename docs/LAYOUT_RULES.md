# Layout-Regeln — Recipe-Card-Builder

**Status:** Aktiv seit 2026-05-13. Gilt für ALLE neuen Layouts ab `vinyl` aufwärts.

Diese Datei dokumentiert die hart-erarbeiteten Anti-Patterns aus den existierenden 7 Layouts (patisserie / vital / minimal / dashboard / amber / editorial / sport). Jedes neue Layout MUSS diese Regeln von Anfang an einhalten, sonst entstehen Pixel-Fehler die nur durch lange Iteration zu lösen sind.

---

## 1. Step-Number-Glyph-Centering (KRITISCH)

**Problem:** react-pdf's `alignItems: "center"` aligned die Flex-BOX-Centers, NICHT die Glyph-Visual-Centers. Bei unterschiedlichen Fonts (Fraunces vs. Inter) oder fontSizes sind die Glyph-Y-Positionen innerhalb der gleich hohen Line-Boxes unterschiedlich → sichtbar verschoben.

**Lösung:** Number + Text rendern mit **IDENTISCHEN** `fontFamily` + `fontSize` + `lineHeight`. Nur `fontStyle`, `fontWeight`, `color` dürfen unterscheiden.

```tsx
// ✅ KORREKT
<View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
  <Text style={{
    fontSize: 9.5,           // gleich wie Body
    lineHeight: 1.45,        // gleich wie Body
    fontStyle: "italic",     // erlaubter Pop
    fontWeight: 700,         // erlaubter Pop
    color: theme.accent,     // erlaubter Pop
    width: 22,
  }}>
    {index + 1}
  </Text>
  <Text style={{
    flex: 1,
    fontSize: 9.5,           // identisch
    lineHeight: 1.45,        // identisch
    color: theme.ink,
  }}>
    {step.text}
  </Text>
</View>

// ❌ FALSCH (alte Fraunces-Lösung)
<Text style={{ fontFamily: "Fraunces", fontSize: 18 }}>{n}</Text>
<Text style={{ fontFamily: "Inter", fontSize: 9.5 }}>{text}</Text>
```

Math-Tricks wie `marginTop`, `paddingTop`, `lineHeight`-Anpassung oder Wrapper-View mit fixed height funktionieren NICHT zuverlässig wegen yoga-Quirks.

---

## 2. Density-System (Auto-Adaption an Recipe-Länge)

Jedes Layout MUSS drei Densities haben: `compact` / `balanced` / `spacious`.

**Selector-Logik** (lib/pdf/recipe-card-pdf.tsx → `getDensity`):
- `spacious` bei ≤ 6 Zutaten ODER ≤ 4 Schritten
- `compact` bei ≥ 14 Zutaten ODER ≥ 8 Schritten
- `balanced` sonst

**Was sich pro Density ändert:**
- Header-Padding (top/bottom)
- Title-FontSize
- Body-Padding
- Ingredient-Row-Padding + FontSize
- Step-MarginBottom + FontSize
- Mikros-Block-Padding

**Beispiel-Skala (siehe EDITORIAL_DENSITY in recipe-card-pdf.tsx):**

| Density | titleFontSize | stepFontSize | stepMarginBottom |
|---|---:|---:|---:|
| compact | 24 | 9 | 6 |
| balanced | 28 | 9.5 | 10 |
| spacious | 32 | 10 | 12 |

**Wichtig:** ALLE Densities müssen das Recipe auf EINER A4-Seite halten. Wenn der spacious-Render umbricht, ist die spacious-Skala zu groß.

---

## 3. Sparse-Detection (≤10 Zutaten → Story-Block)

**Problem:** Recipes mit 3 Zutaten füllen das Spacious-Layout nicht aus → halbleere Seite mit viel Whitespace.

**Lösung:** Bei `ingredients.length <= 10` UND `recipe.story` truthy → "Bienes Story"-Pull-Quote-Block einfügen.

```tsx
const showStory = shouldShowStory(recipe); // (recipe.ingredients.length <= 10 && recipe.story)

{showStory && (
  <StoryPullQuote story={recipe.story} theme={theme} />
)}
```

Pull-Quote-Block kann unterschiedlich aussehen pro Layout (Editorial nutzt anführungszeichen, Vinyl könnte z.B. "Liner Notes" stilisieren).

---

## 4. IngredientRow Center-Align bei langem Amount

**Problem:** Bei langem amount-Text wie "Nach Geschmack" (wrappt zu zwei Zeilen) sass die Border-Bottom-Linie weit unten, während der Name-Text oben endete.

**Lösung:** `alignItems` switchen je nach Amount-Länge:

```tsx
const amountIsLong = displayAmount.length > 10;
// alignItems: amountIsLong ? "center" : "flex-start"
// amount lineHeight: amountIsLong ? 1.3 : implicit
// amount paddingTop: amountIsLong ? 0 : 1 (Font-Metric-Compensation)
```

Plus Auto-Capitalize: `amount.charAt(0).toUpperCase() + amount.slice(1)` damit "nach Geschmack" → "Nach Geschmack".

---

## 5. Ingredient-Group-Präfix grammatikalisch korrekt

**Problem:** `Für ${g.name.toLowerCase()}` produzierte "Für Optional" / "Für Topping" — grammatikalisch falsch.

**Lösung:** "Für" nur bei den/die/das.

```tsx
const label = /^(den|die|das)\s/i.test(g.name)
  ? `Für ${g.name.toLowerCase()}`
  : g.name;
```

---

## 6. Pack-Nummerierung gehört NICHT aufs PDF

Tool-interne Pack-Nummer ("Pack 03") ist ein Counter, keine Marketing-Information. Pack-Cover-Page: keine "Pack 03"-Caption. Foreword-Page: kein "Pack 03 · TITLE". 

Erlaubt: Recipe-Position innerhalb des Packs ("TITLE 01/07") — das ist Navigation.

---

## 7. brand.signature nur EINMAL pro Pack (OutroPage)

Vorher 13× pro Pack zu lesen (Cover-Bottom + jeder Recipe-Footer + Inhaltsverzeichnis + Nutrition-Footer + Outro). User-Feedback: "das ist viel zu viel".

**Regel:** brand.signature ("Deine X") nur auf der OutroPage rendern. brand.handle (@username) nur 1-2 dezente Stellen.

---

## 8. Em-dashes "—" und En-dashes "–" verboten in KI-Text

Em/En-dashes sind ein KI-Tell und wirken unauthentisch. Beim Foreword-Schreiben + Pack-Description nur Komma, Doppelpunkt, Punkt. Wort-Bindestriche ("low-cal") sind OK.

---

## 9. Layout-Konsistenz > Whitespace-Optimierung

Kurze Karten dürfen unten Whitespace haben, solange ALLE Karten gleich angeordnet sind. `justifyContent: "center"` mit spacious-Density führte zu inkonsistenter Anordnung (kurze Karten mittig, lange oben).

**Regel:** Top-aligned (default flex-start) für alle Densities.

---

## 10. Step-Rendering-Sync (KRITISCH bei Multi-Layout-Edits)

`StepsList`-Funktion wird nur von Editorial, Patisserie, Minimal und Sport benutzt. **Vital und Amber haben EIGENEN inline Step-Rendering-Code.** Beim Step-Aenderung IMMER `grep -n "stepGroups.map\|StepsList"` ausführen.

**Empfehlung für neue Layouts:** Nutze `<AdaptiveStepRow>` aus `lib/pdf/layout-primitives.tsx` (siehe unten) — das garantiert das Center-Lock automatisch.

---

## 11. MicrosStrip + CardFooter — Layout-spezifische Variants

Editorial/Patisserie/Sport/Vital/Amber nutzen den shared `CardFooter` mit `MicrosStrip`-Sub-Component. MinimalPage rendert beide inline. Bei Footer-Änderungen: IMMER `grep -n "MicrosStrip\|CardFooter\|MinimalPage"` ausführen und MinimalPage's inline-Code parallel anpassen.

**Empfehlung für neue Layouts:** Jedes neue Layout hat seine **eigene** Mikros-Position. Patterns aus dem Architektur-Konzept:

| Layout | Mikros-Position |
|---|---|
| vinyl | Audio-Spec-Stats unter dem Disc-Title (BPM/KEY/DURATION) |
| newspaper | Spreadsheet-Footer-Row als Justify-Table |
| constellation | Planeten-Symbole am rechten Rand |
| restaurant-menu | Italic Wine-Notes-Block unten |
| apothecary | Handgeschriebene Etiketten mit Faden-Anker |
| manga | Power-Stats-Block unten, Comic-Style |
| bauhaus | Geometrische Dreiecks-Charts (eine pro Mikro) |
| subway | Legend-Box unten links wie U-Bahn-Legende |
| botanical | Wissenschaftliche Daten-Tabelle |
| mixtape | VU-Meter-Bars (Audio-Track-Levels) |

---

## 12. Spec-Strip-Labels (kcal pro X) folgen `nutritionBasis`

`stueckSing` aus `recipe.nutritionBasis` ableiten:
- `piece` → "Stück" / "Stücke"
- `portion` → "Portion" / "Portionen"
- `per100g` → "100 g"
- `total` → "gesamt"

Mikros-Label IMMER `nutritionBasisInline(recipe.nutritionBasis)` (dynamisch), niemals hardcoded "pro Portion".

---

## 13. Cover-Image-Container 4:5 Portrait (320×420)

Custom-Cover sind oft hochformatige Selfies. Quadratischer Container schneidet Köpfe weg. 320×420 + `objectPosition: "center 15%"` als Default.

---

## 14. brand.name dynamisch — "Bienes" nur für brand="biene"

`<BeeIcon brandSlug={brand.slug} />` (pflicht-prop). "Bienes Story" → `${brand.name}s Story`. Daten-Files bleiben unangetastet, UI-Code muss dynamisch sein.

---

## 15. softWrapTitle für zusammengesetzte Substantive

Recipe-Titles wie "Erdbeer-Kuppeltorte" oder "Schoko-Ingwer-Crumble" brauchen `softWrapTitle()` damit sie sauber umbrechen statt am Container-Rand abgeschnitten zu werden.

---

## Checkliste für neue Layouts

Bevor ein neues Layout commitet wird:

- [ ] Step-Number + Text rendern mit identischer font/fontSize/lineHeight
- [ ] Density-System (compact/balanced/spacious) implementiert
- [ ] Sparse-Detection mit Story-Pull-Quote bei ≤10 Zutaten
- [ ] IngredientRow alignItems-Switch bei amount > 10 chars
- [ ] Ingredient-Group "Für" nur bei den/die/das
- [ ] Keine Pack-Nummerierung auf der Karte
- [ ] brand.signature nur auf OutroPage
- [ ] Keine Em/En-dashes in KI-Text
- [ ] Top-aligned Body (flex-start, kein center)
- [ ] Eigene Mikros-Position (keine Kopie eines existierenden Layouts)
- [ ] Spec-Strip-Labels folgen nutritionBasis
- [ ] brand.name dynamisch (kein hardcoded "Bienes")
- [ ] softWrapTitle für Recipe-Titel
- [ ] Test mit 3-Zutaten-Eisbowl + 16-Zutaten-Mexican-Bowl
- [ ] Test mit Recipe ohne Story (lang) + mit Story (kurz)
- [ ] Web-Render (recipe-card-full.tsx) parallel implementiert
- [ ] LayoutThumbnail (SVG-Vorschau) im auto-pack-form
- [ ] layoutPresets-Eintrag in lib/pack-presets.ts
- [ ] LAYOUT_OPTIONS in lib/ai/suggest-pack-design.ts erweitert
- [ ] Foreword-Variant in lib/pdf/foreword-page.tsx (falls Pack es nutzt)

Bei Verstoß → User-Frust und stundenlanges Debugging. Diese Liste rettet uns das.
