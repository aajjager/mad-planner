import { type FormEvent, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listRecipeTypes, type RecipeType } from '../api/auth'
import { useAuth } from '../auth/AuthContext'
import { translator } from '../i18n'
import { createRecipe, replaceRecipe, uploadRecipeImage, type Recipe, type RecipeIngredientInput, type RecipeMealType, type RecipeWrite, type UnitDimension } from '../api/recipes'

interface IngredientRow { raw: string; name: string; quantity: string; unit: string; symbol: string; dimension: UnitDimension; quantity_max?: string | null; preparation?: string | null; notes?: string | null }
const emptyIngredient = (): IngredientRow => ({ raw: '', name: '', quantity: '', unit: '', symbol: '', dimension: 'count' })
const mealTypes: RecipeMealType[] = ['breakfast', 'lunch', 'dinner']
export function CreateRecipePage({ initialRecipe }: { initialRecipe?: Recipe }) {
  const { account } = useAuth(); const t = translator(account?.locale)
  const steps = [t('details'), t('ingredients'), t('instructions'), t('review')]
  const navigate = useNavigate()
  const [ingredients, setIngredients] = useState<IngredientRow[]>(initialRecipe?.ingredients.map((item) => ({ raw: item.raw_text, name: item.ingredient_name || '', quantity: item.quantity || '', unit: item.unit?.name || '', symbol: item.unit?.symbol || '', dimension: item.unit?.dimension || 'count', quantity_max: item.quantity_max, preparation: item.preparation, notes: item.notes })) || [emptyIngredient()])
  const [instructions, setInstructions] = useState(initialRecipe?.instructions.map((item) => item.text) || [''])
  const [selectedMealTypes, setSelectedMealTypes] = useState<RecipeMealType[]>(initialRecipe?.meal_types || ['dinner'])
  const [recipeTypes, setRecipeTypes] = useState<RecipeType[]>([])
  const [selectedRecipeTypes, setSelectedRecipeTypes] = useState<string[]>(initialRecipe?.recipe_types || [])
  const [step, setStep] = useState(0)
  const [recipeName, setRecipeName] = useState(initialRecipe?.name || '')
  const [photo, setPhoto] = useState<File | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const [saving, setSaving] = useState(false); const [error, setError] = useState('')
  const updateIngredient = (index: number, field: keyof IngredientRow, value: string) => setIngredients((rows) => rows.map((row, current) => current === index ? { ...row, [field]: value } : row))
  const toggleMealType = (mealType: RecipeMealType) => setSelectedMealTypes((current) => current.includes(mealType) ? current.filter((item) => item !== mealType) : [...current, mealType])
  useEffect(() => { listRecipeTypes().then((items) => { setRecipeTypes(items); const dinner = items.find((item) => item.meal_type === 'dinner'); if (dinner && !initialRecipe) setSelectedRecipeTypes([dinner.name]) }).catch((reason) => setError(reason.message)) }, [initialRecipe])
  const toggleRecipeType = (item: RecipeType) => setSelectedRecipeTypes((current) => current.includes(item.name) ? current.filter((name) => name !== item.name) : [...current, item.name])

  function continueToNextStep() {
    setError('')
    if (step === 0 && !recipeName.trim()) { (formRef.current?.elements.namedItem('name') as HTMLInputElement | null)?.reportValidity(); return }
    if (step === 0 && !initialRecipe && selectedRecipeTypes.length === 0) { setError(t('chooseRecipeTypeError')); return }
    if (step === 1 && !initialRecipe && !ingredients.some((item) => item.raw.trim())) { setError(t('addIngredientError')); return }
    if (step === 2 && !initialRecipe && !instructions.some((item) => item.trim())) { setError(t('addInstructionError')); return }
    setStep((current) => Math.min(current + 1, steps.length - 1))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!initialRecipe && selectedRecipeTypes.length === 0) { setError(t('chooseRecipeTypeError')); return } const form = new FormData(event.currentTarget)
    const text = (name: string) => String(form.get(name) || '').trim() || undefined
    const minutes = (name: string) => { const value = String(form.get(name) || ''); return value ? Number(value) : undefined }
    const items: RecipeIngredientInput[] = ingredients.filter((item) => item.raw.trim()).map((item) => ({ raw_text: item.raw.trim(), quantity_max: item.quantity_max || null, preparation: item.preparation || null, notes: item.notes || null, ingredient_name: item.name.trim() || undefined, quantity: item.quantity || undefined, unit: item.unit.trim() && item.symbol.trim() ? { name: item.unit.trim(), symbol: item.symbol.trim(), dimension: item.dimension } : undefined }))
    const tags = String(form.get('tags') || '').split(',').map((tag) => tag.trim()).filter(Boolean)
    const payload: RecipeWrite = { name: String(form.get('name')).trim(), description: text('description'), source_url: text('source_url'), author: text('author'), servings: text('servings'), cuisine: text('cuisine'), category: text('category'), tags, meal_types: selectedMealTypes, recipe_types: selectedRecipeTypes, preparation_time_minutes: minutes('preparation'), cooking_time_minutes: minutes('cooking'), total_time_minutes: minutes('total'), ingredients: items, instructions: instructions.filter((step) => step.trim()).map((step) => ({ text: step.trim() })) }
    setSaving(true); setError('')
    try { let recipe = (initialRecipe ? await replaceRecipe(initialRecipe.id, payload) : await createRecipe(payload)); if (photo) recipe = await uploadRecipeImage(recipe.id, photo); navigate(`/recipes/${recipe.id}`) }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('saveRecipeError')); setSaving(false) }
  }

  return <section className="page form-page">
    <Link className="back-link" to={initialRecipe ? `/recipes/${initialRecipe.id}` : "/recipes/add"}>← {t('cancel')}</Link>
    <div className="page-heading"><div><p className="eyebrow">{initialRecipe ? t('editRecipe') : t('manualRecipe')}</p><h1>{initialRecipe ? t('editRecipe') : t('addRecipeTitle')}</h1><p>{initialRecipe ? t('editRecipeIntro') : t('guidedRecipeIntro')}</p></div></div>
    <nav className="recipe-stepper" aria-label={initialRecipe ? t('editRecipe') : t('recipeCreationProgress')}>{steps.map((label, index) => <button type="button" disabled={index > step} className={index === step ? 'recipe-step recipe-step--current' : index < step ? 'recipe-step recipe-step--complete' : 'recipe-step'} onClick={() => index < step && setStep(index)} key={label}><span>{index + 1}</span>{label}</button>)}</nav>
    <form ref={formRef} onSubmit={submit}>
      <fieldset hidden={step !== 0}><legend>{t('recipeDetailsClassification')}</legend><div className="form-grid">
        <label className="field field--wide"><span>{t('name')} *</span><input name="name" required maxLength={300} value={recipeName} onChange={(event) => setRecipeName(event.target.value)} /></label>
        <label className="field field--wide"><span>{t('description')}</span><textarea name="description" defaultValue={initialRecipe?.description ?? undefined} rows={3} /></label>
        <label className="field"><span>{t('servings')}</span><input name="servings" defaultValue={initialRecipe?.servings ?? undefined} type="number" min="0.01" step="0.01" /></label><label className="field"><span>{t('cuisine')}</span><input name="cuisine" defaultValue={initialRecipe?.cuisine ?? undefined} /></label><label className="field"><span>{t('category')}</span><input name="category" defaultValue={initialRecipe?.category ?? undefined} placeholder={t('dinner')} /></label><label className="field"><span>{t('author')}</span><input name="author" defaultValue={initialRecipe?.author ?? undefined} /></label>
        <label className="field"><span>{t('preparationMinutes')}</span><input name="preparation" defaultValue={initialRecipe?.preparation_time_minutes ?? undefined} type="number" min="0" /></label><label className="field"><span>{t('cookingMinutes')}</span><input name="cooking" defaultValue={initialRecipe?.cooking_time_minutes ?? undefined} type="number" min="0" /></label><label className="field"><span>{t('totalMinutes')}</span><input name="total" defaultValue={initialRecipe?.total_time_minutes ?? undefined} type="number" min="0" /></label>
        <label className="field field--wide"><span>{t('tags')}</span><input name="tags" defaultValue={initialRecipe?.tags.join(", ")} placeholder={t('tagsPlaceholder')} /><small>{t('separateTags')}</small></label>
        <label className="field field--wide"><span>{t('sourceUrl')}</span><input name="source_url" defaultValue={initialRecipe?.source_url ?? undefined} type="url" /></label>
        <label className="field field--wide"><span>{t('recipePhoto')}</span><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => setPhoto(event.target.files?.[0] || null)} /><small>{t('photoHelp')}</small></label>
        <div className="field field--wide"><span>{t('recipeType')} *</span><div className="choice-chips">{recipeTypes.map((item) => <button type="button" aria-label={`${item.name} ${t('recipeType')}`} className={`choice-chip${selectedRecipeTypes.includes(item.name) ? ' choice-chip--selected' : ''}`} aria-pressed={selectedRecipeTypes.includes(item.name)} onClick={() => toggleRecipeType(item)} key={item.id}>{item.name}</button>)}</div><small>{t('recipeTypeHelp')}</small></div>
        <div className="field field--wide"><span>{t('suitableFor')}</span><div className="choice-chips">{mealTypes.map((mealType) => <button type="button" className={`choice-chip${selectedMealTypes.includes(mealType) ? ' choice-chip--selected' : ''}`} aria-pressed={selectedMealTypes.includes(mealType)} onClick={() => toggleMealType(mealType)} key={mealType}>{t(mealType)}</button>)}</div><small>{t('mealTypeHelp')}</small></div>
      </div></fieldset>
      <fieldset hidden={step !== 1}><div className="fieldset-heading"><legend>{t('ingredients')}</legend><button className="text-button" type="button" onClick={() => setIngredients((rows) => [...rows, emptyIngredient()])}>+ {t('addIngredient')}</button></div><div className="repeat-list">
        {ingredients.map((item, index) => <div className="ingredient-row" key={index}><label className="field field--wide"><span>{t('originalText')} *</span><input value={item.raw} onChange={(event) => updateIngredient(index, 'raw', event.target.value)} placeholder={t('ingredientExample')} /></label><label className="field"><span>{t('ingredient')}</span><input value={item.name} onChange={(event) => updateIngredient(index, 'name', event.target.value)} placeholder={t('ingredientNameExample')} /></label><label className="field field--small"><span>{t('quantity')}</span><input type="number" min="0" step="any" value={item.quantity} onChange={(event) => updateIngredient(index, 'quantity', event.target.value)} /></label><label className="field"><span>{t('maximumQuantity')}</span><input type="number" min={item.quantity || "0"} step="any" value={item.quantity_max || ""} onChange={(event) => updateIngredient(index, "quantity_max", event.target.value)} /></label><label className="field"><span>{t('ingredientPreparation')}</span><input value={item.preparation || ""} onChange={(event) => updateIngredient(index, "preparation", event.target.value)} /></label><label className="field"><span>{t('ingredientNotes')}</span><input value={item.notes || ""} onChange={(event) => updateIngredient(index, "notes", event.target.value)} /></label><label className="field"><span>{t('unit')}</span><input value={item.unit} onChange={(event) => updateIngredient(index, 'unit', event.target.value)} placeholder={t('unitExample')} /></label><label className="field field--small"><span>{t('symbol')}</span><input value={item.symbol} onChange={(event) => updateIngredient(index, 'symbol', event.target.value)} placeholder={t('unitSymbolExample')} /></label><label className="field"><span>{t('type')}</span><select value={item.dimension} onChange={(event) => updateIngredient(index, 'dimension', event.target.value)}><option value="count">{t('count')}</option><option value="mass">{t('mass')}</option><option value="volume">{t('volume')}</option></select></label>{ingredients.length > 1 && <button className="remove-button" type="button" onClick={() => setIngredients((rows) => rows.filter((_, current) => current !== index))}>{t('remove')}</button>}</div>)}
      </div></fieldset>
      <fieldset hidden={step !== 2}><div className="fieldset-heading"><legend>{t('instructions')}</legend><button className="text-button" type="button" onClick={() => setInstructions((steps) => [...steps, ''])}>+ {t('addStep')}</button></div><div className="repeat-list">{instructions.map((instruction, index) => <div className="instruction-row" key={index}><span>{index + 1}</span><textarea rows={2} value={instruction} onChange={(event) => setInstructions((currentInstructions) => currentInstructions.map((value, current) => current === index ? event.target.value : value))} placeholder={t('describeStep')} />{instructions.length > 1 && <button className="remove-button" type="button" onClick={() => setInstructions((currentInstructions) => currentInstructions.filter((_, current) => current !== index))}>{t('remove')}</button>}</div>)}</div></fieldset>
      <fieldset hidden={step !== 3}><legend>{t('reviewRecipe')}</legend><div className="recipe-review"><div><small>{t('recipe')}</small><strong>{recipeName}</strong></div><div><small>{t('types')}</small><strong>{selectedRecipeTypes.join(', ')}</strong></div><div><small>{t('suitableFor')}</small><strong>{selectedMealTypes.map((item) => t(item)).join(', ') || t('notSelected')}</strong></div><div><small>{t('photo')}</small><strong>{photo?.name || (initialRecipe?.image_url ? t('currentPhotoKept') : t('noPhoto'))}</strong></div><div><small>{t('ingredients')}</small><strong>{ingredients.filter((item) => item.raw.trim()).length}</strong></div><div><small>{t('instructions')}</small><strong>{instructions.filter((item) => item.trim()).length}</strong></div></div><p className="muted">{t('reviewHelp')}</p></fieldset>
      {error && <p className="notice notice--error" role="alert">{error}</p>}<div className="form-actions">{step === 0 ? <Link className="button" to={initialRecipe ? `/recipes/${initialRecipe.id}` : "/recipes/add"}>{t('cancel')}</Link> : <button className="button" type="button" onClick={() => { setError(''); setStep((current) => current - 1) }}>{t('back')}</button>}{step < steps.length - 1 ? <button className="button button--primary" type="button" onClick={continueToNextStep}>{t('continue')}</button> : <button className="button button--primary" disabled={saving}>{saving ? t('saving') : t('saveRecipe')}</button>}</div>
    </form>
  </section>
}
