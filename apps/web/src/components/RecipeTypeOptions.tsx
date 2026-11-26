import { useEffect, useId, useState } from 'react'
import { listRecipeTypes, type RecipeType } from '../api/auth'
import { updateRecipeTypes } from '../api/recipes'
import type { translator } from '../i18n'

interface RecipeTypeOptionsProps {
  recipeId: number
  selected: string[]
  onSaved: (types: string[]) => void
  t: ReturnType<typeof translator>
}

export function RecipeTypeOptions({ recipeId, selected, onSaved, t }: RecipeTypeOptionsProps) {
  const heading = useId()
  const [types, setTypes] = useState<RecipeType[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)

  useEffect(() => {
    let active = true
    listRecipeTypes().then((items) => {
      if (active) setTypes(items)
    }).catch(() => {
      if (active) setLoadFailed(true)
    })
    return () => { active = false }
  }, [attempt])

  async function toggleType(name: string) {
    const next = selected.includes(name) ? selected.filter((type) => type !== name) : [...selected, name]
    setSaving(true)
    setSaveFailed(false)
    try {
      const updated = await updateRecipeTypes(recipeId, next)
      onSaved(updated.recipe_types)
    } catch {
      setSaveFailed(true)
    } finally {
      setSaving(false)
    }
  }

  return <section className="recipe-type-options" aria-labelledby={heading}>
    <h2 id={heading}>{t('recipeTypesLabel')}</h2>
    {loadFailed ? <>
      <p className="notice notice--error" role="alert">{t('recipeTypesLoadFailed')}</p>
      <button className="button" type="button" onClick={() => { setLoadFailed(false); setAttempt(attempt + 1) }}>{t('retryRecipeTypes')}</button>
    </> : types === null ? <p role="status">{t('loadingRecipeTypes')}</p> : types.length === 0 ? <p>{t('noRecipeTypesAvailable')}</p> : <>
      <div className="choice-chips" role="group" aria-labelledby={heading}>
        {types.map(({ id, name }) => {
          const checked = selected.includes(name)
          return <button key={id} type="button" className={`choice-chip${checked ? ' choice-chip--selected' : ''}`}
            disabled={saving || (!checked && selected.length >= 10)} aria-pressed={checked} onClick={() => void toggleType(name)}>{name}</button>
        })}
      </div>
      {selected.length >= 10 && <p>{t('recipeTypesLimit')}</p>}
      {saving && <p role="status">{t('saving')}</p>}
      {saveFailed && <p className="notice notice--error" role="alert">{t('recipeTypesSaveFailed')}</p>}
    </>}
  </section>
}
