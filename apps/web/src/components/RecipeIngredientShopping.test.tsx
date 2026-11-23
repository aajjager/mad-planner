import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { RecipeIngredientShopping } from './RecipeIngredientShopping'
import { addRecipeIngredients } from '../api/grocery'
import type { Recipe } from '../api/recipes'
const state = vi.hoisted(() => ({ role: 'owner' }))
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ account: { role: state.role, locale: 'en' } }) }))
vi.mock('../api/grocery', () => ({ addRecipeIngredients: vi.fn() }))
const recipe = { id: 7, ingredients: [{ id: 1, raw_text: '2 tomatoes' }, { id: 2, raw_text: '100 g rice' }] } as Recipe
beforeEach(() => { state.role = 'owner'; vi.mocked(addRecipeIngredients).mockResolvedValue([{ id: 1 }] as never) })
afterEach(() => { cleanup(); vi.clearAllMocks() })
const show = () => render(<MemoryRouter><RecipeIngredientShopping recipe={recipe} /></MemoryRouter>)
it('adds an individual ingredient to the chosen week', async () => {
  show()
  fireEvent.change(screen.getByLabelText('Shopping list week'), { target: { value: '2026-12-07' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add to shopping list 2 tomatoes' }))
  await screen.findByRole('status')
  expect(addRecipeIngredients).toHaveBeenCalledWith('2026-12-07', 7, [1])
  expect(screen.getByRole('link', { name: 'Grocery list' })).toHaveAttribute('href', '/grocery-list?week=2026-12-07')
})
it('keeps a multiple selection after failure and clears it after a successful retry', async () => {
  vi.mocked(addRecipeIngredients).mockRejectedValueOnce(new Error('offline'))
  show()
  fireEvent.click(screen.getByRole('button', { name: 'Select all ingredients' }))
  fireEvent.click(screen.getByRole('button', { name: 'Add selected ingredients (2)' }))
  await screen.findByRole('alert')
  expect(screen.getByRole('checkbox', { name: 'Select 2 tomatoes' })).toBeChecked()
  fireEvent.click(screen.getByRole('button', { name: 'Add selected ingredients (2)' }))
  await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Select 2 tomatoes' })).not.toBeChecked())
  expect(addRecipeIngredients).toHaveBeenLastCalledWith(expect.any(String), 7, [1, 2])
})
it('keeps viewer access read-only', () => {
  state.role = 'viewer'
  show()
  expect(screen.getByText('2 tomatoes')).toBeInTheDocument()
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})
