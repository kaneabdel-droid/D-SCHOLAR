'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { modifierDateEcheance } from '../actions'

export default function EcheanceDateCell({ id, date }: { id: string; date: string }) {
  const [valeur, setValeur] = useState(date)
  const [enCours, startTransition] = useTransition()

  const enregistrer = () =>
    startTransition(async () => {
      const res = await modifierDateEcheance(id, valeur)
      if (res.error) toast.error(res.error)
      else toast.success('Échéance mise à jour')
    })

  return (
    <td className="px-4 py-3">
      <div className="flex items-center gap-1">
        <input type="date" value={valeur} onChange={(e) => setValeur(e.target.value)} disabled={enCours} className="rounded-lg border border-surface-border bg-background px-2 py-1 text-xs" />
        {valeur !== date && (
          <button type="button" onClick={enregistrer} disabled={enCours || !valeur} className="rounded-lg bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground">
            OK
          </button>
        )}
      </div>
    </td>
  )
}
