import type { RecipeScanPreview } from '../api/recipes'

const normalize = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/ø/g, 'o').replace(/æ/g, 'ae').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

// Compare word pairs so repeated passages match despite small OCR differences.
function similarity(a: string, b: string) {
  const pairs = (text: string) => {
    const words = normalize(text).split(' ')
    return new Set(words.length < 3 ? words : words.slice(1).map((word, index) => `${words[index]} ${word}`))
  }
  const left = pairs(a), right = pairs(b)
  return 2 * [...left].filter((word) => right.has(word)).length / Math.max(1, left.size + right.size)
}

function wordCoverage(a: string, b: string) {
  const left = new Set(normalize(a).split(' ')), right = new Set(normalize(b).split(' '))
  if (Math.min(left.size, right.size) < 8) return 0
  return [...left].filter((word) => right.has(word)).length / Math.min(left.size, right.size)
}

function sameIngredient(a: string, b: string) {
  const identity = (text: string) => normalize(text.split(/[.!?](?:\s|$)/)[0]).replace(/^(?:[0-9i .,/]+)?\s*(?:g|kg|ml|dl|l|tsk|spsk|tsp|tbsp|cups?|grams?)(?=\s|[a-z])\s*/, '').replace(/^[0-9i .,/]+\s*/, '').replace(/\s/g, '')
  const left = identity(a), right = identity(b)
  const grams = (text: string) => new Set([...text].slice(1).map((char, index) => text[index] + char))
  const x = grams(left), y = grams(right)
  return left === right || 2 * [...x].filter((part) => y.has(part)).length / Math.max(1, x.size + y.size) >= 0.8
}

export function combineRecipeScans(scans: { name: string; preview: RecipeScanPreview }[]): RecipeScanPreview {
  scans = scans.filter(({ preview }) => preview.usable !== false)
  if (!scans.length) throw new Error('No scans to combine')
  const hasQuantity = (text: string) => /^\s*(?:\d|[¼½¾⅓⅔⅛⅜⅝⅞])/.test(text)
  const quality = (preview: RecipeScanPreview) => (preview.confidence ?? 0.7) * (preview.ingredients.length ? 0.65 + 0.35 * preview.ingredients.filter(hasQuantity).length / preview.ingredients.length : 1)
  const ranked = [...scans].sort((a, b) => quality(b.preview) - quality(a.preview))
  const combine = (field: 'ingredients' | 'instructions') => {
    const entries: { text: string; confidence: number; source: number }[] = []
    for (const scan of ranked) {
      const { preview } = scan
      const source = scans.indexOf(scan)
      for (const text of preview[field]) {
        const normalized = normalize(text)
        if (!normalized) continue
        const match = entries.findIndex((entry) => {
          const existing = normalize(entry.text)
          return existing === normalized || (field === 'instructions' && Math.min(existing.length, normalized.length) > 30 && (existing.includes(normalized) || normalized.includes(existing))) || (field === 'ingredients' ? sameIngredient(entry.text, text) : similarity(entry.text, text) >= 0.45 || wordCoverage(entry.text, text) >= 0.7)
        })
        // A glare-damaged overlapping page must not add unquantified fragments
        // after a more complete page already supplied the same ingredient list.
        const overlaps = preview.ingredients.filter((item) => ranked[0].preview.ingredients.some((best) => sameIngredient(item, best))).length / Math.max(1, preview.ingredients.length)
        if (match < 0 && field === 'ingredients' && !hasQuantity(text) && overlaps >= 0.5 && quality(preview) < quality(ranked[0].preview) * 0.9) continue
        if (match < 0) entries.push({ text, confidence: preview.confidence ?? 0.7, source })
        else if ((preview.confidence ?? 0.7) > entries[match].confidence && (field !== 'ingredients' || hasQuantity(text) || !hasQuantity(entries[match].text))) entries[match] = { text, confidence: preview.confidence ?? 0.7, source }
      }
    }
    // A full paragraph can replace several matching fragments from a weaker photo.
    return entries.filter((entry, index) => !entries.some((other, otherIndex) => otherIndex !== index && other.text.length > entry.text.length && normalize(other.text).includes(normalize(entry.text)))).sort((a, b) => a.source - b.source).map((entry) => entry.text)
  }
  return {
    ...ranked[0].preview,
    description: ranked.find(({ preview }) => preview.description?.trim())?.preview.description,
    ingredients: combine('ingredients'),
    instructions: combine('instructions'),
    raw_text: scans.map(({ name, preview }) => `${name}\n${preview.raw_text}`).join('\n\n'),
    warnings: [...new Set(scans.flatMap(({ preview }) => preview.warnings))],
  }
}
