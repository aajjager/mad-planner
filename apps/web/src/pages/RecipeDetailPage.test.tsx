import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { guideCopy } from '../components/welcomeGuideContent'
import { RecipeDetailPage } from './RecipeDetailPage'

const auth = vi.hoisted(() => ({ role: 'owner' }))
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ account: { role: auth.role, locale: 'en', show_nutrition: false } }) }))

afterEach(() => { cleanup(); vi.restoreAllMocks(); auth.role = 'owner' })

function openRecipe({ own = true, failSaving = false, cooking = false, privateRecipe = false } = {}) {
  const recipe = { id: 1, name: 'Lemon cordial', owned_by_current_family: own, tags: ['Lemon'], meal_types: ['lunch'],
    recipe_types: ['Dinner'], ingredients: [], instructions: [{ id: 2, position: 1, text: 'Simmer until tender.' }],
    preparation_time_minutes: null, cooking_time_minutes: null, is_public: !privateRecipe }
  const requests = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input)
    if (url.endsWith('/recipes/1/visibility') && init?.method === 'PUT') {
      if (failSaving) return Response.json({ detail: 'Could not save' }, { status: 422 })
      recipe.is_public = JSON.parse(String(init.body)).is_public
      return Response.json(recipe)
    }
    if (url.endsWith('/recipes/1/recipe-types') && init?.method === 'PATCH') {
      if (failSaving) return Response.json({ detail: 'Could not save' }, { status: 422 })
      recipe.recipe_types = JSON.parse(String(init.body)).recipe_types
      return Response.json(recipe)
    }
    if (url.endsWith('/family/recipe-types')) return Response.json([{ id: 1, name: 'Dinner' }, { id: 2, name: 'Beverages' }, { id: 3, name: 'Bread' }])
    if (url.endsWith('/family/settings')) return Response.json({ cooking_mode_enabled: cooking })
    if (url.endsWith('/recipes/1')) return Response.json(recipe)
    throw Error('Unexpected request ' + url)
  })
  render(<MemoryRouter initialEntries={['/recipes/1']}><Routes><Route path="/recipes/:recipeId" element={<RecipeDetailPage />} /></Routes></MemoryRouter>)
  return requests
}

it('puts cooking content first and reveals management options on demand', async () => {
  openRecipe({ cooking: true })
  expect(await screen.findByRole('heading', { name: 'Lemon cordial' })).toBeInTheDocument()
  const instructions = screen.getByText('Simmer until tender.')
  const options = screen.getByText('Recipe options')
  expect(instructions.compareDocumentPosition(options) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Planning tags' })).not.toBeVisible()
  expect(screen.getByRole('link', { name: 'Edit recipe' })).toHaveAttribute('href', '/recipes/1/edit')
  fireEvent.click(options)
  expect(await screen.findByRole('group', { name: 'Recipe types' })).toBeVisible()
  expect(screen.getByRole('heading', { name: 'Planning tags' })).toBeVisible()
  expect(screen.getByRole('heading', { name: 'Family rating' })).toBeInTheDocument()
  fireEvent.click(options)
  expect(screen.getByRole('heading', { name: 'Planning tags' })).not.toBeVisible()
  expect(screen.getByText('Simmer until tender.')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Start cooking' }))
  expect(screen.getByRole('button', { name: 'Exit cooking mode' })).toBeInTheDocument()
})

it('adds and removes recipe types in Recipe options with one tap per change', async () => {
  const requests = openRecipe()
  fireEvent.click(await screen.findByText('Recipe options'))
  const choices = within(await screen.findByRole('group', { name: 'Recipe types' }))
  const drinks = choices.getByRole('button', { name: 'Beverages' })
  expect(drinks).toHaveAttribute('aria-pressed', 'false')
  fireEvent.click(drinks)
  await waitFor(() => expect(drinks).toHaveAttribute('aria-pressed', 'true'))
  expect(requests.mock.calls.find(([url]) => String(url).endsWith('/recipes/1/recipe-types'))?.[1]).toMatchObject({ method: 'PATCH', body: '{"recipe_types":["Dinner","Beverages"]}' })
  expect(within(screen.getByLabelText('Recipe types', { selector: '.tag-list' })).getByText('Beverages')).toBeVisible()
  const dinner = choices.getByRole('button', { name: 'Dinner' })
  fireEvent.click(dinner)
  await waitFor(() => expect(dinner).toHaveAttribute('aria-pressed', 'false'))
  expect(choices.getByRole('button', { name: 'Beverages' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Remove Lemon' })).toBeVisible()
})

it('shows a save error and keeps the last saved selection', async () => {
  openRecipe({ failSaving: true })
  fireEvent.click(await screen.findByText('Recipe options'))
  const bread = await screen.findByRole('button', { name: 'Bread' })
  fireEvent.click(bread)
  expect(await screen.findByRole('alert')).toHaveTextContent('Recipe types could not be saved')
  expect(bread).toHaveAttribute('aria-pressed', 'false')
  expect(bread).toBeEnabled()
})

it('saves the private opt-out and can share the recipe again', async () => {
  const requests = openRecipe()
  fireEvent.click(await screen.findByText('Recipe options'))
  const privacy = screen.getByRole('checkbox', { name: /Keep this recipe private/ })
  expect(privacy).not.toBeChecked()
  fireEvent.click(privacy)
  await waitFor(() => expect(privacy).toBeChecked())
  fireEvent.click(privacy)
  await waitFor(() => expect(privacy).not.toBeChecked())
  const writes = requests.mock.calls.filter(([path]) => String(path).endsWith('/visibility'))
  expect(writes.map(([, init]) => JSON.parse(String(init?.body)))).toEqual([{ is_public: false }, { is_public: true }])
  expect(screen.queryByText('Share recipe')).not.toBeInTheDocument()
})

it('keeps the recipe private if sharing fails', async () => {
  openRecipe({ privateRecipe: true, failSaving: true })
  fireEvent.click(await screen.findByText('Recipe options'))
  const privacy = screen.getByRole('checkbox', { name: /Keep this recipe private/ })
  expect(privacy).toBeChecked()
  fireEvent.click(privacy)
  expect(await screen.findByRole('alert')).toHaveTextContent('Recipe privacy could not be saved')
  expect(privacy).toBeChecked()
})

it.each([['viewer', true], ['editor', false]])('keeps type editing unavailable for a %s with ownership %s', async (role, own) => {
  auth.role = role
  const requests = openRecipe({ own })
  fireEvent.click(await screen.findByText('Recipe options'))
  expect(screen.queryByRole('group', { name: 'Recipe types' })).not.toBeInTheDocument()
  expect(screen.queryByRole('checkbox', { name: /Keep this recipe private/ })).not.toBeInTheDocument()
  expect(requests.mock.calls.some(([url]) => String(url).endsWith('/family/recipe-types'))).toBe(false)
})

it.each(['en', 'da', 'nl'] as const)('mentions quick recipe type editing in the %s guide', (locale) => {
  const tip = guideCopy[locale].steps.find((step) => step[2] === '/recipes')?.[1]
  expect(tip).toContain({ en: 'change recipe types from Recipe options', da: 'ændre opskriftstyper under Opskriftsindstillinger', nl: 'wijzigen via Receptopties' }[locale])
})
