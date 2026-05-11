"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { Brand, BrandImageStyleOverride } from "@/lib/brands";
import {
  addCustomBrand,
  brandSlugTaken,
  slugifyBrand,
} from "@/lib/custom-brands";
import {
  brandMoodPresets,
  DEFAULT_BRAND_MOOD_ID,
  DEFAULT_BRAND_FONTS,
  DEFAULT_BRAND_STATS,
} from "@/lib/brand-presets";
import { SiteHeader } from "@/components/site-header";
import { BrandHubCard } from "@/components/brand-hub-card";

// Creator-Onboarding-Form fuer das Multi-Tenant-Tool. Schritt 3/3 des
// Hub-Umbaus: hier kommen neue Creator on-the-fly rein, mit Avatar-Upload,
// Identity-Feldern und Mood-Picker. Live-Preview rechts spiegelt die
// Hub-Card waehrend des Eingaberumms.
//
// Save-Flow:
//   1. Slug aus dem Namen generieren (slugify, dedup-Counter bei Conflict)
//   2. Brand-Object zusammenbauen — Tokens aus Mood-Preset, Fonts default
//   3. addCustomBrand() → Insert in `brands`-Tabelle
//   4. revalidate(/) → Hub re-rendert mit neuem Creator
//   5. router.push(`/welcome?brand=<slug>`) → cinematische Welcome-
//      Animation laeuft mit dem frischen Brand und landet im neuen
//      Workspace. Genau der "neuer Creator → eigene Animation"-Moment
//      aus Ingos Brief.

export default function NewBrandPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [fullName, setFullName] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [tagline, setTagline] = useState("");
  const [niche, setNiche] = useState("");
  const [moodId, setMoodId] = useState(DEFAULT_BRAND_MOOD_ID);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Instagram-Auto-Fill state. User tippt Handle → Apify scraped Profil →
  // Gemini analysiert Identity → Server uploaded Avatar. Wir bekommen
  // alle Form-Felder gleichzeitig zurueck und befuellen den State.
  // latestPosts halten wir transient — PR 5 wird sie fuer die Brand-DNA-
  // Vision-Analyse weiternutzen, ohne dass wir Apify nochmal anrufen
  // muessen.
  const [igHandle, setIgHandle] = useState("");
  const [igLoading, setIgLoading] = useState(false);
  const [igError, setIgError] = useState<string | null>(null);
  const [igSuccess, setIgSuccess] = useState<string | null>(null);
  // Brand-DNA aus der Vision-Analyse (Lighting, Scene, Camera-Aesthetic).
  // Wird beim Save in brand.imageStyle persistiert und von der Hero-
  // Pipeline (PR 5 Pipeline-Refactor) genutzt. null = noch keine Analyse,
  // oder Vision-Analyse hat fehlgeschlagen — dann Pipeline-Fallback.
  const [detectedStyle, setDetectedStyle] =
    useState<BrandImageStyleOverride | null>(null);

  const handleAutoFill = async () => {
    if (!igHandle.trim() || igLoading) return;
    setIgLoading(true);
    setIgError(null);
    setIgSuccess(null);
    try {
      const res = await fetch("/api/brands/analyze-instagram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: igHandle.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(
          data?.error ?? "Konnte das Instagram-Profil nicht analysieren."
        );
      }
      // Identity-Felder uebernehmen — User kann jedes Feld trotzdem noch
      // editieren, Auto-Fill ist nur ein Quick-Start.
      const id = data.identity as {
        name: string;
        fullName: string;
        bio: string;
        tagline: string;
        niche: string;
        signature: string;
      };
      setName(id.name);
      setFullName(id.fullName);
      setBio(id.bio);
      setTagline(id.tagline);
      setNiche(id.niche);
      // Handle ins Form-Feld zurueckspielen, falls User ihn ohne '@'
      // eingegeben hat — normalizeHandle macht das beim Save auch nochmal,
      // aber im Formular sieht es jetzt schon richtig aus.
      const cleanedHandle = data.raw?.handle as string | undefined;
      if (cleanedHandle) {
        setHandle(`@${cleanedHandle}`);
      }
      // Avatar setzen, falls Server-Upload erfolgreich war.
      if (data.avatarUrl) {
        setAvatarUrl(data.avatarUrl as string);
      }
      // Vision-Analyse: optional, kann null sein wenn zu wenige Bilder
      // verfuegbar waren oder Gemini fehlschlug. Wir speichern den Style
      // wenn vorhanden — landet beim Save in brand.imageStyle.
      if (data.imageStyle) {
        setDetectedStyle(data.imageStyle as BrandImageStyleOverride);
      }
      const styleStatus = data.imageStyle
        ? " · Brand-DNA aus den letzten Reel-Covers analysiert"
        : "";
      setIgSuccess(
        `Profil @${data.raw?.handle ?? igHandle} importiert${styleStatus} — bitte ueberpruefe die Felder unten.`
      );
    } catch (err) {
      setIgError(
        err instanceof Error ? err.message : "Auto-Fill fehlgeschlagen."
      );
    } finally {
      setIgLoading(false);
    }
  };

  const selectedMood = useMemo(() => {
    return (
      brandMoodPresets.find((m) => m.id === moodId)?.tokens ??
      brandMoodPresets[0].tokens
    );
  }, [moodId]);

  // Live-Preview-Brand fuer den BrandHubCard. Slug ist transient — beim
  // Save berechnen wir ihn nochmal frisch + checken auf Conflicts.
  const previewBrand: Brand = useMemo(
    () => ({
      slug: slugifyBrand(name) || "neuer-creator",
      name: name.trim() || "Neuer Creator",
      fullName: fullName.trim() || name.trim() || "Neuer Creator",
      handle: normalizeHandle(handle) || "@creator",
      bio:
        bio.trim() ||
        "Kurze Beschreibung des Creators — taucht auf der Hub-Card und im Workspace-Hero auf.",
      tagline: tagline.trim() || "Eigener Workspace im Recipe Card Builder",
      signature: name.trim() ? `Deine ${name.trim()}` : "Dein Creator",
      avatar: avatarUrl ?? "",
      stats: {
        followers: "",
        niche: niche.trim() || DEFAULT_BRAND_STATS.niche,
      },
      tokens: selectedMood,
      fonts: DEFAULT_BRAND_FONTS,
      packCount: 0,
      recipeCount: 0,
    }),
    [name, fullName, handle, bio, tagline, niche, avatarUrl, selectedMood]
  );

  const requirements = [
    { label: "Name", ok: name.trim().length >= 2 },
    { label: "Handle", ok: handle.trim().length >= 2 },
    { label: "Bio", ok: bio.trim().length >= 10 },
    { label: "Avatar", ok: Boolean(avatarUrl) },
  ];
  const isValid = requirements.every((r) => r.ok);

  const handleAvatarUpload = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("brandSlug", slugifyBrand(name) || "creator");
      const res = await fetch("/api/brands/avatar-upload", {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!res.ok || !json.url) {
        throw new Error(json.error ?? "Upload fehlgeschlagen");
      }
      setAvatarUrl(json.url as string);
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Upload fehlgeschlagen"
      );
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!isValid || saving) return;
    setSaving(true);
    setError(null);

    // Slug-Conflict-Resolution: wenn der Wunsch-Slug bereits genutzt ist
    // (Code oder DB), haengen wir einen kurzen Hash an. So bleibt der
    // Slug menschenlesbar (`linas-kueche-x4f`) statt UUID-Suffix.
    const baseSlug = slugifyBrand(name) || "creator";
    let slug = baseSlug;
    if (await brandSlugTaken(slug)) {
      slug = `${baseSlug}-${Math.random().toString(36).slice(2, 5)}`;
    }

    const newBrand: Brand = {
      slug,
      name: name.trim(),
      fullName: fullName.trim() || name.trim(),
      handle: normalizeHandle(handle),
      bio: bio.trim(),
      tagline: tagline.trim() || `${name.trim()}s Workspace`,
      signature: `Deine ${name.trim()}`,
      avatar: avatarUrl ?? "",
      stats: {
        followers: "",
        niche: niche.trim() || DEFAULT_BRAND_STATS.niche,
      },
      tokens: selectedMood,
      fonts: DEFAULT_BRAND_FONTS,
      packCount: 0,
      recipeCount: 0,
      // Brand-DNA aus der Vision-Analyse. Wenn detectedStyle null ist
      // (kein Auto-Fill genutzt oder Vision-Analyse fehlgeschlagen),
      // lassen wir das Feld weg — Pipeline faellt dann auf den generischen
      // Style aus brand-image-style.ts zurueck.
      ...(detectedStyle ? { imageStyle: detectedStyle } : {}),
    };

    const saved = await addCustomBrand(newBrand);
    if (!saved) {
      setSaving(false);
      setError(
        "Konnte den Workspace nicht speichern. Bitte erneut versuchen — eventuell ist die brands-Tabelle in Supabase noch nicht angelegt."
      );
      return;
    }

    // Hub-Cache invalidieren, damit der neue Workspace auf der Uebersicht
    // sofort auftaucht statt erst nach Cache-TTL.
    await fetch("/api/brands/revalidate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandSlug: saved.slug }),
    }).catch(() => {
      /* non-blocking — Cache ticked sich von selbst nach 30s neu */
    });

    // Cinematic Entry: Welcome-Animation des neuen Creators laeuft, dann
    // landet der User im frischen Workspace. Genau der "neuer Creator
    // bekommt seine eigene Animation"-Moment aus dem Pflichtenheft.
    router.push(`/welcome?brand=${encodeURIComponent(saved.slug)}`);
  };

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <SiteHeader />

      <section
        className="border-b bg-surface"
        style={{ borderColor: "rgba(43, 31, 25, 0.08)" }}
      >
        <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-6 py-6 sm:flex-row sm:items-center sm:justify-between lg:px-10">
          <nav className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-muted">
            <Link href="/" className="opacity-75 hover:opacity-100">
              Workspace-Hub
            </Link>
            <span className="opacity-50">›</span>
            <span className="font-medium text-ink">Neuer Creator</span>
          </nav>
          <Link
            href="/"
            className="self-start text-[12px] font-medium text-ink-muted underline-offset-4 hover:underline sm:self-auto"
          >
            Abbrechen
          </Link>
        </div>
      </section>

      <main className="flex-1">
        <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-10 px-6 py-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:px-10 lg:py-14">
          {/* ─── FORM ─── */}
          <div className="flex flex-col gap-8">
            <header className="flex flex-col gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
                Schritt 3/3 — Hub-Onboarding
              </span>
              <h1 className="font-display text-[40px] leading-[1.05] tracking-[-0.015em] text-ink">
                Neuen Creator anlegen
              </h1>
              <p className="text-[14px] leading-relaxed text-ink-muted">
                Avatar, Name, Handle, ein paar Sätze Bio und ein Mood — und der
                Workspace ist betriebsbereit. Du landest danach automatisch
                mit Welcome-Animation in der frischen Identität.
              </p>
            </header>

            {/* Instagram Auto-Fill — Schnellstart */}
            <section
              className="editor-section flex flex-col gap-4 rounded-3xl border-2 p-6"
              style={{
                borderColor: "var(--color-line-strong)",
                background:
                  "linear-gradient(135deg, var(--color-accent-soft) 0%, var(--color-canvas) 100%)",
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="grid size-9 shrink-0 place-items-center rounded-full"
                  style={{
                    background: "var(--color-accent)",
                    color: "white",
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 2L9 9l-7 .75 5.25 5L6 22l6-3.25L18 22l-1.25-7.25L22 9.75 15 9 12 2z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div className="flex flex-col gap-0.5">
                  <h2 className="font-display text-[20px] leading-tight text-ink">
                    Schnellstart aus Instagram
                  </h2>
                  <p className="text-[12.5px] text-ink-muted">
                    Tipp den Handle und lass die KI alles vorausfüllen — Bio,
                    Tagline, Niche und Avatar.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex flex-1 flex-col gap-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                    Instagram-Handle
                  </label>
                  <input
                    className="editor-input"
                    type="text"
                    placeholder="@bienesfitlife"
                    value={igHandle}
                    onChange={(e) => setIgHandle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleAutoFill();
                      }
                    }}
                    maxLength={50}
                    disabled={igLoading}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAutoFill}
                  disabled={!igHandle.trim() || igLoading}
                  className="rounded-full bg-ink px-5 py-2.5 text-[13px] font-semibold text-white transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {igLoading ? "Lade Profil…" : "Aus Instagram laden"}
                </button>
              </div>

              {igLoading ? (
                <p className="text-[12px] text-ink-muted">
                  Apify scraped das Profil, Gemini analysiert Identität, Avatar
                  wird hochgeladen — kann 15–30 Sekunden dauern.
                </p>
              ) : null}

              {igError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
                  {igError}
                </div>
              ) : null}

              {igSuccess ? (
                <div
                  className="rounded-xl border px-4 py-3 text-[13px]"
                  style={{
                    borderColor: "rgba(34, 139, 34, 0.3)",
                    background: "rgba(220, 252, 231, 0.6)",
                    color: "#166534",
                  }}
                >
                  ✓ {igSuccess}
                </div>
              ) : null}
            </section>

            {/* Section 1 — Identity */}
            <section className="editor-section editor-card flex flex-col gap-5">
              <SectionHeader
                num="01"
                title="Identität"
                hint="Wie heißt der Creator, unter welchem Handle ist er auf Instagram?"
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Name" required>
                  <input
                    className="editor-input"
                    type="text"
                    placeholder='z. B. „Lina"'
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={40}
                  />
                </Field>
                <Field label="Voller Name (optional)">
                  <input
                    className="editor-input"
                    type="text"
                    placeholder='z. B. „Lina Müller"'
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    maxLength={60}
                  />
                </Field>
              </div>

              <Field label="Instagram-Handle" required>
                <input
                  className="editor-input"
                  type="text"
                  placeholder='z. B. „@linamueller"'
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  maxLength={40}
                />
              </Field>

              <Field label="Niche / Tagline (optional)">
                <input
                  className="editor-input"
                  type="text"
                  placeholder='z. B. „Fitness · Food · 280K Instagram"'
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  maxLength={80}
                />
              </Field>

              <Field
                label="Bio"
                required
                hint="2–3 Sätze · taucht auf der Hub-Card und im Workspace-Hero auf"
              >
                <textarea
                  className="editor-input min-h-[88px] resize-none"
                  placeholder='z. B. „Healthy Food Creator, 280K auf Instagram, fokus auf Mealprep und High-Protein-Rezepte für Berufstätige."'
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={240}
                />
              </Field>

              <Field
                label="Tagline (optional)"
                hint="Ein Satz Headline für die Hub-Übersicht"
              >
                <input
                  className="editor-input"
                  type="text"
                  placeholder='z. B. „Schnell, sättigend, alltagstauglich"'
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  maxLength={80}
                />
              </Field>
            </section>

            {/* Section 2 — Avatar */}
            <section className="editor-section editor-card flex flex-col gap-5">
              <SectionHeader
                num="02"
                title="Avatar"
                hint="Profilbild des Creators — landet in der Hub-Card und in der Welcome-Animation."
              />
              <div className="flex items-center gap-5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="relative size-24 shrink-0 overflow-hidden rounded-full border-2 border-dashed transition-all hover:opacity-90"
                  style={{
                    borderColor: avatarUrl
                      ? selectedMood.accent
                      : "rgba(43, 31, 25, 0.18)",
                    background: avatarUrl
                      ? selectedMood.accent + "10"
                      : "white",
                  }}
                >
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt="Avatar Preview"
                      fill
                      sizes="96px"
                      className="object-cover"
                      quality={95}
                    />
                  ) : (
                    <span className="grid h-full w-full place-items-center text-[24px] font-display text-ink-muted">
                      ＋
                    </span>
                  )}
                </button>

                <div className="flex flex-1 flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="self-start rounded-full border border-line bg-canvas px-4 py-2 text-[12px] font-semibold transition-colors hover:bg-canvas-alt disabled:opacity-60"
                  >
                    {uploading
                      ? "Lade hoch…"
                      : avatarUrl
                        ? "Anderes Bild wählen"
                        : "Avatar hochladen"}
                  </button>
                  {uploadError ? (
                    <span className="text-[12px] text-red-600">
                      {uploadError}
                    </span>
                  ) : (
                    <span className="text-[12px] text-ink-muted">
                      JPEG / PNG / WebP · max. 8 MB
                    </span>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleAvatarUpload(f);
                  }}
                />
              </div>
            </section>

            {/* Section 3 — Mood */}
            <section className="editor-section editor-card flex flex-col gap-5">
              <SectionHeader
                num="03"
                title="Mood"
                hint="Farbpalette des Workspaces — Background, Akzent und derived Tokens."
              />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {brandMoodPresets.map((preset) => {
                  const isActive = preset.id === moodId;
                  return (
                    <button
                      type="button"
                      key={preset.id}
                      onClick={() => setMoodId(preset.id)}
                      className={`flex flex-col gap-2 rounded-2xl border-2 p-3 text-left transition-all ${
                        isActive ? "shadow-md" : "hover:border-line"
                      }`}
                      style={{
                        borderColor: isActive
                          ? preset.tokens.accent
                          : "rgba(43, 31, 25, 0.12)",
                        background: preset.tokens.background,
                      }}
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className="size-5 rounded-full"
                          style={{ background: preset.tokens.accent }}
                        />
                        <span
                          className="size-3 rounded-full"
                          style={{ background: preset.tokens.signature }}
                        />
                      </div>
                      <span
                        className="text-[13px] font-semibold"
                        style={{ color: preset.tokens.ink }}
                      >
                        {preset.label}
                      </span>
                      <span
                        className="text-[11px] leading-tight"
                        style={{ color: preset.tokens.inkMuted }}
                      >
                        {preset.hint}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Save */}
            <section className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3 text-[12px] text-ink-muted">
                <span className="font-semibold uppercase tracking-[0.14em]">
                  Pflichtfelder:
                </span>
                {requirements.map((req) => (
                  <span
                    key={req.label}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${
                      req.ok
                        ? "bg-green-100 text-green-800"
                        : "bg-canvas-alt text-ink-subtle"
                    }`}
                  >
                    {req.ok ? "✓" : "○"} {req.label}
                  </span>
                ))}
              </div>

              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
                  {error}
                </div>
              ) : null}

              <button
                type="button"
                onClick={handleSave}
                disabled={!isValid || saving}
                className="self-start rounded-full px-7 py-3 text-[14px] font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  background: isValid
                    ? selectedMood.accent
                    : "rgba(43, 31, 25, 0.3)",
                  boxShadow: isValid
                    ? `0 10px 30px -12px ${selectedMood.accent}`
                    : "none",
                }}
              >
                {saving
                  ? "Workspace wird angelegt…"
                  : "Workspace anlegen & eröffnen"}
              </button>
            </section>
          </div>

          {/* ─── LIVE PREVIEW ─── */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="flex flex-col gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
                Live-Vorschau · Hub-Card
              </span>
              <div className="pointer-events-none">
                <BrandHubCard
                  brand={previewBrand}
                  badge="Neu"
                />
              </div>
              <p className="text-[12px] leading-relaxed text-ink-muted">
                So sieht der Workspace im Hub aus. Nach „Workspace anlegen"
                läuft automatisch die Welcome-Animation für den neuen
                Creator — und du landest im frischen{" "}
                <span className="font-mono">/{previewBrand.slug}</span>{" "}
                Workspace.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function SectionHeader({
  num,
  title,
  hint,
}: {
  num: string;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="editor-section-number font-mono text-[11px] font-semibold tracking-[0.18em] text-ink-subtle">
        {num}
      </span>
      <div className="flex flex-col gap-0.5">
        <h2 className="font-display text-[22px] leading-tight tracking-[-0.01em] text-ink">
          {title}
        </h2>
        {hint ? (
          <p className="text-[12.5px] text-ink-muted">{hint}</p>
        ) : null}
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
      <span className="flex items-center gap-1.5 text-[12px] font-semibold text-ink">
        {label}
        {required ? (
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-subtle">
            Pflicht
          </span>
        ) : null}
      </span>
      {hint ? <span className="text-[11px] text-ink-muted">{hint}</span> : null}
      {children}
    </label>
  );
}

function normalizeHandle(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}
