"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Brand } from "@/lib/brands";
import type { Pack } from "@/lib/packs";
import { getBrandClient } from "@/lib/custom-brands";
import { getCustomPack } from "@/lib/custom-packs";
import { getPack } from "@/lib/packs";
import {
  addCustomFitnessCard,
  slugifyFitnessCard,
} from "@/lib/fitness/custom-cards";
import {
  resolvePackType,
  type BodyPart,
  type Equipment,
  type FitnessLevel,
  type WorkoutType,
  type ExerciseCard,
} from "@/lib/fitness/types";
import { SiteHeader } from "@/components/site-header";

// Editor fuer Fitness-Cards (Block 5, MVP-Fokus: ExerciseCard). Spiegel-
// Funktion zum Recipe-Editor, aber mit Fitness-spezifischen Pflichtfeldern
// (Saetze x Wdh, Cues, Common Mistakes, Variationen).
//
// Architektur:
//   - 5 Form-Sektionen + Save-Bar + Live-Preview rechts
//   - Save: addCustomFitnessCard -> fire-and-forget /api/fitness-cards/enrich
//   - Redirect auf Pack-Detail-Page nach Save
//
// Andere Card-Typen (Workout, Weekplan, Mindset, Progress, NutritionTip)
// werden in spaeteren Bloecken ergaenzt — der Editor hat noch keinen
// Type-Picker, immer 'exercise'.

const BODY_PART_OPTIONS: BodyPart[] = [
  "chest",
  "back",
  "shoulders",
  "arms",
  "legs",
  "glutes",
  "core",
  "full-body",
  "cardio-conditioning",
];

const EQUIPMENT_OPTIONS: Equipment[] = [
  "none",
  "dumbbell",
  "barbell",
  "kettlebell",
  "machine",
  "cable",
  "bands",
  "bodyweight",
  "sled",
  "ski-erg",
  "rower",
  "wall-ball",
  "sandbag",
  "outdoor",
  "studio",
  "mixed",
];

const WORKOUT_TYPE_OPTIONS: WorkoutType[] = [
  "strength",
  "cardio",
  "hiit",
  "functional",
  "mobility",
  "pilates",
  "yoga",
  "posing",
  "rehab",
  "calisthenics",
];

const LEVEL_OPTIONS: FitnessLevel[] = [
  "beginner",
  "intermediate",
  "advanced",
  "pro",
];

const LEVEL_LABELS: Record<FitnessLevel, string> = {
  beginner: "Anfänger",
  intermediate: "Fortgeschritten",
  advanced: "Profi",
  pro: "Wettkampf",
};

type Props = {
  params: Promise<{ brand: string; pack: string }>;
};

export default function NewFitnessCardPage({ params }: Props) {
  const { brand: brandSlug, pack: packSlug } = use(params);
  const router = useRouter();

  // Brand + Pack async laden — gleicher Pattern wie /[brand]/new
  const [brand, setBrand] = useState<Brand | null | undefined>(undefined);
  const [pack, setPack] = useState<Pack | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    void getBrandClient(brandSlug).then((b) => {
      if (active) setBrand(b ?? null);
    });
    // Pack: erst static check, dann custom
    const staticPack = getPack(brandSlug, packSlug);
    if (staticPack) {
      setPack(staticPack);
    } else {
      void getCustomPack(brandSlug, packSlug).then((p) => {
        if (active) setPack(p ?? null);
      });
    }
    return () => {
      active = false;
    };
  }, [brandSlug, packSlug]);

  // ─── Form State ────────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [bodyParts, setBodyParts] = useState<BodyPart[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [level, setLevel] = useState<FitnessLevel>("intermediate");
  const [workoutType, setWorkoutType] =
    useState<WorkoutType>("strength");
  const [setsReps, setSetsReps] = useState("");
  const [load, setLoad] = useState("");
  const [distance, setDistance] = useState("");
  const [rest, setRest] = useState("");
  const [tempo, setTempo] = useState("");
  const [cues, setCues] = useState<string[]>(["", "", ""]);
  const [mistakes, setMistakes] = useState<string[]>([""]);
  const [beginnerVariation, setBeginnerVariation] = useState("");
  const [advancedVariation, setAdvancedVariation] = useState("");
  const [primaryMuscles, setPrimaryMuscles] = useState("");
  const [secondaryMuscles, setSecondaryMuscles] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Validation ────────────────────────────────────────────────────
  const cleanedCues = cues.map((c) => c.trim()).filter(Boolean);
  const cleanedMistakes = mistakes.map((m) => m.trim()).filter(Boolean);
  const requirements = [
    { label: "Titel", ok: title.trim().length >= 3 },
    { label: "Sätze × Wdh", ok: setsReps.trim().length > 0 },
    { label: "Mind. 3 Technik-Cues", ok: cleanedCues.length >= 3 },
  ];
  const missingCount = requirements.filter((r) => !r.ok).length;
  const isValid = missingCount === 0;

  // ─── Helpers ────────────────────────────────────────────────────────
  const toggleBodyPart = (bp: BodyPart) => {
    setBodyParts((prev) =>
      prev.includes(bp) ? prev.filter((x) => x !== bp) : [...prev, bp]
    );
  };
  const toggleEquipment = (eq: Equipment) => {
    setEquipment((prev) =>
      prev.includes(eq) ? prev.filter((x) => x !== eq) : [...prev, eq]
    );
  };

  // Pack-Type-Check: nur Fitness-Pack erlaubt diesen Editor. Sonst
  // redirect zur normalen Recipe-Editor-Route.
  const packType = pack && brand ? resolvePackType(pack, brand) : null;
  useEffect(() => {
    if (pack && brand && packType === "recipe") {
      router.replace(`/${brandSlug}/${packSlug}/new`);
    }
  }, [pack, brand, packType, brandSlug, packSlug, router]);

  if (brand === undefined || pack === undefined) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex flex-1 items-center justify-center text-ink-muted">
          Workspace wird geladen…
        </main>
      </div>
    );
  }
  if (!brand || !pack) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex flex-1 items-center justify-center text-ink-muted">
          Pack nicht gefunden.
        </main>
      </div>
    );
  }

  // ─── Save ──────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!isValid || saving) return;
    setSaving(true);
    setError(null);

    const baseSlug = slugifyFitnessCard(title) || "exercise";
    const slug = `${baseSlug}-${Date.now().toString(36).slice(-4)}`;

    // Card-Payload zusammenbauen — alle optional-Felder nur wenn nicht-leer
    const cardData: Omit<ExerciseCard, "number" | "brandSlug" | "packSlug"> = {
      slug,
      type: "exercise",
      title: title.trim(),
      ...(subtitle.trim() ? { subtitle: subtitle.trim() } : {}),
      ...(sourceUrl.trim() ? { sourceUrl: sourceUrl.trim() } : {}),
      ...(sourceUrl.trim()
        ? { sourceLabel: `${brand.handle ?? brand.name}` }
        : {}),
      bodyParts: bodyParts.length > 0 ? bodyParts : undefined,
      equipment: equipment.length > 0 ? equipment : undefined,
      level,
      exercise: {
        workoutType,
        setsReps: setsReps.trim(),
        ...(load.trim() ? { load: load.trim() } : {}),
        ...(distance.trim() ? { distance: distance.trim() } : {}),
        ...(rest.trim() ? { rest: rest.trim() } : {}),
        ...(tempo.trim() ? { tempo: tempo.trim() } : {}),
        cues: cleanedCues,
        ...(cleanedMistakes.length > 0
          ? { commonMistakes: cleanedMistakes }
          : {}),
        ...(beginnerVariation.trim()
          ? { beginnerVariation: beginnerVariation.trim() }
          : {}),
        ...(advancedVariation.trim()
          ? { advancedVariation: advancedVariation.trim() }
          : {}),
        ...(primaryMuscles.trim()
          ? { primaryMuscles: primaryMuscles.trim() }
          : {}),
        ...(secondaryMuscles.trim()
          ? { secondaryMuscles: secondaryMuscles.trim() }
          : {}),
      },
    };

    const saved = await addCustomFitnessCard({
      brandSlug: brand.slug,
      packSlug: pack.slug,
      card: cardData,
    });

    if (!saved) {
      setSaving(false);
      setError("Konnte die Karte nicht speichern. Bitte erneut versuchen.");
      return;
    }

    // Fire-and-forget Hero-Pipeline, wenn sourceUrl gesetzt. Pack-Detail-
    // Page polled die fitness_cards-Tabelle und zeigt das Hero sobald da.
    if (sourceUrl.trim()) {
      void fetch("/api/fitness-cards/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandSlug: brand.slug,
          packSlug: pack.slug,
          cardSlug: saved.slug,
        }),
      }).catch(() => {
        /* swallow — hero-gen is best-effort */
      });
    }

    router.push(`/${brand.slug}/${pack.slug}`);
    router.refresh();
  };

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ background: brand.tokens.background }}
    >
      <SiteHeader />

      {/* Breadcrumb */}
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
            <Link href={`/${brand.slug}`} className="hover:opacity-100" style={{ opacity: 0.75 }}>
              {brand.name}
            </Link>
            <span style={{ opacity: 0.5 }}>›</span>
            <Link href={`/${brand.slug}/${pack.slug}`} className="hover:opacity-100" style={{ opacity: 0.75 }}>
              {pack.title}
            </Link>
            <span style={{ opacity: 0.5 }}>›</span>
            <span style={{ color: brand.tokens.ink, fontWeight: 500 }}>
              Neue Karte
            </span>
          </nav>
          <Link
            href={`/${brand.slug}/${pack.slug}`}
            className="self-start text-[12px] font-medium underline-offset-4 hover:underline"
            style={{ color: brand.tokens.inkMuted }}
          >
            Abbrechen
          </Link>
        </div>
      </section>

      <main className="flex-1">
        <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-10 px-6 py-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:px-10 lg:py-14">
          {/* ── FORM ── */}
          <div className="flex flex-col gap-8">
            {/* Section 01 — Identity */}
            <FormSection num="01" title="Übung" hint="Was ist das für eine Übung — Name, Untertitel, optional Source-Reel.">
              <Field label="Übungs-Name" required>
                <input
                  className="editor-input"
                  type="text"
                  placeholder="z.B. Wall Ball, Back Squat, Sled Push"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={60}
                />
              </Field>
              <Field label="Untertitel" hint="Kontext, Position im Programm">
                <input
                  className="editor-input"
                  type="text"
                  placeholder="z.B. Hyrox Station 8 — 100 Reps"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  maxLength={100}
                />
              </Field>
              <Field label="Source-Reel (Instagram/TikTok)" hint="Optional — wenn gesetzt, generiert die KI das Hero-Bild automatisch aus dem besten Keyframe">
                <input
                  className="editor-input"
                  type="url"
                  placeholder="https://www.instagram.com/p/..."
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                />
              </Field>
            </FormSection>

            {/* Section 02 — Klassifikation */}
            <FormSection num="02" title="Klassifikation" hint="Was wird trainiert, wie schwer, mit welchem Equipment.">
              <Field label="Workout-Typ">
                <div className="flex flex-wrap gap-2">
                  {WORKOUT_TYPE_OPTIONS.map((wt) => (
                    <ChipButton
                      key={wt}
                      active={workoutType === wt}
                      accent={brand.tokens.accent}
                      onClick={() => setWorkoutType(wt)}
                    >
                      {wt}
                    </ChipButton>
                  ))}
                </div>
              </Field>
              <Field label="Body-Parts" hint="Mehrfach-Auswahl">
                <div className="flex flex-wrap gap-2">
                  {BODY_PART_OPTIONS.map((bp) => (
                    <ChipButton
                      key={bp}
                      active={bodyParts.includes(bp)}
                      accent={brand.tokens.accent}
                      onClick={() => toggleBodyPart(bp)}
                    >
                      {bp}
                    </ChipButton>
                  ))}
                </div>
              </Field>
              <Field label="Equipment" hint="Mehrfach-Auswahl">
                <div className="flex flex-wrap gap-2">
                  {EQUIPMENT_OPTIONS.map((eq) => (
                    <ChipButton
                      key={eq}
                      active={equipment.includes(eq)}
                      accent={brand.tokens.accent}
                      onClick={() => toggleEquipment(eq)}
                    >
                      {eq}
                    </ChipButton>
                  ))}
                </div>
              </Field>
              <Field label="Level">
                <div className="flex flex-wrap gap-2">
                  {LEVEL_OPTIONS.map((lv) => (
                    <ChipButton
                      key={lv}
                      active={level === lv}
                      accent={brand.tokens.accent}
                      onClick={() => setLevel(lv)}
                    >
                      {LEVEL_LABELS[lv]}
                    </ChipButton>
                  ))}
                </div>
              </Field>
            </FormSection>

            {/* Section 03 — Volumen */}
            <FormSection num="03" title="Volumen & Pacing" hint="Wie viele Sätze × Wdh, wie viel Last, Pause.">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Sätze × Wdh" required>
                  <input
                    className="editor-input"
                    type="text"
                    placeholder="z.B. 3 × 12 oder 100 Reps"
                    value={setsReps}
                    onChange={(e) => setSetsReps(e.target.value)}
                    maxLength={40}
                  />
                </Field>
                <Field label="Pause">
                  <input
                    className="editor-input"
                    type="text"
                    placeholder="z.B. 90 sec oder unbroken"
                    value={rest}
                    onChange={(e) => setRest(e.target.value)}
                    maxLength={30}
                  />
                </Field>
                <Field label="Last">
                  <input
                    className="editor-input"
                    type="text"
                    placeholder="z.B. 70 kg oder Bodyweight"
                    value={load}
                    onChange={(e) => setLoad(e.target.value)}
                    maxLength={40}
                  />
                </Field>
                <Field label="Distanz">
                  <input
                    className="editor-input"
                    type="text"
                    placeholder="z.B. 50m, 1000m"
                    value={distance}
                    onChange={(e) => setDistance(e.target.value)}
                    maxLength={30}
                  />
                </Field>
              </div>
              <Field label="Tempo">
                <input
                  className="editor-input"
                  type="text"
                  placeholder="z.B. 3-1-1-0 (exzentrisch-pause-konzentrisch-top)"
                  value={tempo}
                  onChange={(e) => setTempo(e.target.value)}
                  maxLength={30}
                />
              </Field>
            </FormSection>

            {/* Section 04 — Cues + Mistakes */}
            <FormSection num="04" title="Technik" hint="3-6 nummerierte Cues + bis zu 3 typische Fehler.">
              <Field label="Cues" required hint="Nummerierte Ausführungs-Schritte">
                <DynamicList
                  items={cues}
                  setItems={setCues}
                  placeholder="z.B. Ball auf Brusthöhe, Squat tief, explosiv hoch werfen"
                  min={3}
                  max={6}
                />
              </Field>
              <Field label="Vermeide (Common Mistakes)" hint="Optional, bis zu 3">
                <DynamicList
                  items={mistakes}
                  setItems={setMistakes}
                  placeholder="z.B. Aus den Armen werfen statt aus den Beinen"
                  min={0}
                  max={3}
                />
              </Field>
            </FormSection>

            {/* Section 05 — Variations + Muscles */}
            <FormSection num="05" title="Variationen & Muskulatur" hint="Skaliert für Anfänger / Pro plus Anatomie.">
              <Field label="Anfänger-Variation">
                <textarea
                  className="editor-input min-h-[64px] resize-none"
                  placeholder="z.B. Mit 4 kg Ball starten, Ziel 50 Reps unbroken."
                  value={beginnerVariation}
                  onChange={(e) => setBeginnerVariation(e.target.value)}
                  maxLength={200}
                />
              </Field>
              <Field label="Pro / Rx+ Variation">
                <textarea
                  className="editor-input min-h-[64px] resize-none"
                  placeholder="z.B. 9 kg + 100 Reps unbroken in unter 4:30 min."
                  value={advancedVariation}
                  onChange={(e) => setAdvancedVariation(e.target.value)}
                  maxLength={200}
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Primärmuskulatur">
                  <input
                    className="editor-input"
                    type="text"
                    placeholder="z.B. Quadrizeps, Glutaeus, Schultern"
                    value={primaryMuscles}
                    onChange={(e) => setPrimaryMuscles(e.target.value)}
                    maxLength={80}
                  />
                </Field>
                <Field label="Sekundärmuskulatur">
                  <input
                    className="editor-input"
                    type="text"
                    placeholder="z.B. Wadenheber, Rumpf-Stabilisatoren"
                    value={secondaryMuscles}
                    onChange={(e) => setSecondaryMuscles(e.target.value)}
                    maxLength={80}
                  />
                </Field>
              </div>
            </FormSection>

            {/* Save Bar */}
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
                      .join(" · ") || "Alle Pflichtfelder gesetzt"}
                  </span>
                </div>
                <button
                  type="button"
                  className="editor-button-primary"
                  disabled={!isValid || saving}
                  onClick={handleSave}
                  style={{
                    background: brand.tokens.accent,
                    color: "white",
                  }}
                >
                  {saving ? "Karte wird angelegt…" : "Karte erstellen →"}
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

          {/* ── PREVIEW (right, sticky) ── */}
          <aside className="lg:sticky lg:top-[120px] lg:self-start">
            <div
              className="overflow-hidden rounded-[var(--radius-card)] border"
              style={{
                borderColor: "var(--color-line)",
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
                <span className="font-mono">Trainings-Karte</span>
              </div>
              <CardPreview
                title={title}
                subtitle={subtitle}
                bodyParts={bodyParts}
                setsReps={setsReps}
                rest={rest}
                load={load}
                level={level}
                cues={cleanedCues}
                mistakes={cleanedMistakes}
                hasSource={Boolean(sourceUrl.trim())}
              />
            </div>
            <p
              className="mt-3 text-[11px] leading-relaxed"
              style={{ color: "var(--color-ink-muted)" }}
            >
              Beim Speichern landet die Karte im Pack. Wenn du eine Source-Reel-
              URL angegeben hast, generiert die KI im Hintergrund (~10-25s) das
              Hero-Bild als Cinematic-Keyframe.
            </p>
          </aside>
        </div>
      </main>
    </div>
  );
}

// ─── Form-Helpers ──────────────────────────────────────────────────────

function FormSection({
  num,
  title,
  hint,
  children,
}: {
  num: string;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="editor-section editor-card flex flex-col gap-5">
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
      {children}
    </section>
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
            style={{ color: "var(--accent-color, #f4a338)" }}
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

function ChipButton({
  active,
  accent,
  children,
  onClick,
}: {
  active: boolean;
  accent: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border-2 px-3 py-1.5 text-[11.5px] font-semibold transition-all"
      style={{
        borderColor: active ? accent : "var(--color-line)",
        background: active ? accent + "12" : "white",
        color: active ? accent : "var(--color-ink-muted)",
      }}
    >
      {children}
    </button>
  );
}

function DynamicList({
  items,
  setItems,
  placeholder,
  min,
  max,
}: {
  items: string[];
  setItems: (items: string[]) => void;
  placeholder: string;
  min: number;
  max: number;
}) {
  const setAt = (i: number, value: string) => {
    const next = [...items];
    next[i] = value;
    setItems(next);
  };
  const addItem = () => {
    if (items.length < max) setItems([...items, ""]);
  };
  const removeAt = (i: number) => {
    if (items.length > min) {
      setItems(items.filter((_, idx) => idx !== i));
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          <span
            className="mt-2 text-[11px] font-bold tabular-nums"
            style={{ color: "var(--color-ink-muted)", width: 20 }}
          >
            {(i + 1).toString().padStart(2, "0")}
          </span>
          <input
            className="editor-input flex-1"
            type="text"
            placeholder={placeholder}
            value={item}
            onChange={(e) => setAt(i, e.target.value)}
            maxLength={140}
          />
          {items.length > min ? (
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="mt-1 h-8 w-8 rounded-full text-[14px] text-ink-muted transition hover:bg-canvas-alt"
              aria-label="Entfernen"
            >
              ×
            </button>
          ) : null}
        </div>
      ))}
      {items.length < max ? (
        <button
          type="button"
          onClick={addItem}
          className="self-start text-[11.5px] font-semibold underline-offset-4 hover:underline"
          style={{ color: "var(--color-ink-muted)" }}
        >
          + Eintrag hinzufügen
        </button>
      ) : null}
    </div>
  );
}

// ─── Live Preview ──────────────────────────────────────────────────────

function CardPreview({
  title,
  subtitle,
  bodyParts,
  setsReps,
  rest,
  load,
  level,
  cues,
  mistakes,
  hasSource,
}: {
  title: string;
  subtitle: string;
  bodyParts: BodyPart[];
  setsReps: string;
  rest: string;
  load: string;
  level: FitnessLevel;
  cues: string[];
  mistakes: string[];
  hasSource: boolean;
}) {
  // Vereinfachte Variante des Studio-Performance-Layouts. Spiegelt grobe
  // Hierarchie, ohne den vollen Render-Pfad.
  const COLORS = {
    bg: "#0a0a0d",
    surface: "#16161a",
    accent: "#f4a338",
    ink: "#fafafa",
    inkMuted: "#8c8c95",
    inkSubtle: "#5a5a63",
    divider: "#28282e",
  };

  return (
    <div style={{ background: COLORS.bg, color: COLORS.ink }}>
      {/* Hero-Placeholder */}
      <div
        className="relative flex aspect-[16/11] items-center justify-center"
        style={{ background: COLORS.surface }}
      >
        {hasSource ? (
          <p className="text-[10px] uppercase tracking-[0.2em]" style={{ color: COLORS.accent }}>
            Hero wird beim Speichern generiert
          </p>
        ) : (
          <p className="text-[10px] uppercase tracking-[0.2em]" style={{ color: COLORS.inkSubtle }}>
            Source-URL hinzufügen für Auto-Hero
          </p>
        )}
      </div>

      {/* Title-Block */}
      <div className="px-6 py-5">
        {bodyParts.length > 0 ? (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {bodyParts.slice(0, 3).map((bp) => (
              <span
                key={bp}
                className="px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.15em]"
                style={{ background: COLORS.ink, color: COLORS.bg }}
              >
                {bp}
              </span>
            ))}
          </div>
        ) : null}
        <h3 className="font-bold leading-tight" style={{ fontSize: 22, letterSpacing: "-0.02em" }}>
          {title.trim() || "Übungs-Name"}
        </h3>
        {subtitle ? (
          <p
            className="mt-1 text-[10px] uppercase tracking-[0.16em]"
            style={{ color: COLORS.inkMuted }}
          >
            {subtitle}
          </p>
        ) : null}
      </div>

      {/* Pace-Strip */}
      <div className="grid grid-cols-3 border-y" style={{ borderColor: COLORS.divider }}>
        <PreviewStat label="Volumen" value={setsReps || "—"} unit={load} />
        <PreviewStat label="Pause" value={rest || "—"} accent />
        <PreviewStat label="Level" value={LEVEL_LABELS[level]} />
      </div>

      {/* Cues */}
      {cues.length > 0 ? (
        <div className="px-6 py-5">
          <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: COLORS.accent }}>
            Technik
          </p>
          <ol className="flex flex-col gap-1.5">
            {cues.slice(0, 4).map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-[11px]">
                <span className="font-bold tabular-nums" style={{ color: COLORS.accent }}>
                  {i.toString().padStart(2, "0")}
                </span>
                <span>{c}</span>
              </li>
            ))}
            {cues.length > 4 ? (
              <li className="text-[10px] uppercase tracking-[0.15em]" style={{ color: COLORS.inkSubtle }}>
                + {cues.length - 4} weitere
              </li>
            ) : null}
          </ol>
        </div>
      ) : null}

      {/* Mistakes */}
      {mistakes.length > 0 ? (
        <div
          className="border-t px-6 py-4"
          style={{
            borderColor: COLORS.divider,
            background: "rgba(216,109,84,0.06)",
          }}
        >
          <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.18em]" style={{ color: "#d49060" }}>
            Watch Out
          </p>
          {mistakes.slice(0, 2).map((m, i) => (
            <p key={i} className="text-[10px] leading-tight" style={{ color: COLORS.ink }}>
              – {m}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PreviewStat({
  label,
  value,
  unit,
  accent = false,
}: {
  label: string;
  value: string;
  unit?: string;
  accent?: boolean;
}) {
  return (
    <div
      className="px-4 py-3"
      style={accent ? { borderLeft: "1px solid #28282e", borderRight: "1px solid #28282e" } : {}}
    >
      <p
        className="text-[8px] font-bold uppercase tracking-[0.18em]"
        style={{ color: "#5a5a63" }}
      >
        {label}
      </p>
      <p
        className="mt-1 font-bold leading-none tabular-nums tracking-tight"
        style={{
          color: accent ? "#f4a338" : "#fafafa",
          fontSize: 16,
        }}
      >
        {value}
      </p>
      {unit ? (
        <p className="mt-1 text-[9px] uppercase tracking-[0.15em]" style={{ color: "#8c8c95" }}>
          {unit}
        </p>
      ) : null}
    </div>
  );
}
