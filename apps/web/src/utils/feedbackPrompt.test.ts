import { describe, expect, it } from 'vitest'
import type { Feedback } from '../api/auth'
import { feedbackPrompt } from './feedbackPrompt'

describe('Codex feedback prompts', () => {
  it.each([
    ['bug', 'bug fix', 'bug fixes', 'Bug fixes'],
    ['feature', 'feature request', 'feature requests', 'Features'],
    ['improvement', 'improvement', 'improvements', 'Improvements'],
  ] as const)('preserves %s for individual and grouped requests', (category, singular, plural, heading) => {
    const item = { content: 'Approved request', category, attachment_url: '/media/example.png' } as Feedback
    const date = new Date('2026-10-18T12:00:00Z')
    for (const count of [1, 2]) {
      const prompt = feedbackPrompt(category, Array(count).fill(item), 'http://localhost:8080', date)
      expect(prompt).toContain(`Mad Planner ${count === 1 ? singular : plural}:`)
      expect(prompt).toContain(`Request type: ${category}`)
      expect(prompt).toContain(`### ${heading}`)
      expect(prompt).toContain('0.10.3')
      expect(prompt).toContain('recalculate')
      expect(prompt).toContain('http://localhost:8080/media/example.png')
      expect(prompt).toContain('preserve current data')
      expect(prompt).toContain('ask me to commit and push')
    }
  })
})
