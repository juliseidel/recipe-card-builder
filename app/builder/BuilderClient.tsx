"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { themeList } from "@/lib/themes";
import type { Recipe } from "@/types/recipe";
import { RecipeCard } from "@/components/cards/RecipeCard";
import {
  Sparkles,
  FileDown,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

type JobInfo = {
  id: string;
  status: "pending" | "running" | "succeeded" | "failed";
  progress: number;
  message?: string;
  error?: string;
  result?: { imageUrl?: string };
};

function ingredientsToText(recipe: Recipe): string {
  const lines: string[] = [];
  let currentGroup: string | null = null;
  for (const ing of recipe.ingredients) {
    const g = ing.group ?? null;
    if (g !== currentGroup) {
      if (g) lines.push(`# ${g}`);
      currentGroup = g;
    }
    const amount = `${ing.amount}${ing.unit ? ` ${ing.unit}` : ""}`;
    lines.push(`${amount} | ${ing.name}`);
  }
  return lines.join("\n");
}

function textToIngredients(text: string): Recipe["ingredients"] {
  const out: Recipe["ingredients"] = [];
  let group: string | undefined;
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith("#")) {
      group = t.replace(/^#+\s*/, "").trim() || undefined;
      continue;
    }
    const [amount = "", name = ""] = t.split("|").map((s) => s.trim());
    if (!name) continue;
    out.push({ amount, name, group });
  }
  return out;
}

function stepsToText(recipe: Recipe): string {
  return recipe.steps.map((s) => s.text).join("\n\n");
}
function textToSteps(text: string): Recipe["steps"] {
  return text
    .split(/\n\s*\n/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((text, i) => ({ index: i + 1, text }));
}

export function BuilderClient({ initialRecipe }: { initialRecipe: Recipe }) {
  const [themeId, setThemeId] = useState<string>(themeList[0]!.id);
  const [title, setTitle] = useState(initialRecipe.title);
  const [subtitle, setSubtitle] = useState(initialRecipe.subtitle ?? "");
  const [description, setDescription] = useState(
    initialRecipe.description ?? "",
  );
  const [servings, setServings] = useState(initialRecipe.servings);
  const [totalMinutes, setTotalMinutes] = useState(
    initialRecipe.totalMinutes ?? initialRecipe.prepMinutes ?? 0,
  );
  const [highlights, setHighlights] = useState<string>(
    initialRecipe.highlights.join("\n"),
  );
  const [ingredientsText, setIngredientsText] = useState(
    ingredientsToText(initialRecipe),
  );
  const [stepsText, setStepsText] = useState(stepsToText(initialRecipe));
  const [kcal, setKcal] = useState(initialRecipe.nutrition.kcal);
  const [protein, setProtein] = useState(initialRecipe.nutrition.protein);
  const [carbs, setCarbs] = useState(initialRecipe.nutrition.carbs);
  const [fat, setFat] = useState(initialRecipe.nutrition.fat);
  const [imagePrompt, setImagePrompt] = useState(initialRecipe.imagePrompt ?? "");
  const [imageUrl, setImageUrl] = useState<string | undefined>(
    initialRecipe.imageUrl,
  );
  const [job, setJob] = useState<JobInfo | null>(null);

  const recipe: Recipe = useMemo(
    () => ({
      ...initialRecipe,
      title,
      subtitle: subtitle || undefined,
      description: description || undefined,
      servings,
      totalMinutes,
      highlights: highlights.split("\n").map((h) => h.trim()).filter(Boolean),
      ingredients: textToIngredients(ingredientsText),
      steps: textToSteps(stepsText),
      nutrition: { kcal, protein, carbs, fat },
      imagePrompt,
      imageUrl,
    }),
    [
      initialRecipe,
      title,
      subtitle,
      description,
      servings,
      totalMinutes,
      highlights,
      ingredientsText,
      stepsText,
      kcal,
      protein,
      carbs,
      fat,
      imagePrompt,
      imageUrl,
    ],
  );

  // Poll job
  useEffect(() => {
    if (!job) return;
    if (job.status === "succeeded" || job.status === "failed") return;
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${job.id}`);
        if (!res.ok) return;
        const data = (await res.json()) as JobInfo;
        setJob(data);
        if (data.status === "succeeded" && data.result?.imageUrl) {
          setImageUrl(data.result.imageUrl);
        }
      } catch {
        /* ignore */
      }
    }, 1200);
    return () => clearInterval(t);
  }, [job]);

  async function generateImage() {
    if (!imagePrompt.trim()) return;
    setJob({ id: "tmp", status: "pending", progress: 0 });
    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "image.generate",
        input: { prompt: imagePrompt, aspectRatio: "4:3" },
      }),
    });
    const data = await res.json();
    setJob({ id: data.id, status: "pending", progress: 0 });
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-builder-bg)]">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[var(--color-builder-line)] bg-[var(--color-builder-bg)]/85 px-8 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.32em] hover:underline"
          >
            <ArrowLeft className="h-3 w-3" />
            Builder
          </Link>
          <span className="text-[11px] uppercase tracking-[0.32em] text-[var(--color-builder-muted)]">
            · {themeList.find((t) => t.id === themeId)!.name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeSwitcher themeId={themeId} onChange={setThemeId} />
        </div>
      </header>

      <div className="grid flex-1 grid-cols-12 gap-0">
        {/* LEFT: Form */}
        <aside className="col-span-12 lg:col-span-4 border-r border-[var(--color-builder-line)] bg-white/40 px-7 py-8">
          <h2 className="mb-6 font-display text-2xl font-medium tracking-tight">
            Rezept-Daten
          </h2>

          <Field label="Titel">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Untertitel">
            <input
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              className={inputClass}
              placeholder="Ohne Backen · in 15 Min."
            />
          </Field>

          <Field label="Kurzbeschreibung">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputClass + " min-h-[64px]"}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Portionen">
              <input
                type="number"
                value={servings}
                onChange={(e) => setServings(Number(e.target.value))}
                className={inputClass}
              />
            </Field>
            <Field label="Gesamtzeit (Min.)">
              <input
                type="number"
                value={totalMinutes}
                onChange={(e) => setTotalMinutes(Number(e.target.value))}
                className={inputClass}
              />
            </Field>
          </div>

          <Field
            label="Highlights (✓-Liste)"
            hint="Eine Zeile pro Eintrag"
          >
            <textarea
              value={highlights}
              onChange={(e) => setHighlights(e.target.value)}
              className={inputClass + " min-h-[64px] font-mono text-xs"}
            />
          </Field>

          <Field
            label="Zutaten"
            hint="Format: 200 g | Magerquark · Gruppen mit '# Gruppenname' starten"
          >
            <textarea
              value={ingredientsText}
              onChange={(e) => setIngredientsText(e.target.value)}
              className={inputClass + " min-h-[180px] font-mono text-xs"}
            />
          </Field>

          <Field
            label="Zubereitung"
            hint="Schritte mit Leerzeile trennen"
          >
            <textarea
              value={stepsText}
              onChange={(e) => setStepsText(e.target.value)}
              className={inputClass + " min-h-[180px] font-mono text-xs"}
            />
          </Field>

          <p className="mt-4 mb-2 text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-builder-muted)]">
            Nährwerte pro Portion
          </p>
          <div className="grid grid-cols-4 gap-2">
            <Field label="kcal" small>
              <input
                type="number"
                value={kcal}
                onChange={(e) => setKcal(Number(e.target.value))}
                className={inputClass}
              />
            </Field>
            <Field label="Eiweiß" small>
              <input
                type="number"
                value={protein}
                onChange={(e) => setProtein(Number(e.target.value))}
                className={inputClass}
              />
            </Field>
            <Field label="Kohl." small>
              <input
                type="number"
                value={carbs}
                onChange={(e) => setCarbs(Number(e.target.value))}
                className={inputClass}
              />
            </Field>
            <Field label="Fett" small>
              <input
                type="number"
                value={fat}
                onChange={(e) => setFat(Number(e.target.value))}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="mt-7 rounded-2xl border border-[var(--color-builder-line)] bg-white/60 p-5">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-builder-muted)]">
              KI-Bild für die Karte
            </p>
            <textarea
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              placeholder="z. B. cremiger Erdbeer-Mealprep in Glas-Schalen, warmes Morgenlicht …"
              className={inputClass + " min-h-[80px] text-xs"}
            />
            <button
              onClick={generateImage}
              disabled={!imagePrompt.trim() || job?.status === "running"}
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-[var(--color-builder-accent)] px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-cream-50)] transition hover:opacity-90 disabled:opacity-40"
            >
              {job?.status === "running" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              {job?.status === "running"
                ? `Generiert … ${Math.round((job.progress ?? 0) * 100)} %`
                : "KI-Bild generieren"}
            </button>
            {job && (
              <JobBadge
                job={job}
                onClear={() => {
                  setJob(null);
                }}
              />
            )}
          </div>
        </aside>

        {/* RIGHT: Preview */}
        <section className="col-span-12 lg:col-span-8 overflow-auto bg-[var(--color-builder-bg)] p-8">
          <div className="mb-4 flex items-end justify-between">
            <p className="text-[11px] uppercase tracking-[0.4em] text-[var(--color-builder-muted)]">
              Live preview · A4 Hochformat
            </p>
            <a
              href={`/api/pack/sweet-mornings-biene/pdf`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--color-builder-accent)] px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-cream-50)] hover:opacity-90"
            >
              <FileDown className="h-3 w-3" />
              Beispiel-Pack als PDF
            </a>
          </div>

          <div className="origin-top-left scale-[0.62] sm:scale-[0.75] xl:scale-[0.88] 2xl:scale-100 transition">
            <div className="print-shadow inline-block">
              <RecipeCard recipe={recipe} themeId={themeId} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-[var(--color-builder-line)] bg-white/80 px-3 py-2 text-sm text-[var(--color-builder-ink)] outline-none transition focus:border-[var(--color-builder-ink)]";

function Field({
  label,
  children,
  hint,
  small = false,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  small?: boolean;
}) {
  return (
    <div className="mb-4">
      <label
        className={`mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--color-builder-muted)] ${small ? "" : ""}`}
      >
        {label}
      </label>
      {children}
      {hint && (
        <p className="mt-1 text-[10px] text-[var(--color-builder-muted)] opacity-80">
          {hint}
        </p>
      )}
    </div>
  );
}

function ThemeSwitcher({
  themeId,
  onChange,
}: {
  themeId: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-1 rounded-full border border-[var(--color-builder-line)] bg-white/60 p-1">
      {themeList.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`rounded-full px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em] transition ${
            t.id === themeId
              ? "bg-[var(--color-builder-accent)] text-[var(--color-cream-50)]"
              : "text-[var(--color-builder-ink)] hover:bg-white"
          }`}
        >
          {t.name}
        </button>
      ))}
    </div>
  );
}

function JobBadge({
  job,
  onClear,
}: {
  job: JobInfo;
  onClear: () => void;
}) {
  const color =
    job.status === "succeeded"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : job.status === "failed"
        ? "bg-rose-50 text-rose-700 border-rose-200"
        : "bg-amber-50 text-amber-700 border-amber-200";

  return (
    <div
      className={`mt-3 flex items-start gap-2 rounded-md border px-3 py-2 text-[11px] ${color}`}
    >
      {job.status === "succeeded" ? (
        <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0" />
      ) : job.status === "failed" ? (
        <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
      ) : (
        <Loader2 className="mt-0.5 h-3 w-3 shrink-0 animate-spin" />
      )}
      <div className="flex-1">
        <p className="font-medium uppercase tracking-[0.18em]">
          Job {job.id.slice(0, 6)} · {job.status}
        </p>
        {job.message && <p className="mt-0.5 opacity-80">{job.message}</p>}
        {job.error && <p className="mt-0.5 opacity-80">{job.error}</p>}
        {job.status === "running" && (
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-current/10">
            <div
              className="h-full rounded-full bg-current transition-all"
              style={{ width: `${(job.progress ?? 0) * 100}%` }}
            />
          </div>
        )}
        {(job.status === "succeeded" || job.status === "failed") && (
          <button
            className="mt-1 text-[10px] uppercase tracking-[0.2em] underline"
            onClick={onClear}
          >
            Verstecken
          </button>
        )}
      </div>
    </div>
  );
}
