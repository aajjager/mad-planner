import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { HealthIndicator } from './components/HealthIndicator'
import { CreateRecipePage } from './pages/CreateRecipePage'
import { RecipeDetailPage } from './pages/RecipeDetailPage'
import { RecipeListPage } from './pages/RecipeListPage'

function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <header className="site-header">
          <Link className="brand" to="/recipes"><span className="brand-mark">M</span>Mad Planner</Link>
          <nav aria-label="Main navigation"><Link to="/recipes">Recipes</Link><Link className="primary-link" to="/recipes/new">Add recipe</Link></nav>
          <HealthIndicator />
        </header>
        <main>
          <Routes>
            <Route path="/" element={<Navigate to="/recipes" replace />} />
            <Route path="/recipes" element={<RecipeListPage />} />
            <Route path="/recipes/new" element={<CreateRecipePage />} />
            <Route path="/recipes/:recipeId" element={<RecipeDetailPage />} />
            <Route path="*" element={<Navigate to="/recipes" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
