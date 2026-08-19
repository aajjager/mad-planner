import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { assignMeal, getMealPlanWeek, planLeftovers, removeMeal, suggestMealPlanWeek, type MealPlanEntry, type MealSuggestion, type MealType } from '../api/planner'
import { listRecipes, type Recipe } from '../api/recipes'
import './PlannerPage.css'

const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner']
const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const pad = (value: number) => String(value).padStart(2, '0')
const dateKey = (value: Date) => `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
const addDays = (value: Date, days: number) => { const result = new Date(value); result.setDate(result.getDate() + days); return result }
const mondayOf = (value: Date) => addDays(value, -((value.getDay() + 6) % 7))
const prettyDate = (value: Date) => value.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

export function PlannerPage() {
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()))
  const [entries, setEntries] = useState<MealPlanEntry[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [saving, setSaving] = useState('')
  const [suggestions, setSuggestions] = useState<MealSuggestion[] | null>(null)
  const [preferredTags, setPreferredTags] = useState('')
  const [maxTime, setMaxTime] = useState('45')
  const [includeLeftovers, setIncludeLeftovers] = useState(true)
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart])

  useEffect(() => {
    Promise.all([getMealPlanWeek(dateKey(weekStart)), listRecipes()])
      .then(([plan, recipeItems]) => { setEntries(plan.entries); setRecipes(recipeItems); setState('ready') })
      .catch(() => setState('error'))
  }, [weekStart])

  function changeWeek(nextWeek: Date) { setState('loading'); setWeekStart(nextWeek) }

  async function changeMeal(mealDate: string, mealType: MealType, recipeId: string) {
    const slot = `${mealDate}-${mealType}`; setSaving(slot)
    try {
      if (!recipeId) { await removeMeal(mealDate, mealType); setEntries((items) => items.filter((item) => item.meal_date !== mealDate || item.meal_type !== mealType)) }
      else { const entry = await assignMeal(mealDate, mealType, Number(recipeId)); setEntries((items) => [...items.filter((item) => item.meal_date !== mealDate || item.meal_type !== mealType), entry]) }
    } catch { setState('error') } finally { setSaving('') }
  }

  async function planNextLunch(mealDate: string, mealType: MealType) {
    const slot = `${mealDate}-${mealType}`; setSaving(slot)
    try { const entry = await planLeftovers(mealDate, mealType); setEntries((items) => [...items.filter((item) => item.meal_date !== entry.meal_date || item.meal_type !== entry.meal_type), entry]) }
    catch { setState('error') } finally { setSaving('') }
  }

  async function generateSuggestions() {
    setSaving('suggestions')
    try { const result = await suggestMealPlanWeek(dateKey(weekStart), { meal_types: ['dinner'], preferred_tags: preferredTags.split(',').map((tag) => tag.trim()).filter(Boolean), max_cooking_time_minutes: maxTime ? Number(maxTime) : undefined, include_leftover_lunches: includeLeftovers }); setSuggestions(result.suggestions) }
    catch { setState('error') } finally { setSaving('') }
  }

  async function applySuggestions() {
    if (!suggestions) return; setSaving('suggestions')
    try {
      for (const item of suggestions.filter((suggestion) => !suggestion.is_leftover)) await assignMeal(item.meal_date, item.meal_type, item.recipe.id)
      for (const item of suggestions.filter((suggestion) => suggestion.is_leftover && suggestion.source_date)) await planLeftovers(item.source_date!, 'dinner')
      const plan = await getMealPlanWeek(dateKey(weekStart)); setEntries(plan.entries); setSuggestions(null)
    } catch { setState('error') } finally { setSaving('') }
  }

  return <section className="page planner-page">
    <div className="page-heading"><div><p className="eyebrow">Weekly meal planner</p><h1>Plan your week</h1><p>Choose recipes for every meal and adjust the week whenever plans change.</p></div></div>
    <div className="week-toolbar"><button className="button" onClick={() => changeWeek(addDays(weekStart, -7))}>← Previous</button><div><strong>{prettyDate(days[0])} – {prettyDate(days[6])}</strong><button className="text-button" onClick={() => changeWeek(mondayOf(new Date()))}>This week</button><Link className="text-button" to={`/grocery-list?week=${dateKey(weekStart)}`}>Grocery list</Link></div><button className="button" onClick={() => changeWeek(addDays(weekStart, 7))}>Next →</button></div>
    {state === 'ready' && recipes.length > 0 && <section className="smart-planner"><div className="smart-planner__heading"><div><p className="eyebrow">Smart planning</p><h2>Build a varied dinner week</h2></div><button className="button button--primary" disabled={saving === 'suggestions'} onClick={generateSuggestions}>{saving === 'suggestions' ? 'Working…' : 'Suggest my week'}</button></div><div className="smart-preferences"><label className="field"><span>Preferred tags</span><input value={preferredTags} onChange={(event) => setPreferredTags(event.target.value)} placeholder="Vegetarisk, Hurtig" /></label><label className="field"><span>Maximum total time</span><select value={maxTime} onChange={(event) => setMaxTime(event.target.value)}><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">60 minutes</option><option value="">No limit</option></select></label><label className="leftover-option"><input type="checkbox" checked={includeLeftovers} onChange={(event) => setIncludeLeftovers(event.target.checked)} /> Plan dinner leftovers for lunch</label></div>{suggestions && <div className="suggestion-review"><div className="suggestion-review__heading"><div><strong>Review {suggestions.length} suggestions</strong><span>Existing meals will not be replaced.</span></div><div><button className="button" onClick={() => setSuggestions(null)}>Cancel</button><button className="button button--primary" onClick={applySuggestions}>Apply suggestions</button></div></div><div className="suggestion-list">{suggestions.map((item) => <div className={`suggestion-item${item.is_leftover ? ' suggestion-item--leftover' : ''}`} key={`${item.meal_date}-${item.meal_type}`}><span>{item.meal_date.slice(5)}</span><strong>{item.recipe.name}</strong><small>{item.is_leftover ? 'Leftover lunch' : item.reasons.join(' · ')}</small></div>)}</div></div>}</section>}
    {state === 'loading' && <p className="notice" role="status">Loading meal plan…</p>}
    {state === 'error' && <p className="notice notice--error" role="alert">The meal plan could not be loaded or updated.</p>}
    {state === 'ready' && recipes.length === 0 && <div className="empty-state"><h2>Add recipes before planning</h2><p>Your saved recipes will appear as choices for each meal.</p><Link className="button button--primary" to="/recipes/import">Import a recipe</Link></div>}
    {state === 'ready' && recipes.length > 0 && <div className="planner-grid">
      <div className="planner-corner">Meal</div>{days.map((day, index) => <div className="planner-day" key={dateKey(day)}><strong>{dayNames[index]}</strong><span>{prettyDate(day)}</span></div>)}
      {mealTypes.map((mealType) => <div className="planner-row" key={mealType}><div className="meal-label">{mealType}</div>{days.map((day) => { const mealDate = dateKey(day); const entry = entries.find((item) => item.meal_date === mealDate && item.meal_type === mealType); const slot = `${mealDate}-${mealType}`; return <div className={`meal-slot${entry ? ' meal-slot--filled' : ''}${entry?.is_leftover ? ' meal-slot--leftover' : ''}`} key={slot}>{entry?.is_leftover && <small className="leftover-badge">Leftovers</small>}<span>{entry?.recipe.name || 'Choose recipe'}</span><select aria-label={`${dayNames[days.indexOf(day)]} ${mealType}`} value={entry?.recipe.id || ''} disabled={saving === slot} onChange={(event) => changeMeal(mealDate, mealType, event.target.value)}><option value="">No meal</option>{recipes.map((recipe) => <option value={recipe.id} key={recipe.id}>{recipe.name}</option>)}</select>{mealType === 'dinner' && entry && !entry.is_leftover && <button className="leftover-button" disabled={saving === slot} onClick={() => planNextLunch(mealDate, mealType)}>Leftovers → lunch</button>}</div> })}</div>)}
    </div>}
  </section>
}
