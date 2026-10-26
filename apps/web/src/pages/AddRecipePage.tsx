import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { translator } from '../i18n'

export function AddRecipePage() {
  const { account } = useAuth()
  const t = translator(account?.locale)
  const methods = [
    ['/recipes/import', 'importUrl', 'addUrlHelp'],
    ['/recipes/new', 'manualRecipe', 'addManualHelp'],
    ['/recipes/scan', 'scanBook', 'addScanHelp'],
    ['/recipes/import/cookbook', 'importCookBook', 'addCookBookHelp'],
  ] as const
  return <section className="page add-recipe-page">
    <Link className="back-link" to="/recipes">← {t('allRecipes')}</Link>
    <div className="page-heading"><div><p className="eyebrow">{t('addRecipe')}</p><h1>{t('addRecipeChoice')}</h1><p>{t('addRecipeChoiceHelp')}</p></div></div>
    <nav className="recipe-methods" aria-label={t('addRecipe')}>
      {methods.map(([path, title, help]) => <Link className="recipe-method" to={path} key={path}><strong>{t(title)}</strong><span>{t(help)}</span></Link>)}
    </nav>
  </section>
}
