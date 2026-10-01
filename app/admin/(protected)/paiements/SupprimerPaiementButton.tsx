'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { supprimerPaiementEchoue, supprimerTousPaiementsEchoues } from '../actions'

// Sans paiementId : supprime toutes les tentatives échouées.
export default function SupprimerPaiementButton({ paiementId, nombre }: { paiementId?: string; nombre?: number }) {
  const [enCours, startTransition] = useTransition()

  const supprimer = () => {
    const question = paiementId
      ? 'Supprimer ce paiement échoué ?'
      : `Supprimer les ${nombre ?? ''} paiement(s) échoué(s) de l'historique ?`
    if (!confirm(question)) return
    startTransition(async () => {
      const res = paiementId ? await supprimerPaiementEchoue(paiementId) : await supprimerTousPaiementsEchoues()
      if (res.error) toast.error(res.error)
      else toast.success(paiementId ? 'Paiement supprimé' : 'Paiements échoués supprimés')
    })
  }

  if (!paiementId) {
    return (
      <button
        type="button"
        onClick={supprimer}
        disabled={enCours}
        className="inline-flex items-center gap-1.5 rounded-lg border border-danger/30 px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger/10 disabled:opacity-50"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Supprimer les paiements échoués ({nombre})
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={supprimer}
      disabled={enCours}
      title="Supprimer ce paiement échoué"
      aria-label="Supprimer ce paiement échoué"
      className="rounded p-1 text-foreground-muted hover:text-danger disabled:opacity-50"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  )
}
