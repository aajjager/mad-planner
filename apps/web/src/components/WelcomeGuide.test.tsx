import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Account } from '../api/auth'
import { WelcomeGuide } from './WelcomeGuide'
import { guideCopy, guideStorageKey } from './welcomeGuideContent'

const account = { id: 15, family_id: 4, locale: 'en', role: 'owner' } as Account
function Location() { const location = useLocation(); return <output aria-label="Current page">{location.pathname}{location.hash}</output> }
function show(value = account) { return render(<MemoryRouter><WelcomeGuide account={value} /><Location /></MemoryRouter>) }
afterEach(() => { cleanup(); localStorage.clear() })

describe('Welcome guide', () => {
  it.each(['en', 'da', 'nl'] as const)('introduces meal-name planning in %s without changing dismissal keys', (locale) => {
    const step = guideCopy[locale].steps.find((step) => step[2] === '/planner')!
    expect(step[1]).toContain('burger')
    expect(guideStorageKey(account)).toBe('madplanner:welcome:4:15')
  })

  it.each([
    ['en', 'lavender', 'terracotta', 'teal'],
    ['da', 'lavendel', 'terrakotta', 'blågrøn'],
    ['nl', 'lavendel', 'terracotta', 'blauwgroen'],
  ] as const)('introduces the extra personal palettes in %s', (locale, ...colours) => {
    const step = guideCopy[locale].steps.find((step) => step[2] === '/family#personal-settings')!
    for (const colour of colours) expect(step[1]).toContain(colour)
  })

  it.each([
    ['en', 'five days', 'dismissed', 'Closed requests'],
    ['da', 'fem dage', 'afviser', 'Lukkede ønsker'],
    ['nl', 'vijf dagen', 'sluit', 'Gesloten verzoeken'],
  ] as const)('explains completion notice expiry and retained history in %s', (locale, duration, dismiss, history) => {
    const step = guideCopy[locale].steps.find((step) => step[2] === '/family#family-feedback')!
    for (const text of [duration, dismiss, history]) expect(step[1]).toContain(text)
  })
  it('scrolls and focuses the selected section, waits for delayed settings, and clears highlighting', async () => {
    const scroll = vi.fn()
    render(<MemoryRouter initialEntries={['/family']}><WelcomeGuide account={account} /><Location /><section id="personal-settings" tabIndex={-1} ref={(node) => { if (node) node.scrollIntoView = scroll }}>Personal settings target</section></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Family settings guide' }))
    expect(screen.getByLabelText('Current page')).toHaveTextContent('/family#personal-settings')
    expect(scroll).toHaveBeenCalledWith({ block: 'start', behavior: 'instant' })
    const personal = screen.getByText('Personal settings target')
    expect(personal).toHaveFocus()
    expect(personal).toHaveClass('welcome-guide-target')
    fireEvent.click(screen.getByRole('button', { name: 'Next tip' }))
    expect(personal).not.toHaveClass('welcome-guide-target')
    const delayed = document.createElement('section')
    delayed.id = 'account-security'
    delayed.tabIndex = -1
    const delayedScroll = vi.fn()
    delayed.scrollIntoView = delayedScroll
    document.body.append(delayed)
    try {
      await waitFor(() => expect(delayedScroll).toHaveBeenCalled())
      expect(delayed).toHaveFocus()
      expect(delayed).toHaveClass('welcome-guide-target')
      fireEvent.click(screen.getByRole('button', { name: 'Close guide' }))
      expect(delayed).not.toHaveClass('welcome-guide-target')
    } finally { delayed.remove() }
  })
  it('opens family settings guidance directly from Family and explains personal and shared settings', () => {
    render(<MemoryRouter initialEntries={['/family']}><WelcomeGuide account={account} /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Close guide' }))
    fireEvent.click(screen.getByRole('button', { name: 'Family settings guide' }))
    expect(screen.getByRole('heading', { name: 'Make the app your own' })).toBeInTheDocument()
    expect(screen.getByText(/preferences belong to your own account/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next tip' }))
    expect(screen.getByRole('heading', { name: 'Protect your account' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next tip' }))
    expect(screen.getByText(/other members can view these settings/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next tip' }))
    expect(screen.getByText(/editors, planners, or viewers/)).toBeInTheDocument()
  })
  it('welcomes first visits, supports previous tips, and opens real pages without dismissing the guide', () => {
    show()
    expect(screen.getByRole('heading', { name: 'Welcome to Mad Planner' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous tip' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Next tip' }))
    fireEvent.click(screen.getByRole('button', { name: 'Try this page' }))
    expect(screen.getByLabelText('Current page')).toHaveTextContent('/recipes')
    expect(screen.getByRole('complementary', { name: 'Welcome guide' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Previous tip' }))
    expect(screen.getByRole('heading', { name: 'Welcome to Mad Planner' })).toBeInTheDocument()
  })

  it('remembers dismissal for this account, can reopen, and welcomes a different account', () => {
    const view = show()
    fireEvent.click(screen.getByRole('button', { name: 'Close guide' }))
    expect(localStorage.getItem(guideStorageKey(account))).toBe('seen')
    view.unmount()
    const returning = show()
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Welcome guide' }))
    expect(screen.getByRole('heading', { name: 'Welcome to Mad Planner' })).toBeInTheDocument()
    returning.unmount()
    show({ ...account, id: 16 })
    expect(screen.getByRole('complementary')).toBeInTheDocument()
  })

  it.each(['owner', 'editor', 'planner', 'viewer'] as const)('finishes the guide and respects %s permissions', (role) => {
    show({ ...account, role })
    const titles: string[] = []
    while (screen.queryByRole('button', { name: 'Next tip' })) {
      titles.push(screen.getByRole('heading').textContent!)
      fireEvent.click(screen.getByRole('button', { name: 'Next tip' }))
    }
    expect(titles.includes('Bring your own recipes')).toBe(role === 'owner' || role === 'editor')
    fireEvent.click(screen.getByRole('button', { name: 'Finish guide' }))
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
    expect(localStorage.getItem(guideStorageKey(account))).toBe('seen')
  })

  it.each(['en', 'da', 'nl'] as const)('shows translated welcome and controls in %s', (locale) => {
    show({ ...account, locale })
    expect(screen.getByRole('heading', { name: guideCopy[locale].steps[0][0] })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: guideCopy[locale].next })).toBeInTheDocument()
    expect(guideCopy[locale].steps.map((step) => step[2])).toEqual(guideCopy.en.steps.map((step) => step[2]))
  })
})
