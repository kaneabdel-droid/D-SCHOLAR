'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { btnPrimary, btnSecondary, inputClass } from '@/components/ui/styles'
import { justifierAbsenceFamille } from './actions'

export default function JustifierAbsence({ absenceId, eleveId, libelles }: { absenceId: string; eleveId: string; libelles: { justifier: string; motif: string; envoyer: string; annuler: string; envoye: string } }) {
  const [ouvert, setOuvert] = useState(false)
  const [motif, setMotif] = useState('')
  const [enCours, startTransition] = useTransition()
  if (!ouvert) {
    return <button type="button" onClick={() => setOuvert(true)} className="text-xs font-semibold text-primary hover:underline">{libelles.justifier}</button>
  }
  return (
    <form
      className="mt-2 flex w-full flex-col gap-2 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault()
        startTransition(async () => {
          const r = await justifierAbsenceFamille(absenceId, eleveId, motif)
          if (r.error) toast.error(r.error)
          else {
            toast.success(libelles.envoye)
            setOuvert(false)
          }
        })
      }}
    >
      <label className="sr-only" htmlFor={`motif-${absenceId}`}>{libelles.motif}</label>
      <input id={`motif-${absenceId}`} value={motif} onChange={(e) => setMotif(e.target.value)} required maxLength={500} placeholder={libelles.motif} className={`${inputClass} mt-0`} />
      <div className="flex gap-2">
        <button type="button" onClick={() => setOuvert(false)} className={btnSecondary}>{libelles.annuler}</button>
        <button type="submit" disabled={enCours} className={btnPrimary}>{libelles.envoyer}</button>
      </div>
    </form>
  )
}
