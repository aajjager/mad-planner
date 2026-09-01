import { useMemo, useState } from 'react'

interface Labels {
  title: string
  search: string
  suggestions: string
  selected: string
  showDifferent: string
  noMatches: string
}

function shuffled(values: string[], seed: number): string[] {
  const result = [...values]
  let state = seed || 1
  for (let index = result.length - 1; index > 0; index -= 1) {
    state = (state * 1664525 + 1013904223) >>> 0
    const target = state % (index + 1)
    ;[result[index], result[target]] = [result[target], result[index]]
  }
  return result
}

export function PlanningPreferencePicker({ available, selected, onToggle, labels }: { available: string[]; selected: string[]; onToggle: (value: string) => void; labels: Labels }) {
  const [search, setSearch] = useState('')
  const [seed, setSeed] = useState(() => Date.now())
  const choices = useMemo(() => {
    const unselected = available.filter((value) => !selected.includes(value))
    const query = search.trim().toLocaleLowerCase()
    if (query) return unselected.filter((value) => value.toLocaleLowerCase().includes(query)).slice(0, 10)
    return shuffled(unselected, seed).slice(0, 10)
  }, [available, search, seed, selected])

  return <div className="preference-group planning-preferences">
    <span>{labels.title}</span>
    <div className="planning-preferences__search"><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={labels.search} aria-label={labels.search} />{!search && <button className="text-button" type="button" onClick={() => setSeed(Date.now())}>{labels.showDifferent}</button>}</div>
    {selected.length > 0 && <div className="planning-preferences__section"><small>{labels.selected}</small><div className="choice-chips">{selected.map((value) => <button type="button" className="choice-chip choice-chip--selected" onClick={() => onToggle(value)} key={value}>{value} ×</button>)}</div></div>}
    <div className="planning-preferences__section"><small>{labels.suggestions}</small>{choices.length > 0 ? <div className="choice-chips">{choices.map((value) => <button type="button" className="choice-chip" onClick={() => onToggle(value)} key={value}>+ {value}</button>)}</div> : <p className="planning-preferences__empty">{labels.noMatches}</p>}</div>
  </div>
}
