import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { deleteRecipe, getRecipe, type Recipe } from '../api/recipes'
import './RecipeDetailPage.css'

export function RecipeDetailPage() {
  const { recipeId } = useParams(); const navigate = useNavigate()
  const [recipe, setRecipe] = useState<Recipe | null>(null); const [error, setError] = useState(false)
  useEffect(() => { getRecipe(Number(recipeId)).then(setRecipe).catch(() => setError(true)) }, [recipeId])
  async function handleDelete() { if (recipe && window.confirm(`Delete “${recipe.name}”?`)) { await deleteRecipe(recipe.id); navigate('/recipes') } }
  if (error) return <section className="page"><p className="notice notice--error">Recipe not found.</p><Link to="/recipes">Back to recipes</Link></section>
  if (!recipe) return <section className="page"><p className="notice">Loading recipe…</p></section>
  return <article className="page recipe-detail">
    <Link className="back-link" to="/recipes">← All recipes</Link>
    {recipe.image_url && <div className="detail-image"><img src={recipe.image_url} alt={recipe.name} /></div>}
    <div className="detail-heading"><div><p className="eyebrow">{recipe.category || 'Recipe'}</p><h1>{recipe.name}</h1>{recipe.description && <p>{recipe.description}</p>}</div><button className="button button--danger" onClick={handleDelete}>Delete</button></div>
    <dl className="recipe-facts">{recipe.servings && <div><dt>Servings</dt><dd>{recipe.servings}</dd></div>}{recipe.preparation_time_minutes !== null && <div><dt>Preparation</dt><dd>{recipe.preparation_time_minutes} min</dd></div>}{recipe.cooking_time_minutes !== null && <div><dt>Cooking</dt><dd>{recipe.cooking_time_minutes} min</dd></div>}{recipe.cuisine && <div><dt>Cuisine</dt><dd>{recipe.cuisine}</dd></div>}</dl>
    <div className="recipe-columns"><section><h2>Ingredients</h2>{recipe.ingredients.length ? <ul className="ingredient-list">{recipe.ingredients.map((item) => <li key={item.id}>{item.raw_text}</li>)}</ul> : <p className="muted">No ingredients added.</p>}</section><section><h2>Instructions</h2>{recipe.instructions.length ? <ol className="instruction-list">{recipe.instructions.map((step) => <li key={step.id}><span>{step.position}</span><p>{step.text}</p></li>)}</ol> : <p className="muted">No instructions added.</p>}</section></div>
    {recipe.source_url && <a className="source-link" href={recipe.source_url} target="_blank" rel="noreferrer">View original recipe ↗</a>}
  </article>
}
