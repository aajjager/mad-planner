import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listRecipes, type Recipe } from '../api/recipes'
import { useAuth } from '../auth/AuthContext'
import { translator } from '../i18n'

export function RecipeListPage() {
  const { account } = useAuth(); const t = translator(account?.locale)
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [search, setSearch] = useState('')
  const [tag, setTag] = useState('')
  useEffect(() => { listRecipes().then((items) => { setRecipes(items); setState('ready') }).catch(() => setState('error')) }, [])
  const tags = useMemo(() => [...new Set(recipes.flatMap((recipe) => recipe.tags))].sort((a, b) => a.localeCompare(b)), [recipes])
  const filteredRecipes = useMemo(() => { const query = search.trim().toLocaleLowerCase(); return recipes.filter((recipe) => (!tag || recipe.tags.includes(tag)) && (!query || [recipe.name, recipe.description, recipe.category, recipe.cuisine, ...recipe.tags].some((value) => value?.toLocaleLowerCase().includes(query)))) }, [recipes, search, tag])
  return <section className="page">
    <div className="page-heading"><div><p className="eyebrow">{t('collection')}</p><h1>{t('yourRecipes')}</h1><p>{t('recipeIntro')}</p></div><div className="heading-actions"><Link className="button" to="/recipes/scan">{t('scanBook')}</Link><Link className="button" to="/recipes/import">{t('importUrl')}</Link><Link className="button button--primary" to="/recipes/new">{t('addRecipe')}</Link></div></div>
    {state === 'loading' && <p className="notice" role="status">{t('loadingRecipes')}</p>}
    {state === 'error' && <p className="notice notice--error" role="alert">{t('recipesError')}</p>}
    {state === 'ready' && recipes.length === 0 && <div className="empty-state"><span>✦</span><h2>{t('collectionReady')}</h2><p>{t('firstRecipe')}</p><Link className="button button--primary" to="/recipes/new">{t('createFirst')}</Link></div>}
    {recipes.length > 0 && <div className="library-tools"><label className="field"><span>{t('searchRecipes')}</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('searchPlaceholder')} /></label><label className="field"><span>{t('filterTag')}</span><select value={tag} onChange={(event) => setTag(event.target.value)}><option value="">{t('allTags')}</option>{tags.map((item) => <option key={item}>{item}</option>)}</select></label><span className="result-count">{filteredRecipes.length} {filteredRecipes.length === 1 ? t('recipe') : t('recipePlural')}</span></div>}
    {recipes.length > 0 && filteredRecipes.length === 0 && <div className="empty-state empty-state--compact"><h2>{t('noMatches')}</h2><p>{t('noMatchesHelp')}</p><button className="button" onClick={() => { setSearch(''); setTag('') }}>{t('clearFilters')}</button></div>}
    {filteredRecipes.length > 0 && <div className="recipe-grid">{filteredRecipes.map((recipe) => <Link className="recipe-card" to={`/recipes/${recipe.id}`} key={recipe.id}><div className="recipe-card__image">{recipe.image_url ? <img src={recipe.image_url} alt="" /> : <span>M</span>}</div><div className="recipe-card__body"><div className="recipe-meta">{recipe.category && <span>{recipe.category}</span>}{recipe.total_time_minutes !== null && <span>{recipe.total_time_minutes} min</span>}</div><h2>{recipe.name}</h2><p>{recipe.description || 'Open to see ingredients and instructions.'}</p>{recipe.tags.length > 0 && <div className="tag-list">{recipe.tags.slice(0, 3).map((item) => <span className="tag" key={item}>{item}</span>)}</div>}</div></Link>)}</div>}
  </section>
}
