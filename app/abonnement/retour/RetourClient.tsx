'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react'
import { verifierPaiement } from '@/app/(dashboard)/abonnement/actions'

const INTERVALLE_MS = 3000
const MAX_TENTATIVES = 15 // ~45 s, garde-fou dur (Chariow.md §8)

type Libelles = { verification: string; paye: string; echoue: string; lent: string; lentDesc: string; reessayer: string; retourAbonnement: string }

export default function RetourClient({ paiementId, libelles }: { paiementId: string | null; libelles: Libelles }) {
  const router = useRouter()
  const [etat, setEtat] = useState<'verification' | 'paye' | 'echoue' | 'lent'>(paiementId ? 'verification' : 'echoue')
  const tentatives = useRef(0)

  useEffect(() => {
    if (!paiementId) return
    let annule = false

    async function verifier() {
      const resultat = await verifierPaiement(paiementId!)
      if (annule) return
      if (resultat.statut === 'paye') {
        setEtat('paye')
        setTimeout(() => router.push('/abonnement'), 1500)
        return
      }
      if (resultat.statut === 'echoue') {
        setEtat('echoue')
        return
      }
      tentatives.current += 1
      if (tentatives.current >= MAX_TENTATIVES) {
        setEtat('lent')
        return
      }
      setTimeout(verifier, INTERVALLE_MS)
    }

    verifier()
    return () => {
      annule = true
    }
  }, [paiementId, router])

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-surface-border bg-surface p-8 text-center shadow-sm">
        {etat === 'verification' && (
          <>
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
            <p className="mt-4 text-foreground-muted">{libelles.verification}</p>
          </>
        )}
        {etat === 'paye' && (
          <>
            <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
            <p className="mt-4 font-semibold text-foreground">{libelles.paye}</p>
          </>
        )}
        {etat === 'echoue' && (
          <>
            <XCircle className="mx-auto h-10 w-10 text-danger" />
            <p className="mt-4 font-semibold text-foreground">{libelles.echoue}</p>
            <Link href="/abonnement" className="mt-4 inline-block text-sm font-semibold text-primary hover:text-primary-hover">{libelles.reessayer}</Link>
          </>
        )}
        {etat === 'lent' && (
          <>
            <Clock className="mx-auto h-10 w-10 text-warning" />
            <p className="mt-4 font-semibold text-foreground">{libelles.lent}</p>
            <p className="mt-2 text-sm text-foreground-muted">{libelles.lentDesc}</p>
            <Link href="/abonnement" className="mt-4 inline-block text-sm font-semibold text-primary hover:text-primary-hover">{libelles.retourAbonnement}</Link>
          </>
        )}
      </div>
    </div>
  )
}
