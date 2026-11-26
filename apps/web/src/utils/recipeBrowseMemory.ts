import { createContext, useContext, useState } from 'react'

export interface RecipeBrowseFilters {
  filtersOpen?: boolean
  search: string; tag: string; cuisine: string; recipeType: string; sort: 'name' | 'rating'
  ratingLow: number; ratingHigh: number; includeUnrated: boolean
  calorieLow: number; calorieHigh: number | null; includeUnknownCalories: boolean
  hideOwn: boolean
}

export type RecipeCollectionScope = 'family' | 'public'

function createCollectionMemory() {
  let y = 0
  let filters: RecipeBrowseFilters | undefined
  return {
    position: () => y,
    filters: () => filters,
    rememberPosition: (value: number) => { y = value },
    rememberFilters: (value: RecipeBrowseFilters) => { filters = value },
  }
}

export function createRecipeBrowseMemory() {
  return { family: createCollectionMemory(), public: createCollectionMemory() }
}

export const RecipeBrowseContext = createContext<ReturnType<typeof createRecipeBrowseMemory> | null>(null)
export function useRecipeBrowseMemory(scope: RecipeCollectionScope) {
  const [fallback] = useState(createCollectionMemory)
  return useContext(RecipeBrowseContext)?.[scope] ?? fallback
}
