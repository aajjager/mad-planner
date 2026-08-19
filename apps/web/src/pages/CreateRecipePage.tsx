import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createRecipe, type RecipeIngredientInput, type RecipeWrite, type UnitDimension } from '../api/recipes'

interface IngredientRow { raw: string; name: string; quantity: string; unit: string; symbol: string; dimension: UnitDimension }
const emptyIngredient = (): IngredientRow => ({ raw: '', name: '', quantity: '', unit: '', symbol: '', dimension: 'count' })

export function CreateRecipePage() {
  const navigate = useNavigate()
  const [ingredients, setIngredients] = useState([emptyIngredient()])
  const [instructions, setInstructions] = useState([''])
  const [saving, setSaving] = useState(false); const [error, setError] = useState('')
  const updateIngredient = (index: number, field: keyof IngredientRow, value: string) => setIngredients((rows) => rows.map((row, current) => current === index ? { ...row, [field]: value } : row))

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget)
    const text = (name: string) => String(form.get(name) || '').trim() || undefined
    const minutes = (name: string) => { const value = String(form.get(name) || ''); return value ? Number(value) : undefined }
    const items: RecipeIngredientInput[] = ingredients.filter((item) => item.raw.trim()).map((item) => ({ raw_text: item.raw.trim(), ingredient_name: item.name.trim() || undefined, quantity: item.quantity || undefined, unit: item.unit.trim() && item.symbol.trim() ? { name: item.unit.trim(), symbol: item.symbol.trim(), dimension: item.dimension } : undefined }))
    const payload: RecipeWrite = { name: String(form.get('name')).trim(), description: text('description'), source_url: text('source_url'), author: text('author'), servings: text('servings'), cuisine: text('cuisine'), category: text('category'), preparation_time_minutes: minutes('preparation'), cooking_time_minutes: minutes('cooking'), total_time_minutes: minutes('total'), ingredients: items, instructions: instructions.filter((step) => step.trim()).map((step) => ({ text: step.trim() })) }
    setSaving(true); setError('')
    try { const recipe = await createRecipe(payload); navigate(`/recipes/${recipe.id}`) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The recipe could not be saved.'); setSaving(false) }
  }

  return <section className="page form-page">
    <Link className="back-link" to="/recipes">← Cancel</Link>
    <div className="page-heading"><div><p className="eyebrow">Manual recipe</p><h1>Add a recipe</h1><p>Preserve the original ingredient text while adding useful structure.</p></div></div>
    <form onSubmit={submit}>
      <fieldset><legend>Recipe details</legend><div className="form-grid">
        <label className="field field--wide"><span>Name *</span><input name="name" required maxLength={300} /></label>
        <label className="field field--wide"><span>Description</span><textarea name="description" rows={3} /></label>
        <label className="field"><span>Servings</span><input name="servings" type="number" min="0.01" step="0.01" /></label><label className="field"><span>Cuisine</span><input name="cuisine" /></label><label className="field"><span>Category</span><input name="category" placeholder="Dinner" /></label><label className="field"><span>Author</span><input name="author" /></label>
        <label className="field"><span>Preparation minutes</span><input name="preparation" type="number" min="0" /></label><label className="field"><span>Cooking minutes</span><input name="cooking" type="number" min="0" /></label><label className="field"><span>Total minutes</span><input name="total" type="number" min="0" /></label>
        <label className="field field--wide"><span>Source URL</span><input name="source_url" type="url" /></label>
      </div></fieldset>
      <fieldset><div className="fieldset-heading"><legend>Ingredients</legend><button className="text-button" type="button" onClick={() => setIngredients((rows) => [...rows, emptyIngredient()])}>+ Add ingredient</button></div><div className="repeat-list">
        {ingredients.map((item, index) => <div className="ingredient-row" key={index}><label className="field field--wide"><span>Original text *</span><input value={item.raw} onChange={(event) => updateIngredient(index, 'raw', event.target.value)} placeholder="2 tbsp olive oil" /></label><label className="field"><span>Ingredient</span><input value={item.name} onChange={(event) => updateIngredient(index, 'name', event.target.value)} placeholder="Olive oil" /></label><label className="field field--small"><span>Quantity</span><input type="number" min="0" step="any" value={item.quantity} onChange={(event) => updateIngredient(index, 'quantity', event.target.value)} /></label><label className="field"><span>Unit</span><input value={item.unit} onChange={(event) => updateIngredient(index, 'unit', event.target.value)} placeholder="tablespoon" /></label><label className="field field--small"><span>Symbol</span><input value={item.symbol} onChange={(event) => updateIngredient(index, 'symbol', event.target.value)} placeholder="tbsp" /></label><label className="field"><span>Type</span><select value={item.dimension} onChange={(event) => updateIngredient(index, 'dimension', event.target.value)}><option value="count">Count</option><option value="mass">Mass</option><option value="volume">Volume</option></select></label>{ingredients.length > 1 && <button className="remove-button" type="button" onClick={() => setIngredients((rows) => rows.filter((_, current) => current !== index))}>Remove</button>}</div>)}
      </div></fieldset>
      <fieldset><div className="fieldset-heading"><legend>Instructions</legend><button className="text-button" type="button" onClick={() => setInstructions((steps) => [...steps, ''])}>+ Add step</button></div><div className="repeat-list">{instructions.map((step, index) => <div className="instruction-row" key={index}><span>{index + 1}</span><textarea rows={2} value={step} onChange={(event) => setInstructions((steps) => steps.map((value, current) => current === index ? event.target.value : value))} placeholder="Describe this step" />{instructions.length > 1 && <button className="remove-button" type="button" onClick={() => setInstructions((steps) => steps.filter((_, current) => current !== index))}>Remove</button>}</div>)}</div></fieldset>
      {error && <p className="notice notice--error" role="alert">{error}</p>}<div className="form-actions"><Link className="button" to="/recipes">Cancel</Link><button className="button button--primary" disabled={saving}>{saving ? 'Saving…' : 'Save recipe'}</button></div>
    </form>
  </section>
}
