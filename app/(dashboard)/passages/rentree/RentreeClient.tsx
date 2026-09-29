'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { btnPrimary, cardClass, inputClass } from '@/components/ui/styles'
import type { Dictionary } from '@/dictionaries'
import { TEINTES_DECISION } from '@/lib/scolarite'
import { fmt } from '@/lib/i18n'
import { preparerRentree } from '../actions'

export type LigneRentree = {
  eleveId: string
  nom: string
  classeSource: string
  decision: string
  statut: 'passant' | 'redoublant'
  classeProposee: string | null
  finCycle: boolean
  dejaInscrit: boolean
}

const FIN = '__fin__'

export default function RentreeClient({ anneeCibleId, lignes, classes, dict }: { anneeCibleId: string; lignes: LigneRentree[]; classes: { id: string; nom: string }[]; dict: Dictionary }) {
  const router = useRouter()
  const t = dict.passages
  const aTraiter = lignes.filter((l) => !l.dejaInscrit)
  const [choix, setChoix] = useState<Record<string, string>>(() => Object.fromEntries(aTraiter.map((l) => [l.eleveId, l.finCycle ? FIN : (l.classeProposee ?? '')])))
  const [enCours, startTransition] = useTransition()

  const valider = () =>
    startTransition(async () => {
      const res = await preparerRentree(
        anneeCibleId,
        aTraiter
          .filter((l) => choix[l.eleveId])
          .map((l) => ({ eleve_id: l.eleveId, classe_id: choix[l.eleveId] === FIN ? null : choix[l.eleveId], statut: l.statut, finCycle: choix[l.eleveId] === FIN }))
      )
      if (res.error) toast.error(res.error)
      else {
        toast.success(fmt(t.rentreeOk, { n: res.n ?? 0 }))
        router.refresh()
      }
    })

  return (
    <section className={cardClass}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
            <tr>
              <th className="px-4 py-3 text-start">{dict.eleves.eleve}</th>
              <th className="px-4 py-3 text-start">{dict.eleves.classe}</th>
              <th className="px-4 py-3 text-start">{t.finale}</th>
              <th className="px-4 py-3 text-start">{t.classeCible}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {lignes.map((l) => (
              <tr key={l.eleveId} className={l.dejaInscrit ? 'opacity-60' : ''}>
                <td className="whitespace-nowrap px-4 py-2">{l.nom}</td>
                <td className="px-4 py-2 text-foreground-muted">{l.classeSource}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TEINTES_DECISION[l.decision]}`}>{dict.scolarite.decisions[l.decision as keyof typeof dict.scolarite.decisions]}</span>
                </td>
                <td className="px-4 py-2">
                  {l.dejaInscrit ? (
                    <span className="inline-flex items-center gap-1 text-xs text-success"><CheckCircle2 className="h-3.5 w-3.5" /> {t.dejaInscrit}</span>
                  ) : (
                    <select value={choix[l.eleveId] ?? ''} onChange={(e) => setChoix((c) => ({ ...c, [l.eleveId]: e.target.value }))} className={`${inputClass} mt-0 w-full sm:w-56`}>
                      <option value="">{t.nePasInscrire}</option>
                      {l.decision === 'admis' && <option value={FIN}>{dict.scolarite.mouvements.fin_de_cycle}</option>}
                      {classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end border-t border-surface-border px-5 py-3">
        <button type="button" onClick={valider} disabled={enCours || aTraiter.length === 0} className={btnPrimary}>{enCours ? dict.common.saving : t.validerRentree}</button>
      </div>
    </section>
  )
}
