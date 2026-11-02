import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { UpdatesPage } from './UpdatesPage'
import { localizedReleases, releaseNoteSummary } from '../utils/releases'

const state = vi.hoisted(() => ({ locale: 'en' as 'en' | 'da' | 'nl' }))
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ account: { locale: state.locale } }) }))
afterEach(cleanup)

it.each(['en', 'da', 'nl'] as const)('expands and collapses complete weekly notes in %s independently', (locale) => {
  state.locale = locale
  const releases = localizedReleases(locale)
  render(<UpdatesPage />)
  const release = releases[0]
  const button = screen.getByRole('button', { name: `Mad Planner ${release.version}` })
  const article = button.closest('article')!
  const notes = release.groups.flatMap((group) => group.notes)
  expect(button).toHaveAttribute('aria-expanded', 'false')
  expect(within(article).getAllByRole('listitem').map((item) => item.textContent)).toEqual(notes.map((note) => releaseNoteSummary(note, locale)))
  expect(document.getElementById(button.getAttribute('aria-controls')!)).toBeInTheDocument()
  fireEvent.click(button)
  expect(button).toHaveAttribute('aria-expanded', 'true')
  expect(within(article).getAllByRole('listitem').map((item) => item.textContent)).toEqual(notes)
  expect(screen.getByRole('button', { name: `Mad Planner ${releases[1].version}` })).toHaveAttribute('aria-expanded', 'false')
  fireEvent.click(button)
  expect(button).toHaveAttribute('aria-expanded', 'false')
  expect(within(article).getAllByRole('listitem').map((item) => item.textContent)).toEqual(notes.map((note) => releaseNoteSummary(note, locale)))
})

it('keeps version numbers intact and handles single sentences and older browsers', () => {
  expect(releaseNoteSummary('Updated release 0.11.1 with clearer icons. More detail follows.')).toBe('Updated release 0.11.1 with clearer icons.')
  expect(releaseNoteSummary('One complete note.')).toBe('One complete note.')
  const original = Intl.Segmenter
  try {
    Object.defineProperty(Intl, 'Segmenter', { value: undefined, configurable: true })
    expect(releaseNoteSummary('Fixed version 0.11.1. Details follow.')).toBe('Fixed version 0.11.1.')
  } finally { Object.defineProperty(Intl, 'Segmenter', { value: original, configurable: true }) }
})
