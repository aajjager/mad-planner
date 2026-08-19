import type { Recipe } from './recipes'

export type MealType = 'breakfast' | 'lunch' | 'dinner'
export interface MealPlanEntry { id: number; meal_date: string; meal_type: MealType; servings: string | null; notes: string | null; recipe: Pick<Recipe, 'id' | 'name' | 'image_url'> }
export interface WeeklyMealPlan { week_start: string; week_end: string; entries: MealPlanEntry[] }

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options)
  if (!response.ok) throw new Error('The meal plan could not be updated.')
  return response.status === 204 ? (undefined as T) : response.json()
}

export const getMealPlanWeek = (weekStart: string) => request<WeeklyMealPlan>(`/api/v1/meal-plans/week?week_start=${weekStart}`)
export const assignMeal = (mealDate: string, mealType: MealType, recipeId: number) => request<MealPlanEntry>(`/api/v1/meal-plans/${mealDate}/${mealType}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipe_id: recipeId }) })
export const removeMeal = (mealDate: string, mealType: MealType) => request<void>(`/api/v1/meal-plans/${mealDate}/${mealType}`, { method: 'DELETE' })
