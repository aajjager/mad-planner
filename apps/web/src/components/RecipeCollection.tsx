import { Fragment, useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import type { Recipe } from '../api/recipes'
import { useAuth } from '../auth/AuthContext'
import { translator } from '../i18n'
import { useRecipeBrowseMemory, type RecipeBrowseFilters, type RecipeCollectionScope } from '../utils/recipeBrowseMemory'
import { AppIcon } from './AppIcon'
import { RangeFilter } from './RangeFilter'
import { RecipeTypeShortcuts } from './RecipeTypeShortcuts'

const cardSizes = ['compact', 'comfortable', 'large']
const cardSizeKey = 'madplanner.recipeCardSize'
const defaultFilters: RecipeBrowseFilters = {
  filtersOpen: false, search: '', tag: '', cuisine: '', recipeType: '', sort: 'name',
  ratingLow: 0, ratingHigh: 5, includeUnrated: true,
  calorieLow: 0, calorieHigh: null, includeUnknownCalories: true, hideOwn: false,
}

function recipeCalories(recipe: Recipe): number | null {
  if (!recipe.nutrition) return null
  for (const key of ['calories', 'calorieContent', 'energy']) {
    const match = String(recipe.nutrition[key] ?? '').replace(',', '.').match(/\d+(?:\.\d+)?/)
    if (match) return Number(match[0])
  }
  return null
}

function options(values: Iterable<string>) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b))
}

interface RecipeCollectionProps {
  recipes: Recipe[]
  scope: RecipeCollectionScope
  configuredTypes?: string[]
  empty: ReactNode
  extraFilters?: ReactNode
  renderCard: (recipe: Recipe, types: string[], rememberPosition: () => void) => ReactNode
}

export function RecipeCollection({ recipes, scope, configuredTypes = [], empty, extraFilters, renderCard }: RecipeCollectionProps) {
  const { account } = useAuth()
  const t = translator(account?.locale)
  const isPublic = scope === 'public'
  const memory = useRecipeBrowseMemory(scope)
  const panelId = useId()
  const sizeId = useId()
  const [filters, setFilters] = useState(() => memory.filters() ?? defaultFilters)
  const [cardSize, setCardSize] = useState(() => {
    try {
      const saved = localStorage.getItem(cardSizeKey)
      return saved === '0' || saved === '2' ? Number(saved) : 1
    } catch { return 1 }
  })
  const sizeLabels = [t('recipeSizeCompact'), t('recipeSizeComfortable'), t('recipeSizeLarge')]
  const { filtersOpen, search, tag, cuisine, recipeType, sort, ratingLow, ratingHigh, includeUnrated, calorieLow, calorieHigh, includeUnknownCalories, hideOwn } = filters

  function updateFilters(change: Partial<RecipeBrowseFilters>) {
    setFilters((current) => ({ ...current, ...change }))
  }

  function clearFilters() {
    setFilters({ ...defaultFilters, filtersOpen })
  }

  function changeCardSize(value: number) {
    setCardSize(value)
    try { localStorage.setItem(cardSizeKey, String(value)) } catch { /* The layout still works when storage is unavailable. */ }
  }

  useEffect(() => { memory.rememberFilters(filters) }, [memory, filters])
  useEffect(() => {
    // Wait until the fetched cards have been laid out.
    const target = memory.position()
    const record = () => memory.rememberPosition(window.scrollY)
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: target, left: 0, behavior: 'instant' })
      window.addEventListener('scroll', record, { passive: true })
    })
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', record) }
  }, [memory])

  const tags = options(recipes.flatMap((recipe) => recipe.tags))
  const cuisines = options(recipes.flatMap((recipe) => recipe.cuisine ? [recipe.cuisine] : []))
  const recipeTypes = options([...configuredTypes, ...recipes.flatMap((recipe) => recipe.recipe_types ?? []), ...(recipeType ? [recipeType] : [])])
  const caloriesByRecipe = useMemo(() => new Map(recipes.map((recipe) => [recipe.id, recipeCalories(recipe)])), [recipes])
  const calorieCeiling = [...caloriesByRecipe.values()].reduce<number>((highest, value) => Math.max(highest, Math.ceil((value ?? 0) / 100) * 100), 1000)
  const effectiveCalorieHigh = Math.min(calorieHigh ?? calorieCeiling, calorieCeiling)
  const effectiveCalorieLow = Math.min(calorieLow, effectiveCalorieHigh)
  const ratingFilterActive = sort === 'rating' || ratingLow > 0 || ratingHigh < 5 || !includeUnrated
  const filterActive = Boolean(tag || cuisine || recipeType || ratingFilterActive || calorieLow > 0 || calorieHigh !== null || !includeUnknownCalories || hideOwn)
  const query = search.trim().toLocaleLowerCase()
  const visible = recipes.filter((recipe) => {
    if (isPublic && hideOwn && recipe.owned_by_current_family) return false
    if (tag && !recipe.tags.includes(tag)) return false
    if (cuisine && recipe.cuisine !== cuisine) return false
    if (recipeType && !(recipe.recipe_types ?? []).includes(recipeType)) return false

    const rating = recipe.family_rating ?? null
    const ratingMatches = !isPublic && !recipe.owned_by_current_family
      ? !ratingFilterActive
      : rating === null ? includeUnrated : rating >= ratingLow && rating <= ratingHigh
    const calories = caloriesByRecipe.get(recipe.id) ?? null
    const caloriesMatch = calories === null ? includeUnknownCalories : calories >= calorieLow && calories <= effectiveCalorieHigh
    if (!ratingMatches || !caloriesMatch) return false

    const labels = [recipe.name, recipe.description, recipe.category, recipe.cuisine, ...recipe.tags, ...(recipe.recipe_types ?? [])]
    if (isPublic) labels.push(recipe.owner_family_name)
    return !query || labels.some((value) => value?.toLocaleLowerCase().includes(query))
  }).sort((a, b) => {
    const highestFirst = sort === 'rating' ? (b.family_rating ?? 0) - (a.family_rating ?? 0) : 0
    return highestFirst || a.name.localeCompare(b.name)
  })

  return <>
    {(isPublic || recipes.length > 0) && <>
      {recipeTypes.length > 0 && <RecipeTypeShortcuts
        types={recipeTypes} selected={recipeType} onSelect={(value) => updateFilters({ recipeType: value })}
        label={t('recipeTypeFilter')} allLabel={t('recipeTypesAllShortcut')}
      />}
      <div className="collection-search">
        <label className="field">
          <span>{t('searchRecipes')}</span>
          <input type="search" value={search} onChange={(event) => updateFilters({ search: event.target.value })}
            placeholder={t(isPublic ? 'publicRecipeSearchPlaceholder' : 'searchPlaceholder')} />
        </label>
        <button type="button" className={`button filter-toggle${filtersOpen ? ' is-open' : ''}`} aria-expanded={Boolean(filtersOpen)}
          aria-controls={panelId} onClick={() => updateFilters({ filtersOpen: !filtersOpen })}>
          <AppIcon name="filters" />{t('collectionFilters')}
          {filterActive && <span className="filter-indicator" aria-label={t('filtersActive')} />}
        </button>
      </div>
      <div id={panelId} hidden={!filtersOpen}>
        <div className="library-tools">
          {isPublic && <div className="collection-filter-extras">
            <label className="range-missing">
              <input type="checkbox" checked={hideOwn} onChange={(event) => updateFilters({ hideOwn: event.target.checked })} />
              {t('hideOwnRecipes')}
            </label>
            {extraFilters}
          </div>}
          <label className="field"><span>{t('filterTag')}</span>
            <select value={tag} onChange={(event) => updateFilters({ tag: event.target.value })}>
              <option value="">{t('allTags')}</option>{tags.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="field"><span>{t('cuisineFilter')}</span>
            <select value={cuisine} onChange={(event) => updateFilters({ cuisine: event.target.value })}>
              <option value="">{t('allCuisines')}</option>{cuisines.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="field"><span>{t('recipeTypeFilter')}</span>
            <select value={recipeType} onChange={(event) => updateFilters({ recipeType: event.target.value })}>
              <option value="">{t('allRecipeTypes')}</option>{recipeTypes.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="field"><span>{t('sortRecipes')}</span>
            <select value={sort} onChange={(event) => updateFilters({ sort: event.target.value === 'rating' ? 'rating' : 'name' })}>
              <option value="name">{t('nameSort')}</option><option value="rating">{t('ratingHigh')}</option>
            </select>
          </label>
        </div>
        <section className="range-filters">
          <RangeFilter label={t('ratingRange')} minimum={0} maximum={5} low={ratingLow} high={ratingHigh} step={0.5} suffix="★"
            onChange={(low, high) => updateFilters({ ratingLow: low, ratingHigh: high })} />
          <label className="range-missing"><input type="checkbox" checked={includeUnrated} onChange={(event) => updateFilters({ includeUnrated: event.target.checked })} />{t('includeUnrated')}</label>
          <RangeFilter label={t('calorieRange')} minimum={0} maximum={calorieCeiling} low={effectiveCalorieLow} high={effectiveCalorieHigh} step={50} suffix="kcal"
            onChange={(low, high) => updateFilters({ calorieLow: low, calorieHigh: high === calorieCeiling ? null : high })} />
          <label className="range-missing"><input type="checkbox" checked={includeUnknownCalories} onChange={(event) => updateFilters({ includeUnknownCalories: event.target.checked })} />{t('includeUnknownCalories')}</label>
          <span className="result-count">{visible.length} {visible.length === 1 ? t('recipe') : t('recipePlural')}</span>
          <button type="button" className="text-button" onClick={clearFilters}>{t('clearFilters')}</button>
        </section>
      </div>
    </>}
    {recipes.length > 0 && <div className="recipe-view-controls">
      <label htmlFor={sizeId}>{t('recipeCardSize')}</label>
      <input id={sizeId} type="range" min="0" max="2" step="1" value={cardSize} aria-valuetext={sizeLabels[cardSize]}
        onChange={(event) => changeCardSize(Number(event.target.value))} />
      <output htmlFor={sizeId}>{sizeLabels[cardSize]}</output>
    </div>}
    {recipes.length === 0 && empty}
    {recipes.length > 0 && visible.length === 0 && <div className="empty-state empty-state--compact">
      <h2>{t('noMatches')}</h2><p>{t('noMatchesHelp')}</p>
      <button type="button" className="button" onClick={clearFilters}>{t('clearFilters')}</button>
    </div>}
    {visible.length > 0 && <div className={`recipe-grid recipe-collection recipe-collection--${cardSizes[cardSize]}`}>
      {visible.map((recipe) => {
        const types = recipe.recipe_types ?? []
        const visibleTypes = (recipeType ? [recipeType, ...types.filter((type) => type !== recipeType)] : types).slice(0, 2)
        return <Fragment key={recipe.id}>{renderCard(recipe, visibleTypes, () => memory.rememberPosition(window.scrollY))}</Fragment>
      })}
    </div>}
  </>
}
