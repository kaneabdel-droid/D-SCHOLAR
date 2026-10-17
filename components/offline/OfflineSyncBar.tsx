'use client'

import { useState, useEffect } from 'react'
import { syncEngine, SyncState } from '@/lib/offline/sync-engine'
import { getPendingActions, clearAllPending, QueuedAction } from '@/lib/offline/offline-storage'
import { Wifi, WifiOff, RefreshCw, CheckCircle2, Clock, X, ChevronRight, Database } from 'lucide-react'

export function OfflineSyncBar() {
  const [syncState, setSyncState] = useState<SyncState>({
    isOnline: true,
    isSyncing: false,
    pendingCount: 0,
    lastSyncTime: null
  })
  const [modalOpen, setModalOpen] = useState(false)
  const [pendingList, setPendingList] = useState<QueuedAction[]>([])
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  useEffect(() => {
    const unsub = syncEngine.subscribe((state) => {
      setSyncState(state)
    })

    const handleSynced = (e: any) => {
      const { syncedCount } = e.detail || {}
      if (syncedCount > 0) {
        setSyncMessage(`✅ ${syncedCount} opération(s) école synchronisée(s) avec succès !`)
        setTimeout(() => setSyncMessage(null), 5000)
      }
    }

    window.addEventListener('demba-offline-synced', handleSynced)

    return () => {
      unsub()
      window.removeEventListener('demba-offline-synced', handleSynced)
    }
  }, [])

  const openQueueModal = async () => {
    const actions = await getPendingActions()
    setPendingList(actions)
    setModalOpen(true)
  }

  const handleManualSync = async () => {
    const res = await syncEngine.syncNow()
    const actions = await getPendingActions()
    setPendingList(actions)
    if (res.syncedCount > 0) {
      setSyncMessage(`✅ ${res.syncedCount} opération(s) synchronisée(s) !`)
      setTimeout(() => setSyncMessage(null), 5000)
    }
  }

  const handleClear = async () => {
    if (confirm('Voulez-vous vraiment effacer les opérations hors-ligne en attente ?')) {
      await clearAllPending()
      setPendingList([])
      setModalOpen(false)
    }
  }

  return (
    <>
      {/* 1. Alerte Bandeau Hors-Ligne ou Synchronisation */}
      {!syncState.isOnline && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-900 dark:text-amber-200 px-4 py-2 text-xs sm:text-sm font-medium flex items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 min-w-0">
            <WifiOff className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="truncate">
              <strong>Mode Hors-Ligne Actif :</strong> Coupure Internet détectée. Vos encaissements d'écolage, présences et notes sont enregistrés localement en sécurité.
            </span>
          </div>
          {syncState.pendingCount > 0 && (
            <button
              onClick={openQueueModal}
              className="shrink-0 bg-amber-600 text-white dark:bg-amber-500 dark:text-black px-2.5 py-1 rounded-md text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-1"
            >
              <span>{syncState.pendingCount} en attente</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {syncState.isOnline && syncState.isSyncing && (
        <div className="bg-primary/10 border-b border-primary/20 text-primary px-4 py-2 text-xs sm:text-sm font-medium flex items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
            <span>Rétablissement Internet — Synchronisation immédiate des données scolaires...</span>
          </div>
        </div>
      )}

      {syncMessage && (
        <div className="bg-emerald-500/15 border-b border-emerald-500/30 text-emerald-800 dark:text-emerald-200 px-4 py-2 text-xs sm:text-sm font-medium flex items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{syncMessage}</span>
          </div>
          <button onClick={() => setSyncMessage(null)} className="text-emerald-700 hover:text-emerald-900 p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. Badge d'état dans le Header */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={openQueueModal}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all border ${
            !syncState.isOnline
              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
              : syncState.isSyncing
              ? 'bg-primary/10 text-primary border-primary/30 animate-pulse'
              : syncState.pendingCount > 0
              ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30 hover:bg-blue-500/20'
              : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
          }`}
          title={
            !syncState.isOnline
              ? 'Mode hors-ligne — Cliquez pour inspecter la file'
              : syncState.pendingCount > 0
              ? `${syncState.pendingCount} opération(s) à synchroniser`
              : 'Connexion Internet active et synchronisée'
          }
        >
          {!syncState.isOnline ? (
            <>
              <WifiOff className="w-3 h-3 text-amber-600" />
              <span>Hors-ligne {syncState.pendingCount > 0 ? `(${syncState.pendingCount})` : ''}</span>
            </>
          ) : syncState.isSyncing ? (
            <>
              <RefreshCw className="w-3 h-3 animate-spin text-primary" />
              <span>Sync...</span>
            </>
          ) : syncState.pendingCount > 0 ? (
            <>
              <Clock className="w-3 h-3 text-blue-600" />
              <span>{syncState.pendingCount} en attente</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="hidden sm:inline">En ligne</span>
            </>
          )}
        </button>
      </div>

      {/* 3. Modal d'inspection de la file d'attente hors-ligne */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-surface-border rounded-2xl w-full max-w-lg shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-4 border-b border-surface-border">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold font-heading text-foreground">File Hors-Ligne D-SCHOLAR</h3>
                  <p className="text-xs text-foreground-muted">
                    {syncState.isOnline ? '🟢 Connecté au réseau' : '🟠 Coupure réseau — Sauvegarde locale active'}
                  </p>
                </div>
              </div>
              <button onClick={() => setModalOpen(false)} className="p-1.5 text-foreground-muted hover:text-foreground rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {pendingList.length === 0 ? (
                <div className="text-center py-12 text-foreground-muted">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
                  <p className="font-semibold text-foreground">Toutes les opérations scolaires sont synchronisées</p>
                  <p className="text-xs mt-1">Aucun paiement ou pointage en attente de transmission.</p>
                </div>
              ) : (
                pendingList.map((item) => (
                  <div key={item.id} className="p-3.5 rounded-xl border border-surface-border bg-background/50 flex items-start justify-between gap-3 shadow-xs">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground truncate">{item.label}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          item.status === 'failed' ? 'bg-danger/15 text-danger' : 'bg-primary/10 text-primary'
                        }`}>
                          {item.actionType}
                        </span>
                      </div>
                      <p className="text-[11px] text-foreground-muted mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(item.createdAt).toLocaleTimeString()} · {new Date(item.createdAt).toLocaleDateString()}
                      </p>
                      {item.error && (
                        <p className="text-xs text-danger mt-1 bg-danger/10 p-1.5 rounded">
                          {item.error}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-4 border-t border-surface-border flex items-center justify-between gap-3">
              {pendingList.length > 0 && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-xs text-danger hover:underline font-medium"
                >
                  Tout effacer
                </button>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-surface-border text-foreground hover:bg-surface"
                >
                  Fermer
                </button>
                <button
                  type="button"
                  disabled={syncState.isSyncing || pendingList.length === 0}
                  onClick={handleManualSync}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover disabled:opacity-50 transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncState.isSyncing ? 'animate-spin' : ''}`} />
                  <span>{syncState.isSyncing ? 'Synchronisation...' : 'Synchroniser maintenant'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
