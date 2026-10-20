const CACHE_NAME = 'demba-offline-dscholar-v3'
const STATIC_ASSETS = [
  '/',
  '/login',
  '/manifest.json'
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

  // Détection des requêtes RSC Next.js (React Server Components)
  if (url.searchParams.has('_rsc')) {
    event.respondWith(
      fetch(request).catch(() => {
        // En hors-ligne, renvoyer 503 pour forcer Next.js à basculer vers un rechargement de page complet (interceptable par le SW)
        return new Response(null, {
          status: 503,
          statusText: 'Service Unavailable (Offline RSC Fallback)',
          headers: { 'Retry-After': '0' }
        })
      })
    )
    return
  }

  // 1. Navigation requests (HTML pages) : Network-First with Smart Cache Fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clone)
              if (url.pathname === '/dashboard') {
                cache.put('/dashboard', response.clone())
              }
            })
          }
          return response
        })
        .catch(async () => {
          const hasOfflineSessionCookie = event.request.headers.get('cookie')?.includes('demba_offline_active=1') || false

          // Match direct de la route
          const cachedResponse = await caches.match(request)
          if (cachedResponse) return cachedResponse

          // Si l'utilisateur ouvre la racine "/" hors-ligne mais qu'une session existe, rediriger vers l'espace de travail
          if (url.pathname === '/' && hasOfflineSessionCookie) {
            const fallbackDashboard = await caches.match('/dashboard')
            if (fallbackDashboard) return fallbackDashboard
          }

          // Routes de l'application connectée
          if (
            url.pathname.startsWith('/dashboard') ||
            url.pathname.startsWith('/eleves') ||
            url.pathname.startsWith('/classes') ||
            url.pathname.startsWith('/facturation') ||
            url.pathname.startsWith('/tresorerie') ||
            url.pathname.startsWith('/notes') ||
            url.pathname.startsWith('/assiduite') ||
            url.pathname.startsWith('/enseignants') ||
            url.pathname.startsWith('/admissions') ||
            url.pathname.startsWith('/passages') ||
            url.pathname.startsWith('/portail')
          ) {
            const fallbackDashboard = await caches.match('/dashboard')
            if (fallbackDashboard) return fallbackDashboard

            const fallbackLogin = await caches.match('/login')
            if (fallbackLogin) return fallbackLogin
          }

          // Fallback login
          const fallbackLogin = await caches.match('/login')
          if (fallbackLogin && url.pathname.includes('/login')) return fallbackLogin

          // Fallback landing page ou page générique
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
