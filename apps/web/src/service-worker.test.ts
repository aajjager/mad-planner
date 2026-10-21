import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

function worker() {
  const handlers: Record<string, (event: unknown) => void> = {}
  const showNotification = vi.fn().mockResolvedValue(undefined)
  const openWindow = vi.fn().mockResolvedValue(undefined)
  runInNewContext(readFileSync(resolve(process.cwd(), 'public/service-worker.js'), 'utf8'), {
    URL,
    self: { location: { origin: 'https://planner.test' }, registration: { showNotification },
      clients: { matchAll: () => Promise.resolve([]), openWindow },
      addEventListener: (name: string, handler: (event: unknown) => void) => { handlers[name] = handler } },
  })
  return { handlers, showNotification, openWindow }
}

describe('Background service worker', () => {
  it('displays an incoming push without an open app window', async () => {
    const { handlers, showNotification } = worker()
    let done: Promise<unknown> | undefined
    handlers.push({ data: { json: () => ({ title: 'Ready', body: 'Update', url: '/family', tag: 'feedback-1' }) }, waitUntil: (promise: Promise<unknown>) => { done = promise } })
    await done
    expect(showNotification).toHaveBeenCalledWith('Ready', expect.objectContaining({ body: 'Update', data: { url: 'https://planner.test/family' } }))
  })
  it('keeps notification clicks on trusted app pages', async () => {
    const { handlers, openWindow } = worker()
    let done: Promise<unknown> | undefined
    handlers.notificationclick({ notification: { close: vi.fn(), data: { url: 'https://evil.test/steal' } }, waitUntil: (promise: Promise<unknown>) => { done = promise } })
    await done
    expect(openWindow).toHaveBeenCalledWith('https://planner.test/family')
  })
  it('shows a safe fallback for malformed payloads', () => {
    const { handlers, showNotification } = worker()
    handlers.push({ data: { json: () => { throw new Error('bad json') } }, waitUntil: vi.fn() })
    expect(showNotification).toHaveBeenCalledWith('Mad Planner', expect.objectContaining({ body: '' }))
  })
})
