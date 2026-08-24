import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { addManualGroceryItem, getGroceryListWeek, setGroceryItemPurchased, type GroceryListItem, type WeeklyGroceryList } from '../api/grocery'
import { useAuth } from '../auth/AuthContext'
import './GroceryListPage.css'

const pad = (value: number) => String(value).padStart(2, '0')
const dateKey = (value: Date) => `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
const addDays = (value: Date, days: number) => { const result = new Date(value); result.setDate(result.getDate() + days); return result }
const mondayOf = (value: Date) => addDays(value, -((value.getDay() + 6) % 7))
const parseDate = (value: string | null) => { if (!value) return mondayOf(new Date()); const [year, month, day] = value.split('-').map(Number); return mondayOf(new Date(year, month - 1, day)) }
const prettyDate = (value: string) => { const [year, month, day] = value.split('-').map(Number); return new Date(year, month - 1, day).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) }
const formatQuantity = (item: GroceryListItem) => { if (!item.quantity) return ''; const value = Number(item.quantity).toLocaleString(undefined, { maximumFractionDigits: 2 }); const range = item.quantity_max ? `–${Number(item.quantity_max).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : ''; return `${value}${range}${item.unit ? ` ${item.unit.symbol}` : ''}` }
const groceryIcon = (item: GroceryListItem) => { const name = item.name.toLocaleLowerCase(); if (/tomat/.test(name)) return '🍅'; if (/banan/.test(name)) return '🍌'; if (/æble|apple/.test(name)) return '🍎'; if (/kartoff|potato/.test(name)) return '🥔'; if (/broccoli/.test(name)) return '🥦'; if (/laks|salmon|fisk|fish/.test(name)) return '🐟'; if (/kylling|chicken/.test(name)) return '🍗'; return ({ Produce: '🥕', 'Meat & fish': '🥩', 'Dairy & eggs': '🥛', Bakery: '🥖', Pantry: '🥫', Frozen: '❄️', Household: '🧼', Other: '🛒' } as Record<string, string>)[item.category] || '🛒' }

export function GroceryListPage() {
  const { account } = useAuth(); const canEdit = account?.role !== 'viewer'
  const [params, setParams] = useSearchParams()
  const weekStart = useMemo(() => parseDate(params.get('week')), [params])
  const [list, setList] = useState<WeeklyGroceryList | null>(null)
  const [manualText, setManualText] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const load = useCallback(() => getGroceryListWeek(dateKey(weekStart)).then(setList).catch(() => setError('The grocery list could not be loaded.')), [weekStart])
  useEffect(() => { load() }, [load])
  const grouped = useMemo(() => { const groups = new Map<string, GroceryListItem[]>(); for (const item of list?.items || []) groups.set(item.category, [...(groups.get(item.category) || []), item]); return [...groups.entries()] }, [list])
  const changeWeek = (days: number) => { setList(null); setError(''); setShowHistory(false); setParams({ week: dateKey(addDays(weekStart, days)) }) }

  async function addItem(event: FormEvent) { event.preventDefault(); if (!manualText.trim()) return; setBusy(true); setError(''); try { await addManualGroceryItem(dateKey(weekStart), manualText.trim()); setManualText(''); await load() } catch (reason) { setError(reason instanceof Error ? reason.message : 'The grocery item could not be added.') } finally { setBusy(false) } }
  async function changePurchased(item: GroceryListItem, purchased: boolean) { setBusy(true); setError(''); try { await setGroceryItemPurchased(item.id, purchased); await load() } catch (reason) { setError(reason instanceof Error ? reason.message : 'The grocery item could not be updated.') } finally { setBusy(false) } }

  return <section className="page grocery-page">
    <div className="page-heading"><div><p className="eyebrow">Weekly grocery list</p><h1>Shop once.<br />Cook all week.</h1><p>Recipe ingredients and manual items are saved for the whole family.</p></div></div>
    <div className="week-toolbar"><button className="button" onClick={() => changeWeek(-7)}>← Previous</button><div>{list && <strong>{prettyDate(list.week_start)} – {prettyDate(list.week_end)}</strong>}<Link className="text-button" to="/planner">Edit meal plan</Link></div><button className="button" onClick={() => changeWeek(7)}>Next →</button></div>
    {canEdit && <form className="manual-grocery-form" onSubmit={addItem}><label className="field"><span>Add something manually</span><input value={manualText} onChange={(event) => setManualText(event.target.value)} placeholder="6 bananas or 2 ds tomater" /></label><button className="button button--primary" disabled={busy || !manualText.trim()}>Add item</button></form>}
    {!list && !error && <p className="notice" role="status">Building grocery list…</p>}
    {error && <p className="notice notice--error" role="alert">{error}</p>}
    {list && <><div className="grocery-summary"><strong>{list.items.length} to buy</strong><span>from {list.planned_meals} planned {list.planned_meals === 1 ? 'meal' : 'meals'}</span><button className="text-button" onClick={() => setShowHistory((current) => !current)}>{showHistory ? 'Hide history' : `History (${list.history.length})`}</button></div>{list.items.length === 0 ? <div className="empty-state"><h2>Everything is purchased</h2><p>Add an item above or restore something from history.</p></div> : <div className="grocery-groups">{grouped.map(([category, items]) => <section className="grocery-group" key={category}><h2>{category}</h2>{items.map((item) => <label className="grocery-item" key={item.id}><input type="checkbox" disabled={!canEdit || busy} onChange={() => changePurchased(item, true)} /><span className="grocery-check" /><span className="grocery-icon" aria-hidden="true">{groceryIcon(item)}</span><span className="grocery-quantity">{formatQuantity(item)}</span><span className="grocery-name">{item.name}<small>{item.origin === 'manual' ? item.raw_texts[0] : item.recipe_names.join(', ')}</small></span></label>)}</section>)}</div>}{showHistory && <section className="grocery-history"><h2>Purchased</h2>{list.history.length === 0 ? <p className="muted">Nothing has been purchased for this week yet.</p> : list.history.map((item) => <article key={item.id}><span className="grocery-icon" aria-hidden="true">{groceryIcon(item)}</span><span><strong>{formatQuantity(item)} {item.name}</strong><small>{item.purchased_at ? new Date(item.purchased_at).toLocaleString() : ''}</small></span>{canEdit && <button className="text-button" disabled={busy} onClick={() => changePurchased(item, false)}>Undo</button>}</article>)}</section>}</>}
  </section>
}
