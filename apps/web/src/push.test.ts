import { afterEach, describe, expect, it, vi } from 'vitest'
import { backgroundSubscribed, disableBackgroundPush, enableBackgroundPush } from './push'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

function browser(permission = 'granted') {
  const subscription = { endpoint: 'https://fcm.googleapis.com/device', toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/device', keys: { p256dh: 'public', auth: 'auth' } }), unsubscribe: vi.fn().mockResolvedValue(true) }
  const manager = { getSubscription: vi.fn().mockResolvedValue(null), subscribe: vi.fn().mockResolvedValue(subscription) }
  vi.stubGlobal('isSecureContext', true)
  vi.stubGlobal('PushManager', class {})
  vi.stubGlobal('Notification', { requestPermission: vi.fn().mockResolvedValue(permission) })
  vi.stubGlobal('navigator', { serviceWorker: { ready: Promise.resolve({ pushManager: manager }) } })
  return { subscription, manager }
}

describe('Background push registration', () => {
  it('asks permission on demand and saves the encrypted browser subscription', async () => {
    const { subscription, manager } = browser()
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 201 }))
    expect(await enableBackgroundPush('AQID')).toBe(true)
    expect(manager.subscribe).toHaveBeenCalledWith({ userVisibleOnly: true, applicationServerKey: new Uint8Array([1, 2, 3]) })
    expect(fetch).toHaveBeenCalledWith('/api/v1/push/subscriptions', expect.objectContaining({ body: JSON.stringify(subscription.toJSON()) }))
  })
  it('does not register or contact the server when permission is denied', async () => {
    const { manager } = browser('denied')
    const fetch = vi.spyOn(globalThis, 'fetch')
    expect(await enableBackgroundPush('AQID')).toBe(false)
    expect(manager.subscribe).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })
  it('checks the current login ownership and removes server registration before unsubscribing', async () => {
    const { subscription, manager } = browser()
    manager.getSubscription.mockResolvedValue(subscription)
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('{"subscribed":false}')).mockResolvedValueOnce(new Response(null, { status: 204 }))
    expect(await backgroundSubscribed()).toBe(false)
    await disableBackgroundPush()
    expect(fetch).toHaveBeenLastCalledWith('/api/v1/push/subscriptions', expect.objectContaining({ method: 'DELETE' }))
    expect(subscription.unsubscribe).toHaveBeenCalledOnce()
  })
  it('does not claim successful disable when server removal fails', async () => {
    const { subscription, manager } = browser()
    manager.getSubscription.mockResolvedValue(subscription)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 500 }))
    await expect(disableBackgroundPush()).rejects.toThrow()
    expect(subscription.unsubscribe).not.toHaveBeenCalled()
  })
})
