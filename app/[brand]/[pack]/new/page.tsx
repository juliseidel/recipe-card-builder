import { RecipeEditor } from "@/components/recipe-editor";

// Thin route wrapper — the heavy lifting lives in <RecipeEditor>, which the
// /[recipe]/edit page also uses with an `editing` prop. Keeping the route
// shells tiny means a future "duplicate recipe" or "fork from suggestion"
// flow can mount the same component with different initial state without
// another 2k-line file.
type NewRecipePageProps = {
  params: Promise<{ brand: string; pack: string }>;
};

export default async function NewRecipePage({ params }: NewRecipePageProps) {
  const { brand, pack } = await params;
  return <RecipeEditor brandSlug={brand} packSlug={pack} />;
}
