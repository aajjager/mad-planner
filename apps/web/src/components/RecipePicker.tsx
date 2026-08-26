import { useEffect, useMemo, useState } from 'react'
import type { Recipe } from '../api/recipes'

interface RecipePickerProps {
  recipes: Recipe[]
  selected: Recipe | null
  label: string
  placeholder: string
  clearLabel: string
  disabled: boolean
  onSelect: (recipeId: string) => void
}

const searchableText = (recipe: Recipe) => [recipe.name, recipe.cuisine, recipe.category, ...(recipe.tags || []), ...(recipe.recipe_types || [])].filter(Boolean).join(' ').toLocaleLowerCase()

export function RecipePicker({ recipes, selected, label, placeholder, clearLabel, disabled, onSelect }: RecipePickerProps) {
  const [query, setQuery] = useState(selected?.name || '')
  const [open, setOpen] = useState(false)
  // oxlint-disable-next-line react/set-state-in-effect -- Keep the input aligned when another planner action changes the selected recipe.
  useEffect(() => { setQuery(selected?.name || '') }, [selected?.id, selected?.name])
  const matches = useMemo(() => { const search = query.trim().toLocaleLowerCase(); return recipes.filter((recipe) => !search || searchableText(recipe).includes(search)).slice(0, 10) }, [query, recipes])
  return <div className="recipe-picker"><input role="combobox" aria-label={label} aria-expanded={open} aria-controls={`${label.replace(/\s+/g, '-')}-results`} autoComplete="off" disabled={disabled} value={query} placeholder={placeholder} onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true) }} />{open && !disabled && <div className="recipe-picker__results" id={`${label.replace(/\s+/g, '-')}-results`} role="listbox"><button type="button" className="recipe-picker__clear" onMouseDown={(event) => event.preventDefault()} onClick={() => { onSelect(''); setQuery(''); setOpen(false) }}>{clearLabel}</button>{matches.map((recipe) => <button type="button" role="option" aria-selected={selected?.id === recipe.id} key={recipe.id} onMouseDown={(event) => event.preventDefault()} onClick={() => { onSelect(String(recipe.id)); setQuery(recipe.name); setOpen(false) }}><strong>{recipe.name}</strong><small>{[recipe.cuisine, recipe.category, ...(recipe.tags || []).slice(0, 2)].filter(Boolean).join(' · ')}</small></button>)}{matches.length === 0 && <span className="recipe-picker__empty">{placeholder}</span>}</div>}</div>
}
