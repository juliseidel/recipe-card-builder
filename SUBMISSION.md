# Submission · Recipe Card Builder

**Wolf Family Office · Test Week · Aufgabe 2 · Mai 2026**
Julian Seidel · julian@echtgesund.shop

Diese Datei ist die Schnell-Übersicht für jeden, der direkt im Repo
landet. Alle Pflicht-Lieferungen, alle Brand-Doku-Links, der Tech-Stack
und die wichtigsten "über die Pflicht hinaus"-Features auf einen Blick.

---

## Pflicht-Lieferungen (Brief Seite 5)

| Pflicht | Status | Wo |
|---|---|---|
| Live-URL des Tools auf Vercel | ✅ | siehe Submission-E-Mail an `ingo.lange@coaching-central.com` |
| GitHub-Repository mit dem Code | ✅ | dieses Repo: [github.com/juliseidel/recipe-card-builder](https://github.com/juliseidel/recipe-card-builder) |
| Fünf Recipe-Packs für Biene als druckfertige PDFs | ✅ | [public/submission/](public/submission/) — alle CMYK, 300 DPI, ICC-eingebettet |
| Kurze Doku zu Design-Entscheidungen pro Pack | ✅ | [docs/packs/](docs/packs/) — ein 1-Pager pro Pack |

---

## Die fünf Recipe-Packs

| # | Pack | Rezepte | Layout | Mood | Doku | PDF |
|---|---|---:|---|---|---|---|
| 01 | Bienes Backwelt | 10 | patisserie | Lavender | [Doku](docs/packs/01-bienes-backwelt.md) | [PDF](public/submission/01%20%E2%80%93%20Bienes%20Backwelt%20%E2%80%93%2010%20Rezepte%20von%20Biene.pdf) |
| 02 | Volumen-Wunder | 7 | sport | Sage Green | [Doku](docs/packs/02-volumen-wunder.md) | [PDF](public/submission/02%20%E2%80%93%20Volumen-Wunder%20%E2%80%93%207%20Rezepte%20von%20Biene.pdf) |
| 03 | Bienes Snacks | 5 | minimal | Mint | [Doku](docs/packs/03-bienes-snacks.md) | [PDF](public/submission/03%20%E2%80%93%20Bienes%20Snacks%20%E2%80%93%205%20Rezepte%20von%20Biene.pdf) |
| 04 | Meal-Prep Heroes | 8 | dashboard | Sky Blue | [Doku](docs/packs/04-meal-prep-heroes.md) | [PDF](public/submission/04%20%E2%80%93%20Meal-Prep%20Heroes%20%E2%80%93%208%20Rezepte%20von%20Biene.pdf) |
| 05 | Feierabend-Klassiker | 7 | editorial | Honey | [Doku](docs/packs/05-feierabend-klassiker.md) | [PDF](public/submission/05%20%E2%80%93%20Feierabend-Klassiker%20%E2%80%93%207%20Rezepte%20von%20Biene.pdf) |

**Total: 37 Rezepte · 5 strukturell unterschiedliche Layouts · 5 unterschiedliche Mood-Paletten.**

---

## Pflicht-Anforderungen (Brief Seite 1)

| # | Anforderung | Wie es im Tool gelöst ist |
|---|---|---|
| 1 | Vielfältige Kartendesigns | 5 strukturell unterschiedliche Layouts in [`lib/packs.ts`](lib/packs.ts): `editorial`, `patisserie`, `minimal`, `sport`, `dashboard` |
| 2 | Kurze + lange Rezepte | Edge-Cases bewusst eingebaut: 3-Zutaten-Eisbowl + 16-Zutaten-Mexican-Bowl im Volumen-Pack. Density-System pro Layout |
| 3 | Nährwertdetails (Makros + Mikros + Kalorien) | Makros pro Layout unterschiedlich visualisiert · Mikros via Gemini 2.5 Flash, sortiert nach % EU-Tagesbedarf · Pack-Übersicht mit Total + Ø |
| 4 | Druckfertiges PDF | A4 (595×842 pt), embedded Fraunces+Inter, 300 DPI, CMYK via Ghostscript+ICC, automatische Verifikation |
| 5 | Lange Jobs (Loading-States, Async, Queuing) | Job-Queue mit max 2 concurrent, `after()`-Pattern, Polling, Stage-Labels, Auto-Download |
| 6 | Web-Interface zum Erstellen + Vorschauen | Workspace → Brand → Pack → Editor mit zwei Live-Vorschauen, Mode-Switcher (manuell + Instagram-Import) |

---

## Bewertungskriterien-Mapping (Brief Seite 4)

| Kriterium | Wo es sichtbar wird |
|---|---|
| **Produkt-Denken** (Edge-Cases) | 3-Zutaten-Eisbowl + 16-Zutaten-Mexican-Bowl, Density-System, Sub-Gruppen, **Instagram-Import** |
| **Design-Geschmack** | 5 unterschiedliche Layouts, Bienes Cream-Base + 5 Mood-Farben, Fraunces+Inter, Cocoa-Black statt Schwarz |
| **Kreative Bandbreite** | 5 Packs strukturell unterschiedlich — nicht nur Farb-Varianten |
| **Technische Umsetzung** | CMYK-Pipeline, Job-Queue, Polling, Async, 7 API-Routes |
| **UX** | Editor mit zwei Live-Vorschauen, Pflichtfeld-Counter, Mode-Switcher, Auto-Download, Layout-Picker |
| **Markenpassung** | [`docs/BRAND_BIENE.md`](docs/BRAND_BIENE.md) (195-Zeilen-Brand-Recherche) + Pack-Dokus in [`docs/packs/`](docs/packs/) |

---

## Über die Pflicht hinaus

Diese Features verlangt der Brief **nicht** — sie zeigen Produkt-Denken
und KI-Fluency, die beiden expliziten Bewertungskriterien:

- **Instagram-Link-Import** — Reel- oder Post-URL einfügen, Apify scraped
  die Caption + Cover-Bild, Gemini 2.5 Flash extrahiert das strukturierte
  Rezept, Form füllt sich auto. Confidence-Badge zeigt, wie sicher die KI
  war. ([`lib/integrations/apify.ts`](lib/integrations/apify.ts) +
  [`lib/ai/parse-instagram.ts`](lib/ai/parse-instagram.ts) +
  [`app/api/recipes/import-instagram/route.ts`](app/api/recipes/import-instagram/route.ts))
- **KI-Mikronährstoffe pro Rezept** via Gemini 2.5 Flash mit JSON-Schema —
  5–10 Mikros pro Rezept, sortiert nach % EU-Tagesbedarf, sync vor der
  POST-Response (garantiert in DB)
- **KI-Hero-Bild pro Custom-Recipe** via Flux 2 Pro im Bienes-Brand-Style
- **KI-Bienes-Story** (Auto-Generation für Cards mit leerer Beschreibung)
- **KI-Pack-Cover** für Custom-Packs
- **Custom-Packs** — User kann eigene Packs anlegen, nicht nur Bienes
  fünf
- **Layout-Picker** für Custom-Packs (Lock-In nach erster Karte für
  visuelle Konsistenz)
- **Sub-Gruppen** ("Für den Teig" / "Glasur") in Zutaten + Schritten
- **Optimistic UI** beim Pack-Löschen
- **Nutrition-Basis-Selektor** (Portion / Stück / 100g / gesamt)

---

## Tech-Stack auf einen Blick

| Layer | Wahl |
|---|---|
| Framework | Next.js 16.2.4 (App Router), React 19 |
| Styling | Tailwind v4, Fraunces (Display) + Inter (Body) |
| PDF | `@react-pdf/renderer` 4.5 (RGB) → Ghostscript 10 (CMYK) → pdf-lib |
| Backend | Supabase (Postgres + Storage) |
| Async | Vercel `after()` + Cooperative Job-Queue (max 2 concurrent) |
| KI | Gemini 2.5 Flash + Flux 2 Pro (BFL) |
| Scraping | Apify `apify/instagram-scraper` |
| Hosting | Vercel (Auto-Deploy auf `main`) |

---

## Wo finde ich was im Repo

| Will ich… | Datei |
|---|---|
| Den Tool-Überblick lesen | [README.md](README.md) |
| Die Pflicht-Lieferung verstehen | diese Datei |
| Eine Design-Entscheidung pro Pack nachschlagen | [`docs/packs/`](docs/packs/) |
| Die Brand-DNA-Recherche zu Biene sehen | [`docs/BRAND_BIENE.md`](docs/BRAND_BIENE.md) |
| Die fünf druckfertigen PDFs runterladen | [`public/submission/`](public/submission/) — oder die Live-URL `/submission` |
| Die 5 Card-Layouts im Code verstehen | [`lib/pdf/recipe-card-pdf.tsx`](lib/pdf/recipe-card-pdf.tsx) (PDF) + [`components/recipe-card-full.tsx`](components/recipe-card-full.tsx) (Web) |
| Die CMYK-Pipeline verstehen | [`lib/pdf/cmyk-convert.ts`](lib/pdf/cmyk-convert.ts) + [README → Print-Pipeline](README.md#print-pipeline-cmyk) |
| Die Job-Queue / Async-Logik verstehen | [`lib/pdf/job-runner.ts`](lib/pdf/job-runner.ts) + [`app/api/pdf/jobs/`](app/api/pdf/jobs/) |
| Den Instagram-Import-Flow verstehen | [`lib/integrations/apify.ts`](lib/integrations/apify.ts) + [`lib/ai/parse-instagram.ts`](lib/ai/parse-instagram.ts) + [`components/instagram-import-card.tsx`](components/instagram-import-card.tsx) |
| Die KI-Mikros-Pipeline verstehen | [`lib/ai/generate-micros.ts`](lib/ai/generate-micros.ts) + [`app/api/recipes/enrich/route.ts`](app/api/recipes/enrich/route.ts) |

---

## Live-URL aufrufen

1. Live-URL aus der Submission-E-Mail öffnen
2. **Workspace** öffnet — alle Brands sind sichtbar (aktuell: Biene)
3. Auf **Biene** klicken → die fünf Packs als Grid
4. Auf einen Pack klicken → Pack-Cover + alle Rezepte + Nährwert-Übersicht
5. Auf eine Karte klicken → die Vollansicht im pack-spezifischen Layout
6. **`/submission`** aufrufen → Direkt-Download aller fünf CMYK-PDFs
7. **"Neue Rezeptkarte"** klicken (in einem beliebigen Pack) → Editor mit
   Mode-Switcher: **Selbst aufbauen** oder **Aus Instagram-Link**

---

## Kontext: Test Week

Diese Submission gehört zu **Aufgabe 2** der Wolf Family Office Test Week
(4.–11. Mai 2026). Die zwei anderen Aufgaben (WPF Marketing Page Clone,
Cracking Chris Konzept) liegen in **eigenen Repos** / Dokumenten und
sind für diese Submission **nicht relevant** — dieser Repo ist
ausschließlich für Aufgabe 2 (Recipe Card Builder).
