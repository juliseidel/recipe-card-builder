"use client";

import { useState, useTransition, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Brand } from "@/lib/brands";
import type { Pack, PackMood, CardLayout } from "@/lib/packs";
import {
  layoutPresets,
  moodPresets,
  moodFamilies,
  displayFontOptions,
} from "@/lib/pack-presets";
import {
  extractForewordLegacyFields,
  type ForewordLegacyFields,
} from "@/lib/foreword-adapter";
import { SiteHeader } from "@/components/site-header";
import { LayoutPicker } from "@/components/layout-picker";

// Pack-Editor (Phase 2). Lebt unter /[brand]/[pack]/edit fuer jeden
// Custom-Pack. Alle 9 editierbaren Felder, jedes mit Re-Roll-Button und
// Lock-Indikator. Speichern persistiert + markiert geaenderte Felder als
// "manuell editiert" damit Auto-Sync (Recipe-Mutation) sie nicht
// ueberschreibt.

type PackEditorProps = {
  brand: Brand;
  pack: Pack;
  packId: string;
};

type RerollableField =
  | "title"
  | "subtitle"
  | "tagline"
  | "description"
  | "category"
  | "foreword"
  | "coverImage"
  | "forewordImage";

export function PackEditor({ brand, pack, packId }: PackEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [globalSuccess, setGlobalSuccess] = useState<string | null>(null);

  // Editierbare Felder als lokaler State
  const [title, setTitle] = useState(pack.title);
  const [subtitle, setSubtitle] = useState(pack.subtitle);
  const [tagline, setTagline] = useState(pack.tagline);
  const [description, setDescription] = useState(pack.description);
  const [category, setCategory] = useState(pack.category);
  const [mood, setMood] = useState<PackMood>(pack.mood);
  const [displayFont, setDisplayFont] = useState<Pack["displayFont"]>(pack.displayFont);
  const [cardLayout, setCardLayout] = useState<CardLayout>(pack.cardLayout);
  const [coverImage, setCoverImage] = useState(pack.coverImage);
  const [forewordImage, setForewordImage] = useState(pack.forewordImage ?? "");
  // v3-Adapter: pack.foreword kann blocks-Form (neu, gemini-2.5-pro) oder
  // greeting/story/signoff-Form (Legacy) sein. Editor bedient nur die
  // 4 Klassik-Felder; Adapter extrahiert sie in beiden Faellen. Beim Save
  // ueberschreiben wir mit dieser legacy form — KI-blocks gehen damit
  // verloren, was OK ist: User-Edit ist die neue Source-of-Truth.
  const initialForeword = useMemo<ForewordLegacyFields>(
    () => extractForewordLegacyFields(pack.foreword),
    [pack.foreword]
  );
  const [foreword, setForeword] = useState<ForewordLegacyFields>(initialForeword);

  const [lockedFields, setLockedFields] = useState<Set<string>>(
    new Set(pack.editedFields ?? [])
  );
  const [rerollingField, setRerollingField] = useState<string | null>(null);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const forewordInputRef = useRef<HTMLInputElement>(null);

  // Welche Felder hat der User in diesem Editor-Cycle veraendert?
  const dirtyFields = useMemo(() => {
    const dirty = new Set<string>();
    if (title !== pack.title) dirty.add("title");
    if (subtitle !== pack.subtitle) dirty.add("subtitle");
    if (tagline !== pack.tagline) dirty.add("tagline");
    if (description !== pack.description) dirty.add("description");
    if (category !== pack.category) dirty.add("category");
    if (JSON.stringify(mood) !== JSON.stringify(pack.mood)) dirty.add("mood");
    if (displayFont !== pack.displayFont) dirty.add("displayFont");
    if (cardLayout !== pack.cardLayout) dirty.add("cardLayout");
    if (coverImage !== pack.coverImage) dirty.add("coverImage");
    if (forewordImage !== (pack.forewordImage ?? "")) dirty.add("forewordImage");
    // Dirty-Check gegen den Initial-State (via Adapter aus pack.foreword
    // extrahiert), damit Block-Form-Forewords nicht als "alle Felder leer
    // → user hat alles editiert" detected werden.
    if (foreword.greeting !== initialForeword.greeting) dirty.add("foreword.greeting");
    if (foreword.story !== initialForeword.story) dirty.add("foreword.story");
    if (foreword.signoff !== initialForeword.signoff) dirty.add("foreword.signoff");
    if (foreword.outro !== initialForeword.outro) dirty.add("foreword.outro");
    return dirty;
  }, [
    title,
    subtitle,
    tagline,
    description,
    category,
    mood,
    displayFont,
    cardLayout,
    coverImage,
    forewordImage,
    foreword,
    pack,
  ]);

  const hasChanges = dirtyFields.size > 0;

  async function handleSave() {
    setGlobalError(null);
    setGlobalSuccess(null);
    startTransition(async () => {
      const patch: Partial<Pack> = {};
      if (dirtyFields.has("title")) patch.title = title.trim();
      if (dirtyFields.has("subtitle")) patch.subtitle = subtitle.trim();
      if (dirtyFields.has("tagline")) patch.tagline = tagline.trim();
      if (dirtyFields.has("description")) patch.description = description.trim();
      if (dirtyFields.has("category")) patch.category = category.trim();
      if (dirtyFields.has("mood")) patch.mood = mood;
      if (dirtyFields.has("displayFont")) patch.displayFont = displayFont;
      if (dirtyFields.has("cardLayout")) patch.cardLayout = cardLayout;
      if (dirtyFields.has("coverImage")) patch.coverImage = coverImage;
      if (dirtyFields.has("forewordImage")) patch.forewordImage = forewordImage;
      const forewordChanged =
        dirtyFields.has("foreword.greeting") ||
        dirtyFields.has("foreword.story") ||
        dirtyFields.has("foreword.signoff") ||
        dirtyFields.has("foreword.outro");
      if (forewordChanged) patch.foreword = foreword;

      // editedFields: alle gerade-editierten Felder UND alle bereits-lockten
      const editedFields = [...lockedFields, ...dirtyFields];

      try {
        const res = await fetch(`/api/packs/${packId}/update`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patch,
            editedFields,
            brandSlug: brand.slug,
            packSlug: pack.slug,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setGlobalError(data.error ?? "Speichern fehlgeschlagen.");
          return;
        }
        setLockedFields(new Set(editedFields));
        setGlobalSuccess("Pack gespeichert. Geaenderte Felder sind jetzt vor Auto-Sync geschuetzt.");
        router.refresh();
      } catch (err) {
        setGlobalError((err as Error).message);
      }
    });
  }

  async function handleReroll(field: RerollableField) {
    setGlobalError(null);
    setRerollingField(field);
    try {
      const res = await fetch(`/api/packs/${packId}/regenerate-field`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGlobalError(data.error ?? `Re-Roll fuer ${field} fehlgeschlagen.`);
        return;
      }
      // Re-Roll-Result ins UI uebernehmen
      if (field === "title") setTitle(data.value);
      else if (field === "subtitle") setSubtitle(data.value);
      else if (field === "tagline") setTagline(data.value);
      else if (field === "description") setDescription(data.value);
      else if (field === "category") setCategory(data.value);
      // Re-Roll-Result kommt aus /regenerate-field als v3-Block-Form. Wir
      // adaptieren auf die 4-Felder-Form fuer den Editor-State.
      else if (field === "foreword") setForeword(extractForewordLegacyFields(data.value));
      else if (field === "coverImage") setCoverImage(data.value);
      else if (field === "forewordImage") setForewordImage(data.value);
      // Re-Roll un-lockt das Feld (KI darf weiter Auto-Sync)
      setLockedFields((prev) => {
        const next = new Set(prev);
        if (field === "foreword") {
          next.delete("foreword.greeting");
          next.delete("foreword.story");
          next.delete("foreword.signoff");
          next.delete("foreword.outro");
        } else {
          next.delete(field);
        }
        return next;
      });
      router.refresh();
    } catch (err) {
      setGlobalError((err as Error).message);
    } finally {
      setRerollingField(null);
    }
  }

  function handleUnlock(field: string) {
    setLockedFields((prev) => {
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
  }

  async function handleCoverUpload(file: File) {
    setGlobalError(null);
    const form = new FormData();
    form.append("file", file);
    form.append("packSlug", pack.slug);
    try {
      const res = await fetch("/api/packs/cover-upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setGlobalError(data.error ?? "Cover-Upload fehlgeschlagen.");
        return;
      }
      setCoverImage(data.url);
    } catch (err) {
      setGlobalError((err as Error).message);
    }
  }

  async function handleForewordUpload(file: File) {
    setGlobalError(null);
    const form = new FormData();
    form.append("file", file);
    form.append("packSlug", pack.slug);
    try {
      const res = await fetch("/api/packs/foreword-image-upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setGlobalError(data.error ?? "Vorwort-Bild-Upload fehlgeschlagen.");
        return;
      }
      setForewordImage(data.url);
    } catch (err) {
      setGlobalError((err as Error).message);
    }
  }

  return (
    <div style={{ background: brand.tokens.background, minHeight: "100vh" }}>
      <SiteHeader />

      <main className="mx-auto max-w-[1100px] px-6 py-10 lg:px-10">
        <nav className="text-[12px] tracking-wide" style={{ color: brand.tokens.inkMuted }}>
          <Link href={`/${brand.slug}`} className="hover:underline">
            {brand.name}s Workspace
          </Link>{" "}
          ›{" "}
          <Link href={`/${brand.slug}/${pack.slug}`} className="hover:underline">
            {pack.title}
          </Link>{" "}
          › Bearbeiten
        </nav>

        <header className="mt-4 flex items-end justify-between gap-6 border-b pb-6" style={{ borderColor: brand.tokens.line }}>
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: brand.tokens.inkMuted }}>
              Pack bearbeiten
            </span>
            <h1 className="mt-1 text-[28px] font-semibold leading-tight" style={{ color: brand.tokens.ink, fontFamily: "var(--font-fraunces)" }}>
              {title || "Pack ohne Titel"}
            </h1>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges || isPending}
            className="rounded-full px-5 py-2.5 text-[13px] font-semibold transition disabled:opacity-40"
            style={{
              background: brand.tokens.ink,
              color: brand.tokens.background,
            }}
          >
            {isPending ? "Speichert…" : hasChanges ? `${dirtyFields.size} Änderung${dirtyFields.size === 1 ? "" : "en"} speichern` : "Keine Änderungen"}
          </button>
        </header>

        {globalError ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">{globalError}</div>
        ) : null}
        {globalSuccess ? (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-700">{globalSuccess}</div>
        ) : null}

        {/* ─── Identität ────────────────────────────────────────────────── */}
        <Section title="Identität" subtitle="Pack-Titel, Subtitle, Beschreibung — Texte, die auf dem Cover und im Inhaltsverzeichnis erscheinen." brand={brand}>
          <FieldRow
            label="Pack-Titel"
            locked={lockedFields.has("title")}
            onUnlock={() => handleUnlock("title")}
            onReroll={() => handleReroll("title")}
            rerolling={rerollingField === "title"}
            brand={brand}
          >
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="editor-input"
              placeholder="z.B. Mealprep-Sonntags-Klassiker"
              maxLength={60}
            />
          </FieldRow>

          <FieldRow
            label="Subtitle"
            locked={lockedFields.has("subtitle")}
            onUnlock={() => handleUnlock("subtitle")}
            onReroll={() => handleReroll("subtitle")}
            rerolling={rerollingField === "subtitle"}
            brand={brand}
          >
            <input
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              className="editor-input"
              placeholder="Ein Satz Untertitel"
              maxLength={120}
            />
          </FieldRow>

          <FieldRow
            label="Tagline"
            hint="2-3 konkrete Rezeptnamen, kommagetrennt — landet im Pack-Cover."
            locked={lockedFields.has("tagline")}
            onUnlock={() => handleUnlock("tagline")}
            onReroll={() => handleReroll("tagline")}
            rerolling={rerollingField === "tagline"}
            brand={brand}
          >
            <input
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              className="editor-input"
              placeholder="Wrap Muffins, Schüttel Salat, Blitz Tiramisu"
              maxLength={180}
            />
          </FieldRow>

          <FieldRow
            label="Beschreibung"
            hint="2-3 Sätze in der Stimme des Creators — landet im Pack-Cover unter Tagline."
            locked={lockedFields.has("description")}
            onUnlock={() => handleUnlock("description")}
            onReroll={() => handleReroll("description")}
            rerolling={rerollingField === "description"}
            brand={brand}
          >
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="editor-input min-h-[100px]"
              placeholder="Was zeichnet dieses Pack aus? Für wen oder welchen Anlass?"
              maxLength={500}
            />
          </FieldRow>

          <FieldRow
            label="Kategorie"
            hint="Frühstück / Snacks / Backen / Mittagessen / Mealprep / …"
            locked={lockedFields.has("category")}
            onUnlock={() => handleUnlock("category")}
            onReroll={() => handleReroll("category")}
            rerolling={rerollingField === "category"}
            brand={brand}
          >
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="editor-input"
              placeholder="z.B. Backen"
              maxLength={60}
            />
          </FieldRow>
        </Section>

        {/* ─── Stil ─────────────────────────────────────────────────────── */}
        <Section title="Stil" subtitle="Layout, Farbpalette und Display-Font — bestimmt wie die Karten gerendert werden." brand={brand}>
          <FieldRow label="Card-Layout" hint="Wird auf jede Rezeptkarte im Pack angewendet." brand={brand}>
            <LayoutPicker
              value={cardLayout}
              onChange={setCardLayout}
              accent={mood.accent}
              thumbnailMood={{ background: mood.background, accent: mood.accent, ink: mood.ink }}
            />
          </FieldRow>

          <FieldRow label="Mood / Farbpalette" hint="24 kuratierte Paletten in 5 Farbfamilien. Hintergrund · Akzent · Text-Farbe." brand={brand}>
            <div className="space-y-5">
              {moodFamilies.map((family) => {
                const presetsInFamily = moodPresets.filter((p) => p.family === family.id);
                if (presetsInFamily.length === 0) return null;
                return (
                  <div key={family.id}>
                    <div className="mb-2 flex items-baseline justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: brand.tokens.inkMuted }}>
                        {family.label}
                      </span>
                      <span className="text-[11px]" style={{ color: brand.tokens.inkMuted }}>
                        {family.hint}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {presetsInFamily.map((preset) => {
                        const active =
                          preset.mood.background === mood.background && preset.mood.accent === mood.accent;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => setMood(preset.mood)}
                            className={`rounded-2xl border-2 p-3 text-left text-[12px] transition ${active ? "border-black" : "border-transparent"}`}
                            style={{ background: preset.mood.background, color: preset.mood.ink }}
                          >
                            <div className="flex items-center gap-2">
                              <span className="h-4 w-4 rounded-full" style={{ background: preset.mood.accent }} />
                              <span className="font-semibold">{preset.label}</span>
                            </div>
                            <span className="mt-1 block opacity-70">{preset.hint}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </FieldRow>

          <FieldRow label="Display-Font" hint="Wird für Pack-Titel + Recipe-Titel benutzt." brand={brand}>
            <div className="flex flex-wrap gap-2">
              {displayFontOptions.map((font) => (
                <button
                  key={font.id}
                  type="button"
                  onClick={() => setDisplayFont(font.id)}
                  className={`rounded-full border px-4 py-2 text-[13px] transition ${displayFont === font.id ? "border-black bg-black text-white" : "border-stone-300 text-stone-700"}`}
                >
                  {font.label}
                </button>
              ))}
            </div>
          </FieldRow>
        </Section>

        {/* ─── Cover-Bild ──────────────────────────────────────────────── */}
        <Section title="Cover-Bild" subtitle="Erscheint auf der ersten Seite des Pack-PDFs und auf der Hub-Card." brand={brand}>
          <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
            <div className="aspect-[3/4] overflow-hidden rounded-2xl border" style={{ borderColor: brand.tokens.line, background: brand.tokens.surface }}>
              {coverImage ? (
                <img src={coverImage} alt="Pack-Cover" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-[11px]" style={{ color: brand.tokens.inkMuted }}>
                  Kein Cover-Bild
                </div>
              )}
            </div>
            <div className="space-y-3">
              <p className="text-[13px]" style={{ color: brand.tokens.inkMuted }}>
                Lade ein eigenes Bild hoch oder lass die KI ein neues generieren.
              </p>
              <div className="flex flex-wrap gap-2">
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleCoverUpload(f);
                  }}
                />
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  className="rounded-full border border-stone-300 px-4 py-2 text-[13px]"
                >
                  Eigenes Bild hochladen
                </button>
                <button
                  type="button"
                  onClick={() => handleReroll("coverImage")}
                  disabled={rerollingField === "coverImage"}
                  className="rounded-full border border-stone-300 px-4 py-2 text-[13px] disabled:opacity-50"
                >
                  {rerollingField === "coverImage" ? "Generiere…" : "KI neu generieren"}
                </button>
              </div>
            </div>
          </div>
        </Section>

        {/* ─── Vorwort ─────────────────────────────────────────────────── */}
        <Section title="Vorwort" subtitle="Begrüßung + persönliche Story + Signoff + Outro — erscheint auf der zweiten Seite des Pack-PDFs (vor dem Inhaltsverzeichnis)." brand={brand}>
          <FieldRow
            label="Vorwort-Text"
            hint="4 Felder: Begrüßung (4-7 Wörter), Story (3-5 Sätze mit Rezeptnamen), Signoff (Einladung), Outro (letzte Seite). Re-Roll generiert alle vier neu."
            locked={
              lockedFields.has("foreword.greeting") ||
              lockedFields.has("foreword.story") ||
              lockedFields.has("foreword.signoff") ||
              lockedFields.has("foreword.outro")
            }
            onUnlock={() => {
              handleUnlock("foreword.greeting");
              handleUnlock("foreword.story");
              handleUnlock("foreword.signoff");
              handleUnlock("foreword.outro");
            }}
            onReroll={() => handleReroll("foreword")}
            rerolling={rerollingField === "foreword"}
            brand={brand}
          >
            <div className="space-y-3">
              <div>
                <span className="text-[11px] uppercase tracking-wide" style={{ color: brand.tokens.inkMuted }}>Begrüßung</span>
                <input
                  value={foreword.greeting}
                  onChange={(e) => setForeword((p) => ({ ...p, greeting: e.target.value }))}
                  className="editor-input"
                  placeholder="Hey, schön dass du da bist."
                  maxLength={80}
                />
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wide" style={{ color: brand.tokens.inkMuted }}>Story (3-5 Sätze)</span>
                <textarea
                  value={foreword.story}
                  onChange={(e) => setForeword((p) => ({ ...p, story: e.target.value }))}
                  className="editor-input min-h-[100px]"
                  placeholder="Hier sind die Rezepte, die ich diesen Monat am liebsten gekocht habe…"
                  maxLength={500}
                />
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wide" style={{ color: brand.tokens.inkMuted }}>Signoff</span>
                <input
                  value={foreword.signoff}
                  onChange={(e) => setForeword((p) => ({ ...p, signoff: e.target.value }))}
                  className="editor-input"
                  placeholder="Lass dich inspirieren."
                  maxLength={140}
                />
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wide" style={{ color: brand.tokens.inkMuted }}>Outro (letzte Pack-Seite)</span>
                <textarea
                  value={foreword.outro ?? ""}
                  onChange={(e) => setForeword((p) => ({ ...p, outro: e.target.value }))}
                  className="editor-input min-h-[80px]"
                  placeholder="Ich hoffe, du findest hier genau das, wonach du Lust hast…"
                  maxLength={400}
                />
              </div>
            </div>
          </FieldRow>
        </Section>

        {/* ─── Vorwort-Bild ────────────────────────────────────────────── */}
        <Section title="Vorwort-Bild" subtitle="Still-Life auf der Vorwort-Seite — keine fertige Speise, sondern atmosphärisches Ingredient/Utensilien-Arrangement." brand={brand}>
          <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
            <div className="aspect-square overflow-hidden rounded-2xl border" style={{ borderColor: brand.tokens.line, background: brand.tokens.surface }}>
              {forewordImage ? (
                <img src={forewordImage} alt="Vorwort-Bild" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-[11px]" style={{ color: brand.tokens.inkMuted }}>
                  Kein Vorwort-Bild
                </div>
              )}
            </div>
            <div className="space-y-3">
              <p className="text-[13px]" style={{ color: brand.tokens.inkMuted }}>
                Lade ein eigenes Bild hoch oder lass die KI ein still-life generieren (passend zum Pack-Thema).
              </p>
              <div className="flex flex-wrap gap-2">
                <input
                  ref={forewordInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleForewordUpload(f);
                  }}
                />
                <button
                  type="button"
                  onClick={() => forewordInputRef.current?.click()}
                  className="rounded-full border border-stone-300 px-4 py-2 text-[13px]"
                >
                  Eigenes Bild hochladen
                </button>
                <button
                  type="button"
                  onClick={() => handleReroll("forewordImage")}
                  disabled={rerollingField === "forewordImage"}
                  className="rounded-full border border-stone-300 px-4 py-2 text-[13px] disabled:opacity-50"
                >
                  {rerollingField === "forewordImage" ? "Generiere…" : "KI neu generieren"}
                </button>
              </div>
            </div>
          </div>
        </Section>

        {/* ─── Footer-Speichern ────────────────────────────────────────── */}
        <div className="sticky bottom-4 z-10 mt-10 flex items-center justify-between rounded-2xl border bg-white/95 px-5 py-4 shadow-lg backdrop-blur" style={{ borderColor: brand.tokens.line }}>
          <div className="text-[12px]" style={{ color: brand.tokens.inkMuted }}>
            {hasChanges
              ? `${dirtyFields.size} ungespeicherte Änderung${dirtyFields.size === 1 ? "" : "en"}. Auto-Sync (Recipe-Mutation) überschreibt geänderte Felder nicht.`
              : "Alle Änderungen gespeichert."}
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/${brand.slug}/${pack.slug}`} className="rounded-full border border-stone-300 px-4 py-2 text-[13px]">
              Zurück zum Pack
            </Link>
            <button
              type="button"
              onClick={handleSave}
              disabled={!hasChanges || isPending}
              className="rounded-full px-5 py-2.5 text-[13px] font-semibold disabled:opacity-40"
              style={{ background: brand.tokens.ink, color: brand.tokens.background }}
            >
              {isPending ? "Speichert…" : "Speichern"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── Sub-Components ──────────────────────────────────────────────────────

function Section({ title, subtitle, children, brand }: { title: string; subtitle?: string; children: React.ReactNode; brand: Brand }) {
  return (
    <section className="mt-10 rounded-3xl border p-6 sm:p-8" style={{ borderColor: brand.tokens.line, background: brand.tokens.surface }}>
      <header className="mb-5">
        <h2 className="text-[18px] font-semibold" style={{ color: brand.tokens.ink, fontFamily: "var(--font-fraunces)" }}>
          {title}
        </h2>
        {subtitle ? <p className="mt-1 text-[13px]" style={{ color: brand.tokens.inkMuted }}>{subtitle}</p> : null}
      </header>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function FieldRow({
  label,
  hint,
  locked,
  onUnlock,
  onReroll,
  rerolling,
  children,
  brand,
}: {
  label: string;
  hint?: string;
  locked?: boolean;
  onUnlock?: () => void;
  onReroll?: () => void;
  rerolling?: boolean;
  children: React.ReactNode;
  brand: Brand;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div>
          <span className="text-[12px] font-semibold uppercase tracking-[0.14em]" style={{ color: brand.tokens.inkMuted }}>
            {label}
          </span>
          {hint ? <span className="ml-2 text-[12px]" style={{ color: brand.tokens.inkMuted }}>· {hint}</span> : null}
        </div>
        <div className="flex items-center gap-2">
          {locked ? (
            <button
              type="button"
              onClick={onUnlock}
              className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[11px] text-amber-800"
              title="Klick um den Auto-Sync für dieses Feld wieder zu aktivieren"
            >
              🔒 manuell editiert
            </button>
          ) : null}
          {onReroll ? (
            <button
              type="button"
              onClick={onReroll}
              disabled={rerolling}
              className="rounded-full border border-stone-300 px-3 py-1 text-[11px] disabled:opacity-50"
              style={{ color: brand.tokens.inkMuted }}
            >
              {rerolling ? "Generiere…" : "↻ KI neu"}
            </button>
          ) : null}
        </div>
      </div>
      {children}
    </div>
  );
}
