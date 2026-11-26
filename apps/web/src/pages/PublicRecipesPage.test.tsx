import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { PublicRecipesPage } from './PublicRecipesPage'
import { guideCopy } from '../components/welcomeGuideContent'
const state = vi.hoisted(() => ({ role: 'owner', hidden: false, fail: false }))
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ account: { role: state.role, locale: 'en' } }) }))
vi.mock('../api/recipes', () => ({
  listPublicRecipes: async () => [
    { id: 6, name: 'Our bread', owner_family_name: 'Our family', owned_by_current_family: true, tags: [], recipe_types: ['Bread'], image_url: null },
    ...(!state.hidden ? [{ id: 5, name: 'Soup', owner_family_name: 'Neighbour', owned_by_current_family: false, tags: [], recipe_types: ['Lunch'], image_url: null }] : []),
  ],
  getSharingPreferences: async () => ({ families: [{ id: 2, name: 'Neighbour', hidden: state.hidden }] }),
  setHiddenFamily: async (_id: number, enabled: boolean) => { if (state.fail) throw Error('failed'); state.hidden = enabled },
  importPublicRecipe: vi.fn(),
}))
afterEach(() => { cleanup(); state.role = 'owner'; state.hidden = false; state.fail = false })
it('renders the food icon on public recipes without a photo', async () => {
  render(<MemoryRouter><PublicRecipesPage /></MemoryRouter>)
  const card = await screen.findByRole('link', { name: /Soup/ })
  expect(card.querySelector('.recipe-card__image > .app-icon')).toHaveAttribute('aria-hidden', 'true')
})
it('reversibly hides another family while retaining your own recipes', async () => {
  render(<MemoryRouter><PublicRecipesPage /></MemoryRouter>)
  await screen.findByText('Soup')
  fireEvent.click(screen.getByText('Community recipe preferences'))
  fireEvent.click(screen.getByLabelText('Hide recipes from Neighbour'))
  await waitFor(() => expect(screen.queryByText('Soup')).not.toBeInTheDocument())
  expect(screen.getByText('Our bread')).toBeVisible()
  fireEvent.click(screen.getByLabelText('Hide recipes from Neighbour'))
  expect(await screen.findByText('Soup')).toBeInTheDocument()
})
it('lets viewers filter and preserves the list after a failed save', async () => {
  state.role = 'viewer'; state.fail = true
  render(<MemoryRouter><PublicRecipesPage /></MemoryRouter>)
  await screen.findByText('Soup')
  fireEvent.click(screen.getByText('Community recipe preferences'))
  expect(screen.queryByRole('button', { name: 'Import to my family' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByLabelText('Hide recipes from Neighbour'))
  expect(await screen.findByText('The settings could not be saved.')).toBeInTheDocument()
  expect(screen.getByText('Soup')).toBeInTheDocument()
  expect(screen.getByLabelText('Hide recipes from Neighbour')).not.toBeChecked()
})
it('searches public recipes by type and family and offers imports for other families only', async () => {
  render(<MemoryRouter><PublicRecipesPage /></MemoryRouter>)
  await screen.findByText('Soup')
  const ownCard = screen.getByRole('heading', { name: 'Our bread' }).closest('article')!
  expect(within(ownCard).queryByRole('button', { name: 'Import to my family' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Import to my family' })).toBeVisible()
  const search = screen.getByRole('searchbox')
  fireEvent.change(search, { target: { value: ' Lunch ' } })
  expect(screen.getByText('Soup')).toBeVisible()
  expect(screen.queryByText('Our bread')).not.toBeInTheDocument()
  fireEvent.change(search, { target: { value: 'Our family' } })
  expect(screen.getByText('Our bread')).toBeVisible()
  expect(screen.queryByText('Soup')).not.toBeInTheDocument()
})
it.each(['en', 'da', 'nl'] as const)('documents personal hiding in %s', (locale) => {
  expect(guideCopy[locale].steps.find((step) => step[2] === '/recipes')![1]).toContain({ en: 'Each account can hide', da: 'Hver konto kan skjule', nl: 'Elk account kan gezinnen verbergen' }[locale])
})
