import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listRecipeTypes, type RecipeType } from '../api/auth'
import { useAuth } from '../auth/AuthContext'
import { combineRecipeScans } from '../utils/combineRecipeScans'
import { translator } from '../i18n'
import { createRecipe, scanRecipeImage, uploadRecipeImage, type RecipeScanPreview } from '../api/recipes'
import './ImportRecipePage.css'

export function ScanRecipePage() {
  const { account } = useAuth(); const t = translator(account?.locale)
  const navigate = useNavigate(); const [files, setFiles] = useState<File[]>([]); const [cover, setCover] = useState(0); const [progress, setProgress] = useState(''); const [preview, setPreview] = useState<RecipeScanPreview | null>(null); const [recipeTypes, setRecipeTypes] = useState<RecipeType[]>([]); const [selectedTypes, setSelectedTypes] = useState<string[]>([]); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  useEffect(() => { listRecipeTypes().then(setRecipeTypes).catch((reason) => setError(reason.message)) }, [])
  const toggleType = (name: string) => setSelectedTypes((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name])
  const updateLines = (field: 'ingredients' | 'instructions', value: string) => setPreview((current) => current ? { ...current, [field]: value.split('\n').map((line) => line.trim()).filter(Boolean) } : current)
  function addPhotos(selected: FileList | null) {
    if (!selected) return
    const combined = [...files]
    for (const file of Array.from(selected)) {
      if (!combined.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified)) combined.push(file)
    }
    if (combined.length > 6 || combined.some((file) => file.size > 15 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) { setError(t('scanPhotosLimit')); return }
    setFiles(combined); setPreview(null); setError('')
  }
  async function scan() {
    if (!files.length) return
    setBusy(true); setError(''); setPreview(null)
    const scans: { name: string; preview: RecipeScanPreview }[] = []
    const failed: string[] = []
    try {
      for (const [index, file] of files.entries()) {
        setProgress(`${t('reading')} ${index + 1} / ${files.length}`)
        try { scans.push({ name: file.name, preview: await scanRecipeImage(file) }) }
        catch { failed.push(file.name) }
      }
      if (scans.length) setPreview(combineRecipeScans(scans))
      if (failed.length) setError(`${t('scanPhotosFailed')} ${failed.join(', ')}`)
    } finally { setBusy(false); setProgress('') }
  }
  async function save() { if (!files.length || !preview || selectedTypes.length === 0) return; setBusy(true); setError(''); const mealTypes = [...new Set(recipeTypes.filter((item) => selectedTypes.includes(item.name)).map((item) => item.meal_type).filter((item): item is NonNullable<typeof item> => item !== null))]; try { let recipe = await createRecipe({ name: preview.name, description: preview.description || undefined, recipe_types: selectedTypes, meal_types: mealTypes, ingredients: preview.ingredients.map((raw_text) => ({ raw_text })), instructions: preview.instructions.map((text) => ({ text })) }); recipe = await uploadRecipeImage(recipe.id, files[cover] || files[0]); navigate(`/recipes/${recipe.id}`) } catch (reason) { setError(reason instanceof Error ? reason.message : t('saveScannedFailed')); setBusy(false) } }
  return <section className="page import-page"><Link className="back-link" to="/recipes/add">← {t('addRecipe')}</Link><div className="page-heading"><div><p className="eyebrow">{t('bookScanner')}</p><h1>{t('scanRecipePage')}</h1><p>{t('scanIntro')}</p></div></div><p>{t('scanMultipleHelp')}</p><div className="import-bar"><label className="field"><span>{t('recipePagePhoto')}</span><input type="file" multiple disabled={busy} accept="image/jpeg,image/png,image/webp" onChange={(event) => { addPhotos(event.target.files); event.target.value = '' }} /></label><label className="field"><span>{t('scanTakePhoto')}</span><input type="file" disabled={busy} accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => { addPhotos(event.target.files); event.target.value = '' }} /></label><button className="button button--primary" type="button" disabled={!files.length || busy} onClick={scan}>{busy ? progress : t('scanPage')}</button></div>{files.length > 0 && <fieldset><legend>{t('scanSelectedPhotos')}</legend><p>{t('scanCoverHelp')}</p>{files.map((file, index) => <div className="scan-photo-row" key={`${file.name}-${file.size}-${file.lastModified}`}><label><input type="radio" name="scan-cover" checked={cover === index} disabled={busy} onChange={() => setCover(index)} /> {index + 1}. {file.name}</label><button type="button" className="text-button" disabled={busy} aria-label={`${t('remove')} ${file.name}`} onClick={() => { setFiles(files.filter((_, position) => position !== index)); setCover(cover === index ? 0 : cover > index ? cover - 1 : cover); setPreview(null) }}>{t('remove')}</button></div>)}</fieldset>}
{error && <p className="notice notice--error" role="alert">{error}</p>}{preview && <div className="import-preview"><div className="preview-heading"><div><p className="eyebrow">{t('reviewDetected')}</p><input className="title-input" aria-label={t('recipeName')} value={preview.name} onChange={(event) => setPreview({ ...preview, name: event.target.value })} /></div><span className="parser-badge">OCR</span></div><p className="notice">{t('scanReviewHelp')}</p>{preview.warnings.map((warning) => <p className="notice" key={warning}>{warning}</p>)}<section className="type-confirmation"><strong>{t('chooseAtLeastOneType')}</strong><div className="choice-chips">{recipeTypes.map((item) => <button type="button" className={`choice-chip${selectedTypes.includes(item.name) ? ' choice-chip--selected' : ''}`} aria-pressed={selectedTypes.includes(item.name)} onClick={() => toggleType(item.name)} key={item.id}>{item.name}</button>)}</div></section><label className="field"><span>{t('description')}</span><textarea rows={3} value={preview.description || ''} onChange={(event) => setPreview({ ...preview, description: event.target.value })} /></label><div className="recipe-columns"><label className="field"><span>{t('ingredientsOneLine')}</span><textarea rows={12} value={preview.ingredients.join('\n')} onChange={(event) => updateLines('ingredients', event.target.value)} /></label><label className="field"><span>{t('instructionsOneLine')}</span><textarea rows={12} value={preview.instructions.join('\n')} onChange={(event) => updateLines('instructions', event.target.value)} /></label></div><details><summary>{t('showDetectedText')}</summary><pre className="scan-raw-text">{preview.raw_text}</pre></details><div className="form-actions"><button className="button" type="button" onClick={() => setPreview(null)}>{t('scanAgain')}</button><button className="button button--primary" type="button" disabled={busy || !preview.name.trim() || selectedTypes.length === 0} onClick={save}>{t('saveScanned')}</button></div></div>}</section>
}
