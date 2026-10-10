'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { Dictionary } from '@/dictionaries'
import { addMouvement, deleteMouvement } from './actions'
import Modal from '@/components/ui/Modal'
import { useRouter } from 'next/navigation'

export default function MouvementsTable({
  mouvements,
  comptes,
  charges,
  dict,
}: {
  mouvements: any[]
  comptes: any[]
  charges: any[]
  dict: Dictionary
}) {
  const router = useRouter()
  const [modalOuvert, setModalOuvert] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  
  const [typeOperation, setTypeOperation] = useState('recette')

  const handleOuvrir = () => {
    setErreur(null)
    setTypeOperation('recette')
    setModalOuvert(true)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setEnCours(true)
    setErreur(null)
    const formData = new FormData(e.currentTarget)

    const res = await addMouvement(formData)

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
    if (!confirm(dict.common.confirmDelete.replace('{nom}', 'ce mouvement'))) return
    const res = await deleteMouvement(id)
    if (res.error) alert(res.error)
    else router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={handleOuvrir} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" />
          {dict.tresorerie.mouvements.newButton}
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-surface-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-soft text-foreground-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{dict.tresorerie.mouvements.date}</th>
              <th className="px-4 py-3 font-medium">{dict.tresorerie.mouvements.type}</th>
              <th className="px-4 py-3 font-medium">{dict.tresorerie.mouvements.compte}</th>
              <th className="px-4 py-3 font-medium">{dict.tresorerie.mouvements.libelle}</th>
              <th className="px-4 py-3 font-medium text-right">{dict.tresorerie.mouvements.montant}</th>
              <th className="px-4 py-3 font-medium text-right">{dict.common.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {mouvements.map((m) => (
              <tr key={m.id} className="group hover:bg-surface-hover">
                <td className="px-4 py-3 text-foreground-muted">{new Date(m.date_mouvement).toLocaleDateString('fr-FR')}</td>
                <td className="px-4 py-3 font-medium text-foreground">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    m.type === 'recette' ? 'bg-success-soft text-success-foreground' :
                    m.type === 'depense' ? 'bg-danger-soft text-danger-foreground' :
                    'bg-primary-soft text-primary-foreground'
                  }`}>
                    {dict.tresorerie.mouvements.types[m.type as keyof typeof dict.tresorerie.mouvements.types] || m.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-foreground-muted">{m.comptes_tresorerie?.nom}</td>
                <td className="px-4 py-3 text-foreground">{m.libelle}</td>
                <td className={`px-4 py-3 text-right font-bold ${m.type === 'depense' ? 'text-danger' : m.type === 'recette' ? 'text-success' : 'text-foreground'}`}>
                  {m.type === 'depense' ? '-' : m.type === 'recette' ? '+' : ''}
                  {m.montant.toLocaleString('fr-FR')}
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleSupprimer(m.id)} className="btn-ghost p-1.5 text-foreground-muted hover:text-danger">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {mouvements.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-foreground-muted">
                  Aucun mouvement trouvé.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modalOuvert} onClose={() => setModalOuvert(false)} closeLabel='Fermer' title={dict.tresorerie.mouvements.newTitle}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">{dict.tresorerie.mouvements.type}</label>
              <select 
                name="type" 
                value={typeOperation}
                onChange={(e) => setTypeOperation(e.target.value)}
                required 
                className="input-field"
              >
                <option value="recette">{dict.tresorerie.mouvements.types.recette}</option>
                <option value="depense">{dict.tresorerie.mouvements.types.depense}</option>
                <option value="virement_entrant">{dict.tresorerie.mouvements.types.virement_entrant}</option>
                <option value="virement_sortant">{dict.tresorerie.mouvements.types.virement_sortant}</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">{dict.tresorerie.mouvements.date}</label>
              <input type="date" name="date_mouvement" defaultValue={new Date().toISOString().split('T')[0]} required className="input-field" />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">{dict.tresorerie.mouvements.compte}</label>
            <select name="compte_id" required className="input-field">
              <option value="">Sélectionner un compte...</option>
              {comptes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>

          {typeOperation === 'depense' && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">{dict.tresorerie.mouvements.categorie}</label>
              <select name="categorie_id" className="input-field">
                <option value="">Sélectionner une catégorie...</option>
                {charges.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">{dict.tresorerie.mouvements.libelle}</label>
            <input type="text" name="libelle" required className="input-field" placeholder="Ex: Achat de fournitures..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">{dict.tresorerie.mouvements.montant}</label>
              <input type="number" min="1" name="montant" required className="input-field" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">{dict.tresorerie.mouvements.piece}</label>
              <input type="text" name="reference_piece" className="input-field" placeholder="N° Facture, Reçu..." />
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
