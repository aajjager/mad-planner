export const notificationsSupported = (): boolean =>
  'Notification' in window && 'serviceWorker' in navigator && window.isSecureContext

export async function enableBrowserNotifications(): Promise<boolean> {
  if (!notificationsSupported()) return false
  const permission = await Notification.requestPermission()
  return permission === 'granted'
}

export async function showPlanReminderNotification(title: string, body: string, weekStart: string): Promise<void> {
  if (!notificationsSupported() || Notification.permission !== 'granted') return
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
