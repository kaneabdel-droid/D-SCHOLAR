'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { Dictionary } from '@/dictionaries'
import { addPersonnel, deletePersonnel } from './actions'
import Modal from '@/components/ui/Modal'
import { useRouter } from 'next/navigation'

export default function PersonnelTable({
  personnel,
  dict,
}: {
  personnel: any[]
  dict: Dictionary
}) {
  const router = useRouter()
  const [modalOuvert, setModalOuvert] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const handleOuvrir = () => {
    setErreur(null)
    setModalOuvert(true)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setEnCours(true)
    setErreur(null)
    const formData = new FormData(e.currentTarget)

    const res = await addPersonnel(formData)

    if (res.error) {
      setErreur(res.error)
      setEnCours(false)
    } else {
      setModalOuvert(false)
      setEnCours(false)
      router.refresh()
    }
  }

  const handleSupprimer = async (id: string) => {
    if (!confirm(dict.common.confirmDelete.replace('{nom}', 'ce membre'))) return
    const res = await deletePersonnel(id)
    if (res.error) alert(res.error)
    else router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={handleOuvrir} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" />
          {dict.rh.personnel.newButton}
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-surface-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-soft text-foreground-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{dict.rh.personnel.nom}</th>
              <th className="px-4 py-3 font-medium">{dict.rh.personnel.contact}</th>
              <th className="px-4 py-3 font-medium">{dict.rh.personnel.statut}</th>
              <th className="px-4 py-3 font-medium text-right">{dict.rh.personnel.salaireBase}</th>
              <th className="px-4 py-3 font-medium text-right">{dict.rh.personnel.tauxHoraire}</th>
              <th className="px-4 py-3 font-medium text-right">{dict.common.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {personnel.map((p) => (
              <tr key={p.id} className="group hover:bg-surface-hover">
                <td className="px-4 py-3 font-medium text-foreground">{p.civilite || ''} {p.prenom} {p.nom}</td>
                <td className="px-4 py-3 text-foreground-muted">{p.telephone || '-'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    p.statut === 'titulaire' ? 'bg-success-soft text-success-foreground' : 'bg-primary-soft text-primary-foreground'
                  }`}>
                    {p.statut}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-foreground">
                  {p.salaire_de_base ? p.salaire_de_base.toLocaleString('fr-FR') : '-'}
                </td>
                <td className="px-4 py-3 text-right text-foreground">
                  {p.taux_horaire ? p.taux_horaire.toLocaleString('fr-FR') : '-'}
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleSupprimer(p.id)} className="btn-ghost p-1.5 text-foreground-muted hover:text-danger" title={dict.common.delete}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {personnel.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-foreground-muted">
                  Aucun membre trouvé.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modalOuvert} onClose={() => setModalOuvert(false)} closeLabel='Fermer' title={dict.rh.personnel.newTitle}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Civilité</label>
              <select name="civilite" className="input-field">
                <option value="M.">M.</option>
                <option value="Mme">Mme</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-foreground">Prénom</label>
              <input type="text" name="prenom" required className="input-field" />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Nom</label>
            <input type="text" name="nom" required className="input-field" />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Téléphone</label>
            <input type="text" name="telephone" className="input-field" />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Statut</label>
            <select name="statut" className="input-field">
              <option value="titulaire">Titulaire</option>
              <option value="vacataire">Vacataire</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">{dict.rh.personnel.salaireBase}</label>
              <input type="number" min="0" name="salaire_de_base" className="input-field" placeholder="Optionnel" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">{dict.rh.personnel.tauxHoraire}</label>
              <input type="number" min="0" name="taux_horaire" className="input-field" placeholder="Optionnel" />
            </div>
          </div>

          {erreur && <p className="text-sm text-danger">{erreur}</p>}
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setModalOuvert(false)} className="btn-secondary">
              {dict.common.cancel}
            </button>
            <button type="submit" disabled={enCours} className="btn-primary">
              {enCours ? dict.common.saving : dict.common.save}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
