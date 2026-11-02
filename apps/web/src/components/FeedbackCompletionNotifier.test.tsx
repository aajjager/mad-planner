import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { showWeeklyReleaseNotification } from '../notifications'
import { FeedbackCompletionNotifier } from './FeedbackCompletionNotifier'
const state = vi.hoisted(() => ({ enabled: true, version: '0.11.1', notes: ['A new change.'] as string[] }))
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ account: { id: 1, family_id: 2, locale: 'en', browser_notifications_enabled: state.enabled } }) }))
vi.mock('../utils/releases', () => ({ releaseVersion: () => '0.11.1', releases: [{ get version() { return state.version }, groups: [{ get notes() { return state.notes } }] }] }))
vi.mock('../notifications', () => ({ showWeeklyReleaseNotification: vi.fn().mockResolvedValue(undefined) }))
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-02T12:00:00Z')); state.enabled = true; state.version = '0.11.1'; state.notes = ['A new change.'] })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks() })
it('offers a release notice instead of polling individual feedback', () => {
  render(<FeedbackCompletionNotifier />)
  expect(showWeeklyReleaseNotification).toHaveBeenCalledWith(expect.any(String), expect.any(String), '0.11.1', 1, 2)
})
it.each(['disabled', 'empty', 'old', 'quiet'])('does not notify for %s releases', (kind) => {
  if (kind === 'disabled') state.enabled = false
  if (kind === 'empty') state.notes = []
  if (kind === 'old') state.version = '0.10.4'
  if (kind === 'quiet') vi.setSystemTime(new Date('2026-11-02T03:00:00Z'))
  render(<FeedbackCompletionNotifier />)
  expect(showWeeklyReleaseNotification).not.toHaveBeenCalled()
})
