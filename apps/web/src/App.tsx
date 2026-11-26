import { useState } from 'react'
import { BrowserRouter, Link, NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import './App.css'
import { AppIcon } from './components/AppIcon'
import { EditRecipePage } from './pages/EditRecipePage'
import { PreviewBanner } from './components/PreviewBanner'
import { AddRecipePage } from './pages/AddRecipePage'
import { CreateRecipePage } from './pages/CreateRecipePage'
import { RecipeDetailPage } from './pages/RecipeDetailPage'
import { RecipeListPage } from './pages/RecipeListPage'
import { ImportRecipePage } from './pages/ImportRecipePage'
import { PlannerPage } from './pages/PlannerPage'
import { GroceryListPage } from './pages/GroceryListPage'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { AccountAccessPage } from './pages/AccountAccessPage'
import { FamilyPage } from './pages/FamilyPage'
import { InvitationPage } from './pages/InvitationPage'
import { AdminPage } from './pages/AdminPage'
import { ScanRecipePage } from './pages/ScanRecipePage'
import { PasswordResetPage } from './pages/PasswordResetPage'
import { CookBookImportPage } from './pages/CookBookImportPage'
import { UpdatesPage } from './pages/UpdatesPage'
import { PublicRecipesPage } from './pages/PublicRecipesPage'
import { rememberedLocale, translator } from './i18n'
import { PlanReminderBanner } from './components/PlanReminderBanner'
import { FeedbackAnswerBadge } from './components/FeedbackAnswerBadge'
import { BrandMark } from './components/BrandMark'
import { FeedbackCompletionNotifier } from './components/FeedbackCompletionNotifier'
import { RecipeBrowseMemory } from './components/RecipeBrowseMemory'
import { WelcomeGuide } from './components/WelcomeGuide'
import { familyGuidePath, type WelcomeGuideStart } from './components/welcomeGuideContent'

function ApplicationShell() {
  const { account, logout } = useAuth()
  const navigate = useNavigate()
  const [guide, setGuide] = useState<{ startAt: WelcomeGuideStart; run: number } | null>(null)
  const canEditRecipes = account?.role === 'owner' || account?.role === 'editor'
  const t = translator(account?.locale)

  function openGuide(startAt: WelcomeGuideStart) {
    setGuide((current) => ({ startAt, run: (current?.run ?? 0) + 1 }))
    if (startAt === 'family') navigate(familyGuidePath)
  }
  return (
      <div className="app-shell">
        <header className="site-header">
          <Link className="brand" to="/recipes"><BrandMark /><span>Mad Planner</span></Link>
          <nav aria-label={t('mainNavigation')}><Link to="/recipes">{t('recipes')}</Link><Link to="/planner">{t('planner')}</Link><Link to="/grocery-list">{t('groceries')}</Link></nav>
          <div className="account-menu">
            <Link className="account-link" to="/family">{account?.display_name} · {account?.family_name}<FeedbackAnswerBadge /></Link>
            {account?.role === 'owner' && <Link className="account-link" to="/admin">{t('admin')}</Link>}
            {canEditRecipes && <Link className="header-add-recipe" to="/recipes/add" aria-label={t('addRecipe')} title={t('addRecipe')}>
              <AppIcon name="plus" />
            </Link>}
            <button className="text-button" onClick={() => void logout()}>{t('signOut')}</button>
          </div>
        </header>
        <PlanReminderBanner />
        <PreviewBanner />
        <FeedbackCompletionNotifier />
        {account && guide && <WelcomeGuide key={guide.run} account={account} startAt={guide.startAt} onClose={() => setGuide(null)} />}
        <main>
          <Routes>
            <Route path="/" element={<Navigate to="/recipes" replace />} />
            <Route path="/recipes" element={<RecipeListPage />} />
            <Route path="/recipes/add" element={canEditRecipes ? <AddRecipePage /> : <Navigate to="/recipes" replace />} />
            <Route path="/recipes/new" element={canEditRecipes ? <CreateRecipePage /> : <Navigate to="/recipes" replace />} />
            <Route path="/recipes/import" element={canEditRecipes ? <ImportRecipePage /> : <Navigate to="/recipes" replace />} />
            <Route path="/recipes/import/cookbook" element={canEditRecipes ? <CookBookImportPage /> : <Navigate to="/recipes" replace />} />
            <Route path="/recipes/scan" element={canEditRecipes ? <ScanRecipePage /> : <Navigate to="/recipes" replace />} />
            <Route path="/recipes/:recipeId/edit" element={canEditRecipes ? <EditRecipePage /> : <Navigate to="/recipes" replace />} />
            <Route path="/recipes/:recipeId" element={<RecipeDetailPage />} />
            <Route path="/recipes/public" element={<PublicRecipesPage />} />
            <Route path="/planner" element={<PlannerPage />} />
            <Route path="/grocery-list" element={<GroceryListPage />} />
            <Route path="/family" element={<FamilyPage onOpenGuide={openGuide} />} />
            <Route path="/updates" element={<UpdatesPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="*" element={<Navigate to="/recipes" replace />} />
          </Routes>
        </main>
        <nav className="mobile-navigation" aria-label={t('mobileNavigation')}>
          <NavLink to="/planner"><AppIcon name="planner" />{t('planner')}</NavLink>
          <NavLink to="/grocery-list"><AppIcon name="groceries" />{t('groceries')}</NavLink>
          <NavLink className="mobile-navigation__recipes" to="/recipes"><AppIcon name="recipes" />{t('recipes')}</NavLink>
          {account?.role === 'owner' ? <>
            <NavLink to="/family"><AppIcon name="family" />{t('familyNav')}<FeedbackAnswerBadge /></NavLink>
            <NavLink to="/admin"><AppIcon name="settings" />{t('admin')}</NavLink>
          </> : <>
            <NavLink to="/updates"><AppIcon name="updates" />{t('updates')}</NavLink>
            <NavLink to="/family"><AppIcon name="family" />{t('familyNav')}<FeedbackAnswerBadge /></NavLink>
          </>}
        </nav>
      </div>
  )
}

function AuthenticatedRoutes() {
  const { account, loading } = useAuth()
  if (loading) return <div className="account-shell"><div className="notice">{translator(rememberedLocale())('openingApp')}</div></div>
  if (!account) return <AccountAccessPage />
  return <RecipeBrowseMemory key={`${account.family_id}:${account.id}`}><ApplicationShell /></RecipeBrowseMemory>
}

function App() {
  return <BrowserRouter><AuthProvider><Routes><Route path="/invite/:token" element={<InvitationPage />} /><Route path="/password-reset/:token" element={<PasswordResetPage />} /><Route path="*" element={<AuthenticatedRoutes />} /></Routes></AuthProvider></BrowserRouter>
}

export default App
