import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getGroceryListWeek, type GroceryListItem, type WeeklyGroceryList } from '../api/grocery'
import './GroceryListPage.css'

const pad = (value: number) => String(value).padStart(2, '0')
const dateKey = (value: Date) => `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
const addDays = (value: Date, days: number) => { const result = new Date(value); result.setDate(result.getDate() + days); return result }
const mondayOf = (value: Date) => addDays(value, -((value.getDay() + 6) % 7))
const parseDate = (value: string | null) => { if (!value) return mondayOf(new Date()); const [year, month, day] = value.split('-').map(Number); return mondayOf(new Date(year, month - 1, day)) }
const prettyDate = (value: string) => { const [year, month, day] = value.split('-').map(Number); return new Date(year, month - 1, day).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) }
const formatQuantity = (item: GroceryListItem) => { if (!item.quantity) return ''; const value = Number(item.quantity).toLocaleString(undefined, { maximumFractionDigits: 2 }); const range = item.quantity_max ? `–${Number(item.quantity_max).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : ''; return `${value}${range}${item.unit ? ` ${item.unit.symbol}` : ''}` }

export function GroceryListPage() {
  const [params, setParams] = useSearchParams()
  const weekStart = useMemo(() => parseDate(params.get('week')), [params])
  const [list, setList] = useState<WeeklyGroceryList | null>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [error, setError] = useState(false)

  useEffect(() => { getGroceryListWeek(dateKey(weekStart)).then(setList).catch(() => setError(true)) }, [weekStart])
  const grouped = useMemo(() => { const groups = new Map<string, GroceryListItem[]>(); for (const item of list?.items || []) groups.set(item.category, [...(groups.get(item.category) || []), item]); return [...groups.entries()] }, [list])
  const changeWeek = (days: number) => { setList(null); setError(false); setParams({ week: dateKey(addDays(weekStart, days)) }) }

  return <section className="page grocery-page">
    <div className="page-heading"><div><p className="eyebrow">Weekly grocery list</p><h1>Shop once.<br />Cook all week.</h1><p>Ingredients are combined automatically from the recipes in your meal plan.</p></div></div>
    <div className="week-toolbar"><button className="button" onClick={() => changeWeek(-7)}>← Previous</button><div>{list && <strong>{prettyDate(list.week_start)} – {prettyDate(list.week_end)}</strong>}<Link className="text-button" to={`/planner`}>Edit meal plan</Link></div><button className="button" onClick={() => changeWeek(7)}>Next →</button></div>
    {!list && !error && <p className="notice" role="status">Building grocery list…</p>}
    {error && <p className="notice notice--error" role="alert">The grocery list could not be loaded.</p>}
    {list && list.items.length === 0 && <div className="empty-state"><h2>Your grocery list is empty</h2><p>Add recipes to this week’s planner to generate the list.</p><Link className="button button--primary" to="/planner">Open planner</Link></div>}
    {list && list.items.length > 0 && <><div className="grocery-summary"><strong>{list.items.length} ingredients</strong><span>from {list.planned_meals} planned {list.planned_meals === 1 ? 'meal' : 'meals'}</span><button className="text-button" onClick={() => setChecked(new Set())}>Clear checks</button></div><div className="grocery-groups">{grouped.map(([category, items]) => <section className="grocery-group" key={category}><h2>{category}</h2>{items.map((item) => <label className={`grocery-item${checked.has(item.key) ? ' grocery-item--checked' : ''}`} key={item.key}><input type="checkbox" checked={checked.has(item.key)} onChange={() => setChecked((current) => { const next = new Set(current); if (next.has(item.key)) next.delete(item.key); else next.add(item.key); return next })} /><span className="grocery-check" /><span className="grocery-quantity">{formatQuantity(item)}</span><span className="grocery-name">{item.name}<small>{item.recipe_names.join(', ')}</small></span></label>)}</section>)}</div></>}
  </section>
}
