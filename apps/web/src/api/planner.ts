import type { Recipe } from './recipes'

export type MealType = 'breakfast' | 'lunch' | 'dinner'
export interface MealPlanEntry { id: number; meal_date: string; meal_type: MealType; servings: string | null; notes: string | null; is_leftover: boolean; source_entry_id: number | null; recipe: Pick<Recipe, 'id' | 'name' | 'image_url'> }
export interface WeeklyMealPlan { week_start: string; week_end: string; entries: MealPlanEntry[] }
export interface MealSuggestion { meal_date: string; meal_type: MealType; recipe: Pick<Recipe, 'id' | 'name' | 'image_url'>; score: number; reasons: string[]; is_leftover: boolean; source_date: string | null }
export interface WeeklyMealSuggestions { week_start: string; week_end: string; suggestions: MealSuggestion[] }
export interface SuggestionPreferences { meal_types: MealType[]; preferred_tags: string[]; max_cooking_time_minutes?: number; include_leftover_lunches: boolean }

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options)
  if (!response.ok) throw new Error('The meal plan could not be updated.')
  return response.status === 204 ? (undefined as T) : response.json()
}

export const getMealPlanWeek = (weekStart: string) => request<WeeklyMealPlan>(`/api/v1/meal-plans/week?week_start=${weekStart}`)
export const assignMeal = (mealDate: string, mealType: MealType, recipeId: number) => request<MealPlanEntry>(`/api/v1/meal-plans/${mealDate}/${mealType}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipe_id: recipeId }) })
export const removeMeal = (mealDate: string, mealType: MealType) => request<void>(`/api/v1/meal-plans/${mealDate}/${mealType}`, { method: 'DELETE' })
export const planLeftovers = (mealDate: string, mealType: MealType) => request<MealPlanEntry>(`/api/v1/meal-plans/${mealDate}/${mealType}/leftovers`, { method: 'POST' })
export const suggestMealPlanWeek = (weekStart: string, preferences: SuggestionPreferences) => request<WeeklyMealSuggestions>(`/api/v1/meal-plans/week/suggestions?week_start=${weekStart}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(preferences) })
