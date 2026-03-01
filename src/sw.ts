/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { registerRoute, NavigationRoute, Route } from 'workbox-routing'
import { NetworkFirst, StaleWhileRevalidate, CacheFirst } from 'workbox-strategies'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>
}

// ── Precache ──────────────────────────────────────────────────────────────
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// ── Navigation (SPA) ──────────────────────────────────────────────────────
registerRoute(
  new NavigationRoute(
    new NetworkFirst({
      cacheName: 'navigation',
      networkTimeoutSeconds: 3,
      plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
    })
  )
)

// ── Google Fonts ──────────────────────────────────────────────────────────
registerRoute(
  new Route(
    ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
    new CacheFirst({
      cacheName: 'fonts',
      plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
    })
  )
)

// ── Firestore / FCM (network first) ──────────────────────────────────────
registerRoute(
  new Route(
    ({ url }) => url.origin.includes('firestore.googleapis.com') || url.origin.includes('firebase.googleapis.com'),
    new NetworkFirst({
      cacheName: 'firebase',
      networkTimeoutSeconds: 5,
      plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
    })
  )
)

// ── FCM Background Push Handler ───────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return
  let data: { title?: string; body?: string; icon?: string; tag?: string } = {}
  try { data = event.data.json().notification ?? event.data.json() } catch {
    data = { title: 'Folio', body: event.data.text() }
  }
  const title = data.title ?? 'Folio'
  const options: NotificationOptions = {
    body: data.body ?? '',
    icon: data.icon ?? '/Folio/pwa-192x192.png',
    badge: '/Folio/pwa-192x192.png',
    tag: data.tag ?? 'folio-task',
    // renotify: true, // Not in all TS lib versions
    data: { url: '/Folio/' },
    // actions are supported on Android/Chrome but not in TS NotificationOptions type
    // actions: [{ action: 'open', title: 'Open' }, { action: 'snooze', title: 'Snooze 1h' }],
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

// ── Notification click ────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  if (event.action === 'snooze') {
    // Snooze: re-show after 1h
    // In a real implementation, post to a backend or use IndexedDB scheduled sync
    return
  }

  const url = (event.notification.data as { url?: string })?.url ?? '/Folio/'
  event.waitUntil(
    (self.clients as Clients).matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          ;(client as WindowClient).focus()
          ;(client as WindowClient).navigate(url)
          return
        }
      }
      return self.clients.openWindow(url)
    })
  )
})

// ── Background Sync (offline task queue) ─────────────────────────────────
self.addEventListener('sync', (event) => {
  if ((event as SyncEvent).tag === 'folio-offline-queue') {
    ;(event as ExtendableEvent).waitUntil(flushOfflineQueue())
  }
})

async function flushOfflineQueue() {
  // The offline queue is stored in localStorage by the app.
  // In a SW context, post message to client to flush it.
  const clients = await (self.clients as Clients).matchAll({ type: 'window' })
  for (const client of clients) {
    client.postMessage({ type: 'FLUSH_QUEUE' })
  }
}

self.skipWaiting()

self.addEventListener('activate', (event) => {
  event.waitUntil((self.clients as Clients).claim())
})

// Required for TypeScript
export {}
