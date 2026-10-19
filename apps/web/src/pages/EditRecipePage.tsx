import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getRecipe, type Recipe } from '../api/recipes'
import { translator } from '../i18n'
import { useAuth } from '../auth/AuthContext'
import { CreateRecipePage } from './CreateRecipePage'

export function EditRecipePage() {
  const { recipeId } = useParams()
  const { account } = useAuth()
  const t = translator(account?.locale)
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    getRecipe(Number(recipeId)).then((item) => { if (active) setRecipe(item) }).catch((reason) => { if (active) setError(reason.message) })
    return () => { active = false }
  }, [recipeId])
  if (error) return <section className="page"><p role="alert">{error}</p><Link to="/recipes">{t('allRecipes')}</Link></section>
  if (!recipe || recipe.id !== Number(recipeId)) return <section className="page">{t('loadingRecipes')}</section>
  if (!recipe.owned_by_current_family) return <section className="page"><Link to={`/recipes/${recipe.id}`}>{t('allRecipes')}</Link></section>
  return <CreateRecipePage key={recipe.id} initialRecipe={recipe} />
}
