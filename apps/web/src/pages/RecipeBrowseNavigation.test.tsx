import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, Link, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { RecipeBrowseMemory } from '../components/RecipeBrowseMemory'
import { RecipeListPage } from './RecipeListPage'

const data = vi.hoisted(() => ({ pending: false, resolve: (_items: unknown[]) => {} }))
const recipes = [{ id: 1, owned_by_current_family: true, family_rating: 4, rating_count: 1, name: 'Apple soup', tags: [], recipe_types: [], nutrition: null, description: '', total_time_minutes: 20 }]
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ account: { id: 1, family_id: 1, role: 'viewer', locale: 'en' } }) }))
vi.mock('../api/recipes', () => ({ listRecipes: () => data.pending ? new Promise((resolve) => { data.resolve = resolve }) : Promise.resolve(recipes) }))

function Detail() {
  const navigate = useNavigate()
  return <><h1>Recipe detail</h1><Link to="/recipes">All recipes</Link><button onClick={() => navigate(-1)}>Browser back</button></>
}
beforeEach(() => {
  data.pending = false
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  vi.spyOn(window, 'scrollY', 'get').mockReturnValue(0)
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

it.each(['All recipes', 'Browser back'])('restores browsing after async loading using %s', async (back) => {
  render(<MemoryRouter initialEntries={['/recipes']}><RecipeBrowseMemory><Routes>
    <Route path="/recipes" element={<RecipeListPage />} />
    <Route path="/recipes/:id" element={<Detail />} />
  </Routes></RecipeBrowseMemory></MemoryRouter>)
  await screen.findByRole('link', { name: /Apple soup/ })
  await waitFor(() => expect(window.scrollTo).toHaveBeenCalled())
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Apple' } })
  fireEvent.change(screen.getByLabelText('Sort recipes'), { target: { value: 'rating' } })
  vi.spyOn(window, 'scrollY', 'get').mockReturnValue(1800)
  fireEvent.scroll(window)
  fireEvent.click(screen.getByRole('link', { name: /Apple soup/ }))
  await screen.findByRole('heading', { name: 'Recipe detail' })
  data.pending = true
  vi.mocked(window.scrollTo).mockClear()
  vi.spyOn(window, 'scrollY', 'get').mockReturnValue(0)
  fireEvent.click(screen.getByRole(back === 'Browser back' ? 'button' : 'link', { name: back }))
  await screen.findByText('Loading recipes…')
  expect(window.scrollTo).not.toHaveBeenCalled()
  data.resolve(recipes)
  await screen.findByRole('link', { name: /Apple soup/ })
  await waitFor(() => expect(window.scrollTo).toHaveBeenCalledWith({ top: 1800, left: 0, behavior: 'instant' }))
  expect(screen.getByRole('searchbox')).toHaveValue('Apple')
  expect(screen.getByLabelText('Sort recipes')).toHaveValue('rating')
})
