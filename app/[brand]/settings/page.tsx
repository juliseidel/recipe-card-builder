"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Brand } from "@/lib/brands";
import { SiteHeader } from "@/components/site-header";

// Brand-Settings-Page: nachtraegliche Korrekturen am Workspace-Brand.
// Wichtigster Use-Case: Anrede + Geschlecht korrigieren wenn die Gemini-
// Identity-Analyse beim Onboarding daneben lag (z.B. "Deine Martin" statt
// "Dein Martin"). Plus: Bio/Tagline/Avatar editierbar.
//
// Tokens/Mood sind hier NICHT editierbar — das ist eine groessere Design-
// Entscheidung und gehoert eher in ein dediziertes Mood-Tool. Hier nur die
// Identity-Felder, die der User am haeufigsten anpassen will.

type RouteParams = { params: Promise<{ brand: string }> };

// Helper: grammatikalisch korrekte Standard-Anrede (mirror der Funktion
// aus /new-brand/page.tsx — bewusst nicht shared in lib/ weil beide Pages
// ihre eigenen UI-Defaults haben sollten).
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

export default function BrandSettingsPage({ params }: RouteParams) {
  const router = useRouter();
  const { brand: brandSlug } = use(params);

  const [brand, setBrand] = useState<Brand | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Editable fields
  const [name, setName] = useState("");
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [tagline, setTagline] = useState("");
  const [signature, setSignature] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "neutral">(
    "neutral"
  );

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch(`/api/brands/${brandSlug}`);
        const data = await res.json();
        if (!active) return;
        if (!res.ok || !data.brand) {
          setLoadError("Brand nicht gefunden.");
          setLoading(false);
          return;
        }
        const b = data.brand as Brand;
        setBrand(b);
        setName(b.name ?? "");
        setFullName(b.fullName ?? "");
        setBio(b.bio ?? "");
        setTagline(b.tagline ?? "");
        setSignature(b.signature ?? "");
        setGender(b.gender ?? "neutral");
        setLoading(false);
      } catch (err) {
        if (!active) return;
        setLoadError(err instanceof Error ? err.message : "Fehler beim Laden");
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [brandSlug]);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const res = await fetch(`/api/brands/${brandSlug}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patch: {
            name: name.trim(),
            fullName: fullName.trim() || name.trim(),
            bio: bio.trim(),
            tagline: tagline.trim(),
            gender,
            signature:
              signature.trim() || derivedSignature(name.trim(), gender),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Speichern fehlgeschlagen.");
      }
      setSaveSuccess(true);
      setBrand(data.brand as Brand);
      router.refresh();
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Speichern fehlgeschlagen."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex flex-1 items-center justify-center text-ink-muted">
          Brand wird geladen…
        </main>
      </div>
    );
  }
  if (loadError || !brand) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex flex-1 items-center justify-center text-ink-muted">
          {loadError ?? "Brand nicht gefunden."}
        </main>
      </div>
    );
  }

  const accent = brand.tokens.accent;
  const ink = brand.tokens.ink;
  const surface = brand.tokens.surface;

  return (
    <div className="flex min-h-screen flex-col" style={{ background: surface }}>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl px-6 py-10 lg:px-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Link
              href={`/${brand.slug}`}
              className="text-[12px] uppercase tracking-[0.18em]"
              style={{ color: brand.tokens.inkMuted }}
            >
              ← Zurück zu {brand.name}
            </Link>
            <h1
              className="mt-2 text-3xl font-semibold"
              style={{ color: ink, fontFamily: "Fraunces" }}
            >
              Workspace-Einstellungen
            </h1>
            <p
              className="mt-1 text-[14px]"
              style={{ color: brand.tokens.inkMuted }}
            >
              Korrigiere Anrede, Geschlecht, Bio. Änderungen greifen sofort
              für alle künftigen Pack-PDFs.
            </p>
          </div>
        </div>

        <section
          className="rounded-2xl border p-6"
          style={{
            borderColor: brand.tokens.line,
            background: "rgba(255,255,255,0.6)",
          }}
        >
          <div className="flex flex-col gap-5">
            <Field label="Workspace-Name" hint="Kurzform, wird im Hub gezeigt.">
              <input
                className="editor-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={25}
              />
            </Field>

            <Field
              label="Voller Name (optional)"
              hint="Wird auf Pack-PDFs als Author angezeigt."
            >
              <input
                className="editor-input"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                maxLength={60}
              />
            </Field>

            <Field label="Bio" hint="2–3 Sätze. Erscheint im Workspace-Hero.">
              <textarea
                className="editor-input resize-none"
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={240}
              />
            </Field>

            <Field
              label="Tagline"
              hint="Ein Satz Headline für die Hub-Übersicht."
            >
              <input
                className="editor-input"
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                maxLength={80}
              />
            </Field>

            <Field
              label="Geschlecht"
              hint='Steuert die Anrede am Pack-Ende. Bei Marken-Accounts wähle „Neutral".'
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
                        borderColor: active ? accent : ink + "20",
                        background: active ? accent : "transparent",
                        color: active ? "#fff" : ink + "B0",
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
              hint='Standard wird aus Geschlecht abgeleitet. Eigene Anrede möglich: „Cheers, Lukas", „Eure Sophie", „Bis bald, Mia".'
            >
              <input
                className="editor-input"
                type="text"
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder={derivedSignature(name || brand.name, gender)}
                maxLength={30}
              />
            </Field>

            <div className="mt-4 flex items-center justify-between gap-4">
              {saveError ? (
                <span className="text-[13px]" style={{ color: "#b91c1c" }}>
                  {saveError}
                </span>
              ) : saveSuccess ? (
                <span className="text-[13px]" style={{ color: accent }}>
                  ✓ Gespeichert. Anrede gilt für alle künftigen Pack-PDFs.
                </span>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !name.trim()}
                className="rounded-full px-5 py-2 text-[13px] font-medium transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  background: ink,
                  color: surface,
                }}
              >
                {saving ? "Speichern…" : "Speichern"}
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <label className="block text-[13px] font-semibold">{label}</label>
        {hint ? (
          <p className="mt-0.5 text-[12px] text-ink-muted">{hint}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}
