/**
 * Helper d'exécution résilient pour D-SCHOLAR
 */

import { enqueueOfflineAction } from './offline-storage'
import { syncEngine } from './sync-engine'

export interface ExecuteOfflineSafeOptions<T> {
  actionType: string
  label: string
  payload: any
  onlineAction: () => Promise<T>
}

export interface OfflineSafeResult<T> {
  success: boolean
  offline?: boolean
  data?: T
  error?: string
}

export async function executeOfflineSafe<T = any>(
  options: ExecuteOfflineSafeOptions<T>
): Promise<OfflineSafeResult<T>> {
  const { actionType, label, payload, onlineAction } = options

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    await enqueueOfflineAction({
      actionType,
      label,
      payload,
    })
    return {
      success: true,
      offline: true,
    }
  }

  try {
    const res: any = await onlineAction()

    if (res && res.error) {
      return { success: false, error: res.error }
    }

    return {
      success: true,
      offline: false,
      data: res,
    }
  } catch (networkErr: any) {
    console.warn('[Offline Helper Scholar] Appel en ligne échoué, bascule en file locale:', networkErr)

    await enqueueOfflineAction({
      actionType,
      label,
      payload,
    })

    syncEngine.triggerImmediateSync()

    return {
      success: true,
      offline: true,
    }
  }
}
