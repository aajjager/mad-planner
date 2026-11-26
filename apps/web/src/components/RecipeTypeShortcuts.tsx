import { AppIcon } from './AppIcon'

type IconName = Parameters<typeof AppIcon>[0]['name']
const typeIcons = new Map<string, IconName>([
  ['beverages', 'beverages'], ['dinner', 'dinner'], ['lunch', 'lunch'], ['breakfast', 'breakfast'],
  ['bread', 'bread'], ['bake-off', 'bakeOff'], ['cake', 'cake'], ['dessert', 'dessert'],
  ['snack', 'snack'], ['soup', 'soup'],
])
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
      <AppIcon name={type ? typeIcons.get(type.toLowerCase()) ?? 'recipeTag' : 'recipes'} />
      <span>{type || allLabel}</span>
    </button>)}
  </div>
}
