import { inputClass, labelClass } from '@/components/ui/styles'
import type { Dictionary } from '@/dictionaries'

export type IdentiteEleve = {
  prenom?: string | null
  nom?: string | null
  sexe?: string | null
  date_naissance?: string | null
  lieu_naissance?: string | null
  adresse?: string | null
  tuteur_nom?: string | null
  tuteur_telephone?: string | null
}

// Champs d'identité d'un élève, partagés par la création et la modification.
export default function EleveChamps({ dict, valeurs = {} }: { dict: Dictionary; valeurs?: IdentiteEleve }) {
  const f = dict.eleves.form
  const champ = (name: keyof IdentiteEleve, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`el-${name}`} className={labelClass}>{label}</label>
      <input id={`el-${name}`} name={name} defaultValue={valeurs[name] ?? ''} className={inputClass} {...props} />
    </div>
  )
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {champ('prenom', f.prenom, { required: true, maxLength: 100 })}
        {champ('nom', f.nom, { required: true, maxLength: 100 })}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="el-sexe" className={labelClass}>{f.sexe}</label>
          <select id="el-sexe" name="sexe" defaultValue={valeurs.sexe ?? 'M'} className={inputClass}>
            <option value="M">{dict.scolarite.sexe.M}</option>
            <option value="F">{dict.scolarite.sexe.F}</option>
          </select>
        </div>
        {champ('date_naissance', f.dateNaissance, { type: 'date' })}
        {champ('lieu_naissance', f.lieuNaissance)}
      </div>
      {champ('adresse', f.adresse)}
      <div className="grid gap-4 sm:grid-cols-2">
        {champ('tuteur_nom', f.tuteurNom)}
        {champ('tuteur_telephone', f.tuteurTelephone, { type: 'tel', dir: 'ltr' })}
      </div>
    </div>
  )
}
