import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listRecipes, type Recipe } from '../api/recipes'

export function RecipeListPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  useEffect(() => { listRecipes().then((items) => { setRecipes(items); setState('ready') }).catch(() => setState('error')) }, [])
  return <section className="page">
    <div className="page-heading"><div><p className="eyebrow">Recipe collection</p><h1>Your recipes</h1><p>Keep every favorite organized and ready for the weekly plan.</p></div><Link className="button button--primary" to="/recipes/new">Add a recipe</Link></div>
    {state === 'loading' && <p className="notice" role="status">Loading recipes…</p>}
    {state === 'error' && <p className="notice notice--error" role="alert">Recipes could not be loaded. Check that the API is running.</p>}
    {state === 'ready' && recipes.length === 0 && <div className="empty-state"><span>✦</span><h2>Your collection is ready</h2><p>Add your first recipe manually. Website importing comes in the next phase.</p><Link className="button button--primary" to="/recipes/new">Create first recipe</Link></div>}
    {recipes.length > 0 && <div className="recipe-grid">{recipes.map((recipe) => <Link className="recipe-card" to={`/recipes/${recipe.id}`} key={recipe.id}><div className="recipe-card__image">{recipe.image_url ? <img src={recipe.image_url} alt="" /> : <span>M</span>}</div><div className="recipe-card__body"><div className="recipe-meta">{recipe.category && <span>{recipe.category}</span>}{recipe.total_time_minutes !== null && <span>{recipe.total_time_minutes} min</span>}</div><h2>{recipe.name}</h2><p>{recipe.description || 'Open to see ingredients and instructions.'}</p></div></Link>)}</div>}
  </section>
}
