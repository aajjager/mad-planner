import type { UnitInput } from './recipes'

export interface GroceryListItem { id: number; key: string; name: string; category: string; quantity: string | null; quantity_max: string | null; unit: UnitInput | null; recipe_names: string[]; raw_texts: string[]; origin: 'generated' | 'manual'; purchased_at: string | null }
export interface WeeklyGroceryList { week_start: string; week_end: string; planned_meals: number; items: GroceryListItem[]; history: GroceryListItem[] }

export async function getGroceryListWeek(weekStart: string): Promise<WeeklyGroceryList> {
  const response = await fetch(`/api/v1/grocery-lists/week?week_start=${weekStart}`)
  if (!response.ok) throw new Error('The grocery list could not be loaded.')
  return response.json()
}

export async function addManualGroceryItem(weekStart: string, rawText: string): Promise<GroceryListItem> {
  const response = await fetch(`/api/v1/grocery-lists/week/items?week_start=${weekStart}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ raw_text: rawText }) })
  if (!response.ok) throw new Error('The grocery item could not be added.')
  return response.json()
}

export async function setGroceryItemPurchased(id: number, purchased: boolean): Promise<GroceryListItem> {
  const response = await fetch(`/api/v1/grocery-lists/items/${id}/purchased`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ purchased }) })
  if (!response.ok) throw new Error('The grocery item could not be updated.')
  return response.json()
}
