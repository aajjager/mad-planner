import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { inferMealTypes, parseServingCount } from './api/recipes'
import * as clipboard from './utils/clipboard'

const jsonResponse = (value: unknown) => new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } })
const account = { id: 1, email: 'owner@example.com', display_name: 'Owner', family_id: 1, family_name: 'Test family', role: 'owner', locale: 'en', show_nutrition: true, dark_mode: false, accent_theme: 'sage', browser_notifications_enabled: false, mfa_enabled: false }
const familySettings = { household_size: 2, leftovers_enabled: true, cooking_mode_enabled: true, plan_reminders_enabled: true, plan_reminder_weeks: 1, planning_suggestion_mode: 'review', rating_filter_enabled: false, rating_minimum: 3, rating_target_percent: 50, rated_recipe_count: 0, rating_filter_eligible: false, enabled_meal_types: ['breakfast', 'lunch', 'dinner'] }
const recipeTypes = [{ id: 1, name: 'Breakfast', meal_type: 'breakfast' }, { id: 2, name: 'Lunch', meal_type: 'lunch' }, { id: 3, name: 'Dinner', meal_type: 'dinner' }]
const authResponse = (input: RequestInfo | URL) => {
  const url = String(input)
  if (url.includes('/auth/status')) return jsonResponse({ setup_required: false })
  if (url.includes('/auth/me')) return jsonResponse(account)
  if (url.includes('/family/settings')) return jsonResponse(familySettings)
  if (url.includes('/family/recipe-types')) return jsonResponse(recipeTypes)
  return null
}

describe('App', () => {
  it('groups creation methods behind Add recipe and keeps browsing uncluttered', async () => {
    window.history.pushState({}, '', '/recipes')
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => Promise.resolve(authResponse(input) ?? jsonResponse([])))
    render(<App />)
    await screen.findByRole('heading', { name: 'Your recipes' })
    const main = within(screen.getByRole('main'))
    expect(main.queryByRole('link', { name: 'Scan book' })).not.toBeInTheDocument()
    expect(main.queryByRole('link', { name: 'Import from URL' })).not.toBeInTheDocument()
    fireEvent.click(main.getByRole('link', { name: 'Add recipe' }))
    await screen.findByRole('heading', { name: 'How would you like to add a recipe?' })
    for (const [name, path] of [['Import from URL', '/recipes/import'], ['Manual recipe', '/recipes/new'], ['Scan book', '/recipes/scan'], ['Import CookBook', '/recipes/import/cookbook']]) {
      expect(main.getByRole('link', { name: new RegExp(name) })).toHaveAttribute('href', path)
    }
    fireEvent.click(main.getByRole('link', { name: /Import from URL/ }))
    expect(await main.findByRole('link', { name: /Add recipe/ })).toHaveAttribute('href', '/recipes/add')
    expect(fetch.mock.calls.every(([, init]) => !init?.method || init.method === 'GET')).toBe(true)
  })

  it.each(['viewer', 'planner'])('keeps the creation menu unavailable to %s accounts', async (role) => {
    window.history.pushState({}, '', '/recipes/add')
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => Promise.resolve(String(input).includes('/auth/me') ? jsonResponse({ ...account, role }) : authResponse(input) ?? jsonResponse([])))
    render(<App />)
    await screen.findByRole('heading', { name: 'Your recipes' })
    expect(screen.queryByRole('link', { name: 'Add recipe' })).not.toBeInTheDocument()
    expect(window.location.pathname).toBe('/recipes')
  })

  it('reviews and saves the introduction from a scanned cookbook page', async () => {
    window.history.pushState({}, '', '/recipes/scan')
    const preview = { name: 'Chili con carne', description: 'A family favourite.', ingredients: ['350 g beef'], instructions: ['Simmer for thirty minutes.'], raw_text: 'Chili con carne', warnings: [] }
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input)
      if (url.includes('/recipe-scans/preview')) return Promise.resolve(jsonResponse(preview))
      if (url.endsWith('/recipes') && init?.method === 'POST') return Promise.resolve(jsonResponse({ id: 999, ...preview, tags: [], meal_types: [], recipe_types: [] }))
      return Promise.resolve(authResponse(input) ?? jsonResponse([]))
    })
    render(<App />)
    const file = new File(['photo'], 'page.jpg', { type: 'image/jpeg' })
    fireEvent.change(await screen.findByLabelText('Recipe page photo'), { target: { files: [file] } })
    fireEvent.click(screen.getByRole('button', { name: 'Scan page' }))
    const description = await screen.findByLabelText('Description')
    expect(description).toHaveValue('A family favourite.')
    expect(screen.getByText(/Text recognition can miss/)).toBeInTheDocument()
    fireEvent.change(description, { target: { value: 'Reviewed introduction.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Dinner' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save scanned recipe' }))
    await waitFor(() => expect(fetch.mock.calls.some(([url, init]) => String(url).endsWith('/recipes') && init?.method === 'POST' && JSON.parse(String(init.body)).description === 'Reviewed introduction.')).toBe(true))
  })

  it('combines multiple photos, removes selections, and saves the chosen recipe image', async () => {
    window.history.pushState({}, '', '/recipes/scan')
    const first = new File(['one'], 'page-one.jpg', { type: 'image/jpeg' })
    const second = new File(['two'], 'page-two.jpg', { type: 'image/jpeg' })
    const removed = new File(['three'], 'remove-me.jpg', { type: 'image/jpeg' })
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input)
      if (url.includes('/recipe-scans/preview')) return Promise.resolve(jsonResponse({ name: 'Chili', confidence: 0.9, description: 'From the book.', ingredients: init?.body === first ? ['2 onions'] : ['350 g beef'], instructions: init?.body === first ? ['Chop the onions.'] : ['Cook until ready.'], raw_text: 'Detected text', warnings: [] }))
      if (url.endsWith('/recipes') && init?.method === 'POST') return Promise.resolve(jsonResponse({ id: 999 }))
      if (url.endsWith('/recipes/999')) return Promise.resolve(jsonResponse({ id: 999, name: 'Chili', tags: [], ingredients: [], instructions: [], meal_types: [], recipe_types: [] }))
      if (url.endsWith('/999/image')) return Promise.resolve(jsonResponse({ id: 999 }))
      return Promise.resolve(authResponse(input) ?? jsonResponse([]))
    })
    render(<App />)
    const picker = await screen.findByLabelText('Recipe page photo')
    expect(picker).toHaveAttribute('multiple')
    fireEvent.change(picker, { target: { files: [first, second] } })
    fireEvent.change(screen.getByLabelText('Take another photo'), { target: { files: [removed] } })
    fireEvent.click(screen.getByRole('button', { name: 'Remove remove-me.jpg' }))
    expect(screen.queryByRole('button', { name: 'Remove remove-me.jpg' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: /page-two.jpg/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Scan page' }))
    await screen.findByLabelText('Description')
    expect(screen.getByLabelText('Ingredients — one per line')).toHaveValue('2 onions\n350 g beef')
    fireEvent.click(screen.getByRole('button', { name: 'Dinner' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save scanned recipe' }))
    await waitFor(() => expect(fetch.mock.calls.some(([url, init]) => String(url).endsWith('/999/image') && init?.body === second)).toBe(true))
    expect(fetch.mock.calls.filter(([url]) => String(url).includes('/recipe-scans/preview'))).toHaveLength(2)
  })

  it('retains successful photos when another photo cannot be scanned', async () => {
    window.history.pushState({}, '', '/recipes/scan')
    const good = new File(['good'], 'good.jpg', { type: 'image/jpeg' })
    const bad = new File(['bad'], 'bad.jpg', { type: 'image/jpeg' })
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      if (String(input).includes('/recipe-scans/preview')) return Promise.resolve(init?.body === bad ? new Response(JSON.stringify({ detail: 'Unreadable image' }), { status: 422 }) : jsonResponse({ name: 'Chili', description: 'Still available.', ingredients: ['2 onions'], instructions: ['Cook.'], raw_text: 'Text', warnings: [] }))
      return Promise.resolve(authResponse(input) ?? jsonResponse([]))
    })
    render(<App />)
    fireEvent.change(await screen.findByLabelText('Recipe page photo'), { target: { files: [good, bad] } })
    fireEvent.click(screen.getByRole('button', { name: 'Scan page' }))
    expect(await screen.findByLabelText('Description')).toHaveValue('Still available.')
    expect(screen.getByRole('alert')).toHaveTextContent('bad.jpg')
  })

  it.each([false, true])('keeps food images out of recipe text with explicit photo-only selection %s', async (photoOnly) => {
    window.history.pushState({}, '', '/recipes/scan')
    const food = new File(['food'], 'food.jpg', { type: 'image/jpeg' })
    const page = new File(['page'], 'page.jpg', { type: 'image/jpeg' })
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      if (String(input).includes('/recipe-scans/preview')) return Promise.resolve(jsonResponse(init?.body === food ? { usable: false, name: 'Scanned recipe', ingredients: [], instructions: [], raw_text: 'Ed r + a', warnings: [] } : { usable: true, name: 'FAST FOOD PIZZA', ingredients: ['1 Chicken snack'], instructions: [], raw_text: 'INGREDIENTS', warnings: ['No instruction steps were detected.'] }))
      return Promise.resolve(authResponse(input) ?? jsonResponse([]))
    })
    render(<App />)
    fireEvent.change(await screen.findByLabelText('Recipe page photo'), { target: { files: [food, page] } })
    if (photoOnly) fireEvent.click(screen.getAllByRole('checkbox', { name: 'Read text from this photo' })[0])
    fireEvent.change(screen.getByLabelText('Recipe text language'), { target: { value: 'en' } })
    fireEvent.click(screen.getByRole('button', { name: 'Scan page' }))
    expect(await screen.findByLabelText('Recipe name')).toHaveValue('FAST FOOD PIZZA')
    expect(screen.getByText(/No cooking instructions were found/)).toBeInTheDocument()
    expect(screen.getByLabelText('Instructions — one per line')).toHaveValue('')
    const requests = fetch.mock.calls.filter(([url]) => String(url).includes('/recipe-scans/preview'))
    expect(requests).toHaveLength(photoOnly ? 1 : 2)
    expect(requests.every(([url]) => String(url).includes('language=en'))).toBe(true)
    expect(screen.getByRole('radio', { name: /food.jpg/ })).toBeChecked()
    if (!photoOnly) expect(screen.getByText(/These photos were kept as images only/)).toBeInTheDocument()
  })

  it('finds a saved meal with a typo and sends its name as a planning preference', async () => {
    window.history.pushState({}, '', '/planner?week=2027-03-15')
    const name = 'Smoky Burger with crispy onions and homemade sauce'
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input)
      const auth = authResponse(input)
      if (auth) return Promise.resolve(auth)
      if (url.includes('/meal-plans/week/suggestions')) return Promise.resolve(jsonResponse({ options: [] }))
      if (url.includes('/meal-plans/week')) return Promise.resolve(jsonResponse({ entries: [], exclusions: [] }))
      if (url.endsWith('/recipes')) return Promise.resolve(jsonResponse([{ id: 23, name, tags: [], ingredients: [], meal_types: ['dinner'] }]))
      return Promise.resolve(jsonResponse([]))
    })
    render(<App />)
    const search = await screen.findByRole('searchbox', { name: 'Search meals, ingredients, cuisines, or styles' })
    fireEvent.change(search, { target: { value: 'bruger' } })
    fireEvent.click(screen.getByRole('button', { name: `+ ${name}` }))
    expect(screen.getByRole('button', { name: `${name} ×` })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Suggest my week' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/v1/meal-plans/week/suggestions?week_start=2027-03-15', expect.objectContaining({ body: expect.stringContaining(JSON.stringify([name])) })))

  })

  it.each(['lavender', 'terracotta', 'teal'])('saves and applies the %s personal palette in Family', async (theme) => {
    window.history.pushState({}, '', '/family')
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      if (String(input).endsWith('/auth/me/preferences') && init?.method === 'PATCH') {
        return Promise.resolve(jsonResponse({ ...account, ...JSON.parse(String(init.body)) }))
      }
      return Promise.resolve(authResponse(input) ?? jsonResponse([]))
    })
    render(<App />)
    const select = await screen.findByLabelText('Menu color')
    for (const name of ['Sage green', 'Ocean blue', 'Soft berry', 'Warm gold', 'Lavender purple', 'Terracotta orange', 'Deep teal']) {
      expect(within(select).getByRole('option', { name })).toBeInTheDocument()
    }
    fireEvent.change(select, { target: { value: theme } })
    await waitFor(() => expect(document.documentElement.dataset.accent).toBe(theme))
    expect(select).toHaveValue(theme)
    expect(fetch).toHaveBeenCalledWith('/api/v1/auth/me/preferences', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ accent_theme: theme }) }))
  })

  it.each(['lavender', 'terracotta', 'teal'])('restores the saved %s palette in dark mode after reopening', async (theme) => {
    window.history.pushState({}, '', '/family')
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => Promise.resolve(
      String(input).endsWith('/auth/me')
        ? jsonResponse({ ...account, accent_theme: theme, dark_mode: true })
        : authResponse(input) ?? jsonResponse([]),
    ))
    const view = render(<App />)
    expect(await screen.findByLabelText('Menu color')).toHaveValue(theme)
    await waitFor(() => {
      expect(document.documentElement.dataset.accent).toBe(theme)
      expect(document.documentElement.dataset.mode).toBe('dark')
    })
    view.unmount()
    render(<App />)
    expect(await screen.findByLabelText('Menu color')).toHaveValue(theme)
    await waitFor(() => {
      expect(document.documentElement.dataset.accent).toBe(theme)
      expect(document.documentElement.dataset.mode).toBe('dark')
    })
    expect(fetch.mock.calls.every(([, init]) => !init?.method || init.method === 'GET')).toBe(true)
  })

  it('keeps edits available after a failed save and cancels without another write', async () => {
    window.history.pushState({}, '', '/recipes/90/edit')
    const recipe = { id: 90, name: 'Keep this recipe', tags: [], meal_types: [], recipe_types: [], ingredients: [], instructions: [], owned_by_current_family: true }
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      if (String(input).endsWith('/recipes/90')) return Promise.resolve(init?.method === 'PUT'
        ? new Response(JSON.stringify({ detail: 'Save failed. Try again.' }), { status: 500 })
        : jsonResponse(recipe))
      return Promise.resolve(authResponse(input) ?? jsonResponse([]))
    })
    render(<App />)
    const name = await screen.findByLabelText('Name *')
    fireEvent.change(name, { target: { value: 'Unsaved name' } })
    for (let step = 0; step < 3; step++) fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save recipe' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Save failed. Try again.')
    expect(name).toHaveValue('Unsaved name')
    fireEvent.click(screen.getByRole('link', { name: '← Cancel' }))
    await screen.findByRole('heading', { name: 'Keep this recipe' })
    expect(fetch.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(1)
  })

  it('does not offer editing for a recipe owned by another family', async () => {
    window.history.pushState({}, '', '/recipes/91/edit')
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => Promise.resolve(String(input).endsWith('/recipes/91')
      ? jsonResponse({ id: 91, owned_by_current_family: false })
      : authResponse(input) ?? jsonResponse([])))
    render(<App />)
    await screen.findByRole('link', { name: 'All recipes' })
    expect(screen.queryByRole('heading', { name: 'Edit recipe' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Name *')).not.toBeInTheDocument()
  })
  it('prefills a saved recipe, saves edits to the same recipe, and preserves ingredient metadata', async () => {
    window.history.pushState({}, '', '/recipes/88/edit')
    let recipe = { id: 88, name: 'Original soup', description: 'Original description', author: 'Chef', servings: '4', source_url: 'https://example.com/soup', image_url: '/api/v1/media/photo.jpg', tags: ['Soup'], meal_types: ['dinner'], recipe_types: ['Dinner'], owned_by_current_family: true, ingredients: [{ id: 1, raw_text: '2 onions', ingredient_name: 'onion', quantity: '2', quantity_max: '3', preparation: 'diced', notes: 'optional', unit: null }], instructions: [{ id: 1, text: 'Cook gently.' }] }
    let saved: Record<string, unknown> | undefined
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      if (String(input).endsWith('/recipes/88')) {
        if (init?.method === 'PUT') { saved = JSON.parse(String(init.body)); recipe = { ...recipe, ...saved } }
        return Promise.resolve(jsonResponse(recipe))
      }
      return Promise.resolve(authResponse(input) ?? jsonResponse([]))
    })
    render(<App />)
    const name = await screen.findByLabelText('Name *')
    expect(name).toHaveValue('Original soup')
    expect(screen.getByLabelText('Description')).toHaveValue('Original description')
    fireEvent.change(name, { target: { value: 'Edited soup' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.getByDisplayValue('2 onions')).toBeInTheDocument()
    fireEvent.change(screen.getByDisplayValue('2 onions'), { target: { value: '2 diced onions' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    fireEvent.change(screen.getByDisplayValue('Cook gently.'), { target: { value: 'Simmer gently.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save recipe' }))
    await screen.findByRole('heading', { name: 'Edited soup' })
    expect(saved?.ingredients).toEqual([expect.objectContaining({ raw_text: '2 diced onions', quantity_max: '3', preparation: 'diced', notes: 'optional' })])
    expect(saved?.instructions).toEqual([{ text: 'Simmer gently.' }])
    expect(saved).not.toHaveProperty('nutrition')
    expect(saved).not.toHaveProperty('image_url')
    expect(window.location.pathname).toBe('/recipes/88')
  })
  // Existing workflows exercise a returning user; first visits are covered in WelcomeGuide.test.tsx.
  beforeEach(() => localStorage.setItem('madplanner:welcome:1:1', 'seen'))
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); window.history.pushState({}, '', '/') })

  it('collapses long recipe descriptions and restores the full original text on demand', async () => {
    const height = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(300)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(100)
    const description = 'A delicious vegetable dinner with gnocchi. '.repeat(20) + 'The complete description ends here.'
    window.history.pushState({}, '', '/recipes/88')
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      if (String(input).endsWith('/recipes/88')) return Promise.resolve(jsonResponse({ id: 88, name: 'Gnocchi regression', description, tags: [], ingredients: [], instructions: [], meal_types: [], recipe_types: [] }))
      return Promise.resolve(authResponse(input) ?? jsonResponse([]))
    })
    render(<App />)
    const show = await screen.findByRole('button', { name: 'Read more' })
    expect(show).toHaveAttribute('aria-expanded', 'false')
    const paragraph = document.getElementById(show.getAttribute('aria-controls')!)!
    expect(paragraph).toHaveClass('recipe-description-text--collapsed')
    expect(paragraph.textContent).toBe(description)
    fireEvent.click(show)
    expect(screen.getByRole('button', { name: 'Read less' })).toHaveAttribute('aria-expanded', 'true')
    expect(paragraph.textContent).toBe(description)
    expect(paragraph).not.toHaveClass('recipe-description-text--collapsed')
    fireEvent.click(screen.getByRole('button', { name: 'Read less' }))
    expect(paragraph).toHaveClass('recipe-description-text--collapsed')
    expect(fetch.mock.calls.every(([, options]) => !options?.method || options.method === 'GET')).toBe(true)
    height.mockReturnValue(100)
    fireEvent(window, new Event('resize'))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Read more' })).not.toBeInTheDocument())
  })

  it.each(['A short introduction.', 'x'.repeat(320), null])('does not offer Show more for a short or missing description', async (description) => {
    window.history.pushState({}, '', '/recipes/89')
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => String(input).endsWith('/recipes/89')
      ? Promise.resolve(jsonResponse({ id: 89, name: 'Short description regression', description, tags: [], ingredients: [], instructions: [], meal_types: [], recipe_types: [] }))
      : Promise.resolve(authResponse(input) ?? jsonResponse([])))
    render(<App />)
    await screen.findByRole('heading', { name: 'Short description regression' })
    expect(screen.queryByRole('button', { name: 'Read more' })).not.toBeInTheDocument()
    if (description) expect(screen.getByText(description)).toBeInTheDocument()
  })

  it('requires typed confirmation for the selected family, resets on cancel, and preserves the dialog on failure', async () => {
    vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (this: HTMLDialogElement) { this.setAttribute('open', '') })
    window.history.pushState({}, '', '/admin')
    let attempts = 0
    let removed = false
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input)
      if (url.includes('/auth/me')) return Promise.resolve(jsonResponse({ ...account, is_system_admin: true }))
      if (url.endsWith('/admin/families/2') && init?.method === 'DELETE') {
        attempts += 1
        if (attempts === 1) return Promise.resolve(new Response(JSON.stringify({ detail: 'Deletion failed. Try again.' }), { status: 500, headers: { 'Content-Type': 'application/json' } }))
        removed = true
        return Promise.resolve(new Response(null, { status: 204 }))
      }
      if (url.endsWith('/admin/families')) return Promise.resolve(jsonResponse([{ id: 1, name: 'Test family', members: 1, recipes: 0 }, ...(removed ? [] : [{ id: 2, name: 'Other family', members: 2, recipes: 5 }])]))
      return Promise.resolve(authResponse(input) ?? jsonResponse([]))
    })
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Delete family' }))
    let dialog = screen.getByRole('dialog', { name: 'Delete the family “Other family”?' })
    expect(within(dialog).getByText(/permanently removed/)).toBeInTheDocument()
    let input = within(dialog).getByLabelText('Type delete to confirm permanent deletion.')
    const confirm = () => within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete family' })
    expect(confirm()).toBeDisabled()
    for (const value of ['DELETE', 'delete ', 'Other family']) {
      fireEvent.change(input, { target: { value } })
      expect(confirm()).toBeDisabled()
      fireEvent.submit(input.closest('form')!)
    }
    expect(attempts).toBe(0)
    fireEvent.change(input, { target: { value: 'delete' } })
    expect(confirm()).toBeEnabled()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Delete family' }))
    dialog = screen.getByRole('dialog')
    input = within(dialog).getByLabelText('Type delete to confirm permanent deletion.')
    expect(input).toHaveValue('')
    fireEvent.change(input, { target: { value: 'delete' } })
    fireEvent.click(confirm())
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Deletion failed. Try again.')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.click(confirm())
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(attempts).toBe(2)
    expect(fetch.mock.calls.filter(([, init]) => init?.method === 'DELETE').every(([url]) => String(url).endsWith('/admin/families/2'))).toBe(true)
  })

  it('shows unread answers on family links, marks them read, and keeps the reply in history', async () => {
    window.history.pushState({}, '', '/family')
    let item = { id: 71, content: 'Where is my planner?', category: 'improvement', status: 'done', is_question: true, answer: 'Open the Planner tab.\nChoose your week.', answered_at: '2026-10-19T12:00:00Z', answer_seen_at: null as string | null }
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input)
      if (url.endsWith('/feedback/71/acknowledge')) { item = { ...item, answer_seen_at: '2026-10-19T12:01:00Z' }; return Promise.resolve(jsonResponse(item)) }
      if (url.endsWith('/auth/feedback')) return Promise.resolve(jsonResponse([item]))
      return Promise.resolve(authResponse(input) ?? jsonResponse([]))
    })
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Your question has been answered' })).toBeInTheDocument()
    expect(screen.getAllByLabelText('Unread answers: 1')).toHaveLength(2)
    expect(screen.getByText('Open the Planner tab. Choose your week.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Mark as read' }))
    await waitFor(() => expect(screen.queryByLabelText('Unread answers: 1')).not.toBeInTheDocument())
    expect(screen.queryByRole('heading', { name: 'Your question has been answered' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Closed requests/ }))
    expect(screen.getByText('Open the Planner tab. Choose your week.')).toBeInTheDocument()
    expect(screen.getByText('Question')).toBeInTheDocument()
  })

  it('lets administrators classify and answer a question instead of copying it to Codex', async () => {
    window.history.pushState({}, '', '/admin')
    let item = { id: 72, content: 'How do I add a recipe?', category: 'feature', status: 'approved', is_question: false, answer: null as string | null, submitted_by: 'Member', family_name: 'Family', created_at: '2026-10-19T12:00:00Z' }
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input)
      if (url.includes('/auth/me')) return Promise.resolve(jsonResponse({ ...account, is_system_admin: true }))
      if (url.endsWith('/admin/feedback/72/answer')) { const data = JSON.parse(String(init?.body)); item = { ...item, is_question: true, status: data.answer ? 'done' : 'pending', answer: data.answer ?? null }; return Promise.resolve(jsonResponse(item)) }
      if (url.endsWith('/admin/feedback')) return Promise.resolve(jsonResponse([item]))
      return Promise.resolve(authResponse(input) ?? jsonResponse([]))
    })
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Mark as question' }))
    const answer = await screen.findByLabelText('Administrator answer')
    expect(screen.queryByRole('button', { name: 'Copy for Codex' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send answer' })).toBeDisabled()
    fireEvent.change(answer, { target: { value: 'Use Add recipe.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send answer' }))
    await waitFor(() => expect(fetch.mock.calls.some(([url, init]) => String(url).endsWith('/72/answer') && init?.body === JSON.stringify({ answer: 'Use Add recipe.' }))).toBe(true))
  })

  it('shows the calendar release and categorized changelog in Updates', async () => {
    window.history.pushState({}, '', '/updates')
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => Promise.resolve(authResponse(input) ?? jsonResponse([])))
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Mad Planner 0.10.4' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { name: 'Improvements' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('heading', { name: 'Bug fixes' }).length).toBeGreaterThan(0)
    expect(screen.getByText('October 2026, week 4')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Mad Planner 0.2.5' })).toBeInTheDocument()
  })

  it.each([['bug', 'Bug fixes'], ['feature', 'Features'], ['improvement', 'Improvements']])('copies the approved %s category from individual and group controls', async (category, heading) => {
    window.history.pushState({}, '', '/admin')
    const copy = vi.spyOn(clipboard, 'copyText').mockResolvedValue(true)
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input)
      if (url.includes('/auth/me')) return Promise.resolve(jsonResponse({ ...account, is_system_admin: true }))
      if (url.endsWith('/admin/feedback')) return Promise.resolve(jsonResponse([{ id: 1, category, content: 'Approved category regression', status: 'approved', submitted_by: 'Owner', family_name: 'Family', created_at: '2026-10-18T12:00:00Z' }]))
      return Promise.resolve(authResponse(input) ?? jsonResponse([]))
    })
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Copy for Codex' }))
    await waitFor(() => expect(copy).toHaveBeenCalledTimes(1))
    expect(copy.mock.calls[0][0]).toContain(`Request type: ${category}`)
    expect(copy.mock.calls[0][0]).toContain(`### ${heading}`)
    const groupButton = screen.getAllByRole('button', { name: 'Copy group for Codex' }).find((button) => !(button as HTMLButtonElement).disabled)!
    fireEvent.click(groupButton)
    await waitFor(() => expect(copy).toHaveBeenCalledTimes(2))
    expect(copy.mock.calls[1][0]).toContain(`### ${heading}`)
  })

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
    expect(screen.getByRole('radio', { name: /Start with example recipes/ })).toBeChecked()
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
      if (url.includes('/family/invitations')) return Promise.resolve(jsonResponse({ token: 'private-token', family_name: 'Test family', intended_email: 'member@example.com', expires_at: '', role: 'editor' }))
      return Promise.resolve(jsonResponse([]))
    })
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Test family' })).toBeInTheDocument()
    expect(await screen.findByLabelText('People in the household')).toHaveValue(2)
    expect(screen.getByRole('button', { name: 'Save family options' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'member@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create invitation' }))

    expect(await screen.findByLabelText('Invitation link')).toHaveValue('http://localhost:3000/invite/private-token')
  })

  it.each(['expire', 'dismiss'])('hides completed notices on %s while preserving closed history', async (action) => {
    window.history.pushState({}, '', '/family')
    const now = Date.now()
    const item = { id: 99, content: 'Recently completed suggestion', category: 'improvement', status: 'done', completed_at: new Date(now - 5 * 86400000 + 10000).toISOString(), completion_seen_at: null }
    const old = { ...item, id: 100, content: 'Old completed suggestion', completed_at: new Date(now - 6 * 86400000).toISOString() }
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input)
      if (url.endsWith('/feedback/99/acknowledge')) return Promise.resolve(jsonResponse({ ...item, completion_seen_at: new Date().toISOString() }))
      if (url.endsWith('/auth/feedback')) return Promise.resolve(jsonResponse([item, old]))
      return Promise.resolve(authResponse(input) ?? jsonResponse([]))
    })
    if (action === 'expire') vi.useFakeTimers()
    await act(async () => { render(<App />) })
    expect(screen.getByText(item.content)).toBeInTheDocument()
    expect(screen.queryByText(old.content)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument()
    if (action === 'dismiss') {
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
      await waitFor(() => expect(screen.queryByText(item.content)).not.toBeInTheDocument())
      expect(fetch.mock.calls.some(([url]) => String(url).endsWith('/feedback/99/acknowledge'))).toBe(true)
    } else {
      await act(async () => { await vi.advanceTimersByTimeAsync(10001) })
      expect(screen.queryByText(item.content)).not.toBeInTheDocument()
      expect(fetch.mock.calls.some(([, init]) => init?.method && init.method !== 'GET')).toBe(false)
    }
    fireEvent.click(screen.getByRole('button', { name: 'Closed requests (2)' }))
    expect(screen.getByText(item.content)).toBeInTheDocument()
    expect(screen.getByText(old.content)).toBeInTheDocument()
  })

  it('separates open and closed personal requests', async () => {
    window.history.pushState({}, '', '/family')
    const feedback = [
      { id: 1, content: 'Open planner request', category: 'feature', status: 'approved', family_name: 'Test family', submitted_by: 'Owner', created_at: '2026-09-24T10:00:00Z', reviewed_at: null, completed_at: null, completion_seen_at: null, attachment_url: null, attachment_name: null, attachment_content_type: null },
      { id: 2, content: 'Closed grocery request', category: 'improvement', status: 'done', family_name: 'Test family', submitted_by: 'Owner', created_at: '2026-09-23T10:00:00Z', reviewed_at: '2026-09-24T10:00:00Z', completed_at: '2026-09-24T10:00:00Z', completion_seen_at: '2026-09-24T11:00:00Z', attachment_url: null, attachment_name: null, attachment_content_type: null },
    ]
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input)
      const auth = authResponse(input)
      if (auth) return Promise.resolve(auth)
      if (url.endsWith('/auth/feedback')) return Promise.resolve(jsonResponse(feedback))
      if (url.includes('/family/members')) return Promise.resolve(jsonResponse([{ id: 1, email: 'owner@example.com', display_name: 'Owner', role: 'owner' }]))
      return Promise.resolve(jsonResponse([]))
    })
    render(<App />)

    expect(await screen.findByText('Open planner request')).toBeInTheDocument()
    expect(screen.queryByText('Closed grocery request')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Closed requests (1)' }))
    expect(screen.getByText('Closed grocery request')).toBeInTheDocument()
    expect(screen.queryByText('Open planner request')).not.toBeInTheDocument()
  })

  it('lets an invited person join the shared family', async () => {
    window.history.pushState({}, '', '/invite/private-token')
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input)
      if (url.includes('/auth/status')) return Promise.resolve(jsonResponse({ setup_required: false }))
      if (url.includes('/auth/me')) return Promise.resolve(new Response(JSON.stringify({ detail: 'Authentication required' }), { status: 401, headers: { 'Content-Type': 'application/json' } }))
      if (url.endsWith('/invitations/private-token')) return Promise.resolve(jsonResponse({ family_name: 'Test family', intended_email: 'member@example.com', expires_at: '', role: 'editor' }))
      if (url.includes('/accept')) return Promise.resolve(jsonResponse({ ...account, id: 2, email: 'member@example.com', display_name: 'Member', role: 'editor' }))
      return Promise.resolve(jsonResponse([]))
    })
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Join family Test family.' })).toBeInTheDocument()
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
        { id: 2, email: 'member@example.com', display_name: 'Member', role: 'editor', active_sessions: 2 },
      ]))
      if (url.includes('/admin/invitations')) return Promise.resolve(jsonResponse([{ id: 4, intended_email: 'pending@example.com', expires_at: '2026-08-27T12:00:00Z', role: 'viewer' }]))
      return Promise.resolve(jsonResponse([]))
    })
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Manage access.' })).toBeInTheDocument()
    expect(await screen.findByText('member@example.com · 2 active logins')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign out everywhere' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove access' })).toBeInTheDocument()
    expect(screen.getByLabelText('Member Permission')).toHaveValue('editor')
    expect(screen.getByText('pending@example.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Revoke invitation' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Admin' })).toHaveLength(2)
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

  it('filters recipes by rating and calories ranges', async () => {
    const recipes = [
      { id: 1, name: 'Light favorite', description: 'Fresh', image_url: null, source_url: null, author: null, servings: '4', preparation_time_minutes: null, cooking_time_minutes: null, total_time_minutes: 20, cuisine: 'Nordic', category: 'Dinner', nutrition: { calories: 350 }, family_rating: 4, rating_count: 2, owned_by_current_family: true, tags: [], recipe_types: [], ingredients: [], instructions: [], created_at: '', updated_at: '' },
      { id: 2, name: 'Rich classic', description: 'Rich', image_url: null, source_url: null, author: null, servings: '4', preparation_time_minutes: null, cooking_time_minutes: null, total_time_minutes: 40, cuisine: 'French', category: 'Dinner', nutrition: { calories: 850 }, family_rating: 2, rating_count: 1, owned_by_current_family: true, tags: [], recipe_types: [], ingredients: [], instructions: [], created_at: '', updated_at: '' },
      { id: 3, name: 'Shared five-star meal', description: 'Shared', image_url: null, source_url: null, author: null, servings: '4', preparation_time_minutes: null, cooking_time_minutes: null, total_time_minutes: 30, cuisine: 'Italian', category: 'Dinner', nutrition: { calories: 450 }, family_rating: 5, rating_count: 8, owned_by_current_family: false, tags: [], recipe_types: [], ingredients: [], instructions: [], created_at: '', updated_at: '' },
    ]
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => Promise.resolve(authResponse(input) ?? jsonResponse(recipes)))
    render(<App />)
    await screen.findByRole('heading', { name: 'Light favorite' })

    fireEvent.change(screen.getByLabelText('Family rating range minimum'), { target: { value: '3' } })
    expect(screen.getByRole('heading', { name: 'Light favorite' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Rich classic' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Shared five-star meal' })).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Calories per serving maximum'), { target: { value: '300' } })
    expect(screen.getByText('No matching recipes')).toBeInTheDocument()
  })

  it('shows the manual recipe form', async () => {
    window.history.pushState({}, '', '/recipes/new')
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => Promise.resolve(authResponse(input) ?? jsonResponse({ status: 'ok' })))
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Add a recipe' })).toBeInTheDocument()
    expect(screen.getByLabelText('Name *')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Recipe creation progress' })).toBeInTheDocument()
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
    expect(screen.getByText('2 people · Leftovers enabled · Change these in Family.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '+ Quick' }))
    fireEvent.click(screen.getByRole('button', { name: '+ Vegetarian' }))
    expect(screen.getByRole('button', { name: 'Quick ×' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Vegetarian ×' })).toBeInTheDocument()
  })

  it('shows a generated weekly grocery checklist', async () => {
    window.history.pushState({}, '', '/grocery-list?week=2026-08-17')
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => Promise.resolve(authResponse(input) ?? jsonResponse({ week_start: '2026-08-17', week_end: '2026-08-23', planned_meals: 2, items: [{ id: 1, key: 'entry:1', name: 'pasta', category: 'Other', quantity: '600', quantity_max: null, unit: { name: 'gram', symbol: 'g', dimension: 'mass' }, recipe_names: ['Simple pasta'], raw_texts: ['200 g pasta'], origin: 'generated', purchased_at: null }], history: [] })))
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
