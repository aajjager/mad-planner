import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { addManualGroceryItem, getGroceryListWeek, setGroceryItemPurchased, type GroceryListItem, type WeeklyGroceryList } from '../api/grocery'
import { useAuth } from '../auth/AuthContext'
import { localeTag, translator } from '../i18n'
import './GroceryListPage.css'

const pad = (value: number) => String(value).padStart(2, '0')
const dateKey = (value: Date) => `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
const addDays = (value: Date, days: number) => { const result = new Date(value); result.setDate(result.getDate() + days); return result }
const mondayOf = (value: Date) => addDays(value, -((value.getDay() + 6) % 7))
const parseDate = (value: string | null) => { if (!value) return mondayOf(new Date()); const [year, month, day] = value.split('-').map(Number); return mondayOf(new Date(year, month - 1, day)) }
const prettyDate = (value: string, locale: string) => { const [year, month, day] = value.split('-').map(Number); return new Date(year, month - 1, day).toLocaleDateString(locale, { day: 'numeric', month: 'short' }) }
const formatQuantity = (item: GroceryListItem, locale: string) => { if (!item.quantity) return ''; const value = Number(item.quantity).toLocaleString(locale, { maximumFractionDigits: 2 }); const range = item.quantity_max ? `–${Number(item.quantity_max).toLocaleString(locale, { maximumFractionDigits: 2 })}` : ''; return `${value}${range}${item.unit ? ` ${item.unit.symbol}` : ''}` }
const groceryIcon = (item: GroceryListItem) => { const name = item.name.toLocaleLowerCase(); if (/tomat/.test(name)) return '🍅'; if (/banan/.test(name)) return '🍌'; if (/æble|apple/.test(name)) return '🍎'; if (/kartoff|potato/.test(name)) return '🥔'; if (/broccoli/.test(name)) return '🥦'; if (/laks|salmon|fisk|fish/.test(name)) return '🐟'; if (/kylling|chicken/.test(name)) return '🍗'; return ({ Produce: '🥕', 'Meat & fish': '🥩', 'Dairy & eggs': '🥛', Bakery: '🥖', Pantry: '🥫', Frozen: '❄️', Household: '🧼', Other: '🛒' } as Record<string, string>)[item.category] || '🛒' }

export function GroceryListPage() {
  const { account } = useAuth(); const canEdit = account?.role !== 'viewer'
  const t = translator(account?.locale); const locale = localeTag(account?.locale)
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
    <div className="page-heading"><div><p className="eyebrow">{t('weeklyGroceries')}</p><h1>{t('shopOnce')}</h1><p>{t('groceryIntro')}</p></div></div>
    <div className="week-toolbar"><button className="button" onClick={() => changeWeek(-7)}>← {t('previous')}</button><div>{list && <strong>{prettyDate(list.week_start, locale)} – {prettyDate(list.week_end, locale)}</strong>}<Link className="text-button" to="/planner">{t('editMealPlan')}</Link></div><button className="button" onClick={() => changeWeek(7)}>{t('next')} →</button></div>
    {canEdit && <form className="manual-grocery-form" onSubmit={addItem}><label className="field"><span>{t('addManual')}</span><input value={manualText} onChange={(event) => setManualText(event.target.value)} placeholder={t('manualPlaceholder')} /></label><button className="button button--primary" disabled={busy || !manualText.trim()}>{t('addItem')}</button></form>}
    {!list && !error && <p className="notice" role="status">{t('buildingList')}</p>}
    {error && <p className="notice notice--error" role="alert">{error}</p>}
    {list && <><div className="grocery-summary"><strong>{list.items.length} {t('toBuy')}</strong><span>{list.planned_meals} {t('plannedMeals')}</span><button className="text-button" onClick={() => setShowHistory((current) => !current)}>{showHistory ? t('hideHistory') : `${t('history')} (${list.history.length})`}</button></div>{list.items.length === 0 ? <div className="empty-state"><h2>{t('everythingPurchased')}</h2><p>{t('purchasedHelp')}</p></div> : <div className="grocery-groups">{grouped.map(([category, items]) => <section className="grocery-group" key={category}><h2>{category}</h2>{items.map((item) => <label className="grocery-item" key={item.id}><input type="checkbox" disabled={!canEdit || busy} onChange={() => changePurchased(item, true)} /><span className="grocery-check" /><span className="grocery-icon" aria-hidden="true">{groceryIcon(item)}</span><span className="grocery-quantity">{formatQuantity(item, locale)}</span><span className="grocery-name">{item.name}<small>{item.origin === 'manual' ? item.raw_texts[0] : item.recipe_names.join(', ')}</small></span></label>)}</section>)}</div>}{showHistory && <section className="grocery-history"><h2>{t('purchased')}</h2>{list.history.length === 0 ? <p className="muted">{t('nothingPurchased')}</p> : list.history.map((item) => <article key={item.id}><span className="grocery-icon" aria-hidden="true">{groceryIcon(item)}</span><span><strong>{formatQuantity(item, locale)} {item.name}</strong><small>{item.purchased_at ? new Date(item.purchased_at).toLocaleString(locale) : ''}</small></span>{canEdit && <button className="text-button" disabled={busy} onClick={() => changePurchased(item, false)}>{t('undo')}</button>}</article>)}</section>}</>}
  </section>
}
