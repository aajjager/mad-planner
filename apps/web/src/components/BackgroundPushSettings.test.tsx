import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BackgroundPushSettings } from './BackgroundPushSettings'
import * as push from '../push'

const { setPreferences } = vi.hoisted(() => ({ setPreferences: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ account: { id: 1, locale: 'en', browser_notifications_enabled: true }, setBrowserNotifications: setPreferences }) }))
vi.mock('../push', () => ({ pushSupported: vi.fn(() => true), pushConfig: vi.fn(), backgroundSubscribed: vi.fn(), enableBackgroundPush: vi.fn(), disableBackgroundPush: vi.fn() }))
afterEach(() => { cleanup(); vi.resetAllMocks() })

describe('Background notification settings', () => {
  it('shows administrator setup state without asking for browser permission', async () => {
    vi.mocked(push.pushSupported).mockReturnValue(true)
    vi.mocked(push.pushConfig).mockResolvedValue({ enabled: false, public_key: null })
    vi.mocked(push.backgroundSubscribed).mockResolvedValue(false)
    render(<BackgroundPushSettings />)
    expect(await screen.findByText(/administrator needs to configure/)).toBeVisible()
    expect(push.enableBackgroundPush).not.toHaveBeenCalled()
  })
  it('enables only after a click and allows this device to unsubscribe', async () => {
    vi.mocked(push.pushSupported).mockReturnValue(true)
    vi.mocked(push.pushConfig).mockResolvedValue({ enabled: true, public_key: 'public-key' })
    vi.mocked(push.backgroundSubscribed).mockResolvedValue(false)
    vi.mocked(push.enableBackgroundPush).mockResolvedValue(true)
    setPreferences.mockResolvedValue(undefined)
    render(<BackgroundPushSettings />)
    const enable = await screen.findByRole('button', { name: 'Enable background notifications' })
    await waitFor(() => expect(enable).toBeEnabled())
    fireEvent.click(enable)
    fireEvent.click(await screen.findByRole('button', { name: 'Disable on this device' }))
    await waitFor(() => expect(push.disableBackgroundPush).toHaveBeenCalledOnce())
    expect(setPreferences).toHaveBeenCalledWith(true)
    expect(setPreferences).not.toHaveBeenCalledWith(false)
  })
})
