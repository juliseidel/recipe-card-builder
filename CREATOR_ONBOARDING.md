# Creator-Onboarding-Workflow

> **Wenn der User sagt _"ich habe einen neuen Creator angelegt"_ oder _"neuer Creator: @handle"_, ist dieses Dokument deine Handlungsanweisung.**

**Status:** Aktiv seit Mai 2026 (V9.5-Pipeline).
**Letzte Aktualisierung:** 12. Mai 2026.

---

## Grundprinzip

Die **Hero-Bild-Pipeline ist für jeden Creator IDENTISCH**. Sie liegt in `lib/ai/generate-hero.ts` und macht für alle Brands das gleiche:

```
Apify scrape Reel → ffmpeg Frames → Gemini Vision wählt sauberen Keyframe
→ Flux 2 Pro mit Reference + Jan's Hero-Prompt + Brand-DNA-Slots
→ Sharp Lanczos Upscale 3072 + JPEG q=95 → Supabase Storage
```

**Was sich pro Creator ändert:** ausschließlich die **Brand-DNA-Slots** im Prompt — `lightingOptions`, `sceneOptions`, `cameraAesthetic`, `heroElementGuidance`, `defaultAngles`, `negativeAddition`. Sonst nichts.

**Garantie der Isolation:** Jeder Brand-Style ist eine eigene exportierte Konstante in `lib/ai/brand-image-style.ts` (z.B. `BIENE_STYLE`). Die `STYLES`-Map mapped `slug → Konstante`. Wenn du `JULE_STYLE` hinzufügst, ist `BIENE_STYLE` ein anderes JavaScript-Objekt im Speicher — **physisch unberührt**, wird **nie** beeinflusst.

---

## Warum Auto-Onboarding für Style abgeschafft wurde

Die `/new-brand` Page im Web-Tool macht **Identity-Auto-Fill weiterhin automatisch** (Name, Bio, Tagline, Niche, Avatar via Apify+Gemini). Aber die automatische Style-Template-Auswahl wurde entfernt — sie produzierte zu generische Bilder, weil ein Template-aus-6 nie den echten Look eines Creators trifft.

**Stattdessen:** Brand-DNA wird **immer hand-kalibriert via Code-Brand**. Das macht der Claude-Chat mit dem User zusammen.

---

## Standard-Workflow (5 Schritte, ~20-30 Minuten)

### Schritt 1 — User-Kontext erfassen

Der User sagt dir typischerweise:
- **Instagram-Handle** (z.B. `@bienesfitlife`)
- **Slug-Wunsch** (z.B. `biene`, `domis`, `jule`) — kurz, lowercase, kein Sonderzeichen
- Optional: **2-3 Reel-URLs** die seinen Style besonders gut zeigen

Wenn nicht alle Angaben da: aktiv nachfragen.

### Schritt 2 — Reels analysieren

Du brauchst echte visuelle Daten über den Creator-Look. Vorgehensweise:

**Option A — Apify-Scrape mit Cover-Inspection:**
```bash
# Profile-Scrape via existing function
import { scrapeInstagramProfile } from "@/lib/integrations/apify";
const profile = await scrapeInstagramProfile(handle);
# profile.latestPosts enthält displayUrls + captions
```

Die `displayUrl` jedes Posts ist das Reel-Cover-Bild. Du kannst sie via WebFetch/Browser-Tool anschauen.

**Option B — User schickt Screenshots:**
Wenn der User selbst 5-10 Reel-Cover-Bilder schickt (z.B. via Drag-and-Drop), schaust du die direkt an.

**Was du daraus extrahieren musst:**

| Aspekt | Beispiel-Beobachtungen |
|---|---|
| **Counter / Surface** | "pale-grey concrete" / "warm walnut wood" / "white marble" / "dark slate" |
| **Lighting** | Direction (links/oben/hinten) + Wärme (warm-golden / neutral-bright / cool-clean) |
| **Camera-Aesthetic** | smartphone-snap (homemade, casual) / cookbook-magazine / editorial-cool / dark-moody |
| **Signature-Prop / Hero-Element** | Bei Biene: Cutting Board mit Ingredient-Schälchen. Bei anderen vielleicht: linen napkin / herbs / utensils |
| **Color-Tone** | Welche Farbpalette dominiert? warm-amber, cool-clean, vibrant-fresh |
| **Camera-Angle-Tendenz** | Top-down? 30° three-quarter? 45° eye-level? Variiert pro dishShape |

**Wichtig:** Beschreibungen sollen **englisch** sein (Flux versteht nur englisch). Sehr konkret formulieren — nicht "warm" sondern "warm morning light streaming from the left with soft long shadows".

### Schritt 3 — `{CREATOR}_STYLE` Konstante schreiben

Ergänze in `lib/ai/brand-image-style.ts` direkt nach `BIENE_STYLE` (oder dem letzten Code-Brand):

```typescript
// ─── {Creator-Name} · @{handle} ─────────────────────────────────────────────
// Calibrated against {N} Reel-Cover-Screenshots vom User.
// Observed signature elements:
//   - {Counter/Surface-Beobachtung}
//   - {Lighting-Beobachtung}
//   - {Signature-Prop falls vorhanden}
//   - {Color-Tone}
export const {CREATOR}_STYLE: BrandImageStyle = {
  brandSlug: "{slug}",
  lightingOptions: [
    "{english phrase 1}",
    "{english phrase 2}",
    "{english phrase 3}",
    "{english phrase 4}",
    "{english phrase 5}",
  ],
  sceneOptions: [
    "{english phrase 1}",
    "{english phrase 2}",
    "{english phrase 3}",
    "{english phrase 4}",
    "{english phrase 5}",
  ],
  styleSuffix: "",
  negativeAddition:
    "{creator-specific negatives, comma-separated, e.g. 'no parsley, no cast-iron pan'}",
  cameraAesthetic:
    "{english phrase, z.B. 'natural unstaged food photograph, homemade-feeling, no studio look'}",
  heroElementGuidance:
    "{english phrase, optional. Wenn Creator ein Signature-Prop hat: konkret beschreiben. Sonst: 'Keep styling minimal — the dish is the hero.'}",
  defaultAngles: {
    flat: "{angle description for flat dishes}",
    mixed: "{angle description for mixed dishes}",
    layered: "{angle description for layered dishes}",
    tall: "{angle description for tall dishes}",
    liquid: "{angle description for liquid dishes}",
  },
};
```

**Ergänze in der STYLES-Map** (am Ende der Datei):

```typescript
const STYLES: Record<string, BrandImageStyle> = {
  biene: BIENE_STYLE,
  {slug}: {CREATOR}_STYLE, // ← neu
};
```

### Schritt 4 — Brand-Eintrag in `lib/brands.ts`

Damit `isCodeBrand("{slug}") === true` und der Brand in der App existiert.

```typescript
// In lib/brands.ts den brands-Array erweitern:
{
  slug: "{slug}",
  name: "{Creator-Display-Name}",
  fullName: "{Voller Name}",
  handle: "@{handle}",
  bio: "...",
  tagline: "...",
  signature: "Deine {Name}" oder "Dein {Name}",
  avatar: "{avatar-url oder leer}",
  stats: { followers: "...K", niche: "..." },
  tokens: { ... }, // UI-Farben (Cream/Sage/Linen/Amber)
  fonts: { ... },
  packCount: 0,
  recipeCount: 0,
}
```

> **Tipp:** Wenn der User den Creator schon über `/new-brand` in der App angelegt hat, existiert er als DB-Brand. Du musst ihn dann zusätzlich als Code-Brand in `lib/brands.ts` anlegen — der Code-Brand-Lookup gewinnt automatisch über den DB-Eintrag. Daten (Bio, Avatar) kannst du aus der DB ziehen oder vom User abfragen.

### Schritt 5 — Commit + Push auf main

**Commit-Message-Format:**
```
feat(brand): {Creator-Name} Code-Brand — Style hand-kalibriert

Brand-DNA basierend auf {N} Reel-Screenshots:
- Counter: {beschreibung}
- Lighting: {beschreibung}
- Signature: {beschreibung}

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

**Push:**
```bash
git push origin HEAD:main
```

Vercel deployed automatisch (~90s). Sobald live: alle neuen Recipe-Saves + Re-Roll-Aktionen für diesen Creator nutzen den hand-kalibrierten Code-Style.

---

## Iteration nach erstem Test

Nach dem ersten Bild (Recipe-Save oder Re-Roll-Button):
- User schaut sich das Bild an
- Wenn nicht perfekt → wir tunen die Brand-DNA-Felder im Chat
- Typische Tweaks: Counter-Material präzisieren, Lighting-Richtung anpassen, Signature-Element entfernen/präzisieren

**Nicht** an der Pipeline drehen. **Nur** an `{CREATOR}_STYLE`.

---

## Was du NIEMALS pro Creator änderst

Diese Files sind die Pipeline-Logik — **immer identisch** für alle Brands:

| Datei | Was sie macht |
|---|---|
| `lib/ai/generate-hero.ts` | Top-Level Pipeline (Apify → Frames → Vision → Flux) |
| `lib/ai/image-prompts.ts` | Jan's Hero-Prompt-Template (Slots werden brand-spezifisch befüllt, Template selbst bleibt) |
| `lib/ai/select-keyframe.ts` | Vision-Frame-Selection |
| `lib/ai/recipe-image-spec.ts` | 9-Feld-Image-Spec aus Recipe-Text |
| `lib/ai/bfl-flux.ts` | BFL-API-Client |
| `lib/ai/describe-instagram-dish.ts` | Vision-Pre-Check für Cover-Fallback |
| `lib/ai/extract-video-frames.ts` | ffmpeg-Wrapper |

**Wenn der User dir sagt _"die Bilder von Creator X passen nicht"_ → ändere `{CREATOR}_STYLE`, niemals die Pipeline.** Wenn es ein Pipeline-Problem ist (z.B. plötzlich Text in allen Bildern), dann ist es ein produkt-übergreifender Bug und betrifft alle Brands — separate Diskussion mit dem User.

---

## Was die Pipeline pro Brand braucht (Slots)

Hier siehst du **wo** dein `{CREATOR}_STYLE` einfließt. Falls du Slots ändern willst (z.B. neues Feld), musst du auch die Pipeline-Files anfassen — was du wirklich nur tun solltest wenn alle Brands betroffen sind.

| Style-Feld | Wo es verwendet wird |
|---|---|
| `lightingOptions` (5 strings) | Enum für `lightingMood` in der 9-Feld-Spec → kommt in Jan's Hero-Prompt als `{lightingMood}` |
| `sceneOptions` (5 strings) | Enum für `sceneContext` in der 9-Feld-Spec → `{sceneContext}` |
| `cameraAesthetic` | Direkt im Hero-Prompt als Camera/Aesthetic-Anker, ersetzt Jan's _"Shot on Leica SL2"_-Default |
| `heroElementGuidance` | Override für `heroElement`-Spec-Feld + im Hero-Prompt |
| `defaultAngles` | Override für angle-Lookup nach dishShape |
| `negativeAddition` | Hängt an `HERO_BASE_NEGATIVE` (Jan's 18 Items) an |
| `styleSuffix` | Optionaler Tail-Append im Hero-Prompt (selten genutzt) |

---

## Live-Beispiel: `BIENE_STYLE`

Ist in `lib/ai/brand-image-style.ts` ab Zeile ~55. Lies dir das als Referenz durch wenn du einen neuen Creator anlegst — die Kommentare erklären warum bestimmte Felder so sind wie sie sind (z.B. _"warum 75° statt strict 90° für flat"_, _"warum kein Petersil"_, etc.).

---

## Cheat-Sheet für den Chat-Einstieg

User sagt: _"neuer Creator: @{handle}, slug {slug}"_

Du machst:
1. `WebFetch` auf `https://www.instagram.com/{handle}/` ODER User-Screenshots inspizieren
2. 5-10 Reel-Cover anschauen (visuelle Inspektion)
3. Brand-DNA-Felder entwerfen + dem User vorlegen ("Hier mein Vorschlag für deine DNA: ...")
4. Nach OK: `Edit` auf `lib/ai/brand-image-style.ts` (neue Konstante + STYLES-Map ergänzen) + `lib/brands.ts` (Brand-Array)
5. `git commit + push origin HEAD:main`
6. User testet, ggf. iterieren

---

## FAQ

**F: User legt Creator über `/new-brand` an. Soll ich trotzdem Code-Brand machen?**
A: Ja, immer wenn der User es will / wenn die Bilder konsistent gut sein sollen. Der DB-Brand-Eintrag bleibt bestehen (für Avatar/Bio/Recipes). Code-Brand gewinnt automatisch beim Hero-Style-Lookup.

**F: Was wenn nur ein Aspekt schlecht ist (z.B. Counter falsch, Rest gut)?**
A: Nur dieses eine Feld in `{CREATOR}_STYLE` anpassen. Andere Felder unangetastet. Push.

**F: Was wenn das Bild plötzlich Text drauf hat?**
A: Pipeline-Problem, nicht Brand-Style-Problem. Vermutlich ein produktiver Pipeline-Code-Bug (siehe `lib/ai/select-keyframe.ts` und `describe-instagram-dish.ts` für Vision-Pre-Check). User mitteilen, dann zusammen am Pipeline-Code arbeiten.

**F: Was passiert mit existierenden Bildern für diesen Creator?**
A: Bleiben unverändert (URLs in Supabase Storage). Erst neue Saves / Re-Rolls nutzen den neuen Code-Style. Bulk-Reseed via `/api/admin/reseed-heroes` möglich wenn der User das will.
