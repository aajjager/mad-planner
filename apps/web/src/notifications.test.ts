import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { backgroundSubscribed } from './push'
import { showWeeklyReleaseNotification } from './notifications'
vi.mock('./push', () => ({ backgroundSubscribed: vi.fn() }))
const show = vi.fn().mockResolvedValue(undefined)
beforeEach(() => {
  localStorage.clear()
  vi.mocked(backgroundSubscribed).mockResolvedValue(false)
  vi.stubGlobal('isSecureContext', true)
  vi.stubGlobal('Notification', { permission: 'granted' })
  vi.stubGlobal('navigator', { serviceWorker: { ready: Promise.resolve({ showNotification: show }) } })
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.clearAllMocks() })
it('deduplicates concurrent and later calls and links to Updates', async () => {
  await Promise.all([1, 2].map(() => showWeeklyReleaseNotification('Updates', 'Notes', '0.11.1', 1, 1)))
  await showWeeklyReleaseNotification('Updates', 'Notes', '0.11.1', 1, 1)
  expect(show).toHaveBeenCalledTimes(1)
  expect(show).toHaveBeenCalledWith('Updates', expect.objectContaining({ data: { url: '/updates' } }))
  await showWeeklyReleaseNotification('Updates', 'Notes', '0.11.2', 1, 1)
  expect(show).toHaveBeenCalledTimes(2)
})
it('leaves background delivery to the subscribed device', async () => {
  vi.mocked(backgroundSubscribed).mockResolvedValue(true)
  await showWeeklyReleaseNotification('Updates', 'Notes', '0.11.1', 2, 1)
  expect(show).not.toHaveBeenCalled()
})
it('retries failures without marking the release delivered', async () => {
  show.mockRejectedValueOnce(new Error('temporary'))
  await expect(showWeeklyReleaseNotification('Updates', 'Notes', '0.11.1', 3, 1)).rejects.toThrow('temporary')
  expect(localStorage.getItem('madplanner-release-3-1-0.11.1')).toBeNull()
  await showWeeklyReleaseNotification('Updates', 'Notes', '0.11.1', 3, 1)
  expect(localStorage.getItem('madplanner-release-3-1-0.11.1')).not.toBeNull()
})
