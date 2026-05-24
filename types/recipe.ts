import { z } from "zod";

export const NutritionSchema = z.object({
  kcal: z.number().min(0),
  protein: z.number().min(0),
  carbs: z.number().min(0),
  fat: z.number().min(0),
  fiber: z.number().min(0).optional(),
  sugar: z.number().min(0).optional(),
});

export const MicronutrientsSchema = z.object({
  vitaminC: z.number().min(0).optional(),
  iron: z.number().min(0).optional(),
  magnesium: z.number().min(0).optional(),
  calcium: z.number().min(0).optional(),
  vitaminD: z.number().min(0).optional(),
});

export const IngredientSchema = z.object({
  amount: z.string(),
  unit: z.string().optional(),
  name: z.string(),
  note: z.string().optional(),
  group: z.string().optional(),
});

export const RecipeStepSchema = z.object({
  index: z.number().int().min(1),
  text: z.string(),
});

export const RecipeSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  servings: z.number().int().min(1),
  prepMinutes: z.number().int().min(0),
  cookMinutes: z.number().int().min(0).optional(),
  totalMinutes: z.number().int().min(0).optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  tags: z.array(z.string()).default([]),
  highlights: z.array(z.string()).max(6).default([]),
  ingredients: z.array(IngredientSchema),
  steps: z.array(RecipeStepSchema),
  nutrition: NutritionSchema,
  micronutrients: MicronutrientsSchema.optional(),
  imagePrompt: z.string().optional(),
  imageUrl: z.string().url().optional(),
  notes: z.string().optional(),
  signature: z.string().optional(),
});

export const RecipePackSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  tagline: z.string(),
  description: z.string(),
  themeId: z.string(),
  creator: z.object({
    name: z.string(),
    handle: z.string(),
    signature: z.string(),
  }),
  coverImagePrompt: z.string().optional(),
  coverImageUrl: z.string().url().optional(),
  recipes: z.array(RecipeSchema),
});

export type Nutrition = z.infer<typeof NutritionSchema>;
export type Micronutrients = z.infer<typeof MicronutrientsSchema>;
export type Ingredient = z.infer<typeof IngredientSchema>;
export type RecipeStep = z.infer<typeof RecipeStepSchema>;
export type Recipe = z.infer<typeof RecipeSchema>;
export type RecipePack = z.infer<typeof RecipePackSchema>;

export const isLong = (recipe: Recipe) => recipe.ingredients.length >= 12;
export const isShort = (recipe: Recipe) => recipe.ingredients.length <= 4;
