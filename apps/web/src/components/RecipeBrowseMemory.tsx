import { useState, type ReactNode } from 'react'
import { createRecipeBrowseMemory, RecipeBrowseContext } from '../utils/recipeBrowseMemory'

// Scoped to the signed-in account; never persisted with family recipe data.
export function RecipeBrowseMemory({ children }: { children: ReactNode }) {
  const [memory] = useState(createRecipeBrowseMemory)
  return <RecipeBrowseContext.Provider value={memory}>{children}</RecipeBrowseContext.Provider>
}
