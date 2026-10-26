// Accept one missing, extra, changed, or transposed letter in a word.
function nearWord(value: string, query: string): boolean {
  if (query.length < 4 || Math.abs(value.length - query.length) > 1) return false
  let index = 0
  while (index < value.length && value[index] === query[index]) index += 1
  if (value.length === query.length) {
    return value.slice(index + 1) === query.slice(index + 1)
      || (value[index] === query[index + 1] && value[index + 1] === query[index]
        && value.slice(index + 2) === query.slice(index + 2))
  }
  return value.length > query.length
    ? value.slice(index + 1) === query.slice(index)
    : value.slice(index) === query.slice(index + 1)
}

export function matchesPlanningPreference(value: string, search: string): boolean {
  const label = value.toLocaleLowerCase()
  const query = search.trim().toLocaleLowerCase()
  if (label.includes(query)) return true
  const words = label.split(/[\s-]+/)
  return query.split(/\s+/).every((part) => words.some((word) => word === part || nearWord(word, part)))
}
