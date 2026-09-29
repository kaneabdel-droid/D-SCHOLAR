'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { btnPrimary, hintClass, inputClass, labelClass } from '@/components/ui/styles'
import type { Dictionary } from '@/dictionaries'
import { modifierEtablissement } from './actions'

type Valeurs = Partial<Record<'nom' | 'sigle' | 'adresse' | 'ville' | 'telephone' | 'email' | 'niveau_min_compte_eleve' | 'statut_juridique' | 'mois_scolarite', string | null>>

export default function EtablissementForm({
  dict,
  valeurs,
  niveaux,
  lectureSeule,
}: {
  dict: Dictionary
  valeurs: Valeurs
  niveaux: { code: string; nom: string }[]
  lectureSeule: boolean
}) {
  const t = dict.etablissement
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, startTransition] = useTransition()

  const soumettre = (formData: FormData) => {
    setErreur(null)
    startTransition(async () => {
      const res = await modifierEtablissement(formData)
      if (res.error) setErreur(res.error)
      else toast.success(dict.common.saved)
    })
  }

  const champ = (nom: keyof Valeurs, libelle: string, type = 'text', requis = false) => (
    <div>
      <label htmlFor={`etab-${nom}`} className={labelClass}>{libelle}</label>
      <input id={`etab-${nom}`} name={nom} type={type} required={requis} defaultValue={valeurs[nom] ?? ''} disabled={lectureSeule} className={inputClass} />
    </div>
  )

  return (
    <form action={soumettre} className="mt-5 space-y-4">
      {erreur && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{erreur}</p>}
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        {champ('nom', t.nom, 'text', true)}
        {champ('sigle', t.sigle)}
      </div>
      {champ('adresse', t.adresse)}
      <div className="grid gap-4 sm:grid-cols-3">
        {champ('ville', t.ville)}
        {champ('telephone', t.telephone, 'tel')}
        {champ('email', t.email, 'email')}
      </div>
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <fieldset>
          <legend className={labelClass}>{t.statutJuridique}</legend>
          <div className="mt-1.5 flex gap-2">
            {(['prive', 'public'] as const).map((v) => (
              <label key={v} className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-surface-border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-soft">
                <input type="radio" name="statut_juridique" value={v} defaultChecked={(valeurs.statut_juridique ?? 'prive') === v} disabled={lectureSeule} />
                {t.statuts[v]}
              </label>
            ))}
          </div>
          <p className={hintClass}>{t.statutHint}</p>
        </fieldset>
        <div>
          <label htmlFor="etab-mois" className={labelClass}>{t.moisScolarite}</label>
          <input id="etab-mois" name="mois_scolarite" type="number" min={1} max={12} defaultValue={valeurs.mois_scolarite ?? '9'} disabled={lectureSeule} className={inputClass} />
          <p className={hintClass}>{t.moisHint}</p>
        </div>
      </div>
      <div>
        <label htmlFor="etab-niveau-min" className={labelClass}>{t.niveauMinCompteEleve}</label>
        <select id="etab-niveau-min" name="niveau_min_compte_eleve" defaultValue={valeurs.niveau_min_compte_eleve ?? ''} disabled={lectureSeule} className={`${inputClass} sm:max-w-xs`}>
          {niveaux.map((n) => (
            <option key={n.code} value={n.code}>{n.nom}</option>
          ))}
        </select>
        <p className={hintClass}>{t.niveauMinHint}</p>
      </div>
      {lectureSeule ? (
        <p className="text-xs text-foreground-muted">{t.directionOnly}</p>
      ) : (
        <div className="flex justify-end">
          <button type="submit" disabled={enCours} className={btnPrimary}>{enCours ? dict.common.saving : dict.common.save}</button>
        </div>
      )}
    </form>
  )
}
