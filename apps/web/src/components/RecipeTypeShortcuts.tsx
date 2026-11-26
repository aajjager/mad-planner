import { AppIcon } from './AppIcon'
import { recipeTypeIcon } from './recipeTypeIcons'

const featuredTypes = ['beverages', 'dinner', 'lunch', 'breakfast']

function typePriority(type: string) {
  const index = featuredTypes.indexOf(type.toLowerCase())
  return index === -1 ? featuredTypes.length : index
}

interface RecipeTypeShortcutsProps {
  types: string[]
  selected: string
  onSelect: (type: string) => void
  label: string
  allLabel: string
}

export function RecipeTypeShortcuts({ types, selected, onSelect, label, allLabel }: RecipeTypeShortcutsProps) {
  const orderedTypes = [...types].sort((a, b) => typePriority(a) - typePriority(b) || a.localeCompare(b))

  return <div className="recipe-type-shortcuts" role="group" aria-label={label}>
    {['', ...orderedTypes].map((type) => <button
      key={type}
      type="button"
      className="recipe-type-shortcut"
      aria-pressed={selected === type}
      onClick={() => onSelect(type)}
    >
      <AppIcon name={type ? recipeTypeIcon(type) ?? 'recipeTag' : 'recipes'} />
      <span>{type || allLabel}</span>
    </button>)}
  </div>
}
