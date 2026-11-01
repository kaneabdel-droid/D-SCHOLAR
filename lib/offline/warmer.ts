/**
 * Warmer proactif de routes et de payloads RSC pour D-SCHOLAR
 */

export async function warmAppOfflineCache(routes: string[], cacheName = 'demba-offline-dscholar-v4'): Promise<void> {
  if (typeof window === 'undefined' || !navigator.onLine || !('caches' in window)) {
    return
  }

  try {
    const cache = await caches.open(cacheName)

    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SET_OFFLINE_SESSION', active: true })
    }

    for (const route of routes) {
      try {
        const htmlRes = await fetch(route, { cache: 'no-cache' })
        if (htmlRes.ok && htmlRes.status === 200) {
          await cache.put(route, htmlRes)
        }

        const sep = route.includes('?') ? '&' : '?'
        const rscUrl = `${route}${sep}_rsc=1`
        const rscRes = await fetch(rscUrl, {
          headers: { 'RSC': '1' },
          cache: 'no-cache'
        })
        if (rscRes.ok && rscRes.status === 200) {
          await cache.put(rscUrl, rscRes)
        }
      } catch {
        // Ignorer en tâche de fond
      }
    }
  } catch (err) {
    console.warn('[Offline Warmer D-SCHOLAR] Erreur:', err)
  }
}
