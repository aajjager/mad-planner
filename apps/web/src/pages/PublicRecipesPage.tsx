import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getSharingPreferences, setAlwaysShare, setHiddenFamily, type SharingPreferences, importPublicRecipe, listPublicRecipes, type Recipe } from '../api/recipes'
import { useAuth } from '../auth/AuthContext'
import { translator } from '../i18n'

export function PublicRecipesPage() {
  const { account } = useAuth(); const t = translator(account?.locale)
  const [recipes, setRecipes] = useState<Recipe[]>([]); const [search, setSearch] = useState(''); const [busy, setBusy] = useState<number | null>(null); const [message, setMessage] = useState('')
  const [preferences, setPreferences] = useState<SharingPreferences | null>(null)
  const [saving, setSaving] = useState(false)
  async function refresh() { const [items, prefs] = await Promise.all([listPublicRecipes(), getSharingPreferences()]); setRecipes(items); setPreferences(prefs) }
  async function change(action: () => Promise<unknown>) { setSaving(true); setMessage(''); try { await action(); await refresh() } catch { setMessage(t('settingsSaveFailed')) } finally { setSaving(false) } }
  const locale = account?.locale
  useEffect(() => {
    let active = true
    Promise.all([listPublicRecipes(), getSharingPreferences()]).then(([items, prefs]) => { if (active) { setRecipes(items); setPreferences(prefs) } }).catch(() => { if (active) setMessage(translator(locale)('recipesError')) })
    return () => { active = false }
  }, [locale])
  const visible = recipes.filter((recipe) => [recipe.name, recipe.cuisine, recipe.category, ...recipe.tags].some((value) => value?.toLocaleLowerCase().includes(search.toLocaleLowerCase())))
  async function importRecipe(recipe: Recipe) { setBusy(recipe.id); setMessage(''); try { await importPublicRecipe(recipe.id); setMessage(t('publicRecipeImported')) } finally { setBusy(null) } }
  return <section className="page"><div className="page-heading"><div><p className="eyebrow">{t('communityLibrary')}</p><h1>{t('publicRecipes')}</h1><p>{t('publicRecipesHelp')}</p></div><Link className="button" to="/recipes">{t('yourRecipes')}</Link></div>{preferences && <details className="recipe-sharing"><summary>{t('communityPreferences')}</summary>{account?.role === 'owner' && <label className="setting-toggle"><input type="checkbox" checked={preferences.always_share} disabled={saving} onChange={(event) => void change(() => setAlwaysShare(event.target.checked))} /><span>{t('alwaysShareRecipes')}</span></label>}<p>{t('alwaysShareHelp')}</p><p>{t('hideFamiliesHelp')}</p>{preferences.families.map((family) => <label className="setting-toggle" key={family.id}><input type="checkbox" checked={family.hidden} disabled={saving} onChange={(event) => void change(() => setHiddenFamily(family.id, event.target.checked))} /><span>{t('hideFamilyRecipes')} {family.name}</span></label>)}</details>}<label className="field"><span>{t('searchRecipes')}</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></label>{message && <p className="notice notice--success">{message}</p>}<div className="recipe-grid">{visible.map((recipe) => <article className="recipe-card" key={recipe.id}><Link to={`/recipes/${recipe.id}`}><div className="recipe-card__image">{recipe.image_url ? <img src={recipe.image_url} alt="" /> : <span>M</span>}</div><div className="recipe-card__body"><h2>{recipe.name}</h2><p>{recipe.description || t('openRecipe')}</p><small>{t('sharedBy')} {recipe.owner_family_name}</small></div></Link><div className="recipe-card__body"><button className="button button--primary" disabled={busy === recipe.id} onClick={() => void importRecipe(recipe)}>{t('importToFamily')}</button></div></article>)}</div>{visible.length === 0 && <div className="empty-state empty-state--compact"><h2>{t('noPublicRecipes')}</h2></div>}</section>
}
