import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { assignMeal, getMealPlanWeek, planLeftovers, removeMeal, suggestMealPlanWeek, type MealPlanEntry, type MealSuggestion, type MealType } from '../api/planner'
import { listRecipes, type Recipe } from '../api/recipes'
import { getFamilySettings, type FamilySettings } from '../api/auth'
import { useAuth } from '../auth/AuthContext'
import { localeTag, translator } from '../i18n'
import './PlannerPage.css'

const allMealTypes: MealType[] = ['breakfast', 'lunch', 'dinner']
const pad = (value: number) => String(value).padStart(2, '0')
const dateKey = (value: Date) => `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
const addDays = (value: Date, days: number) => { const result = new Date(value); result.setDate(result.getDate() + days); return result }
const mondayOf = (value: Date) => addDays(value, -((value.getDay() + 6) % 7))
const prettyDate = (value: Date, locale = document.documentElement.lang || 'en') => value.toLocaleDateString(locale, { day: 'numeric', month: 'short' })

export function PlannerPage() {
  const { account } = useAuth()
  const t = translator(account?.locale); const locale = localeTag(account?.locale)
  const canEditPlanner = account?.role === 'owner' || account?.role === 'editor' || account?.role === 'planner'
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()))
  const [entries, setEntries] = useState<MealPlanEntry[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [saving, setSaving] = useState('')
  const [suggestions, setSuggestions] = useState<MealSuggestion[] | null>(null)
  const [selectedMealTypes, setSelectedMealTypes] = useState<MealType[]>(allMealTypes)
  const [familySettings, setFamilySettings] = useState<FamilySettings | null>(null)
  const [preferredTags, setPreferredTags] = useState<string[]>([])
  const [maxTime, setMaxTime] = useState('45')
  const mealTypes = selectedMealTypes
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart])
  const dayNames = days.map((day) => day.toLocaleDateString(locale, { weekday: 'long' }))
  const availableTags = useMemo(() => [...new Set(recipes.flatMap((recipe) => recipe.tags))].sort((a, b) => a.localeCompare(b)), [recipes])

  useEffect(() => {
    Promise.all([getMealPlanWeek(dateKey(weekStart)), listRecipes(), getFamilySettings()])
      .then(([plan, recipeItems, settings]) => { setEntries(plan.entries); setRecipes(recipeItems); setFamilySettings(settings); setSelectedMealTypes(settings.enabled_meal_types); setState('ready') })
      .catch(() => setState('error'))
  }, [weekStart])

  function changeWeek(nextWeek: Date) { setState('loading'); setWeekStart(nextWeek) }
  function toggleTag(tag: string) { setPreferredTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]) }

  async function changeMeal(mealDate: string, mealType: MealType, recipeId: string) {
    if (!canEditPlanner) return
    const slot = `${mealDate}-${mealType}`; setSaving(slot)
    try {
      if (!recipeId) { await removeMeal(mealDate, mealType); setEntries((items) => items.filter((item) => item.meal_date !== mealDate || item.meal_type !== mealType)) }
      else { const entry = await assignMeal(mealDate, mealType, Number(recipeId)); setEntries((items) => [...items.filter((item) => item.meal_date !== mealDate || item.meal_type !== mealType), entry]) }
    } catch { setState('error') } finally { setSaving('') }
  }

  async function planNextLunch(mealDate: string, mealType: MealType) {
    if (!canEditPlanner) return
    const slot = `${mealDate}-${mealType}`; setSaving(slot)
    try { const entry = await planLeftovers(mealDate, mealType); setEntries((items) => [...items.filter((item) => item.meal_date !== entry.meal_date || item.meal_type !== entry.meal_type), entry]) }
    catch { setState('error') } finally { setSaving('') }
  }

  async function generateSuggestions() {
    if (!canEditPlanner) return
    setSaving('suggestions')
    try { const result = await suggestMealPlanWeek(dateKey(weekStart), { meal_types: selectedMealTypes, preferred_tags: preferredTags, max_cooking_time_minutes: maxTime ? Number(maxTime) : undefined, include_leftover_lunches: Boolean(familySettings?.leftovers_enabled) }); setSuggestions(result.suggestions) }
    catch { setState('error') } finally { setSaving('') }
  }

  async function applySuggestions() {
    if (!canEditPlanner) return
    if (!suggestions) return; setSaving('suggestions')
    try {
      for (const item of suggestions.filter((suggestion) => !suggestion.is_leftover)) await assignMeal(item.meal_date, item.meal_type, item.recipe.id)
      for (const item of suggestions.filter((suggestion) => suggestion.is_leftover && suggestion.source_date)) await planLeftovers(item.source_date!, 'dinner')
      const plan = await getMealPlanWeek(dateKey(weekStart)); setEntries(plan.entries); setSuggestions(null)
    } catch { setState('error') } finally { setSaving('') }
  }

  return <section className={`page planner-page${!canEditPlanner ? ' planner-page--readonly' : ''}`}>
    <div className="page-heading"><div><p className="eyebrow">{t('weeklyPlanner')}</p><h1>{t('planYourWeek')}</h1><p>{t('plannerIntro')}</p></div></div>
    {!canEditPlanner && <p className="notice">You have read-only access to this family planner.</p>}
    <div className="week-toolbar"><button className="button" onClick={() => changeWeek(addDays(weekStart, -7))}>← {t('previous')}</button><div><strong>{prettyDate(days[0], locale)} – {prettyDate(days[6], locale)}</strong><button className="text-button" onClick={() => changeWeek(mondayOf(new Date()))}>{t('thisWeek')}</button><Link className="text-button" to={`/grocery-list?week=${dateKey(weekStart)}`}>{t('groceryList')}</Link></div><button className="button" onClick={() => changeWeek(addDays(weekStart, 7))}>{t('next')} →</button></div>
    {state === 'ready' && recipes.length > 0 && <section className="smart-planner"><div className="smart-planner__heading"><div><p className="eyebrow">{t('smartPlanning')}</p><h2>{t('variedWeek')}</h2></div><button className="button button--primary" disabled={saving === 'suggestions'} onClick={generateSuggestions}>{saving === 'suggestions' ? t('working') : t('suggestWeek')}</button></div><div className="preference-group"><span>{t('familyPlannerSettings')}</span><div className="choice-chips">{selectedMealTypes.map((mealType) => <span className="choice-chip choice-chip--selected" key={mealType}>{t(mealType)}</span>)}</div><small>{familySettings?.household_size} {t('people')} · {t('leftovers')} {familySettings?.leftovers_enabled ? t('enabled') : t('disabled')} · {t('changeInFamily')}</small></div><div className="preference-group"><span>{t('preferredTags')}</span>{availableTags.length > 0 ? <div className="choice-chips">{availableTags.map((tag) => <button type="button" className={`choice-chip${preferredTags.includes(tag) ? ' choice-chip--selected' : ''}`} aria-pressed={preferredTags.includes(tag)} onClick={() => toggleTag(tag)} key={tag}>{tag}</button>)}</div> : <small>{t('addTagsHelp')}</small>}</div><div className="smart-preferences"><label className="field"><span>{t('maximumTime')}</span><select value={maxTime} onChange={(event) => setMaxTime(event.target.value)}><option value="30">30 {t('minutes')}</option><option value="45">45 {t('minutes')}</option><option value="60">60 {t('minutes')}</option><option value="">{t('noLimit')}</option></select></label></div>{suggestions && <div className="suggestion-review"><div className="suggestion-review__heading"><div><strong>{t('review')} {suggestions.length} {t('suggestions')}</strong><span>{t('existingMealsSafe')}</span></div><div><button className="button" onClick={() => setSuggestions(null)}>{t('cancel')}</button><button className="button button--primary" onClick={applySuggestions}>{t('applySuggestions')}</button></div></div><div className="suggestion-list">{suggestions.map((item) => <div className={`suggestion-item${item.is_leftover ? ' suggestion-item--leftover' : ''}`} key={`${item.meal_date}-${item.meal_type}`}><span>{item.meal_date.slice(5)}</span><strong>{item.recipe.name}</strong><small>{item.is_leftover ? t('leftoverLunch') : item.reasons.join(' · ')}</small></div>)}</div></div>}</section>}
    {state === 'loading' && <p className="notice" role="status">{t('loadingPlan')}</p>}
    {state === 'error' && <p className="notice notice--error" role="alert">{t('planError')}</p>}
    {state === 'ready' && recipes.length === 0 && <div className="empty-state"><h2>Add recipes before planning</h2><p>Your saved recipes will appear as choices for each meal.</p><Link className="button button--primary" to="/recipes/import">Import a recipe</Link></div>}
    {state === 'ready' && recipes.length > 0 && <div className="planner-grid">
      <div className="planner-corner">{t('meal')}</div>{days.map((day, index) => <div className="planner-day" key={dateKey(day)}><strong>{dayNames[index]}</strong><span>{prettyDate(day, locale)}</span></div>)}
      {mealTypes.map((mealType) => <div className="planner-row" key={mealType}><div className="meal-label">{t(mealType)}</div>{days.map((day) => { const mealDate = dateKey(day); const entry = entries.find((item) => item.meal_date === mealDate && item.meal_type === mealType); const slot = `${mealDate}-${mealType}`; const hasLeftovers = Boolean(entry?.servings && familySettings && Number(entry.servings) > familySettings.household_size); return <div className={`meal-slot${entry ? ' meal-slot--filled' : ''}${entry?.is_leftover ? ' meal-slot--leftover' : ''}`} key={slot}>{entry?.is_leftover && <small className="leftover-badge">{t('leftovers')}</small>}<span>{entry?.recipe.name || t('chooseRecipe')}</span><select aria-label={`${dayNames[days.indexOf(day)]} ${t(mealType)}`} value={entry?.recipe.id || ''} disabled={saving === slot} onChange={(event) => changeMeal(mealDate, mealType, event.target.value)}><option value="">{t('noMeal')}</option>{recipes.map((recipe) => <option value={recipe.id} key={recipe.id}>{recipe.name}</option>)}</select>{familySettings?.leftovers_enabled && selectedMealTypes.includes('lunch') && mealType === 'dinner' && entry && !entry.is_leftover && hasLeftovers && <button className="leftover-button" disabled={saving === slot} onClick={() => planNextLunch(mealDate, mealType)}>{t('leftoversToLunch')}</button>}</div> })}</div>)}
    </div>}
  </section>
}
