import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getSharingPreferences, setHiddenFamily, type SharingPreferences, importPublicRecipe, listPublicRecipes, type Recipe } from '../api/recipes'
import { useAuth } from '../auth/AuthContext'
import { RecipeCardImage } from '../components/RecipeCardImage'
import { RecipeCollection } from '../components/RecipeCollection'
import { RecipeLibraryHeader } from '../components/RecipeLibraryHeader'
import { translator } from '../i18n'

export function PublicRecipesPage() {
  const { account } = useAuth()
  const locale = account?.locale
  const t = translator(locale)
  const canImport = account?.role === 'owner' || account?.role === 'editor'
  const [recipes, setRecipes] = useState<Recipe[] | null>(null)
  const [busy, setBusy] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [preferences, setPreferences] = useState<SharingPreferences | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    Promise.all([listPublicRecipes(), getSharingPreferences()]).then(([items, prefs]) => {
      if (active) { setRecipes(items); setPreferences(prefs) }
    }).catch(() => {
      if (active) setError(translator(locale)('recipesError'))
    })
    return () => { active = false }
  }, [locale])

  async function hideFamily(id: number, hidden: boolean) {
    setSaving(true)
    setMessage('')
    setError('')
    try {
      await setHiddenFamily(id, hidden)
      const [items, prefs] = await Promise.all([listPublicRecipes(), getSharingPreferences()])
      setRecipes(items)
      setPreferences(prefs)
    } catch {
      setError(t('settingsSaveFailed'))
    } finally {
      setSaving(false)
    }
  }

  async function importRecipe(id: number) {
    setBusy(id)
    setMessage('')
    setError('')
    try {
      await importPublicRecipe(id)
      setMessage(t('publicRecipeImported'))
    } catch {
      setError(t('publicRecipeImportFailed'))
    } finally {
      setBusy(null)
    }
  }

  const familyFilters = preferences && preferences.families.length > 0 && <details className="collection-community-filters">
    <summary>{t('communityPreferences')}</summary>
    <p>{t('hideFamiliesHelp')}</p>
    {preferences.families.map((family) => <label className="range-missing" key={family.id}>
      <input type="checkbox" checked={family.hidden} disabled={saving} onChange={(event) => void hideFamily(family.id, event.target.checked)} />
      {t('hideFamilyRecipes')} {family.name}
    </label>)}
  </details>

  return <section className="page recipe-library">
    <RecipeLibraryHeader />
    <p className="public-recipes-help">{t('publicRecipesHelp')}</p>
    {message && <p className="notice notice--success" role="status">{message}</p>}
    {error && <p className="notice notice--error" role="alert">{error}</p>}
    {recipes === null && !error && <p role="status">{t('loadingRecipes')}</p>}
    {recipes !== null && <RecipeCollection
      recipes={recipes} scope="public" extraFilters={familyFilters}
      empty={<div className="empty-state empty-state--compact"><h2>{t('noPublicRecipes')}</h2></div>}
      renderCard={(recipe, types, rememberPosition) => <article className="recipe-card public-recipe-card">
        <Link to={`/recipes/${recipe.id}`} state={{ fromPublicRecipes: true }} onClick={rememberPosition}>
          <RecipeCardImage recipe={recipe} />
          <div className="recipe-card__body">
            <h2>{recipe.name}</h2>
            <small>{t('sharedBy')} {recipe.owner_family_name}</small>
            {recipe.description && <p className="public-recipe-description">{recipe.description}</p>}
            {types.length > 0 && <div className="tag-list">{types.map((type) => <span className="tag" key={type}>{type}</span>)}</div>}
          </div>
        </Link>
        {canImport && !recipe.owned_by_current_family && <div className="recipe-card__body recipe-card__actions">
          <button className="button button--primary" disabled={busy !== null} onClick={() => void importRecipe(recipe.id)}>{t('importToFamily')}</button>
        </div>}
      </article>}
    />}
  </section>
}
