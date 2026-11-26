import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listRecipeTypes } from '../api/auth'
import { listRecipes, type Recipe } from '../api/recipes'
import { useAuth } from '../auth/AuthContext'
import { translator } from '../i18n'
import { useRecipeBrowseMemory } from '../utils/recipeBrowseMemory'
import { AppIcon } from '../components/AppIcon'
import { RangeFilter } from '../components/RangeFilter'
import { RecipeCardImage } from '../components/RecipeCardImage'
import { RecipeLibraryHeader } from '../components/RecipeLibraryHeader'
import { RecipeTypeShortcuts } from '../components/RecipeTypeShortcuts'

function recipeCalories(recipe: Recipe): number | null {
  if (!recipe.nutrition) return null
  for (const key of ['calories', 'calorieContent', 'energy']) {
    const match = String(recipe.nutrition[key] ?? '').replace(',', '.').match(/\d+(?:\.\d+)?/)
    if (match) return Number(match[0])
  }
  return null
}

export function RecipeListPage() {
  const { account } = useAuth(); const t = translator(account?.locale)
  const memory = useRecipeBrowseMemory()
  const saved = memory.filters()
  const [cardSize, setCardSize] = useState(() => {
    try { const saved = localStorage.getItem('madplanner.recipeCardSize'); return saved === '0' || saved === '2' ? Number(saved) : 1 } catch { return 1 }
  })
  const sizeLabels = [t('recipeSizeCompact'), t('recipeSizeComfortable'), t('recipeSizeLarge')]
  function changeCardSize(value: number) {
    setCardSize(value)
    try { localStorage.setItem('madplanner.recipeCardSize', String(value)) } catch { /* The layout still works when browser storage is unavailable. */ }
  }
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [familyTypeNames, setFamilyTypeNames] = useState<string[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [search, setSearch] = useState(saved?.search ?? ''); const [tag, setTag] = useState(saved?.tag ?? ''); const [cuisine, setCuisine] = useState(saved?.cuisine ?? ''); const [recipeType, setRecipeType] = useState(saved?.recipeType ?? '')
  const [sort, setSort] = useState<'name' | 'rating'>(saved?.sort ?? 'name')
  const [ratingLow, setRatingLow] = useState(saved?.ratingLow ?? 0); const [ratingHigh, setRatingHigh] = useState(saved?.ratingHigh ?? 5); const [includeUnrated, setIncludeUnrated] = useState(saved?.includeUnrated ?? true)
  const [calorieLow, setCalorieLow] = useState(saved?.calorieLow ?? 0); const [calorieHigh, setCalorieHigh] = useState<number | null>(saved?.calorieHigh ?? null); const [includeUnknownCalories, setIncludeUnknownCalories] = useState(saved?.includeUnknownCalories ?? true)
  const [filtersOpen, setFiltersOpen] = useState(saved?.filtersOpen ?? false)

  useEffect(() => { listRecipes().then((items) => { setRecipes(items); setState('ready') }).catch(() => setState('error')) }, [])
  useEffect(() => {
    let current = true
    listRecipeTypes().then((types) => {
      if (current) setFamilyTypeNames(types.map((type) => type.name))
    }).catch(() => {
      // Browsing still works from the types present in the collection.
    })
    return () => { current = false }
  }, [])
  useEffect(() => {
    memory.rememberFilters({ filtersOpen, search, tag, cuisine, recipeType, sort, ratingLow, ratingHigh, includeUnrated, calorieLow, calorieHigh, includeUnknownCalories })
  }, [memory, filtersOpen, search, tag, cuisine, recipeType, sort, ratingLow, ratingHigh, includeUnrated, calorieLow, calorieHigh, includeUnknownCalories])
  useEffect(() => {
    if (state !== 'ready') return
    // Wait until the fetched cards have been laid out, not the short loading page.
    const target = memory.position()
    const record = () => { memory.rememberPosition(window.scrollY) }
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: target, left: 0, behavior: 'instant' })
      window.addEventListener('scroll', record, { passive: true })
    })
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', record) }
  }, [memory, state])
  const tags = useMemo(() => [...new Set(recipes.flatMap((recipe) => recipe.tags))].sort((a, b) => a.localeCompare(b)), [recipes])
  const cuisines = useMemo(() => [...new Set(recipes.map((recipe) => recipe.cuisine).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b)), [recipes])
  const recipeTypes = useMemo(() => {
    const types = new Set([...familyTypeNames, ...recipes.flatMap((recipe) => recipe.recipe_types || [])])
    if (recipeType) types.add(recipeType)
    return [...types].sort((a, b) => a.localeCompare(b))
  }, [familyTypeNames, recipes, recipeType])
  const calorieCeiling = useMemo(() => Math.max(1000, Math.ceil(Math.max(0, ...recipes.map((recipe) => recipeCalories(recipe) || 0)) / 100) * 100), [recipes])
  const effectiveCalorieHigh = calorieHigh === null ? calorieCeiling : Math.min(calorieHigh, calorieCeiling)
  const filteredRecipes = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return recipes.filter((recipe) => {
      const calories = recipeCalories(recipe)
      const ratingFilterActive = sort === 'rating' || ratingLow > 0 || ratingHigh < 5 || !includeUnrated
      const ownFamilyRating = recipe.owned_by_current_family ? recipe.family_rating : null
      const ratingMatches = !recipe.owned_by_current_family ? !ratingFilterActive : ownFamilyRating == null ? includeUnrated : ownFamilyRating >= ratingLow && ownFamilyRating <= ratingHigh
      const caloriesMatch = calories === null ? includeUnknownCalories : calories >= calorieLow && calories <= effectiveCalorieHigh
      return ratingMatches && caloriesMatch && (!tag || recipe.tags.includes(tag)) && (!cuisine || recipe.cuisine === cuisine) && (!recipeType || (recipe.recipe_types || []).includes(recipeType)) && (!query || [recipe.name, recipe.description, recipe.category, recipe.cuisine, ...recipe.tags, ...(recipe.recipe_types || [])].some((value) => value?.toLocaleLowerCase().includes(query)))
    }).sort((a, b) => sort === 'rating' ? (b.owned_by_current_family ? b.family_rating || 0 : 0) - (a.owned_by_current_family ? a.family_rating || 0 : 0) || a.name.localeCompare(b.name) : a.name.localeCompare(b.name))
  }, [recipes, search, tag, cuisine, recipeType, sort, ratingLow, ratingHigh, includeUnrated, calorieLow, effectiveCalorieHigh, includeUnknownCalories])

  const clearFilters = () => { setSearch(''); setTag(''); setCuisine(''); setRecipeType(''); setRatingLow(0); setRatingHigh(5); setIncludeUnrated(true); setCalorieLow(0); setCalorieHigh(null); setIncludeUnknownCalories(true) }
  const canEdit = account?.role === 'owner' || account?.role === 'editor'

  return <section className="page recipe-library">
    <RecipeLibraryHeader />
    {state === 'loading' && <p className="notice" role="status">{t('loadingRecipes')}</p>}
    {state === 'error' && <p className="notice notice--error" role="alert">{t('recipesError')}</p>}
    {state === 'ready' && recipes.length === 0 && <div className="empty-state"><span>✦</span><h2>{t('collectionReady')}</h2>{canEdit && <><p>{t('addRecipeChoiceHelp')}</p><Link className="button button--primary" to="/recipes/add">{t('createFirst')}</Link></>}</div>}
    {recipes.length > 0 && <>
      {recipeTypes.length > 0 && <RecipeTypeShortcuts
        types={recipeTypes}
        selected={recipeType}
        onSelect={setRecipeType}
        label={t('recipeTypeFilter')}
        allLabel={t('recipeTypesAllShortcut')}
      />}
      <div className="collection-search"><label className="field"><span>{t('searchRecipes')}</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('searchPlaceholder')} /></label><button className={`button filter-toggle${filtersOpen ? ' is-open' : ''}`} aria-expanded={filtersOpen} aria-controls="recipe-filters" onClick={() => setFiltersOpen((open) => !open)}><AppIcon name="filters" />{t('collectionFilters')}{Boolean(tag || cuisine || recipeType || sort !== 'name' || ratingLow > 0 || ratingHigh < 5 || !includeUnrated || calorieLow > 0 || calorieHigh !== null || !includeUnknownCalories) && <span className="filter-indicator" aria-label={t('filtersActive')} />}</button></div><div id="recipe-filters" hidden={!filtersOpen}><div className="library-tools"><label className="field"><span>{t('filterTag')}</span><select value={tag} onChange={(event) => setTag(event.target.value)}><option value="">{t('allTags')}</option>{tags.map((item) => <option key={item}>{item}</option>)}</select></label><label className="field"><span>{t('cuisineFilter')}</span><select value={cuisine} onChange={(event) => setCuisine(event.target.value)}><option value="">{t('allCuisines')}</option>{cuisines.map((item) => <option key={item}>{item}</option>)}</select></label><label className="field"><span>{t('recipeTypeFilter')}</span><select value={recipeType} onChange={(event) => setRecipeType(event.target.value)}><option value="">{t('allRecipeTypes')}</option>{recipeTypes.map((item) => <option key={item}>{item}</option>)}</select></label><label className="field"><span>{t('sortRecipes')}</span><select value={sort} onChange={(event) => setSort(event.target.value as 'name' | 'rating')}><option value="name">{t('nameSort')}</option><option value="rating">{t('ratingHigh')}</option></select></label></div>
      <section className="range-filters"><RangeFilter label={t('ratingRange')} minimum={0} maximum={5} low={ratingLow} high={ratingHigh} step={0.5} suffix="★" onChange={(low, high) => { setRatingLow(low); setRatingHigh(high) }} /><label className="range-missing"><input type="checkbox" checked={includeUnrated} onChange={(event) => setIncludeUnrated(event.target.checked)} />{t('includeUnrated')}</label><RangeFilter label={t('calorieRange')} minimum={0} maximum={calorieCeiling} low={calorieLow} high={effectiveCalorieHigh} step={50} suffix="kcal" onChange={(low, high) => { setCalorieLow(low); setCalorieHigh(high) }} /><label className="range-missing"><input type="checkbox" checked={includeUnknownCalories} onChange={(event) => setIncludeUnknownCalories(event.target.checked)} />{t('includeUnknownCalories')}</label><span className="result-count">{filteredRecipes.length} {filteredRecipes.length === 1 ? t('recipe') : t('recipePlural')}</span><button className="text-button" onClick={clearFilters}>{t('clearFilters')}</button></section></div>
    </>}
    {recipes.length > 0 && <div className="recipe-view-controls"><label htmlFor="recipe-card-size">{t('recipeCardSize')}</label><input id="recipe-card-size" type="range" min="0" max="2" step="1" value={cardSize} aria-valuetext={sizeLabels[cardSize]} onChange={(event) => changeCardSize(Number(event.target.value))} /><output htmlFor="recipe-card-size">{sizeLabels[cardSize]}</output></div>}
    {recipes.length > 0 && filteredRecipes.length === 0 && <div className="empty-state empty-state--compact"><h2>{t('noMatches')}</h2><p>{t('noMatchesHelp')}</p><button className="button" onClick={clearFilters}>{t('clearFilters')}</button></div>}
    {filteredRecipes.length > 0 && <div className={`recipe-grid recipe-collection recipe-collection--${['compact', 'comfortable', 'large'][cardSize]}`}>
      {filteredRecipes.map((recipe) => {
        const types = recipe.recipe_types ?? []
        const visibleTypes = (recipeType ? [recipeType, ...types.filter((type) => type !== recipeType)] : types).slice(0, 2)

        return <Link key={recipe.id} className="recipe-card" to={`/recipes/${recipe.id}`}
          onClick={() => memory.rememberPosition(window.scrollY)}>
          <RecipeCardImage recipe={recipe} />
          <div className="recipe-card__body">
            <h2>{recipe.name}</h2>
            {visibleTypes.length > 0 && <div className="tag-list">
              {visibleTypes.map((type) => <span className="tag" key={type}>{type}</span>)}
            </div>}
          </div>
        </Link>
      })}
    </div>}
  </section>
}
