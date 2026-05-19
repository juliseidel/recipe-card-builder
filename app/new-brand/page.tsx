"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type {
  Brand,
  BrandAudienceAnalysis,
  BrandPlatform,
  BrandVoiceProfile,
} from "@/lib/brands";
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
import { formatFollowersCompact } from "@/lib/format-followers";
import type { PackType } from "@/lib/fitness/types";
import { SiteHeader } from "@/components/site-header";
import { BrandHubCard } from "@/components/brand-hub-card";

// Helper: grammatikalisch korrekte Standard-Anrede aus Vorname + Geschlecht.
// Wird verwendet wenn der User keine eigene Signature gesetzt hat — sowohl
// im Live-Preview als auch im Save-Pfad. Bei neutralen Brands (Marken-
// Accounts wie "Bienesfitlife", "Healthy Kitchen Co.") fallen wir auf
// einen geschlechtsneutralen Sign-off zurueck.
function derivedSignature(
  name: string,
  gender: "male" | "female" | "neutral"
): string {
  const cleanName = name.trim();
  if (!cleanName) return "Dein Creator";
  if (gender === "male") return `Dein ${cleanName}`;
  if (gender === "female") return `Deine ${cleanName}`;
  return `Bis bald, ${cleanName}`;
}

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
  // Anrede + Geschlecht — werden beim Auto-Fill aus der Gemini-Identity-
  // Analyse uebernommen. Geschlecht steuert die grammatikalische
  // Anrede-Form ("Dein Martin" vs "Deine Julia") wenn der User die
  // signature manuell zurueckaendert. Default 'neutral' bei Marken-Accounts.
  const [signature, setSignature] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "neutral">(
    "neutral"
  );
  // Follower-Count als formatierter String ("247K"). Beim Auto-Fill aus
  // Apify's raw.followersCount gesetzt — landet beim Save in
  // brand.stats.followers und wird im Workspace-Hero gezeigt.
  const [followers, setFollowers] = useState("");
  const [moodId, setMoodId] = useState(DEFAULT_BRAND_MOOD_ID);
  // Pack-Type-Default fuer diesen Brand. 'recipe' fuer Rezept-Creator
  // (Biene, Kristina, Aylin, Romina), 'fitness' fuer Trainings-Coaches
  // (Marvin, Johny, Simon, Alina, Jessica, Laetitia, Tim, Johannes, Jan).
  // Beim Pack-Anlegen wird der Wert als Vorauswahl genutzt, kann aber
  // pro Pack ueberschrieben werden.
  const [packType, setPackType] = useState<PackType>("recipe");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-Fill-State. User waehlt Plattform (Instagram / TikTok), tippt
  // Handle, KI scraped Profil + analysiert Identity + Audience. Wir
  // bekommen alle Form-Felder + Audience-Insights in einem Rutsch zurueck.
  const [platform, setPlatform] = useState<BrandPlatform>("instagram");
  const [socialHandle, setSocialHandle] = useState("");
  const [autoFillLoading, setAutoFillLoading] = useState(false);
  const [autoFillError, setAutoFillError] = useState<string | null>(null);
  const [autoFillSuccess, setAutoFillSuccess] = useState<string | null>(null);
  // Audience-Insights aus dem KI-Analyzer. Wird im Onboarding direkt unter
  // dem Schnellstart als Karte gerendert und beim Save in brand.audienceAnalysis
  // persistiert. null = noch nichts analysiert oder Audience-Call failed.
  const [detectedAudience, setDetectedAudience] =
    useState<BrandAudienceAnalysis | null>(null);
  // Voice-Profil aus dem KI-Analyzer (Tonalitaets-DNA fuer alle spaeteren
  // Text-Generierungen — Pack-Titel, Description, Foreword). Beim Save in
  // brand.voiceProfile persistiert. null = noch nichts analysiert oder Call failed.
  const [detectedVoice, setDetectedVoice] = useState<BrandVoiceProfile | null>(null);
  const [followersCount, setFollowersCount] = useState<number | null>(null);
  // Style-Template-Auswahl ist deaktiviert (Mai 2026): jeder Creator
  // bekommt seine Brand-DNA als Code-Brand in lib/ai/brand-image-style.ts
  // hand-kalibriert. brand.imageStyle bleibt null im DB-Eintrag.

  const handleAutoFill = async () => {
    if (!socialHandle.trim() || autoFillLoading) return;
    setAutoFillLoading(true);
    setAutoFillError(null);
    setAutoFillSuccess(null);
    try {
      const res = await fetch("/api/brands/analyze-instagram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle: socialHandle.trim(),
          platform,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(
          data?.error ??
            `Konnte das ${platform === "tiktok" ? "TikTok" : "Instagram"}-Profil nicht analysieren.`
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
        gender?: "male" | "female" | "neutral";
        suggestedPackType?: PackType;
      };
      setName(id.name);
      setFullName(id.fullName);
      setBio(id.bio);
      setTagline(id.tagline);
      setNiche(id.niche);
      // Gender + Signature aus Gemini-Identity uebernehmen — User kann
      // beides nachher noch im Formular editieren falls die KI daneben lag.
      setGender(id.gender ?? "neutral");
      setSignature(id.signature ?? "");
      // Pack-Type-Vorschlag uebernehmen — User kann im Workspace-Typ-
      // Picker (Section 03) trotzdem manuell ueberschreiben. Bei Marvin,
      // Simon, Alina etc. setzt das automatisch 'fitness'; bei Biene,
      // Kristina, Aylin, Romina 'recipe'.
      if (id.suggestedPackType) {
        setPackType(id.suggestedPackType);
      }
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
      // Follower-Count aus dem Apify-Profil. Wir behalten sowohl die Zahl
      // (fuer den Live-Preview unten + Audience-Karte) als auch den
      // formatierten String fuer brand.stats.followers.
      const rawFollowers = data.raw?.followersCount as number | undefined;
      if (typeof rawFollowers === "number" && rawFollowers > 0) {
        setFollowers(formatFollowersCompact(rawFollowers));
        setFollowersCount(rawFollowers);
      }
      // Audience-Analyse: optional. Wenn der Gemini-Audience-Call failed,
      // ist data.audience null — wir zeigen dann keine Audience-Karte,
      // aber das Onboarding laeuft trotzdem normal weiter.
      if (data.audience) {
        setDetectedAudience(data.audience as BrandAudienceAnalysis);
      } else {
        setDetectedAudience(null);
      }
      // Voice-Profil ist optional — wenn die Analyse fehlschlaegt, fallen
      // spaetere Text-Pipelines auf Bio/Tagline-basierte Defaults zurueck.
      if (data.voiceProfile) {
        setDetectedVoice(data.voiceProfile as BrandVoiceProfile);
      } else {
        setDetectedVoice(null);
      }
      const audienceNote = data.audience
        ? " · Zielgruppe analysiert"
        : "";
      const platformLabel = platform === "tiktok" ? "TikTok" : "Instagram";
      setAutoFillSuccess(
        `${platformLabel}-Profil @${data.raw?.handle ?? socialHandle} importiert${audienceNote}.`
      );
    } catch (err) {
      setAutoFillError(
        err instanceof Error ? err.message : "Auto-Fill fehlgeschlagen."
      );
    } finally {
      setAutoFillLoading(false);
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
      // Signature-Preview: wenn der User (oder Gemini) eine Signature
      // gesetzt hat, nutze die. Sonst leite aus gender + name ab —
      // grammatikalisch korrekt fuer "Dein Martin" vs "Deine Julia".
      signature: signature.trim() || derivedSignature(name.trim(), gender),
      gender,
      avatar: avatarUrl ?? "",
      stats: {
        followers: followers.trim(),
        niche: niche.trim() || DEFAULT_BRAND_STATS.niche,
      },
      tokens: selectedMood,
      fonts: DEFAULT_BRAND_FONTS,
      packCount: 0,
      recipeCount: 0,
      platform,
    }),
    [name, fullName, handle, bio, tagline, niche, signature, gender, followers, avatarUrl, selectedMood, platform]
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
      // Save: User-Override > Gemini-Output > Default aus gender+name
      signature: signature.trim() || derivedSignature(name.trim(), gender),
      gender,
      avatar: avatarUrl ?? "",
      stats: {
        followers: followers.trim(),
        niche: niche.trim() || DEFAULT_BRAND_STATS.niche,
      },
      tokens: selectedMood,
      fonts: DEFAULT_BRAND_FONTS,
      packCount: 0,
      recipeCount: 0,
      // Plattform-Marker fuer Reel-Backfill, Recipe-Import + Daily-Refresh.
      platform,
      // Audience-Insights aus dem KI-Analyzer (optional — wenn der Audience-
      // Call gescheitert ist, lassen wir das Feld weg).
      ...(detectedAudience ? { audienceAnalysis: detectedAudience } : {}),
      // Voice-Profil aus dem KI-Analyzer (Tonalitaets-DNA). Wird von allen
      // spaeteren Pack-Text-Pipelines gelesen. Optional — fehlt es, fallen
      // die Pipelines auf Bio-basierte Defaults zurueck.
      ...(detectedVoice ? { voiceProfile: detectedVoice } : {}),
      // Pack-Type-Default fuer alle spaeteren Pack-Anlegen-Aktionen
      // dieses Brands. User kann pro Pack ueberschreiben.
      defaultPackType: packType,
      // imageStyle wird bewusst NICHT gesetzt — Brand-DNA wird per
      // Code-Brand in lib/ai/brand-image-style.ts hand-kalibriert.
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

    // 2-Jahres-Reel-Backfill triggern. AWAIT statt fire-and-forget:
    // sonst kann der Browser den Request beim router.push abbrechen,
    // bevor er bei Vercel angekommen ist — Folge: Banner taucht im
    // Workspace nie auf, weil keine creator_scrapes-Row existiert.
    // Plus: wir koennen jetzt klare Setup-Errors abfangen (503 +
    // needsSetup=true bei fehlender SQL-Migration).
    const cleanedUsername = normalizeHandle(handle).replace(/^@+/, "").trim();
    if (cleanedUsername && cleanedUsername !== "creator") {
      try {
        const backfillRes = await fetch("/api/brands/backfill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brandSlug: saved.slug,
            username: cleanedUsername,
            platform,
          }),
        });
        if (!backfillRes.ok) {
          const errJson = await backfillRes.json().catch(() => ({}));
          if (errJson.needsSetup) {
            setSaving(false);
            setError(
              "Workspace wurde angelegt, aber die Reel-Library kann nicht starten: "
              + (errJson.error ?? "Setup unvollständig.")
              + " Nach dem Einspielen der SQL-Migration lege den Workspace erneut an."
            );
            // Workspace existiert schon — User kann jederzeit hin
            // navigieren. Wir blockieren nicht weiter.
            return;
          }
          console.warn("[new-brand] backfill failed:", errJson.error);
          // Sonstiger Fehler: Workspace funktioniert trotzdem, nur ohne
          // Reel-Library. Stiller Fortschritt, kein Block.
        }
      } catch (err) {
        // Netzwerk-Fehler — Workspace funktioniert trotzdem.
        console.warn("[new-brand] backfill request failed:", err);
      }
    }

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
                Recipe Card Builder · Neuer Workspace
              </span>
              <h1 className="font-display text-[40px] leading-[1.05] tracking-[-0.015em] text-ink">
                Neuen Creator anlegen
              </h1>
              <p className="text-[14px] leading-relaxed text-ink-muted">
                Plattform wählen, Profil importieren oder Felder manuell
                füllen — der Workspace ist mit einem Klick betriebsbereit.
                Inklusive automatischer Reel-Library, Zielgruppen-Analyse
                und KI-Bild-Pipeline.
              </p>
            </header>

            {/* Profil-Import — Schnellstart aus Instagram oder TikTok */}
            <section
              className="editor-section flex flex-col gap-5 rounded-3xl border-2 p-6"
              style={{
                borderColor: "var(--color-line-strong)",
                background:
                  "linear-gradient(135deg, var(--color-accent-soft) 0%, var(--color-canvas) 100%)",
              }}
            >
              <div className="flex flex-col gap-1">
                <h2 className="font-display text-[22px] leading-tight tracking-[-0.01em] text-ink">
                  Profil importieren
                </h2>
                <p className="text-[12.5px] leading-relaxed text-ink-muted">
                  Wähle die Plattform und den Handle — die KI lädt Bio,
                  Avatar, Follower-Zahl und analysiert direkt die Zielgruppe.
                </p>
              </div>

              {/* PLATTFORM-TABS — Instagram + TikTok */}
              <div
                className="grid grid-cols-2 gap-2 rounded-2xl p-1.5"
                role="tablist"
                aria-label="Plattform"
                style={{
                  background: "rgba(255,255,255,0.55)",
                  border: "1px solid var(--color-line)",
                }}
              >
                <PlatformTab
                  label="Instagram"
                  hint="Reels · Posts · Carousels"
                  icon="instagram"
                  active={platform === "instagram"}
                  onClick={() => setPlatform("instagram")}
                />
                <PlatformTab
                  label="TikTok"
                  hint="Videos · Captions"
                  icon="tiktok"
                  active={platform === "tiktok"}
                  onClick={() => setPlatform("tiktok")}
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex flex-1 flex-col gap-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                    {platform === "tiktok" ? "TikTok-Handle" : "Instagram-Handle"}
                  </label>
                  <input
                    className="editor-input"
                    type="text"
                    placeholder={
                      platform === "tiktok"
                        ? "@creator-handle"
                        : "@creator-handle"
                    }
                    value={socialHandle}
                    onChange={(e) => setSocialHandle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleAutoFill();
                      }
                    }}
                    maxLength={50}
                    disabled={autoFillLoading}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAutoFill}
                  disabled={!socialHandle.trim() || autoFillLoading}
                  className="rounded-full bg-ink px-5 py-2.5 text-[13px] font-semibold text-white transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {autoFillLoading
                    ? "Lade Profil…"
                    : platform === "tiktok"
                      ? "TikTok importieren"
                      : "Instagram importieren"}
                </button>
              </div>

              {autoFillLoading ? (
                <p className="text-[12px] leading-relaxed text-ink-muted">
                  Apify scraped das Profil, Gemini extrahiert Identität und
                  analysiert die Zielgruppe parallel — kann 15–30 Sekunden
                  dauern.
                </p>
              ) : null}

              {autoFillError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
                  {autoFillError}
                </div>
              ) : null}

              {autoFillSuccess ? (
                <div
                  className="rounded-xl border px-4 py-3 text-[13px]"
                  style={{
                    borderColor: "rgba(34, 139, 34, 0.3)",
                    background: "rgba(220, 252, 231, 0.6)",
                    color: "#166534",
                  }}
                >
                  ✓ {autoFillSuccess}
                </div>
              ) : null}
            </section>

            {/* AUDIENCE-INSIGHTS — taucht nur auf, wenn der Audience-Analyzer
                Daten geliefert hat. Zeigt Demografie, Interests, Pain Points
                und die KI-Zusammenfassung. Wird beim Save in
                brand.audienceAnalysis persistiert. */}
            {detectedAudience ? (
              <section className="editor-section editor-card flex flex-col gap-4">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
                      KI-Analyse · Zielgruppe
                    </span>
                    <h2 className="font-display text-[20px] leading-tight tracking-[-0.01em] text-ink">
                      Audience-Profil
                    </h2>
                  </div>
                  {followersCount !== null ? (
                    <span className="text-[12px] font-medium tabular-nums text-ink-muted">
                      {followersCount.toLocaleString("de-DE")} Follower
                    </span>
                  ) : null}
                </div>

                <p className="text-[14px] leading-relaxed text-ink">
                  {detectedAudience.summary}
                </p>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <AudienceStat
                    label="Demografie"
                    value={detectedAudience.primaryDemographic}
                  />
                  <AudienceStat
                    label="Alters-Range"
                    value={detectedAudience.ageRange}
                  />
                  <AudienceStat
                    label="Geschlecht"
                    value={detectedAudience.genderTendency}
                  />
                  <AudienceStat
                    label="Content-Style"
                    value={detectedAudience.contentStyle}
                  />
                  <AudienceStat
                    label="Tonalität"
                    value={detectedAudience.tonality}
                  />
                </div>

                {detectedAudience.interests.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                      Interessen
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {detectedAudience.interests.map((interest) => (
                        <span
                          key={interest}
                          className="rounded-full border px-2.5 py-1 text-[12px]"
                          style={{
                            borderColor: "rgba(26, 18, 11, 0.14)",
                            background: "rgba(255,255,255,0.6)",
                            color: "var(--color-ink)",
                          }}
                        >
                          {interest}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {detectedAudience.painPoints.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                      Bedürfnisse · Pain Points
                    </span>
                    <ul className="flex flex-col gap-1 text-[13px] leading-relaxed text-ink">
                      {detectedAudience.painPoints.map((pp) => (
                        <li key={pp} className="flex items-start gap-2">
                          <span
                            className="mt-2 size-1 shrink-0 rounded-full"
                            style={{ background: "var(--color-ink-muted)" }}
                          />
                          {pp}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <p className="text-[11px] leading-relaxed text-ink-subtle">
                  Wird im Workspace gespeichert und vom Pack-Suggester
                  genutzt, um Vorschläge auf die echte Zielgruppe zu
                  kalibrieren.
                </p>
              </section>
            ) : null}

            {/* Section 1 — Identity */}
            <section className="editor-section editor-card flex flex-col gap-5">
              <SectionHeader
                num="01"
                title="Identität"
                hint="Wie heißt der Creator, unter welchem Handle erreichst du ihn?"
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

              <Field
                label={platform === "tiktok" ? "TikTok-Handle" : "Instagram-Handle"}
                required
              >
                <input
                  className="editor-input"
                  type="text"
                  placeholder='z. B. „@linamueller"'
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  maxLength={40}
                />
              </Field>

              <Field
                label="Follower"
                hint="Kompakte Schreibweise — taucht im Hub und im Workspace-Hero auf"
              >
                <input
                  className="editor-input"
                  type="text"
                  placeholder='z. B. „280K" oder „1.2M"'
                  value={followers}
                  onChange={(e) => setFollowers(e.target.value)}
                  maxLength={20}
                />
              </Field>

              <Field label="Niche / Tagline (optional)">
                <input
                  className="editor-input"
                  type="text"
                  placeholder={
                    platform === "tiktok"
                      ? 'z. B. „Fitness · Food · 280K TikTok"'
                      : 'z. B. „Fitness · Food · 280K Instagram"'
                  }
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
                  placeholder='z. B. „Healthy Food Creator, Fokus auf Mealprep und High-Protein-Rezepte für Berufstätige."'
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

              <Field
                label="Geschlecht"
                hint='Steuert die Anrede am Pack-Ende. Bei Marken-Accounts (keine konkrete Person) wähle „Neutral".'
              >
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { id: "female", label: "Weiblich (Deine)" },
                      { id: "male", label: "Männlich (Dein)" },
                      { id: "neutral", label: "Neutral / Marke" },
                    ] as const
                  ).map((opt) => {
                    const active = gender === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setGender(opt.id)}
                        className="rounded-full border px-4 py-1.5 text-[13px] font-medium transition-colors"
                        style={{
                          borderColor: active
                            ? selectedMood.accent
                            : "rgba(43, 31, 25, 0.2)",
                          background: active
                            ? selectedMood.accent
                            : "transparent",
                          color: active ? "#fff" : "rgba(43, 31, 25, 0.7)",
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <Field
                label="Anrede / Sign-off"
                hint='Wie soll sich der Creator am Pack-Ende verabschieden? Standard wird aus Geschlecht abgeleitet ("Dein Martin" / "Deine Julia"). Eigene Anrede möglich: „Cheers, Lukas", „Eure Sophie", „Bis bald, Mia".'
              >
                <input
                  className="editor-input"
                  type="text"
                  placeholder={derivedSignature(name || "Creator", gender)}
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  maxLength={30}
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

            {/* Section 3 — Pack-Typ-Default */}
            <section className="editor-section editor-card flex flex-col gap-5">
              <SectionHeader
                num="03"
                title="Workspace-Typ"
                hint="Macht dieser Creator hauptsächlich Rezepte oder Fitness/Training? Steuert die Vorauswahl bei neuen Packs — pro Pack ist trotzdem ein Override möglich."
              />
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPackType("recipe")}
                  className="flex flex-col items-start gap-2 rounded-2xl border-2 p-4 text-left transition-all"
                  style={{
                    borderColor:
                      packType === "recipe"
                        ? selectedMood.accent
                        : "rgba(43,31,25,0.12)",
                    background:
                      packType === "recipe"
                        ? selectedMood.accent + "12"
                        : "white",
                  }}
                >
                  <span
                    className="text-[14px] font-semibold"
                    style={{
                      color:
                        packType === "recipe"
                          ? selectedMood.accent
                          : selectedMood.ink,
                    }}
                  >
                    Rezept-Workspace
                  </span>
                  <p
                    className="text-[12px] leading-snug"
                    style={{ color: selectedMood.inkMuted }}
                  >
                    Bienes-Stil: Rezeptkarten mit Zutaten, Schritten,
                    Nährwerten. Klassische Cookbook-Pipeline.
                  </p>
                  {packType === "recipe" ? (
                    <span
                      className="font-mono text-[10.5px] uppercase tracking-[0.14em]"
                      style={{ color: selectedMood.accent }}
                    >
                      ✓ Ausgewählt
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  onClick={() => setPackType("fitness")}
                  className="flex flex-col items-start gap-2 rounded-2xl border-2 p-4 text-left transition-all"
                  style={{
                    borderColor:
                      packType === "fitness"
                        ? selectedMood.accent
                        : "rgba(43,31,25,0.12)",
                    background:
                      packType === "fitness"
                        ? selectedMood.accent + "12"
                        : "white",
                  }}
                >
                  <span
                    className="text-[14px] font-semibold"
                    style={{
                      color:
                        packType === "fitness"
                          ? selectedMood.accent
                          : selectedMood.ink,
                    }}
                  >
                    Fitness-Workspace
                  </span>
                  <p
                    className="text-[12px] leading-snug"
                    style={{ color: selectedMood.inkMuted }}
                  >
                    Trainingskarten: Übungen, Sätze × Wdh, Technik-Cues,
                    Wochenpläne. Coaching-Pipeline.
                  </p>
                  {packType === "fitness" ? (
                    <span
                      className="font-mono text-[10.5px] uppercase tracking-[0.14em]"
                      style={{ color: selectedMood.accent }}
                    >
                      ✓ Ausgewählt
                    </span>
                  ) : null}
                </button>
              </div>
            </section>

            {/* Section 4 — Mood */}
            <section className="editor-section editor-card flex flex-col gap-5">
              <SectionHeader
                num="04"
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

// ─── PlatformTab — Tab-Button fuer Instagram / TikTok-Wahl in der
// Schnellstart-Section. Aktive Variante bekommt eine ink-Background-Fill
// + weiße Schrift, inaktive ist transparent mit grauem Text.
function PlatformTab({
  label,
  hint,
  icon,
  active,
  onClick,
}: {
  label: string;
  hint: string;
  icon: "instagram" | "tiktok";
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-left transition-all"
      style={{
        background: active ? "var(--color-ink)" : "transparent",
        color: active ? "white" : "var(--color-ink)",
      }}
    >
      <span
        className="grid size-7 shrink-0 place-items-center rounded-lg"
        style={{
          background: active ? "rgba(255,255,255,0.18)" : "rgba(26,18,11,0.06)",
          color: active ? "white" : "var(--color-ink)",
        }}
      >
        {icon === "instagram" ? <InstagramGlyph /> : <TikTokGlyph />}
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-[14px] font-semibold">{label}</span>
        <span
          className="text-[11px] opacity-75"
          style={{ color: active ? "rgba(255,255,255,0.8)" : "var(--color-ink-muted)" }}
        >
          {hint}
        </span>
      </span>
    </button>
  );
}

function InstagramGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
    </svg>
  );
}

function TikTokGlyph() {
  // Vereinfachtes TikTok-Markenzeichen: Musiknoten-Form mit dem markanten
  // Doppel-Hook. Bewusst monochrom — die echte Brand-Farb-Tripel-Layered-
  // Form wuerde im Tab-Switcher zu laut wirken.
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 4v9.5a3 3 0 1 1-3-3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M14 4c.6 2.2 2.4 3.7 5 3.7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── AudienceStat — kleine Label/Wert-Karte in der Audience-Insights-
// Section. Wird im Grid gerendert.
function AudienceStat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex flex-col gap-0.5 rounded-xl border px-3 py-2.5"
      style={{
        borderColor: "rgba(26, 18, 11, 0.10)",
        background: "rgba(255,255,255,0.55)",
      }}
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
        {label}
      </span>
      <span className="text-[13px] leading-snug text-ink">{value}</span>
    </div>
  );
}
