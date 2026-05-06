# Recipe Card Builder

Ein Web-Tool, das aus Rezeptdaten — Zutaten, Anweisungen, Nährwerten — wunderschön
gestaltete Rezeptkarten generiert. Gebaut für Wolf Family Office, Test Week
**Aufgabe 2 (Mai 2026)**.

Die fünf finalen Recipe-Packs für **Biene (@bienesfitlife)** sind druckfertig
auf der Live-URL unter `/submission` abrufbar — als CMYK-PDFs mit 300-DPI-Bildern,
eingebettetem ICC-Profil und embedded Schriftarten.

## Live

- **Tool:** [in Vercel deployed — siehe Submission-Email]
- **Submission-Übersicht:** `/submission`
- **Repo:** [github.com/juliseidel/recipe-card-builder](https://github.com/juliseidel/recipe-card-builder)

## Was das Tool kann

- **Fünf Card-Layouts** (`editorial`, `patisserie`, `minimal`, `sport`, `dashboard`) —
  jedes Pack wählt eines, jedes ist strukturell anders, nicht nur Farbvarianten.
- **Asynchrone PDF-Pipeline** mit Job-Queue (max. 2 concurrent), Progress-Polling,
  Auto-Download. Vercel `after()` rendert nach Response-Flush.
- **KI-Mikronährstoffe** via Gemini 2.5 Flash mit JSON-Schema — 5 bis 10 Mikros
  pro Rezept, nach % EU-Tagesbedarf sortiert.
- **Editor mit Live-Vorschau** (`/[brand]/[pack]/new`), Zutaten-Combobox mit
  Autocomplete, Pflichtfeld-Counter, fire-and-forget Mikro-Enrichment nach Save.
- **Edge-Case-tauglich**: Layouts adaptieren bei 3 Zutaten genauso wie bei 16+.
  Verifiziert per `scripts/verify-all-pages.ts`.

## Tech-Stack

| Layer | Wahl |
|---|---|
| Framework | Next.js 16.2.4 (App Router), React 19 |
| Styling | Tailwind v4, Fraunces + Inter |
| PDF | `@react-pdf/renderer` 4.5 (RGB) → Ghostscript 10 (CMYK) → pdf-lib (Metadata) |
| Backend | Supabase (PG + Storage) |
| KI | Gemini 2.5 Flash (REST, Schema-validiert) |
| Hosting | Vercel (Auto-Deploy auf `main`) |

## Setup lokal

Voraussetzungen: Node 20+, `brew install ghostscript`.

```bash
npm install
cp .env.local.example .env.local   # Supabase + Gemini Keys eintragen
npm run dev                        # http://localhost:3000
```

### Environment-Variablen

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=         # für PDF-Job-Inserts
GEMINI_API_KEY=                    # Gemini 2.5 Flash für Mikros
```

## Print-Pipeline (CMYK)

Die Live-App rendert RGB-PDFs (schnell, Vercel-tauglich). Für die Submission an
Ingo werden die fünf Pack-PDFs **zusätzlich** durch eine CMYK-Stage geschickt:

```bash
npm run print:packs
# → out/print/ enthält die fünf finalen CMYK-PDFs
# → public/submission/ wird daraus befüllt für die Vercel-Live-URL
```

Was passiert dabei:

1. **Render** (`renderPackPdf` aus `lib/pdf/render.ts`) — RGB, embedded Fonts,
   data-URI-Bilder.
2. **CMYK-Convert** (`lib/pdf/cmyk-convert.ts`) — Ghostscript mit
   `default_cmyk.icc` als OutputICCProfile, `srgb.icc` als Source. Bilder
   werden auf 300 DPI gehalten, Vektoren ICC-konvertiert.
3. **Metadata-Rewrite** (pdf-lib) — Title/Author/Subject in UTF-16BE re-emit,
   weil gs's pdfwrite UTF-16-Strings beim Round-Trip beschädigt.
4. **Verify** — Pages-Count via `gs -dPDFINFO`, Color-Space via raw stream
   pattern matching. Bricht das Skript ab, falls eine PDF nicht CMYK ist.

ICC-Profile liegen in `lib/pdf/icc/`. Aktuell ist das generische CMYK-Profil
aus dem Ghostscript-Bundle eingebunden. Für deutschen Offset-Print kann es
durch FOGRA39 (ECI) ersetzt werden, ohne Code-Änderungen — Path in
`lib/pdf/cmyk-convert.ts:DEFAULT_OUTPUT_ICC` zeigen lassen.

## Skripte

| Script | Zweck |
|---|---|
| `scripts/upscale-brand-assets.ts` | Pack-Cover auf 2400 px @ 300 DPI hochskalieren (sharp Lanczos3) |
| `scripts/render-print-pdfs.ts` | Alle 5 Pack-PDFs als CMYK rendern + verifizieren |
| `scripts/verify-all-pages.ts` | Sicherstellen, dass jedes Rezept auf einer Seite bleibt |
| `scripts/smoke-test-pdf.ts` | Edge-Case-Tests (kürzeste/längste Karten, ein Pack) |
| `scripts/seed-recipes-to-db.ts` | Curated Rezepte in Supabase mirrorn |
| `scripts/generate-static-micros.ts` | Mikros via Gemini einmalig vorrechnen, in `lib/recipe-micros.ts` cachen |

Alle laufen mit `npx tsx --tsconfig ./tsconfig.json scripts/<name>.ts`.

## Verzeichnisstruktur

```
app/
├── page.tsx                 Workspace-Übersicht
├── [brand]/page.tsx         Pack-Grid pro Creator
├── [brand]/[pack]/page.tsx  Pack-Cover + Recipe-Grid + Nährwert-Übersicht
├── [brand]/[pack]/[recipe]  Vollansicht (5 Layouts)
├── [brand]/[pack]/new       Editor mit Live-Vorschau
├── submission/page.tsx      Direct-Download der fünf Submission-PDFs
└── api/
    ├── pdf/jobs/            Async PDF-Job-Queue
    └── recipes/enrich/      Fire-and-forget Mikro-Enrichment

lib/
├── brands.ts, packs.ts, recipes.ts   Daten + Brand-Tokens
├── pdf/
│   ├── render.ts              renderPackPdf · renderRecipePdf
│   ├── pack-pdf.tsx           Pack-Document: Cover · Index · Recipes · Nährwerte · Outro
│   ├── recipe-card-pdf.tsx    Die 5 Layouts (≈2700 LOC)
│   ├── cmyk-convert.ts        Ghostscript-Bridge + pdf-lib Metadata-Rewrite
│   ├── icc/                   ICC-Profile (CMYK + sRGB)
│   ├── job-runner.ts          Supabase-basierte Job-Queue
│   └── theme.ts, fonts.ts, assets.ts
└── ai/
    ├── gemini.ts              Thin Gemini-2.5-Flash-Client
    └── generate-micros.ts     Schema-validiertes Mikro-Profil

docs/
└── BRAND_BIENE.md           Brand-Recherche + Pack-Begründungen
```

## Bewertungskriterien (Brief)

| Kriterium | Wo es im Code sichtbar wird |
|---|---|
| Diverse Layouts | `lib/pdf/recipe-card-pdf.tsx` + `components/recipe-card-full.tsx` — 5 Layouts |
| Kurz & lang | Density-System (compact/balanced/spacious) im editorial-Layout, Sparse-Detection im sport-Layout, Edge-Cases (3-Zutaten-Eisbowl + 16-Zutaten-Mexican-Bowl) im Volumen-Pack |
| Nährwerte | Makros pro Layout unterschiedlich visualisiert · Mikros via Gemini · Pack-Übersicht mit Total + Ø |
| Druckfertig | A4, embedded Fonts, 300 DPI Bilder, CMYK-Convert mit ICC, Print-Pipeline reproduzierbar |
| Lange Jobs | Async via `after()` · Polling-Endpoint mit `Cache-Control: no-store` · Cooperative Queue (max 2 concurrent) · Stage-Labels |
| Web-Interface | `/`, `/[brand]`, `/[brand]/[pack]`, Editor mit Live-Vorschau, Auto-Download |

## Was bewusst nicht da ist

- **KI-Bildgenerierung pro Rezept** — Brief erwähnt Jans Pipeline. Aktuell teilen
  sich alle Karten eines Packs das Cover-Image. Per-Recipe-Hero-Felder sind
  schon vorbereitet (`recipe.hero` in `lib/recipes.ts`), aber die Generation
  ist Phase 2.
- **CMYK in der Live-App** — Vercel-Serverless hat kein Ghostscript. Hybrid:
  Live RGB schnell, Submission CMYK als Build-Artefakt. Kein Cloud-Worker
  eingebunden, weil das in 5 Tagen ein Architektur-Risiko gewesen wäre.
- **PDF/X-Compliance** — gs `-dPDFA=2` wäre ein One-Liner, aber der Brief
  fordert nur "CMYK-fähig", nicht PDF/X. Wenn Druckerei das verlangt, ist
  es eine Flag-Änderung.

## Lizenz

Privates Projekt für die Test-Week-Submission. Original-Rezepte stammen von
[@bienesfitlife](https://www.instagram.com/bienesfitlife/), jeweils mit Quell-Link
auf das Original-Reel pro Karte verlinkt.
