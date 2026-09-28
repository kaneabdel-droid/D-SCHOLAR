'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { btnPrimary, cardClass, inputClass, labelClass } from '@/components/ui/styles'
import type { Dictionary } from '@/dictionaries'
import { modifierSeuils } from './actions'

export default function SeuilsForm({ passage, repechage, dict }: { passage: number; repechage: number; dict: Dictionary }) {
  const t = dict.evaluations
  const [p, setP] = useState(String(passage))
  const [r, setR] = useState(String(repechage))
  const [enCours, startTransition] = useTransition()

  const enregistrer = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const res = await modifierSeuils(p, r)
      if (res.error) toast.error(res.error)
      else toast.success(dict.common.saved)
    })
  }

  return (
    <section className={`${cardClass} p-5 sm:p-6`}>
      <h2 className="font-heading text-base font-semibold text-foreground">{t.seuilsTitle}</h2>
      <p className="mt-0.5 text-sm text-foreground-muted">{t.seuilsDesc}</p>
      <form onSubmit={enregistrer} className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
        <div>
          <label htmlFor="seuil-passage" className={labelClass}>{t.moyennePassage}</label>
          <input id="seuil-passage" inputMode="decimal" value={p} onChange={(e) => setP(e.target.value)} className={`${inputClass} sm:w-40`} />
        </div>
        <div>
          <label htmlFor="seuil-repechage" className={labelClass}>{t.moyenneRepechage}</label>
          <input id="seuil-repechage" inputMode="decimal" value={r} onChange={(e) => setR(e.target.value)} className={`${inputClass} sm:w-40`} />
        </div>
        <button type="submit" disabled={enCours} className={btnPrimary}>{enCours ? dict.common.saving : dict.common.save}</button>
      </form>
    </section>
  )
}
