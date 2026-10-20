'use client'

import { useState, useEffect, useTransition } from 'react'
import { Wifi, WifiOff, CheckCircle2, ShieldCheck } from 'lucide-react'
import PasswordInput from '@/components/PasswordInput'
import { btnPrimary, inputClass, labelClass } from '@/components/ui/styles'
import { login, type LoginActionResult } from './actions'
import {
  cacheOfflineAccount,
  verifyOfflineCredentials,
  getOfflineSession,
} from '@/lib/offline/offline-auth'

export default function ClientLoginForm({ dict }: { dict: any }) {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [successNotice, setSuccessNotice] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const t = dict.auth.login

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    const activeSession = getOfflineSession()
    if (activeSession && !navigator.onLine) {
      setSuccessNotice(`Session locale détectée pour ${activeSession.user.nomComplet || activeSession.user.identifiant}.`)
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMessage(null)
    setSuccessNotice(null)

    const cleanIdentifier = identifier.trim()
    if (!cleanIdentifier || !password) {
      setMessage('Veuillez renseigner votre identifiant et votre mot de passe.')
      return
    }

    // 1. CAS HORS-LIGNE DIRECT (Pas de réseau Internet)
    if (!isOnline || !navigator.onLine) {
      startTransition(async () => {
        const offRes = await verifyOfflineCredentials(cleanIdentifier, password)
        if (offRes.success && offRes.session) {
          try {
            document.cookie = 'demba_offline_active=1; path=/; max-age=2592000; SameSite=Lax'
          } catch {}
          setSuccessNotice('Connexion locale validée ! Accès à votre espace scolaire hors-ligne...')
          setTimeout(() => {
            window.location.href = offRes.session?.user.role === 'famille' ? '/portail' : '/dashboard'
          }, 600)
        } else {
          setMessage(offRes.error || 'Identifiant ou mot de passe incorrect en mode hors-ligne.')
        }
      })
      return
    }

    // 2. CAS EN LIGNE AVEC REPLI AUTOMATIQUE
    startTransition(async () => {
      const formData = new FormData()
      formData.set('email', cleanIdentifier)
      formData.set('identifier', cleanIdentifier)
      formData.set('password', password)

      try {
        const res: LoginActionResult = await login(formData)

        if (res.error) {
          if (
            res.error.toLowerCase().includes('fetch') ||
            res.error.toLowerCase().includes('réseau') ||
            res.error.toLowerCase().includes('network')
          ) {
            const offRes = await verifyOfflineCredentials(cleanIdentifier, password)
            if (offRes.success) {
              try {
                document.cookie = 'demba_offline_active=1; path=/; max-age=2592000; SameSite=Lax'
              } catch {}
              setSuccessNotice('Réseau instable : connexion locale hors-ligne activée !')
              setTimeout(() => {
                window.location.href = offRes.session?.user.role === 'famille' ? '/portail' : '/dashboard'
              }, 600)
              return
            }
          }
          setMessage(res.error)
          return
        }

        if (res.success) {
          try {
            document.cookie = 'demba_offline_active=1; path=/; max-age=2592000; SameSite=Lax'
            if (typeof window !== 'undefined' && 'caches' in window) {
              caches.open('demba-offline-dscholar-v3').then((cache) => {
                fetch('/dashboard').then((dashRes) => {
                  if (dashRes.ok) cache.put('/dashboard', dashRes)
                }).catch(() => {})
              })
            }
          } catch {}

          if (res.userContext) {
            try {
              await cacheOfflineAccount(cleanIdentifier, password, res.userContext)
            } catch (err) {
              console.warn('Erreur mise en cache hors-ligne D-SCHOLAR:', err)
            }
          }

          setSuccessNotice('Connexion réussie ! Redirection...')
          window.location.href = res.redirectUrl || '/dashboard'
        }
      } catch (networkError: any) {
        const offRes = await verifyOfflineCredentials(cleanIdentifier, password)
        if (offRes.success) {
          try {
            document.cookie = 'demba_offline_active=1; path=/; max-age=2592000; SameSite=Lax'
          } catch {}
          setSuccessNotice('Connexion hors-ligne de secours validée !')
          setTimeout(() => {
            window.location.href = offRes.session?.user.role === 'famille' ? '/portail' : '/dashboard'
          }, 600)
        } else {
          setMessage(
            'Impossible de joindre le serveur et aucun compte hors-ligne synchronisé trouvé. Vérifiez votre connexion Internet.'
          )
        }
      }
    })
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      {/* Alerte Mode Réseau / Hors-ligne */}
      {!isOnline && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs font-medium flex items-start gap-2.5 animate-in fade-in">
          <WifiOff className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div>
            <span className="font-semibold block mb-0.5">Mode hors-ligne direct actif</span>
            Vous pouvez vous connecter avec vos identifiants mémorisés sur cet appareil. Vos notes, présences et encaissements seront synchronisés dès le retour d&apos;Internet.
          </div>
        </div>
      )}

      {/* Messages d'erreur ou de succès */}
      {message && (
        <div className="p-3.5 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm font-medium text-center">
          {message}
        </div>
      )}
      {successNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-sm font-medium flex items-center justify-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successNotice}</span>
        </div>
      )}

      <div>
        <label htmlFor="identifier" className={labelClass}>
          {t.identifiant}
        </label>
        <div className="mt-2">
          <input
            id="identifier"
            name="identifier"
            type="text"
            autoComplete="username"
            placeholder="ex: enseignant_diop, 771234567 ou email@domaine.com"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="password" className={labelClass}>
            {t.password}
          </label>
          <a href="/forgot-password" className="text-sm font-semibold text-primary hover:text-primary-hover">
            {t.forgotPassword}
          </a>
        </div>
        <div className="mt-2">
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <button
          type="submit"
          disabled={isPending}
          className={`${btnPrimary} w-full py-2.5 disabled:opacity-50 transition-all`}
        >
          {isPending ? 'Vérification...' : t.submit}
        </button>
      </div>

      {isOnline ? (
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-foreground-muted pt-1">
          <Wifi className="h-3 w-3 text-emerald-500" />
          <span>Connecté au serveur en ligne (synchronisation activée)</span>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 pt-1">
          <ShieldCheck className="h-3 w-3" />
          <span>Authentification locale autonome sans réseau</span>
        </div>
      )}
    </form>
  )
}
