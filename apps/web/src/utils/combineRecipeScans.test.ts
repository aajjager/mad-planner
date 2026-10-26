import { describe, expect, it } from 'vitest'
import { combineRecipeScans } from './combineRecipeScans'
import type { RecipeScanPreview } from '../api/recipes'

const scan = (name: string, values: Partial<RecipeScanPreview>) => ({ name, preview: { name: 'Chili', ingredients: [], instructions: [], raw_text: name, warnings: [], ...values } })

describe('combining recipe photos', () => {
  it('prefers clearer overlapping text without merging different spices', () => {
    const result = combineRecipeScans([
      scan('spread', { confidence: 0.7, ingredients: ['I tsk stadt kane!', '1 tsk stødt spidskommen', '350 g hakket oksekød'] }),
      scan('close-up', { confidence: 0.9, ingredients: ['1 tsk stadt kanel', '1 tsk stødt spidskommen', '350 g hakket oksekod'] }),
    ])
    expect(result.ingredients).toEqual(['1 tsk stadt kanel', '1 tsk stødt spidskommen', '350 g hakket oksekod'])
    expect(result.raw_text).toContain('spread')
    expect(result.raw_text).toContain('close-up')
  })
  it('preserves distinct pages in selected reading order even when page two is clearer', () => {
    const result = combineRecipeScans([
      scan('page one', { confidence: 0.7, ingredients: ['2 eggs'], instructions: ['Whisk.'] }),
      scan('page two', { confidence: 0.9, ingredients: ['200 g flour'], instructions: ['Bake until golden.'] }),
    ])
    expect(result.ingredients).toEqual(['2 eggs', '200 g flour'])
    expect(result.instructions).toEqual(['Whisk.', 'Bake until golden.'])
  })
  it('does not repeat a paragraph when a close-up supplies a better version', () => {
    const result = combineRecipeScans([
      scan('old', { confidence: 0.7, instructions: ['Add the tomatoes and simmer for thirty minutes before serving.'] }),
      scan('new', { confidence: 0.9, instructions: ['Add the tomatoes and simmer gently for thirty minutes before serving.'] }),
    ])
    expect(result.instructions).toEqual(['Add the tomatoes and simmer gently for thirty minutes before serving.'])
  })
  it('retains a description and warnings from another photo when absent in the clearest one', () => {
    const result = combineRecipeScans([scan('one', { description: 'Family favourite.', warnings: ['Review text'] }), scan('two', { confidence: 0.95 })])
    expect(result.description).toBe('Family favourite.')
    expect(result.warnings).toContain('Review text')
  })
})
