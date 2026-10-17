/**
 * Moteur de Synchronisation Automatique Immédiate pour D-SCHOLAR
 */

import { getPendingActions, removeQueuedAction, updateQueuedAction, QueuedAction } from './offline-storage'

export interface SyncState {
  isOnline: boolean
  isSyncing: boolean
  pendingCount: number
  lastSyncTime: number | null
}

type SyncListener = (state: SyncState) => void

class SyncEngine {
  private listeners: Set<SyncListener> = new Set()
  private state: SyncState = {
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isSyncing: false,
    pendingCount: 0,
    lastSyncTime: null,
  }
  private syncTimer: any = null
  private heartbeatInterval: any = null

  constructor() {
    if (typeof window !== 'undefined') {
      this.init()
    }
  }

  private async init() {
    this.state.isOnline = navigator.onLine
    await this.refreshPendingCount()

    window.addEventListener('online', () => {
      this.state.isOnline = true
      this.notify()
      this.triggerImmediateSync()
    })

    window.addEventListener('offline', () => {
      this.state.isOnline = false
      this.notify()
    })

    window.addEventListener('demba-offline-queue-changed', () => {
      this.refreshPendingCount().then(() => {
        if (this.state.isOnline && !this.state.isSyncing && this.state.pendingCount > 0) {
          this.triggerImmediateSync()
        }
      })
    })

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        this.testConnectionAndSync()
      }
    })

    this.heartbeatInterval = setInterval(() => {
      if (navigator.onLine && this.state.pendingCount > 0 && !this.state.isSyncing) {
        this.triggerImmediateSync()
      }
    }, 15000)
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener)
    listener(this.state)
    return () => this.listeners.delete(listener)
  }

  private notify() {
    for (const listener of this.listeners) {
      listener({ ...this.state })
    }
  }

  public async refreshPendingCount(): Promise<number> {
    try {
      const actions = await getPendingActions()
      this.state.pendingCount = actions.length
      this.notify()
      return actions.length
    } catch {
      return 0
    }
  }

  public async triggerImmediateSync() {
    if (this.syncTimer) clearTimeout(this.syncTimer)
    this.syncTimer = setTimeout(() => {
      this.syncNow()
    }, 200)
  }

  public async testConnectionAndSync(): Promise<boolean> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 4000)
      const res = await fetch('/api/offline-sync', {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      if (res.ok) {
        this.state.isOnline = true
        this.notify()
        await this.syncNow()
        return true
      }
    } catch {
      this.state.isOnline = false
      this.notify()
    }
    return false
  }

  public async syncNow(): Promise<{ syncedCount: number; errors: any[] }> {
    if (this.state.isSyncing) return { syncedCount: 0, errors: [] }

    const pending = await getPendingActions()
    if (pending.length === 0) {
      this.state.pendingCount = 0
      this.notify()
      return { syncedCount: 0, errors: [] }
    }

    this.state.isSyncing = true
    this.notify()

    let syncedCount = 0
    const errors: any[] = []

    for (const action of pending) {
      try {
        action.status = 'syncing'
        await updateQueuedAction(action)

        const res = await fetch('/api/offline-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: action.id,
            actionType: action.actionType,
            payload: action.payload,
            createdAt: action.createdAt,
          }),
        })

        const data = await res.json()

        if (res.ok && data.success) {
          await removeQueuedAction(action.id)
          syncedCount++
        } else {
          action.status = 'failed'
          action.retryCount = (action.retryCount || 0) + 1
          action.error = data.error || `Erreur serveur (${res.status})`
          await updateQueuedAction(action)
          errors.push({ id: action.id, error: action.error })
        }
      } catch (err: any) {
        action.status = 'failed'
        action.error = err.message || 'Échec réseau lors de la synchronisation'
        await updateQueuedAction(action)
        errors.push({ id: action.id, error: action.error })
        this.state.isOnline = false
        break
      }
    }

    this.state.isSyncing = false
    this.state.lastSyncTime = Date.now()
    await this.refreshPendingCount()

    if (syncedCount > 0 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('demba-offline-synced', { detail: { syncedCount } }))
    }

    return { syncedCount, errors }
  }
}

export const syncEngine = new SyncEngine()
