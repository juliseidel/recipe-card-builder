"use client";

import { useState, useTransition, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Brand } from "@/lib/brands";
import type {
  Pack,
  PackMood,
  CardLayout,
  StoryPage,
  StoryPagePosition,
} from "@/lib/packs";
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

  // Guide-Modus: Pack-Mode-Toggle + Story-Pages (Inkrement 1: nur generieren
  // + read-only-Liste, kein Edit/Re-Roll/Image — kommt in Inkrement 2).
  const initialPackMode = pack.packMode ?? brand.defaultPackMode ?? "recipebook";
  const [packMode, setPackMode] = useState<"recipebook" | "guide">(initialPackMode);
  const [storyPages, setStoryPages] = useState<StoryPage[]>(pack.storyPages ?? []);
  const [isGeneratingStoryPages, setIsGeneratingStoryPages] = useState(false);

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
    if (packMode !== initialPackMode) dirty.add("packMode");
    if (JSON.stringify(storyPages) !== JSON.stringify(pack.storyPages ?? [])) {
      dirty.add("storyPages");
    }
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
    initialForeword,
    packMode,
    initialPackMode,
    storyPages,
    pack,
  ]);

  async function handleGenerateStoryPages() {
    setGlobalError(null);
    setIsGeneratingStoryPages(true);
    try {
      const res = await fetch(
        `/api/packs/${packId}/story-pages/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ replace: true }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setGlobalError(data.error ?? "Story-Seiten konnten nicht generiert werden.");
        return;
      }
      const newPages: StoryPage[] = data.pack?.storyPages ?? [];
      setStoryPages(newPages);
      setPackMode("guide");
      setGlobalSuccess(
        `${newPages.length} Story-Seiten generiert. Speichern um sie ans Pack zu binden.`
      );
    } catch (err) {
      setGlobalError((err as Error).message);
    } finally {
      setIsGeneratingStoryPages(false);
    }
  }

  // Per-Page-Helpers fuer Edit/Delete/Re-Roll/Add (Inkrement 2 Stufe 1)
  function updateStoryPageField(index: number, field: "title" | "body", value: string) {
    setStoryPages((prev) => {
      const next = [...prev];
      if (!next[index]) return prev;
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function removeStoryPage(index: number) {
    setStoryPages((prev) => prev.filter((_, i) => i !== index));
  }

  const [pageBusy, setPageBusy] = useState<{
    index: number;
    mode: "reroll" | "add" | "image";
  } | null>(null);
  const storyImageInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  async function rerollStoryPage(index: number) {
    setGlobalError(null);
    setPageBusy({ index, mode: "reroll" });
    try {
      const res = await fetch(
        `/api/packs/${packId}/story-pages/regenerate-one`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "replace", index }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setGlobalError(data.error ?? "Story-Page-Re-Roll fehlgeschlagen.");
        return;
      }
      const newPages: StoryPage[] = data.pack?.storyPages ?? [];
      setStoryPages(newPages);
      setGlobalSuccess(`Story-Seite ${index + 1} neu generiert.`);
    } catch (err) {
      setGlobalError((err as Error).message);
    } finally {
      setPageBusy(null);
    }
  }

  async function generateStoryPageImage(index: number) {
    setGlobalError(null);
    setPageBusy({ index, mode: "image" });
    try {
      const res = await fetch(
        `/api/packs/${packId}/story-pages/regenerate-image`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ index }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setGlobalError(data.error ?? "Story-Bild konnte nicht generiert werden.");
        return;
      }
      const newPages: StoryPage[] = data.pack?.storyPages ?? [];
      setStoryPages(newPages);
      setGlobalSuccess(`Story-Bild ${index + 1} generiert.`);
    } catch (err) {
      setGlobalError((err as Error).message);
    } finally {
      setPageBusy(null);
    }
  }

  async function uploadStoryPageImage(index: number, file: File) {
    setGlobalError(null);
    setPageBusy({ index, mode: "image" });
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("index", String(index));
      const res = await fetch(
        `/api/packs/${packId}/story-pages/upload-image`,
        { method: "POST", body: form }
      );
      const data = await res.json();
      if (!res.ok) {
        setGlobalError(data.error ?? "Story-Bild-Upload fehlgeschlagen.");
        return;
      }
      const newPages: StoryPage[] = data.pack?.storyPages ?? [];
      setStoryPages(newPages);
      setGlobalSuccess(`Story-Bild ${index + 1} hochgeladen.`);
    } catch (err) {
      setGlobalError((err as Error).message);
    } finally {
      setPageBusy(null);
    }
  }

  function clearStoryPageImage(index: number) {
    setStoryPages((prev) => {
      const next = [...prev];
      if (!next[index]) return prev;
      next[index] = { ...next[index], imageUrl: undefined };
      return next;
    });
  }

  function updateStoryPagePosition(
    index: number,
    position: StoryPagePosition | undefined
  ) {
    setStoryPages((prev) => {
      const next = [...prev];
      if (!next[index]) return prev;
      next[index] = { ...next[index], position };
      return next;
    });
  }

  function describePosition(pos: StoryPagePosition | undefined): string {
    if (!pos || pos.slot === "after-foreword") return "Nach Vorwort";
    if (pos.slot === "before-outro") return "Vor Outro";
    return `Vor Rezept ${pos.recipeNumber}`;
  }

  async function addStoryPage(kind: StoryPage["kind"]) {
    setGlobalError(null);
    setPageBusy({ index: storyPages.length, mode: "add" });
    try {
      const res = await fetch(
        `/api/packs/${packId}/story-pages/regenerate-one`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "add", kind }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setGlobalError(data.error ?? "Story-Page konnte nicht hinzugefuegt werden.");
        return;
      }
      const newPages: StoryPage[] = data.pack?.storyPages ?? [];
      setStoryPages(newPages);
      setGlobalSuccess(`Neue Story-Seite ('${kind}') hinzugefuegt.`);
    } catch (err) {
      setGlobalError((err as Error).message);
    } finally {
      setPageBusy(null);
    }
  }

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
      if (dirtyFields.has("packMode")) patch.packMode = packMode;
      if (dirtyFields.has("storyPages")) patch.storyPages = storyPages;

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

        {/* ─── Guide-Modus & Story-Seiten ──────────────────────────────── */}
        <Section
          title="Guide-Modus & Story-Seiten"
          subtitle="Im Guide-Modus bekommt das Pack zusaetzliche Seiten zwischen Vorwort und Inhaltsverzeichnis — z.B. Werdegang, Philosophie, Was-du-findest. Fuer Creator-Guides die mehr als ein Rezeptbuch sein sollen."
          brand={brand}
        >
          <div className="space-y-4">
            {/* Pack-Mode Toggle */}
            <div className="flex items-center gap-3">
              <label className="text-[12px] font-medium" style={{ color: brand.tokens.ink }}>
                Pack-Modus
              </label>
              <div
                className="inline-flex rounded-full border p-1"
                style={{ borderColor: brand.tokens.line, background: brand.tokens.background }}
              >
                <button
                  type="button"
                  onClick={() => setPackMode("recipebook")}
                  className="rounded-full px-4 py-1.5 text-[12px] font-medium transition"
                  style={
                    packMode === "recipebook"
                      ? { background: brand.tokens.ink, color: brand.tokens.background }
                      : { color: brand.tokens.inkMuted }
                  }
                >
                  Rezeptbuch
                </button>
                <button
                  type="button"
                  onClick={() => setPackMode("guide")}
                  className="rounded-full px-4 py-1.5 text-[12px] font-medium transition"
                  style={
                    packMode === "guide"
                      ? { background: brand.tokens.ink, color: brand.tokens.background }
                      : { color: brand.tokens.inkMuted }
                  }
                >
                  Guide
                </button>
              </div>
              <span className="text-[11px]" style={{ color: brand.tokens.inkMuted }}>
                {packMode === "guide"
                  ? "Story-Seiten werden zwischen Vorwort und Inhaltsverzeichnis gerendert."
                  : "Klassischer Pack-Aufbau ohne Story-Seiten."}
              </span>
            </div>

            {/* Story-Pages-Liste — nur sichtbar im Guide-Modus */}
            {packMode === "guide" ? (
              <div
                className="rounded-2xl border p-4"
                style={{ borderColor: brand.tokens.line, background: brand.tokens.background }}
              >
                {storyPages.length === 0 ? (
                  <div className="flex flex-col items-start gap-3">
                    <p className="text-[12px]" style={{ color: brand.tokens.inkMuted }}>
                      Noch keine Story-Seiten generiert. KI schlaegt 3 Standard-Themen vor: Meine
                      Geschichte, Mein Why, Was dich erwartet.
                    </p>
                    <button
                      type="button"
                      onClick={handleGenerateStoryPages}
                      disabled={isGeneratingStoryPages}
                      className="rounded-full px-4 py-2 text-[12px] font-semibold disabled:opacity-40"
                      style={{ background: brand.tokens.accent, color: brand.tokens.background }}
                    >
                      {isGeneratingStoryPages
                        ? "Generiere Story-Seiten…"
                        : "Story-Seiten generieren"}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {storyPages.map((p, idx) => {
                      const isThisRerolling =
                        pageBusy?.index === idx && pageBusy.mode === "reroll";
                      return (
                        <div
                          key={p.id}
                          className="rounded-xl border p-4"
                          style={{
                            borderColor: brand.tokens.line,
                            background: brand.tokens.surface,
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span
                                className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                                style={{
                                  background: brand.tokens.accentSoft,
                                  color: brand.tokens.accent,
                                }}
                              >
                                Story · {String(idx + 1).padStart(2, "0")}
                              </span>
                              <span
                                className="text-[10px] uppercase tracking-wide"
                                style={{ color: brand.tokens.inkMuted }}
                              >
                                {p.kind}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => rerollStoryPage(idx)}
                                disabled={!!pageBusy}
                                className="rounded-full border px-3 py-1 text-[11px] font-medium disabled:opacity-40"
                                style={{
                                  borderColor: brand.tokens.line,
                                  color: brand.tokens.ink,
                                }}
                              >
                                {isThisRerolling ? "Generiere…" : "Re-Roll"}
                              </button>
                              <button
                                type="button"
                                onClick={() => removeStoryPage(idx)}
                                disabled={!!pageBusy}
                                className="rounded-full border px-3 py-1 text-[11px] font-medium disabled:opacity-40"
                                style={{
                                  borderColor: brand.tokens.line,
                                  color: brand.tokens.inkMuted,
                                }}
                                title="Diese Seite loeschen (nimmt erst beim Speichern Wirkung)"
                              >
                                Loeschen
                              </button>
                            </div>
                          </div>
                          <input
                            value={p.title}
                            onChange={(e) =>
                              updateStoryPageField(idx, "title", e.target.value)
                            }
                            className="editor-input mt-3 !text-[16px] !font-semibold"
                            style={{ fontFamily: "var(--font-fraunces)" }}
                            placeholder="Story-Titel"
                            maxLength={200}
                          />
                          <textarea
                            value={p.body}
                            onChange={(e) =>
                              updateStoryPageField(idx, "body", e.target.value)
                            }
                            className="editor-input mt-2 min-h-[180px] !text-[12px] leading-relaxed"
                            placeholder="Story-Body, 2-4 Absaetze, getrennt durch leere Zeilen…"
                            maxLength={2000}
                          />

                          {/* Position-Section */}
                          <div
                            className="mt-3 flex flex-wrap items-center gap-2"
                          >
                            <span
                              className="text-[11px] font-medium"
                              style={{ color: brand.tokens.inkMuted }}
                            >
                              Position:
                            </span>
                            <select
                              value={p.position?.slot ?? "after-foreword"}
                              onChange={(e) => {
                                const slot = e.target.value as StoryPagePosition["slot"];
                                if (slot === "after-foreword") {
                                  updateStoryPagePosition(idx, {
                                    slot: "after-foreword",
                                  });
                                } else if (slot === "before-outro") {
                                  updateStoryPagePosition(idx, {
                                    slot: "before-outro",
                                  });
                                } else {
                                  updateStoryPagePosition(idx, {
                                    slot: "before-recipe",
                                    recipeNumber:
                                      p.position?.slot === "before-recipe"
                                        ? p.position.recipeNumber
                                        : 1,
                                  });
                                }
                              }}
                              className="rounded-md border px-2 py-1 text-[11px]"
                              style={{
                                borderColor: brand.tokens.line,
                                color: brand.tokens.ink,
                                background: brand.tokens.surface,
                              }}
                            >
                              <option value="after-foreword">Nach Vorwort</option>
                              <option value="before-recipe">Vor Rezept …</option>
                              <option value="before-outro">Vor Outro</option>
                            </select>
                            {p.position?.slot === "before-recipe" ? (
                              <input
                                type="number"
                                min={1}
                                max={Math.max(1, pack.recipeCount ?? 99)}
                                value={p.position.recipeNumber}
                                onChange={(e) => {
                                  const n = Math.max(
                                    1,
                                    Math.min(
                                      pack.recipeCount ?? 99,
                                      Number.parseInt(e.target.value, 10) || 1
                                    )
                                  );
                                  updateStoryPagePosition(idx, {
                                    slot: "before-recipe",
                                    recipeNumber: n,
                                  });
                                }}
                                className="w-16 rounded-md border px-2 py-1 text-[11px]"
                                style={{
                                  borderColor: brand.tokens.line,
                                  color: brand.tokens.ink,
                                  background: brand.tokens.surface,
                                }}
                              />
                            ) : null}
                            <span
                              className="text-[10px]"
                              style={{ color: brand.tokens.inkMuted }}
                            >
                              {describePosition(p.position)}
                            </span>
                          </div>

                          {/* Bild-Section */}
                          <div className="mt-3 flex flex-wrap items-center gap-3">
                            {p.imageUrl ? (
                              <div
                                className="relative h-20 w-32 overflow-hidden rounded-md border"
                                style={{ borderColor: brand.tokens.line }}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={p.imageUrl}
                                  alt={`Story-Bild ${idx + 1}`}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                            ) : (
                              <div
                                className="flex h-20 w-32 items-center justify-center rounded-md border text-[11px]"
                                style={{
                                  borderColor: brand.tokens.line,
                                  color: brand.tokens.inkMuted,
                                  background: brand.tokens.accentSoft,
                                }}
                              >
                                Kein Bild
                              </div>
                            )}
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => generateStoryPageImage(idx)}
                                disabled={!!pageBusy}
                                className="rounded-full px-3 py-1.5 text-[11px] font-semibold disabled:opacity-40"
                                style={{
                                  background: brand.tokens.accent,
                                  color: brand.tokens.background,
                                }}
                              >
                                {pageBusy?.index === idx && pageBusy.mode === "image"
                                  ? "Generiere…"
                                  : p.imageUrl
                                    ? "Bild neu generieren"
                                    : "Bild generieren"}
                              </button>
                              <input
                                ref={(el) => {
                                  storyImageInputRefs.current[p.id] = el;
                                }}
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/heic"
                                hidden
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) uploadStoryPageImage(idx, file);
                                  e.target.value = "";
                                }}
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  storyImageInputRefs.current[p.id]?.click()
                                }
                                disabled={!!pageBusy}
                                className="rounded-full border px-3 py-1.5 text-[11px] font-medium disabled:opacity-40"
                                style={{
                                  borderColor: brand.tokens.line,
                                  color: brand.tokens.ink,
                                }}
                              >
                                Hochladen
                              </button>
                              {p.imageUrl ? (
                                <button
                                  type="button"
                                  onClick={() => clearStoryPageImage(idx)}
                                  disabled={!!pageBusy}
                                  className="rounded-full border px-3 py-1.5 text-[11px] font-medium disabled:opacity-40"
                                  style={{
                                    borderColor: brand.tokens.line,
                                    color: brand.tokens.inkMuted,
                                  }}
                                >
                                  Bild entfernen
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Bottom-Bar mit Aktionen */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleGenerateStoryPages}
                        disabled={isGeneratingStoryPages || !!pageBusy}
                        className="rounded-full border px-4 py-2 text-[12px] font-semibold disabled:opacity-40"
                        style={{
                          borderColor: brand.tokens.line,
                          color: brand.tokens.ink,
                        }}
                      >
                        {isGeneratingStoryPages
                          ? "Generiere alle neu…"
                          : "Alle 3 neu generieren"}
                      </button>
                      <span
                        className="text-[11px]"
                        style={{ color: brand.tokens.inkMuted }}
                      >
                        ·
                      </span>
                      <span
                        className="text-[11px] font-medium"
                        style={{ color: brand.tokens.inkMuted }}
                      >
                        Seite hinzufuegen:
                      </span>
                      {(
                        [
                          { kind: "personal-story", label: "Geschichte" },
                          { kind: "philosophy", label: "Philosophie" },
                          { kind: "what-you-find", label: "Was du findest" },
                          { kind: "custom", label: "Frei" },
                        ] as Array<{ kind: StoryPage["kind"]; label: string }>
                      ).map(({ kind, label }) => (
                        <button
                          key={kind}
                          type="button"
                          onClick={() => addStoryPage(kind)}
                          disabled={!!pageBusy || isGeneratingStoryPages}
                          className="rounded-full px-3 py-1.5 text-[11px] font-semibold disabled:opacity-40"
                          style={{
                            background: brand.tokens.accentSoft,
                            color: brand.tokens.accent,
                          }}
                        >
                          + {label}
                        </button>
                      ))}
                      {pageBusy?.mode === "add" ? (
                        <span
                          className="text-[11px]"
                          style={{ color: brand.tokens.inkMuted }}
                        >
                          Generiere neue Seite…
                        </span>
                      ) : null}
                    </div>

                    <div
                      className="text-[11px]"
                      style={{ color: brand.tokens.inkMuted }}
                    >
                      Bilder werden in 16:9-Querformat generiert und passen
                      ins Story-Page-Layout. Manueller Upload geht via
                      &quot;Hochladen&quot; (JPG/PNG/WebP/HEIC, max 12 MB).
                    </div>
                  </div>
                )}
              </div>
            ) : null}
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
