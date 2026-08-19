import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { parseServingCount } from './api/recipes'

const jsonResponse = (value: unknown) => new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } })

describe('App', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); window.history.pushState({}, '', '/') })

  it('shows the empty recipe collection and API status', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => Promise.resolve(String(input).includes('/health') ? jsonResponse({ status: 'ok' }) : jsonResponse([])))
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Your recipes' })).toBeInTheDocument()
    expect(await screen.findByText('Your collection is ready')).toBeInTheDocument()
    expect(await screen.findByText('API online')).toBeInTheDocument()
  })

  it('renders recipes returned by the API', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => Promise.resolve(String(input).includes('/health') ? jsonResponse({ status: 'ok' }) : jsonResponse([{ id: 4, name: 'Onion soup', description: 'A warming soup.', image_url: null, source_url: null, author: null, servings: '4', preparation_time_minutes: 10, cooking_time_minutes: 30, total_time_minutes: 40, cuisine: 'French', category: 'Dinner', tags: ['Comfort food'], ingredients: [], instructions: [], created_at: '', updated_at: '' }])))
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Onion soup' })).toBeInTheDocument()
    expect(screen.getByText('40 min')).toBeInTheDocument()
  })

  it('filters the recipe library by search text', async () => {
    const recipes = [
      { id: 1, name: 'Onion soup', description: 'Warm', image_url: null, source_url: null, author: null, servings: '4', preparation_time_minutes: null, cooking_time_minutes: null, total_time_minutes: 40, cuisine: 'French', category: 'Dinner', tags: ['Comfort food'], ingredients: [], instructions: [], created_at: '', updated_at: '' },
      { id: 2, name: 'Berry bowl', description: 'Fresh', image_url: null, source_url: null, author: null, servings: '2', preparation_time_minutes: null, cooking_time_minutes: null, total_time_minutes: 5, cuisine: null, category: 'Breakfast', tags: ['Quick'], ingredients: [], instructions: [], created_at: '', updated_at: '' },
    ]
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => Promise.resolve(String(input).includes('/health') ? jsonResponse({ status: 'ok' }) : jsonResponse(recipes)))
    render(<App />)
    await screen.findByRole('heading', { name: 'Onion soup' })

    fireEvent.change(screen.getByLabelText('Search recipes'), { target: { value: 'berry' } })

    expect(screen.queryByRole('heading', { name: 'Onion soup' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Berry bowl' })).toBeInTheDocument()
    expect(screen.getByText('1 recipe')).toBeInTheDocument()
  })

  it('shows the manual recipe form', async () => {
    window.history.pushState({}, '', '/recipes/new')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ status: 'ok' }))
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Add a recipe' })).toBeInTheDocument()
    expect(screen.getByLabelText('Name *')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save recipe' })).toBeInTheDocument()
  })

  it('shows seven days of meal planning slots', async () => {
    window.history.pushState({}, '', '/planner')
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input)
      if (url.includes('/health')) return Promise.resolve(jsonResponse({ status: 'ok' }))
      if (url.includes('/meal-plans/week')) return Promise.resolve(jsonResponse({ week_start: '2026-08-17', week_end: '2026-08-23', entries: [] }))
      return Promise.resolve(jsonResponse([{ id: 1, name: 'Pasta', image_url: null, tags: [], ingredients: [], instructions: [] }]))
    })
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Plan your week' })).toBeInTheDocument()
    expect(screen.getByLabelText('Monday dinner')).toBeInTheDocument()
    expect(screen.getByLabelText('Sunday breakfast')).toBeInTheDocument()
    expect(screen.getAllByRole('combobox')).toHaveLength(22)
    expect(screen.getByRole('button', { name: 'Suggest my week' })).toBeInTheDocument()
  })

  it('shows a generated weekly grocery checklist', async () => {
    window.history.pushState({}, '', '/grocery-list?week=2026-08-17')
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => Promise.resolve(String(input).includes('/health') ? jsonResponse({ status: 'ok' }) : jsonResponse({ week_start: '2026-08-17', week_end: '2026-08-23', planned_meals: 2, items: [{ key: '1:1', name: 'pasta', category: 'Other', quantity: '600', quantity_max: null, unit: { name: 'gram', symbol: 'g', dimension: 'mass' }, recipe_names: ['Simple pasta'], raw_texts: ['200 g pasta'] }] })))
    render(<App />)

    expect(await screen.findByRole('heading', { name: /Shop once/ })).toBeInTheDocument()
    expect(screen.getByText('600 g')).toBeInTheDocument()
    expect(screen.getByText('pasta')).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toBeInTheDocument()
  })
})

describe('import normalization', () => {
  it('extracts numeric servings from localized recipe text', () => {
    expect(parseServingCount('4 personer')).toBe('4')
    expect(parseServingCount('2,5 portioner')).toBe('2.5')
    expect(parseServingCount(null)).toBeUndefined()
  })
})
