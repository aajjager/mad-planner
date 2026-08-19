import type { UnitInput } from './recipes'

export interface GroceryListItem { key: string; name: string; category: string; quantity: string | null; quantity_max: string | null; unit: UnitInput | null; recipe_names: string[]; raw_texts: string[] }
export interface WeeklyGroceryList { week_start: string; week_end: string; planned_meals: number; items: GroceryListItem[] }

export async function getGroceryListWeek(weekStart: string): Promise<WeeklyGroceryList> {
  const response = await fetch(`/api/v1/grocery-lists/week?week_start=${weekStart}`)
  if (!response.ok) throw new Error('The grocery list could not be loaded.')
  return response.json()
}
