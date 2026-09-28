'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { btnPrimary } from '@/components/ui/styles'
import type { Dictionary } from '@/dictionaries'
import { enregistrerCoefficients } from './actions'

type Matiere = { id: string; nom: string; code: string; couleur: string }
type Existant = { matiere_id: string; coefficient: number; volume_horaire: number | null }
type Saisie = Record<string, { coefficient: string; volume_horaire: string }>

const champClass =
  'w-full rounded-lg border border-surface-border bg-background px-2.5 py-1.5 text-center text-sm tabular-nums text-foreground outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/15'

export default function CoefficientsGrid({
  niveauId,
  serieId,
  matieres,
  existants,
  dict,
}: {
  niveauId: string
  serieId: string | null
  matieres: Matiere[]
  existants: Existant[]
  dict: Dictionary
}) {
  const t = dict.coefficients
  const [saisie, setSaisie] = useState<Saisie>(() => {
    const init: Saisie = {}
    for (const m of matieres) {
      const e = existants.find((x) => x.matiere_id === m.id)
      init[m.id] = { coefficient: e ? String(e.coefficient) : '', volume_horaire: e?.volume_horaire != null ? String(e.volume_horaire) : '' }
    }
    return init
  })
  const [enCours, startTransition] = useTransition()

  const maj = (id: string, champ: 'coefficient' | 'volume_horaire', valeur: string) =>
    setSaisie((s) => ({ ...s, [id]: { ...s[id], [champ]: valeur } }))

  const somme = (champ: 'coefficient' | 'volume_horaire') =>
    Math.round(Object.values(saisie).reduce((total, l) => total + (Number(l[champ].replace(',', '.')) || 0), 0) * 100) / 100

  const enregistrer = () =>
    startTransition(async () => {
      const lignes = Object.entries(saisie).map(([matiere_id, l]) => ({ matiere_id, ...l }))
      const res = await enregistrerCoefficients(niveauId, serieId, lignes)
      if (res.error) toast.error(res.error)
      else toast.success(t.saved)
    })

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
              <th className="px-5 py-3 text-start">{t.matiere}</th>
              <th className="w-28 px-3 py-3 text-center">{t.coefficient}</th>
              <th className="w-32 px-3 py-3 text-center">
                {t.volume}
                <span className="block text-[0.65rem] font-normal normal-case">{t.volumeHint}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {matieres.map((m) => (
              <tr key={m.id} className={saisie[m.id]?.coefficient ? '' : 'opacity-70'}>
                <td className="px-5 py-2.5">
                  <span className="flex items-center gap-2.5">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: m.couleur }} />
                    <span className="font-medium text-foreground">{m.nom}</span>
                    <span className="text-xs text-foreground-muted">{m.code}</span>
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <input inputMode="decimal" value={saisie[m.id]?.coefficient ?? ''} onChange={(e) => maj(m.id, 'coefficient', e.target.value)} className={champClass} aria-label={`${t.coefficient} ${m.nom}`} />
                </td>
                <td className="px-3 py-2.5">
                  <input inputMode="decimal" value={saisie[m.id]?.volume_horaire ?? ''} onChange={(e) => maj(m.id, 'volume_horaire', e.target.value)} className={champClass} aria-label={`${t.volume} ${m.nom}`} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-surface-border bg-background/60 font-semibold text-foreground">
              <td className="px-5 py-3">{t.total}</td>
              <td className="px-3 py-3 text-center tabular-nums">{somme('coefficient')}</td>
              <td className="px-3 py-3 text-center tabular-nums">{somme('volume_horaire')}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="sticky bottom-0 flex justify-end border-t border-surface-border bg-surface/95 px-5 py-3 backdrop-blur">
        <button type="button" onClick={enregistrer} disabled={enCours} className={btnPrimary}>
          {enCours ? dict.common.saving : dict.common.save}
        </button>
      </div>
    </div>
  )
}
