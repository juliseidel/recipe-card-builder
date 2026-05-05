"use client";

import type { Recipe } from "./recipes";

export type CustomRecipe = Recipe & {
  id: string;
  isCustom: true;
  createdAt: number;
};

const STORAGE_KEY = "rcb:custom-recipes:v1";

function isBrowser() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function getAllCustomRecipes(): CustomRecipe[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CustomRecipe[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function getCustomRecipesForPack(packSlug: string): CustomRecipe[] {
  return getAllCustomRecipes()
    .filter((r) => r.packSlug === packSlug)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function getCustomRecipe(
  packSlug: string,
  recipeSlug: string
): CustomRecipe | undefined {
  return getAllCustomRecipes().find(
    (r) => r.packSlug === packSlug && r.slug === recipeSlug
  );
}

export function addCustomRecipe(
  recipe: Omit<CustomRecipe, "id" | "isCustom" | "createdAt">
): CustomRecipe {
  const id = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const stored: CustomRecipe = {
    ...recipe,
    id,
    isCustom: true,
    createdAt: Date.now(),
  };
  const all = getAllCustomRecipes();
  all.push(stored);
  if (isBrowser()) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }
  return stored;
}

export function removeCustomRecipe(id: string): void {
  if (!isBrowser()) return;
  const all = getAllCustomRecipes().filter((r) => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}
