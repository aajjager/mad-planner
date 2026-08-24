import { type FormEvent, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listRecipeTypes, type RecipeType } from '../api/auth'
import { createRecipe, uploadRecipeImage, type RecipeIngredientInput, type RecipeMealType, type RecipeWrite, type UnitDimension } from '../api/recipes'

interface IngredientRow { raw: string; name: string; quantity: string; unit: string; symbol: string; dimension: UnitDimension }
const emptyIngredient = (): IngredientRow => ({ raw: '', name: '', quantity: '', unit: '', symbol: '', dimension: 'count' })
const mealTypes: RecipeMealType[] = ['breakfast', 'lunch', 'dinner']
const steps = ['Details', 'Ingredients', 'Instructions', 'Review']

export function CreateRecipePage() {
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
    if (step === 0 && selectedRecipeTypes.length === 0) { setError('Choose at least one recipe type.'); return }
    if (step === 1 && !ingredients.some((item) => item.raw.trim())) { setError('Add at least one ingredient before continuing.'); return }
    if (step === 2 && !instructions.some((item) => item.trim())) { setError('Add at least one instruction before continuing.'); return }
    setStep((current) => Math.min(current + 1, steps.length - 1))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (selectedRecipeTypes.length === 0) { setError('Choose at least one recipe type.'); return } const form = new FormData(event.currentTarget)
    const text = (name: string) => String(form.get(name) || '').trim() || undefined
    const minutes = (name: string) => { const value = String(form.get(name) || ''); return value ? Number(value) : undefined }
    const items: RecipeIngredientInput[] = ingredients.filter((item) => item.raw.trim()).map((item) => ({ raw_text: item.raw.trim(), ingredient_name: item.name.trim() || undefined, quantity: item.quantity || undefined, unit: item.unit.trim() && item.symbol.trim() ? { name: item.unit.trim(), symbol: item.symbol.trim(), dimension: item.dimension } : undefined }))
    const tags = String(form.get('tags') || '').split(',').map((tag) => tag.trim()).filter(Boolean)
    const payload: RecipeWrite = { name: String(form.get('name')).trim(), description: text('description'), source_url: text('source_url'), author: text('author'), servings: text('servings'), cuisine: text('cuisine'), category: text('category'), tags, meal_types: selectedMealTypes, recipe_types: selectedRecipeTypes, preparation_time_minutes: minutes('preparation'), cooking_time_minutes: minutes('cooking'), total_time_minutes: minutes('total'), ingredients: items, instructions: instructions.filter((step) => step.trim()).map((step) => ({ text: step.trim() })) }
    setSaving(true); setError('')
    try { let recipe = await createRecipe(payload); if (photo) recipe = await uploadRecipeImage(recipe.id, photo); navigate(`/recipes/${recipe.id}`) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The recipe could not be saved.'); setSaving(false) }
  }

  return <section className="page form-page">
    <Link className="back-link" to="/recipes">← Cancel</Link>
    <div className="page-heading"><div><p className="eyebrow">Manual recipe</p><h1>Add a recipe</h1><p>Follow the steps to add every recipe in a consistent format.</p></div></div>
    <nav className="recipe-stepper" aria-label="Recipe creation progress">{steps.map((label, index) => <button type="button" disabled={index > step} className={index === step ? 'recipe-step recipe-step--current' : index < step ? 'recipe-step recipe-step--complete' : 'recipe-step'} onClick={() => index < step && setStep(index)} key={label}><span>{index + 1}</span>{label}</button>)}</nav>
    <form ref={formRef} onSubmit={submit}>
      <fieldset hidden={step !== 0}><legend>Recipe details and classification</legend><div className="form-grid">
        <label className="field field--wide"><span>Name *</span><input name="name" required maxLength={300} value={recipeName} onChange={(event) => setRecipeName(event.target.value)} /></label>
        <label className="field field--wide"><span>Description</span><textarea name="description" rows={3} /></label>
        <label className="field"><span>Servings</span><input name="servings" type="number" min="0.01" step="0.01" /></label><label className="field"><span>Cuisine</span><input name="cuisine" /></label><label className="field"><span>Category</span><input name="category" placeholder="Dinner" /></label><label className="field"><span>Author</span><input name="author" /></label>
        <label className="field"><span>Preparation minutes</span><input name="preparation" type="number" min="0" /></label><label className="field"><span>Cooking minutes</span><input name="cooking" type="number" min="0" /></label><label className="field"><span>Total minutes</span><input name="total" type="number" min="0" /></label>
        <label className="field field--wide"><span>Tags</span><input name="tags" placeholder="Quick, Vegetarian, Family favorite" /><small>Separate tags with commas.</small></label>
        <label className="field field--wide"><span>Source URL</span><input name="source_url" type="url" /></label>
        <label className="field field--wide"><span>Recipe photo</span><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => setPhoto(event.target.files?.[0] || null)} /><small>Take a photo or choose a JPEG, PNG, or WebP image up to 10 MB.</small></label>
        <div className="field field--wide"><span>Recipe type *</span><div className="choice-chips">{recipeTypes.map((item) => <button type="button" aria-label={`${item.name} recipe type`} className={`choice-chip${selectedRecipeTypes.includes(item.name) ? ' choice-chip--selected' : ''}`} aria-pressed={selectedRecipeTypes.includes(item.name)} onClick={() => toggleRecipeType(item)} key={item.id}>{item.name}</button>)}</div><small>Choose one or more types managed in Family.</small></div>
        <div className="field field--wide"><span>Suitable for</span><div className="choice-chips">{mealTypes.map((mealType) => <button type="button" className={`choice-chip${selectedMealTypes.includes(mealType) ? ' choice-chip--selected' : ''}`} aria-pressed={selectedMealTypes.includes(mealType)} onClick={() => toggleMealType(mealType)} key={mealType}>{mealType}</button>)}</div><small>Select one or more meal types.</small></div>
      </div></fieldset>
      <fieldset hidden={step !== 1}><div className="fieldset-heading"><legend>Ingredients</legend><button className="text-button" type="button" onClick={() => setIngredients((rows) => [...rows, emptyIngredient()])}>+ Add ingredient</button></div><div className="repeat-list">
        {ingredients.map((item, index) => <div className="ingredient-row" key={index}><label className="field field--wide"><span>Original text *</span><input value={item.raw} onChange={(event) => updateIngredient(index, 'raw', event.target.value)} placeholder="2 tbsp olive oil" /></label><label className="field"><span>Ingredient</span><input value={item.name} onChange={(event) => updateIngredient(index, 'name', event.target.value)} placeholder="Olive oil" /></label><label className="field field--small"><span>Quantity</span><input type="number" min="0" step="any" value={item.quantity} onChange={(event) => updateIngredient(index, 'quantity', event.target.value)} /></label><label className="field"><span>Unit</span><input value={item.unit} onChange={(event) => updateIngredient(index, 'unit', event.target.value)} placeholder="tablespoon" /></label><label className="field field--small"><span>Symbol</span><input value={item.symbol} onChange={(event) => updateIngredient(index, 'symbol', event.target.value)} placeholder="tbsp" /></label><label className="field"><span>Type</span><select value={item.dimension} onChange={(event) => updateIngredient(index, 'dimension', event.target.value)}><option value="count">Count</option><option value="mass">Mass</option><option value="volume">Volume</option></select></label>{ingredients.length > 1 && <button className="remove-button" type="button" onClick={() => setIngredients((rows) => rows.filter((_, current) => current !== index))}>Remove</button>}</div>)}
      </div></fieldset>
      <fieldset hidden={step !== 2}><div className="fieldset-heading"><legend>Instructions</legend><button className="text-button" type="button" onClick={() => setInstructions((steps) => [...steps, ''])}>+ Add step</button></div><div className="repeat-list">{instructions.map((instruction, index) => <div className="instruction-row" key={index}><span>{index + 1}</span><textarea rows={2} value={instruction} onChange={(event) => setInstructions((currentInstructions) => currentInstructions.map((value, current) => current === index ? event.target.value : value))} placeholder="Describe this step" />{instructions.length > 1 && <button className="remove-button" type="button" onClick={() => setInstructions((currentInstructions) => currentInstructions.filter((_, current) => current !== index))}>Remove</button>}</div>)}</div></fieldset>
      <fieldset hidden={step !== 3}><legend>Review recipe</legend><div className="recipe-review"><div><small>Recipe</small><strong>{recipeName}</strong></div><div><small>Types</small><strong>{selectedRecipeTypes.join(', ')}</strong></div><div><small>Suitable for</small><strong>{selectedMealTypes.join(', ') || 'Not selected'}</strong></div><div><small>Photo</small><strong>{photo?.name || 'No photo'}</strong></div><div><small>Ingredients</small><strong>{ingredients.filter((item) => item.raw.trim()).length}</strong></div><div><small>Instructions</small><strong>{instructions.filter((item) => item.trim()).length}</strong></div></div><p className="muted">Go back to any earlier step if something needs changing, or save the completed recipe.</p></fieldset>
      {error && <p className="notice notice--error" role="alert">{error}</p>}<div className="form-actions">{step === 0 ? <Link className="button" to="/recipes">Cancel</Link> : <button className="button" type="button" onClick={() => { setError(''); setStep((current) => current - 1) }}>Back</button>}{step < steps.length - 1 ? <button className="button button--primary" type="button" onClick={continueToNextStep}>Continue</button> : <button className="button button--primary" disabled={saving}>{saving ? 'Saving…' : 'Save recipe'}</button>}</div>
    </form>
  </section>
}
