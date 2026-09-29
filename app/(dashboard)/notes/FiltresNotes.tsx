'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { inputClass, labelClass } from '@/components/ui/styles'

type Option = { id: string; nom: string }

// Filtres portés par l'URL ; changer la classe remet la matière et la période à zéro.
export default function FiltresNotes({
  classes,
  enseignements,
  periodes,
  valeurs,
  libelles,
}: {
  classes: Option[]
  enseignements: Option[]
  periodes: Option[]
  valeurs: { classe: string; enseignement: string; periode: string }
  libelles: { classe: string; matiere: string; periode: string }
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const aller = (cle: 'classe' | 'enseignement' | 'periode', valeur: string) => {
    const p = new URLSearchParams(params.toString())
    p.set(cle, valeur)
    p.delete('evaluation')
    if (cle === 'classe') {
      p.delete('enseignement')
      p.delete('periode')
    }
    router.push(`${pathname}?${p.toString()}`)
  }

  const select = (cle: 'classe' | 'enseignement' | 'periode', label: string, options: Option[]) => (
    <div>
      <label htmlFor={`f-${cle}`} className={labelClass}>{label}</label>
      <select id={`f-${cle}`} value={valeurs[cle]} onChange={(e) => aller(cle, e.target.value)} className={inputClass}>
        {options.map((o) => <option key={o.id} value={o.id}>{o.nom}</option>)}
      </select>
    </div>
  )

  return (
    <div className="grid gap-3 sm:grid-cols-3 lg:max-w-3xl">
      {select('classe', libelles.classe, classes)}
      {select('enseignement', libelles.matiere, enseignements)}
      {select('periode', libelles.periode, periodes)}
    </div>
  )
}
