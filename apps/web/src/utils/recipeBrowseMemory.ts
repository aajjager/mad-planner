import { createContext, useContext, useState } from 'react'

export interface RecipeBrowseFilters {
  search: string; tag: string; cuisine: string; recipeType: string; sort: 'name' | 'rating'
  ratingLow: number; ratingHigh: number; includeUnrated: boolean
  calorieLow: number; calorieHigh: number | null; includeUnknownCalories: boolean
}

export function createRecipeBrowseMemory() {
  let y = 0
  let filters: RecipeBrowseFilters | undefined
  return {
    position: () => y,
    filters: () => filters,
    rememberPosition: (value: number) => { y = value },
    rememberFilters: (value: RecipeBrowseFilters) => { filters = value },
  }
}
export const RecipeBrowseContext = createContext<ReturnType<typeof createRecipeBrowseMemory> | null>(null)
export function useRecipeBrowseMemory() {
  const [fallback] = useState(createRecipeBrowseMemory)
  return useContext(RecipeBrowseContext) ?? fallback
}
