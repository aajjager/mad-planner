import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { inferMealTypes, parseServingCount } from './api/recipes'

const jsonResponse = (value: unknown) => new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } })
const account = { id: 1, email: 'owner@example.com', display_name: 'Owner', family_id: 1, family_name: 'Test family', role: 'owner' }
const authResponse = (input: RequestInfo | URL) => {
  const url = String(input)
  if (url.includes('/auth/status')) return jsonResponse({ setup_required: false })
  if (url.includes('/auth/me')) return jsonResponse(account)
  return null
}

describe('App', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); window.history.pushState({}, '', '/') })

  it('shows first-owner setup when no account exists', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input)
      if (url.includes('/auth/status')) return Promise.resolve(jsonResponse({ setup_required: true }))
      if (url.includes('/auth/setup')) return Promise.resolve(jsonResponse(account))
      return Promise.resolve(jsonResponse([]))
    })
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Create your family.' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Owner' } })
    fireEvent.change(screen.getByLabelText('Family name'), { target: { value: 'Test family' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'test-password-123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create family' }))

    expect(await screen.findByRole('heading', { name: 'Your recipes' })).toBeInTheDocument()
  })

  it('shows login when the browser has no active session', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input)
      if (url.includes('/auth/status')) return Promise.resolve(jsonResponse({ setup_required: false }))
      if (url.includes('/auth/me')) return Promise.resolve(new Response(JSON.stringify({ detail: 'Authentication required' }), { status: 401, headers: { 'Content-Type': 'application/json' } }))
      if (url.includes('/auth/login')) return Promise.resolve(jsonResponse(account))
      return Promise.resolve(jsonResponse([]))
    })
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Welcome back.' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'test-password-123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('heading', { name: 'Your recipes' })).toBeInTheDocument()
  })

  it('lets the owner create a family invitation link', async () => {
    window.history.pushState({}, '', '/family')
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input)
      const auth = authResponse(input)
      if (auth) return Promise.resolve(auth)
      if (url.includes('/family/members')) return Promise.resolve(jsonResponse([{ id: 1, email: 'owner@example.com', display_name: 'Owner', role: 'owner' }]))
      if (url.includes('/family/invitations')) return Promise.resolve(jsonResponse({ token: 'private-token', family_name: 'Test family', intended_email: 'member@example.com', expires_at: '' }))
      return Promise.resolve(jsonResponse([]))
    })
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Test family' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'member@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create invitation' }))

    expect(await screen.findByLabelText('Invitation link')).toHaveValue('http://localhost:3000/invite/private-token')
  })

  it('lets an invited person join the shared family', async () => {
    window.history.pushState({}, '', '/invite/private-token')
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input)
      if (url.includes('/auth/status')) return Promise.resolve(jsonResponse({ setup_required: false }))
      if (url.includes('/auth/me')) return Promise.resolve(new Response(JSON.stringify({ detail: 'Authentication required' }), { status: 401, headers: { 'Content-Type': 'application/json' } }))
      if (url.endsWith('/invitations/private-token')) return Promise.resolve(jsonResponse({ family_name: 'Test family', intended_email: 'member@example.com', expires_at: '' }))
      if (url.includes('/accept')) return Promise.resolve(jsonResponse({ ...account, id: 2, email: 'member@example.com', display_name: 'Member', role: 'member' }))
      return Promise.resolve(jsonResponse([]))
    })
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Join Test family.' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Member' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'member-password-123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Join family' }))

    expect(await screen.findByRole('heading', { name: 'Your recipes' })).toBeInTheDocument()
  })

  it('shows owner controls for family logins and invitations', async () => {
    window.history.pushState({}, '', '/admin')
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input)
      const auth = authResponse(input)
      if (auth) return Promise.resolve(auth)
      if (url.includes('/family/members')) return Promise.resolve(jsonResponse([
        { id: 1, email: 'owner@example.com', display_name: 'Owner', role: 'owner', active_sessions: 1 },
        { id: 2, email: 'member@example.com', display_name: 'Member', role: 'member', active_sessions: 2 },
      ]))
      if (url.includes('/admin/invitations')) return Promise.resolve(jsonResponse([{ id: 4, intended_email: 'pending@example.com', expires_at: '2026-08-27T12:00:00Z' }]))
      return Promise.resolve(jsonResponse([]))
    })
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Manage access.' })).toBeInTheDocument()
    expect(await screen.findByText('member@example.com · 2 active logins')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign out everywhere' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove access' })).toBeInTheDocument()
    expect(screen.getByText('pending@example.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Revoke invitation' })).toBeInTheDocument()
  })

  it('shows the empty recipe collection and API status', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => Promise.resolve(authResponse(input) ?? jsonResponse([])))
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Your recipes' })).toBeInTheDocument()
    expect(await screen.findByText('Your collection is ready')).toBeInTheDocument()
    expect(await screen.findByText('Owner · Test family')).toBeInTheDocument()
  })

  it('renders recipes returned by the API', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => Promise.resolve(authResponse(input) ?? jsonResponse([{ id: 4, name: 'Onion soup', description: 'A warming soup.', image_url: null, source_url: null, author: null, servings: '4', preparation_time_minutes: 10, cooking_time_minutes: 30, total_time_minutes: 40, cuisine: 'French', category: 'Dinner', tags: ['Comfort food'], ingredients: [], instructions: [], created_at: '', updated_at: '' }])))
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Onion soup' })).toBeInTheDocument()
    expect(screen.getByText('40 min')).toBeInTheDocument()
  })

  it('filters the recipe library by search text', async () => {
    const recipes = [
      { id: 1, name: 'Onion soup', description: 'Warm', image_url: null, source_url: null, author: null, servings: '4', preparation_time_minutes: null, cooking_time_minutes: null, total_time_minutes: 40, cuisine: 'French', category: 'Dinner', tags: ['Comfort food'], ingredients: [], instructions: [], created_at: '', updated_at: '' },
      { id: 2, name: 'Berry bowl', description: 'Fresh', image_url: null, source_url: null, author: null, servings: '2', preparation_time_minutes: null, cooking_time_minutes: null, total_time_minutes: 5, cuisine: null, category: 'Breakfast', tags: ['Quick'], ingredients: [], instructions: [], created_at: '', updated_at: '' },
    ]
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => Promise.resolve(authResponse(input) ?? jsonResponse(recipes)))
    render(<App />)
    await screen.findByRole('heading', { name: 'Onion soup' })

    fireEvent.change(screen.getByLabelText('Search recipes'), { target: { value: 'berry' } })

    expect(screen.queryByRole('heading', { name: 'Onion soup' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Berry bowl' })).toBeInTheDocument()
    expect(screen.getByText('1 recipe')).toBeInTheDocument()
  })

  it('shows the manual recipe form', async () => {
    window.history.pushState({}, '', '/recipes/new')
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => Promise.resolve(authResponse(input) ?? jsonResponse({ status: 'ok' })))
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Add a recipe' })).toBeInTheDocument()
    expect(screen.getByLabelText('Name *')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save recipe' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'dinner' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'breakfast' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows seven days of meal planning slots', async () => {
    window.history.pushState({}, '', '/planner')
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input)
      const auth = authResponse(input)
      if (auth) return Promise.resolve(auth)
      if (url.includes('/meal-plans/week')) return Promise.resolve(jsonResponse({ week_start: '2026-08-17', week_end: '2026-08-23', entries: [] }))
      return Promise.resolve(jsonResponse([{ id: 1, name: 'Pasta', image_url: null, tags: ['Quick', 'Vegetarian'], ingredients: [], instructions: [] }]))
    })
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Plan your week' })).toBeInTheDocument()
    expect(await screen.findByLabelText('Monday dinner')).toBeInTheDocument()
    expect(screen.getByLabelText('Sunday breakfast')).toBeInTheDocument()
    expect(screen.getAllByRole('combobox')).toHaveLength(22)
    expect(screen.getByRole('button', { name: 'Suggest my week' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'breakfast' }))
    fireEvent.click(screen.getByRole('button', { name: 'lunch' }))
    expect(screen.queryByLabelText('Monday breakfast')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Monday dinner')).toBeInTheDocument()
    expect(screen.getAllByRole('combobox')).toHaveLength(8)
    fireEvent.click(screen.getByRole('button', { name: 'Quick' }))
    fireEvent.click(screen.getByRole('button', { name: 'Vegetarian' }))
    expect(screen.getByRole('button', { name: 'Quick' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Vegetarian' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows a generated weekly grocery checklist', async () => {
    window.history.pushState({}, '', '/grocery-list?week=2026-08-17')
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => Promise.resolve(authResponse(input) ?? jsonResponse({ week_start: '2026-08-17', week_end: '2026-08-23', planned_meals: 2, items: [{ key: '1:1', name: 'pasta', category: 'Other', quantity: '600', quantity_max: null, unit: { name: 'gram', symbol: 'g', dimension: 'mass' }, recipe_names: ['Simple pasta'], raw_texts: ['200 g pasta'] }] })))
    render(<App />)

    expect(await screen.findByRole('heading', { name: /Shop once/ })).toBeInTheDocument()
    expect(await screen.findByText('600 g')).toBeInTheDocument()
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

  it('infers allowed meal types from imported categories', () => {
    expect(inferMealTypes('Morgenmad, Brunch')).toEqual(['breakfast'])
    expect(inferMealTypes('Frokost, Aftensmad')).toEqual(['lunch', 'dinner'])
    expect(inferMealTypes(null)).toEqual([])
  })
})
