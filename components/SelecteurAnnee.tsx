'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { CalendarDays } from 'lucide-react'

type Annee = { id: string; libelle: string; active: boolean; cloturee: boolean }

// Choix de l'année porté par l'URL (?annee=) : chaque page serveur relit ses données.
export default function SelecteurAnnee({
  annees,
  selection,
  libelles,
}: {
  annees: Annee[]
  selection: string | null
  libelles: { annee: string; active: string; cloturee: string }
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const changer = (id: string) => {
    const p = new URLSearchParams(params.toString())
    p.set('annee', id)
    // Les filtres liés à l'année précédente (classe, période) n'ont plus de sens.
    p.delete('classe')
    p.delete('periode')
    router.push(`${pathname}?${p.toString()}`)
  }

  return (
    <label className="inline-flex items-center gap-2 rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-sm shadow-xs">
      <CalendarDays className="h-4 w-4 text-primary" />
      <span className="sr-only">{libelles.annee}</span>
      <select value={selection ?? ''} onChange={(e) => changer(e.target.value)} className="bg-transparent font-medium text-foreground outline-none">
        {annees.map((a) => (
          <option key={a.id} value={a.id}>
            {a.libelle}
            {a.active ? ` · ${libelles.active}` : a.cloturee ? ` · ${libelles.cloturee}` : ''}
          </option>
        ))}
      </select>
    </label>
  )
}
