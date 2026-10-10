'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { Dictionary } from '@/dictionaries'
import { addFacture, deleteFacture } from './actions'
import Modal from '@/components/ui/Modal'
import { useRouter } from 'next/navigation'

export default function FacturesTable({
  factures,
  eleves,
  dict,
}: {
  factures: any[]
  eleves: any[]
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

    const res = await addFacture(formData)

    if (res.error) {
      setErreur(res.error)
      setEnCours(false)
    } else {
      setModalOuvert(false)
      setEnCours(false)
      router.refresh()
    }
  }

  const handleSupprimer = async (id: string, statut: string) => {
    if (statut !== 'en_attente') {
      alert(dict.facturation.factures.statuts.paye) // simplifé
      return
    }
    if (!confirm(dict.common.confirmDelete.replace('{nom}', 'cette facture'))) return
    const res = await deleteFacture(id)
    if (res.error) alert(res.error)
    else router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={handleOuvrir} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" />
          {dict.facturation.factures.newButton}
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-surface-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-soft text-foreground-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{dict.facturation.factures.eleve}</th>
              <th className="px-4 py-3 font-medium">{dict.facturation.factures.motif}</th>
              <th className="px-4 py-3 font-medium">{dict.facturation.factures.echeance}</th>
              <th className="px-4 py-3 font-medium">{dict.facturation.factures.statut}</th>
              <th className="px-4 py-3 font-medium text-right">{dict.facturation.factures.montant}</th>
              <th className="px-4 py-3 font-medium text-right">{dict.common.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {factures.map((f) => (
              <tr key={f.id} className="group hover:bg-surface-hover">
                <td className="px-4 py-3 font-medium text-foreground">{f.eleves?.prenom} {f.eleves?.nom}</td>
                <td className="px-4 py-3 text-foreground">{f.motif}</td>
                <td className="px-4 py-3 text-foreground-muted">{new Date(f.date_echeance).toLocaleDateString('fr-FR')}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    f.statut === 'paye' ? 'bg-success-soft text-success-foreground' :
                    f.statut === 'partiel' ? 'bg-primary-soft text-primary-foreground' :
                    'bg-danger-soft text-danger-foreground'
                  }`}>
                    {dict.facturation.factures.statuts[f.statut as keyof typeof dict.facturation.factures.statuts] || f.statut}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-bold text-foreground">
                  {f.montant.toLocaleString('fr-FR')}
                </td>
                <td className="px-4 py-3 text-right">
                  <button 
                    onClick={() => handleSupprimer(f.id, f.statut)} 
                    disabled={f.statut !== 'en_attente'}
                    className={`p-1.5 ${f.statut === 'en_attente' ? 'btn-ghost text-foreground-muted hover:text-danger' : 'text-surface-border cursor-not-allowed'}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {factures.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-foreground-muted">
                  Aucune facture trouvée.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modalOuvert} onClose={() => setModalOuvert(false)} closeLabel='Fermer' title={dict.facturation.factures.newTitle}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">{dict.facturation.factures.eleve}</label>
            <select name="eleve_id" required className="input-field">
              <option value="">Sélectionner un élève...</option>
              {eleves.map(e => <option key={e.id} value={e.id}>{e.prenom} {e.nom} ({e.matricule})</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">{dict.facturation.factures.motif}</label>
            <input type="text" name="motif" required className="input-field" placeholder="Ex: Scolarité Octobre" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">{dict.facturation.factures.montant}</label>
              <input type="number" min="1" name="montant" required className="input-field" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">{dict.facturation.factures.echeance}</label>
              <input type="date" name="date_echeance" required className="input-field" />
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
