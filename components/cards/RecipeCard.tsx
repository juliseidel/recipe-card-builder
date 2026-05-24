"use client";

import type { Recipe } from "@/types/recipe";
import { getTheme } from "@/lib/themes";
import { EditorialCookbook } from "./EditorialCookbook";
import { SwissEditorial } from "./SwissEditorial";
import { PatisserieRomantic } from "./PatisserieRomantic";
import { RusticSpread } from "./RusticSpread";
import { ModernPlanner } from "./ModernPlanner";

export function RecipeCard({
  recipe,
  themeId,
}: {
  recipe: Recipe;
  themeId: string;
}) {
  const theme = getTheme(themeId);

  switch (theme.layout) {
    case "editorial-cookbook":
      return <EditorialCookbook recipe={recipe} theme={theme} />;
    case "swiss-editorial":
      return <SwissEditorial recipe={recipe} theme={theme} />;
    case "patisserie-romantic":
      return <PatisserieRomantic recipe={recipe} theme={theme} />;
    case "rustic-spread":
      return <RusticSpread recipe={recipe} theme={theme} />;
    case "modern-planner":
      return <ModernPlanner recipe={recipe} theme={theme} />;
  }
}
