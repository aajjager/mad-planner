import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { translator } from '../i18n'

export function RecipeLibraryHeader() {
  const { account } = useAuth()
  const t = translator(account?.locale)
  return <div className="recipe-library-header">
    <h1>{t('recipes')}</h1>
    <nav className="recipe-library-tabs" aria-label={t('recipeCollections')}>
      <NavLink to="/recipes" end>{t('yourRecipes')}</NavLink>
      <NavLink to="/recipes/public" end>{t('publicRecipes')}</NavLink>
    </nav>
  </div>
}
