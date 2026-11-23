import { AppIcon } from './AppIcon'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { translator } from '../i18n'
import { addRecipeIngredients } from '../api/grocery'
import type { Recipe } from '../api/recipes'

function thisMonday() {
  const date = new Date()
  date.setDate(date.getDate() - (date.getDay() + 6) % 7)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function RecipeIngredientShopping({ recipe }: { recipe: Recipe }) {
  const { account } = useAuth()
  const t = translator(account?.locale)
  const canShop = account && account.role !== 'viewer'
  const [selected, setSelected] = useState<number[]>([])
  const [week, setWeek] = useState(thisMonday)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [added, setAdded] = useState(0)
  async function add(ids: number[]) {
    if (busy || !week || !ids.length) return
    setBusy(true); setError(''); setAdded(0)
    try {
      const items = await addRecipeIngredients(week, recipe.id, ids)
      setAdded(items.length)
      setSelected((current) => current.filter((id) => !ids.includes(id)))
    } catch { setError(t('recipeShoppingFailed')) } finally { setBusy(false) }
  }
  if (!recipe.ingredients.length) return <p className="muted">{t('noIngredients')}</p>
  return <div className="ingredient-shopping">
    {canShop && <div className="ingredient-shopping__tools">
      <label className="field"><span>{t('recipeShoppingWeek')}</span><input type="date" value={week} disabled={busy} onChange={(event) => { setWeek(event.target.value); setAdded(0) }} /></label>
      <p className="muted">{t('recipeShoppingHelp')}</p>
      <div className="heading-actions"><button type="button" className="button" disabled={busy} onClick={() => setSelected(recipe.ingredients.map((item) => item.id))}>{t('selectAllIngredients')}</button><button type="button" className="button" disabled={busy || !selected.length} onClick={() => setSelected([])}>{t('clearIngredientSelection')}</button></div>
    </div>}
    <ul className="ingredient-list">{recipe.ingredients.map((item) => <li key={item.id}>
      {canShop ? <div className="ingredient-shopping__row"><label><input type="checkbox" checked={selected.includes(item.id)} disabled={busy} onChange={() => setSelected((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} aria-label={`${t('select')} ${item.raw_text}`} /><span>{item.raw_text}</span></label><button type="button" className="button" disabled={busy || !week} aria-label={`${t('addIngredientToShopping')} ${item.raw_text}`} title={t('addIngredientToShopping')} onClick={() => void add([item.id])}><AppIcon name="plus" /></button></div> : item.raw_text}
    </li>)}</ul>
    {canShop && <><div className="heading-actions"><button type="button" className="button button--primary" disabled={busy || !week || !selected.length} onClick={() => void add(selected)}>{t('addSelectedIngredients')} ({selected.length})</button><Link to={`/grocery-list?week=${week}`}>{t('groceryList')}</Link></div>{added > 0 && <p role="status">{t('ingredientsAddedToShopping')} {added}</p>}{error && <p className="notice notice--error" role="alert">{error}</p>}</>}
  </div>
}
