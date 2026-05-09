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
| 02 | Volumen-Wunder | 7 | vital | Sage Green | [Doku](docs/packs/02-volumen-wunder.md) | [PDF](public/submission/02%20%E2%80%93%20Volumen-Wunder%20%E2%80%93%207%20Rezepte%20von%20Biene.pdf) |
| 03 | Bienes Snacks | 5 | minimal | Mint | [Doku](docs/packs/03-bienes-snacks.md) | [PDF](public/submission/03%20%E2%80%93%20Bienes%20Snacks%20%E2%80%93%205%20Rezepte%20von%20Biene.pdf) |
| 04 | Meal-Prep Heroes | 8 | dashboard | Sky Blue | [Doku](docs/packs/04-meal-prep-heroes.md) | [PDF](public/submission/04%20%E2%80%93%20Meal-Prep%20Heroes%20%E2%80%93%208%20Rezepte%20von%20Biene.pdf) |
| 05 | Feierabend-Klassiker | 7 | amber | Honey | [Doku](docs/packs/05-feierabend-klassiker.md) | [PDF](public/submission/05%20%E2%80%93%20Feierabend-Klassiker%20%E2%80%93%207%20Rezepte%20von%20Biene.pdf) |

**Total: 37 Rezepte · 5 Pack-Layouts in der Submission · 7 Layouts insgesamt im Tool verfügbar (zwei zusätzliche — `editorial` und `sport` — für Custom-Packs).**

---

## Pflicht-Anforderungen (Brief Seite 1)

| # | Anforderung | Wie es im Tool gelöst ist |
|---|---|---|
| 1 | Vielfältige Kartendesigns | 7 strukturell unterschiedliche Layouts in [`lib/packs.ts`](lib/packs.ts): `patisserie`, `vital`, `minimal`, `dashboard`, `amber` (Bienen-Submission) plus `editorial` und `sport` für Custom-Packs |
| 2 | Kurze + lange Rezepte | Edge-Cases bewusst eingebaut: 3-Zutaten-Eisbowl + 16-Zutaten-Mexican-Bowl im Volumen-Pack. Density-System pro Layout, Sparse-Detection (≤10 Zutaten → automatischer "Bienes Story"-Pull-Quote-Block in jedem Layout) |
| 3 | Nährwertdetails (Makros + Mikros + Kalorien) | Makros pro Layout unterschiedlich visualisiert · Mikros via Gemini 2.5 Flash mit flexiblem Schema (1–12 Mikros je nach Rezept), sortiert nach % EU-Tagesbedarf · Pack-Übersicht mit Total + Ø |
| 4 | Druckfertiges PDF | A4 (595×842 pt), embedded Fraunces+Inter, 300 DPI, CMYK via Ghostscript+ICC, automatische Verifikation. **QR-Code zum Original-Reel im Footer jeder Karte**. **Vorwort-Page mit pack-spezifischem Stillleben** vor jedem Pack |
| 5 | Lange Jobs (Loading-States, Async, Queuing) | Job-Queue mit max 2 concurrent, `after()`-Pattern, Polling, Stage-Labels, Auto-Download. Mikros-Failures werden persistiert + manueller Retry-Button (kein endloses Lade-Hängen mehr) |
| 6 | Web-Interface zum Erstellen + Vorschauen | Workspace → Brand → Pack → Editor mit zwei Live-Vorschauen, Mode-Switcher (manuell + Instagram-Import). Auth-geschützt mit per-Creator-Workspaces, cinematischer Welcome-Animation, View-Transitions zwischen Routes |

---

## Bewertungskriterien-Mapping (Brief Seite 4)

| Kriterium | Wo es sichtbar wird |
|---|---|
| **Produkt-Denken** (Edge-Cases) | 3-Zutaten-Eisbowl + 16-Zutaten-Mexican-Bowl, Density-System, Sub-Gruppen, **Instagram-Import**, Mikros-Failure-Recovery, Live-Counter (Pack-Detail + Workspace) |
| **Design-Geschmack** | 7 strukturell unterschiedliche Layouts, Bienes Cream-Base + 5 Mood-Farben, Fraunces+Inter, Cocoa-Black statt Schwarz, eigenes Logo (Stacked Cards + Honey-Bookmark) |
| **Kreative Bandbreite** | 5 Pack-PDFs mit jeweils eigenem Layout — nicht nur Farb-Varianten. Pro Layout: eigene Macro-Visualisierung, eigener Body-Block, eigene Vorwort-Variante |
| **Technische Umsetzung** | CMYK-Pipeline, Job-Queue, Polling, Async, 7 API-Routes, Auth via Supabase, View-Transitions-API |
| **UX** | Editor mit zwei Live-Vorschauen, Pflichtfeld-Counter, Mode-Switcher, Auto-Download, Layout-Picker mit 7 SVG-Mini-Vorschauen, Card-Press-Feedback, Welcome-Animation, dezente Retry-Notifications statt endloser Loading-Animationen |
| **Markenpassung** | [`docs/BRAND_BIENE.md`](docs/BRAND_BIENE.md) (195-Zeilen-Brand-Recherche) + Pack-Dokus in [`docs/packs/`](docs/packs/), brand-DNA-System für KI-Hero-Bilder ([`lib/ai/brand-image-style.ts`](lib/ai/brand-image-style.ts)) |

---

## Über die Pflicht hinaus

Diese Features verlangt der Brief **nicht** — sie zeigen Produkt-Denken
und KI-Fluency, die beiden expliziten Bewertungskriterien:

- **QR-Code zum Original-Reel** im Footer jeder Karte (PDF). M-Level
  Fehlerkorrektur, Fallback-Text wenn Source-URL fehlt. Editor-Feld
  optional, beim Instagram-Import auto-gefüllt
  ([`lib/pdf/qr.ts`](lib/pdf/qr.ts), [`lib/source-url.ts`](lib/source-url.ts))
- **Vorwort-Page pro Pack** mit pack-spezifischem Stillleben (Flux 2 Pro,
  hand-getunte Recipes pro Pack) und hand-poliertem Text in Bienes Stimme
  ([`lib/pack-forewords.ts`](lib/pack-forewords.ts),
  [`lib/pdf/foreword-page.tsx`](lib/pdf/foreword-page.tsx),
  [`lib/ai/generate-foreword-image.ts`](lib/ai/generate-foreword-image.ts)).
  Custom-Packs bekommen ihr Vorwort automatisch beim Anlegen über Gemini
- **Instagram-Link-Import** — Reel- oder Post-URL einfügen, Apify scraped
  die Caption + Cover-Bild, Gemini 2.5 Flash extrahiert das strukturierte
  Rezept, Form füllt sich auto. Confidence-Badge zeigt, wie sicher die KI
  war. ([`lib/integrations/apify.ts`](lib/integrations/apify.ts) +
  [`lib/ai/parse-instagram.ts`](lib/ai/parse-instagram.ts) +
  [`app/api/recipes/import-instagram/route.ts`](app/api/recipes/import-instagram/route.ts))
- **KI-Mikronährstoffe pro Rezept** via Gemini 2.5 Flash mit flexiblem
  JSON-Schema (1–12 Mikros je nach Rezept), sortiert nach % EU-Tagesbedarf,
  sync vor der POST-Response (garantiert in DB). Failure-Persistence +
  manueller Retry-Button bei den seltenen Fällen, in denen Gemini nichts
  Verwertbares liefert
- **KI-Hero-Bild pro Custom-Recipe** via Flux 2 Pro im Bienes-Brand-Style
  (Brand-DNA-System: pale-grey Stone-Counter, Cutting-Board mit Main-
  Headline-Ingredient als Signature-Move, kalibriert gegen echte Reel-
  Screenshots, [`lib/ai/brand-image-style.ts`](lib/ai/brand-image-style.ts))
- **KI-Bienes-Story** (Auto-Generation für Cards mit leerer Beschreibung)
- **KI-Pack-Cover** für Custom-Packs
- **Custom-Packs** — User kann eigene Packs anlegen, nicht nur Bienes
  fünf. Beim Anlegen werden Cover, Vorwort-Text und Vorwort-Bild
  automatisch generiert
- **Layout-Picker** für Custom-Packs mit 7 SVG-Mini-Vorschauen, Lock-In
  nach erster Karte für visuelle Konsistenz
  ([`components/layout-picker.tsx`](components/layout-picker.tsx))
- **Sparse-Detection in jedem Layout** — Karten mit ≤10 Zutaten bekommen
  automatisch einen "Bienes Story"-Pull-Quote-Block, damit die Karte
  nicht halbleer wirkt
- **Sub-Gruppen** ("Für den Teig" / "Glasur") in Zutaten + Schritten,
  in jedem Layout sichtbar gerendert
- **Live-Counter** überall: Pack-Detail-Header und Workspace-Stats
  zählen mit, sobald Karten hinzugefügt oder gelöscht werden — kein
  hardcoded "10 Rezepte" mehr, das nach einem Add/Delete lügt
- **Pack-PDF respektiert gelöschte Karten** — wenn der User eine
  kuratierte Karte aus dem Web-Grid entfernt, wird sie auch beim PDF-
  Export rausgefiltert (Cover-Anzahl, Foreword-Index, Inhaltsverzeichnis,
  Filename ticken alle automatisch mit)
- **Optimistic UI** beim Pack-Löschen
- **Nutrition-Basis-Selektor** (Portion / Stück / 100g / gesamt)
- **Auth + per-Creator-Workspaces** mit Supabase, cinematischer Welcome-
  Animation (Avatar-Reveal mit 3-Layer-Glow, staggered Type-On)
- **Eigenes Logo + Favicon** (Stacked Cards mit Honey-Bookmark, drei
  Varianten für default/ink/outline) plus iOS-Apple-Touch-Icon

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
| Die 7 Card-Layouts im Code verstehen | [`lib/pdf/recipe-card-pdf.tsx`](lib/pdf/recipe-card-pdf.tsx) (PDF) + [`components/recipe-card-full.tsx`](components/recipe-card-full.tsx) (Web) |
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
