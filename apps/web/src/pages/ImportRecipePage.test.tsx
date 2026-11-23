import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { ImportRecipePage } from './ImportRecipePage'
import { createRecipe } from '../api/recipes'

vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ account: { locale: 'en' } }) }))
vi.mock('../api/auth', () => ({ listRecipeTypes: () => Promise.resolve([{ id: 1, name: 'Dinner', meal_type: 'dinner' }, { id: 2, name: 'Beverages', meal_type: null }]) }))
vi.mock('../api/recipes', () => ({
  previewRecipeImport: () => Promise.resolve({ name: 'Lemonade', ingredients: ['2 lemons'], instructions: ['Mix with water.'], suggested_recipe_types: [], warnings: [], source_url: 'https://example.com/lemonade', parser: 'jsonld' }),
  parseServingCount: () => undefined,
  createRecipe: vi.fn().mockResolvedValue({ id: 123 }),
}))
afterEach(() => { cleanup(); vi.clearAllMocks() })

it('lets a beverage be selected and saved without selecting a dinner type', async () => {
  render(<MemoryRouter><ImportRecipePage /></MemoryRouter>)
  fireEvent.change(screen.getByRole('textbox', { name: 'Recipe URL' }), { target: { value: 'https://example.com/lemonade' } })
  fireEvent.click(screen.getByRole('button', { name: 'Preview recipe' }))
  const beverage = await screen.findByRole('button', { name: 'Beverages' })
  fireEvent.click(beverage)
  expect(beverage).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Dinner' })).toHaveAttribute('aria-pressed', 'false')
  fireEvent.click(screen.getByRole('button', { name: 'Save imported recipe' }))
  await waitFor(() => expect(createRecipe).toHaveBeenCalledWith(expect.objectContaining({ name: 'Lemonade', recipe_types: ['Beverages'], meal_types: [] })))
})
