'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { PALIER_CODES, type PalierCode } from '@/lib/abonnements/paliers'
import { changerPalier, changerStatutEtablissement } from './actions'

const NOMS_PALIERS: Record<PalierCode, string> = { elementaire: 'Élémentaire', secondaire: 'Secondaire', complet: 'Cycle complet' }

// Deux cellules du tableau admin : palier (select) et statut (bascule).
export default function EtablissementActions({ id, palier, statut }: { id: string; palier: PalierCode; statut: 'actif' | 'suspendu' }) {
  const [enCours, startTransition] = useTransition()

  const palierChange = (nouveau: PalierCode) =>
    startTransition(async () => {
      const res = await changerPalier(id, nouveau)
      if (res.error) toast.error(res.error)
      else toast.success('Palier mis à jour')
    })

  const statutChange = () => {
    const nouveau = statut === 'actif' ? 'suspendu' : 'actif'
    if (nouveau === 'suspendu' && !confirm('Suspendre cet établissement ? Son personnel n’aura plus accès à l’application.')) return
    startTransition(async () => {
      const res = await changerStatutEtablissement(id, nouveau)
      if (res.error) toast.error(res.error)
      else toast.success(nouveau === 'actif' ? 'Établissement réactivé' : 'Établissement suspendu')
    })
  }

  return (
    <>
      <td className="px-4 py-3">
        <select
          value={palier}
          disabled={enCours}
          onChange={(e) => palierChange(e.target.value as PalierCode)}
          className="rounded-lg border border-surface-border bg-background px-2 py-1 text-sm"
        >
          {PALIER_CODES.map((p) => (
            <option key={p} value={p}>{NOMS_PALIERS[p]}</option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3">
        <button
          type="button"
          onClick={statutChange}
          disabled={enCours}
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statut === 'actif' ? 'bg-success/10 text-success hover:bg-danger/10 hover:text-danger' : 'bg-danger/10 text-danger hover:bg-success/10 hover:text-success'}`}
          title={statut === 'actif' ? 'Suspendre' : 'Réactiver'}
        >
          {statut === 'actif' ? 'Actif' : 'Suspendu'}
        </button>
      </td>
    </>
  )
}
