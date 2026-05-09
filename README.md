# Recipe Card Builder

Ein Web-Studio, das aus Rezeptdaten — Zutaten, Schritten, Nährwerten —
**druckfertige Rezeptkarten** generiert. Gebaut für **Wolf Family Office**,
**Test Week · Aufgabe 2 · Mai 2026**.

Die fünf finalen Recipe-Packs für **Biene ([@bienesfitlife](https://www.instagram.com/bienesfitlife/))**
liegen unter [`/submission`](app/submission/page.tsx) als CMYK-PDFs (300 DPI,
ICC-Profil eingebettet, Schriftarten als Subset).

---

## Was das Tool kann

### Drei Wege, eine Karte zu erstellen

1. **Selbst aufbauen** — klassisches Form mit Live-Vorschau, Layout-Picker
   für Custom-Packs, Sub-Gruppen für Zutaten ("Für den Teig" / "Glasur"),
   Pflichtfeld-Counter, Schnell-Einheiten, Ingredient-Combobox mit
   Autocomplete.
2. **Aus Instagram-Link** — Reel- oder Post-URL einfügen. Apify scraped die
   Caption + Cover-Bild, Gemini 2.5 Flash extrahiert mit JSON-Schema das
   strukturierte Rezept (Titel, Zutaten mit Sub-Gruppen, Schritte, Makros,
   Nutrition-Basis, Tags), das Form füllt sich auto. Confidence-Badge
   zeigt, wie sicher die KI war.
3. **Custom-Packs anlegen** — neben Bienes fünf kuratierten Packs kann der
   User eigene Packs mit Custom-Farben, eigenem Layout und KI-generiertem
   Pack-Cover erstellen.

### Sieben strukturell unterschiedliche Card-Layouts

Nicht nur Farb-Varianten — jedes Layout hat eigenen Body-Block, eigene
Macro-Visualisierung, eigene Typo, eigene Vorwort-Variante:

| Layout | Signature-Move | Eingesetzt in |
|---|---|---|
| `patisserie` | Lavender-Sidebar (40 %) mit Polaroid-Foto -2° Tilt, vertikale Mikro-Liste, italic Fraunces, Avatar-Stempel | Pack 1 · Bienes Backwelt |
| `vital` | 3-Card-Premium-Stack (Hero / Macros / Body) mit Sage-Green-Border, Macro-Donuts, Avatar-Ring | Pack 2 · Volumen-Wunder |
| `minimal` | Full-Bleed-Hero mit Title-Overlay, Mint-Spec-Strip, 2-Spalten-Body, Mikros-Pills horizontal | Pack 3 · Bienes Snacks |
| `dashboard` | Notion-Style Data-Rows, Wochentag-Tag, "Mealprep-Ready"-Marker, Checklist-Body | Pack 4 · Meal-Prep Heroes |
| `amber` | Sunset-Editorial mit Honey-Halo um Hero, zentrierter Stat-Ribbon, Avatar oben rechts, magazine-Spread | Pack 5 · Feierabend-Klassiker |
| `editorial` | Mikronährstoff-Banner *vor* dem Body, animierte Bars, Pull-Quote für "Bienes Story" | für Custom-Packs verfügbar |
| `sport` | Macro-Bars mit Accent-Dots, Zutaten-Cart mit Checkboxen, Schritt-Timeline | für Custom-Packs verfügbar |

### Asynchrone PDF-Pipeline

- **Job-Queue** mit max 2 concurrent Renders (Supabase-basiert, cooperative)
- **Polling-Endpoint** mit `Cache-Control: no-store`, Stage-Labels
  (starting → loading-cover → rendering → uploading → done)
- **Vercel `after()`** rendert nach Response-Flush, Browser bekommt
  sofort Job-ID, lädt im Hintergrund weiter
- **Auto-Download** sobald die PDF auf Storage ist
- Funktioniert für einzelne Karten **und** komplette Packs

### KI-Stack

| Pipeline | Model | Was |
|---|---|---|
| Mikronährstoffe | Gemini 2.5 Flash mit flexiblem JSON-Schema | 1–12 Mikros pro Rezept (je nach Reichhaltigkeit), sortiert nach % EU-Tagesbedarf. Sync vor der POST-Response, mit Failure-Persistence + Retry-Banner |
| Bienes-Story | Gemini 2.5 Flash | Auto-generierte Beschreibung im Brand-Ton bei leeren Cards |
| Hero-Bild | Flux 2 Pro (BFL) | 1:1, 1024 × 1024, Bienes Brand-Style aus dem Recherche-DNA |
| Pack-Cover | Flux 2 Pro (BFL) | Custom-Pack-Covers anhand des Pack-Themas |
| Vorwort-Bild | Flux 2 Pro (BFL) | Pack-spezifisches Stillleben (hand-getunte Recipes pro Pack), nie Personen |
| Vorwort-Text | Gemini 2.5 Flash | Custom-Pack-Vorworte; Bienen-Pack-Vorworte sind hand-poliert in `lib/pack-forewords.ts` |
| Instagram-Parsing | Apify `instagram-scraper` + Gemini 2.5 Flash | Caption → strukturiertes Rezept |

### Druckfertige PDFs (CMYK)

Die Submission-PDFs sind **echte Druck-PDFs**:

- **A4** (595 × 842 pt)
- **CMYK** via Ghostscript 10 mit eingebettetem ICC-Profil
- **300 DPI** Bilder (Pack-Cover: 1800 × 2400 px, lanczos3-upscaled)
- **Schriftarten als Subset** (Fraunces + Inter)
- **Verifikation** per `gs -dPDFINFO` — das Build-Skript bricht ab, falls
  ein PDF kein DeviceCMYK enthält
- Reproduzierbar via `npm run print:packs`

### Edge-Case-tauglich

Layouts adaptieren bei 3 Zutaten genauso wie bei 16+:

- **3-Zutaten-Eisbowl** und **16-Zutaten-Mexican-Bowl** sind beide bewusst
  in Pack 2 ("Volumen-Wunder")
- Density-System (compact / balanced / spacious) in jedem Layout
- **Sparse-Detection in jedem der 7 Layouts** — Karten mit ≤10 Zutaten
  bekommen automatisch einen "Bienes Story"-Pull-Quote-Block, damit die
  Karte nicht halbleer wirkt. PDF nutzt zusätzlich `softWrapTitle` damit
  zusammengesetzte Substantive ("Erdbeer-Kuppeltorte") sauber umbrechen
- Sub-Group-Detection ("Für den Teig", "Für die Glasur") in jedem Layout

---

## Live

- **Tool:** auf Vercel deployed (siehe Submission-E-Mail an Ingo)
- **Submission-Übersicht mit Direkt-Downloads:** `/submission`
- **Repo:** [github.com/juliseidel/recipe-card-builder](https://github.com/juliseidel/recipe-card-builder)

---

## Tech-Stack

| Layer | Wahl |
|---|---|
| Framework | Next.js 16.2.4 (App Router), React 19 |
| Styling | Tailwind v4, Fraunces (Display) + Inter (Body) |
| PDF | `@react-pdf/renderer` 4.5 (RGB) → Ghostscript 10 (CMYK) → pdf-lib (Metadata) |
| Backend | Supabase (Postgres + Storage) |
| Async | Vercel `after()` + Supabase-basierte Cooperative Queue |
| KI | Gemini 2.5 Flash (REST, Schema-validiert) + Flux 2 Pro (BFL) |
| Scraping | Apify `apify/instagram-scraper` Actor (sync via `run-sync-get-dataset-items`) |
| Hosting | Vercel (Auto-Deploy auf `main`) |

---

## Setup lokal

Voraussetzungen: Node 20+, `brew install ghostscript`.

```bash
npm install
cp .env.local.example .env.local   # Keys eintragen (siehe unten)
npm run dev                        # http://localhost:3000
```

### Environment-Variablen

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=         # für PDF-Job-Inserts + DB-Writes
GEMINI_API_KEY=                    # Mikros, Story, Instagram-Parsing
BFL_API_KEY=                       # Flux 2 Pro für Hero + Pack-Cover
APIFY_TOKEN=                       # Instagram-Scraping
```

---

## Print-Pipeline (CMYK)

Die Live-App rendert RGB-PDFs (schnell, Vercel-Serverless ohne Ghostscript-
Binary). Für die finalen Submission-Packs läuft eine zusätzliche **CMYK-Stage**
lokal:

```bash
npm run print:packs
# → out/print/ enthält die fünf finalen CMYK-PDFs
# → public/submission/ wird daraus befüllt für die Vercel-Live-URL
```

Was passiert dabei:

1. **Render** ([`renderPackPdf`](lib/pdf/render.ts)) — RGB, embedded Fonts, data-URI-Bilder
2. **CMYK-Convert** ([`lib/pdf/cmyk-convert.ts`](lib/pdf/cmyk-convert.ts)) —
   Ghostscript mit `default_cmyk.icc` als OutputICCProfile, `srgb.icc` als
   Source. 300-DPI-Bilder bleiben erhalten, Vektoren werden ICC-konvertiert
3. **Metadata-Rewrite** (pdf-lib) — Title/Author/Subject in UTF-16BE re-emit
4. **Verify** — Pages-Count via `gs -dPDFINFO`, Color-Space via Stream-Pattern.
   Bricht ab, falls eine PDF nicht CMYK ist

ICC-Profile liegen in `lib/pdf/icc/`. Aktuell ist das generische CMYK-Profil
aus dem Ghostscript-Bundle aktiv. Für deutschen Offset-Print kann es durch
**FOGRA39 (ECI)** ersetzt werden, ohne Code-Änderungen — Pfad in
`lib/pdf/cmyk-convert.ts:DEFAULT_OUTPUT_ICC` zeigen lassen.

---

## Verzeichnisstruktur

```
app/
├── page.tsx                         Workspace-Übersicht
├── [brand]/page.tsx                 Pack-Grid pro Creator
├── [brand]/[pack]/page.tsx          Pack-Cover + Recipe-Grid + Nährwert-Übersicht
├── [brand]/[pack]/[recipe]/page.tsx Vollansicht (7 Layouts)
├── [brand]/[pack]/new/page.tsx      Editor mit Mode-Switcher (Manuell / Instagram)
├── [brand]/new/page.tsx             Custom-Pack anlegen
├── submission/page.tsx              Direct-Download der fünf Submission-PDFs
└── api/
    ├── pdf/jobs/                    Async PDF-Job-Queue (POST + Polling)
    ├── recipes/enrich/              Mikros (sync) + Hero/Story (async after()-Tasks)
    ├── recipes/import-instagram/    Apify-Scrape + Gemini-Parsing
    └── packs/                       Cover-Upload, Custom-Pack-Enrich, Cache-Revalidate

components/
├── instagram-import-card.tsx        Stage-Progression-UI für den IG-Import
├── recipe-card-full.tsx             Live-Detail-View (7 Layouts, ~3000 LOC)
├── pack-cover.tsx, pack-actions.tsx Pack-Detail-Seite
├── nutrition-overview.tsx           Pack-Übersicht (Total + Ø)
├── pdf-export-button.tsx            Job-getriebener Export mit Progress-Bar
├── enrichment-skeletons.tsx         Skeleton für Hero + Mikros während des Enrich
├── layout-picker.tsx                Custom-Pack-Layout-Wahl
└── ingredient-combobox.tsx          Autocomplete für die Editor-Eingabe

lib/
├── brands.ts, packs.ts, recipes.ts  Statische Daten (5 Packs · 37 Rezepte)
├── recipe-micros.ts                 Cache: 37 Rezepte × Gemini-Mikros
├── pdf/
│   ├── render.ts                    renderPackPdf · renderRecipePdf
│   ├── pack-pdf.tsx                 Cover · Index · Recipes · Nährwerte · Outro
│   ├── recipe-card-pdf.tsx          Die 7 Layouts (~5000 LOC)
│   ├── foreword-page.tsx            Vorwort-Page in 5 Varianten (vital reuses sport, amber reuses editorial)
│   ├── qr.ts                        QR-Code-Generierung für den Card-Footer (Original-Reel-Link)
│   ├── cmyk-convert.ts              Ghostscript-Bridge + pdf-lib Metadata-Rewrite
│   ├── job-runner.ts                Supabase-basierte Cooperative Queue
│   └── icc/                         ICC-Profile (CMYK + sRGB)
├── ai/
│   ├── gemini.ts                    Schema-validierter Gemini 2.5 Flash Client
│   ├── generate-micros.ts           Mikronährstoffe pro Rezept
│   ├── generate-story.ts            Bienes-Story-Auto-Generation
│   ├── parse-instagram.ts           Caption → Recipe-Schema
│   ├── bfl-flux.ts                  Flux 2 Pro Client
│   ├── recipe-image-spec.ts         Hero-Bild-Spec aus Rezept ableiten
│   └── image-prompts.ts             Brand-DNA-Override für die Prompts
└── integrations/
    └── apify.ts                     Instagram-Scraper-Bridge

docs/
├── BRAND_BIENE.md                   Tiefe Brand-Recherche (IG/TikTok/Linktree/Pinterest)
└── packs/
    ├── 01-bienes-backwelt.md        Pack-Doku (1-Pager pro Pack)
    ├── 02-volumen-wunder.md
    ├── 03-bienes-snacks.md
    ├── 04-meal-prep-heroes.md
    └── 05-feierabend-klassiker.md
```

---

## Skripte

| Script | Zweck |
|---|---|
| `npm run print:packs` | Alle 5 Pack-PDFs als CMYK rendern + verifizieren + nach `public/submission/` kopieren |
| `scripts/upscale-brand-assets.ts` | Pack-Cover auf 2400 px @ 300 DPI hochskalieren (sharp Lanczos3) |
| `scripts/render-print-pdfs.ts` | Manuelle Variante des `print:packs` Builds |
| `scripts/verify-all-pages.ts` | Sicherstellen, dass jedes Rezept auf einer Seite bleibt |
| `scripts/smoke-test-pdf.ts` | Edge-Case-Tests (kürzeste/längste Karten, ein Pack) |
| `scripts/seed-recipes-to-db.ts` | Curated Rezepte in Supabase mirrorn |
| `scripts/generate-static-micros.ts` | Mikros via Gemini einmalig vorrechnen + cachen |
| `scripts/generate-recipe-heroes.ts` | Alle 37 Hero-Bilder via Flux 2 Pro neu generieren |

Alle TS-Skripte laufen mit `npx tsx --tsconfig ./tsconfig.json scripts/<name>.ts`.

---

## Mapping zu den Bewertungskriterien (Brief Seite 4)

| Kriterium | Wo es im Code sichtbar wird |
|---|---|
| **Diverse Layouts** | [`lib/pdf/recipe-card-pdf.tsx`](lib/pdf/recipe-card-pdf.tsx) + [`components/recipe-card-full.tsx`](components/recipe-card-full.tsx) — 7 strukturell unterschiedliche Layouts (5 in der Bienen-Submission verwendet, 2 zusätzlich für Custom-Packs) |
| **Kurz & lang** | Density-System in jedem Layout, Sparse-Detection in allen 7 (≤10 Zutaten → Story-Pull-Quote), Edge-Cases (3-Zutaten-Eisbowl + 16-Zutaten-Mexican-Bowl) im Volumen-Pack |
| **Nährwerte** | Makros pro Layout unterschiedlich visualisiert · Mikros via Gemini (flexibles 1–12-Schema, sortiert nach % EU-Tagesbedarf) · Pack-Übersicht mit Total + Ø |
| **Druckfertig** | A4, embedded Fonts, 300 DPI Bilder, CMYK-Convert mit ICC, reproduzierbare Build-Pipeline, **QR-Code zum Original-Reel im Footer**, **Vorwort-Page pro Pack** |
| **Lange Jobs** | Async via `after()` · Polling-Endpoint · Cooperative Queue (max 2 concurrent) · Stage-Labels · Mikros-Failure-Persistence + manueller Retry-Button |
| **Web-Interface** | Workspace · Pack · Editor mit zwei Live-Vorschauen · Mode-Switcher · Auto-Download · Auth + per-Creator-Workspaces · cinematische Welcome-Animation · View-Transitions |
| **Markenpassung** | [`docs/BRAND_BIENE.md`](docs/BRAND_BIENE.md) + Pack-Dokus in [`docs/packs/`](docs/packs/) + brand-DNA-System für KI-Bilder |
| **Produkt-Denken** | Edge-Cases bewusst eingebaut · Instagram-Import als Real-World-Workflow · Custom-Packs · Live-Counter (Pack-Detail + Workspace) · Pack-PDF respektiert gelöschte Karten · Mikros-Retry statt endloser Loading |
| **KI-Fluency** | Fünf orthogonale Pipelines (Mikros · Hero · Vorwort-Text · Vorwort-Bild · Instagram-Parsing), alle Schema-validiert |

---

## Bewusste Entscheidungen

- **CMYK in der Live-App:** Vercel-Serverless hat kein Ghostscript-Binary.
  Hybrid-Ansatz: Live RGB schnell (~3 s), Submission CMYK als Build-Artefakt.
  Kein Cloud-Worker eingebunden, weil das in der verfügbaren Zeit ein
  Architektur-Risiko gewesen wäre. Reproduzierbar via `npm run print:packs`.
- **PDF/X-Compliance:** Der Brief fordert nur "CMYK-fähig", nicht PDF/X.
  `gs -dPDFA=2` wäre ein One-Liner, falls die Druckerei das verlangt.
- **Ein Layout pro Pack:** Static-Packs haben ihr Layout in `lib/packs.ts`
  vorgegeben; Custom-Packs picken beim ersten Save. Garantiert ein
  einheitliches Pack-PDF, ohne dass der User pro Karte entscheiden muss.

---

## Lizenz

Privates Projekt für die Test-Week-Submission. Original-Rezepte stammen
von [@bienesfitlife](https://www.instagram.com/bienesfitlife/), jeweils
mit Quell-Link auf das Original-Reel pro Karte verlinkt.
