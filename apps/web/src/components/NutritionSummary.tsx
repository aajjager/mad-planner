import type { CSSProperties } from 'react'
import type { Recipe } from '../api/recipes'

const numberFrom = (nutrition: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) {
    const raw = nutrition[key]
    const match = String(raw ?? '').replace(',', '.').match(/\d+(?:\.\d+)?/)
    if (match) return Number(match[0])
  }
  return null
}

interface NutritionValues { calories: number | null; fat: number | null; carbohydrates: number | null; protein: number | null }

const nutritionValues = (recipe: Recipe): NutritionValues | null => {
  if (!recipe.nutrition) return null
  const values = {
    calories: numberFrom(recipe.nutrition, 'calories', 'calorieContent', 'energy'),
    fat: numberFrom(recipe.nutrition, 'fatContent', 'fat'),
    carbohydrates: numberFrom(recipe.nutrition, 'carbohydrateContent', 'carbohydrates', 'carbs'),
    protein: numberFrom(recipe.nutrition, 'proteinContent', 'protein'),
  }
  return Object.values(values).some((value) => value !== null) ? values : null
}

export function NutritionSummary({ recipe, labels }: { recipe: Recipe; labels: { title: string; available: string; estimated: string; coverage: string; calories: string; fat: string; carbohydrates: string; protein: string } }) {
  const values = nutritionValues(recipe)
  if (!values) return null
  const fatEnergy = (values.fat || 0) * 9
  const carbohydrateEnergy = (values.carbohydrates || 0) * 4
  const proteinEnergy = (values.protein || 0) * 4
  const total = fatEnergy + carbohydrateEnergy + proteinEnergy
  const fatEnd = total ? fatEnergy / total * 100 : 0
  const carbohydrateEnd = total ? (fatEnergy + carbohydrateEnergy) / total * 100 : 0
  const chartStyle = { '--fat-end': `${fatEnd}%`, '--carb-end': `${carbohydrateEnd}%`, ...(total ? {} : { background: '#e7e4dc' }) } as CSSProperties
  const estimated = recipe.nutrition?.estimated === true
  const coverage = typeof recipe.nutrition?.coveragePercent === 'number' ? recipe.nutrition.coveragePercent : null
  return <section className="nutrition-summary" aria-label={labels.title}>
    <div className="nutrition-chart" style={chartStyle} aria-hidden="true"><span>{values.calories !== null ? Math.round(values.calories) : '—'}<small>kcal</small></span></div>
    <div><p className="eyebrow">{labels.title}</p><strong>{estimated ? labels.estimated : labels.available}</strong>{estimated && coverage !== null && <small className="nutrition-coverage">{labels.coverage}: {coverage}%</small>}<div className="nutrition-legend">{values.fat !== null && <span><i className="macro-fat" />{labels.fat} {values.fat} g</span>}{values.carbohydrates !== null && <span><i className="macro-carbs" />{labels.carbohydrates} {values.carbohydrates} g</span>}{values.protein !== null && <span><i className="macro-protein" />{labels.protein} {values.protein} g</span>}{values.calories !== null && <span className="nutrition-calories">{labels.calories}: {Math.round(values.calories)} kcal</span>}</div></div>
  </section>
}
