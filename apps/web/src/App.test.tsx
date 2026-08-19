import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { parseServingCount } from './api/recipes'

const jsonResponse = (value: unknown) => new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } })

describe('App', () => {
  afterEach(() => { vi.restoreAllMocks(); window.history.pushState({}, '', '/') })

  it('shows the empty recipe collection and API status', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => Promise.resolve(String(input).includes('/health') ? jsonResponse({ status: 'ok' }) : jsonResponse([])))
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Your recipes' })).toBeInTheDocument()
    expect(await screen.findByText('Your collection is ready')).toBeInTheDocument()
    expect(await screen.findByText('API online')).toBeInTheDocument()
  })

  it('renders recipes returned by the API', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => Promise.resolve(String(input).includes('/health') ? jsonResponse({ status: 'ok' }) : jsonResponse([{ id: 4, name: 'Onion soup', description: 'A warming soup.', image_url: null, source_url: null, author: null, servings: '4', preparation_time_minutes: 10, cooking_time_minutes: 30, total_time_minutes: 40, cuisine: 'French', category: 'Dinner', ingredients: [], instructions: [], created_at: '', updated_at: '' }])))
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Onion soup' })).toBeInTheDocument()
    expect(screen.getByText('40 min')).toBeInTheDocument()
  })

  it('shows the manual recipe form', async () => {
    window.history.pushState({}, '', '/recipes/new')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ status: 'ok' }))
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Add a recipe' })).toBeInTheDocument()
    expect(screen.getByLabelText('Name *')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save recipe' })).toBeInTheDocument()
  })
})

describe('import normalization', () => {
  it('extracts numeric servings from localized recipe text', () => {
    expect(parseServingCount('4 personer')).toBe('4')
    expect(parseServingCount('2,5 portioner')).toBe('2.5')
    expect(parseServingCount(null)).toBeUndefined()
  })
})
