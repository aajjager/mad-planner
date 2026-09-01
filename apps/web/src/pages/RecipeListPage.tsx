import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listRecipes, type Recipe } from '../api/recipes'
import { useAuth } from '../auth/AuthContext'
import { translator } from '../i18n'
import { RatingStars } from '../components/RatingStars'

export function RecipeListPage() {
  const { account } = useAuth(); const t = translator(account?.locale)
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [search, setSearch] = useState('')
  const [tag, setTag] = useState('')
  const [cuisine, setCuisine] = useState('')
  const [recipeType, setRecipeType] = useState('')
  const [sort, setSort] = useState<'name' | 'rating'>('name')
  useEffect(() => { listRecipes().then((items) => { setRecipes(items); setState('ready') }).catch(() => setState('error')) }, [])
  const tags = useMemo(() => [...new Set(recipes.flatMap((recipe) => recipe.tags))].sort((a, b) => a.localeCompare(b)), [recipes])
  const cuisines = useMemo(() => [...new Set(recipes.map((recipe) => recipe.cuisine).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b)), [recipes])
  const recipeTypes = useMemo(() => [...new Set(recipes.flatMap((recipe) => recipe.recipe_types || []))].sort((a, b) => a.localeCompare(b)), [recipes])
  const filteredRecipes = useMemo(() => { const query = search.trim().toLocaleLowerCase(); return recipes.filter((recipe) => (!tag || recipe.tags.includes(tag)) && (!cuisine || recipe.cuisine === cuisine) && (!recipeType || (recipe.recipe_types || []).includes(recipeType)) && (!query || [recipe.name, recipe.description, recipe.category, recipe.cuisine, ...recipe.tags, ...(recipe.recipe_types || [])].some((value) => value?.toLocaleLowerCase().includes(query)))).sort((a, b) => sort === 'rating' ? (b.family_rating || 0) - (a.family_rating || 0) || a.name.localeCompare(b.name) : a.name.localeCompare(b.name)) }, [recipes, search, tag, cuisine, recipeType, sort])
  return <section className="page">
    <div className="page-heading"><div><p className="eyebrow">{t('collection')}</p><h1>{t('yourRecipes')}</h1><p>{t('recipeIntro')}</p></div><div className="heading-actions"><Link className="button" to="/recipes/scan">{t('scanBook')}</Link><Link className="button" to="/recipes/import">{t('importUrl')}</Link><Link className="button button--primary" to="/recipes/new">{t('addRecipe')}</Link></div></div>
    {state === 'loading' && <p className="notice" role="status">{t('loadingRecipes')}</p>}
    {state === 'error' && <p className="notice notice--error" role="alert">{t('recipesError')}</p>}
    {state === 'ready' && recipes.length === 0 && <div className="empty-state"><span>✦</span><h2>{t('collectionReady')}</h2><p>{t('firstRecipe')}</p><Link className="button button--primary" to="/recipes/new">{t('createFirst')}</Link></div>}
    {recipes.length > 0 && <div className="library-tools"><label className="field"><span>{t('searchRecipes')}</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('searchPlaceholder')} /></label><label className="field"><span>{t('filterTag')}</span><select value={tag} onChange={(event) => setTag(event.target.value)}><option value="">{t('allTags')}</option>{tags.map((item) => <option key={item}>{item}</option>)}</select></label><label className="field"><span>{t('cuisineFilter')}</span><select value={cuisine} onChange={(event) => setCuisine(event.target.value)}><option value="">{t('allCuisines')}</option>{cuisines.map((item) => <option key={item}>{item}</option>)}</select></label><label className="field"><span>{t('recipeTypeFilter')}</span><select value={recipeType} onChange={(event) => setRecipeType(event.target.value)}><option value="">{t('allRecipeTypes')}</option>{recipeTypes.map((item) => <option key={item}>{item}</option>)}</select></label><label className="field"><span>{t('sortRecipes')}</span><select value={sort} onChange={(event) => setSort(event.target.value as 'name' | 'rating')}><option value="name">{t('nameSort')}</option><option value="rating">{t('ratingHigh')}</option></select></label><span className="result-count">{filteredRecipes.length} {filteredRecipes.length === 1 ? t('recipe') : t('recipePlural')}</span></div>}
    {recipes.length > 0 && filteredRecipes.length === 0 && <div className="empty-state empty-state--compact"><h2>{t('noMatches')}</h2><p>{t('noMatchesHelp')}</p><button className="button" onClick={() => { setSearch(''); setTag(''); setCuisine(''); setRecipeType('') }}>{t('clearFilters')}</button></div>}
    {filteredRecipes.length > 0 && <div className="recipe-grid">{filteredRecipes.map((recipe) => <Link className="recipe-card" to={`/recipes/${recipe.id}`} key={recipe.id}><div className="recipe-card__image">{recipe.image_url ? <img src={recipe.image_url} alt="" /> : <span>M</span>}</div><div className="recipe-card__body"><div className="recipe-meta">{recipe.category && <span>{recipe.category}</span>}{recipe.total_time_minutes !== null && <span>{recipe.total_time_minutes} min</span>}</div><h2>{recipe.name}</h2>{recipe.family_rating != null && <RatingStars value={null} average={recipe.family_rating} count={recipe.rating_count} label={t('familyRating')} />}<p>{recipe.description || 'Open to see ingredients and instructions.'}</p>{recipe.tags.length > 0 && <div className="tag-list">{recipe.tags.slice(0, 3).map((item) => <span className="tag" key={item}>{item}</span>)}</div>}</div></Link>)}</div>}
  </section>
}
