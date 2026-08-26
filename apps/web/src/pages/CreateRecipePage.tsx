import { type FormEvent, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listRecipeTypes, type RecipeType } from '../api/auth'
import { useAuth } from '../auth/AuthContext'
import { translator } from '../i18n'
import { createRecipe, uploadRecipeImage, type RecipeIngredientInput, type RecipeMealType, type RecipeWrite, type UnitDimension } from '../api/recipes'

interface IngredientRow { raw: string; name: string; quantity: string; unit: string; symbol: string; dimension: UnitDimension }
const emptyIngredient = (): IngredientRow => ({ raw: '', name: '', quantity: '', unit: '', symbol: '', dimension: 'count' })
const mealTypes: RecipeMealType[] = ['breakfast', 'lunch', 'dinner']
export function CreateRecipePage() {
  const { account } = useAuth(); const t = translator(account?.locale)
  const steps = [t('details'), t('ingredients'), t('instructions'), t('review')]
  const navigate = useNavigate()
  const [ingredients, setIngredients] = useState([emptyIngredient()])
  const [instructions, setInstructions] = useState([''])
  const [selectedMealTypes, setSelectedMealTypes] = useState<RecipeMealType[]>(['dinner'])
  const [recipeTypes, setRecipeTypes] = useState<RecipeType[]>([])
  const [selectedRecipeTypes, setSelectedRecipeTypes] = useState<string[]>([])
  const [step, setStep] = useState(0)
  const [recipeName, setRecipeName] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const [saving, setSaving] = useState(false); const [error, setError] = useState('')
  const updateIngredient = (index: number, field: keyof IngredientRow, value: string) => setIngredients((rows) => rows.map((row, current) => current === index ? { ...row, [field]: value } : row))
  const toggleMealType = (mealType: RecipeMealType) => setSelectedMealTypes((current) => current.includes(mealType) ? current.filter((item) => item !== mealType) : [...current, mealType])
  useEffect(() => { listRecipeTypes().then((items) => { setRecipeTypes(items); const dinner = items.find((item) => item.meal_type === 'dinner'); if (dinner) setSelectedRecipeTypes([dinner.name]) }).catch((reason) => setError(reason.message)) }, [])
  const toggleRecipeType = (item: RecipeType) => setSelectedRecipeTypes((current) => current.includes(item.name) ? current.filter((name) => name !== item.name) : [...current, item.name])

  function continueToNextStep() {
    setError('')
    if (step === 0 && !recipeName.trim()) { (formRef.current?.elements.namedItem('name') as HTMLInputElement | null)?.reportValidity(); return }
    if (step === 0 && selectedRecipeTypes.length === 0) { setError(t('chooseRecipeTypeError')); return }
    if (step === 1 && !ingredients.some((item) => item.raw.trim())) { setError(t('addIngredientError')); return }
    if (step === 2 && !instructions.some((item) => item.trim())) { setError(t('addInstructionError')); return }
    setStep((current) => Math.min(current + 1, steps.length - 1))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (selectedRecipeTypes.length === 0) { setError(t('chooseRecipeTypeError')); return } const form = new FormData(event.currentTarget)
    const text = (name: string) => String(form.get(name) || '').trim() || undefined
    const minutes = (name: string) => { const value = String(form.get(name) || ''); return value ? Number(value) : undefined }
    const items: RecipeIngredientInput[] = ingredients.filter((item) => item.raw.trim()).map((item) => ({ raw_text: item.raw.trim(), ingredient_name: item.name.trim() || undefined, quantity: item.quantity || undefined, unit: item.unit.trim() && item.symbol.trim() ? { name: item.unit.trim(), symbol: item.symbol.trim(), dimension: item.dimension } : undefined }))
    const tags = String(form.get('tags') || '').split(',').map((tag) => tag.trim()).filter(Boolean)
    const payload: RecipeWrite = { name: String(form.get('name')).trim(), description: text('description'), source_url: text('source_url'), author: text('author'), servings: text('servings'), cuisine: text('cuisine'), category: text('category'), tags, meal_types: selectedMealTypes, recipe_types: selectedRecipeTypes, preparation_time_minutes: minutes('preparation'), cooking_time_minutes: minutes('cooking'), total_time_minutes: minutes('total'), ingredients: items, instructions: instructions.filter((step) => step.trim()).map((step) => ({ text: step.trim() })) }
    setSaving(true); setError('')
    try { let recipe = await createRecipe(payload); if (photo) recipe = await uploadRecipeImage(recipe.id, photo); navigate(`/recipes/${recipe.id}`) }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('saveRecipeError')); setSaving(false) }
  }

  return <section className="page form-page">
    <Link className="back-link" to="/recipes">← {t('cancel')}</Link>
    <div className="page-heading"><div><p className="eyebrow">{t('manualRecipe')}</p><h1>{t('addRecipeTitle')}</h1><p>{t('guidedRecipeIntro')}</p></div></div>
    <nav className="recipe-stepper" aria-label="Recipe creation progress">{steps.map((label, index) => <button type="button" disabled={index > step} className={index === step ? 'recipe-step recipe-step--current' : index < step ? 'recipe-step recipe-step--complete' : 'recipe-step'} onClick={() => index < step && setStep(index)} key={label}><span>{index + 1}</span>{label}</button>)}</nav>
    <form ref={formRef} onSubmit={submit}>
      <fieldset hidden={step !== 0}><legend>{t('recipeDetailsClassification')}</legend><div className="form-grid">
        <label className="field field--wide"><span>{t('name')} *</span><input name="name" required maxLength={300} value={recipeName} onChange={(event) => setRecipeName(event.target.value)} /></label>
        <label className="field field--wide"><span>{t('description')}</span><textarea name="description" rows={3} /></label>
        <label className="field"><span>{t('servings')}</span><input name="servings" type="number" min="0.01" step="0.01" /></label><label className="field"><span>{t('cuisine')}</span><input name="cuisine" /></label><label className="field"><span>{t('category')}</span><input name="category" placeholder={t('dinner')} /></label><label className="field"><span>{t('author')}</span><input name="author" /></label>
        <label className="field"><span>{t('preparationMinutes')}</span><input name="preparation" type="number" min="0" /></label><label className="field"><span>{t('cookingMinutes')}</span><input name="cooking" type="number" min="0" /></label><label className="field"><span>{t('totalMinutes')}</span><input name="total" type="number" min="0" /></label>
        <label className="field field--wide"><span>{t('tags')}</span><input name="tags" placeholder={t('tagsPlaceholder')} /><small>{t('separateTags')}</small></label>
        <label className="field field--wide"><span>{t('sourceUrl')}</span><input name="source_url" type="url" /></label>
        <label className="field field--wide"><span>{t('recipePhoto')}</span><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => setPhoto(event.target.files?.[0] || null)} /><small>{t('photoHelp')}</small></label>
        <div className="field field--wide"><span>{t('recipeType')} *</span><div className="choice-chips">{recipeTypes.map((item) => <button type="button" aria-label={`${item.name} ${t('recipeType')}`} className={`choice-chip${selectedRecipeTypes.includes(item.name) ? ' choice-chip--selected' : ''}`} aria-pressed={selectedRecipeTypes.includes(item.name)} onClick={() => toggleRecipeType(item)} key={item.id}>{item.name}</button>)}</div><small>{t('recipeTypeHelp')}</small></div>
        <div className="field field--wide"><span>{t('suitableFor')}</span><div className="choice-chips">{mealTypes.map((mealType) => <button type="button" className={`choice-chip${selectedMealTypes.includes(mealType) ? ' choice-chip--selected' : ''}`} aria-pressed={selectedMealTypes.includes(mealType)} onClick={() => toggleMealType(mealType)} key={mealType}>{t(mealType)}</button>)}</div><small>{t('mealTypeHelp')}</small></div>
      </div></fieldset>
      <fieldset hidden={step !== 1}><div className="fieldset-heading"><legend>{t('ingredients')}</legend><button className="text-button" type="button" onClick={() => setIngredients((rows) => [...rows, emptyIngredient()])}>+ {t('addIngredient')}</button></div><div className="repeat-list">
        {ingredients.map((item, index) => <div className="ingredient-row" key={index}><label className="field field--wide"><span>{t('originalText')} *</span><input value={item.raw} onChange={(event) => updateIngredient(index, 'raw', event.target.value)} placeholder="2 tbsp olive oil" /></label><label className="field"><span>{t('ingredient')}</span><input value={item.name} onChange={(event) => updateIngredient(index, 'name', event.target.value)} placeholder="Olive oil" /></label><label className="field field--small"><span>{t('quantity')}</span><input type="number" min="0" step="any" value={item.quantity} onChange={(event) => updateIngredient(index, 'quantity', event.target.value)} /></label><label className="field"><span>{t('unit')}</span><input value={item.unit} onChange={(event) => updateIngredient(index, 'unit', event.target.value)} placeholder="tablespoon" /></label><label className="field field--small"><span>{t('symbol')}</span><input value={item.symbol} onChange={(event) => updateIngredient(index, 'symbol', event.target.value)} placeholder="tbsp" /></label><label className="field"><span>{t('type')}</span><select value={item.dimension} onChange={(event) => updateIngredient(index, 'dimension', event.target.value)}><option value="count">{t('count')}</option><option value="mass">{t('mass')}</option><option value="volume">{t('volume')}</option></select></label>{ingredients.length > 1 && <button className="remove-button" type="button" onClick={() => setIngredients((rows) => rows.filter((_, current) => current !== index))}>{t('remove')}</button>}</div>)}
      </div></fieldset>
      <fieldset hidden={step !== 2}><div className="fieldset-heading"><legend>{t('instructions')}</legend><button className="text-button" type="button" onClick={() => setInstructions((steps) => [...steps, ''])}>+ {t('addStep')}</button></div><div className="repeat-list">{instructions.map((instruction, index) => <div className="instruction-row" key={index}><span>{index + 1}</span><textarea rows={2} value={instruction} onChange={(event) => setInstructions((currentInstructions) => currentInstructions.map((value, current) => current === index ? event.target.value : value))} placeholder={t('describeStep')} />{instructions.length > 1 && <button className="remove-button" type="button" onClick={() => setInstructions((currentInstructions) => currentInstructions.filter((_, current) => current !== index))}>{t('remove')}</button>}</div>)}</div></fieldset>
      <fieldset hidden={step !== 3}><legend>{t('reviewRecipe')}</legend><div className="recipe-review"><div><small>{t('recipe')}</small><strong>{recipeName}</strong></div><div><small>{t('types')}</small><strong>{selectedRecipeTypes.join(', ')}</strong></div><div><small>{t('suitableFor')}</small><strong>{selectedMealTypes.map((item) => t(item)).join(', ') || t('notSelected')}</strong></div><div><small>{t('photo')}</small><strong>{photo?.name || t('noPhoto')}</strong></div><div><small>{t('ingredients')}</small><strong>{ingredients.filter((item) => item.raw.trim()).length}</strong></div><div><small>{t('instructions')}</small><strong>{instructions.filter((item) => item.trim()).length}</strong></div></div><p className="muted">{t('reviewHelp')}</p></fieldset>
      {error && <p className="notice notice--error" role="alert">{error}</p>}<div className="form-actions">{step === 0 ? <Link className="button" to="/recipes">{t('cancel')}</Link> : <button className="button" type="button" onClick={() => { setError(''); setStep((current) => current - 1) }}>{t('back')}</button>}{step < steps.length - 1 ? <button className="button button--primary" type="button" onClick={continueToNextStep}>{t('continue')}</button> : <button className="button button--primary" disabled={saving}>{saving ? t('saving') : t('saveRecipe')}</button>}</div>
    </form>
  </section>
}
