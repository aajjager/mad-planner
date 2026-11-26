import type { AppIcon } from './AppIcon'

const typeIcons = new Map<string, Parameters<typeof AppIcon>[0]['name']>([
  ['beverages', 'beverages'], ['beverage', 'beverages'], ['drikkevarer', 'beverages'], ['dranken', 'beverages'],
  ['dinner', 'dinner'], ['aftensmad', 'dinner'], ['hovedret', 'dinner'], ['hovedretter', 'dinner'], ['avondeten', 'dinner'], ['hoofdgerecht', 'dinner'],
  ['lunch', 'lunch'], ['frokost', 'lunch'],
  ['breakfast', 'breakfast'], ['morgenmad', 'breakfast'], ['ontbijt', 'breakfast'],
  ['bread', 'bread'], ['brød', 'bread'], ['brood', 'bread'],
  ['bake-off', 'bakeOff'], ['cake', 'cake'], ['kage', 'cake'], ['taart', 'cake'],
  ['dessert', 'dessert'], ['snack', 'snack'], ['soup', 'soup'], ['suppe', 'soup'], ['soep', 'soup'],
])

export function recipeTypeIcon(type: string) {
  return typeIcons.get(type.trim().toLowerCase())
}
