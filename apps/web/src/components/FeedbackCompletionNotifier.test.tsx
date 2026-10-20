import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { Feedback } from '../api/auth'
import { listMyFeedback } from '../api/auth'
import { showFeedbackCompletionNotification } from '../notifications'
import { FeedbackCompletionNotifier } from './FeedbackCompletionNotifier'

vi.mock('../api/auth', () => ({ listMyFeedback: vi.fn() }))
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ account: { locale: 'en', browser_notifications_enabled: true } }) }))
vi.mock('../notifications', () => ({ showFeedbackCompletionNotification: vi.fn() }))
afterEach(() => { cleanup(); vi.clearAllMocks() })

it('notifies only undismissed completions younger than five days, excluding questions', async () => {
  const now = Date.now()
  const recent = { id: 1, content: 'Recent completion', category: 'improvement', status: 'done', completed_at: new Date(now - 86400000).toISOString(), completion_seen_at: null } as Feedback
  vi.mocked(listMyFeedback).mockResolvedValue([
    recent,
    { ...recent, id: 2, completed_at: new Date(now - 5 * 86400000).toISOString() },
    { ...recent, id: 3, completion_seen_at: new Date(now).toISOString() },
    { ...recent, id: 4, is_question: true },
    { ...recent, id: 5, completed_at: null },
  ])
  render(<FeedbackCompletionNotifier />)
  await waitFor(() => expect(showFeedbackCompletionNotification).toHaveBeenCalledTimes(1))
  expect(showFeedbackCompletionNotification).toHaveBeenCalledWith(expect.any(String), recent.content, recent.id)
})
