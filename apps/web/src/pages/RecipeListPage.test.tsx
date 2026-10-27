import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RecipeListPage } from './RecipeListPage'
import { guideCopy } from '../components/welcomeGuideContent'

vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ account: { role: 'viewer', locale: 'en' } }) }))
vi.mock('../api/recipes', () => ({ listRecipes: () => Promise.resolve([
  { id: 1, name: 'Apple soup', description: 'A warm soup.', tags: [], recipe_types: [], nutrition: null, total_time_minutes: 20 },
  { id: 2, name: 'Burger', description: 'A family favourite.', tags: [], recipe_types: [], nutrition: null, total_time_minutes: 30 },
]) }))

beforeEach(() => localStorage.clear())
afterEach(() => { cleanup(); vi.restoreAllMocks() })
const show = () => render(<MemoryRouter><RecipeListPage /></MemoryRouter>)

describe('recipe collection sizing', () => {
  it('remembers the chosen size without losing search or recipe links', async () => {
    const view = show()
    const slider = await screen.findByRole('slider', { name: 'Recipe card size' })
    expect(slider).toHaveAttribute('aria-valuetext', 'Comfortable')
    expect(view.container.querySelector('.recipe-collection--comfortable')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Apple' } })
    fireEvent.change(slider, { target: { value: '0' } })
    expect(view.container.querySelector('.recipe-collection--compact')).toBeInTheDocument()
    expect(slider).toHaveAttribute('aria-valuetext', 'Compact')
    expect(screen.queryByText('Burger')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Apple soup/ })).toHaveAttribute('href', '/recipes/1')
    expect(localStorage.getItem('madplanner.recipeCardSize')).toBe('0')
    view.unmount()
    const reopened = show()
    expect(await screen.findByRole('slider', { name: 'Recipe card size' })).toHaveValue('0')
    fireEvent.change(screen.getByRole('slider', { name: 'Recipe card size' }), { target: { value: '2' } })
    expect(reopened.container.querySelector('.recipe-collection--large')).toBeInTheDocument()
  })

  it('falls back safely for invalid saved settings and unavailable storage', async () => {
    localStorage.setItem('madplanner.recipeCardSize', '99')
    const view = show()
    expect(await screen.findByRole('slider', { name: 'Recipe card size' })).toHaveValue('1')
    view.unmount()
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    show()
    const slider = await screen.findByRole('slider', { name: 'Recipe card size' })
    fireEvent.change(slider, { target: { value: '2' } })
    expect(slider).toHaveAttribute('aria-valuetext', 'Large')
  })

  it.each(['en', 'da', 'nl'] as const)('explains collection sizing in the %s welcome guide', (locale) => {
    const tip = guideCopy[locale].steps.find((step) => step[2] === '/recipes')!
    expect(tip[1]).toContain({ en: 'Recipe card size', da: 'Opskriftskortets størrelse', nl: 'Grootte receptkaarten' }[locale])
  })
})
