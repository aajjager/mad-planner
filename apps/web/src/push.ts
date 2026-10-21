export const pushSupported = () => window.isSecureContext && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window

async function api(path: string, body?: unknown, method = 'POST') {
  const response = await fetch(`/api/v1/push/${path}`, body === undefined ? undefined : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!response.ok) throw new Error('Background notification settings could not be saved.')
  return response.status === 204 ? null : response.json()
}

export const pushConfig = () => api('config') as Promise<{ enabled: boolean; public_key: string | null }>

export async function backgroundSubscribed(): Promise<boolean> {
  if (!pushSupported()) return false
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return false
  return Boolean((await api('status', { endpoint: subscription.endpoint })).subscribed)
}

export async function enableBackgroundPush(publicKey: string): Promise<boolean> {
  if (!pushSupported()) return false
  // Permission must originate from the user's click, before network requests.
  if (await Notification.requestPermission() !== 'granted') return false
  const registration = await navigator.serviceWorker.ready
  const decoded = atob(publicKey.replace(/-/g, '+').replace(/_/g, '/'))
  const key = new Uint8Array(decoded.length)
  for (let i = 0; i < decoded.length; i++) key[i] = decoded.charCodeAt(i)
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
  await api('subscriptions', subscription.toJSON())
  return true
}

export async function disableBackgroundPush(): Promise<void> {
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return
  // Delete server registration first; a failed request must not report success.
  await api('subscriptions', { endpoint: subscription.endpoint }, 'DELETE')
  await subscription.unsubscribe()
}
