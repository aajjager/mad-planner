import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listRecipes, type Recipe } from '../api/recipes'

export function RecipeListPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [search, setSearch] = useState('')
  const [tag, setTag] = useState('')
  useEffect(() => { listRecipes().then((items) => { setRecipes(items); setState('ready') }).catch(() => setState('error')) }, [])
  const tags = useMemo(() => [...new Set(recipes.flatMap((recipe) => recipe.tags))].sort((a, b) => a.localeCompare(b)), [recipes])
  const filteredRecipes = useMemo(() => { const query = search.trim().toLocaleLowerCase(); return recipes.filter((recipe) => (!tag || recipe.tags.includes(tag)) && (!query || [recipe.name, recipe.description, recipe.category, recipe.cuisine, ...recipe.tags].some((value) => value?.toLocaleLowerCase().includes(query)))) }, [recipes, search, tag])
  return <section className="page">
    <div className="page-heading"><div><p className="eyebrow">Recipe collection</p><h1>Your recipes</h1><p>Keep every favorite organized and ready for the weekly plan.</p></div><div className="heading-actions"><Link className="button" to="/recipes/import">Import from URL</Link><Link className="button button--primary" to="/recipes/new">Add a recipe</Link></div></div>
    {state === 'loading' && <p className="notice" role="status">Loading recipes…</p>}
    {state === 'error' && <p className="notice notice--error" role="alert">Recipes could not be loaded. Check that the API is running.</p>}
    {state === 'ready' && recipes.length === 0 && <div className="empty-state"><span>✦</span><h2>Your collection is ready</h2><p>Add your first recipe manually. Website importing comes in the next phase.</p><Link className="button button--primary" to="/recipes/new">Create first recipe</Link></div>}
    {recipes.length > 0 && <div className="library-tools"><label className="field"><span>Search recipes</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, cuisine, category, or tag" /></label><label className="field"><span>Filter by tag</span><select value={tag} onChange={(event) => setTag(event.target.value)}><option value="">All tags</option>{tags.map((item) => <option key={item}>{item}</option>)}</select></label><span className="result-count">{filteredRecipes.length} {filteredRecipes.length === 1 ? 'recipe' : 'recipes'}</span></div>}
    {recipes.length > 0 && filteredRecipes.length === 0 && <div className="empty-state empty-state--compact"><h2>No matching recipes</h2><p>Try another search or tag.</p><button className="button" onClick={() => { setSearch(''); setTag('') }}>Clear filters</button></div>}
    {filteredRecipes.length > 0 && <div className="recipe-grid">{filteredRecipes.map((recipe) => <Link className="recipe-card" to={`/recipes/${recipe.id}`} key={recipe.id}><div className="recipe-card__image">{recipe.image_url ? <img src={recipe.image_url} alt="" /> : <span>M</span>}</div><div className="recipe-card__body"><div className="recipe-meta">{recipe.category && <span>{recipe.category}</span>}{recipe.total_time_minutes !== null && <span>{recipe.total_time_minutes} min</span>}</div><h2>{recipe.name}</h2><p>{recipe.description || 'Open to see ingredients and instructions.'}</p>{recipe.tags.length > 0 && <div className="tag-list">{recipe.tags.slice(0, 3).map((item) => <span className="tag" key={item}>{item}</span>)}</div>}</div></Link>)}</div>}
  </section>
}
