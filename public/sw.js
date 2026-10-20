const CACHE_NAME = 'demba-offline-dscholar-v2'
const STATIC_ASSETS = [
  '/',
  '/login',
  '/manifest.json',
  '/dashboard',
  '/eleves',
  '/classes',
  '/facturation',
  '/tresorerie',
  '/notes',
  '/assiduite',
  '/enseignants'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Pré-mise en cache SW partielle D-SCHOLAR:', err)
      })
    }).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    }).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== 'GET' || !url.protocol.startsWith('http')) return

  if (url.pathname.startsWith('/api/')) return

  // 1. Navigation requests (HTML pages) : Network-First with Cache Fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request)
          if (cachedResponse) return cachedResponse

          const fallbackDashboard = await caches.match('/dashboard')
          if (fallbackDashboard) return fallbackDashboard

          const fallbackLogin = await caches.match('/login')
          if (fallbackLogin) return fallbackLogin

          return (await caches.match('/')) || new Response('Application D-SCHOLAR hors-ligne', { status: 503 })
        })
    )
    return
  }

  // 2. Static build assets (_next/static, fonts, images) : Cache-First
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.woff2')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request)
          .then((networkRes) => {
            if (networkRes && networkRes.status === 200) {
              const clone = networkRes.clone()
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
            }
            return networkRes
          })
          .catch(() => new Response('', { status: 408 }))
      })
    )
    return
  }

  // 3. Autres requêtes : Network-first
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  )
})
