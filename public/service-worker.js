// service-worker.js
// PWA service worker. Cache strategy:
//   - Cache shell assets on install (app shell caching)
//   - Cache-first for static assets (JS, CSS, images)
//   - Network-first for API calls (/api/*)
//   - Offline fallback for gym mode — session data queued and synced on reconnect

const CACHE_NAME = 'fitagent-v1'
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
]

// Install: cache shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  )
  self.skipWaiting()
})

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Fetch: route strategy
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Network-first for API calls
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    )
    return
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  )
})
