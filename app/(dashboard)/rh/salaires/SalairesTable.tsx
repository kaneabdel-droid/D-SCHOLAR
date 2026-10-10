'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { Dictionary } from '@/dictionaries'
import { addSalaire, deleteSalaire } from './actions'
import Modal from '@/components/ui/Modal'
import { useRouter } from 'next/navigation'

export default function SalairesTable({
  salaires,
  personnel,
  dict,
}: {
  salaires: any[]
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

    const res = await addSalaire(formData)

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
    if (!confirm(dict.common.confirmDelete.replace('{nom}', 'ce paiement de salaire'))) return
    const res = await deleteSalaire(id)
    if (res.error) alert(res.error)
    else router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={handleOuvrir} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" />
          {dict.rh.salaires.newButton}
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-surface-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-soft text-foreground-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{dict.rh.salaires.date}</th>
              <th className="px-4 py-3 font-medium">{dict.rh.salaires.employe}</th>
              <th className="px-4 py-3 font-medium">{dict.rh.salaires.mois}</th>
              <th className="px-4 py-3 font-medium">{dict.rh.salaires.mode}</th>
              <th className="px-4 py-3 font-medium text-right">{dict.rh.salaires.montant}</th>
              <th className="px-4 py-3 font-medium text-right">{dict.common.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {salaires.map((s) => (
              <tr key={s.id} className="group hover:bg-surface-hover">
                <td className="px-4 py-3 text-foreground-muted">{new Date(s.date_paiement).toLocaleDateString('fr-FR')}</td>
                <td className="px-4 py-3 font-medium text-foreground">{s.enseignants?.prenom} {s.enseignants?.nom}</td>
                <td className="px-4 py-3 text-foreground">{s.mois_concerne}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-full bg-surface-soft px-2 py-0.5 text-xs font-medium text-foreground-muted">
                    {dict.facturation.paiements.modes[s.mode_paiement as keyof typeof dict.facturation.paiements.modes] || s.mode_paiement}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-bold text-foreground">
                  {s.montant.toLocaleString('fr-FR')}
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleSupprimer(s.id)} className="btn-ghost p-1.5 text-foreground-muted hover:text-danger" title={dict.common.delete}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {salaires.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-foreground-muted">
                  Aucun salaire trouvé.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modalOuvert} onClose={() => setModalOuvert(false)} closeLabel='Fermer' title={dict.rh.salaires.newTitle}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">{dict.rh.salaires.employe}</label>
            <select name="enseignant_id" required className="input-field">
              <option value="">Sélectionner...</option>
              {personnel.map(p => <option key={p.id} value={p.id}>{p.prenom} {p.nom} ({p.statut})</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">{dict.rh.salaires.mois}</label>
              <input type="text" name="mois_concerne" required className="input-field" placeholder="Ex: Octobre 2026" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">{dict.rh.salaires.montant}</label>
              <input type="number" min="1" name="montant" required className="input-field" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">{dict.rh.salaires.date}</label>
              <input type="date" name="date_paiement" defaultValue={new Date().toISOString().split('T')[0]} required className="input-field" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">{dict.rh.salaires.mode}</label>
              <select name="mode_paiement" required className="input-field">
                <option value="especes">{dict.facturation.paiements.modes.especes}</option>
                <option value="virement">{dict.facturation.paiements.modes.virement}</option>
                <option value="mobile_money">{dict.facturation.paiements.modes.mobile_money}</option>
                <option value="cheque">{dict.facturation.paiements.modes.cheque}</option>
              </select>
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
