'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { btnPrimary, btnSecondary, hintClass, inputClass, labelClass } from '@/components/ui/styles'
import { PALIERS, PALIER_CODES, type PalierCode } from '@/lib/abonnements/paliers'
import { creerEtablissement } from './actions'

const NOMS_PALIERS: Record<PalierCode, string> = { elementaire: 'Élémentaire', secondaire: 'Secondaire', complet: 'Cycle complet' }

export default function CreerEtablissementButton() {
  const router = useRouter()
  const [ouvert, setOuvert] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [enCours, startTransition] = useTransition()

  const soumettre = (formData: FormData) => {
    setMessage(null)
    const v = (nom: string) => (formData.get(nom) as string | null) ?? ''
    startTransition(async () => {
      const res = await creerEtablissement({
        nom: v('nom'),
        ville: v('ville'),
        telephone: v('telephone'),
        palier: v('palier') as PalierCode,
        directionNom: v('direction_nom'),
        directionPrenom: v('direction_prenom'),
        directionEmail: v('direction_email'),
        directionPassword: v('direction_password'),
      })
      if (res.error) setMessage(res.error)
      else {
        setOuvert(false)
        router.refresh()
      }
    })
  }

  return (
    <>
      <button type="button" onClick={() => setOuvert(true)} className={btnPrimary}>
        <Plus className="h-4 w-4" /> Créer un établissement
      </button>
      <Modal
        open={ouvert}
        onClose={() => setOuvert(false)}
        title="Nouvel établissement"
        closeLabel="Fermer"
        size="lg"
        footer={
          <>
            <button type="button" onClick={() => setOuvert(false)} className={btnSecondary}>Annuler</button>
            <button type="submit" form="form-etablissement" disabled={enCours} className={btnPrimary}>{enCours ? 'Création…' : 'Créer'}</button>
          </>
        }
      >
        <form id="form-etablissement" action={soumettre} className="space-y-5">
          {message && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{message}</p>}
          <fieldset className="space-y-4">
            <legend className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">Établissement</legend>
            <div>
              <label className={labelClass} htmlFor="e-nom">Nom</label>
              <input id="e-nom" name="nom" required className={inputClass} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="e-ville">Ville</label>
                <input id="e-ville" name="ville" className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="e-tel">Téléphone</label>
                <input id="e-tel" name="telephone" type="tel" className={inputClass} />
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="e-palier">Palier</label>
              <select id="e-palier" name="palier" defaultValue="complet" className={inputClass}>
                {PALIER_CODES.map((p) => (
                  <option key={p} value={p}>{NOMS_PALIERS[p]} — {PALIERS[p].prixAnnuelFcfa.toLocaleString('fr-FR')} FCFA / an</option>
                ))}
              </select>
              <p className={hintClass}>Le référentiel sénégalais (niveaux, séries, matières) du palier est créé automatiquement.</p>
            </div>
          </fieldset>
          <fieldset className="space-y-4">
            <legend className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">Compte de la direction</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="d-prenom">Prénom</label>
                <input id="d-prenom" name="direction_prenom" className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="d-nom">Nom</label>
                <input id="d-nom" name="direction_nom" required className={inputClass} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="d-email">Email</label>
                <input id="d-email" name="direction_email" type="email" required autoComplete="off" className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="d-password">Mot de passe provisoire</label>
                <input id="d-password" name="direction_password" type="text" required minLength={8} autoComplete="new-password" className={inputClass} />
              </div>
            </div>
          </fieldset>
        </form>
      </Modal>
    </>
  )
}
