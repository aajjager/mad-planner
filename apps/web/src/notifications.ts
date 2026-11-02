import { backgroundSubscribed } from './push'

export const notificationsSupported = (): boolean =>
  'Notification' in window && 'serviceWorker' in navigator && window.isSecureContext

export async function enableBrowserNotifications(): Promise<boolean> {
  if (!notificationsSupported()) return false
  const permission = await Notification.requestPermission()
  return permission === 'granted'
}

export async function showPlanReminderNotification(title: string, body: string, weekStart: string): Promise<void> {
  if (!notificationsSupported() || Notification.permission !== 'granted') return
  if (await backgroundSubscribed().catch(() => false)) return
  const dedupeKey = `madplanner-plan-reminder-${weekStart}`
  if (window.localStorage.getItem(dedupeKey)) return
  const registration = await navigator.serviceWorker.ready
  await registration.showNotification(title, {
    body,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: 'madplanner-incomplete-plan',
    data: { url: `/planner?week=${weekStart}` },
  })
  window.localStorage.setItem(dedupeKey, new Date().toISOString())
}

const pendingReleases = new Set<string>()
const shownReleases = new Set<string>()
export async function showWeeklyReleaseNotification(title: string, body: string, version: string, accountId: number, familyId: number): Promise<void> {
  if (!notificationsSupported() || Notification.permission !== 'granted') return
  const key = `madplanner-release-${accountId}-${familyId}-${version}`
  if (pendingReleases.has(key) || shownReleases.has(key)) return
  pendingReleases.add(key)
  try {
    if (await backgroundSubscribed().catch(() => false)) return
    try { if (window.localStorage.getItem(key)) return } catch { return }
    const registration = await navigator.serviceWorker.ready
    await registration.showNotification(title, { body, icon: '/icon-v2-192.png', badge: '/icon-v2-192.png', tag: `madplanner-release-${version}`, data: { url: '/updates' } })
    shownReleases.add(key)
    try { window.localStorage.setItem(key, new Date().toISOString()) } catch { /* Keep page-session deduplication if storage becomes unavailable. */ }
  } finally { pendingReleases.delete(key) }
}
