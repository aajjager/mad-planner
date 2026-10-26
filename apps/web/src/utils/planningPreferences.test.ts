import { describe, expect, it } from 'vitest'
import { matchesPlanningPreference } from './planningPreferences'

describe('planning preference search', () => {
  it.each(['burger', ' BURGER ', 'bruger', 'burgr', 'burgger', 'burxer', 'crispy bruger'])('finds a saved meal for %s', (query) => {
    expect(matchesPlanningPreference('Crispy Burger menu', query)).toBe(true)
  })
  it('preserves ingredient and cuisine substring matching', () => {
    expect(matchesPlanningPreference('Italian', 'ital')).toBe(true)
    expect(matchesPlanningPreference('Brown rice', 'rice')).toBe(true)
  })
  it.each(['zzzz', 'pasta', 'bug', 'burger soup'])('rejects unrelated queries: %s', (query) => {
    expect(matchesPlanningPreference('Burger menu', query)).toBe(false)
  })
})
