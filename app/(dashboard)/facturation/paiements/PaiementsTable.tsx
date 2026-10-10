'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { Dictionary } from '@/dictionaries'
import { addPaiement, deletePaiement } from './actions'
import Modal from '@/components/ui/Modal'
import { useRouter } from 'next/navigation'
import ExportRecuButton from './ExportRecuButton'

export default function PaiementsTable({
  paiements,
  factures,
  eleves,
  dict,
}: {
  paiements: any[]
  factures: any[]
  eleves: any[]
  dict: Dictionary
}) {
  const router = useRouter()
  const [modalOuvert, setModalOuvert] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  
  const [eleveId, setEleveId] = useState('')
  const facturesEleve = factures.filter(f => f.eleve_id === eleveId && f.statut !== 'paye')

  const handleOuvrir = () => {
    setErreur(null)
    setEleveId('')
    setModalOuvert(true)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setEnCours(true)
    setErreur(null)
    const formData = new FormData(e.currentTarget)

    const res = await addPaiement(formData)

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
    if (!confirm(dict.common.confirmDelete.replace('{nom}', 'ce paiement'))) return
    const res = await deletePaiement(id)
    if (res.error) alert(res.error)
    else router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={handleOuvrir} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" />
          {dict.facturation.paiements.newButton}
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-surface-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-soft text-foreground-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{dict.facturation.paiements.date}</th>
              <th className="px-4 py-3 font-medium">{dict.facturation.paiements.eleve}</th>
              <th className="px-4 py-3 font-medium">Libellé</th>
              <th className="px-4 py-3 font-medium">{dict.facturation.paiements.recu}</th>
              <th className="px-4 py-3 font-medium">{dict.facturation.paiements.mode}</th>
              <th className="px-4 py-3 font-medium text-right">{dict.facturation.paiements.montant}</th>
              <th className="px-4 py-3 font-medium text-right">{dict.common.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {paiements.map((p) => (
              <tr key={p.id} className="group hover:bg-surface-hover">
                <td className="px-4 py-3 text-foreground-muted">{new Date(p.date_paiement).toLocaleDateString('fr-FR')}</td>
                <td className="px-4 py-3 font-medium text-foreground">{p.eleves?.prenom} {p.eleves?.nom}</td>
                <td className="px-4 py-3 text-foreground">{p.libelle}</td>
                <td className="px-4 py-3 text-foreground-muted">{p.numero_recu || '-'}</td>
                <td className="px-4 py-3 text-foreground-muted">
                  {dict.facturation.paiements.modes[p.mode as keyof typeof dict.facturation.paiements.modes] || p.mode}
                </td>
                <td className="px-4 py-3 text-right font-bold text-success">
                  +{p.montant.toLocaleString('fr-FR')}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <ExportRecuButton paiement={p} dict={dict} />
                    <button onClick={() => handleSupprimer(p.id)} className="btn-ghost p-1.5 text-foreground-muted hover:text-danger" title={dict.common.delete}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {paiements.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-foreground-muted">
                  Aucun encaissement trouvé.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modalOuvert} onClose={() => setModalOuvert(false)} closeLabel='Fermer' title={dict.facturation.paiements.newTitle}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">{dict.facturation.paiements.eleve}</label>
            <select 
              name="eleve_id" 
              value={eleveId}
              onChange={(e) => setEleveId(e.target.value)}
              required 
              className="input-field"
            >
              <option value="">Sélectionner un élève...</option>
              {eleves.map(e => <option key={e.id} value={e.id}>{e.prenom} {e.nom} ({e.matricule})</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">{dict.facturation.paiements.facture} (Optionnel)</label>
            <select name="facture_id" className="input-field">
              <option value="">-- Paiement libre (sans facture) --</option>
              {facturesEleve.map(f => (
                <option key={f.id} value={f.id}>{f.motif} - Reste à payer: {f.montant} FCFA</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Libellé</label>
            <input type="text" name="libelle" required className="input-field" placeholder="Ex: Paiement scolarité Octobre" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">{dict.facturation.paiements.montant}</label>
              <input type="number" min="1" name="montant" required className="input-field" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">{dict.facturation.paiements.date}</label>
              <input type="date" name="date_paiement" defaultValue={new Date().toISOString().split('T')[0]} required className="input-field" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">{dict.facturation.paiements.mode}</label>
              <select name="mode" required className="input-field">
                <option value="especes">{dict.facturation.paiements.modes.especes}</option>
                <option value="mobile_money">{dict.facturation.paiements.modes.mobile_money}</option>
                <option value="virement">{dict.facturation.paiements.modes.virement}</option>
                <option value="cheque">{dict.facturation.paiements.modes.cheque}</option>
                <option value="autre">{dict.facturation.paiements.modes.autre}</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Référence (Optionnel)</label>
              <input type="text" name="reference" className="input-field" placeholder="N° transaction..." />
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
