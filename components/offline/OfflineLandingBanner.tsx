'use client'

import { useEffect, useState } from 'react'
import { WifiOff, LogIn, ArrowRight, RefreshCw } from 'lucide-react'
import { getOfflineSession } from '@/lib/offline/offline-auth'
import { getOfflineAccounts } from '@/lib/offline/offline-storage'

export function OfflineLandingBanner({
  appName = 'D-SCHOLAR',
  dashboardUrl = '/dashboard',
  loginUrl = '/login',
}: {
  appName?: string
  dashboardUrl?: string
  loginUrl?: string
}) {
  const [isOffline, setIsOffline] = useState(false)
  const [hasSession, setHasSession] = useState(false)
  const [userName, setUserName] = useState<string | null>(null)
  const [hasAccounts, setHasAccounts] = useState(false)
  const [redirecting, setRedirecting] = useState(false)

  useEffect(() => {
    let mounted = true

    const checkState = async () => {
      const offline = typeof navigator !== 'undefined' && !navigator.onLine
      if (mounted) setIsOffline(offline)

      const session = getOfflineSession()
      if (session) {
        if (mounted) {
          setHasSession(true)
          setUserName(session.user.nomComplet || session.user.identifiant)
        }
        if (offline) {
          if (mounted) setRedirecting(true)
          setTimeout(() => {
            window.location.href = dashboardUrl
          }, 600)
          return
        }
      }

      try {
        const accounts = await getOfflineAccounts()
        if (mounted && accounts && accounts.length > 0) {
          setHasAccounts(true)
        }
      } catch (e) {
        // ignore
      }
    }

    checkState()

    const handleOffline = () => checkState()
    const handleOnline = () => {
      if (mounted) {
        setIsOffline(false)
        setRedirecting(false)
      }
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)

    return () => {
      mounted = false
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [dashboardUrl])

  if (!isOffline && !redirecting) return null

  if (redirecting) {
    return (
      <div className="bg-primary text-white px-4 py-3.5 text-center text-xs sm:text-sm font-semibold flex items-center justify-center gap-2.5 shadow-md sticky top-0 z-50 animate-in fade-in">
        <RefreshCw className="h-4 w-4 animate-spin shrink-0" />
        <span>Session locale détectée pour {userName || 'votre compte'}. Ouverture de votre espace {appName}...</span>
      </div>
    )
  }

  return (
    <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-950 dark:text-amber-100 px-4 py-3 sticky top-0 z-50 backdrop-blur-xs animate-in fade-in">
      <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm">
        <div className="flex items-center gap-2.5 text-center sm:text-left">
          <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 shrink-0">
            <WifiOff className="h-4 w-4" />
          </div>
          <div>
            <span className="font-bold">Mode Hors-Ligne Détecté : </span>
            {hasAccounts ? (
              <span>Des identifiants sont synchronisés sur cet appareil. Vous pouvez travailler sans Internet.</span>
            ) : (
              <span>Pour utiliser {appName} hors-ligne, connectez-vous au moins une fois avec une connexion Internet active.</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasSession ? (
            <a
              href={dashboardUrl}
              className="inline-flex items-center gap-1.5 bg-primary text-white font-bold px-4 py-1.5 rounded-lg text-xs hover:bg-primary-hover shadow-sm transition-all"
            >
              <span>Accéder à mon espace</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          ) : hasAccounts ? (
            <a
              href={loginUrl}
              className="inline-flex items-center gap-1.5 bg-primary text-white font-bold px-4 py-1.5 rounded-lg text-xs hover:bg-primary-hover shadow-sm transition-all"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Se connecter hors-ligne</span>
            </a>
          ) : (
            <a
              href={loginUrl}
              className="inline-flex items-center gap-1.5 border border-amber-600/40 text-amber-900 dark:text-amber-200 font-semibold px-3 py-1.5 rounded-lg text-xs hover:bg-amber-500/20 transition-all"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Page de connexion</span>
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

export default OfflineLandingBanner
