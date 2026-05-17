"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Brand } from "@/lib/brands";
import { getBrandClient } from "@/lib/custom-brands";
import { getPacksForBrand, type Pack } from "@/lib/packs";
import { addCustomPack, slugifyPack } from "@/lib/custom-packs";
import { moodPresets, displayFontOptions } from "@/lib/pack-presets";
import { SiteHeader } from "@/components/site-header";
import { PackCover } from "@/components/pack-cover";
import { AutoPackForm } from "@/components/auto-pack-form";

// Initial cover for custom packs is left empty — AI generation kicks in
// fire-and-forget after save and writes the real URL back into the pack
// row. PackCover renders a skeleton while the field is empty.
const PENDING_COVER = "";

type PackEditorPageProps = {
  params: Promise<{ brand: string }>;
};

export default function NewPackPage({ params }: PackEditorPageProps) {
  const { brand: brandSlug } = use(params);
  // Brand wird async geladen — getBrandClient checked sowohl Code-Brands
  // (Biene) als auch DB-Brands (Supabase brands-Tabelle). Vorher war das
  // ein sync getBrand-Call, der DB-Brands ignoriert hat — Folge: User
  // klickt aus einem DB-Brand-Workspace auf "Neuer Pack" und sah
  // "Workspace nicht gefunden". Drei-Zustand-State: undefined = Loading,
  // null = wirklich nicht gefunden, Brand = ready.
  const [brand, setBrand] = useState<Brand | null | undefined>(undefined);
  useEffect(() => {
    let active = true;
    void getBrandClient(brandSlug).then((b) => {
      if (active) setBrand(b ?? null);
    });
    return () => {
      active = false;
    };
  }, [brandSlug]);
  const router = useRouter();
  const staticPacks = useMemo(() => getPacksForBrand(brandSlug), [brandSlug]);

  // Mode-Tab: Individuell (Form fuer Custom-Pack) oder Auto-Generate
  // (KI-Pack aus Reel-Library mit Filter-Selektoren). Auto-Tab fuer ALLE
  // Brands mit Social-Handle verfuegbar — Code-Brand Biene inklusive,
  // seit der Refresh-Pipeline (User kann via Reel-Library aktualisieren
  // jederzeit einen Backfill fuer Biene anstossen).
  const hasHandle = useMemo(() => {
    const h = brand?.handle?.replace(/^@+/, "").trim();
    return Boolean(h) && h !== "creator";
  }, [brand]);
  const [mode, setMode] = useState<"individual" | "auto">("individual");

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [moodId, setMoodId] = useState(moodPresets[0].id);
  // Custom-mood picker — when null, we use the named preset above. When set,
  // it overrides moodId. Four colours with derived defaults so the user
  // doesn't have to hand-pick contrast pairs.
  const [customMood, setCustomMood] = useState<{
    background: string;
    accent: string;
    ink: string;
    inkSoft: string;
  } | null>(null);
  const [displayFont, setDisplayFont] = useState<Pack["displayFont"]>(
    "fraunces"
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Optional user-uploaded cover. When set, we use this URL directly and
  // skip the AI generation step. When null, save kicks off Flux 2 Pro.
  const [uploadedCoverUrl, setUploadedCoverUrl] = useState<string | null>(
    null
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadCover = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("packSlug", slugifyPack(title) || "pack");
      const res = await fetch("/api/packs/cover-upload", {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!res.ok || !json.url) {
        throw new Error(json.error ?? "Upload fehlgeschlagen");
      }
      setUploadedCoverUrl(json.url as string);
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Upload fehlgeschlagen"
      );
    } finally {
      setUploading(false);
    }
  };

  const selectedMood = useMemo(() => {
    if (customMood) return customMood;
    return (
      moodPresets.find((m) => m.id === moodId)?.mood ?? moodPresets[0].mood
    );
  }, [customMood, moodId]);

  // Live-preview pack assembled from the form inputs. When fields are empty
  // we show placeholders so the cover doesn't look broken — the save button
  // still requires real values.
  const previewPack: Pack | null = useMemo(() => {
    if (!brand) return null;
    return {
      slug: slugifyPack(title) || "neues-pack",
      brandSlug: brand.slug,
      number: staticPacks.length + 1,
      title: title.trim() || "Neues Pack",
      subtitle: subtitle.trim() || "Untertitel",
      category: category.trim() || "Eigenes Konzept",
      tagline: tagline.trim() || "Deine kurze Tagline",
      description:
        description.trim() ||
        "Beschreibe in 1–2 Sätzen, worum es in diesem Pack geht.",
      recipeCount: 0,
      coverImage: uploadedCoverUrl ?? PENDING_COVER,
      mood: selectedMood,
      displayFont,
      // Pack-level fallback layout. Used only when a recipe doesn't pick its
      // own — the user picks a per-card layout in the recipe editor.
      cardLayout: "editorial",
    };
  }, [
    brand,
    staticPacks.length,
    title,
    subtitle,
    tagline,
    description,
    category,
    selectedMood,
    displayFont,
    uploadedCoverUrl,
  ]);

  // Only Pack-Titel is required — everything else has a sensible fallback
  // (subtitle / tagline / description default to a derived line so the cover
  // never looks broken). This keeps the editor fast for casual users.
  const requirements = [
    { label: "Pack-Titel", ok: title.trim().length >= 3 },
  ];
  const missingCount = requirements.filter((r) => !r.ok).length;
  const isValid = missingCount === 0;

  if (brand === undefined) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex flex-1 items-center justify-center text-ink-muted">
          Workspace wird geladen…
        </main>
      </div>
    );
  }
  if (!brand) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex flex-1 items-center justify-center text-ink-muted">
          Workspace nicht gefunden.
        </main>
      </div>
    );
  }

  const cssVars = {
    "--accent-color": selectedMood.accent,
    "--accent-color-soft": selectedMood.accent + "18",
  } as React.CSSProperties;

  const handleSave = async () => {
    if (!isValid || !previewPack) return;
    setSaving(true);
    setError(null);

    const baseSlug = slugifyPack(title);
    const slug = `${baseSlug}-${Date.now().toString(36).slice(-4)}`;

    const saved = await addCustomPack({
      brandSlug: brand.slug,
      staticPackCount: staticPacks.length,
      pack: {
        slug,
        title: title.trim(),
        // Sensible defaults for fields the user left blank — keeps the cover
        // looking complete without forcing the user to fill 5 fields.
        subtitle: subtitle.trim() || category.trim() || "Eigenes Konzept",
        category: category.trim() || "Eigenes Konzept",
        tagline: tagline.trim() || `${title.trim()} — ${brand.name}s neue Sammlung`,
        // Default leer statt Tool-Onboarding-Phrase. Vorher: "Eigene
        // Sammlung in ... Welt. Karten kannst du im Editor erstellen,
        // jede mit ihrem eigenen Layout." — landete unschoen auf dem
        // gedruckten Pack-Cover. Pack-PDF rendert description nur wenn
        // truthy, leerer String wird sauber uebersprungen.
        description: description.trim(),
        coverImage: uploadedCoverUrl ?? PENDING_COVER,
        mood: selectedMood,
        displayFont,
        // Default fallback — recipes pick their own layout on creation.
        cardLayout: "editorial",
      },
    });

    if (!saved) {
      setSaving(false);
      setError("Konnte das Pack nicht speichern. Bitte erneut versuchen.");
      return;
    }
    // Fire-and-forget AI cover generation — only if the user didn't upload
    // their own image. With an upload, the pack already has its cover URL.
    if (!uploadedCoverUrl) {
      void fetch("/api/packs/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId: saved.id }),
      }).catch(() => {
        /* swallow — cover gen is best-effort */
      });
    }
    // Tell the workspace + pack-detail pages to drop their cached server
    // render so a back-navigation shows the new pack instantly. We await
    // this so the user landing on the pack page sees fresh data.
    await fetch("/api/packs/revalidate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brandSlug: brand.slug,
        packSlug: saved.slug,
      }),
    }).catch(() => {
      /* non-blocking */
    });
    router.push(`/${brand.slug}/${saved.slug}`);
    // refresh() forces the new route to fetch fresh data instead of using
    // any client-side cached version of /[brand]/[pack].
    router.refresh();
  };

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{
        background: brand.tokens.background,
        ...cssVars,
      }}
    >
      <SiteHeader />

      <section
        className="border-b"
        style={{
          borderColor: brand.tokens.line,
          background: brand.tokens.surface,
        }}
      >
        <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-6 py-6 sm:flex-row sm:items-center sm:justify-between lg:px-10">
          <nav
            className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]"
            style={{ color: brand.tokens.inkMuted }}
          >
            <Link
              href={`/${brand.slug}`}
              className="transition-opacity hover:opacity-100"
              style={{ opacity: 0.75 }}
            >
              {brand.name}
            </Link>
            <span style={{ opacity: 0.5 }}>›</span>
            <span style={{ color: brand.tokens.ink, fontWeight: 500 }}>
              Neues Pack
            </span>
          </nav>
          <Link
            href={`/${brand.slug}`}
            className="self-start text-[12px] font-medium underline-offset-4 hover:underline sm:self-auto"
            style={{ color: brand.tokens.inkMuted }}
          >
            Abbrechen
          </Link>
        </div>
      </section>

      <main className="flex-1">
        {/* Tab-Switcher zwischen Individuell und Auto-Generate. Auto-Tab
            fuer alle Brands mit Handle — wenn die Library leer ist, zeigt
            AutoPackForm einen Quick-Scrape-Button (Reel-Library kann via
            Refresh-Button auf der Brand-Seite jederzeit gefuellt werden). */}
        {hasHandle ? (
          <div
            className="border-b"
            style={{
              borderColor: brand.tokens.line,
              background: brand.tokens.background,
            }}
          >
            <div className="mx-auto flex max-w-[1400px] gap-2 px-6 py-4 lg:px-10">
              <button
                type="button"
                onClick={() => setMode("individual")}
                className="flex items-center gap-2 rounded-full border-2 px-5 py-2.5 text-[13px] font-semibold transition-all"
                style={{
                  borderColor:
                    mode === "individual"
                      ? brand.tokens.accent
                      : brand.tokens.line,
                  background:
                    mode === "individual"
                      ? brand.tokens.surface
                      : "transparent",
                  color:
                    mode === "individual"
                      ? brand.tokens.accent
                      : brand.tokens.inkMuted,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                  <path
                    d="M3 3.5h8M3 7h8M3 10.5h5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
                Individuell anlegen
              </button>
              <button
                type="button"
                onClick={() => setMode("auto")}
                className="flex items-center gap-2 rounded-full border-2 px-5 py-2.5 text-[13px] font-semibold transition-all"
                style={{
                  borderColor:
                    mode === "auto"
                      ? brand.tokens.accent
                      : brand.tokens.line,
                  background:
                    mode === "auto"
                      ? brand.tokens.surface
                      : "transparent",
                  color:
                    mode === "auto"
                      ? brand.tokens.accent
                      : brand.tokens.inkMuted,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                  <path
                    d="M7 2v3m0 4v3m-5-5h3m4 0h3M3.5 3.5l2 2m3 3l2 2M3.5 10.5l2-2m3-3l2-2"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                  <circle cx="7" cy="7" r="1" fill="currentColor" />
                </svg>
                Auto aus Reel-Library
                <span
                  className="rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.14em]"
                  style={{
                    background:
                      mode === "auto"
                        ? brand.tokens.accent + "1a"
                        : brand.tokens.line,
                    color:
                      mode === "auto"
                        ? brand.tokens.accent
                        : brand.tokens.inkMuted,
                  }}
                >
                  KI
                </span>
              </button>
            </div>
          </div>
        ) : null}

        {mode === "auto" && hasHandle ? (
          <div className="mx-auto max-w-[1100px] px-6 py-10 lg:px-10 lg:py-14">
            <AutoPackForm brand={brand} />
          </div>
        ) : (
          <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-10 px-6 py-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:px-10 lg:py-14">
          {/* ─── FORM (left) ─── */}
          <div className="flex flex-col gap-8">
            {/* Section 1 — Identity */}
            <section className="editor-section editor-card flex flex-col gap-5">
              <SectionHeader
                num="01"
                title="Pack-Identität"
                hint="Wie heißt das Pack, worum geht's, für wen?"
              />
              <Field label="Pack-Titel" required>
                <input
                  className="editor-input"
                  type="text"
                  placeholder='z. B. „7-Tage Frühstück" oder „Schnelle Snacks"'
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={60}
                />
              </Field>
              <details className="group rounded-xl border border-dashed px-4 py-3 transition-colors hover:border-solid"
                style={{ borderColor: "var(--color-line-strong)" }}
              >
                <summary
                  className="flex cursor-pointer items-center justify-between text-[12.5px] font-semibold"
                  style={{ color: "var(--color-ink-muted)" }}
                >
                  <span className="flex items-center gap-2">
                    <span>Mehr Details (optional)</span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.14em]"
                      style={{
                        background: "var(--color-canvas-alt)",
                        color: "var(--color-ink-subtle)",
                      }}
                    >
                      kein Pflicht
                    </span>
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] group-open:hidden">
                    aufklappen
                  </span>
                  <span className="hidden font-mono text-[10px] uppercase tracking-[0.16em] group-open:inline">
                    zuklappen
                  </span>
                </summary>
                <div className="mt-4 flex flex-col gap-5">
                  <Field
                    label="Untertitel"
                    hint="Eine Zeile, was das Pack auszeichnet"
                  >
                    <input
                      className="editor-input"
                      type="text"
                      placeholder='z. B. „High-Protein Frühstücke unter 400 kcal"'
                      value={subtitle}
                      onChange={(e) => setSubtitle(e.target.value)}
                      maxLength={80}
                    />
                  </Field>
                  <Field
                    label="Tagline"
                    hint="Kurzer Teaser mit konkreten Recipe-Namen"
                  >
                    <input
                      className="editor-input"
                      type="text"
                      placeholder='z. B. „Overnight Oats, Protein-Pancakes, Frischkäse-Toast"'
                      value={tagline}
                      onChange={(e) => setTagline(e.target.value)}
                      maxLength={140}
                    />
                  </Field>
                  <Field
                    label="Beschreibung"
                    hint="2 Sätze · wird auf der Cover-Seite gezeigt"
                  >
                    <textarea
                      className="editor-input min-h-[88px] resize-none"
                      placeholder='z. B. „Sieben unkomplizierte Frühstücke unter 400 kcal mit hohem Proteingehalt — vorbereitet am Sonntag, fertig in 5 Minuten am Morgen."'
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      maxLength={240}
                    />
                  </Field>
                  <Field
                    label="Kategorie"
                    hint='z. B. „Frühstück", „Snacks"'
                  >
                    <input
                      className="editor-input"
                      type="text"
                      placeholder="Frühstück"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      maxLength={40}
                    />
                  </Field>
                </div>
              </details>
            </section>

            {/* Section 2 — Pack-Cover */}
            <section className="editor-section editor-card flex flex-col gap-5">
              <SectionHeader
                num="02"
                title="Pack-Cover"
                hint="Eigenes Bild hochladen oder von der KI passend generieren lassen."
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-start gap-2 rounded-2xl border-2 p-4 text-left transition-all"
                  style={{
                    borderColor: uploadedCoverUrl
                      ? selectedMood.accent
                      : "var(--color-line)",
                    background: uploadedCoverUrl
                      ? selectedMood.accent + "10"
                      : "white",
                  }}
                  disabled={uploading}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span
                      className="text-[14px] font-semibold"
                      style={{
                        color: uploadedCoverUrl
                          ? selectedMood.accent
                          : "var(--color-ink)",
                      }}
                    >
                      Eigenes Bild hochladen
                    </span>
                    <UploadIcon
                      color={
                        uploadedCoverUrl
                          ? selectedMood.accent
                          : "var(--color-ink-muted)"
                      }
                    />
                  </div>
                  <p
                    className="text-[12px] leading-snug"
                    style={{ color: "var(--color-ink-muted)" }}
                  >
                    {uploading
                      ? "Wird hochgeladen…"
                      : uploadedCoverUrl
                      ? "Eigenes Bild ist gesetzt — wird beim Speichern verwendet"
                      : "JPG, PNG oder WEBP, max. 8 MB"}
                  </p>
                  {uploadedCoverUrl ? (
                    <span
                      className="font-mono text-[10.5px] uppercase tracking-[0.14em]"
                      style={{ color: selectedMood.accent }}
                    >
                      ✓ Aktiv
                    </span>
                  ) : null}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setUploadedCoverUrl(null);
                    setUploadError(null);
                  }}
                  className="flex flex-col items-start gap-2 rounded-2xl border-2 p-4 text-left transition-all"
                  style={{
                    borderColor: !uploadedCoverUrl
                      ? selectedMood.accent
                      : "var(--color-line)",
                    background: !uploadedCoverUrl
                      ? selectedMood.accent + "10"
                      : "white",
                  }}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span
                      className="text-[14px] font-semibold"
                      style={{
                        color: !uploadedCoverUrl
                          ? selectedMood.accent
                          : "var(--color-ink)",
                      }}
                    >
                      KI generiert passend
                    </span>
                    <SparkleIcon
                      color={
                        !uploadedCoverUrl
                          ? selectedMood.accent
                          : "var(--color-ink-muted)"
                      }
                    />
                  </div>
                  <p
                    className="text-[12px] leading-snug"
                    style={{ color: "var(--color-ink-muted)" }}
                  >
                    Nach dem Speichern wird automatisch ein Cookbook-Cover
                    passend zu Pack-Titel, Kategorie und Farben generiert
                    (~30 Sek).
                  </p>
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleUploadCover(file);
                  // Reset so the same file can be re-selected
                  e.target.value = "";
                }}
              />
              {uploadError ? (
                <p
                  className="rounded-xl border px-4 py-2.5 text-[12.5px]"
                  style={{
                    borderColor: "#dc2626",
                    background: "#fee2e2",
                    color: "#991b1b",
                  }}
                >
                  {uploadError}
                </p>
              ) : null}
            </section>

            {/* Section 3 — Mood */}
            <section className="editor-section editor-card flex flex-col gap-5">
              <SectionHeader
                num="03"
                title="Farb-Stimmung"
                hint='Acht Presets — oder klick auf „Eigene Farben" für deine eigene Palette.'
              />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {moodPresets.map((preset) => {
                  const active = !customMood && moodId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setMoodId(preset.id);
                        setCustomMood(null);
                      }}
                      className="group flex flex-col items-stretch gap-2 rounded-2xl border-2 p-3 text-left transition-all"
                      style={{
                        borderColor: active
                          ? preset.mood.accent
                          : "var(--color-line)",
                        background: "white",
                      }}
                    >
                      <div
                        className="flex h-12 overflow-hidden rounded-xl"
                        style={{ background: preset.mood.background }}
                      >
                        <span
                          className="flex-1"
                          style={{ background: preset.mood.background }}
                        />
                        <span
                          className="w-1/3"
                          style={{ background: preset.mood.accent }}
                        />
                        <span
                          className="w-[10%]"
                          style={{ background: preset.mood.ink }}
                        />
                      </div>
                      <span
                        className="text-[12.5px] font-semibold"
                        style={{ color: preset.mood.ink }}
                      >
                        {preset.label}
                      </span>
                      <span
                        className="text-[10.5px] leading-tight"
                        style={{ color: "var(--color-ink-muted)" }}
                      >
                        {preset.hint}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Custom-mood toggle + 4-color picker */}
              <div
                className="rounded-2xl border-2 p-4"
                style={{
                  borderColor: customMood
                    ? selectedMood.accent
                    : "var(--color-line)",
                  background: customMood ? selectedMood.accent + "08" : "white",
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (customMood) {
                      setCustomMood(null);
                    } else {
                      // Seed from the currently selected preset so the picker
                      // doesn't start at white-on-white.
                      const seed =
                        moodPresets.find((m) => m.id === moodId)?.mood ??
                        moodPresets[0].mood;
                      setCustomMood({ ...seed });
                    }
                  }}
                  className="flex w-full items-center justify-between text-left"
                >
                  <div className="flex flex-col">
                    <span
                      className="text-[13px] font-semibold"
                      style={{ color: "var(--color-ink)" }}
                    >
                      Eigene Farben
                    </span>
                    <span
                      className="text-[11px]"
                      style={{ color: "var(--color-ink-muted)" }}
                    >
                      Vier Farben für Hintergrund, Akzent und Text — frei wählbar.
                    </span>
                  </div>
                  <span
                    className="rounded-full border px-3 py-1 text-[11px] font-semibold"
                    style={{
                      borderColor: customMood
                        ? selectedMood.accent
                        : "var(--color-line-strong)",
                      color: customMood
                        ? selectedMood.accent
                        : "var(--color-ink-muted)",
                      background: customMood
                        ? selectedMood.accent + "12"
                        : "transparent",
                    }}
                  >
                    {customMood ? "Aktiv — zurück zu Presets" : "Aktivieren"}
                  </span>
                </button>

                {customMood ? (
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <ColorInput
                      label="Hintergrund"
                      value={customMood.background}
                      onChange={(v) =>
                        setCustomMood({ ...customMood, background: v })
                      }
                    />
                    <ColorInput
                      label="Akzent"
                      value={customMood.accent}
                      onChange={(v) =>
                        setCustomMood({ ...customMood, accent: v })
                      }
                    />
                    <ColorInput
                      label="Tinte"
                      value={customMood.ink}
                      onChange={(v) => setCustomMood({ ...customMood, ink: v })}
                    />
                    <ColorInput
                      label="Tinte (weich)"
                      value={customMood.inkSoft}
                      onChange={(v) =>
                        setCustomMood({ ...customMood, inkSoft: v })
                      }
                    />
                  </div>
                ) : null}
              </div>
            </section>

            {/* Section 4 — Typography */}
            <section className="editor-section editor-card flex flex-col gap-5">
              <SectionHeader
                num="04"
                title="Typografie"
                hint="Display-Schrift für Pack-Cover und Titel auf den Karten."
              />
              <div className="flex flex-wrap gap-2">
                {displayFontOptions.map((font) => {
                  const active = displayFont === font.id;
                  return (
                    <button
                      key={font.id}
                      type="button"
                      onClick={() => setDisplayFont(font.id)}
                      className="flex flex-col items-start gap-1 rounded-xl border-2 px-4 py-3 text-left transition-all"
                      style={{
                        borderColor: active
                          ? selectedMood.accent
                          : "var(--color-line)",
                        background: active ? selectedMood.accent + "10" : "white",
                      }}
                    >
                      <span
                        className="text-[16px] font-semibold"
                        style={{
                          color: active
                            ? selectedMood.accent
                            : "var(--color-ink)",
                        }}
                      >
                        {font.label}
                      </span>
                      <span
                        className="text-[11px]"
                        style={{ color: "var(--color-ink-muted)" }}
                      >
                        {font.hint}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Save bar */}
            <div className="sticky bottom-4 z-10">
              <div
                className="flex flex-col gap-3 rounded-2xl border bg-white/95 p-5 shadow-[0_18px_40px_-16px_rgba(26,18,11,0.18)] backdrop-blur-md sm:flex-row sm:items-center sm:justify-between"
                style={{ borderColor: "var(--color-line)" }}
              >
                <div className="flex flex-col gap-0.5">
                  <span
                    className="text-[12px] font-semibold uppercase tracking-[0.14em]"
                    style={{ color: "var(--color-ink-muted)" }}
                  >
                    {isValid
                      ? "Bereit zu speichern"
                      : `Noch ${missingCount} Pflichtfeld${
                          missingCount === 1 ? "" : "er"
                        } offen`}
                  </span>
                  <span
                    className="text-[11px]"
                    style={{ color: "var(--color-ink-muted)" }}
                  >
                    {requirements
                      .filter((r) => !r.ok)
                      .map((r) => r.label)
                      .join(" · ") || "Pack-Titel · Tagline · Beschreibung"}
                  </span>
                </div>
                <button
                  type="button"
                  className="editor-button-primary"
                  disabled={!isValid || saving}
                  onClick={handleSave}
                  style={{
                    background: selectedMood.accent,
                    color: "white",
                  }}
                >
                  {saving ? (
                    <>
                      <span className="size-3.5 animate-spin rounded-full border-[2px] border-white/40 border-t-white" />
                      Pack wird angelegt…
                    </>
                  ) : (
                    <>
                      Pack erstellen
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 14 14"
                        fill="none"
                        aria-hidden
                      >
                        <path
                          d="M3 7h8m0 0L7.5 3.5M11 7l-3.5 3.5"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </>
                  )}
                </button>
              </div>
              {error ? (
                <p
                  className="mt-2 rounded-xl border px-4 py-2.5 text-[12.5px]"
                  style={{
                    borderColor: "#dc2626",
                    background: "#fee2e2",
                    color: "#991b1b",
                  }}
                >
                  {error}
                </p>
              ) : null}
            </div>
          </div>

          {/* ─── PREVIEW (right, sticky) ─── */}
          <aside className="lg:sticky lg:top-[120px] lg:self-start">
            <div
              className="overflow-hidden rounded-[var(--radius-card)] border"
              style={{
                borderColor: "var(--color-line)",
                background: brand.tokens.surface,
              }}
            >
              <div
                className="flex items-center justify-between border-b px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.18em]"
                style={{
                  borderColor: "var(--color-line)",
                  color: "var(--color-ink-muted)",
                  background: brand.tokens.background,
                }}
              >
                <span>Live-Vorschau</span>
                <span className="font-mono">Pack-Cover</span>
              </div>
              {previewPack ? (
                <PackCover
                  brand={brand}
                  pack={previewPack}
                  totalRecipes={0}
                  hideCoverSlot
                />
              ) : null}
            </div>

            <p
              className="mt-3 text-[11px] leading-relaxed"
              style={{ color: "var(--color-ink-muted)" }}
            >
              So sieht das Pack-Cover aus. Beim Speichern generiert die KI im
              Hintergrund (~30 Sek) ein passendes Hero-Bild für deinen Pack —
              du landest direkt auf der Pack-Seite, das Bild taucht auf, sobald
              es fertig ist. Karten kannst du dann anlegen und für jede einzeln
              ein Layout wählen.
            </p>
          </aside>
        </div>
        )}
      </main>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function SectionHeader({
  num,
  title,
  hint,
}: {
  num: string;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="editor-section-number">{num}</span>
      <div className="flex flex-col gap-1">
        <h2
          className="font-display text-[22px] leading-none tracking-[-0.01em]"
          style={{ color: "var(--color-ink)" }}
        >
          {title}
        </h2>
        <p className="text-[12.5px]" style={{ color: "var(--color-ink-muted)" }}>
          {hint}
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline gap-1.5">
        <span
          className="text-[12.5px] font-semibold"
          style={{ color: "var(--color-ink)" }}
        >
          {label}
        </span>
        {required ? (
          <span
            className="text-[10.5px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: "var(--accent-color)" }}
          >
            Pflicht
          </span>
        ) : null}
        {hint ? (
          <span
            className="text-[11px]"
            style={{ color: "var(--color-ink-subtle)" }}
          >
            · {hint}
          </span>
        ) : null}
      </span>
      {children}
    </label>
  );
}

function UploadIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <path
        d="M11 14V5m0 0L7.5 8.5M11 5l3.5 3.5M4 16v.5A2.5 2.5 0 0 0 6.5 19h9a2.5 2.5 0 0 0 2.5-2.5V16"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SparkleIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <path
        d="M11 3v3m0 10v3M3 11h3m10 0h3M5.5 5.5l2 2m7 7l2 2M5.5 16.5l2-2m7-7l2-2"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="11" cy="11" r="1.5" fill={color} />
    </svg>
  );
}

// Two-column row in the custom-mood picker: HTML color picker + hex text
// input bound to the same value. Either one updates the parent state.
function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span
        className="text-[11px] font-semibold uppercase tracking-[0.14em]"
        style={{ color: "var(--color-ink-muted)" }}
      >
        {label}
      </span>
      <div
        className="flex items-center gap-2 rounded-xl border bg-white px-2 py-1.5"
        style={{ borderColor: "var(--color-line)" }}
      >
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="size-7 cursor-pointer rounded-md border-0 bg-transparent p-0"
          style={{ background: value }}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-[12px] font-mono uppercase tracking-[0.04em] outline-none"
          style={{ color: "var(--color-ink)" }}
          maxLength={7}
        />
      </div>
    </label>
  );
}

