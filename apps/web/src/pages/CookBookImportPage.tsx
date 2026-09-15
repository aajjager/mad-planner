import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createRecipe, parseServingCount, previewCookBookArchive, type CookBookArchivePreview } from '../api/recipes'
import { listRecipeTypes, type RecipeType } from '../api/auth'
import { useAuth } from '../auth/AuthContext'
import { translator } from '../i18n'
import './ImportRecipePage.css'

export function CookBookImportPage() {
  const { account } = useAuth(); const t = translator(account?.locale); const navigate = useNavigate()
  const [file, setFile] = useState<File | null>(null); const [preview, setPreview] = useState<CookBookArchivePreview | null>(null); const [selected, setSelected] = useState<Set<number>>(new Set())
  const [recipeTypes, setRecipeTypes] = useState<RecipeType[]>([]); const [fallbackType, setFallbackType] = useState('Dinner'); const [busy, setBusy] = useState(false); const [progress, setProgress] = useState(''); const [error, setError] = useState('')
  useEffect(() => { listRecipeTypes().then((items) => { setRecipeTypes(items); if (!items.some((item) => item.name === 'Dinner') && items[0]) setFallbackType(items[0].name) }).catch((reason) => setError(reason.message)) }, [])
  const duplicates = useMemo(() => preview?.recipes.filter((item) => item.duplicate).length || 0, [preview])

  async function inspect(event: FormEvent) {
    event.preventDefault(); if (!file) return; setBusy(true); setError(''); setProgress('')
    try { const next = await previewCookBookArchive(file); setPreview(next); setSelected(new Set(next.recipes.map((item, index) => item.duplicate ? -1 : index).filter((index) => index >= 0))) }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('requestFailed')) }
    finally { setBusy(false) }
  }

  function toggle(index: number) { setSelected((current) => { const next = new Set(current); if (next.has(index)) next.delete(index); else next.add(index); return next }) }

  async function importSelected() {
    if (!preview || selected.size === 0) return; setBusy(true); setError('')
    try {
      let completed = 0
      for (const index of [...selected].sort((a, b) => a - b)) {
        const item = preview.recipes[index]
        const knownSuggestions = item.suggested_recipe_types.filter((name) => recipeTypes.some((type) => type.name === name))
        const selectedTypes = knownSuggestions.length ? knownSuggestions : [fallbackType]
        const mealTypes = [...new Set(recipeTypes.filter((type) => selectedTypes.includes(type.name)).map((type) => type.meal_type).filter((value): value is NonNullable<typeof value> => value !== null))]
        await createRecipe({ name: item.name, description: item.description || undefined, image_url: item.image_url || undefined, servings: parseServingCount(item.servings), preparation_time_minutes: item.preparation_time_minutes ?? undefined, cooking_time_minutes: item.cooking_time_minutes ?? undefined, total_time_minutes: item.total_time_minutes ?? undefined, category: item.category || undefined, tags: item.tags, recipe_types: selectedTypes, meal_types: mealTypes, ingredients: item.ingredients.map((raw_text) => ({ raw_text })), instructions: item.instructions.map((text) => ({ text })) })
        completed += 1; setProgress(`${completed} / ${selected.size}`)
      }
      navigate('/recipes')
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('requestFailed')); setBusy(false) }
  }

  return <section className="page import-page cookbook-import"><Link className="back-link" to="/recipes">← {t('allRecipes')}</Link><div className="page-heading"><div><p className="eyebrow">CookBook</p><h1>{t('importCookBook')}</h1><p>{t('cookBookImportHelp')}</p></div></div>
    <form className="import-bar" onSubmit={inspect}><label className="field"><span>{t('cookBookZip')}</span><input type="file" required accept=".zip,application/zip" onChange={(event) => { setFile(event.target.files?.[0] || null); setPreview(null) }} /></label><button className="button button--primary" disabled={busy || !file}>{busy ? t('reading') : t('previewArchive')}</button></form>
    {error && <div className="notice notice--error" role="alert">{error}</div>}
    {preview && <section className="cookbook-preview"><header><div><h2>{preview.recipes.length} {t('recipesFound')}</h2><p>{duplicates ? `${duplicates} ${t('duplicatesSkipped')}` : t('noDuplicates')}</p></div><label className="field"><span>{t('fallbackRecipeType')}</span><select value={fallbackType} onChange={(event) => setFallbackType(event.target.value)}>{recipeTypes.map((item) => <option key={item.id}>{item.name}</option>)}</select><small>{t('fallbackRecipeTypeHelp')}</small></label></header><div className="cookbook-recipe-list">{preview.recipes.map((item, index) => <label className={`cookbook-recipe${item.duplicate ? ' cookbook-recipe--duplicate' : ''}`} key={`${item.name}-${index}`}><input type="checkbox" checked={selected.has(index)} disabled={item.duplicate || busy} onChange={() => toggle(index)} /><span><strong>{item.name}</strong><small>{item.ingredients.length} {t('ingredients')} · {item.instructions.length} {t('instructions')}{item.suggested_recipe_types.length ? ` · ${item.suggested_recipe_types.join(', ')}` : ` · ${fallbackType}`}</small>{item.duplicate && <em>{t('alreadyExists')}</em>}{item.warnings.map((warning) => <em key={warning}>{warning}</em>)}</span></label>)}</div><footer><span>{selected.size} {t('selectedForImport')}</span><button className="button button--primary" disabled={busy || selected.size === 0 || !fallbackType} onClick={() => void importSelected()}>{busy && progress ? `${t('importing')} ${progress}` : t('importSelected')}</button></footer></section>}
  </section>
}
