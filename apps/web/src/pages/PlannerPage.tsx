import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { assignMeal, excludeMeal, getMealPlanWeek, includeMeal, planLeftovers, removeMeal, suggestMealPlanWeek, type MealPlanEntry, type MealPlanExclusion, type MealSuggestion, type MealSuggestionOption, type MealType } from '../api/planner'
import { listRecipes, type Recipe } from '../api/recipes'
import { getFamilySettings, type FamilySettings } from '../api/auth'
import { useAuth } from '../auth/AuthContext'
import { localeTag, translator } from '../i18n'
import { RecipePicker } from '../components/RecipePicker'
import { PlanningPreferencePicker } from '../components/PlanningPreferencePicker'
import './PlannerPage.css'

const allMealTypes: MealType[] = ['breakfast', 'lunch', 'dinner']
const pad = (value: number) => String(value).padStart(2, '0')
const dateKey = (value: Date) => `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
const addDays = (value: Date, days: number) => { const result = new Date(value); result.setDate(result.getDate() + days); return result }
const mondayOf = (value: Date) => addDays(value, -((value.getDay() + 6) % 7))
const parseWeek = (value: string | null) => { if (!value) return mondayOf(new Date()); const [year, month, day] = value.split('-').map(Number); return mondayOf(new Date(year, month - 1, day)) }
const prettyDate = (value: Date, locale = document.documentElement.lang || 'en') => value.toLocaleDateString(locale, { day: 'numeric', month: 'short' })
const signalPlanChanged = () => window.dispatchEvent(new Event('madplanner:plan-changed'))
const hiddenPlanningFilters = new Set([
  'aftensmad', 'dinner', 'frokost', 'lunch', 'morgenmad', 'breakfast', 'brunch', 'hovedret', 'hovedretter',
  'forret', 'forretter', 'dessert', 'desserter', 'cake', 'kage', 'bake-off', 'bread', 'brød', 'snack', 'snacks',
  'buffet', 'tilbehør', 'side dish', 'madpakke', 'mellemmåltid', 'dip og dressinger', 'salater', 'salad', 'soup', 'suppe',
  'salt', 'groft salt', 'peber', 'friskkværnet peber', 'vand', 'water', 'olie', 'oil', 'smør', 'butter', 'sukker', 'sugar',
])
const planningQuantity = '[0-9.,½¼¾⅓⅔⅛/-]+'
const planningUnit = '(?:mg|g|kg|ml|cl|dl|l|tsk|teskefulde?|spsk|spk|spiseskefulde?|stk|styk(?:ker)?|fed|dåser?|ds|pakker?|pk|bundter?|knivspids(?:er)?)'
const cleanPlanningIngredient = (value: string) => value
  .replace(new RegExp(`^\\s*${planningQuantity}(?:\\s*[-–]\\s*${planningQuantity})?\\s*(?:${planningUnit})?\\.?\\s+`, 'iu'), '')
  .replace(new RegExp(`[,;]?\\s+${planningQuantity}(?:\\s*[-–]\\s*${planningQuantity})?\\s*${planningUnit}\\.?\\s*$`, 'iu'), '')
  .replace(/\s*\([^)]*(?:\d|\b(?:g|kg|ml|dl|tsk|spsk|stk)\b)[^)]*\)\s*$/iu, '')
  .replace(/^[,;\s]+|[,;\s]+$/g, '')
const usefulPlanningFilter = (value: string) => {
  const normalized = value.trim().toLocaleLowerCase()
  return normalized.length > 2 && normalized.length < 35 && normalized.split(/\s+/).length <= 4 && !hiddenPlanningFilters.has(normalized)
}

export function PlannerPage() {
  const { account } = useAuth()
  const t = translator(account?.locale); const locale = localeTag(account?.locale)
  const canEditPlanner = account?.role === 'owner' || account?.role === 'editor' || account?.role === 'planner'
  const [params, setParams] = useSearchParams()
  const [weekStart, setWeekStart] = useState(() => parseWeek(params.get('week')))
  const [entries, setEntries] = useState<MealPlanEntry[]>([])
  const [exclusions, setExclusions] = useState<MealPlanExclusion[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [saving, setSaving] = useState('')
  const [suggestionOptions, setSuggestionOptions] = useState<MealSuggestionOption[] | null>(null)
  const [selectedOptionId, setSelectedOptionId] = useState('')
  const [selectedMealTypes, setSelectedMealTypes] = useState<MealType[]>(allMealTypes)
  const [familySettings, setFamilySettings] = useState<FamilySettings | null>(null)
  const [preferredTags, setPreferredTags] = useState<string[]>([])
  const [maxTime, setMaxTime] = useState('45')
  const mealTypes = selectedMealTypes
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart])
  const dayNames = days.map((day) => day.toLocaleDateString(locale, { weekday: 'long' }))
  const availableTags = useMemo(() => [...new Set(recipes.flatMap((recipe) => [
    ...recipe.tags,
    ...(recipe.cuisine ? recipe.cuisine.split(',').map((value) => value.trim()) : []),
    ...recipe.ingredients.map((ingredient) => cleanPlanningIngredient(ingredient.ingredient_name || '')).filter(Boolean),
  ]).filter(usefulPlanningFilter))].sort((a, b) => a.localeCompare(b)), [recipes])
  const optionTitle = (id: string) => id === 'option-1' ? t('bestMatch') : id === 'option-2' ? t('moreVariety') : t('seasonalMix')
  const optionFocus = (id: string) => id === 'option-1' ? t('bestMatchHelp') : id === 'option-2' ? t('moreVarietyHelp') : t('seasonalMixHelp')

  useEffect(() => {
    Promise.all([getMealPlanWeek(dateKey(weekStart)), listRecipes(), getFamilySettings()])
      .then(([plan, recipeItems, settings]) => { setEntries(plan.entries); setExclusions(plan.exclusions || []); setRecipes(recipeItems); setFamilySettings(settings); setSelectedMealTypes(settings.enabled_meal_types); setState('ready') })
      .catch(() => setState('error'))
  }, [weekStart])

  function changeWeek(nextWeek: Date) { setState('loading'); setWeekStart(nextWeek); setParams({ week: dateKey(nextWeek) }) }
  function toggleTag(tag: string) { setPreferredTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]) }

  async function changeMeal(mealDate: string, mealType: MealType, recipeId: string) {
    if (!canEditPlanner) return
    const slot = `${mealDate}-${mealType}`; setSaving(slot)
    try {
      if (!recipeId) { await removeMeal(mealDate, mealType); setEntries((items) => items.filter((item) => item.meal_date !== mealDate || item.meal_type !== mealType)) }
      else { const entry = await assignMeal(mealDate, mealType, Number(recipeId)); setEntries((items) => [...items.filter((item) => item.meal_date !== mealDate || item.meal_type !== mealType), entry]) }
      signalPlanChanged()
    } catch { setState('error') } finally { setSaving('') }
  }

  async function planNextLunch(mealDate: string, mealType: MealType) {
    if (!canEditPlanner) return
    const slot = `${mealDate}-${mealType}`; setSaving(slot)
    try { const entry = await planLeftovers(mealDate, mealType); setEntries((items) => [...items.filter((item) => item.meal_date !== entry.meal_date || item.meal_type !== entry.meal_type), entry]); signalPlanChanged() }
    catch { setState('error') } finally { setSaving('') }
  }

  async function toggleExcluded(mealDate: string, mealType: MealType, excluded: boolean) {
    if (!canEditPlanner) return
    const slot = `${mealDate}-${mealType}`; setSaving(slot)
    try {
      if (excluded) { await includeMeal(mealDate, mealType); setExclusions((items) => items.filter((item) => item.meal_date !== mealDate || item.meal_type !== mealType)) }
      else { const exclusion = await excludeMeal(mealDate, mealType); setEntries((items) => items.filter((item) => item.meal_date !== mealDate || item.meal_type !== mealType)); setExclusions((items) => [...items.filter((item) => item.meal_date !== mealDate || item.meal_type !== mealType), exclusion]) }
      signalPlanChanged()
    } catch { setState('error') } finally { setSaving('') }
  }

  async function generateSuggestions() {
    if (!canEditPlanner) return
    setSaving('suggestions')
    try {
      const result = await suggestMealPlanWeek(dateKey(weekStart), { meal_types: selectedMealTypes, preferred_tags: preferredTags, max_cooking_time_minutes: maxTime ? Number(maxTime) : undefined, include_leftover_lunches: Boolean(familySettings?.leftovers_enabled) })
      if (familySettings?.planning_suggestion_mode === 'auto' && result.options[0]) await applySuggestionItems(result.options[0].suggestions)
      else { setSuggestionOptions(result.options); setSelectedOptionId(result.options[0]?.id || '') }
    }
    catch { setState('error') } finally { setSaving('') }
  }

  async function applySuggestionItems(suggestions: MealSuggestion[]) {
    for (const item of suggestions.filter((suggestion) => !suggestion.is_leftover)) await assignMeal(item.meal_date, item.meal_type, item.recipe.id)
    for (const item of suggestions.filter((suggestion) => suggestion.is_leftover && suggestion.source_date)) await planLeftovers(item.source_date!, 'dinner')
    const plan = await getMealPlanWeek(dateKey(weekStart)); setEntries(plan.entries); setExclusions(plan.exclusions || []); setSuggestionOptions(null); signalPlanChanged()
  }

  async function applySuggestions() {
    if (!canEditPlanner) return
    const suggestions = suggestionOptions?.find((option) => option.id === selectedOptionId)?.suggestions
    if (!suggestions) return; setSaving('suggestions')
    try {
      await applySuggestionItems(suggestions)
    } catch { setState('error') } finally { setSaving('') }
  }

  return <section className={`page planner-page${!canEditPlanner ? ' planner-page--readonly' : ''}`}>
    <div className="page-heading"><div><p className="eyebrow">{t('weeklyPlanner')}</p><h1>{t('planYourWeek')}</h1><p>{t('plannerIntro')}</p></div></div>
    {!canEditPlanner && <p className="notice">You have read-only access to this family planner.</p>}
    <div className="week-toolbar"><button className="button" onClick={() => changeWeek(addDays(weekStart, -7))}>← {t('previous')}</button><div><strong>{prettyDate(days[0], locale)} – {prettyDate(days[6], locale)}</strong><button className="text-button" onClick={() => changeWeek(mondayOf(new Date()))}>{t('thisWeek')}</button><Link className="text-button" to={`/grocery-list?week=${dateKey(weekStart)}`}>{t('groceryList')}</Link></div><button className="button" onClick={() => changeWeek(addDays(weekStart, 7))}>{t('next')} →</button></div>
    {state === 'ready' && recipes.length > 0 && <section className="smart-planner"><div className="smart-planner__heading"><div><p className="eyebrow">{t('smartPlanning')}</p><h2>{t('variedWeek')}</h2></div><button className="button button--primary" disabled={saving === 'suggestions'} onClick={generateSuggestions}>{saving === 'suggestions' ? t('working') : t('suggestWeek')}</button></div><div className="preference-group"><span>{t('familyPlannerSettings')}</span><div className="choice-chips">{selectedMealTypes.map((mealType) => <span className="choice-chip choice-chip--selected" key={mealType}>{t(mealType)}</span>)}</div><small>{familySettings?.household_size} {t('people')} · {t('leftovers')} {familySettings?.leftovers_enabled ? t('enabled') : t('disabled')} · {t('changeInFamily')}</small></div><PlanningPreferencePicker available={availableTags} selected={preferredTags} onToggle={toggleTag} labels={{ title: t('preferredTags'), search: t('searchPlanningPreferences'), suggestions: t('randomSuggestions'), selected: t('selectedPreferences'), showDifferent: t('showDifferentSuggestions'), noMatches: t('noPreferenceMatches') }} /><div className="smart-preferences"><label className="field"><span>{t('maximumTime')}</span><select value={maxTime} onChange={(event) => setMaxTime(event.target.value)}><option value="30">30 {t('minutes')}</option><option value="45">45 {t('minutes')}</option><option value="60">60 {t('minutes')}</option><option value="">{t('noLimit')}</option></select></label></div>{suggestionOptions && <div className="suggestion-review"><div className="suggestion-review__heading"><div><strong>{t('chooseWeekPlan')}</strong><span>{t('existingMealsSafe')}</span></div><div><button className="button" onClick={() => setSuggestionOptions(null)}>{t('cancel')}</button><button className="button button--primary" disabled={!selectedOptionId} onClick={applySuggestions}>{t('applySuggestions')}</button></div></div><div className="suggestion-options">{suggestionOptions.map((option, index) => <button type="button" className={`suggestion-option${selectedOptionId === option.id ? ' suggestion-option--selected' : ''}`} aria-pressed={selectedOptionId === option.id} onClick={() => setSelectedOptionId(option.id)} key={option.id}><span>{t('option')} {index + 1}</span><strong>{optionTitle(option.id)}</strong><small>{optionFocus(option.id)}</small><b>{option.suggestions.filter((item) => !item.is_leftover).length} {t('plannedMeals')}</b></button>)}</div><div className="suggestion-list">{(suggestionOptions.find((option) => option.id === selectedOptionId)?.suggestions || []).map((item) => <div className={`suggestion-item${item.is_leftover ? ' suggestion-item--leftover' : ''}`} key={`${item.meal_date}-${item.meal_type}`}><span>{item.meal_date.slice(5)}</span><strong>{item.recipe.name}</strong><small>{item.is_leftover ? t('leftoverLunch') : item.reasons.join(' · ')}</small></div>)}</div></div>}</section>}
    {state === 'loading' && <p className="notice" role="status">{t('loadingPlan')}</p>}
    {state === 'error' && <p className="notice notice--error" role="alert">{t('planError')}</p>}
    {state === 'ready' && recipes.length === 0 && <div className="empty-state"><h2>Add recipes before planning</h2><p>Your saved recipes will appear as choices for each meal.</p><Link className="button button--primary" to="/recipes/import">Import a recipe</Link></div>}
    {state === 'ready' && recipes.length > 0 && <div className="planner-grid">
      <div className="planner-corner">{t('meal')}</div>{days.map((day, index) => <div className="planner-day" key={dateKey(day)}><strong>{dayNames[index]}</strong><span>{prettyDate(day, locale)}</span></div>)}
      {mealTypes.map((mealType) => <div className="planner-row" key={mealType}><div className="meal-label">{t(mealType)}</div>{days.map((day) => { const mealDate = dateKey(day); const entry = entries.find((item) => item.meal_date === mealDate && item.meal_type === mealType); const excluded = exclusions.some((item) => item.meal_date === mealDate && item.meal_type === mealType); const selectedRecipe = recipes.find((recipe) => recipe.id === entry?.recipe.id) || null; const slot = `${mealDate}-${mealType}`; const hasLeftovers = Boolean(entry?.servings && familySettings && Number(entry.servings) > familySettings.household_size); return <div className={`meal-slot${entry ? ' meal-slot--filled' : ''}${entry?.is_leftover ? ' meal-slot--leftover' : ''}${excluded ? ' meal-slot--excluded' : ''}`} key={slot}>{entry?.is_leftover && <small className="leftover-badge">{t('leftovers')}</small>}<span>{excluded ? t('awayOrEatingOut') : entry?.recipe.name || t('chooseRecipe')}</span>{entry && !excluded && <Link className="meal-recipe-link" to={`/recipes/${entry.recipe.id}`}>{t('viewPlannedRecipe')} →</Link>}{!excluded && <RecipePicker recipes={recipes} selected={selectedRecipe} label={`${dayNames[days.indexOf(day)]} ${t(mealType)}`} placeholder={t('searchForRecipe')} clearLabel={t('clearMeal')} disabled={saving === slot || !canEditPlanner} onSelect={(recipeId) => void changeMeal(mealDate, mealType, recipeId)} />}{canEditPlanner && <button type="button" className="exclude-slot-button" disabled={saving === slot} onClick={() => void toggleExcluded(mealDate, mealType, excluded)}>{excluded ? t('restoreMealSlot') : t('excludeMealSlot')}</button>}{familySettings?.leftovers_enabled && selectedMealTypes.includes('lunch') && mealType === 'dinner' && entry && !entry.is_leftover && !excluded && hasLeftovers && <button className="leftover-button" disabled={saving === slot} onClick={() => planNextLunch(mealDate, mealType)}>{t('leftoversToLunch')}</button>}</div> })}</div>)}
    </div>}
  </section>
}
