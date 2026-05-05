"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getBrand } from "@/lib/brands";
import { getPack } from "@/lib/packs";
import type { Ingredient, Recipe } from "@/lib/recipes";
import { addCustomRecipe, slugify } from "@/lib/custom-recipes";
import { SiteHeader } from "@/components/site-header";
import { RecipeCardPreview } from "@/components/recipe-card-preview";

type NewRecipePageProps = {
  params: Promise<{ brand: string; pack: string }>;
};

export default function NewRecipePage({ params }: NewRecipePageProps) {
  const { brand: brandSlug, pack: packSlug } = use(params);
  const brand = getBrand(brandSlug);
  const pack = getPack(brandSlug, packSlug);
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [prepTime, setPrepTime] = useState("15");
  const [cookTime, setCookTime] = useState("");
  const [difficulty, setDifficulty] =
    useState<Recipe["difficulty"]>("Einfach");
  const [servings, setServings] = useState("2");
  const [tagsInput, setTagsInput] = useState("");
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { amount: "", name: "" },
    { amount: "", name: "" },
    { amount: "", name: "" },
  ]);
  const [steps, setSteps] = useState<string[]>(["", "", ""]);
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [micros, setMicros] = useState<
    { name: string; amount: string; pctDaily: string }[]
  >([{ name: "", amount: "", pctDaily: "" }]);
  const [saving, setSaving] = useState(false);

  const previewRecipe: Recipe | null = useMemo(() => {
    if (!pack) return null;
    return {
      slug: slugify(title) || "neue-karte",
      packSlug: pack.slug,
      number: 99,
      title: title || "Neue Rezeptkarte",
      subtitle: subtitle || "Subtitle erscheint hier",
      description: description || "",
      prepTime: parseInt(prepTime) || 0,
      cookTime: cookTime ? parseInt(cookTime) : undefined,
      difficulty,
      servings: parseInt(servings) || 1,
      tags: tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      ingredients: ingredients.filter((i) => i.amount || i.name),
      steps: steps.filter((s) => s.trim()),
      nutrition: {
        kcal: parseInt(kcal) || 0,
        protein: parseInt(protein) || 0,
        carbs: parseInt(carbs) || 0,
        fat: parseInt(fat) || 0,
        micros: micros
          .filter((m) => m.name && m.amount)
          .map((m) => ({
            name: m.name,
            amount: m.amount,
            pctDaily: m.pctDaily ? parseInt(m.pctDaily) : undefined,
          })),
      },
    };
  }, [
    pack,
    title,
    subtitle,
    description,
    prepTime,
    cookTime,
    difficulty,
    servings,
    tagsInput,
    ingredients,
    steps,
    kcal,
    protein,
    carbs,
    fat,
    micros,
  ]);

  if (!brand || !pack) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex flex-1 items-center justify-center text-ink-muted">
          Workspace oder Pack nicht gefunden.
        </main>
      </div>
    );
  }

  const cleanIngredients = ingredients.filter((i) => i.amount || i.name);
  const cleanSteps = steps.filter((s) => s.trim());
  const cleanMicros = micros
    .filter((m) => m.name && m.amount)
    .map((m) => ({
      name: m.name,
      amount: m.amount,
      pctDaily: m.pctDaily ? parseInt(m.pctDaily) : undefined,
    }));

  const isValid =
    title.trim().length > 0 &&
    cleanIngredients.length >= 1 &&
    cleanSteps.length >= 1 &&
    parseInt(kcal) > 0;

  const handleSave = () => {
    if (!isValid || !pack || !previewRecipe) return;
    setSaving(true);
    const slug = slugify(title);
    const saved = addCustomRecipe({
      slug,
      packSlug: pack.slug,
      number: 99,
      title: title.trim(),
      subtitle: subtitle.trim() || title.trim(),
      description: description.trim(),
      prepTime: parseInt(prepTime) || 0,
      cookTime: cookTime ? parseInt(cookTime) : undefined,
      difficulty,
      servings: parseInt(servings) || 1,
      tags: tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      ingredients: cleanIngredients,
      steps: cleanSteps,
      nutrition: {
        kcal: parseInt(kcal) || 0,
        protein: parseInt(protein) || 0,
        carbs: parseInt(carbs) || 0,
        fat: parseInt(fat) || 0,
        micros: cleanMicros,
      },
    });
    setTimeout(() => {
      router.push(`/${brand.slug}/${pack.slug}/${saved.slug}`);
    }, 200);
  };

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ background: brand.tokens.background }}
    >
      <SiteHeader />

      <header
        className="border-b"
        style={{
          background: pack.mood.background,
          borderColor: pack.mood.ink + "1a",
        }}
      >
        <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-10">
          <div className="flex flex-col gap-1">
            <Link
              href={`/${brand.slug}/${pack.slug}`}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium opacity-75 transition-opacity hover:opacity-100"
              style={{ color: pack.mood.inkSoft }}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <path
                  d="M11 7H3m0 0L6.5 3.5M3 7l3.5 3.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {pack.title}
            </Link>
            <h1
              className="font-display text-[28px] leading-none tracking-[-0.01em]"
              style={{ color: pack.mood.ink }}
            >
              Neue Rezeptkarte
            </h1>
            <p
              className="text-[13px]"
              style={{ color: pack.mood.inkSoft }}
            >
              Manuell eingeben — die Karte erscheint live in der Vorschau rechts und wird in deinem Pack gespeichert.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/${brand.slug}/${pack.slug}`}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium transition-colors"
              style={{
                background: "transparent",
                color: pack.mood.ink,
                border: `1px solid ${pack.mood.ink}30`,
              }}
            >
              Abbrechen
            </Link>
            <button
              type="button"
              disabled={!isValid || saving}
              onClick={handleSave}
              className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-[13px] font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                background: pack.mood.ink,
                color: pack.mood.background,
              }}
            >
              {saving ? "Speichere…" : "Karte speichern"}
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                aria-hidden
              >
                <path
                  d="M3 7l3 3 5-7"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-10 px-6 py-10 lg:grid-cols-[1.4fr_1fr] lg:gap-14 lg:px-10">
          {/* FORM */}
          <div className="flex flex-col gap-10">
            {/* Section: Basics */}
            <Section title="Eckdaten" subtitle="Name, Beschreibung, Zeit" pack={pack}>
              <Field label="Titel *" required>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="z. B. Magerquark-Käsekuchen"
                  className="w-full rounded-lg border bg-white px-4 py-2.5 text-[14px] outline-none transition-colors focus:border-current"
                  style={{
                    borderColor: brand.tokens.line,
                    color: brand.tokens.ink,
                  }}
                />
              </Field>

              <Field label="Subtitle / Slogan">
                <input
                  type="text"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="z. B. Cremig, fluffig, 380 kcal"
                  className="w-full rounded-lg border bg-white px-4 py-2.5 text-[14px] outline-none focus:border-current"
                  style={{
                    borderColor: brand.tokens.line,
                    color: brand.tokens.ink,
                  }}
                />
              </Field>

              <Field label="Kurzbeschreibung">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="2–3 Sätze für die Karte"
                  rows={3}
                  className="w-full rounded-lg border bg-white px-4 py-2.5 text-[14px] outline-none focus:border-current"
                  style={{
                    borderColor: brand.tokens.line,
                    color: brand.tokens.ink,
                  }}
                />
              </Field>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Field label="Vorbereitung (Min)">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={prepTime}
                    onChange={(e) => setPrepTime(e.target.value)}
                    className="w-full rounded-lg border bg-white px-4 py-2.5 text-[14px] outline-none focus:border-current"
                    style={{
                      borderColor: brand.tokens.line,
                      color: brand.tokens.ink,
                    }}
                  />
                </Field>
                <Field label="Garzeit (Min)">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={cookTime}
                    onChange={(e) => setCookTime(e.target.value)}
                    placeholder="optional"
                    className="w-full rounded-lg border bg-white px-4 py-2.5 text-[14px] outline-none focus:border-current"
                    style={{
                      borderColor: brand.tokens.line,
                      color: brand.tokens.ink,
                    }}
                  />
                </Field>
                <Field label="Portionen">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={servings}
                    onChange={(e) => setServings(e.target.value)}
                    className="w-full rounded-lg border bg-white px-4 py-2.5 text-[14px] outline-none focus:border-current"
                    style={{
                      borderColor: brand.tokens.line,
                      color: brand.tokens.ink,
                    }}
                  />
                </Field>
                <Field label="Schwierigkeit">
                  <select
                    value={difficulty}
                    onChange={(e) =>
                      setDifficulty(e.target.value as Recipe["difficulty"])
                    }
                    className="w-full rounded-lg border bg-white px-4 py-2.5 text-[14px] outline-none focus:border-current"
                    style={{
                      borderColor: brand.tokens.line,
                      color: brand.tokens.ink,
                    }}
                  >
                    <option value="Einfach">Einfach</option>
                    <option value="Mittel">Mittel</option>
                    <option value="Aufwendig">Aufwendig</option>
                  </select>
                </Field>
              </div>

              <Field
                label="Tags (durch Komma getrennt)"
                hint="z. B. High-Protein, Glutenfrei, Schnell"
              >
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="High-Protein, Schnell"
                  className="w-full rounded-lg border bg-white px-4 py-2.5 text-[14px] outline-none focus:border-current"
                  style={{
                    borderColor: brand.tokens.line,
                    color: brand.tokens.ink,
                  }}
                />
              </Field>
            </Section>

            {/* Section: Ingredients */}
            <Section
              title="Zutaten *"
              subtitle="Mindestens eine Zutat"
              pack={pack}
            >
              <div className="flex flex-col gap-2">
                {ingredients.map((ingredient, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-[6rem_1fr_auto] gap-2"
                  >
                    <input
                      type="text"
                      value={ingredient.amount}
                      onChange={(e) => {
                        const next = [...ingredients];
                        next[idx] = { ...next[idx], amount: e.target.value };
                        setIngredients(next);
                      }}
                      placeholder="200 g"
                      className="rounded-lg border bg-white px-3 py-2 text-[13px] tabular-nums outline-none focus:border-current"
                      style={{
                        borderColor: brand.tokens.line,
                        color: brand.tokens.ink,
                      }}
                    />
                    <input
                      type="text"
                      value={ingredient.name}
                      onChange={(e) => {
                        const next = [...ingredients];
                        next[idx] = { ...next[idx], name: e.target.value };
                        setIngredients(next);
                      }}
                      placeholder="Zutat"
                      className="rounded-lg border bg-white px-3 py-2 text-[13px] outline-none focus:border-current"
                      style={{
                        borderColor: brand.tokens.line,
                        color: brand.tokens.ink,
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (ingredients.length === 1) return;
                        setIngredients(ingredients.filter((_, i) => i !== idx));
                      }}
                      disabled={ingredients.length === 1}
                      className="grid size-10 place-items-center rounded-lg border text-[16px] transition-colors disabled:opacity-30"
                      style={{
                        borderColor: brand.tokens.line,
                        color: brand.tokens.inkMuted,
                      }}
                      aria-label="Zutat entfernen"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setIngredients([...ingredients, { amount: "", name: "" }])
                  }
                  className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] transition-colors"
                  style={{
                    background: pack.mood.background,
                    color: pack.mood.ink,
                  }}
                >
                  + Zutat hinzufügen
                </button>
              </div>
            </Section>

            {/* Section: Steps */}
            <Section
              title="Zubereitung *"
              subtitle="Schritt für Schritt"
              pack={pack}
            >
              <div className="flex flex-col gap-2">
                {steps.map((step, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-[2.5rem_1fr_auto] items-start gap-2"
                  >
                    <span
                      className="grid size-10 place-items-center rounded-lg font-display text-[18px] tabular-nums"
                      style={{
                        background: pack.mood.background,
                        color: pack.mood.ink,
                      }}
                    >
                      {idx + 1}
                    </span>
                    <textarea
                      value={step}
                      onChange={(e) => {
                        const next = [...steps];
                        next[idx] = e.target.value;
                        setSteps(next);
                      }}
                      placeholder="Was tut man jetzt?"
                      rows={2}
                      className="rounded-lg border bg-white px-3 py-2 text-[13px] outline-none focus:border-current"
                      style={{
                        borderColor: brand.tokens.line,
                        color: brand.tokens.ink,
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (steps.length === 1) return;
                        setSteps(steps.filter((_, i) => i !== idx));
                      }}
                      disabled={steps.length === 1}
                      className="grid size-10 place-items-center rounded-lg border text-[16px] disabled:opacity-30"
                      style={{
                        borderColor: brand.tokens.line,
                        color: brand.tokens.inkMuted,
                      }}
                      aria-label="Schritt entfernen"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setSteps([...steps, ""])}
                  className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] transition-colors"
                  style={{
                    background: pack.mood.background,
                    color: pack.mood.ink,
                  }}
                >
                  + Schritt hinzufügen
                </button>
              </div>
            </Section>

            {/* Section: Macros */}
            <Section
              title="Nährwerte pro Portion *"
              subtitle="Makros — kcal ist Pflicht"
              pack={pack}
            >
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Field label="Kalorien (kcal) *">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={kcal}
                    onChange={(e) => setKcal(e.target.value)}
                    className="w-full rounded-lg border bg-white px-4 py-2.5 text-[14px] tabular-nums outline-none focus:border-current"
                    style={{
                      borderColor: brand.tokens.line,
                      color: brand.tokens.ink,
                    }}
                  />
                </Field>
                <Field label="Eiweiß (g)">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={protein}
                    onChange={(e) => setProtein(e.target.value)}
                    className="w-full rounded-lg border bg-white px-4 py-2.5 text-[14px] tabular-nums outline-none focus:border-current"
                    style={{
                      borderColor: brand.tokens.line,
                      color: brand.tokens.ink,
                    }}
                  />
                </Field>
                <Field label="Kohlenhydrate (g)">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={carbs}
                    onChange={(e) => setCarbs(e.target.value)}
                    className="w-full rounded-lg border bg-white px-4 py-2.5 text-[14px] tabular-nums outline-none focus:border-current"
                    style={{
                      borderColor: brand.tokens.line,
                      color: brand.tokens.ink,
                    }}
                  />
                </Field>
                <Field label="Fett (g)">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={fat}
                    onChange={(e) => setFat(e.target.value)}
                    className="w-full rounded-lg border bg-white px-4 py-2.5 text-[14px] tabular-nums outline-none focus:border-current"
                    style={{
                      borderColor: brand.tokens.line,
                      color: brand.tokens.ink,
                    }}
                  />
                </Field>
              </div>
            </Section>

            {/* Section: Micros */}
            <Section
              title="Mikronährstoffe"
              subtitle="Optional — Vitamine, Mineralien"
              pack={pack}
            >
              <div className="flex flex-col gap-2">
                {micros.map((micro, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-[1.4fr_1fr_5rem_auto] gap-2"
                  >
                    <input
                      type="text"
                      value={micro.name}
                      onChange={(e) => {
                        const next = [...micros];
                        next[idx] = { ...next[idx], name: e.target.value };
                        setMicros(next);
                      }}
                      placeholder="z. B. Vitamin C"
                      className="rounded-lg border bg-white px-3 py-2 text-[13px] outline-none focus:border-current"
                      style={{
                        borderColor: brand.tokens.line,
                        color: brand.tokens.ink,
                      }}
                    />
                    <input
                      type="text"
                      value={micro.amount}
                      onChange={(e) => {
                        const next = [...micros];
                        next[idx] = { ...next[idx], amount: e.target.value };
                        setMicros(next);
                      }}
                      placeholder="80 mg"
                      className="rounded-lg border bg-white px-3 py-2 text-[13px] tabular-nums outline-none focus:border-current"
                      style={{
                        borderColor: brand.tokens.line,
                        color: brand.tokens.ink,
                      }}
                    />
                    <input
                      type="number"
                      inputMode="numeric"
                      value={micro.pctDaily}
                      onChange={(e) => {
                        const next = [...micros];
                        next[idx] = { ...next[idx], pctDaily: e.target.value };
                        setMicros(next);
                      }}
                      placeholder="% TB"
                      className="rounded-lg border bg-white px-3 py-2 text-[13px] tabular-nums outline-none focus:border-current"
                      style={{
                        borderColor: brand.tokens.line,
                        color: brand.tokens.ink,
                      }}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setMicros(micros.filter((_, i) => i !== idx))
                      }
                      className="grid size-10 place-items-center rounded-lg border text-[16px]"
                      style={{
                        borderColor: brand.tokens.line,
                        color: brand.tokens.inkMuted,
                      }}
                      aria-label="Mikro entfernen"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setMicros([
                      ...micros,
                      { name: "", amount: "", pctDaily: "" },
                    ])
                  }
                  className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.12em]"
                  style={{
                    background: pack.mood.background,
                    color: pack.mood.ink,
                  }}
                >
                  + Mikro hinzufügen
                </button>
              </div>
            </Section>
          </div>

          {/* PREVIEW */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <h2
                className="font-display text-[20px]"
                style={{ color: brand.tokens.ink }}
              >
                Live-Vorschau
              </h2>
              <span
                className="text-[11px] font-semibold uppercase tracking-[0.16em]"
                style={{ color: brand.tokens.inkMuted }}
              >
                so erscheint sie im Pack
              </span>
            </div>

            {previewRecipe ? (
              <RecipeCardPreview
                brand={brand}
                pack={pack}
                recipe={previewRecipe}
              />
            ) : null}

            <p
              className="mt-4 text-[12px] leading-relaxed"
              style={{ color: brand.tokens.inkMuted }}
            >
              Die Karte wird in deinem Browser gespeichert (LocalStorage).
              Sobald du speicherst, landest du direkt auf der Vollansicht.
            </p>
          </aside>
        </div>
      </main>
    </div>
  );
}

function Section({
  title,
  subtitle,
  pack,
  children,
}: {
  title: string;
  subtitle: string;
  pack: NonNullable<ReturnType<typeof getPack>>;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2
          className="font-display text-[22px] leading-none"
          style={{ color: pack.mood.ink }}
        >
          {title}
        </h2>
        <p
          className="text-[12px]"
          style={{ color: pack.mood.inkSoft }}
        >
          {subtitle}
        </p>
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
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
        {label}
        {required ? <span className="text-accent">{" *"}</span> : null}
      </span>
      {children}
      {hint ? (
        <span className="text-[11px] text-ink-subtle">{hint}</span>
      ) : null}
    </label>
  );
}
