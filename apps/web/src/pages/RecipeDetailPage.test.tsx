import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { RecipeDetailPage } from './RecipeDetailPage'

vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ account: { role: 'owner', locale: 'en', show_nutrition: false } }) }))
vi.mock('../api/auth', () => ({ getFamilySettings: () => Promise.resolve({ cooking_mode_enabled: true }) }))
vi.mock('../api/recipes', () => ({ getRecipe: () => Promise.resolve({
  id: 1, name: 'Apple soup', owned_by_current_family: true, description: '', image_url: null,
  tags: [], recipe_types: [], meal_types: [], shared_with_families: [], is_public: false,
  ingredients: [], instructions: [{ id: 2, position: 1, text: 'Simmer until tender.' }],
  preparation_time_minutes: 10, cooking_time_minutes: 20, servings: 4,
}) }))
afterEach(cleanup)

it('puts cooking content first and reveals management options on demand', async () => {
  render(<MemoryRouter initialEntries={['/recipes/1']}><Routes><Route path="/recipes/:recipeId" element={<RecipeDetailPage />} /></Routes></MemoryRouter>)
  expect(await screen.findByRole('heading', { name: 'Apple soup' })).toBeInTheDocument()
  const instructions = screen.getByText('Simmer until tender.')
  const options = screen.getByText('Recipe options')
  expect(instructions.compareDocumentPosition(options) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Planning tags' })).not.toBeVisible()
  expect(screen.getByRole('link', { name: 'Edit recipe' })).toHaveAttribute('href', '/recipes/1/edit')
  fireEvent.click(options)
  expect(screen.getByRole('heading', { name: 'Planning tags' })).toBeVisible()
  expect(screen.getByRole('heading', { name: 'Family rating' })).toBeInTheDocument()
  fireEvent.click(options)
  expect(screen.getByRole('heading', { name: 'Planning tags' })).not.toBeVisible()
  expect(screen.getByText('Simmer until tender.')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Start cooking' }))
  expect(screen.getByRole('button', { name: 'Exit cooking mode' })).toBeInTheDocument()
})
