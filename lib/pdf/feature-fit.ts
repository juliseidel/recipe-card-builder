// Feature-Layout One-Page-Garantie — geteilt zwischen PDF-Renderer und
// Web-Preview damit beide GARANTIERT das gleiche Density-Tier waehlen.
//
// react-pdf hat keine Measurement-API zur Render-Zeit. Daher rechnen wir
// VOR dem Render die wahrscheinliche Content-Hoehe aus und waehlen
// iterativ die grosszuegigste Density-Stufe, deren Estimation auf 842 pt
// passt. Bei extreme + insufficient-fit: Smart-Truncation der Story/
// Subtitle als letzter Safety-Net.
//
// Dieses Modul ist BEWUSST frei von @react-pdf/renderer-Imports damit es
// auch im Client-Bundle (Web-Renderer) genutzt werden kann ohne den
// PDF-Engine-Code in den Browser zu ziehen.

import type { Recipe, Micronutrient } from "@/lib/recipes";
import {
  groupIngredients,
  groupSteps,
  type IngredientGroup,
} from "./helpers";
import { formatIngredientAmount } from "@/lib/format-ingredient";

// ─── Density-Skala ──────────────────────────────────────────────────────────
export type FeatureDensityTier =
  | "spacious"
  | "balanced"
  | "compact"
  | "ultra"
  | "extreme";

export type FeatureDensityValues = {
  contentWidthPct: number;
  fadeWidth: number;
  contentPadH: number;
  contentPadTop: number;
  contentPadBottom: number;
  titleFontSize: number;
  storyFontSize: number;
  storyLineHeight: number;
  metaFontSize: number;
  metaIconSize: number;
  metaRowGap: number;
  macroFontSize: number;
  macroLabelFontSize: number;
  macroRowGap: number;
  sectionLabelFontSize: number;
  sectionLabelGapTop: number;
  sectionLabelGapBottom: number;
  ingredientFontSize: number;
  ingredientLineHeight: number;
  ingredientGap: number;
  ingredientGroupLabelFontSize: number;
  ingredientColumnGap: number;
  stepNumColWidth: number;
  stepNumFontSize: number;
  stepFontSize: number;
  stepLineHeight: number;
  stepGap: number;
  microsFontSize: number;
  microsLineHeight: number;
  footerFontSize: number;
  eyebrowFontSize: number;
};

// Kanonische PT-Density-Tabelle. Werte sind in PDF-Punkten (1pt = 1/72 inch);
// der Web-Renderer hat eine eigene px-Tabelle mit visueller Skalierung,
// nutzt aber DIESE Tabelle fuer die tier-Auswahl, damit Preview und Print
// IMMER zum gleichen Tier kommen.
export const FEATURE_DENSITY: Record<FeatureDensityTier, FeatureDensityValues> =
  {
    extreme: {
      contentWidthPct: 0.46,
      fadeWidth: 50,
      contentPadH: 18,
      contentPadTop: 18,
      contentPadBottom: 14,
      titleFontSize: 14,
      storyFontSize: 6.8,
      storyLineHeight: 1.25,
      metaFontSize: 6.5,
      metaIconSize: 8,
      metaRowGap: 10,
      macroFontSize: 7,
      macroLabelFontSize: 5.5,
      macroRowGap: 6,
      sectionLabelFontSize: 6,
      sectionLabelGapTop: 5,
      sectionLabelGapBottom: 3,
      ingredientFontSize: 6.8,
      ingredientLineHeight: 1.25,
      ingredientGap: 1,
      ingredientGroupLabelFontSize: 6,
      ingredientColumnGap: 8,
      stepNumColWidth: 12,
      stepNumFontSize: 7.5,
      stepFontSize: 6.8,
      stepLineHeight: 1.22,
      stepGap: 2.5,
      microsFontSize: 6.5,
      microsLineHeight: 1.22,
      footerFontSize: 6,
      eyebrowFontSize: 6,
    },
    ultra: {
      contentWidthPct: 0.44,
      fadeWidth: 56,
      contentPadH: 20,
      contentPadTop: 22,
      contentPadBottom: 18,
      titleFontSize: 17,
      storyFontSize: 7.5,
      storyLineHeight: 1.35,
      metaFontSize: 7,
      metaIconSize: 9,
      metaRowGap: 12,
      macroFontSize: 8,
      macroLabelFontSize: 6,
      macroRowGap: 8,
      sectionLabelFontSize: 6.5,
      sectionLabelGapTop: 7,
      sectionLabelGapBottom: 4,
      ingredientFontSize: 7.5,
      ingredientLineHeight: 1.35,
      ingredientGap: 1.5,
      ingredientGroupLabelFontSize: 6.5,
      ingredientColumnGap: 10,
      stepNumColWidth: 13,
      stepNumFontSize: 8,
      stepFontSize: 7.5,
      stepLineHeight: 1.3,
      stepGap: 3.5,
      microsFontSize: 7,
      microsLineHeight: 1.3,
      footerFontSize: 6.5,
      eyebrowFontSize: 6.5,
    },
    compact: {
      contentWidthPct: 0.42,
      fadeWidth: 60,
      contentPadH: 24,
      contentPadTop: 26,
      contentPadBottom: 22,
      titleFontSize: 19,
      storyFontSize: 8,
      storyLineHeight: 1.4,
      metaFontSize: 7.5,
      metaIconSize: 9.5,
      metaRowGap: 14,
      macroFontSize: 8.5,
      macroLabelFontSize: 6.2,
      macroRowGap: 9,
      sectionLabelFontSize: 6.8,
      sectionLabelGapTop: 10,
      sectionLabelGapBottom: 6,
      ingredientFontSize: 7.8,
      ingredientLineHeight: 1.42,
      ingredientGap: 1.8,
      ingredientGroupLabelFontSize: 6.8,
      ingredientColumnGap: 11,
      stepNumColWidth: 14,
      stepNumFontSize: 8.5,
      stepFontSize: 8,
      stepLineHeight: 1.35,
      stepGap: 4.5,
      microsFontSize: 7.2,
      microsLineHeight: 1.35,
      footerFontSize: 6.8,
      eyebrowFontSize: 6.8,
    },
    balanced: {
      contentWidthPct: 0.44,
      fadeWidth: 68,
      contentPadH: 28,
      contentPadTop: 34,
      contentPadBottom: 28,
      titleFontSize: 25,
      storyFontSize: 9,
      storyLineHeight: 1.5,
      metaFontSize: 8.5,
      metaIconSize: 11,
      metaRowGap: 18,
      macroFontSize: 9.5,
      macroLabelFontSize: 6.8,
      macroRowGap: 11,
      sectionLabelFontSize: 7.3,
      sectionLabelGapTop: 14,
      sectionLabelGapBottom: 8,
      ingredientFontSize: 8.8,
      ingredientLineHeight: 1.55,
      ingredientGap: 2.5,
      ingredientGroupLabelFontSize: 7.3,
      ingredientColumnGap: 13,
      stepNumColWidth: 17,
      stepNumFontSize: 9.8,
      stepFontSize: 9.2,
      stepLineHeight: 1.48,
      stepGap: 6,
      microsFontSize: 8.2,
      microsLineHeight: 1.48,
      footerFontSize: 7.3,
      eyebrowFontSize: 7.3,
    },
    spacious: {
      contentWidthPct: 0.46,
      fadeWidth: 78,
      contentPadH: 32,
      contentPadTop: 44,
      contentPadBottom: 36,
      titleFontSize: 32,
      storyFontSize: 10.5,
      storyLineHeight: 1.62,
      metaFontSize: 9.5,
      metaIconSize: 12,
      metaRowGap: 20,
      macroFontSize: 11,
      macroLabelFontSize: 7.5,
      macroRowGap: 14,
      sectionLabelFontSize: 8,
      sectionLabelGapTop: 20,
      sectionLabelGapBottom: 11,
      ingredientFontSize: 9.5,
      ingredientLineHeight: 1.7,
      ingredientGap: 4,
      ingredientGroupLabelFontSize: 8,
      ingredientColumnGap: 16,
      stepNumColWidth: 20,
      stepNumFontSize: 11,
      stepFontSize: 10,
      stepLineHeight: 1.6,
      stepGap: 9,
      microsFontSize: 9,
      microsLineHeight: 1.55,
      footerFontSize: 8,
      eyebrowFontSize: 8,
    },
  };

// ─── Pure Helpers ───────────────────────────────────────────────────────────

// Title-Auto-Shrink — Content-Spalte ist ~210 pt usable, daher aggressivere
// Stufen als Studio (~520 pt usable).
export function featureTitleScale(title: string): number {
  const len = title.length;
  if (len <= 14) return 1;
  if (len <= 22) return 0.86;
  if (len <= 32) return 0.74;
  if (len <= 44) return 0.64;
  return 0.56;
}

// Step-Font-Shrink: Content-Spalte ist zu schmal fuer 2-Spalten-Steps wie
// Studio, also stattdessen progressive Font-Verkleinerung. Wert wird auf
// stepFontSize + stepNumFontSize + stepGap gleichzeitig angewandt.
export function featureStepFontShrink(stepCount: number): number {
  if (stepCount >= 12) return -1.5;
  if (stepCount >= 8) return -0.7;
  return 0;
}

// Macros — nur Werte > 0.
export function featureMacroEntries(
  recipe: Recipe
): Array<{ label: string; value: string }> {
  const n = recipe.nutrition;
  const entries: Array<{ label: string; value: string }> = [];
  if (n.kcal > 0) entries.push({ label: "KCAL", value: String(n.kcal) });
  if (n.protein > 0) entries.push({ label: "P", value: `${n.protein} g` });
  if (n.carbs > 0) entries.push({ label: "KH", value: `${n.carbs} g` });
  if (n.fat > 0) entries.push({ label: "F", value: `${n.fat} g` });
  return entries;
}

// "Für die X" Regel — analog restaurantGroupLabel + studioGroupLabel.
export function featureGroupLabel(name: string): string {
  return /^(den|die|das)\s/i.test(name) ? `Für ${name.toLowerCase()}` : name;
}

// Zutaten-Layout: bei wenigen Items 1 Spalte, sonst 2 Spalten. Bei mehreren
// Sub-Groups wird die erste Gruppe links, restliche rechts gerendert; bei
// einer einzigen Gruppe wird sie 50/50 in zwei Listen halbiert.
export type IngredientColumnPlan = {
  twoCol: boolean;
  leftBlocks: IngredientGroup[];
  rightBlocks: IngredientGroup[];
};

export function featurePlanIngredientColumns(
  groups: IngredientGroup[]
): IngredientColumnPlan {
  const totalItems = groups.reduce((s, g) => s + g.items.length, 0);
  if (totalItems < 6) {
    return { twoCol: false, leftBlocks: groups, rightBlocks: [] };
  }
  if (groups.length >= 2) {
    const first = groups[0];
    const rest = groups.slice(1);
    const restCount = rest.reduce((s, g) => s + g.items.length, 0);
    if (first.items.length > restCount * 2.5 && first.items.length >= 6) {
      const half = Math.ceil(first.items.length / 2);
      return {
        twoCol: true,
        leftBlocks: [{ name: first.name, items: first.items.slice(0, half) }],
        rightBlocks: [
          { name: null, items: first.items.slice(half) },
          ...rest,
        ],
      };
    }
    return { twoCol: true, leftBlocks: [first], rightBlocks: rest };
  }
  const g = groups[0];
  const half = Math.ceil(g.items.length / 2);
  return {
    twoCol: true,
    leftBlocks: [{ name: g.name, items: g.items.slice(0, half) }],
    rightBlocks: [{ name: null, items: g.items.slice(half) }],
  };
}

// shouldShowStory + visibleMicros + shouldShowMicros werden inline
// nachgebildet damit dieses Modul ohne @react-pdf/recipe-card-pdf-Imports
// auskommt (sonst Zirkular-Import).
function shouldShowStoryLocal(recipe: Recipe): boolean {
  if (recipe.tweaks?.hideStory) return false;
  return recipe.ingredients.length <= 10 && Boolean(recipe.description?.trim());
}

function visibleMicrosLocal(recipe: Recipe): Micronutrient[] {
  if (recipe.tweaks?.hideMicros) return [];
  return recipe.nutrition.micros ?? [];
}

// ─── Page-Geometrie ─────────────────────────────────────────────────────────

const PAGE_HEIGHT_PT = 842;
// 8 pt Puffer gegen Estimator-Ungenauigkeit + minimale Spacer-Hoehe.
export const PAGE_USABLE_PT = PAGE_HEIGHT_PT - 8;

// ─── Estimator ──────────────────────────────────────────────────────────────

// Konservative Schaetzung der Zeilen-Anzahl. avgCharWidth = 0.5 * fontSize
// (worst-case fuer Inter; Fraunces marginal breiter aber Titles dominieren
// nicht das Budget). Newlines im Text zaehlen als harte Brueche.
export function estimateLines(
  text: string | undefined | null,
  fontSize: number,
  containerWidth: number
): number {
  if (!text) return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const avgCharWidth = fontSize * 0.5;
  const charsPerLine = Math.max(8, Math.floor(containerWidth / avgCharWidth));
  const segments = trimmed.split(/\n+/);
  let lines = 0;
  for (const seg of segments) {
    lines += Math.max(1, Math.ceil(seg.length / charsPerLine));
  }
  return lines;
}

// ─── Render-Mode ────────────────────────────────────────────────────────────

export type FeatureRenderMode = {
  density: FeatureDensityTier;
  showSubtitle: boolean;
  showStory: boolean;
  microsInline: boolean;
  microsAsSection: boolean;
  truncateStory: boolean;
  truncateSubtitle: boolean;
};

export function buildFeatureMode(
  density: FeatureDensityTier,
  recipe: Recipe
): FeatureRenderMode {
  const isDense =
    density === "compact" || density === "ultra" || density === "extreme";
  const baseShowStory =
    shouldShowStoryLocal(recipe) &&
    (density === "balanced" || density === "spacious");
  return {
    density,
    showSubtitle: density !== "extreme",
    showStory: baseShowStory,
    microsInline: isDense,
    microsAsSection: !isDense,
    truncateStory: density === "extreme",
    truncateSubtitle: density === "extreme",
  };
}

// Rechnet die wahrscheinliche Content-Hoehe in pt. Bei den meisten Recipes
// liegt die Schaetzung +/- 5 % am tatsaechlichen Render — der 8-pt-Puffer
// in PAGE_USABLE_PT faengt diese Unschaerfe ab.
export function estimateFeatureContentHeight(
  recipe: Recipe,
  d: FeatureDensityValues,
  mode: FeatureRenderMode
): number {
  const contentWidth = 595 * d.contentWidthPct;
  const usableW = contentWidth - d.contentPadH * 2;

  const grouped = groupIngredients(recipe.ingredients);
  const ingPlan = featurePlanIngredientColumns(grouped);
  const colW = ingPlan.twoCol
    ? (usableW - d.ingredientColumnGap) / 2
    : usableW;

  const stepGroups = groupSteps(recipe.steps);
  const stepShrink = featureStepFontShrink(recipe.steps.length);
  const stepFontSize = d.stepFontSize + stepShrink;
  const stepNumFontSize = d.stepNumFontSize + stepShrink;
  const stepGapPt = Math.max(d.stepGap + stepShrink * 0.5, 2);
  const stepBodyW = usableW - d.stepNumColWidth - 4;

  const titleScale =
    featureTitleScale(recipe.title) + (recipe.tweaks?.titleScale ?? 0) * 0.03;
  const finalTitleSize = d.titleFontSize * titleScale;

  let h = 0;

  // Padding oben + unten
  h += d.contentPadTop + d.contentPadBottom;

  // Eyebrow (1 Zeile + margin-bottom 14)
  h += d.eyebrowFontSize * 1.2 + 14;

  // Title (variable Zeilen)
  h += estimateLines(recipe.title, finalTitleSize, usableW) * finalTitleSize * 1.06;

  // Akzent-Strich (margin-top 8 + height 2 + margin-bottom 12)
  h += 8 + 2 + 12;

  // Subtitle
  if (recipe.subtitle && mode.showSubtitle && !mode.truncateSubtitle) {
    const subFs = d.storyFontSize + 0.5;
    h += estimateLines(recipe.subtitle, subFs, usableW) * subFs * 1.45 + 8;
  }

  // Story
  if (mode.showStory && recipe.description && !mode.truncateStory) {
    h +=
      estimateLines(recipe.description, d.storyFontSize, usableW) *
        d.storyFontSize *
        d.storyLineHeight +
      6;
  }

  // Meta-Row
  h += Math.max(d.metaIconSize, d.metaFontSize * 1.2) + 28;

  // Macros + (optional) Mikros-Inline
  const macros = featureMacroEntries(recipe);
  const micros = visibleMicrosLocal(recipe);
  const microsCount = Math.min(micros.length, 4);

  if (macros.length > 0 || (mode.microsInline && microsCount > 0)) {
    h += 12;
    if (macros.length > 0) {
      h += (d.macroFontSize + 1.5) * 1.1 + 2 + d.macroLabelFontSize * 1.2;
    }
    if (mode.microsInline && microsCount > 0) {
      const microsText =
        "Reich an " +
        micros
          .slice(0, 4)
          .map((m) => `${m.name}${m.pctDaily ? ` ${m.pctDaily} %` : ""}`)
          .join(" · ");
      h +=
        estimateLines(microsText, d.microsFontSize, usableW) *
        d.microsFontSize *
        d.microsLineHeight;
      if (macros.length > 0) h += 14;
    }
  }

  // Section "Zutaten"
  h +=
    d.sectionLabelGapTop +
    d.sectionLabelFontSize * 1.2 +
    d.sectionLabelGapBottom;

  let ingredientsHLeft = 0;
  let ingredientsHRight = 0;
  for (const g of ingPlan.leftBlocks) {
    if (g.name) ingredientsHLeft += d.ingredientGroupLabelFontSize * 1.2 + 4;
    for (const it of g.items) {
      const amount = formatIngredientAmount(it.amount);
      const lineText =
        (amount ? amount + "  " : "") +
        it.name +
        (it.note ? ` (${it.note})` : "");
      ingredientsHLeft +=
        estimateLines(lineText, d.ingredientFontSize, colW) *
          d.ingredientFontSize *
          d.ingredientLineHeight +
        d.ingredientGap;
    }
  }
  for (const g of ingPlan.rightBlocks) {
    if (g.name) ingredientsHRight += d.ingredientGroupLabelFontSize * 1.2 + 4;
    for (const it of g.items) {
      const amount = formatIngredientAmount(it.amount);
      const lineText =
        (amount ? amount + "  " : "") +
        it.name +
        (it.note ? ` (${it.note})` : "");
      ingredientsHRight +=
        estimateLines(lineText, d.ingredientFontSize, colW) *
          d.ingredientFontSize *
          d.ingredientLineHeight +
        d.ingredientGap;
    }
  }
  h += ingPlan.twoCol
    ? Math.max(ingredientsHLeft, ingredientsHRight)
    : ingredientsHLeft;

  // Section "Reich an" (nur wenn microsAsSection)
  if (mode.microsAsSection && microsCount > 0) {
    h +=
      d.sectionLabelGapTop +
      d.sectionLabelFontSize * 1.2 +
      d.sectionLabelGapBottom;
    const microsText = micros
      .slice(0, 4)
      .map((m) => `${m.name}${m.pctDaily ? ` ${m.pctDaily} %` : ""}`)
      .join(" · ");
    h +=
      estimateLines(microsText, d.microsFontSize + 0.5, usableW) *
      (d.microsFontSize + 0.5) *
      d.microsLineHeight;
  }

  // Section "Zubereitung"
  h +=
    d.sectionLabelGapTop +
    d.sectionLabelFontSize * 1.2 +
    d.sectionLabelGapBottom;

  for (const g of stepGroups) {
    if (g.name) {
      h += d.ingredientGroupLabelFontSize * 1.2 + Math.max(stepGapPt - 2, 2);
    }
    for (const it of g.items) {
      const stepBlockH = Math.max(
        estimateLines(it.text, stepFontSize, stepBodyW) *
          stepFontSize *
          d.stepLineHeight,
        stepNumFontSize * 1.2
      );
      h += stepBlockH + stepGapPt;
    }
  }

  // Footer (border-top 10 + 1-Zeile)
  h += 10 + d.footerFontSize * 1.4;

  return h;
}

// ─── Picker ─────────────────────────────────────────────────────────────────

// Iteriert von der grosszuegigsten zur engsten Stufe. Nimmt die erste deren
// Estimation auf PAGE_USABLE_PT passt. Falls auch extreme overflowed:
// return extreme + truncateStory/truncateSubtitle Flags an, Renderer skippt
// dann die optionalen Bloecke.
export function pickFeatureDensity(recipe: Recipe): FeatureRenderMode {
  const override = recipe.tweaks?.densityOverride;
  if (override) {
    return buildFeatureMode(override as FeatureDensityTier, recipe);
  }
  const tiers: FeatureDensityTier[] = [
    "spacious",
    "balanced",
    "compact",
    "ultra",
    "extreme",
  ];
  for (const tier of tiers) {
    const mode = buildFeatureMode(tier, recipe);
    const estimate = estimateFeatureContentHeight(
      recipe,
      FEATURE_DENSITY[tier],
      mode
    );
    if (estimate <= PAGE_USABLE_PT) {
      return mode;
    }
  }
  return buildFeatureMode("extreme", recipe);
}
