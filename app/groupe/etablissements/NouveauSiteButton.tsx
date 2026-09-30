'use client'

import { useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import Modal from '@/components/ui/Modal'
import { btnPrimary, btnSecondary, hintClass, inputClass, labelClass } from '@/components/ui/styles'
import type { Dictionary } from '@/dictionaries'
import { PALIER_CODES } from '@/lib/abonnements/paliers'
import { creerSite } from '../actions'

export default function NouveauSiteButton({ dict }: { dict: Dictionary }) {
  const t = dict.groupe.nouveauSite
  const [ouvert, setOuvert] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, startTransition] = useTransition()
  const champ = (nom: string, libelle: string, type = 'text', requis = false, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`site-${nom}`} className={labelClass}>{libelle}</label>
      <input id={`site-${nom}`} name={nom} type={type} required={requis} className={inputClass} {...extra} />
    </div>
  )
  return (
    <>
      <button type="button" onClick={() => setOuvert(true)} className={btnPrimary}><Plus className="h-4 w-4" /> {t.bouton}</button>
      <Modal
        open={ouvert}
        onClose={() => setOuvert(false)}
        title={t.titre}
        closeLabel={dict.common.close}
        footer={
          <>
            <button type="button" onClick={() => setOuvert(false)} className={btnSecondary}>{dict.common.cancel}</button>
            <button type="submit" form="form-site" disabled={enCours} className={btnPrimary}>{enCours ? dict.common.creating : dict.common.create}</button>
          </>
        }
      >
        <form
          id="form-site"
          action={(fd) =>
            startTransition(async () => {
              setErreur(null)
              const r = await creerSite(fd)
              if (r.error) setErreur(r.error)
              else {
                toast.success(t.cree)
                setOuvert(false)
              }
            })
          }
          className="space-y-4"
        >
          {erreur && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{erreur}</p>}
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            {champ('nom', dict.etablissement.nom, 'text', true)}
            {champ('sigle', dict.etablissement.sigle)}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {champ('ville', dict.etablissement.ville)}
            {champ('telephone', dict.etablissement.telephone, 'tel')}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="site-palier" className={labelClass}>{t.formule}</label>
              <select id="site-palier" name="palier" className={inputClass}>{PALIER_CODES.map((p) => <option key={p} value={p}>{dict.paliers[p]}</option>)}</select>
            </div>
            <div>
              <label htmlFor="site-statut" className={labelClass}>{dict.etablissement.statutJuridique}</label>
              <select id="site-statut" name="statut_juridique" className={inputClass}>
                <option value="prive">{dict.etablissement.statuts.prive}</option>
                <option value="public">{dict.etablissement.statuts.public}</option>
              </select>
            </div>
          </div>
          <fieldset className="space-y-4 rounded-xl border border-surface-border p-4">
            <legend className="px-1 text-sm font-semibold text-foreground">{t.direction}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              {champ('direction_prenom', dict.eleves.form.prenom)}
              {champ('direction_nom', dict.eleves.form.nom, 'text', true)}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {champ('direction_email', dict.etablissement.email, 'email', true, { dir: 'ltr', autoComplete: 'off' })}
              {champ('direction_password', t.motDePasse, 'password', true, { minLength: 8, autoComplete: 'new-password' })}
            </div>
          </fieldset>
          <p className={hintClass}>{t.aide}</p>
        </form>
      </Modal>
    </>
  )
}
