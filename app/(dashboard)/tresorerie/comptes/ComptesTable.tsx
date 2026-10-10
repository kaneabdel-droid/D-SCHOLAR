'use client'

import { useState } from 'react'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import type { Dictionary } from '@/dictionaries'
import { addCompte, updateCompte, deleteCompte } from './actions'
import Modal from '@/components/ui/Modal'
import { useRouter } from 'next/navigation'

export default function ComptesTable({
  comptes,
  dict,
}: {
  comptes: any[]
  dict: Dictionary
}) {
  const router = useRouter()
  const [modalOuvert, setModalOuvert] = useState(false)
  const [compteEdite, setCompteEdite] = useState<any | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const handleOuvrir = (compte?: any) => {
    setCompteEdite(compte || null)
    setErreur(null)
    setModalOuvert(true)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setEnCours(true)
    setErreur(null)
    const formData = new FormData(e.currentTarget)

    const res = compteEdite
      ? await updateCompte(compteEdite.id, formData)
      : await addCompte(formData)

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
    if (!confirm(dict.common.confirmDelete.replace('{nom}', 'ce compte'))) return
    const res = await deleteCompte(id)
    if (res.error) alert(res.error)
    else router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => handleOuvrir()} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" />
          {dict.tresorerie.comptes.newButton}
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-surface-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-soft text-foreground-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{dict.tresorerie.comptes.nom}</th>
              <th className="px-4 py-3 font-medium">{dict.tresorerie.comptes.type}</th>
              <th className="px-4 py-3 font-medium">{dict.tresorerie.comptes.soldeInitial}</th>
              <th className="px-4 py-3 font-medium text-right">{dict.common.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {comptes.map((c) => (
              <tr key={c.id} className="group hover:bg-surface-hover">
                <td className="px-4 py-3 font-medium text-foreground">{c.nom}</td>
                <td className="px-4 py-3 text-foreground-muted">{dict.tresorerie.comptes.types[c.type as keyof typeof dict.tresorerie.comptes.types] || c.type}</td>
                <td className="px-4 py-3 text-foreground-muted">{c.solde_initial}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleOuvrir(c)} className="btn-ghost p-1.5 text-foreground-muted hover:text-primary">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleSupprimer(c.id)} className="btn-ghost p-1.5 text-foreground-muted hover:text-danger">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {comptes.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-foreground-muted">
                  Aucun compte trouvé.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modalOuvert} onClose={() => setModalOuvert(false)} closeLabel='Fermer' title={compteEdite ? 'Modifier le compte' : dict.tresorerie.comptes.newTitle}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">{dict.tresorerie.comptes.nom}</label>
            <input type="text" name="nom" defaultValue={compteEdite?.nom} required className="input-field" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">{dict.tresorerie.comptes.type}</label>
            <select name="type" defaultValue={compteEdite?.type || 'caisse'} required className="input-field">
              <option value="caisse">{dict.tresorerie.comptes.types.caisse}</option>
              <option value="banque">{dict.tresorerie.comptes.types.banque}</option>
              <option value="mobile_money">{dict.tresorerie.comptes.types.mobile_money}</option>
            </select>
          </div>
          {!compteEdite && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">{dict.tresorerie.comptes.soldeInitial}</label>
              <input type="number" name="solde_initial" defaultValue="0" required className="input-field" />
            </div>
          )}
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
