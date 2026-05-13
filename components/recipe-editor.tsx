"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type Brand } from "@/lib/brands";
import { getBrandClient } from "@/lib/custom-brands";
import { getPack, type CardLayout, type Pack } from "@/lib/packs";
import { getCustomPack, updateCustomPackLayout } from "@/lib/custom-packs";
import type { CustomPack } from "@/lib/custom-packs";
import { LayoutPicker } from "@/components/layout-picker";
import { layoutPresets } from "@/lib/pack-presets";
import type {
  Ingredient,
  NutritionBasis,
  Recipe,
  RecipeStep,
} from "@/lib/recipes";
import { normalizeStep } from "@/lib/recipes";
import {
  addCustomRecipe,
  countCustomRecipesForPack,
  slugify,
  updateCustomRecipe,
  type CustomRecipe,
} from "@/lib/custom-recipes";
import {
  ingredientSuggestions,
  commonUnits,
} from "@/lib/ingredient-suggestions";
import { tagSuggestions } from "@/lib/common-tags";
import { sourceLabelForUrl, isLikelyUrl } from "@/lib/source-url";
import { SiteHeader } from "@/components/site-header";
import { RecipeCardPreview } from "@/components/recipe-card-preview";
import { RecipeCardFull } from "@/components/recipe-card-full";
import { IngredientCombobox } from "@/components/ingredient-combobox";
import {
  InstagramImportCard,
  type ImportSource,
} from "@/components/instagram-import-card";
import type { ParsedInstagramRecipe } from "@/lib/ai/parse-instagram";

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

export type RecipeEditorProps = {
  brandSlug: string;
  packSlug: string;
  /** When set, the editor opens in EDIT mode and pre-fills every field
   *  from the existing recipe. Save calls updateCustomRecipe() instead of
   *  addCustomRecipe(). The id is the supabase row id; the recipe is the
   *  full hydrated CustomRecipe so the form starts in the exact state the
   *  card was last saved in. */
  editing?: {
    id: string;
    recipe: CustomRecipe;
  };
};

export function RecipeEditor({
  brandSlug,
  packSlug,
  editing,
}: RecipeEditorProps) {
  const isEditMode = Boolean(editing);
  // Brand wird async geladen — Code-Brand (Biene) zuerst, dann DB-Brand-
  // Lookup. Drei-Zustand-State (undefined = Loading, null = nicht
  // gefunden, Brand = ready) damit DB-Brand-Workspaces den Recipe-Editor
  // auch oeffnen koennen statt "Workspace nicht gefunden" zu zeigen.
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
  const staticPack = getPack(brandSlug, packSlug);
  const router = useRouter();

  // If the pack isn't in the static catalogue, it might be a user-created
  // custom pack stored in Supabase. Keep the full CustomPack (with id) so we
  // can write back the chosen layout when this is the pack's first card.
  const [customPack, setCustomPack] = useState<CustomPack | null>(null);
  const [packLoaded, setPackLoaded] = useState(Boolean(staticPack));

  useEffect(() => {
    if (staticPack) return;
    let active = true;
    void getCustomPack(brandSlug, packSlug).then((found) => {
      if (!active) return;
      setCustomPack(found ?? null);
      setPackLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [staticPack, brandSlug, packSlug]);

  const pack: Pack | undefined = staticPack ?? customPack ?? undefined;

  // Erstellungs-Modus: "manual" = klassisches Tippen, "instagram" = Auto-Fill
  // aus einem Reel/Post-Link. Defaults auf "manual", damit der bestehende
  // Workflow 1:1 unveraendert ist.
  const [mode, setMode] = useState<"manual" | "instagram">("manual");
  // Wenn ein Instagram-Import erfolgreich war, halten wir Source-Infos hier,
  // damit die Import-Card als kollabiertes Banner mit Direktlink rendern
  // kann und der Confidence-Badge sichtbar bleibt.
  const [importedSource, setImportedSource] = useState<ImportSource | null>(
    null
  );
  const [importedConfidence, setImportedConfidence] = useState<
    "high" | "medium" | "low" | null
  >(null);
  const [importedNotes, setImportedNotes] = useState<string | null>(null);
  // Hinweis aus dem Konsistenz-Pass (z. B. "1 unbenutzte Zutat entfernt:
  // MORE Zerup."). null, wenn nichts korrigiert werden musste.
  const [importedReconciliation, setImportedReconciliation] = useState<
    string | null
  >(null);

  // In EDIT mode every field starts pre-filled from the existing recipe.
  // useState's lazy-initializer pattern is used so the prefill happens
  // once on mount and the editor behaves like a controlled form from
  // there on. NEW mode keeps the original defaults.
  const er = editing?.recipe;
  const [title, setTitle] = useState(er?.title ?? "");
  const [subtitle, setSubtitle] = useState(er?.subtitle ?? "");
  const [description, setDescription] = useState(er?.description ?? "");
  const [prepTime, setPrepTime] = useState(
    er?.prepTime != null ? String(er.prepTime) : "15"
  );
  const [cookTime, setCookTime] = useState(
    er?.cookTime != null ? String(er.cookTime) : ""
  );
  const [difficulty, setDifficulty] = useState<Recipe["difficulty"]>(
    er?.difficulty ?? "Einfach"
  );
  const [servings, setServings] = useState(
    er?.servings != null ? String(er.servings) : "2"
  );
  // Card layout — picked once when the user creates the pack's first
  // card, then locked in for every subsequent card. Static curated packs
  // ship with a layout already set; custom packs default to "editorial"
  // until the first save overrides it.
  const [cardLayout, setCardLayout] = useState<CardLayout>(
    er?.cardLayout ?? staticPack?.cardLayout ?? "editorial"
  );
  const cardLayoutTouchedRef = useRef(false);
  useEffect(() => {
    if (cardLayoutTouchedRef.current) return;
    if (customPack?.cardLayout) {
      setCardLayout(customPack.cardLayout);
    }
  }, [customPack?.cardLayout]);

  // Preview mode toggle: thumbnail = how the card looks in the pack grid;
  // full = how the card looks when opened (Recipe-Detail view) — same
  // component the live site uses, scaled down to fit the sidebar.
  const [previewMode, setPreviewMode] = useState<"thumbnail" | "full">(
    "full"
  );
  const [tags, setTags] = useState<string[]>(er?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [ingredientGroups, setIngredientGroups] = useState<
    IngredientGroupState[]
  >(() => {
    // In EDIT mode rebuild the editor's group-container model from the
    // flat Recipe.ingredients[] (each item knows its own group name via
    // .group). Hauptgruppe stays first, named groups follow in first-
    // seen order.
    if (er?.ingredients?.length) {
      const main: IngredientGroupState = { name: null, items: [] };
      const map = new Map<string, IngredientGroupState>();
      for (const ing of er.ingredients) {
        const groupName = ing.group?.trim() || null;
        const item = { amount: ing.amount, name: ing.name };
        if (groupName) {
          if (!map.has(groupName)) map.set(groupName, { name: groupName, items: [] });
          map.get(groupName)!.items.push(item);
        } else {
          main.items.push(item);
        }
      }
      const result: IngredientGroupState[] = [
        main.items.length > 0 ? main : { name: null, items: [{ amount: "", name: "" }] },
      ];
      map.forEach((g) => result.push(g));
      return result;
    }
    return [
      {
        name: null, // Hauptgruppe — always first, always present
        items: [
          { amount: "", name: "" },
          { amount: "", name: "" },
          { amount: "", name: "" },
        ],
      },
    ];
  });
  const [stepGroups, setStepGroups] = useState<StepGroupState[]>(() => {
    if (er?.steps?.length) {
      const main: StepGroupState = { name: null, items: [] };
      const map = new Map<string, StepGroupState>();
      for (const s of er.steps) {
        const step = normalizeStep(s);
        const groupName = step.group?.trim() || null;
        const item = { text: step.text };
        if (groupName) {
          if (!map.has(groupName)) map.set(groupName, { name: groupName, items: [] });
          map.get(groupName)!.items.push(item);
        } else {
          main.items.push(item);
        }
      }
      const result: StepGroupState[] = [
        main.items.length > 0 ? main : { name: null, items: [{ text: "" }] },
      ];
      map.forEach((g) => result.push(g));
      return result;
    }
    return [
      {
        name: null,
        items: [{ text: "" }, { text: "" }, { text: "" }],
      },
    ];
  });
  // Track which (groupIdx, itemIdx) currently has focus — used by the
  // unit-quick-actions to know where to apply.
  const [focusedIngredient, setFocusedIngredient] = useState<{
    g: number;
    i: number;
  } | null>(null);
  const [kcal, setKcal] = useState(
    er?.nutrition.kcal != null ? String(er.nutrition.kcal) : ""
  );
  const [protein, setProtein] = useState(
    er?.nutrition.protein != null ? String(er.nutrition.protein) : ""
  );
  const [carbs, setCarbs] = useState(
    er?.nutrition.carbs != null ? String(er.nutrition.carbs) : ""
  );
  const [fat, setFat] = useState(
    er?.nutrition.fat != null ? String(er.nutrition.fat) : ""
  );
  const [nutritionBasis, setNutritionBasis] = useState<NutritionBasis>(
    er?.nutritionBasis ?? "portion"
  );
  // Optional Original-Link (Instagram-Reel, TikTok, YouTube, beliebiger
  // Link). Beim Instagram-Import wird das Feld automatisch befüllt; im
  // manuellen Modus kann der User selbst eintippen. Aus dem Wert wird
  // beim PDF-Render ein QR-Code im Card-Footer gerendert.
  const [sourceUrl, setSourceUrl] = useState(er?.sourceUrl ?? "");

  // Layout-Tweaks — per-recipe overrides für Edge-Cases. Greifen erst zu,
  // wenn der User sie explizit setzt; "auto" lässt die getDensity- /
  // shouldShowStory-Heuristik gewinnen. Werden nur im Edit-Mode angezeigt
  // und im handleSave als recipe.tweaks gespeichert.
  const [densityOverride, setDensityOverride] = useState<
    "auto" | "compact" | "balanced" | "spacious"
  >(er?.tweaks?.densityOverride ?? "auto");
  const [hideStory, setHideStory] = useState<boolean>(
    er?.tweaks?.hideStory ?? false
  );
  const [hideMicros, setHideMicros] = useState<boolean>(
    er?.tweaks?.hideMicros ?? false
  );
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

  // Layout-picker is only shown for the pack's first recipe. After that
  // every new card inherits the choice. Static packs always inherit the
  // pack's pre-set layout. Edit-mode never shows the picker — changing
  // the layout of a single existing card mid-pack would create visual
  // inconsistency. Per-recipe layout override comes in the Tweaks phase.
  const isStaticPack = Boolean(staticPack);
  const canPickLayout =
    !isEditMode && !isStaticPack && customCountInPack === 0;
  const lockedLayoutPreset = layoutPresets.find(
    (l) => l.id === (pack?.cardLayout ?? cardLayout)
  );

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
      cardLayout,
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
      // Original-Link uebernehmen, damit die Live-Preview den Footer-Hinweis
      // schon anzeigt. Beim Save geht der Wert dann in die DB. Leere Strings
      // werden zu undefined, damit Recipe.sourceUrl optional bleibt.
      ...(sourceUrl.trim()
        ? {
            sourceUrl: sourceUrl.trim(),
            sourceLabel: sourceLabelForUrl(sourceUrl.trim()),
          }
        : {}),
      // Tweaks fliessen sofort in die Live-Preview ein, damit der User
      // den Effekt vor dem Speichern sieht. Wir packen nur die nicht-
      // default Werte rein, damit der Recipe-Type bei "auto/aus" leer
      // bleibt und nicht gespeicherte Defaults trägt.
      ...(densityOverride !== "auto" || hideStory || hideMicros
        ? {
            tweaks: {
              ...(densityOverride !== "auto"
                ? { densityOverride }
                : {}),
              ...(hideStory ? { hideStory: true } : {}),
              ...(hideMicros ? { hideMicros: true } : {}),
            },
          }
        : {}),
    };
  }, [
    pack,
    upcomingNumber,
    cardLayout,
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
    sourceUrl,
    densityOverride,
    hideStory,
    hideMicros,
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

  // Form mit den Werten aus einem erfolgreichen Instagram-Import fuellen.
  // Wir bauen das Group-Container-Modell (Hauptgruppe + benannte Gruppen)
  // aus dem flachen Recipe-Format auf, damit das Form-State-Modell weiter
  // 1:1 mit dem Manuell-Modus funktioniert.
  const handleImported = (
    parsed: ParsedInstagramRecipe,
    source: ImportSource,
    reconciliation: string | null
  ) => {
    setTitle(parsed.title);
    setSubtitle(parsed.subtitle);
    setDescription(parsed.description);
    setPrepTime(String(parsed.prepTime));
    setCookTime(parsed.cookTime ? String(parsed.cookTime) : "");
    setDifficulty(parsed.difficulty);
    setServings(String(parsed.servings));
    setTags(parsed.tags ?? []);
    setKcal(parsed.nutrition.kcal ? String(parsed.nutrition.kcal) : "");
    setProtein(
      parsed.nutrition.protein ? String(parsed.nutrition.protein) : ""
    );
    setCarbs(parsed.nutrition.carbs ? String(parsed.nutrition.carbs) : "");
    setFat(parsed.nutrition.fat ? String(parsed.nutrition.fat) : "");
    setNutritionBasis(parsed.nutritionBasis);

    // Zutaten in Group-Container-Modell ueberfuehren. Hauptgruppe = items
    // ohne group; pro distinct group-Name eine zusaetzliche Gruppe in der
    // Reihenfolge ihres ersten Auftretens (so wie Bienes Captions sie
    // typischerweise schreiben: Hauptzutaten zuerst, dann "Fuer die
    // Glasur").
    const main: IngredientItem[] = [];
    const groupMap = new Map<string, IngredientItem[]>();
    for (const ing of parsed.ingredients) {
      const item: IngredientItem = {
        amount: ing.amount,
        name: ing.name,
      };
      const groupName = ing.group?.trim();
      if (groupName) {
        const list = groupMap.get(groupName) ?? [];
        list.push(item);
        groupMap.set(groupName, list);
      } else {
        main.push(item);
      }
    }
    const newIngredientGroups: IngredientGroupState[] = [
      {
        name: null,
        items:
          main.length > 0 ? main : [{ amount: "", name: "" }],
      },
      ...Array.from(groupMap.entries()).map(([name, items]) => ({
        name,
        items,
      })),
    ];
    setIngredientGroups(newIngredientGroups);

    // Schritte analog: Hauptgruppe + benannte Gruppen
    const mainSteps: StepItem[] = [];
    const stepGroupMap = new Map<string, StepItem[]>();
    for (const st of parsed.steps) {
      const item: StepItem = { text: st.text };
      const groupName = st.group?.trim();
      if (groupName) {
        const list = stepGroupMap.get(groupName) ?? [];
        list.push(item);
        stepGroupMap.set(groupName, list);
      } else {
        mainSteps.push(item);
      }
    }
    const newStepGroups: StepGroupState[] = [
      {
        name: null,
        items: mainSteps.length > 0 ? mainSteps : [{ text: "" }],
      },
      ...Array.from(stepGroupMap.entries()).map(([name, items]) => ({
        name,
        items,
      })),
    ];
    setStepGroups(newStepGroups);

    setImportedSource(source);
    setImportedConfidence(parsed.confidence);
    setImportedNotes(parsed.notes);
    setImportedReconciliation(reconciliation);
    // Original-Link aus dem Import-Source uebernehmen, damit der QR-Code
    // beim PDF-Export auf das Reel zeigt. Im manuellen Modus kann das
    // Feld danach noch editiert werden.
    if (source.url) {
      setSourceUrl(source.url);
    }
  };

  // "Anderer Link"-Klick auf der Import-Card. Das Form bleibt mit den
  // bisherigen Werten gefuellt — der User kann jederzeit die Ergebnisse
  // behalten und nochmal importieren.
  const handleResetImport = () => {
    setImportedSource(null);
    setImportedConfidence(null);
    setImportedNotes(null);
    setImportedReconciliation(null);
  };

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
  if (!pack) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex flex-1 items-center justify-center text-ink-muted">
          {packLoaded ? "Pack nicht gefunden." : "Pack wird geladen…"}
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

    // EDIT mode: write back to the existing row. The slug stays put so
    // existing PDFs / shared links keep resolving. Hero/sourceUrl/sourceLabel
    // from the original are preserved if the user didn't touch sourceUrl.
    if (isEditMode && editing) {
      const existing = editing.recipe;
      // Tweaks-Payload: nur setzen wenn mindestens ein Tweak abweicht
      // vom Default. Sonst löschen wir das Feld komplett, damit gespeicherte
      // Recipes ohne Tweaks nicht mit leerem Objekt im JSONB landen.
      const hasTweaks =
        densityOverride !== "auto" || hideStory || hideMicros;
      const tweaks = hasTweaks
        ? {
            ...(densityOverride !== "auto"
              ? { densityOverride }
              : {}),
            ...(hideStory ? { hideStory: true } : {}),
            ...(hideMicros ? { hideMicros: true } : {}),
          }
        : undefined;

      const updated = await updateCustomRecipe(editing.id, {
        ...existing, // keep original notes/hero/sourceLabel/number/etc.
        slug: existing.slug, // do NOT regenerate — keeps URLs stable
        packSlug: pack.slug,
        cardLayout,
        title: title.trim(),
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
          ...existing.nutrition,
          kcal: parseInt(kcal) || 0,
          protein: parseInt(protein) || 0,
          carbs: parseInt(carbs) || 0,
          fat: parseInt(fat) || 0,
        },
        nutritionBasis,
        // sourceUrl: empty input clears it, otherwise re-derive the label.
        // Hero stays put (existing.hero is in the spread above).
        ...(sourceUrl.trim()
          ? {
              sourceUrl: sourceUrl.trim(),
              sourceLabel: sourceLabelForUrl(sourceUrl.trim()),
            }
          : {
              sourceUrl: undefined,
              sourceLabel: undefined,
            }),
        tweaks,
      });
      if (!updated) {
        setSaving(false);
        setError("Konnte die Änderungen nicht speichern. Bitte erneut versuchen.");
        return;
      }
      // Revalidate so the detail page renders the new content immediately.
      await fetch("/api/packs/revalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandSlug: brand.slug, packSlug: pack.slug }),
      }).catch(() => {
        /* non-blocking */
      });
      setSavedSuccess(true);
      setTimeout(() => {
        router.replace(`/${brand.slug}/${pack.slug}/${updated.slug}`);
      }, 350);
      return;
    }

    // NEW mode: original creation flow.
    const slug = `${slugify(title)}-${Date.now().toString(36).slice(-4)}`;
    // Lock the layout into the pack on the very first card. Subsequent
    // saves see canPickLayout=false and skip this step. Static packs ship
    // with a layout already, so we never write to them here.
    if (canPickLayout && customPack?.id) {
      await updateCustomPackLayout(customPack.id, cardLayout);
    }

    const saved = await addCustomRecipe({
      brandSlug: brand.slug,
      slug,
      packSlug: pack.slug,
      baseRecipeCount: pack.recipeCount,
      cardLayout,
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
      ...(sourceUrl.trim()
        ? {
            sourceUrl: sourceUrl.trim(),
            sourceLabel: sourceLabelForUrl(sourceUrl.trim()),
          }
        : {}),
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
    // Drop the workspace + pack-detail server caches so the new card and the
    // updated recipe-count badge are visible immediately on back-navigation.
    // Awaited so the user lands on fresh server-rendered data.
    await fetch("/api/packs/revalidate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brandSlug: brand.slug,
        packSlug: pack.slug,
      }),
    }).catch(() => {
      /* non-blocking — counts will catch up on the next 30 s revalidate window */
    });
    setSavedSuccess(true);
    setTimeout(() => {
      // router.replace statt router.push: die /new-Editor-Page wird damit
      // aus der Browser-History entfernt. Wenn der User auf der frisch
      // gespeicherten Recipe-Detail-Seite den iOS-/Browser-Zurück-Button
      // tippt, landet er direkt in der Pack-Übersicht ("Alle Rezeptkarten")
      // — nicht mehr auf einem leeren /new-Form. Sauberer Flow.
      router.replace(`/${brand.slug}/${pack.slug}/${saved.slug}`);
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

      {/* Editor top bar — sticky am Viewport-Top.
       *
       * Vorher war hier `top-[68px]` als Reservierung fuer einen full-width
       * SiteHeader, der seit dem UI-Cleanup nicht mehr existiert (SiteHeader
       * rendert jetzt nur einen Floating-Logout-Button rechts oben). Folge:
       * der Header wirkte beim Scrollen "mit-scrollend", weil er erst 68 px
       * unter dem Viewport-Top angedockt hat. Plus der bg-Wert + "ee" (~93 %
       * Alpha) liess die Page-Inhalte beim Scrollen durchschimmern, was den
       * Eindruck verstaerkte.
       *
       * Jetzt: top-0, fast vollstaendig opakes Surface (+ "f8" ≈ 97 %),
       * subtler Shadow fuer visuelle Definition zur darunterliegenden Page,
       * z-30 damit der Header ueber Page-Inhalten liegt aber unter dem
       * Floating-Logout-Button (z-50) bleibt.
       *
       * pr-Reserve auf der rechten Innenseite, damit "Karte speichern" auch
       * bei kleineren Viewports nicht unter den Logout-Button rutscht. */}
      <header
        className="sticky top-0 z-30 border-b backdrop-blur-xl shadow-[0_4px_18px_-12px_rgba(43,31,25,0.18)]"
        style={{
          background: brand.tokens.surface + "f8",
          borderColor: brand.tokens.line,
        }}
      >
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-6 py-3.5 pr-[140px] lg:px-10 lg:pr-[160px]">
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
                {isEditMode ? "Karte bearbeiten" : "Neue Rezeptkarte"}
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
                  {isEditMode ? "Änderungen speichern" : "Karte speichern"}
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

            {/* MODE-SWITCHER — Selbst aufbauen vs. Aus Instagram-Link.
                Sitzt ganz oben in der Form-Spalte, damit der User direkt
                nach dem Aufruf der Seite entscheiden kann. Beim Wechsel
                bleiben bereits eingetragene Werte erhalten — perfekt fuer
                "erst importieren, dann manuell ergaenzen". */}
            <div
              className="flex flex-col gap-1"
              role="tablist"
              aria-label="Erstellungs-Modus"
            >
              <span
                className="text-[11px] font-semibold uppercase tracking-[0.16em]"
                style={{ color: brand.tokens.inkMuted }}
              >
                Wie willst du diese Karte erstellen?
              </span>
              <div
                className="grid grid-cols-1 gap-2 rounded-2xl p-1.5 sm:grid-cols-2"
                style={{
                  background: brand.tokens.surface,
                  border: `1px solid ${brand.tokens.line}`,
                }}
              >
                <ModeTab
                  label="Selbst aufbauen"
                  description="Schritt für Schritt eintragen"
                  icon="manual"
                  active={mode === "manual"}
                  onClick={() => setMode("manual")}
                  pack={pack}
                />
                <ModeTab
                  label="Aus Link"
                  description="Instagram-Reel · TikTok-Video — KI füllt das Form"
                  icon="instagram"
                  active={mode === "instagram"}
                  onClick={() => setMode("instagram")}
                  pack={pack}
                />
              </div>
            </div>

            {/* IMPORT-CARD — nur sichtbar im "instagram"-Mode.
                Bei erfolgreichem Import kollabiert sie zu einem Banner mit
                Source-Info + Confidence-Badge; das Form unten ist dann
                ausgefuellt und der User reviewt nur. */}
            {mode === "instagram" ? (
              <InstagramImportCard
                pack={pack}
                onImported={handleImported}
                onReset={handleResetImport}
                importedSource={importedSource}
                importedConfidence={importedConfidence}
                importedNotes={importedNotes}
                importedReconciliation={importedReconciliation}
              />
            ) : null}

            {/* Section 1: Karten-Layout
                — pick once on the pack's first card, then inherited by
                every subsequent card so the pack PDF reads as one design. */}
            <section className="editor-section editor-card">
              <SectionHeader
                number={1}
                title="Karten-Layout"
                pack={pack}
              >
                {canPickLayout
                  ? "Erste Karte des Packs — wähle das Layout. Alle weiteren Karten in diesem Pack übernehmen es automatisch."
                  : `Layout ist im Pack festgelegt: ${lockedLayoutPreset?.title ?? cardLayout}.`}
              </SectionHeader>
              <div className="mt-6">
                {canPickLayout ? (
                  <LayoutPicker
                    value={cardLayout}
                    onChange={(id) => {
                      setCardLayout(id);
                      cardLayoutTouchedRef.current = true;
                    }}
                    accent={pack.mood.accent}
                    thumbnailMood={{
                      background: pack.mood.background,
                      accent: pack.mood.accent,
                      ink: pack.mood.ink,
                    }}
                  />
                ) : (
                  <div
                    className="flex items-center justify-between gap-4 rounded-2xl border-2 p-4"
                    style={{
                      borderColor: pack.mood.accent + "40",
                      background: pack.mood.accent + "0d",
                    }}
                  >
                    <div className="flex flex-col gap-1">
                      <span
                        className="text-[14px] font-semibold"
                        style={{ color: pack.mood.accent }}
                      >
                        {lockedLayoutPreset?.title ?? cardLayout}
                      </span>
                      <span
                        className="text-[12px] leading-snug"
                        style={{ color: "var(--color-ink-muted)" }}
                      >
                        {lockedLayoutPreset?.description ??
                          "Layout vom Pack vererbt — sorgt für ein einheitliches Pack-PDF."}
                      </span>
                    </div>
                    <span
                      className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em]"
                      style={{ color: pack.mood.accent }}
                    >
                      Pack-Standard
                    </span>
                  </div>
                )}
              </div>
            </section>

            {/* Layout-Feinjustierung — nur im Edit-Mode sichtbar. Hier kann
                der User pro Karte Density/Story/Mikros überschreiben, wenn
                das Auto-Rendering nicht ideal aussieht. Defaults bleiben
                "auto" — nichts greift, bis bewusst geändert wird. */}
            {isEditMode ? (
              <section className="editor-section editor-card">
                <SectionHeader
                  number={2}
                  title="Layout-Feinjustierung"
                  pack={pack}
                >
                  Optionale Tweaks pro Karte. Greifen nur, wenn das Auto-
                  Rendering nicht passt — sonst auf Auto lassen.
                </SectionHeader>
                <div className="mt-6 flex flex-col gap-5">
                  <Field
                    label="Karten-Dichte"
                    hint="Steuert Schriftgrößen und Abstände. Auto wählt anhand der Zutaten- und Schritte-Anzahl. Manuell setzen, wenn das Ergebnis zu eng oder zu leer wirkt."
                  >
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          { id: "auto", label: "Auto" },
                          { id: "compact", label: "Kompakt" },
                          { id: "balanced", label: "Mittel" },
                          { id: "spacious", label: "Großzügig" },
                        ] as const
                      ).map((opt) => {
                        const active = densityOverride === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setDensityOverride(opt.id)}
                            className="rounded-full border px-4 py-1.5 text-[13px] font-medium transition-colors"
                            style={{
                              borderColor: active
                                ? pack.mood.accent
                                : pack.mood.ink + "20",
                              background: active
                                ? pack.mood.accent
                                : "transparent",
                              color: active ? "#fff" : pack.mood.inkSoft,
                            }}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </Field>

                  <Field
                    label="Story-Block"
                    hint="Bei kurzen Karten (≤10 Zutaten) blendet das Layout automatisch ein italic-Zitat aus der Beschreibung ein, damit die Seite nicht halbleer wirkt. Hier abschaltbar."
                  >
                    <ToggleRow
                      label="Story-Zitat ausblenden"
                      checked={hideStory}
                      onChange={setHideStory}
                      accent={pack.mood.accent}
                    />
                  </Field>

                  <Field
                    label="Mikronährstoffe"
                    hint="Verbirgt den Mikronährstoff-Block (Wine-Notes, Planeten, Bars je nach Layout). Hilfreich, wenn nur schwache Mikro-Daten vorliegen."
                  >
                    <ToggleRow
                      label="Mikronährstoffe ausblenden"
                      checked={hideMicros}
                      onChange={setHideMicros}
                      accent={pack.mood.accent}
                    />
                  </Field>
                </div>
              </section>
            ) : null}

            {/* Section 2: Eckdaten */}
            <section className="editor-section editor-card">
              <SectionHeader number={2} title="Eckdaten" pack={pack}>
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
              <SectionHeader number={3} title="Tags" pack={pack}>
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
              <SectionHeader number={4} title="Zutaten" pack={pack} required>
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
              <SectionHeader number={5} title="Zubereitung" pack={pack} required>
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
              <SectionHeader number={6} title="Nährwerte" pack={pack} required>
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

            {/* Section 6: Original-Link — optional. Wird beim Instagram-
                Import automatisch befüllt; im manuellen Modus kann der
                User selbst einen Reel-/TikTok-/YouTube-Link eintragen.
                Aus dem Wert wird beim PDF-Export ein QR-Code im Card-
                Footer gerendert. Leer = kein QR, keine Footer-Quelle. */}
            <section className="editor-section editor-card">
              <SectionHeader number={7} title="Original-Link" pack={pack}>
                Optional. Wenn die Karte aus einem Reel, TikTok oder YouTube
                stammt, kommt hier der Link rein — daraus wird im PDF ein
                QR-Code im Footer generiert.
              </SectionHeader>

              <div className="mt-5 flex flex-col gap-3">
                <div
                  className="flex items-center gap-2 rounded-2xl border px-3 py-2.5 transition-colors"
                  style={{
                    borderColor:
                      sourceUrl.trim() && !isLikelyUrl(sourceUrl)
                        ? "#c0392b"
                        : brand.tokens.line,
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
                      d="M5.5 8.5L8.5 5.5M6 3.5L4 5.5C2.9 6.6 2.9 8.4 4 9.5C5.1 10.6 6.9 10.6 8 9.5L8.5 9M8 10.5L10 8.5C11.1 7.4 11.1 5.6 10 4.5C8.9 3.4 7.1 3.4 6 4.5L5.5 5"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <input
                    type="url"
                    inputMode="url"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://www.instagram.com/reel/… oder https://www.tiktok.com/@…"
                    className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-ink-subtle"
                    style={{ color: pack.mood.ink }}
                  />
                  {sourceUrl.trim() ? (
                    <button
                      type="button"
                      onClick={() => setSourceUrl("")}
                      className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                      style={{ color: brand.tokens.inkMuted }}
                      aria-label="Link entfernen"
                    >
                      ×
                    </button>
                  ) : null}
                </div>

                {sourceUrl.trim() && isLikelyUrl(sourceUrl) ? (
                  <p
                    className="text-[12px]"
                    style={{ color: brand.tokens.inkMuted }}
                  >
                    QR-Code im PDF-Footer wird auf{" "}
                    <span style={{ color: pack.mood.ink, fontWeight: 600 }}>
                      {sourceLabelForUrl(sourceUrl)}
                    </span>{" "}
                    zeigen.
                  </p>
                ) : sourceUrl.trim() && !isLikelyUrl(sourceUrl) ? (
                  <p className="text-[12px]" style={{ color: "#c0392b" }}>
                    Bitte eine vollständige URL eintragen (mit https://).
                  </p>
                ) : (
                  <p
                    className="text-[12px]"
                    style={{ color: brand.tokens.inkMuted, opacity: 0.75 }}
                  >
                    Leer lassen, falls kein Original-Link existiert — der
                    Footer rendert dann ohne QR.
                  </p>
                )}
              </div>
            </section>
          </div>

          {/* PREVIEW COLUMN */}
          {/* Live-Vorschau dockt unter dem Editor-Header an. Versatz war
           *  vorher 148 px (alter SiteHeader 68 + alter Editor-Header 80).
           *  Editor-Header ist jetzt top-0 + py-3.5 + ~36 px Inhalt ≈ 64 px
           *  hoch — 80 px gibt etwas Luft, damit die Aside nicht direkt am
           *  Header klebt. */}
          <aside className="lg:sticky lg:top-[80px] lg:self-start">
            <div className="mb-3 flex items-baseline justify-between gap-3">
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
                {previewMode === "thumbnail"
                  ? "so erscheint sie im Pack"
                  : "so sieht die Karte geöffnet aus"}
              </span>
            </div>

            {/* Mode toggle — pill switcher between thumbnail and full card.
                Both views update live as the user types. */}
            <div
              className="mb-4 inline-flex w-full overflow-hidden rounded-full border p-1"
              style={{
                borderColor: brand.tokens.line,
                background: brand.tokens.surface,
              }}
            >
              <PreviewTabButton
                label="Volle Karte"
                active={previewMode === "full"}
                onClick={() => setPreviewMode("full")}
                pack={pack}
              />
              <PreviewTabButton
                label="Karten-Vorschau"
                active={previewMode === "thumbnail"}
                onClick={() => setPreviewMode("thumbnail")}
                pack={pack}
              />
            </div>

            {previewRecipe ? (
              previewMode === "thumbnail" ? (
                <RecipeCardPreview
                  brand={brand}
                  pack={pack}
                  recipe={previewRecipe}
                />
              ) : (
                <FullCardPreview
                  brand={brand}
                  pack={pack}
                  recipe={previewRecipe}
                />
              )
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
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  /** Optional explanatory text below the label. Renders muted + small —
   *  used by the Tweaks section to explain what each override does. */
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
        {label}
        {required ? <span className="text-accent">{" *"}</span> : null}
      </span>
      {hint ? (
        <span className="text-[12px] leading-snug text-ink-muted/80">
          {hint}
        </span>
      ) : null}
      {children}
    </label>
  );
}

// Simple checkbox-row used by the Tweaks section. Clickable surface is the
// whole row so it's forgiving on mobile.
function ToggleRow({
  label,
  checked,
  onChange,
  accent,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  accent: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-canvas-alt"
      style={{
        borderColor: checked ? accent : "var(--color-line)",
        background: checked ? accent + "10" : "transparent",
      }}
    >
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors"
        style={{
          borderColor: checked ? accent : "var(--color-line)",
          background: checked ? accent : "transparent",
        }}
      >
        {checked ? (
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path
              d="M3 7l3 3 5-7"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </span>
      <span className="text-[14px] font-medium" style={{ color: "var(--color-ink)" }}>
        {label}
      </span>
    </button>
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

// Tab-style button used in the preview-mode pill switcher.
function PreviewTabButton({
  label,
  active,
  onClick,
  pack,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  pack: Pack;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all"
      style={{
        background: active ? pack.mood.accent : "transparent",
        color: active ? "white" : "var(--color-ink-muted)",
      }}
    >
      {label}
    </button>
  );
}

// Mode-Switcher-Tab. Zwei nebeneinander = die zwei Wege, eine Karte zu
// erstellen ("Selbst aufbauen" vs. "Aus Instagram-Link"). Aktive Variante
// ist mit dem Pack-Mood-Akzent eingefaerbt, inaktive bleibt dezent.
function ModeTab({
  label,
  description,
  icon,
  active,
  onClick,
  pack,
}: {
  label: string;
  description: string;
  icon: "manual" | "instagram";
  active: boolean;
  onClick: () => void;
  pack: Pack;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="group flex items-start gap-3 rounded-xl px-3.5 py-3 text-left transition-all"
      style={{
        background: active ? pack.mood.accent : "transparent",
        color: active ? "white" : pack.mood.ink,
        boxShadow: active
          ? `0 1px 2px ${pack.mood.ink}10, 0 4px 16px ${pack.mood.accent}30`
          : "none",
      }}
    >
      <span
        className="mt-0.5 grid size-8 flex-shrink-0 place-items-center rounded-lg"
        style={{
          background: active
            ? "rgba(255,255,255,0.18)"
            : pack.mood.accent + "12",
          color: active ? "white" : pack.mood.accent,
        }}
        aria-hidden
      >
        {icon === "manual" ? <ModeManualIcon /> : <ModeInstagramIcon />}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[14px] font-semibold leading-tight">
          {label}
        </span>
        <span
          className="text-[12px] leading-snug"
          style={{
            color: active ? "rgba(255,255,255,0.85)" : pack.mood.inkSoft,
          }}
        >
          {description}
        </span>
      </span>
    </button>
  );
}

function ModeManualIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M2.5 11l1-3.5 5.5-5.5 2.5 2.5-5.5 5.5L2.5 11z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 3.5l2 2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ModeInstagramIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect
        x="1.75"
        y="1.75"
        width="10.5"
        height="10.5"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <circle cx="7" cy="7" r="2.3" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="10.1" cy="3.9" r="0.75" fill="currentColor" />
    </svg>
  );
}

// Renders the actual recipe-detail card (same component the live site uses)
// scaled down to fit the editor sidebar. CSS `zoom` shrinks the layout +
// flow so the sidebar stays scrollable instead of overflowing horizontally,
// and the detail card renders in its full Desktop grid (not the
// single-column responsive fallback).
function FullCardPreview({
  brand,
  pack,
  recipe,
}: {
  brand: Brand;
  pack: Pack;
  recipe: Recipe;
}) {
  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{
        borderColor: "var(--color-line)",
        background: pack.mood.background,
      }}
    >
      <div
        // Erzwingt einen Desktop-Viewport für die innere Karte (1100 px
        // breit), damit ihre lg:-Breakpoints feuern (Split-Titel/Foto,
        // 2-Spalten-Body etc.). Der Outer-Zoom skaliert die gerenderten
        // Pixel auf das Sidebar-Maß runter:
        //   - Mobile: 0.32 (1100 × 0.32 = 352 px) — passt in Mobile-Viewport
        //   - sm+: 0.5 (1100 × 0.5 = 550 px) — wie bisher in der Editor-
        //     Sidebar.
        className="[zoom:0.32] sm:[zoom:0.5]"
        style={{
          width: "1100px",
        }}
      >
        <RecipeCardFull
          brand={brand}
          pack={pack}
          recipe={recipe}
          totalRecipes={1}
        />
      </div>
    </div>
  );
}
