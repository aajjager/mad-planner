import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { deleteRecipe, getRecipe, updateRecipeMealTypes, type Recipe, type RecipeMealType } from '../api/recipes'
import './RecipeDetailPage.css'
import { useAuth } from '../auth/AuthContext'

export function RecipeDetailPage() {
  const { account } = useAuth(); const canEdit = account?.role === 'owner' || account?.role === 'editor'
  const { recipeId } = useParams(); const navigate = useNavigate()
  const [recipe, setRecipe] = useState<Recipe | null>(null); const [error, setError] = useState(false)
  useEffect(() => { getRecipe(Number(recipeId)).then(setRecipe).catch(() => setError(true)) }, [recipeId])
  async function handleDelete() { if (recipe && window.confirm(`Delete “${recipe.name}”?`)) { await deleteRecipe(recipe.id); navigate('/recipes') } }
  async function toggleMealType(mealType: RecipeMealType) { if (!recipe) return; const current = recipe.meal_types || []; const next = current.includes(mealType) ? current.filter((item) => item !== mealType) : [...current, mealType]; setRecipe(await updateRecipeMealTypes(recipe.id, next)) }
  if (error) return <section className="page"><p className="notice notice--error">Recipe not found.</p><Link to="/recipes">Back to recipes</Link></section>
  if (!recipe) return <section className="page"><p className="notice">Loading recipe…</p></section>
  return <article className="page recipe-detail">
    <Link className="back-link" to="/recipes">← All recipes</Link>
    {recipe.image_url && <div className="detail-image"><img src={recipe.image_url} alt={recipe.name} /></div>}
    <div className="detail-heading"><div><p className="eyebrow">{recipe.category || 'Recipe'}</p><h1>{recipe.name}</h1>{recipe.description && <p>{recipe.description}</p>}</div>{canEdit && <button className="button button--danger" onClick={handleDelete}>Delete</button>}</div>
    {recipe.tags.length > 0 && <div className="tag-list" aria-label="Recipe tags">{recipe.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div>}
    <section className="meal-classification"><div><h2>Suitable for</h2><p>{canEdit ? 'Choose every meal where this recipe belongs.' : 'Meal classifications for this recipe.'}</p></div><div className="choice-chips">{(['breakfast', 'lunch', 'dinner'] as RecipeMealType[]).map((mealType) => <button type="button" disabled={!canEdit} className={`choice-chip${(recipe.meal_types || []).includes(mealType) ? ' choice-chip--selected' : ''}`} aria-pressed={(recipe.meal_types || []).includes(mealType)} onClick={() => toggleMealType(mealType)} key={mealType}>{mealType}</button>)}</div></section>
    <dl className="recipe-facts">{recipe.servings && <div><dt>Servings</dt><dd>{recipe.servings}</dd></div>}{recipe.preparation_time_minutes !== null && <div><dt>Preparation</dt><dd>{recipe.preparation_time_minutes} min</dd></div>}{recipe.cooking_time_minutes !== null && <div><dt>Cooking</dt><dd>{recipe.cooking_time_minutes} min</dd></div>}{recipe.cuisine && <div><dt>Cuisine</dt><dd>{recipe.cuisine}</dd></div>}</dl>
    <div className="recipe-columns"><section><h2>Ingredients</h2>{recipe.ingredients.length ? <ul className="ingredient-list">{recipe.ingredients.map((item) => <li key={item.id}>{item.raw_text}</li>)}</ul> : <p className="muted">No ingredients added.</p>}</section><section><h2>Instructions</h2>{recipe.instructions.length ? <ol className="instruction-list">{recipe.instructions.map((step) => <li key={step.id}><span>{step.position}</span><p>{step.text}</p></li>)}</ol> : <p className="muted">No instructions added.</p>}</section></div>
    {recipe.source_url && <a className="source-link" href={recipe.source_url} target="_blank" rel="noreferrer">View original recipe ↗</a>}
  </article>
}
