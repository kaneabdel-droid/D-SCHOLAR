/**
 * Stockage IndexedDB Local pour le mode Hors-Ligne de D-SCHOLAR
 * Permet la saisie des paiements, présences et notes scolaires hors-ligne
 * avec rejeu immédiat dès rétablissement du réseau.
 */

const DB_NAME = 'demba_offline_dscholar'
const DB_VERSION = 1
const STORE_PENDING = 'pending_queue'
const STORE_CACHED_DATA = 'cached_data'

export interface QueuedAction {
  id: string
  actionType: string // ex: 'paiement_eleve', 'pointage_presence', 'saisie_note', etc.
  payload: any
  label: string
  createdAt: number
  retryCount: number
  status: 'pending' | 'syncing' | 'failed'
  error?: string
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB non supporté'))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_PENDING)) {
        const store = db.createObjectStore(STORE_PENDING, { keyPath: 'id' })
        store.createIndex('createdAt', 'createdAt', { unique: false })
        store.createIndex('status', 'status', { unique: false })
      }
      if (!db.objectStoreNames.contains(STORE_CACHED_DATA)) {
        db.createObjectStore(STORE_CACHED_DATA, { keyPath: 'key' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function enqueueOfflineAction(action: Omit<QueuedAction, 'id' | 'createdAt' | 'retryCount' | 'status'>): Promise<QueuedAction> {
  const db = await openDB()
  const queuedItem: QueuedAction = {
    ...action,
    id: `scholar_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    createdAt: Date.now(),
    retryCount: 0,
    status: 'pending',
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING, 'readwrite')
    const store = tx.objectStore(STORE_PENDING)
    const req = store.add(queuedItem)

    req.onsuccess = () => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('demba-offline-queue-changed', { detail: { count: 1 } }))
      }
      resolve(queuedItem)
    }
    req.onerror = () => reject(req.error)
  })
}

export async function getPendingActions(): Promise<QueuedAction[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING, 'readonly')
    const store = tx.objectStore(STORE_PENDING)
    const req = store.getAll()

    req.onsuccess = () => {
      const results: QueuedAction[] = (req.result || []).sort((a: QueuedAction, b: QueuedAction) => a.createdAt - b.createdAt)
      resolve(results)
    }
    req.onerror = () => reject(req.error)
  })
}

export async function getPendingCount(): Promise<number> {
  try {
    const actions = await getPendingActions()
    return actions.length
  } catch {
    return 0
  }
}

export async function removeQueuedAction(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING, 'readwrite')
    const store = tx.objectStore(STORE_PENDING)
    const req = store.delete(id)

    req.onsuccess = () => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('demba-offline-queue-changed'))
      }
      resolve()
    }
    req.onerror = () => reject(req.error)
  })
}

export async function updateQueuedAction(item: QueuedAction): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING, 'readwrite')
    const store = tx.objectStore(STORE_PENDING)
    const req = store.put(item)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function clearAllPending(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING, 'readwrite')
    const store = tx.objectStore(STORE_PENDING)
    const req = store.clear()
    req.onsuccess = () => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('demba-offline-queue-changed'))
      }
      resolve()
    }
    req.onerror = () => reject(req.error)
  })
}

export async function setCachedData(key: string, data: any): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_CACHED_DATA, 'readwrite')
    const store = tx.objectStore(STORE_CACHED_DATA)
    store.put({ key, data, updatedAt: Date.now() })
  } catch (err) {
    console.warn('[Cache] Impossible de cacher la clé', key, err)
  }
}

export async function getCachedData<T = any>(key: string): Promise<T | null> {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_CACHED_DATA, 'readonly')
      const store = tx.objectStore(STORE_CACHED_DATA)
      const req = store.get(key)
      req.onsuccess = () => resolve(req.result?.data ?? null)
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}
