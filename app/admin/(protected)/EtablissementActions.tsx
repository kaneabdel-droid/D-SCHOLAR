'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { Lock, LockOpen, Trash2 } from 'lucide-react'
import { PALIER_CODES, type PalierCode } from '@/lib/abonnements/paliers'
import { changerPalier, changerStatutEtablissement, supprimerEtablissement } from './actions'

const NOMS_PALIERS: Record<PalierCode, string> = { elementaire: 'Élémentaire', secondaire: 'Secondaire', complet: 'Cycle complet' }

// Deux cellules du tableau admin : palier (select) et verrou (statut actif / suspendu).
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
    if (nouveau === 'suspendu' && !confirm('Verrouiller cet établissement ? Son personnel et ses familles (portail) n’auront plus accès à l’application. Les données sont conservées.')) return
    startTransition(async () => {
      const res = await changerStatutEtablissement(id, nouveau)
      if (res.error) toast.error(res.error)
      else toast.success(nouveau === 'actif' ? 'Établissement déverrouillé' : 'Établissement verrouillé')
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
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold disabled:opacity-50 ${statut === 'actif' ? 'bg-success/10 text-success hover:bg-danger/10 hover:text-danger' : 'bg-danger/10 text-danger hover:bg-success/10 hover:text-success'}`}
          title={statut === 'actif' ? 'Verrouiller l’établissement' : 'Déverrouiller l’établissement'}
        >
          {statut === 'actif' ? <LockOpen className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
          {statut === 'actif' ? 'Actif' : 'Verrouillé'}
        </button>
      </td>
    </>
  )
}

// Dernière cellule : suppression définitive, confirmée en ressaisissant le nom.
export function SupprimerEtablissementCell({ id, nom, estDemo }: { id: string; nom: string; estDemo: boolean }) {
  const [enCours, startTransition] = useTransition()

  const supprimer = () => {
    const saisi = prompt(`Suppression DÉFINITIVE de « ${nom} » : élèves, notes, paiements et comptes de connexion seront effacés.

Pour confirmer, tapez le nom exact de l’établissement :`)
    if (saisi === null) return
    if (saisi.trim() !== nom.trim()) {
      toast.error('Le nom saisi ne correspond pas : suppression annulée')
      return
    }
    startTransition(async () => {
      const res = await supprimerEtablissement(id, saisi)
      if (res.error) toast.error(res.error)
      else toast.success('Établissement supprimé')
    })
  }

  return (
    <td className="px-4 py-3 text-end">
      <button
        type="button"
        onClick={supprimer}
        disabled={enCours || estDemo}
        title={estDemo ? 'Démonstration : à gérer depuis la page Démo' : 'Supprimer l’établissement'}
        aria-label="Supprimer l’établissement"
        className="rounded p-1 text-foreground-muted hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </td>
  )
}
