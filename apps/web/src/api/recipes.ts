export type UnitDimension = 'mass' | 'volume' | 'count'
export type RecipeMealType = 'breakfast' | 'lunch' | 'dinner'
export interface UnitInput { name: string; symbol: string; dimension: UnitDimension }
export interface RecipeIngredientInput { raw_text: string; ingredient_name?: string; quantity?: string; unit?: UnitInput }
export interface RecipeWrite {
  name: string; description?: string; image_url?: string; source_url?: string; author?: string; servings?: string;
  preparation_time_minutes?: number; cooking_time_minutes?: number; total_time_minutes?: number;
  cuisine?: string; category?: string; nutrition?: Record<string, unknown>; tags?: string[]; meal_types?: RecipeMealType[]; recipe_types?: string[]; ingredients: RecipeIngredientInput[]; instructions: { text: string }[]
}
export interface RecipeIngredient { id: number; position: number; raw_text: string; ingredient_name: string | null; quantity: string | null; unit: UnitInput | null }
export interface RecipeInstruction { id: number; position: number; text: string }
export interface Recipe {
  id: number; name: string; description: string | null; source_url: string | null; author: string | null; servings: string | null;
  preparation_time_minutes: number | null; cooking_time_minutes: number | null; total_time_minutes: number | null;
  cuisine: string | null; category: string | null; image_url: string | null;
  nutrition: Record<string, unknown> | null;
  tags: string[];
  meal_types: RecipeMealType[];
  recipe_types: string[];
  family_rating: number | null;
  rating_count: number;
  my_rating: number | null;
  ingredients: RecipeIngredient[]; instructions: RecipeInstruction[]; created_at: string; updated_at: string
}
export interface ImportedRecipePreview { name: string; description: string | null; image_url: string | null; source_url: string; author: string | null; servings: string | null; preparation_time_minutes: number | null; cooking_time_minutes: number | null; total_time_minutes: number | null; cuisine: string | null; category: string | null; nutrition: Record<string, unknown> | null; ingredients: string[]; instructions: string[]; parser: string; warnings: string[]; suggested_recipe_types: string[]; recipe_type_confidence: 'low' | 'medium' | 'high' }
export interface RecipeScanPreview { name: string; ingredients: string[]; instructions: string[]; raw_text: string; warnings: string[] }

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options)
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    const detail = payload?.detail
    if (typeof detail === 'string') throw new Error(detail)
    if (Array.isArray(detail) && typeof detail[0]?.msg === 'string') {
      const field = Array.isArray(detail[0].loc) ? detail[0].loc.at(-1) : null
      throw new Error(`${field ? `${field}: ` : ''}${detail[0].msg}`)
    }
    throw new Error('The request could not be completed.')
  }
  return response.status === 204 ? (undefined as T) : response.json()
}
export const listRecipes = () => request<Recipe[]>('/api/v1/recipes')
export const getRecipe = (id: number) => request<Recipe>(`/api/v1/recipes/${id}`)
export const createRecipe = (recipe: RecipeWrite) => request<Recipe>('/api/v1/recipes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(recipe) })
export const deleteRecipe = (id: number) => request<void>(`/api/v1/recipes/${id}`, { method: 'DELETE' })
export const updateRecipeMealTypes = (id: number, mealTypes: RecipeMealType[]) => request<Recipe>(`/api/v1/recipes/${id}/meal-types`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ meal_types: mealTypes }) })
export const updateRecipeTags = (id: number, tags: string[]) => request<Recipe>(`/api/v1/recipes/${id}/tags`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tags }) })
export const updateRecipeRating = (id: number, rating: number | null) => request<Recipe>(`/api/v1/recipes/${id}/rating`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rating }) })
export const uploadRecipeImage = (id: number, file: File) => request<Recipe>(`/api/v1/recipes/${id}/image`, { method: 'POST', headers: { 'Content-Type': file.type }, body: file })
export const previewRecipeImport = (url: string) => request<ImportedRecipePreview>('/api/v1/recipe-imports/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) })
export const scanRecipeImage = (file: File) => request<RecipeScanPreview>('/api/v1/recipe-scans/preview', { method: 'POST', headers: { 'Content-Type': file.type }, body: file })

export function parseServingCount(value: string | null): string | undefined {
  if (!value) return undefined
  const match = value.match(/\d+(?:[.,]\d+)?/)
  return match?.[0].replace(',', '.')
}

export function inferMealTypes(category: string | null): RecipeMealType[] {
  const value = (category || '').toLocaleLowerCase()
  const result: RecipeMealType[] = []
  if (/breakfast|morgenmad|brunch/.test(value)) result.push('breakfast')
  if (/lunch|frokost/.test(value)) result.push('lunch')
  if (/dinner|aftensmad|hovedret/.test(value)) result.push('dinner')
  return result
}
