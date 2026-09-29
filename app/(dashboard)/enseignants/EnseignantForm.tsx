'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Plus, UserCheck, UserX } from 'lucide-react'
import { toast } from 'sonner'
import Modal from '@/components/ui/Modal'
import { btnPrimary, btnSecondary, hintClass, inputClass, labelClass } from '@/components/ui/styles'
import type { Dictionary } from '@/dictionaries'
import { changerActivite, enregistrerEnseignant } from './actions'

export type ValeursEnseignant = {
  id?: string
  civilite?: string | null
  prenom?: string
  nom?: string
  telephone?: string | null
  email?: string | null
  adresse?: string | null
  statut?: string
  utilisateur_id?: string | null
  actif?: boolean
}

export default function EnseignantForm({ valeurs = {}, comptes, dict }: { valeurs?: ValeursEnseignant; comptes: { id: string; nom: string }[]; dict: Dictionary }) {
  const router = useRouter()
  const t = dict.enseignants
  const c = dict.common
  const [ouvert, setOuvert] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, startTransition] = useTransition()

  const soumettre = (fd: FormData) =>
    startTransition(async () => {
      setErreur(null)
      const res = await enregistrerEnseignant(valeurs.id ?? null, fd)
      if (res.error) setErreur(res.error)
      else {
        toast.success(valeurs.id ? c.saved : c.created)
        setOuvert(false)
        if (!valeurs.id && res.id) router.push(`/enseignants/${res.id}`)
      }
    })

  const champ = (name: keyof ValeursEnseignant, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`en-${name}`} className={labelClass}>{label}</label>
      <input id={`en-${name}`} name={name} defaultValue={(valeurs[name] as string | null | undefined) ?? ''} className={inputClass} {...props} />
    </div>
  )

  return (
    <div className="flex gap-2">
      {valeurs.id ? (
        <>
          <button type="button" onClick={() => setOuvert(true)} className={btnSecondary}><Pencil className="h-4 w-4" /> {c.edit}</button>
          <button
            type="button"
            disabled={enCours}
            onClick={() =>
              startTransition(async () => {
                const res = await changerActivite(valeurs.id!, !valeurs.actif)
                if (res.error) toast.error(res.error)
                else toast.success(c.saved)
              })
            }
            className={btnSecondary}
          >
            {valeurs.actif ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />} {valeurs.actif ? dict.utilisateurs.desactiver : dict.utilisateurs.reactiver}
          </button>
        </>
      ) : (
        <button type="button" onClick={() => setOuvert(true)} className={btnPrimary}><Plus className="h-4 w-4" /> {t.nouveau}</button>
      )}
      <Modal
        open={ouvert}
        onClose={() => setOuvert(false)}
        title={valeurs.id ? t.modifierTitre : t.nouveau}
        closeLabel={c.close}
        footer={
          <>
            <button type="button" onClick={() => setOuvert(false)} className={btnSecondary}>{c.cancel}</button>
            <button type="submit" form="form-enseignant" disabled={enCours} className={btnPrimary}>{enCours ? c.saving : c.save}</button>
          </>
        }
      >
        <form id="form-enseignant" action={soumettre} className="space-y-4">
          {erreur && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{erreur}</p>}
          <div className="grid gap-4 sm:grid-cols-[6rem_1fr_1fr]">
            <div>
              <label htmlFor="en-civilite" className={labelClass}>{t.civilite}</label>
              <select id="en-civilite" name="civilite" defaultValue={valeurs.civilite ?? 'M.'} className={inputClass}>
                <option value="M.">M.</option>
                <option value="Mme">Mme</option>
              </select>
            </div>
            {champ('prenom', dict.eleves.form.prenom, { required: true })}
            {champ('nom', dict.eleves.form.nom, { required: true })}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {champ('telephone', dict.utilisateurs.telephone, { type: 'tel', dir: 'ltr' })}
            {champ('email', dict.utilisateurs.email, { type: 'email' })}
          </div>
          {champ('adresse', dict.eleves.form.adresse)}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="en-statut" className={labelClass}>{dict.utilisateurs.statut}</label>
              <select id="en-statut" name="statut" defaultValue={valeurs.statut ?? 'titulaire'} className={inputClass}>
                <option value="titulaire">{t.statuts.titulaire}</option>
                <option value="vacataire">{t.statuts.vacataire}</option>
              </select>
            </div>
            <div>
              <label htmlFor="en-compte" className={labelClass}>{t.compte}</label>
              <select id="en-compte" name="utilisateur_id" defaultValue={valeurs.utilisateur_id ?? ''} className={inputClass}>
                <option value="">—</option>
                {comptes.map((u) => <option key={u.id} value={u.id}>{u.nom}</option>)}
              </select>
            </div>
          </div>
          <p className={hintClass}>{t.compteHint}</p>
        </form>
      </Modal>
    </div>
  )
}
