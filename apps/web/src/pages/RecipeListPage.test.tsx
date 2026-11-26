import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RecipeListPage } from './RecipeListPage'
import { guideCopy } from '../components/welcomeGuideContent'

const auth = vi.hoisted(() => ({ role: 'viewer' }))
const types = vi.hoisted(() => ({ list: vi.fn() }))
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ account: { role: auth.role, locale: 'en' } }) }))
vi.mock('../api/auth', () => ({ listRecipeTypes: types.list }))
vi.mock('../api/recipes', () => ({ listRecipes: () => Promise.resolve([
  { id: 1, owned_by_current_family: true, family_rating: 4, name: 'Apple soup', description: 'A warm soup.', tags: [], recipe_types: ['Lunch'], nutrition: null, total_time_minutes: 20 },
  { id: 2, owned_by_current_family: true, family_rating: 3, name: 'Burger', description: 'A family favourite.', tags: [], recipe_types: ['Dinner', 'Grill night'], nutrition: null, total_time_minutes: 30 },
]) }))

beforeEach(() => {
  localStorage.clear()
  auth.role = 'viewer'
  types.list.mockReset().mockResolvedValue([{ id: 1, name: 'Dinner' }, { id: 2, name: 'Beverages' }])
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })
const show = () => render(<MemoryRouter><RecipeListPage /></MemoryRouter>)

describe('recipe type shortcuts', () => {
  it('combines configured and in-use types and applies just one type filter', async () => {
    show()
    const row = within(await screen.findByRole('group', { name: 'Recipe type' }))
    expect(row.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
    expect(row.getAllByRole('button', { name: 'Dinner' })).toHaveLength(1)
    fireEvent.click(row.getByRole('button', { name: 'Dinner' }))
    expect(screen.getByRole('heading', { name: 'Burger' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Apple soup' })).not.toBeInTheDocument()
    expect(row.getByRole('button', { name: 'Dinner' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(row.getByRole('button', { name: 'Grill night' }))
    expect(screen.getByRole('heading', { name: 'Burger' })).toBeVisible()
    fireEvent.click(row.getByRole('button', { name: 'Beverages' }))
    expect(screen.getByRole('heading', { name: 'No matching recipes' })).toBeVisible()
    fireEvent.click(row.getByRole('button', { name: 'Lunch' }))
    expect(screen.getByRole('heading', { name: 'Apple soup' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Burger' })).not.toBeInTheDocument()
  })

  it('shares state with the filter panel and keeps search when choosing All', async () => {
    show()
    const row = within(await screen.findByRole('group', { name: 'Recipe type' }))
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }))
    const dropdown = screen.getByRole('combobox', { name: 'Recipe type' })
    fireEvent.change(dropdown, { target: { value: 'Dinner' } })
    expect(row.getByRole('button', { name: 'Dinner' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Apple' } })
    fireEvent.click(row.getByRole('button', { name: 'All' }))
    expect(dropdown).toHaveValue('')
    expect(screen.getByRole('searchbox')).toHaveValue('Apple')
    expect(screen.getByRole('heading', { name: 'Apple soup' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Burger' })).not.toBeInTheDocument()
  })

  it('keeps types already used by recipes available if family settings cannot load', async () => {
    types.list.mockRejectedValue(new Error('Could not load settings'))
    show()
    const row = within(await screen.findByRole('group', { name: 'Recipe type' }))
    fireEvent.click(row.getByRole('button', { name: 'Lunch' }))
    expect(screen.getByRole('heading', { name: 'Apple soup' })).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('recipe collection sizing', () => {
  it('keeps adding prominent and groups secondary collection actions', async () => {
    auth.role = 'owner'
    show()
    await screen.findByText('Apple soup')
    expect(screen.getByRole('link', { name: 'Add recipe' })).toHaveAttribute('href', '/recipes/add')
    const more = screen.getByLabelText('More recipe actions')
    const menu = more.closest('details')!
    expect(menu).not.toHaveAttribute('open')
    fireEvent.click(more)
    expect(menu).toHaveAttribute('open')
    expect(screen.getByRole('link', { name: 'Browse public recipes' })).toHaveAttribute('href', '/recipes/public')
    fireEvent.click(screen.getByRole('button', { name: 'Select recipes' }))
    expect(menu).not.toHaveAttribute('open')
    expect(screen.getByRole('button', { name: 'Select Apple soup' })).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(screen.getByRole('button', { name: 'Select Apple soup' }))
    expect(screen.getByRole('button', { name: 'Select Apple soup' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('keeps search available and preserves filters when the panel closes', async () => {
    show()
    const toggle = await screen.findByRole('button', { name: 'Filters' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('combobox', { name: 'Sort recipes' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Apple' } })
    fireEvent.click(toggle)
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort recipes' }), { target: { value: 'rating' } })
    fireEvent.click(toggle)
    expect(screen.getByRole('searchbox')).toHaveValue('Apple')
    expect(screen.queryByText('Burger')).not.toBeInTheDocument()
    fireEvent.click(toggle)
    expect(screen.getByRole('combobox', { name: 'Sort recipes' })).toHaveValue('rating')
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(screen.getByRole('searchbox')).toHaveValue('')
    expect(screen.getByText('Burger')).toBeInTheDocument()
  })

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
