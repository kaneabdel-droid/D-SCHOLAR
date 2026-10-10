'use client'

import { useState } from 'react'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import type { Dictionary } from '@/dictionaries'
import { addCharge, updateCharge, deleteCharge } from './actions'
import Modal from '@/components/ui/Modal'
import { useRouter } from 'next/navigation'

export default function ChargesTable({
  charges,
  dict,
}: {
  charges: any[]
  dict: Dictionary
}) {
  const router = useRouter()
  const [modalOuvert, setModalOuvert] = useState(false)
  const [chargeEdite, setChargeEdite] = useState<any | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const handleOuvrir = (charge?: any) => {
    setChargeEdite(charge || null)
    setErreur(null)
    setModalOuvert(true)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setEnCours(true)
    setErreur(null)
    const formData = new FormData(e.currentTarget)

    const res = chargeEdite
      ? await updateCharge(chargeEdite.id, formData)
      : await addCharge(formData)

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
    if (!confirm(dict.common.confirmDelete.replace('{nom}', 'cette catégorie'))) return
    const res = await deleteCharge(id)
    if (res.error) alert(res.error)
    else router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => handleOuvrir()} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" />
          {dict.tresorerie.charges.newButton}
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-surface-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-soft text-foreground-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{dict.tresorerie.charges.nom}</th>
              <th className="px-4 py-3 font-medium text-right">{dict.common.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {charges.map((c) => (
              <tr key={c.id} className="group hover:bg-surface-hover">
                <td className="px-4 py-3 font-medium text-foreground">{c.nom}</td>
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
            {charges.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-8 text-center text-foreground-muted">
                  Aucune catégorie trouvée.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modalOuvert} onClose={() => setModalOuvert(false)} closeLabel='Fermer' title={chargeEdite ? 'Modifier la catégorie' : dict.tresorerie.charges.newTitle}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">{dict.tresorerie.charges.nom}</label>
            <input type="text" name="nom" defaultValue={chargeEdite?.nom} required className="input-field" />
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
