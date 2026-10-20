import type { Feedback } from '../api/auth'

export const feedbackCompletionLifetime = 5 * 24 * 60 * 60 * 1000

export function feedbackCompletionExpiresAt(item: Feedback): number {
  return item.completed_at ? Date.parse(item.completed_at) + feedbackCompletionLifetime : NaN
}

export function isFeedbackCompletionVisible(item: Feedback, now = Date.now()): boolean {
  return item.status === 'done' && !item.is_question && !item.completion_seen_at
    && feedbackCompletionExpiresAt(item) > now
}
