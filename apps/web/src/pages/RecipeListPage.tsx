import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listRecipeTypes } from '../api/auth'
import { listRecipes, type Recipe } from '../api/recipes'
import { useAuth } from '../auth/AuthContext'
import { translator } from '../i18n'
import { RecipeCardImage } from '../components/RecipeCardImage'
import { RecipeCollection } from '../components/RecipeCollection'
import { RecipeLibraryHeader } from '../components/RecipeLibraryHeader'

export function RecipeListPage() {
  const { account } = useAuth()
  const t = translator(account?.locale)
  const canEdit = account?.role === 'owner' || account?.role === 'editor'
  const [recipes, setRecipes] = useState<Recipe[] | null>(null)
  const [familyTypeNames, setFamilyTypeNames] = useState<string[]>([])
  const [error, setError] = useState(false)

  useEffect(() => {
    let current = true
    listRecipes().then((items) => {
      if (current) setRecipes(items)
    }).catch(() => {
      if (current) setError(true)
    })
    listRecipeTypes().then((types) => {
      if (current) setFamilyTypeNames(types.map((type) => type.name))
    }).catch(() => {
      // Browsing still works from the types present in the collection.
    })
    return () => { current = false }
  }, [])

  return <section className="page recipe-library">
    <RecipeLibraryHeader />
    {error && <p className="notice notice--error" role="alert">{t('recipesError')}</p>}
    {!error && recipes === null && <p className="notice" role="status">{t('loadingRecipes')}</p>}
    {recipes !== null && <RecipeCollection
      recipes={recipes} scope="family" configuredTypes={familyTypeNames}
      empty={<div className="empty-state">
        <span>✦</span><h2>{t('collectionReady')}</h2>
        {canEdit && <><p>{t('addRecipeChoiceHelp')}</p><Link className="button button--primary" to="/recipes/add">{t('createFirst')}</Link></>}
      </div>}
      renderCard={(recipe, types, rememberPosition) => <Link className="recipe-card" to={`/recipes/${recipe.id}`} onClick={rememberPosition}>
        <RecipeCardImage recipe={recipe} />
        <div className="recipe-card__body">
          <h2>{recipe.name}</h2>
          {types.length > 0 && <div className="tag-list">{types.map((type) => <span className="tag" key={type}>{type}</span>)}</div>}
        </div>
      </Link>}
    />}
  </section>
}
