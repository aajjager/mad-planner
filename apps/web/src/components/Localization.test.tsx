import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RangeFilter } from './RangeFilter'
import { RatingStars } from './RatingStars'
import { BackupPanel } from './BackupPanel'
import { RecipeListPage } from '../pages/RecipeListPage'
import { UpdatesPage } from '../pages/UpdatesPage'
import { MemoryRouter } from 'react-router-dom'
import { guideCopy } from './welcomeGuideContent'
import { translator } from '../i18n'

const state = vi.hoisted(() => ({ locale: 'da' as 'da' | 'nl' }))
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ account: { locale: state.locale, role: 'viewer' } }) }))
vi.mock('../api/recipes', () => ({ listRecipes: () => Promise.resolve([{ id: 1, name: 'Original family recipe', tags: [], recipe_types: [], owned_by_current_family: true, description: '', nutrition: null }]) }))
afterEach(cleanup)

describe('account language', () => {
  it.each(['da', 'nl'] as const)('renders filters, ratings, backups and release history in %s', async (locale) => {
    state.locale = locale
    const t = translator(locale)
    const view = render(<MemoryRouter><RecipeListPage /><RangeFilter label={t('ratingRange')} minimum={0} maximum={5} low={0} high={5} step={0.5} suffix="★" onChange={() => {}} /><RatingStars value={2} average={2} count={2} label={t('yourRating')} onChange={() => {}} /><BackupPanel reportError={() => {}} /><UpdatesPage /></MemoryRouter>)
    expect(await screen.findByText('Original family recipe')).toBeInTheDocument()
    for (const label of ['sortRecipes', 'cuisineFilter', 'recipeTypeFilter'] as const) expect(screen.getByLabelText(t(label))).toBeInTheDocument()
    expect(screen.queryByText('Sort recipes')).not.toBeInTheDocument()
    expect(screen.queryByText('Family rating')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: `2 ${t('starsLabel')}` })).toBeInTheDocument()
    expect(screen.getAllByRole('slider', { name: `${t('ratingRange')} ${t('maximumLabel')}` })).toHaveLength(2)
    expect(screen.getByRole('button', { name: t('downloadDatabase') })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { name: locale === 'da' ? 'Fejlrettelser' : 'Opgeloste fouten' }).length).toBeGreaterThan(0)
    expect(screen.queryByText('October 2026, week 4')).not.toBeInTheDocument()
    expect(view.container.textContent).toContain(locale === 'da' ? 'oktober 2026, uge 4' : 'oktober 2026, week 4')
    const personalTip = guideCopy[locale].steps.find((step) => step[2] === '/family#personal-settings')![1]
    expect(personalTip).toContain(locale === 'da' ? 'kontoens sprog' : 'accounttaal')
  })
})
