import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { PublicRecipesPage } from './PublicRecipesPage'
import { guideCopy } from '../components/welcomeGuideContent'
const state = vi.hoisted(() => ({ role: 'owner', hidden: false, always: false, fail: false }))
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ account: { role: state.role, locale: 'en' } }) }))
vi.mock('../api/recipes', () => ({
  listPublicRecipes: async () => state.hidden ? [] : [{ id: 5, name: 'Soup', owner_family_name: 'Neighbour', tags: [] }],
  getSharingPreferences: async () => ({ always_share: state.always, families: [{ id: 2, name: 'Neighbour', hidden: state.hidden }] }),
  setAlwaysShare: async (enabled: boolean) => { state.always = enabled },
  setHiddenFamily: async (_id: number, enabled: boolean) => { if (state.fail) throw Error('failed'); state.hidden = enabled },
  importPublicRecipe: vi.fn(),
}))
afterEach(() => { cleanup(); state.role = 'owner'; state.hidden = false; state.always = false; state.fail = false })
it('saves sharing and reversibly hides a family', async () => {
  render(<MemoryRouter><PublicRecipesPage /></MemoryRouter>)
  await screen.findByText('Soup')
  fireEvent.click(screen.getByText('Community recipe preferences'))
  fireEvent.click(screen.getByLabelText('Always share my family recipes with everyone'))
  await waitFor(() => expect(screen.getByLabelText('Always share my family recipes with everyone')).toBeChecked())
  fireEvent.click(screen.getByLabelText('Hide recipes from Neighbour'))
  await waitFor(() => expect(screen.queryByText('Soup')).not.toBeInTheDocument())
  fireEvent.click(screen.getByLabelText('Hide recipes from Neighbour'))
  expect(await screen.findByText('Soup')).toBeInTheDocument()
})
it('lets viewers filter and preserves the list after a failed save', async () => {
  state.role = 'viewer'; state.fail = true
  render(<MemoryRouter><PublicRecipesPage /></MemoryRouter>)
  await screen.findByText('Soup')
  fireEvent.click(screen.getByText('Community recipe preferences'))
  expect(screen.queryByLabelText('Always share my family recipes with everyone')).not.toBeInTheDocument()
  fireEvent.click(screen.getByLabelText('Hide recipes from Neighbour'))
  expect(await screen.findByText('The settings could not be saved.')).toBeInTheDocument()
  expect(screen.getByText('Soup')).toBeInTheDocument()
  expect(screen.getByLabelText('Hide recipes from Neighbour')).not.toBeChecked()
})
it.each(['en', 'da', 'nl'] as const)('documents personal hiding in %s', (locale) => {
  expect(guideCopy[locale].steps.find((step) => step[2] === '/recipes')![1]).toContain({ en: 'Each account can hide', da: 'Hver konto kan skjule', nl: 'Elk account kan gezinnen verbergen' }[locale])
})
