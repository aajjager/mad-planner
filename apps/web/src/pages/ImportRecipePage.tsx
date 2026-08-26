import { type FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listRecipeTypes, type RecipeType } from '../api/auth'
import { useAuth } from '../auth/AuthContext'
import { translator } from '../i18n'
import { createRecipe, parseServingCount, previewRecipeImport, type ImportedRecipePreview } from '../api/recipes'
import './ImportRecipePage.css'

export function ImportRecipePage() {
  const { account } = useAuth(); const t = translator(account?.locale)
  const navigate = useNavigate()
  const [url, setUrl] = useState('')
  const [preview, setPreview] = useState<ImportedRecipePreview | null>(null)
  const [recipeTypes, setRecipeTypes] = useState<RecipeType[]>([])
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { listRecipeTypes().then(setRecipeTypes).catch((reason) => setError(reason.message)) }, [])
  async function load(event: FormEvent) { event.preventDefault(); setBusy(true); setError(''); try { const next = await previewRecipeImport(url); setPreview(next); setSelectedTypes(next.suggested_recipe_types) } catch (reason) { setError(reason instanceof Error ? reason.message : t('importFailed')) } finally { setBusy(false) } }
  const updateLines = (field: 'ingredients' | 'instructions', value: string) => setPreview((current) => current ? { ...current, [field]: value.split('\n').map((line) => line.trim()).filter(Boolean) } : current)
  const toggleType = (name: string) => setSelectedTypes((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name])

  async function save() {
    if (!preview || selectedTypes.length === 0) return
    setBusy(true); setError('')
    const mealTypes = [...new Set(recipeTypes.filter((item) => selectedTypes.includes(item.name)).map((item) => item.meal_type).filter((item): item is NonNullable<typeof item> => item !== null))]
    try { const recipe = await createRecipe({ name: preview.name, description: preview.description || undefined, image_url: preview.image_url || undefined, source_url: preview.source_url, author: preview.author || undefined, servings: parseServingCount(preview.servings), preparation_time_minutes: preview.preparation_time_minutes ?? undefined, cooking_time_minutes: preview.cooking_time_minutes ?? undefined, total_time_minutes: preview.total_time_minutes ?? undefined, cuisine: preview.cuisine || undefined, category: preview.category || undefined, nutrition: preview.nutrition || undefined, tags: preview.category ? preview.category.split(',').map((tag) => tag.trim()).filter(Boolean) : [], recipe_types: selectedTypes, meal_types: mealTypes, ingredients: preview.ingredients.map((raw_text) => ({ raw_text })), instructions: preview.instructions.map((text) => ({ text })) }); navigate(`/recipes/${recipe.id}`) }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('saveFailed')); setBusy(false) }
  }

  return <section className="page import-page"><Link className="back-link" to="/recipes">← {t('allRecipes')}</Link><div className="page-heading"><div><p className="eyebrow">{t('recipeImporter')}</p><h1>{t('importWebsite')}</h1><p>{t('importIntro')}</p></div></div><form className="import-bar" onSubmit={load}><label className="field"><span>{t('recipeUrl')}</span><input type="url" required value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/recipe" /></label><button className="button button--primary" disabled={busy}>{busy ? t('reading') : t('previewRecipe')}</button></form>{error && <p className="notice notice--error" role="alert">{error}</p>}{preview && <div className="import-preview"><div className="preview-heading"><div><p className="eyebrow">{t('reviewExtracted')}</p><input className="title-input" aria-label={t('recipeName')} value={preview.name} onChange={(event) => setPreview({ ...preview, name: event.target.value })} /></div><span className="parser-badge">{preview.parser}</span></div><section className="type-confirmation"><div><strong>{t('whatRecipeType')}</strong><p>{preview.suggested_recipe_types.length ? t('confirmDetectedType') : t('chooseTypeManually')}</p></div><div className="choice-chips">{recipeTypes.map((item) => <button type="button" className={`choice-chip${selectedTypes.includes(item.name) ? ' choice-chip--selected' : ''}`} aria-pressed={selectedTypes.includes(item.name)} onClick={() => toggleType(item.name)} key={item.id}>{item.name}</button>)}</div>{selectedTypes.length === 0 && <small className="type-required">{t('chooseRecipeTypes')}</small>}</section><label className="field"><span>{t('description')}</span><textarea rows={3} value={preview.description || ''} onChange={(event) => setPreview({ ...preview, description: event.target.value })} /></label><div className="preview-grid"><label className="field"><span>{t('cuisine')}</span><input value={preview.cuisine || ''} onChange={(event) => setPreview({ ...preview, cuisine: event.target.value })} /></label><label className="field"><span>{t('category')}</span><input value={preview.category || ''} onChange={(event) => setPreview({ ...preview, category: event.target.value })} /></label><label className="field"><span>{t('servings')}</span><input value={preview.servings || ''} onChange={(event) => setPreview({ ...preview, servings: event.target.value })} /></label></div><div className="recipe-columns"><label className="field"><span>{t('ingredientsOneLine')}</span><textarea rows={10} value={preview.ingredients.join('\n')} onChange={(event) => updateLines('ingredients', event.target.value)} /></label><label className="field"><span>{t('instructionsOneLine')}</span><textarea rows={10} value={preview.instructions.join('\n')} onChange={(event) => updateLines('instructions', event.target.value)} /></label></div><div className="form-actions"><button className="button" type="button" onClick={() => { setPreview(null); setSelectedTypes([]) }}>{t('startOver')}</button><button className="button button--primary" type="button" disabled={busy || !preview.name.trim() || selectedTypes.length === 0} onClick={save}>{t('saveImported')}</button></div></div>}</section>
}
