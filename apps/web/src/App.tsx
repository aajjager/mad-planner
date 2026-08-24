import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
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
import { translator } from './i18n'

function ApplicationShell() {
  const { account, logout } = useAuth()
  const canEditRecipes = account?.role === 'owner' || account?.role === 'editor'
  const t = translator(account?.locale)
  return (
      <div className="app-shell">
        <header className="site-header">
          <Link className="brand" to="/recipes"><span className="brand-mark">M</span>Mad Planner</Link>
          <nav aria-label="Main navigation"><Link to="/recipes">{t('recipes')}</Link><Link to="/planner">{t('planner')}</Link><Link to="/grocery-list">{t('groceries')}</Link>{canEditRecipes && <Link to="/recipes/import">{t('import')}</Link>}{canEditRecipes && <Link className="primary-link" to="/recipes/new">{t('addRecipe')}</Link>}</nav>
          <div className="account-menu"><Link className="account-link" to="/family">{account?.display_name} · {account?.family_name}</Link>{account?.role === 'owner' && <Link className="account-link" to="/admin">{t('admin')}</Link>}<button className="text-button" onClick={() => void logout()}>{t('signOut')}</button></div>
        </header>
        <main>
          <Routes>
            <Route path="/" element={<Navigate to="/recipes" replace />} />
            <Route path="/recipes" element={<RecipeListPage />} />
            <Route path="/recipes/new" element={canEditRecipes ? <CreateRecipePage /> : <Navigate to="/recipes" replace />} />
            <Route path="/recipes/import" element={canEditRecipes ? <ImportRecipePage /> : <Navigate to="/recipes" replace />} />
            <Route path="/recipes/scan" element={canEditRecipes ? <ScanRecipePage /> : <Navigate to="/recipes" replace />} />
            <Route path="/recipes/:recipeId" element={<RecipeDetailPage />} />
            <Route path="/planner" element={<PlannerPage />} />
            <Route path="/grocery-list" element={<GroceryListPage />} />
            <Route path="/family" element={<FamilyPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="*" element={<Navigate to="/recipes" replace />} />
          </Routes>
        </main>
      </div>
  )
}

function AuthenticatedRoutes() {
  const { account, loading } = useAuth()
  if (loading) return <div className="account-shell"><div className="notice">Opening Mad Planner…</div></div>
  if (!account) return <AccountAccessPage />
  return <ApplicationShell />
}

function App() {
  return <BrowserRouter><AuthProvider><Routes><Route path="/invite/:token" element={<InvitationPage />} /><Route path="*" element={<AuthenticatedRoutes />} /></Routes></AuthProvider></BrowserRouter>
}

export default App
