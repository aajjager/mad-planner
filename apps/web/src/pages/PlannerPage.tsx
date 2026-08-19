import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { assignMeal, getMealPlanWeek, removeMeal, type MealPlanEntry, type MealType } from '../api/planner'
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

  return <section className="page planner-page">
    <div className="page-heading"><div><p className="eyebrow">Weekly meal planner</p><h1>Plan your week</h1><p>Choose recipes for every meal and adjust the week whenever plans change.</p></div></div>
    <div className="week-toolbar"><button className="button" onClick={() => changeWeek(addDays(weekStart, -7))}>← Previous</button><div><strong>{prettyDate(days[0])} – {prettyDate(days[6])}</strong><button className="text-button" onClick={() => changeWeek(mondayOf(new Date()))}>This week</button></div><button className="button" onClick={() => changeWeek(addDays(weekStart, 7))}>Next →</button></div>
    {state === 'loading' && <p className="notice" role="status">Loading meal plan…</p>}
    {state === 'error' && <p className="notice notice--error" role="alert">The meal plan could not be loaded or updated.</p>}
    {state === 'ready' && recipes.length === 0 && <div className="empty-state"><h2>Add recipes before planning</h2><p>Your saved recipes will appear as choices for each meal.</p><Link className="button button--primary" to="/recipes/import">Import a recipe</Link></div>}
    {state === 'ready' && recipes.length > 0 && <div className="planner-grid">
      <div className="planner-corner">Meal</div>{days.map((day, index) => <div className="planner-day" key={dateKey(day)}><strong>{dayNames[index]}</strong><span>{prettyDate(day)}</span></div>)}
      {mealTypes.map((mealType) => <div className="planner-row" key={mealType}><div className="meal-label">{mealType}</div>{days.map((day) => { const mealDate = dateKey(day); const entry = entries.find((item) => item.meal_date === mealDate && item.meal_type === mealType); const slot = `${mealDate}-${mealType}`; return <label className={`meal-slot${entry ? ' meal-slot--filled' : ''}`} key={slot}><span>{entry?.recipe.name || 'Choose recipe'}</span><select aria-label={`${dayNames[days.indexOf(day)]} ${mealType}`} value={entry?.recipe.id || ''} disabled={saving === slot} onChange={(event) => changeMeal(mealDate, mealType, event.target.value)}><option value="">No meal</option>{recipes.map((recipe) => <option value={recipe.id} key={recipe.id}>{recipe.name}</option>)}</select></label> })}</div>)}
    </div>}
  </section>
}
