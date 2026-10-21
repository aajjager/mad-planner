const CACHE_NAME = 'madplanner-shell-v3'
const SHELL = ['/', '/manifest.webmanifest', '/favicon.svg', '/apple-touch-icon.png', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))))
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request).then((response) => response || caches.match('/'))))
})

function notificationTarget(value) {
  try {
    const url = new URL(value || '/family', self.location.origin)
    return url.origin === self.location.origin && ['/family', '/planner'].includes(url.pathname) ? url.href : self.location.origin + '/family'
  } catch { return self.location.origin + '/family' }
}

self.addEventListener('push', (event) => {
  let payload = {}
  try { payload = event.data?.json() || {} } catch { /* Show a safe generic notice. */ }
  event.waitUntil(self.registration.showNotification(typeof payload.title === 'string' ? payload.title : 'Mad Planner', {
    body: typeof payload.body === 'string' ? payload.body : '', icon: '/icon-192.png', badge: '/icon-192.png',
    tag: typeof payload.tag === 'string' ? payload.tag : 'madplanner-update',
    data: { url: notificationTarget(payload.url) },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = notificationTarget(event.notification.data?.url)
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => 'focus' in client)
    return existing ? existing.navigate(target).then(() => existing.focus()) : self.clients.openWindow(target)
  }))
})
