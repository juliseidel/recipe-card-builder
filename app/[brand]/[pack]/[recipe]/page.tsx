import { notFound } from "next/navigation";
import { getBrand } from "@/lib/brands";
import { getPack } from "@/lib/packs";
import { getCustomPackServer } from "@/lib/custom-packs-server";
import { getRecipe, getRecipesForPack } from "@/lib/recipes";
import { RecipeDetailLayout } from "@/components/recipe-detail-layout";
import { CustomRecipeView } from "@/components/custom-recipe-view";
import { StaticRecipeDeleteButton } from "@/components/static-recipe-delete-button";

type RecipePageProps = {
  params: Promise<{ brand: string; pack: string; recipe: string }>;
};

export async function generateMetadata({ params }: RecipePageProps) {
  const { brand: brandSlug, pack: packSlug, recipe: recipeSlug } = await params;
  const brand = getBrand(brandSlug);
  const pack =
    getPack(brandSlug, packSlug) ??
    (await getCustomPackServer(brandSlug, packSlug));
  const recipe = await getRecipe(packSlug, recipeSlug);

  if (!brand || !pack) {
    return { title: "Workspace nicht gefunden · Recipe Card Builder" };
  }

  if (!recipe) {
    return {
      title: `Eigene Karte · ${pack.title} · ${brand.name}`,
      description: `Eigene Rezeptkarte in ${pack.title}.`,
    };
  }

  return {
    title: `${recipe.title} · ${pack.title} · ${brand.name}`,
    description: `${recipe.description} ${recipe.nutrition.kcal} kcal · ${recipe.nutrition.protein}g Eiweiß.`,
  };
}

export default async function RecipePage({ params }: RecipePageProps) {
  const { brand: brandSlug, pack: packSlug, recipe: recipeSlug } = await params;
  const brand = getBrand(brandSlug);
  const pack =
    getPack(brandSlug, packSlug) ??
    (await getCustomPackServer(brandSlug, packSlug));

  if (!brand || !pack) {
    notFound();
  }

  const staticRecipes = await getRecipesForPack(pack.slug);
  const recipe = await getRecipe(packSlug, recipeSlug);

  // Static recipe → render directly with shared layout
  if (recipe) {
    const idx = staticRecipes.findIndex((r) => r.slug === recipe.slug);
    const previous =
      idx > 0
        ? {
            href: `/${brand.slug}/${pack.slug}/${staticRecipes[idx - 1].slug}`,
            title: staticRecipes[idx - 1].title,
          }
        : null;
    const next =
      idx < staticRecipes.length - 1
        ? {
            href: `/${brand.slug}/${pack.slug}/${staticRecipes[idx + 1].slug}`,
            title: staticRecipes[idx + 1].title,
          }
        : null;

    return (
      <RecipeDetailLayout
        brand={brand}
        pack={pack}
        recipe={recipe}
        totalRecipes={staticRecipes.length}
        previous={previous}
        next={next}
        deleteAction={
          <StaticRecipeDeleteButton
            brandSlug={brand.slug}
            packSlug={pack.slug}
            recipeSlug={recipe.slug}
            pack={pack}
          />
        }
      />
    );
  }

  // Custom recipe → client component reads LocalStorage
  return (
    <CustomRecipeView
      brand={brand}
      pack={pack}
      recipeSlug={recipeSlug}
      staticRecipes={staticRecipes}
    />
  );
}
