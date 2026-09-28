'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { definirAccesManuel } from './actions'

const ACCES: Record<string, { libelle: string; classe: string }> = {
  complet: { libelle: 'Complet', classe: 'bg-success/10 text-success' },
  lecture_seule: { libelle: 'Lecture seule', classe: 'bg-warning/10 text-warning' },
  suspendu: { libelle: 'Suspendu', classe: 'bg-danger/10 text-danger' },
}

// Cellule « Accès » du tableau admin : niveau calculé + accès offert modifiable.
export default function AccesOffertCell({ id, acces, jusquAu }: { id: string; acces: string; jusquAu: string | null }) {
  const [date, setDate] = useState(jusquAu ? jusquAu.slice(0, 10) : '')
  const [enCours, startTransition] = useTransition()
  const initial = jusquAu ? jusquAu.slice(0, 10) : ''

  const enregistrer = () =>
    startTransition(async () => {
      const res = await definirAccesManuel(id, date || null)
      if (res.error) toast.error(res.error)
      else toast.success(date ? 'Accès offert mis à jour' : 'Accès offert retiré')
    })

  const a = ACCES[acces] ?? ACCES.suspendu
  return (
    <td className="px-4 py-3">
      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${a.classe}`}>{a.libelle}</span>
      <div className="mt-2 flex items-center gap-1">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          disabled={enCours}
          title="Accès offert jusqu'au"
          className="rounded-lg border border-surface-border bg-background px-2 py-1 text-xs"
        />
        {date !== initial && (
          <button type="button" onClick={enregistrer} disabled={enCours} className="rounded-lg bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground">
            OK
          </button>
        )}
      </div>
    </td>
  )
}
