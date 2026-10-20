import { describe, expect, it } from 'vitest'
import type { Feedback } from '../api/auth'
import { feedbackCompletionLifetime, isFeedbackCompletionVisible } from './feedbackCompletion'

const completed = { status: 'done', completed_at: '2026-10-15T12:00:00Z', completion_seen_at: null } as Feedback
const expiry = Date.parse(completed.completed_at!) + feedbackCompletionLifetime

describe('feedback completion notices', () => {
  it('shows a completion for five days, excluding the exact expiry boundary', () => {
    expect(isFeedbackCompletionVisible(completed, expiry - 1)).toBe(true)
    expect(isFeedbackCompletionVisible(completed, expiry)).toBe(false)
    expect(isFeedbackCompletionVisible(completed, expiry + 1)).toBe(false)
  })
  it('uses the completion instant even across timezone offsets', () => {
    expect(isFeedbackCompletionVisible({ ...completed, completed_at: '2026-10-15T14:00:00+02:00' }, expiry)).toBe(false)
  })
  it.each([
    { completion_seen_at: '2026-10-16T12:00:00Z' },
    { status: 'pending' as const },
    { status: 'approved' as const },
    { status: 'rejected' as const },
    { is_question: true },
    { completed_at: null },
    { completed_at: 'invalid' },
  ])('hides dismissed, incomplete, question, or undated notices: %j', (changes) => {
    expect(isFeedbackCompletionVisible({ ...completed, ...changes }, expiry - 1)).toBe(false)
  })
})
