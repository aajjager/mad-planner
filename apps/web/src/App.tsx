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

function ApplicationShell() {
  const { account, logout } = useAuth()
  return (
      <div className="app-shell">
        <header className="site-header">
          <Link className="brand" to="/recipes"><span className="brand-mark">M</span>Mad Planner</Link>
          <nav aria-label="Main navigation"><Link to="/recipes">Recipes</Link><Link to="/planner">Planner</Link><Link to="/grocery-list">Groceries</Link><Link to="/recipes/import">Import</Link><Link className="primary-link" to="/recipes/new">Add recipe</Link></nav>
          <div className="account-menu"><Link className="account-link" to="/family">{account?.display_name} · {account?.family_name}</Link><button className="text-button" onClick={() => void logout()}>Sign out</button></div>
        </header>
        <main>
          <Routes>
            <Route path="/" element={<Navigate to="/recipes" replace />} />
            <Route path="/recipes" element={<RecipeListPage />} />
            <Route path="/recipes/new" element={<CreateRecipePage />} />
            <Route path="/recipes/import" element={<ImportRecipePage />} />
            <Route path="/recipes/:recipeId" element={<RecipeDetailPage />} />
            <Route path="/planner" element={<PlannerPage />} />
            <Route path="/grocery-list" element={<GroceryListPage />} />
            <Route path="/family" element={<FamilyPage />} />
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
