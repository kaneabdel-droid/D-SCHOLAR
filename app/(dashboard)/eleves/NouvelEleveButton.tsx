'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import Modal from '@/components/ui/Modal'
import { btnPrimary, btnSecondary, hintClass, inputClass, labelClass } from '@/components/ui/styles'
import type { Dictionary } from '@/dictionaries'
import { creerEleve } from './actions'
import EleveChamps from './EleveChamps'

export default function NouvelEleveButton({ classes, dict }: { classes: { id: string; nom: string }[]; dict: Dictionary }) {
  const router = useRouter()
  const t = dict.eleves
  const c = dict.common
  const [ouvert, setOuvert] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, startTransition] = useTransition()

  const soumettre = (formData: FormData) => {
    setErreur(null)
    startTransition(async () => {
      const res = await creerEleve(formData)
      if (res.error) setErreur(res.error)
      else {
        toast.success(c.created)
        setOuvert(false)
        router.push(`/eleves/${res.id}`)
      }
    })
  }

  return (
    <>
      <button type="button" onClick={() => setOuvert(true)} className={btnPrimary} disabled={classes.length === 0}>
        <UserPlus className="h-4 w-4" /> {t.nouveauBouton}
      </button>
      <Modal
        open={ouvert}
        onClose={() => setOuvert(false)}
        title={t.nouveauTitre}
        closeLabel={c.close}
        size="lg"
        footer={
          <>
            <button type="button" onClick={() => setOuvert(false)} className={btnSecondary}>{c.cancel}</button>
            <button type="submit" form="form-eleve" disabled={enCours} className={btnPrimary}>{enCours ? c.creating : c.create}</button>
          </>
        }
      >
        <form id="form-eleve" action={soumettre} className="space-y-5">
          {erreur && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{erreur}</p>}
          <EleveChamps dict={dict} />
          <fieldset className="grid gap-4 border-t border-surface-border pt-4 sm:grid-cols-3">
            <div>
              <label htmlFor="el-classe" className={labelClass}>{t.classe}</label>
              <select id="el-classe" name="classe_id" required defaultValue="" className={inputClass}>
                <option value="" disabled>—</option>
                {classes.map((cl) => <option key={cl.id} value={cl.id}>{cl.nom}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="el-statut" className={labelClass}>{t.form.statutEntree}</label>
              <select id="el-statut" name="statut" defaultValue="nouveau" className={inputClass}>
                <option value="nouveau">{dict.scolarite.statutsInscription.nouveau}</option>
                <option value="transfere">{dict.scolarite.statutsInscription.transfere}</option>
              </select>
            </div>
            <div>
              <label htmlFor="el-date" className={labelClass}>{t.form.dateEntree}</label>
              <input id="el-date" name="date_entree" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className={inputClass} />
            </div>
            <div className="sm:col-span-3">
              <label htmlFor="el-origine" className={labelClass}>{t.form.origine}</label>
              <input id="el-origine" name="origine" className={inputClass} />
              <p className={hintClass}>{t.form.origineHint}</p>
            </div>
          </fieldset>
        </form>
      </Modal>
    </>
  )
}
