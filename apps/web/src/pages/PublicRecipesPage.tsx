import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getSharingPreferences, setHiddenFamily, type SharingPreferences, importPublicRecipe, listPublicRecipes, type Recipe } from '../api/recipes'
import { useAuth } from '../auth/AuthContext'
import { RecipeCardImage } from '../components/RecipeCardImage'
import { RecipeLibraryHeader } from '../components/RecipeLibraryHeader'
import { translator } from '../i18n'

export function PublicRecipesPage() {
  const { account } = useAuth()
  const locale = account?.locale
  const t = translator(locale)
  const canImport = account?.role === 'owner' || account?.role === 'editor'
  const [recipes, setRecipes] = useState<Recipe[] | null>(null)
  const [search, setSearch] = useState('')
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

  const query = search.trim().toLocaleLowerCase()
  const visible = recipes?.filter((recipe) => [
    recipe.name, recipe.owner_family_name, recipe.cuisine, recipe.category, ...recipe.tags, ...recipe.recipe_types,
  ].some((value) => value?.toLocaleLowerCase().includes(query))) ?? []

  return <section className="page recipe-library">
    <RecipeLibraryHeader />
    <p className="public-recipes-help">{t('publicRecipesHelp')}</p>
    <label className="field">
      <span>{t('searchRecipes')}</span>
      <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
    </label>
    {preferences && preferences.families.length > 0 && <details className="recipe-sharing">
      <summary>{t('communityPreferences')}</summary>
      <p>{t('hideFamiliesHelp')}</p>
      {preferences.families.map((family) => <label className="setting-toggle" key={family.id}>
        <input type="checkbox" checked={family.hidden} disabled={saving} onChange={(event) => void hideFamily(family.id, event.target.checked)} />
        <span>{t('hideFamilyRecipes')} {family.name}</span>
      </label>)}
    </details>}
    {message && <p className="notice notice--success" role="status">{message}</p>}
    {error && <p className="notice notice--error" role="alert">{error}</p>}
    {recipes === null && !error && <p role="status">{t('loadingRecipes')}</p>}
    <div className="recipe-grid">
      {visible.map((recipe) => <article className="recipe-card" key={recipe.id}>
        <Link to={`/recipes/${recipe.id}`}>
          <RecipeCardImage recipe={recipe} />
          <div className="recipe-card__body"><h2>{recipe.name}</h2><p>{recipe.description || t('openRecipe')}</p><small>{t('sharedBy')} {recipe.owner_family_name}</small></div>
        </Link>
        {canImport && !recipe.owned_by_current_family && <div className="recipe-card__body">
          <button className="button button--primary" disabled={busy !== null} onClick={() => void importRecipe(recipe.id)}>{t('importToFamily')}</button>
        </div>}
      </article>)}
    </div>
    {recipes !== null && visible.length === 0 && <div className="empty-state empty-state--compact">
      <h2>{t(query ? 'noMatches' : 'noPublicRecipes')}</h2>
    </div>}
  </section>
}
