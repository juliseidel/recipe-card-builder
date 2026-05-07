"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getBrand } from "@/lib/brands";
import { getPack } from "@/lib/packs";
import type {
  Ingredient,
  NutritionBasis,
  Recipe,
  RecipeStep,
} from "@/lib/recipes";
import {
  addCustomRecipe,
  countCustomRecipesForPack,
  slugify,
} from "@/lib/custom-recipes";
import {
  ingredientSuggestions,
  commonUnits,
} from "@/lib/ingredient-suggestions";
import { tagSuggestions } from "@/lib/common-tags";
import { SiteHeader } from "@/components/site-header";
import { RecipeCardPreview } from "@/components/recipe-card-preview";
import { IngredientCombobox } from "@/components/ingredient-combobox";

// Editor models a recipe as TWO lists of groups, each with its own items.
// The first group is always the Hauptgruppe (name: null) and never gets
// removed. Additional groups have a name like "Für den Teig" / "Glasur" /
// "Schoko-Variante A" and live below the Hauptgruppe. Each group has its
// own "+ Zutat" / "+ Schritt" button so the user can target items to a
// specific group without juggling row-order — and switch back and forth
// freely between Hauptgruppe and any named group.
type IngredientItem = { amount: string; name: string };
type StepItem = { text: string };
type IngredientGroupState = {
  name: string | null; // null = Hauptgruppe (always present, always first)
  items: IngredientItem[];
};
type StepGroupState = {
  name: string | null;
  items: StepItem[];
};

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
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [ingredientGroups, setIngredientGroups] = useState<
    IngredientGroupState[]
  >([
    {
      name: null, // Hauptgruppe — always first, always present
      items: [
        { amount: "", name: "" },
        { amount: "", name: "" },
        { amount: "", name: "" },
      ],
    },
  ]);
  const [stepGroups, setStepGroups] = useState<StepGroupState[]>([
    {
      name: null,
      items: [{ text: "" }, { text: "" }, { text: "" }],
    },
  ]);
  // Track which (groupIdx, itemIdx) currently has focus — used by the
  // unit-quick-actions to know where to apply.
  const [focusedIngredient, setFocusedIngredient] = useState<{
    g: number;
    i: number;
  } | null>(null);
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [nutritionBasis, setNutritionBasis] =
    useState<NutritionBasis>("portion");
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Custom-recipe count loaded once on mount so the live preview can show
  // the actual upcoming card number (instead of a placeholder), and so the
  // save handler can assign a sequential number.
  const [customCountInPack, setCustomCountInPack] = useState(0);

  useEffect(() => {
    if (!pack) return;
    let active = true;
    void countCustomRecipesForPack(pack.slug).then((count) => {
      if (active) setCustomCountInPack(count);
    });
    return () => {
      active = false;
    };
  }, [pack]);

  const upcomingNumber =
    (pack?.recipeCount ?? 0) + customCountInPack + 1;

  // Flatten the group-container model into the standard Recipe shape on
  // save: walk groups in order, walk each group's items, attach the group
  // name to every non-empty item.
  const builtIngredients: Ingredient[] = useMemo(() => {
    const out: Ingredient[] = [];
    for (const g of ingredientGroups) {
      const groupName = g.name?.trim() || null;
      for (const item of g.items) {
        if (!item.amount.trim() && !item.name.trim()) continue;
        out.push({
          amount: item.amount.trim(),
          name: item.name.trim(),
          ...(groupName ? { group: groupName } : {}),
        });
      }
    }
    return out;
  }, [ingredientGroups]);

  const builtSteps: RecipeStep[] = useMemo(() => {
    const out: RecipeStep[] = [];
    for (const g of stepGroups) {
      const groupName = g.name?.trim() || null;
      for (const item of g.items) {
        if (!item.text.trim()) continue;
        out.push({
          text: item.text.trim(),
          ...(groupName ? { group: groupName } : {}),
        });
      }
    }
    return out;
  }, [stepGroups]);

  // Custom recipes inherit their pack's tagline + description as fallback so
  // the rendered card never has an empty subtitle or missing story block —
  // the user can override either field but doesn't have to.
  const previewSubtitle = subtitle.trim() || pack?.tagline || "";
  const previewDescription = description.trim() || pack?.description || "";

  const previewRecipe: Recipe | null = useMemo(() => {
    if (!pack) return null;
    return {
      slug: slugify(title) || "neue-karte",
      packSlug: pack.slug,
      number: upcomingNumber,
      title: title || "Neue Rezeptkarte",
      subtitle: previewSubtitle,
      description: previewDescription,
      prepTime: parseInt(prepTime) || 0,
      cookTime: cookTime ? parseInt(cookTime) : undefined,
      difficulty,
      servings: parseInt(servings) || 1,
      tags,
      ingredients: builtIngredients.length
        ? builtIngredients
        : [{ amount: "—", name: "Zutaten" }],
      steps: builtSteps.length
        ? builtSteps
        : [{ text: "Zubereitung erscheint hier." }],
      nutrition: {
        kcal: parseInt(kcal) || 0,
        protein: parseInt(protein) || 0,
        carbs: parseInt(carbs) || 0,
        fat: parseInt(fat) || 0,
      },
      nutritionBasis,
    };
  }, [
    pack,
    upcomingNumber,
    title,
    previewSubtitle,
    previewDescription,
    prepTime,
    cookTime,
    difficulty,
    servings,
    tags,
    builtIngredients,
    builtSteps,
    kcal,
    protein,
    carbs,
    fat,
    nutritionBasis,
  ]);

  // Required fields tracking — used for save-button counter
  const requirements: { label: string; ok: boolean }[] = [
    { label: "Titel", ok: title.trim().length > 0 },
    { label: "mindestens 1 Zutat", ok: builtIngredients.length >= 1 },
    { label: "mindestens 1 Schritt", ok: builtSteps.length >= 1 },
    { label: "Kalorien", ok: parseInt(kcal) > 0 },
  ];
  const missingCount = requirements.filter((r) => !r.ok).length;
  const isValid = missingCount === 0;

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

  const cssVars = {
    "--accent-color": pack.mood.accent,
    "--accent-color-soft": pack.mood.accent + "18",
    "--pulse-color": pack.mood.accent + "40",
  } as React.CSSProperties;

  const handleSave = async () => {
    if (!isValid || !pack || !brand || !previewRecipe) return;
    setSaving(true);
    setError(null);
    const slug = `${slugify(title)}-${Date.now().toString(36).slice(-4)}`;
    const saved = await addCustomRecipe({
      brandSlug: brand.slug,
      slug,
      packSlug: pack.slug,
      baseRecipeCount: pack.recipeCount,
      title: title.trim(),
      // Subtitle and description fall back to pack-level copy so cards with
      // sparse user input (only a title, no story) still render with the
      // brand's voice instead of leaving big visual gaps.
      subtitle: subtitle.trim() || pack.tagline,
      description: description.trim() || pack.description,
      prepTime: parseInt(prepTime) || 0,
      cookTime: cookTime ? parseInt(cookTime) : undefined,
      difficulty,
      servings: parseInt(servings) || 1,
      tags,
      ingredients: builtIngredients,
      steps: builtSteps,
      nutrition: {
        kcal: parseInt(kcal) || 0,
        protein: parseInt(protein) || 0,
        carbs: parseInt(carbs) || 0,
        fat: parseInt(fat) || 0,
      },
      nutritionBasis,
    });
    if (!saved) {
      setSaving(false);
      setError("Konnte die Karte nicht speichern. Bitte erneut versuchen.");
      return;
    }
    // Fire-and-forget: kick off Gemini micros + Flux 2 Pro hero in parallel.
    // The detail page polls and reveals both when ready.
    void fetch("/api/recipes/enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipeId: saved.id }),
    }).catch(() => {
      /* swallow — enrichment is best-effort */
    });
    setSavedSuccess(true);
    setTimeout(() => {
      router.push(`/${brand.slug}/${pack.slug}/${saved.slug}`);
    }, 350);
  };

  // Tag operations — accept both pre-defined chips and free-typed tags.
  const addTag = (raw: string) => {
    const clean = raw.trim().replace(/^,+|,+$/g, "").trim();
    if (!clean) return;
    if (tags.some((t) => t.toLowerCase() === clean.toLowerCase())) return;
    setTags((prev) => [...prev, clean]);
  };
  const removeTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };
  const toggleSuggestedTag = (tag: string) => {
    if (tags.includes(tag)) removeTag(tag);
    else addTag(tag);
  };
  const handleTagInputKey: React.KeyboardEventHandler<HTMLInputElement> = (
    e
  ) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
      setTagInput("");
    } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      // Convenience: empty backspace deletes the last tag
      removeTag(tags[tags.length - 1]);
    }
  };

  // Group-container helpers — INGREDIENTS
  const updateIngredientItem = (
    g: number,
    i: number,
    patch: Partial<IngredientItem>
  ) => {
    setIngredientGroups((prev) =>
      prev.map((group, k) =>
        k === g
          ? {
              ...group,
              items: group.items.map((it, j) =>
                j === i ? { ...it, ...patch } : it
              ),
            }
          : group
      )
    );
  };
  const removeIngredientItem = (g: number, i: number) => {
    setIngredientGroups((prev) =>
      prev.map((group, k) =>
        k === g
          ? {
              ...group,
              // Always keep at least one item slot in the Hauptgruppe so
              // it's never visually empty. Named groups can drop to zero
              // items — in that case the user can remove the group itself.
              items:
                group.items.length <= 1 && group.name === null
                  ? group.items
                  : group.items.filter((_, j) => j !== i),
            }
          : group
      )
    );
    if (focusedIngredient?.g === g && focusedIngredient.i === i) {
      setFocusedIngredient(null);
    }
  };
  const addIngredientItemTo = (g: number) => {
    setIngredientGroups((prev) => {
      const next = prev.map((group, k) =>
        k === g
          ? { ...group, items: [...group.items, { amount: "", name: "" }] }
          : group
      );
      const target = next[g];
      if (target) {
        setFocusedIngredient({ g, i: target.items.length - 1 });
      }
      return next;
    });
  };
  const addIngredientGroup = () => {
    setIngredientGroups((prev) => [
      ...prev,
      { name: "", items: [{ amount: "", name: "" }] },
    ]);
  };
  const removeIngredientGroup = (g: number) => {
    if (g === 0) return; // never remove the Hauptgruppe
    setIngredientGroups((prev) => {
      const removed = prev[g];
      // Move any non-empty items from the deleted group to the Hauptgruppe
      // so the user doesn't lose work — they can clean up there.
      const survivors = removed?.items.filter(
        (it) => it.amount.trim() || it.name.trim()
      ) ?? [];
      return prev
        .map((group, k) =>
          k === 0 && survivors.length > 0
            ? { ...group, items: [...group.items, ...survivors] }
            : group
        )
        .filter((_, k) => k !== g);
    });
  };
  const setIngredientGroupName = (g: number, name: string) => {
    setIngredientGroups((prev) =>
      prev.map((group, k) => (k === g ? { ...group, name } : group))
    );
  };

  // Group-container helpers — STEPS (mirrors ingredient helpers)
  const updateStepItem = (g: number, i: number, patch: Partial<StepItem>) => {
    setStepGroups((prev) =>
      prev.map((group, k) =>
        k === g
          ? {
              ...group,
              items: group.items.map((it, j) =>
                j === i ? { ...it, ...patch } : it
              ),
            }
          : group
      )
    );
  };
  const removeStepItem = (g: number, i: number) => {
    setStepGroups((prev) =>
      prev.map((group, k) =>
        k === g
          ? {
              ...group,
              items:
                group.items.length <= 1 && group.name === null
                  ? group.items
                  : group.items.filter((_, j) => j !== i),
            }
          : group
      )
    );
  };
  const addStepItemTo = (g: number) => {
    setStepGroups((prev) =>
      prev.map((group, k) =>
        k === g ? { ...group, items: [...group.items, { text: "" }] } : group
      )
    );
  };
  const addStepGroup = () => {
    setStepGroups((prev) => [
      ...prev,
      { name: "", items: [{ text: "" }] },
    ]);
  };
  const removeStepGroup = (g: number) => {
    if (g === 0) return;
    setStepGroups((prev) => {
      const removed = prev[g];
      const survivors = removed?.items.filter((it) => it.text.trim()) ?? [];
      return prev
        .map((group, k) =>
          k === 0 && survivors.length > 0
            ? { ...group, items: [...group.items, ...survivors] }
            : group
        )
        .filter((_, k) => k !== g);
    });
  };
  const setStepGroupName = (g: number, name: string) => {
    setStepGroups((prev) =>
      prev.map((group, k) => (k === g ? { ...group, name } : group))
    );
  };

  // Continuous global step number across all groups — same convention as
  // the layout renderers.
  const stepGlobalIndex = (groupIdx: number, itemIdx: number): number => {
    let n = 0;
    for (let g = 0; g < groupIdx; g++) {
      n += stepGroups[g].items.length;
    }
    return n + itemIdx + 1;
  };

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ background: brand.tokens.background, ...cssVars }}
    >
      <SiteHeader />

      {/* Editor top bar — sticky */}
      <header
        className="sticky top-[68px] z-20 border-b backdrop-blur-xl"
        style={{
          background: brand.tokens.surface + "ee",
          borderColor: brand.tokens.line,
        }}
      >
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-6 py-4 lg:px-10">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href={`/${brand.slug}/${pack.slug}`}
              className="grid size-9 place-items-center rounded-full border transition-colors hover:bg-canvas-alt"
              style={{ borderColor: brand.tokens.line }}
              aria-label="Zurück zum Pack"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M11 7H3m0 0L6.5 3.5M3 7l3.5 3.5"
                  stroke={pack.mood.ink}
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
            <div className="flex min-w-0 flex-col leading-tight">
              <span
                className="truncate font-mono text-[11px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: pack.mood.inkSoft }}
              >
                Pack {String(pack.number).padStart(2, "0")} · {pack.title}
              </span>
              <span
                className="font-display text-[20px] leading-none"
                style={{ color: pack.mood.ink }}
              >
                Neue Rezeptkarte
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {error ? (
              <span
                className="text-[12px] font-medium"
                style={{ color: "#b91c1c" }}
              >
                {error}
              </span>
            ) : null}

            {!isValid ? (
              <span
                className="hidden text-[12px] sm:inline"
                style={{ color: pack.mood.inkSoft }}
              >
                Noch {missingCount} Pflichtfeld{missingCount === 1 ? "" : "er"}
              </span>
            ) : null}

            <Link
              href={`/${brand.slug}/${pack.slug}`}
              className="rounded-full px-4 py-2 text-[13px] font-medium transition-colors hover:bg-canvas-alt"
              style={{ color: pack.mood.ink }}
            >
              Abbrechen
            </Link>

            <button
              type="button"
              disabled={!isValid || saving}
              onClick={handleSave}
              className="editor-button-primary"
              style={{
                background: isValid ? pack.mood.ink : pack.mood.background,
                color: isValid ? pack.mood.background : pack.mood.inkSoft,
                border: isValid ? "none" : `1px solid ${pack.mood.ink}30`,
              }}
            >
              {savedSuccess ? (
                <>
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
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Gespeichert
                </>
              ) : saving ? (
                <>
                  <span className="inline-block size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Speichere…
                </>
              ) : (
                <>
                  Karte speichern
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
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-10 px-6 py-10 lg:grid-cols-[1.5fr_1fr] lg:gap-14 lg:px-10">
          {/* FORM COLUMN */}
          <div className="flex flex-col gap-6">
            {/* Datalist for ingredient autocomplete */}
            <datalist id="ingredient-suggestions">
              {ingredientSuggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>

            {/* Section 1: Eckdaten */}
            <section className="editor-section editor-card">
              <SectionHeader number={1} title="Eckdaten" pack={pack}>
                Was kommt auf die Karte
              </SectionHeader>

              <div className="mt-6 flex flex-col gap-5">
                <Field label="Titel" required>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="z. B. Magerquark-Käsekuchen"
                    className="editor-input"
                  />
                </Field>

                <Field label="Subtitle">
                  <input
                    type="text"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    placeholder="z. B. Cremig, fluffig, 380 kcal"
                    className="editor-input"
                  />
                </Field>

                <Field label="Kurzbeschreibung">
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="2–3 Sätze für die Karte"
                    rows={3}
                    className="editor-input resize-none"
                  />
                </Field>

                <div className="grid grid-cols-3 gap-4">
                  <Field label="Vorbereitung">
                    <div className="relative">
                      <input
                        type="number"
                        inputMode="numeric"
                        value={prepTime}
                        onChange={(e) => setPrepTime(e.target.value)}
                        className="editor-input pr-12"
                      />
                      <UnitSuffix label="Min" />
                    </div>
                  </Field>
                  <Field label="Garzeit">
                    <div className="relative">
                      <input
                        type="number"
                        inputMode="numeric"
                        value={cookTime}
                        onChange={(e) => setCookTime(e.target.value)}
                        placeholder="optional"
                        className="editor-input pr-12"
                      />
                      <UnitSuffix label="Min" />
                    </div>
                  </Field>
                  <Field label="Portionen">
                    <div className="relative">
                      <input
                        type="number"
                        inputMode="numeric"
                        value={servings}
                        onChange={(e) => setServings(e.target.value)}
                        className="editor-input pr-9"
                      />
                      <UnitSuffix label="×" />
                    </div>
                  </Field>
                </div>
                <Field label="Schwierigkeit">
                  <div className="pill-group flex-wrap" role="radiogroup">
                    {(["Einfach", "Mittel", "Aufwendig"] as const).map(
                      (level) => (
                        <button
                          key={level}
                          type="button"
                          role="radio"
                          aria-checked={difficulty === level}
                          onClick={() => setDifficulty(level)}
                          className={`pill-group-btn ${
                            difficulty === level
                              ? "pill-group-btn-active"
                              : ""
                          }`}
                        >
                          {level}
                        </button>
                      )
                    )}
                  </div>
                </Field>
              </div>
            </section>

            {/* Section 2: Tags — pre-defined chips + free-form input */}
            <section className="editor-section editor-card">
              <SectionHeader number={2} title="Tags" pack={pack}>
                Vorschläge anklicken oder eigene tippen
              </SectionHeader>

              <div className="mt-5 flex flex-col gap-4">
                {/* Active tags */}
                {tags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="editor-chip editor-chip-active"
                      >
                        {tag}
                        <span className="opacity-70">×</span>
                      </button>
                    ))}
                  </div>
                ) : null}

                {/* Free-form input */}
                <div
                  className="flex items-center gap-2 rounded-full border px-3 py-1.5"
                  style={{
                    borderColor: brand.tokens.line,
                    background: brand.tokens.surface,
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    aria-hidden
                    style={{ color: pack.mood.inkSoft, flexShrink: 0 }}
                  >
                    <path
                      d="M7 2v10M2 7h10"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagInputKey}
                    placeholder="Eigenen Tag tippen und Enter drücken"
                    className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-ink-subtle"
                    style={{ color: pack.mood.ink }}
                  />
                  {tagInput.trim() ? (
                    <button
                      type="button"
                      onClick={() => {
                        addTag(tagInput);
                        setTagInput("");
                      }}
                      className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em]"
                      style={{
                        background: pack.mood.ink,
                        color: pack.mood.background,
                      }}
                    >
                      + Hinzufügen
                    </button>
                  ) : null}
                </div>

                {/* Suggested chips */}
                <div className="flex flex-wrap gap-2">
                  {tagSuggestions
                    .filter((t) => !tags.includes(t))
                    .map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleSuggestedTag(tag)}
                        className="editor-chip"
                      >
                        + {tag}
                      </button>
                    ))}
                </div>
              </div>
            </section>

            {/* Section 3: Zutaten — group containers */}
            <section className="editor-section editor-card">
              <SectionHeader number={3} title="Zutaten" pack={pack} required>
                Hauptgruppe oben. Mit „+ Neue Gruppe" lassen sich Zutaten in
                Sektionen wie „Für den Teig" / „Glasur" gliedern. Jede Gruppe
                hat einen eigenen „+ Zutat"-Button.
              </SectionHeader>

              <div className="mt-5 flex flex-col gap-5">
                {ingredientGroups.map((group, gIdx) => (
                  <div
                    key={gIdx}
                    className="flex flex-col gap-2"
                    style={
                      gIdx > 0
                        ? {
                            paddingTop: 8,
                            borderTop: `1px solid ${brand.tokens.line}`,
                          }
                        : undefined
                    }
                  >
                    {gIdx === 0 ? (
                      <div className="flex items-baseline gap-2 pb-1">
                        <span
                          className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em]"
                          style={{ color: pack.mood.inkSoft }}
                        >
                          Hauptgruppe
                        </span>
                      </div>
                    ) : (
                      <GroupSeparator
                        value={group.name ?? ""}
                        onChange={(v) => setIngredientGroupName(gIdx, v)}
                        onSubmit={() => addIngredientItemTo(gIdx)}
                        onRemove={() => removeIngredientGroup(gIdx)}
                        pack={pack}
                        kind="ingredient"
                      />
                    )}
                    {group.items.map((item, iIdx) => {
                      const isFocused =
                        focusedIngredient?.g === gIdx &&
                        focusedIngredient?.i === iIdx;
                      const canRemove =
                        gIdx > 0 || group.items.length > 1;
                      return (
                        <div
                          key={iIdx}
                          className={`editor-row grid grid-cols-[7rem_1fr_auto] items-start gap-2 rounded-2xl p-2 transition-colors ${
                            isFocused ? "bg-canvas-alt/40" : ""
                          }`}
                        >
                          <input
                            type="text"
                            value={item.amount}
                            onChange={(e) =>
                              updateIngredientItem(gIdx, iIdx, {
                                amount: e.target.value,
                              })
                            }
                            onFocus={() =>
                              setFocusedIngredient({ g: gIdx, i: iIdx })
                            }
                            placeholder="200 g"
                            className="editor-input"
                            aria-label={`Menge Zutat ${iIdx + 1}`}
                          />
                          <IngredientCombobox
                            value={item.name}
                            onChange={(v) =>
                              updateIngredientItem(gIdx, iIdx, { name: v })
                            }
                            onFocus={() =>
                              setFocusedIngredient({ g: gIdx, i: iIdx })
                            }
                            suggestions={ingredientSuggestions}
                            pack={pack}
                          />
                          <button
                            type="button"
                            onClick={() => removeIngredientItem(gIdx, iIdx)}
                            disabled={!canRemove}
                            className="grid size-[42px] place-items-center rounded-xl border text-[15px] transition-colors hover:bg-canvas-alt disabled:opacity-30"
                            style={{
                              borderColor: brand.tokens.line,
                              color: brand.tokens.inkMuted,
                            }}
                            aria-label="Zutat entfernen"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => addIngredientItemTo(gIdx)}
                      className="self-start text-[12px] font-semibold uppercase tracking-[0.14em] transition-opacity hover:opacity-100"
                      style={{
                        color: pack.mood.inkSoft,
                        opacity: 0.7,
                      }}
                    >
                      + Zutat
                      {gIdx === 0
                        ? " zur Hauptgruppe"
                        : group.name?.trim()
                          ? ` zur „${group.name.trim()}"`
                          : " zur Gruppe"}
                    </button>
                  </div>
                ))}

                <div
                  className="mt-2 flex flex-wrap items-center gap-2 border-t pt-4"
                  style={{ borderColor: brand.tokens.line }}
                >
                  <button
                    type="button"
                    onClick={addIngredientGroup}
                    className="editor-button-primary"
                    style={{
                      background: "transparent",
                      color: pack.mood.ink,
                      border: `1px dashed ${pack.mood.ink}40`,
                    }}
                  >
                    + Neue Gruppe
                  </button>
                  <span
                    className="ml-auto text-[11px] font-semibold uppercase tracking-[0.14em]"
                    style={{ color: pack.mood.inkSoft }}
                  >
                    Schnell-Einheit:
                  </span>
                  {commonUnits.map((unit) => (
                    <button
                      key={unit}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        // Apply unit to focused ingredient if any; else to
                        // the last empty-amount item in the active focus
                        // group; else fall back to Hauptgruppe.
                        let target = focusedIngredient;
                        if (!target) {
                          for (let g = 0; g < ingredientGroups.length; g++) {
                            const items = ingredientGroups[g].items;
                            for (let i = items.length - 1; i >= 0; i--) {
                              if (items[i].amount === "") {
                                target = { g, i };
                                break;
                              }
                            }
                            if (target) break;
                          }
                        }
                        if (!target) return;
                        const item =
                          ingredientGroups[target.g]?.items[target.i];
                        if (!item) return;
                        const numMatch = item.amount.match(
                          /^(\d+(?:[.,]\d+)?)/
                        );
                        const newAmount = numMatch
                          ? `${numMatch[1]} ${unit}`
                          : `1 ${unit}`;
                        updateIngredientItem(target.g, target.i, {
                          amount: newAmount,
                        });
                      }}
                      className="editor-chip"
                    >
                      {unit}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Section 4: Zubereitung — group containers */}
            <section className="editor-section editor-card">
              <SectionHeader number={4} title="Zubereitung" pack={pack} required>
                Hauptgruppe oben. „+ Neue Gruppe" für Sektionen wie „Teig",
                „Glasur" oder Varianten. Jede Gruppe hat einen eigenen
                „+ Schritt"-Button. Nummerierung läuft global durch.
              </SectionHeader>

              <div className="mt-5 flex flex-col gap-5">
                {stepGroups.map((group, gIdx) => (
                  <div
                    key={gIdx}
                    className="flex flex-col gap-3"
                    style={
                      gIdx > 0
                        ? {
                            paddingTop: 8,
                            borderTop: `1px solid ${brand.tokens.line}`,
                          }
                        : undefined
                    }
                  >
                    {gIdx === 0 ? (
                      <div className="flex items-baseline gap-2 pb-1">
                        <span
                          className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em]"
                          style={{ color: pack.mood.inkSoft }}
                        >
                          Hauptgruppe
                        </span>
                      </div>
                    ) : (
                      <GroupSeparator
                        value={group.name ?? ""}
                        onChange={(v) => setStepGroupName(gIdx, v)}
                        onSubmit={() => addStepItemTo(gIdx)}
                        onRemove={() => removeStepGroup(gIdx)}
                        pack={pack}
                        kind="step"
                      />
                    )}
                    {group.items.map((item, iIdx) => {
                      const num = stepGlobalIndex(gIdx, iIdx);
                      const canRemove = gIdx > 0 || group.items.length > 1;
                      return (
                        <div
                          key={iIdx}
                          className="editor-row grid grid-cols-[2.5rem_1fr_auto] items-start gap-3"
                        >
                          <span
                            className="grid size-10 place-items-center rounded-xl font-display text-[18px] tabular-nums"
                            style={{
                              background: pack.mood.background,
                              color: pack.mood.ink,
                            }}
                          >
                            {num}
                          </span>
                          <textarea
                            value={item.text}
                            onChange={(e) =>
                              updateStepItem(gIdx, iIdx, {
                                text: e.target.value,
                              })
                            }
                            placeholder={`Schritt ${num}: was tut man jetzt?`}
                            rows={2}
                            className="editor-input resize-none"
                          />
                          <button
                            type="button"
                            onClick={() => removeStepItem(gIdx, iIdx)}
                            disabled={!canRemove}
                            className="grid size-10 place-items-center rounded-xl border text-[16px] transition-colors hover:bg-canvas-alt disabled:opacity-30"
                            style={{
                              borderColor: brand.tokens.line,
                              color: brand.tokens.inkMuted,
                            }}
                            aria-label="Schritt entfernen"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => addStepItemTo(gIdx)}
                      className="self-start text-[12px] font-semibold uppercase tracking-[0.14em] transition-opacity hover:opacity-100"
                      style={{
                        color: pack.mood.inkSoft,
                        opacity: 0.7,
                      }}
                    >
                      + Schritt
                      {gIdx === 0
                        ? " zur Hauptgruppe"
                        : group.name?.trim()
                          ? ` zur „${group.name.trim()}"`
                          : " zur Gruppe"}
                    </button>
                  </div>
                ))}

                <div
                  className="mt-2 flex flex-wrap items-center gap-2 border-t pt-4"
                  style={{ borderColor: brand.tokens.line }}
                >
                  <button
                    type="button"
                    onClick={addStepGroup}
                    className="editor-button-primary"
                    style={{
                      background: "transparent",
                      color: pack.mood.ink,
                      border: `1px dashed ${pack.mood.ink}40`,
                    }}
                  >
                    + Neue Gruppe
                  </button>
                </div>
              </div>
            </section>

            {/* Section 5: Nährwerte — with basis selector */}
            <section className="editor-section editor-card">
              <SectionHeader number={5} title="Nährwerte" pack={pack} required>
                Werte beziehen sich auf die unten gewählte Bezugsgröße. Kalorien
                ist Pflicht.
              </SectionHeader>

              <div className="mt-5 flex flex-col gap-5">
                <Field label="Bezugsgröße">
                  <div className="pill-group flex-wrap" role="radiogroup">
                    {(
                      [
                        { value: "portion", label: "Pro Portion" },
                        { value: "piece", label: "Pro Stück" },
                        { value: "per100g", label: "Pro 100 g" },
                        { value: "total", label: "Gesamtes Rezept" },
                      ] as Array<{ value: NutritionBasis; label: string }>
                    ).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={nutritionBasis === opt.value}
                        onClick={() => setNutritionBasis(opt.value)}
                        className={`pill-group-btn ${
                          nutritionBasis === opt.value
                            ? "pill-group-btn-active"
                            : ""
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </Field>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <NutriField
                    label="Kalorien"
                    unit="kcal"
                    value={kcal}
                    onChange={setKcal}
                    required
                  />
                  <NutriField
                    label="Eiweiß"
                    unit="g"
                    value={protein}
                    onChange={setProtein}
                  />
                  <NutriField
                    label="Kohlenh."
                    unit="g"
                    value={carbs}
                    onChange={setCarbs}
                  />
                  <NutriField
                    label="Fett"
                    unit="g"
                    value={fat}
                    onChange={setFat}
                  />
                </div>
              </div>
            </section>
          </div>

          {/* PREVIEW COLUMN */}
          <aside className="lg:sticky lg:top-[148px] lg:self-start">
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <span
                className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: brand.tokens.inkMuted }}
              >
                Live-Vorschau
              </span>
              <span
                className="text-[11px]"
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

            {/* Pflicht-Checklist */}
            <div
              className="mt-5 rounded-2xl border p-4"
              style={{
                borderColor: brand.tokens.line,
                background: brand.tokens.surface,
              }}
            >
              <span
                className="mb-3 inline-block text-[11px] font-semibold uppercase tracking-[0.16em]"
                style={{ color: brand.tokens.inkMuted }}
              >
                Pflichtfelder
              </span>
              <ul className="flex flex-col gap-2 text-[13px]">
                {requirements.map((req) => (
                  <li
                    key={req.label}
                    className="flex items-center gap-2"
                    style={{
                      color: req.ok ? pack.mood.ink : brand.tokens.inkMuted,
                    }}
                  >
                    <span
                      className="grid size-4 place-items-center rounded-full text-[10px]"
                      style={{
                        background: req.ok
                          ? pack.mood.accent
                          : brand.tokens.line,
                        color: req.ok ? "white" : brand.tokens.inkMuted,
                      }}
                    >
                      {req.ok ? "✓" : ""}
                    </span>
                    {req.label}
                  </li>
                ))}
              </ul>
            </div>

            <p
              className="mt-4 text-[12px] leading-relaxed"
              style={{ color: brand.tokens.inkMuted }}
            >
              Karte wird in der Datenbank gespeichert — sofort für alle
              sichtbar. Mikronährstoffe und Hero-Bild werden im Hintergrund
              ergänzt (~30–60 Sekunden) und erscheinen ohne Refresh.
            </p>
          </aside>
        </div>
      </main>
    </div>
  );
}

function SectionHeader({
  number,
  title,
  pack,
  required,
  children,
}: {
  number: number;
  title: string;
  pack: NonNullable<ReturnType<typeof getPack>>;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="editor-section-number">
          {String(number).padStart(2, "0")}
        </span>
        <div className="flex flex-col leading-tight">
          <h2
            className="font-display text-[22px]"
            style={{ color: pack.mood.ink }}
          >
            {title}
            {required ? (
              <span
                className="ml-1 text-[14px]"
                style={{ color: pack.mood.accent }}
              >
                *
              </span>
            ) : null}
          </h2>
          <span
            className="mt-0.5 text-[12px]"
            style={{ color: pack.mood.inkSoft }}
          >
            {children}
          </span>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
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
    </label>
  );
}

function UnitSuffix({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-ink-subtle">
      {label}
    </span>
  );
}

// Group divider for ingredient / step lists. Renders as a section separator
// (left rule · "Gruppe ↓" hint · italic name · right rule · remove button)
// rather than a chunky filled block. The "↓" is the affordance: everything
// below the divider belongs to this group until the next divider.
//
// Two visual modes driven by `value`:
//   - non-empty → "Gruppe ↓ Glasur" — full named header
//   - empty     → dotted "Hauptgruppe" indicator — used as a "back to main
//                 group" reset marker after the user has been in a group
function GroupSeparator({
  value,
  onChange,
  onRemove,
  onSubmit,
  pack,
  kind,
}: {
  value: string;
  onChange: (v: string) => void;
  onRemove: () => void;
  /** Called when the user hits Enter inside the group-name input. The
   *  parent uses this to insert a new item row directly underneath. */
  onSubmit?: () => void;
  pack: NonNullable<ReturnType<typeof getPack>>;
  kind: "ingredient" | "step";
}) {
  const placeholder =
    kind === "step"
      ? "z. B. Glasur zubereiten, Variante mit Schoko"
      : "z. B. Für den Teig, Glasur, Topping";

  return (
    <div className="my-1 flex items-center gap-3 py-1">
      <div
        className="h-[2px] w-7 flex-shrink-0 rounded-full"
        style={{ background: pack.mood.accent }}
        aria-hidden
      />
      <span
        className="flex-shrink-0 font-mono text-[10px] font-semibold uppercase tracking-[0.18em]"
        style={{ color: pack.mood.inkSoft }}
      >
        Gruppe ↓
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onSubmit) {
            e.preventDefault();
            onSubmit();
          }
        }}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent font-display text-[15px] italic outline-none placeholder:opacity-50"
        style={{ color: pack.mood.ink }}
        aria-label={`${kind === "step" ? "Schritt" : "Zutaten"}-Gruppe Name`}
      />
      <div
        className="h-px min-w-[1.5rem] flex-shrink"
        style={{ background: pack.mood.accent + "40", flex: "0 1 4rem" }}
        aria-hidden
      />
      <button
        type="button"
        onClick={onRemove}
        className="grid size-7 flex-shrink-0 place-items-center rounded-full text-[13px] transition-colors hover:bg-canvas-alt"
        style={{ color: pack.mood.inkSoft }}
        aria-label="Gruppe entfernen"
      >
        ×
      </button>
    </div>
  );
}

function NutriField({
  label,
  unit,
  value,
  onChange,
  required,
}: {
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <Field label={label} required={required}>
      <div className="relative">
        <input
          type="number"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          className="editor-input pr-12 tabular-nums"
        />
        <UnitSuffix label={unit} />
      </div>
    </Field>
  );
}
