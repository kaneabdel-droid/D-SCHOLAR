'use client'

import { useState, useTransition } from 'react'
import { Calculator, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import Modal from '@/components/ui/Modal'
import { btnIcon, btnPrimary, btnSecondary, inputClass, labelClass } from '@/components/ui/styles'
import type { Dictionary } from '@/dictionaries'
import { calculerDecisions, enregistrerDecision } from './actions'

export function CalculerDecisions({ classeId, dict }: { classeId: string; dict: Dictionary }) {
  const [enCours, startTransition] = useTransition()
  return (
    <button
      type="button"
      disabled={enCours}
      onClick={() =>
        startTransition(async () => {
          const res = await calculerDecisions(classeId)
          if (res.error) toast.error(res.error)
          else toast.success(dict.passages.calculees)
        })
      }
      className={`${btnSecondary} py-1.5`}
    >
      <Calculator className="h-4 w-4" /> {enCours ? dict.common.saving : dict.passages.calculer}
    </button>
  )
}

export function DecisionEditeur({
  decision,
  eleve,
  dict,
}: {
  decision: { id: string; decision: string; note_repechage: number | null; decision_finale: string | null; orientation: string | null }
  eleve: string
  dict: Dictionary
}) {
  const t = dict.passages
  const c = dict.common
  const [ouvert, setOuvert] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, startTransition] = useTransition()

  return (
    <>
      <button type="button" onClick={() => setOuvert(true)} className={btnIcon} aria-label={c.edit} title={c.edit}><Pencil className="h-4 w-4" /></button>
      <Modal
        open={ouvert}
        onClose={() => setOuvert(false)}
        title={eleve}
        closeLabel={c.close}
        footer={
          <>
            <button type="button" onClick={() => setOuvert(false)} className={btnSecondary}>{c.cancel}</button>
            <button type="submit" form={`form-dec-${decision.id}`} disabled={enCours} className={btnPrimary}>{enCours ? c.saving : c.save}</button>
          </>
        }
      >
        <form
          id={`form-dec-${decision.id}`}
          action={(fd) =>
            startTransition(async () => {
              setErreur(null)
              const res = await enregistrerDecision(decision.id, fd)
              if (res.error) setErreur(res.error)
              else {
                toast.success(c.saved)
                setOuvert(false)
              }
            })
          }
          className="space-y-4"
        >
          {erreur && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{erreur}</p>}
          <p className="text-sm text-foreground-muted">{t.proposition} · {dict.scolarite.decisions[decision.decision as keyof typeof dict.scolarite.decisions]}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`rep-${decision.id}`} className={labelClass}>{t.repechage} (/20)</label>
              <input id={`rep-${decision.id}`} name="note_repechage" inputMode="decimal" defaultValue={decision.note_repechage ?? ''} className={inputClass} />
            </div>
            <div>
              <label htmlFor={`fin-${decision.id}`} className={labelClass}>{t.finale}</label>
              <select id={`fin-${decision.id}`} name="decision_finale" defaultValue={decision.decision_finale ?? ''} className={inputClass}>
                <option value="">—</option>
                {(['admis', 'redouble', 'exclu'] as const).map((d) => <option key={d} value={d}>{dict.scolarite.decisions[d]}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor={`ori-${decision.id}`} className={labelClass}>{t.orientation}</label>
            <input id={`ori-${decision.id}`} name="orientation" defaultValue={decision.orientation ?? ''} className={inputClass} />
          </div>
        </form>
      </Modal>
    </>
  )
}
