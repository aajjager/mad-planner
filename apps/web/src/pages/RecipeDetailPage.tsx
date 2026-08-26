import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { deleteRecipe, getRecipe, updateRecipeMealTypes, uploadRecipeImage, type Recipe, type RecipeMealType } from '../api/recipes'
import './RecipeDetailPage.css'
import { useAuth } from '../auth/AuthContext'
import { getFamilySettings } from '../api/auth'
import { translator } from '../i18n'
import { NutritionSummary } from '../components/NutritionSummary'

export function RecipeDetailPage() {
  const { account } = useAuth(); const canEdit = account?.role === 'owner' || account?.role === 'editor'
  const t = translator(account?.locale)
  const { recipeId } = useParams(); const navigate = useNavigate()
  const [recipe, setRecipe] = useState<Recipe | null>(null); const [error, setError] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false); const [photoError, setPhotoError] = useState('')
  const [cookingEnabled, setCookingEnabled] = useState(false); const [cookingMode, setCookingMode] = useState(false); const [completedSteps, setCompletedSteps] = useState<number[]>([])
  useEffect(() => { getRecipe(Number(recipeId)).then(setRecipe).catch(() => setError(true)); getFamilySettings().then((settings) => setCookingEnabled(settings.cooking_mode_enabled)).catch(() => undefined) }, [recipeId])
  async function handleDelete() { if (recipe && window.confirm(`Delete “${recipe.name}”?`)) { await deleteRecipe(recipe.id); navigate('/recipes') } }
  async function toggleMealType(mealType: RecipeMealType) { if (!recipe) return; const current = recipe.meal_types || []; const next = current.includes(mealType) ? current.filter((item) => item !== mealType) : [...current, mealType]; setRecipe(await updateRecipeMealTypes(recipe.id, next)) }
  async function changePhoto(file: File | undefined) { if (!recipe || !file) return; setPhotoBusy(true); setPhotoError(''); try { setRecipe(await uploadRecipeImage(recipe.id, file)) } catch (reason) { setPhotoError(reason instanceof Error ? reason.message : 'The photo could not be uploaded.') } finally { setPhotoBusy(false) } }
  if (error) return <section className="page"><p className="notice notice--error">Recipe not found.</p><Link to="/recipes">Back to recipes</Link></section>
  if (!recipe) return <section className="page"><p className="notice">Loading recipe…</p></section>
  if (cookingMode) { const remaining = recipe.instructions.filter((item) => !completedSteps.includes(item.id)); return <article className="cooking-sheet"><header><div><p className="eyebrow">{t('cookingMode')}</p><h1>{recipe.name}</h1></div><div className="cooking-actions">{completedSteps.length > 0 && <button className="button" onClick={() => setCompletedSteps((current) => current.slice(0, -1))}>{t('undoLastStep')}</button>}<button className="button" onClick={() => setCookingMode(false)}>{t('exitCooking')}</button></div></header><div className="cooking-layout"><aside><h2>{t('ingredients')}</h2><ul>{recipe.ingredients.map((item) => <li key={item.id}>{item.raw_text}</li>)}</ul></aside><section><div className="cooking-progress"><strong>{completedSteps.length} / {recipe.instructions.length} {t('completed')}</strong><span>{remaining.length === 0 ? t('recipeComplete') : t('tapDone')}</span></div>{remaining.map((item) => <article className="cooking-step" key={item.id}><span>{item.position}</span><p>{item.text}</p><button className="button button--primary" onClick={() => setCompletedSteps((current) => [...current, item.id])}>{t('done')}</button></article>)}{remaining.length === 0 && <div className="cooking-complete"><span>✓</span><h2>{t('enjoyMeal')}</h2><button className="button" onClick={() => setCompletedSteps([])}>{t('startAgain')}</button></div>}</section></div></article> }
  return <article className="page recipe-detail">
    <Link className="back-link" to="/recipes">← {t('allRecipes')}</Link>
    {recipe.image_url && <div className="detail-image"><img src={recipe.image_url} alt={recipe.name} /></div>}
    {canEdit && <div className="photo-actions"><label className="button"><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={photoBusy} onChange={(event) => changePhoto(event.target.files?.[0])} />{photoBusy ? t('uploading') : recipe.image_url ? t('replacePhoto') : t('addPhoto')}</label>{photoError && <span className="notice notice--error">{photoError}</span>}</div>}
    <div className="detail-heading"><div><p className="eyebrow">{recipe.category || t('recipe')}</p><h1>{recipe.name}</h1>{recipe.description && <p>{recipe.description}</p>}</div><div className="heading-actions">{cookingEnabled && recipe.instructions.length > 0 && <button className="button button--primary" onClick={() => { setCompletedSteps([]); setCookingMode(true) }}>{t('startCooking')}</button>}{canEdit && <button className="button button--danger" onClick={handleDelete}>{t('delete')}</button>}</div></div>
    {account?.show_nutrition !== false && <NutritionSummary recipe={recipe} labels={{ title: t('nutrition'), available: t('nutritionAvailable'), estimated: t('nutritionEstimated'), coverage: t('nutritionCoverage'), calories: t('calories'), fat: t('fat'), carbohydrates: t('carbohydrates'), protein: t('protein') }} />}
    {(recipe.recipe_types || []).length > 0 && <div className="tag-list" aria-label="Recipe types">{recipe.recipe_types.map((type) => <span className="tag" key={type}>{type}</span>)}</div>}
    {recipe.tags.length > 0 && <div className="tag-list" aria-label="Recipe tags">{recipe.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div>}
    <section className="meal-classification"><div><h2>{t('suitableFor')}</h2><p>{canEdit ? t('chooseMeals') : t('mealClassifications')}</p></div><div className="choice-chips">{(['breakfast', 'lunch', 'dinner'] as RecipeMealType[]).map((mealType) => <button type="button" disabled={!canEdit} className={`choice-chip${(recipe.meal_types || []).includes(mealType) ? ' choice-chip--selected' : ''}`} aria-pressed={(recipe.meal_types || []).includes(mealType)} onClick={() => toggleMealType(mealType)} key={mealType}>{mealType}</button>)}</div></section>
    <dl className="recipe-facts">{recipe.servings && <div><dt>{t('servings')}</dt><dd>{recipe.servings}</dd></div>}{recipe.preparation_time_minutes !== null && <div><dt>{t('preparation')}</dt><dd>{recipe.preparation_time_minutes} min</dd></div>}{recipe.cooking_time_minutes !== null && <div><dt>{t('cooking')}</dt><dd>{recipe.cooking_time_minutes} min</dd></div>}{recipe.cuisine && <div><dt>{t('cuisine')}</dt><dd>{recipe.cuisine}</dd></div>}</dl>
    <div className="recipe-columns"><section><h2>{t('ingredients')}</h2>{recipe.ingredients.length ? <ul className="ingredient-list">{recipe.ingredients.map((item) => <li key={item.id}>{item.raw_text}</li>)}</ul> : <p className="muted">{t('noIngredients')}</p>}</section><section><h2>{t('instructions')}</h2>{recipe.instructions.length ? <ol className="instruction-list">{recipe.instructions.map((step) => <li key={step.id}><span>{step.position}</span><p>{step.text}</p></li>)}</ol> : <p className="muted">{t('noInstructions')}</p>}</section></div>
    {recipe.source_url && <a className="source-link" href={recipe.source_url} target="_blank" rel="noreferrer">{t('viewOriginal')} ↗</a>}
  </article>
}
