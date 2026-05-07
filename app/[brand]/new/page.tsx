"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getBrand } from "@/lib/brands";
import { getPacksForBrand, type CardLayout, type Pack } from "@/lib/packs";
import { addCustomPack, slugifyPack } from "@/lib/custom-packs";
import {
  layoutPresets,
  moodPresets,
  displayFontOptions,
} from "@/lib/pack-presets";
import { SiteHeader } from "@/components/site-header";
import { PackCover } from "@/components/pack-cover";

// Default cover used if the user doesn't upload one. Each curated pack ships
// its own image; for custom packs we fall back to the brand's first pack
// cover so there's never a broken-image preview.
const DEFAULT_COVER = "/brands/biene/packs/pack-1.jpg";

type PackEditorPageProps = {
  params: Promise<{ brand: string }>;
};

export default function NewPackPage({ params }: PackEditorPageProps) {
  const { brand: brandSlug } = use(params);
  const brand = getBrand(brandSlug);
  const router = useRouter();
  const staticPacks = useMemo(() => getPacksForBrand(brandSlug), [brandSlug]);

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [layoutId, setLayoutId] = useState<CardLayout>("editorial");
  const [moodId, setMoodId] = useState(moodPresets[0].id);
  const [displayFont, setDisplayFont] = useState<Pack["displayFont"]>(
    "fraunces"
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedMood = useMemo(
    () =>
      moodPresets.find((m) => m.id === moodId)?.mood ?? moodPresets[0].mood,
    [moodId]
  );

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
      coverImage: DEFAULT_COVER,
      mood: selectedMood,
      displayFont,
      cardLayout: layoutId,
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
    layoutId,
  ]);

  // Required fields for the save button
  const requirements = [
    { label: "Pack-Titel", ok: title.trim().length >= 3 },
    { label: "Tagline", ok: tagline.trim().length >= 5 },
    {
      label: "Beschreibung",
      ok: description.trim().length >= 10,
    },
  ];
  const missingCount = requirements.filter((r) => !r.ok).length;
  const isValid = missingCount === 0;

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
        subtitle: subtitle.trim() || category.trim() || "Eigenes Konzept",
        category: category.trim() || "Eigenes Konzept",
        tagline: tagline.trim(),
        description: description.trim(),
        coverImage: DEFAULT_COVER,
        mood: selectedMood,
        displayFont,
        cardLayout: layoutId,
      },
    });

    if (!saved) {
      setSaving(false);
      setError("Konnte das Pack nicht speichern. Bitte erneut versuchen.");
      return;
    }
    router.push(`/${brand.slug}/${saved.slug}`);
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
              <Field label="Untertitel" hint="Eine Zeile, was das Pack auszeichnet">
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
                required
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
                hint="2 Sätze. Wird auf der Cover-Seite gezeigt."
                required
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
                hint='Optional · z. B. „Frühstück", „Snacks"'
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
            </section>

            {/* Section 2 — Layout */}
            <section className="editor-section editor-card flex flex-col gap-5">
              <SectionHeader
                num="02"
                title="Karten-Layout"
                hint="Wie sehen die Rezeptkarten in diesem Pack aus? Alle Karten teilen sich ein Layout."
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {layoutPresets.map((preset) => {
                  const active = layoutId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setLayoutId(preset.id)}
                      className="flex flex-col items-start gap-1.5 rounded-2xl border-2 p-4 text-left transition-all"
                      style={{
                        borderColor: active
                          ? selectedMood.accent
                          : "var(--color-line)",
                        background: active
                          ? selectedMood.accent + "10"
                          : "white",
                      }}
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <span
                          className="text-[14px] font-semibold"
                          style={{
                            color: active
                              ? selectedMood.accent
                              : "var(--color-ink)",
                          }}
                        >
                          {preset.title}
                        </span>
                        <LayoutThumbnail
                          layout={preset.id}
                          mood={selectedMood}
                        />
                      </div>
                      <p
                        className="text-[12px] leading-snug"
                        style={{ color: "var(--color-ink-muted)" }}
                      >
                        {preset.description}
                      </p>
                      <p
                        className="mt-1 text-[10.5px] font-semibold uppercase tracking-[0.14em]"
                        style={{ color: "var(--color-ink-subtle)" }}
                      >
                        Best für: {preset.bestFor}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Section 3 — Mood */}
            <section className="editor-section editor-card flex flex-col gap-5">
              <SectionHeader
                num="03"
                title="Farb-Stimmung"
                hint="Eine Palette für alle Karten. Acht Presets mit Bienes Cream-Base."
              />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {moodPresets.map((preset) => {
                  const active = moodId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setMoodId(preset.id)}
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
                <PackCover brand={brand} pack={previewPack} totalRecipes={0} />
              ) : null}
            </div>

            <p
              className="mt-3 text-[11px] leading-relaxed"
              style={{ color: "var(--color-ink-muted)" }}
            >
              So sieht das Pack-Cover aus, bevor du Karten anlegst. Sobald du
              eine Karte erstellst, wird sie in der gewählten Layout-Variante
              gerendert — alle Karten in diesem Pack teilen sich Layout, Farben
              und Typografie.
            </p>
          </aside>
        </div>
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

// Tiny SVG schematic showing each layout's structural fingerprint. Not a
// pixel-perfect preview — just enough to differentiate "magazine" vs
// "polaroid" vs "minimal-with-mega-number" vs "macro-bars" vs "data-rows".
function LayoutThumbnail({
  layout,
  mood,
}: {
  layout: CardLayout;
  mood: { background: string; accent: string; ink: string };
}) {
  const stroke = mood.ink;
  const fill = mood.accent;
  const bg = mood.background;
  return (
    <svg width="48" height="36" viewBox="0 0 48 36" aria-hidden>
      <rect width="48" height="36" rx="4" fill={bg} opacity="0.5" />
      {layout === "editorial" && (
        <>
          <rect x="3" y="3" width="42" height="10" rx="1.5" fill={fill} opacity="0.75" />
          <rect x="3" y="15" width="22" height="2" rx="0.5" fill={stroke} />
          <rect x="3" y="19" width="14" height="2" rx="0.5" fill={stroke} opacity="0.6" />
          <rect x="3" y="25" width="42" height="2" rx="0.5" fill={fill} opacity="0.4" />
          <rect x="3" y="29" width="42" height="2" rx="0.5" fill={fill} opacity="0.4" />
        </>
      )}
      {layout === "patisserie" && (
        <>
          <rect x="3" y="3" width="22" height="3" rx="0.5" fill={stroke} />
          <rect x="3" y="9" width="18" height="2" rx="0.5" fill={stroke} opacity="0.6" />
          <rect
            x="28"
            y="6"
            width="16"
            height="14"
            rx="2"
            fill={fill}
            opacity="0.85"
            transform="rotate(-3 36 13)"
          />
          <rect x="3" y="22" width="42" height="2" rx="0.5" fill={fill} opacity="0.5" />
          <rect x="3" y="27" width="18" height="2" rx="0.5" fill={stroke} opacity="0.4" />
          <rect x="25" y="27" width="20" height="2" rx="0.5" fill={stroke} opacity="0.4" />
        </>
      )}
      {layout === "minimal" && (
        <>
          <rect x="3" y="3" width="14" height="2" rx="0.5" fill={stroke} opacity="0.5" />
          <text x="3" y="22" fontSize="14" fontWeight="bold" fill={fill}>
            01
          </text>
          <rect x="20" y="9" width="24" height="3" rx="0.5" fill={stroke} />
          <rect x="20" y="14" width="20" height="2" rx="0.5" fill={stroke} opacity="0.5" />
          <rect x="20" y="20" width="24" height="10" rx="1" fill={fill} opacity="0.7" />
        </>
      )}
      {layout === "sport" && (
        <>
          <rect x="3" y="3" width="14" height="2" rx="0.5" fill={stroke} opacity="0.5" />
          <rect x="3" y="9" width="22" height="3" rx="0.5" fill={stroke} />
          <rect x="3" y="16" width="20" height="3" rx="1.5" fill={fill} />
          <rect x="3" y="22" width="14" height="3" rx="1.5" fill={fill} opacity="0.7" />
          <rect x="3" y="28" width="18" height="3" rx="1.5" fill={fill} opacity="0.5" />
          <rect x="29" y="9" width="16" height="22" rx="1.5" fill={fill} opacity="0.7" />
        </>
      )}
      {layout === "dashboard" && (
        <>
          <rect x="3" y="3" width="42" height="6" rx="1" fill={fill} opacity="0.6" />
          <rect x="3" y="13" width="22" height="2" rx="0.5" fill={stroke} />
          <rect x="3" y="18" width="14" height="2" rx="0.5" fill={stroke} opacity="0.5" />
          <rect x="3" y="23" width="14" height="2" rx="0.5" fill={stroke} opacity="0.5" />
          <rect x="3" y="28" width="14" height="2" rx="0.5" fill={stroke} opacity="0.5" />
          <rect x="29" y="13" width="16" height="18" rx="1" fill={fill} opacity="0.6" />
        </>
      )}
    </svg>
  );
}
