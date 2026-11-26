import type { Recipe } from '../api/recipes'
import { AppIcon } from './AppIcon'
import { recipeTypeIcon } from './recipeTypeIcons'

export function RecipeCardImage({ recipe }: { recipe: Pick<Recipe, 'image_url' | 'recipe_types' | 'tags'> }) {
  if (recipe.image_url) {
    return <div className="recipe-card__image"><img src={recipe.image_url} alt="" /></div>
  }

  const labels = recipe.recipe_types?.length ? recipe.recipe_types : recipe.tags
  const types = [...new Set(labels.map(label => label.trim().toLowerCase()).filter(Boolean))]
  const icon = types.length === 1 ? recipeTypeIcon(types[0]) : undefined

  return <div className="recipe-card__image"><AppIcon name={icon ?? 'plate'} /></div>
}
