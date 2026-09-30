'use client'

import { useState, useTransition } from 'react'
import { Link2, Plus, Unlink } from 'lucide-react'
import { toast } from 'sonner'
import Modal from '@/components/ui/Modal'
import { btnIcon, btnPrimary, btnSecondary, inputClass, labelClass } from '@/components/ui/styles'
import { basculerMembre, creerGroupe, detacherEtablissement, rattacherEtablissement } from './actions'

export function CreerGroupeButton() {
  const [ouvert, setOuvert] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, startTransition] = useTransition()
  return (
    <>
      <button type="button" onClick={() => setOuvert(true)} className={btnPrimary}><Plus className="h-4 w-4" /> Nouveau groupe</button>
      <Modal
        open={ouvert}
        onClose={() => setOuvert(false)}
        title="Nouveau groupe scolaire"
        closeLabel="Fermer"
        footer={
          <>
            <button type="button" onClick={() => setOuvert(false)} className={btnSecondary}>Annuler</button>
            <button type="submit" form="form-groupe" disabled={enCours} className={btnPrimary}>{enCours ? 'Création…' : 'Créer'}</button>
          </>
        }
      >
        <form
          id="form-groupe"
          action={(fd) =>
            startTransition(async () => {
              setErreur(null)
              const r = await creerGroupe(fd)
              if (r.error) setErreur(r.error)
              else {
                toast.success('Groupe créé')
                setOuvert(false)
              }
            })
          }
          className="space-y-4"
        >
          {erreur && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{erreur}</p>}
          <div><label htmlFor="g-nom" className={labelClass}>Nom du groupe</label><input id="g-nom" name="nom" required className={inputClass} /></div>
          <fieldset className="space-y-4 rounded-xl border border-surface-border p-4">
            <legend className="px-1 text-sm font-semibold">Propriétaire / directeur général</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label htmlFor="g-prenom" className={labelClass}>Prénom</label><input id="g-prenom" name="dg_prenom" className={inputClass} /></div>
              <div><label htmlFor="g-dgnom" className={labelClass}>Nom</label><input id="g-dgnom" name="dg_nom" required className={inputClass} /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label htmlFor="g-email" className={labelClass}>Email</label><input id="g-email" name="email" type="email" required autoComplete="off" className={inputClass} /></div>
              <div><label htmlFor="g-tel" className={labelClass}>Téléphone</label><input id="g-tel" name="dg_telephone" type="tel" className={inputClass} /></div>
            </div>
            <div><label htmlFor="g-pw" className={labelClass}>Mot de passe</label><input id="g-pw" name="password" type="text" minLength={8} required autoComplete="new-password" className={inputClass} /></div>
            <p className="text-xs text-foreground-muted">Adresse dédiée au DG, distincte des comptes du personnel des sites (un directeur de site garde son propre compte).</p>
          </fieldset>
        </form>
      </Modal>
    </>
  )
}

export function RattacherSite({ groupeId, libres }: { groupeId: string; libres: { id: string; nom: string }[] }) {
  const [choix, setChoix] = useState('')
  const [enCours, startTransition] = useTransition()
  if (libres.length === 0) return null
  return (
    <div className="flex gap-2">
      <select value={choix} onChange={(e) => setChoix(e.target.value)} aria-label="Établissement à rattacher" className={`${inputClass} mt-0`}>
        <option value="">Rattacher un établissement…</option>
        {libres.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
      </select>
      <button
        type="button"
        disabled={!choix || enCours}
        onClick={() => startTransition(async () => { const r = await rattacherEtablissement(groupeId, choix); if (r.error) toast.error(r.error); else setChoix('') })}
        className={btnSecondary}
      >
        <Link2 className="h-4 w-4" /> Rattacher
      </button>
    </div>
  )
}

export function DetacherSite({ id, nom }: { id: string; nom: string }) {
  const [enCours, startTransition] = useTransition()
  return (
    <button
      type="button"
      disabled={enCours}
      onClick={() => { if (confirm(`Détacher « ${nom} » du groupe ?`)) startTransition(async () => { const r = await detacherEtablissement(id); if (r.error) toast.error(r.error) }) }}
      className={`${btnIcon} hover:text-danger`}
      aria-label={`Détacher ${nom}`}
      title="Détacher du groupe"
    >
      <Unlink className="h-4 w-4" />
    </button>
  )
}

export function MembreActif({ userId, actif }: { userId: string; actif: boolean }) {
  const [enCours, startTransition] = useTransition()
  return (
    <button
      type="button"
      disabled={enCours}
      onClick={() => startTransition(async () => { const r = await basculerMembre(userId, !actif); if (r.error) toast.error(r.error) })}
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${actif ? 'bg-success/10 text-success' : 'bg-foreground-muted/10 text-foreground-muted'}`}
    >
      {actif ? 'Actif' : 'Désactivé'}
    </button>
  )
}
