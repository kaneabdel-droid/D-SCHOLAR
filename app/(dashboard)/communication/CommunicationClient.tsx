'use client'

import { useState, useTransition } from 'react'
import { Megaphone, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import Modal from '@/components/ui/Modal'
import { btnIcon, btnPrimary, btnSecondary, inputClass, labelClass } from '@/components/ui/styles'
import type { Dictionary } from '@/dictionaries'
import { publierAnnonce, supprimerAnnonce } from './actions'

export function NouvelleAnnonceButton({ classes, dict }: { classes: { id: string; nom: string }[]; dict: Dictionary }) {
  const t = dict.communication
  const [ouvert, setOuvert] = useState(false)
  const [cible, setCible] = useState('tous')
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, startTransition] = useTransition()
  return (
    <>
      <button type="button" onClick={() => setOuvert(true)} className={btnPrimary}><Megaphone className="h-4 w-4" /> {t.nouvelle}</button>
      <Modal
        open={ouvert}
        onClose={() => setOuvert(false)}
        title={t.nouvelle}
        closeLabel={dict.common.close}
        footer={
          <>
            <button type="button" onClick={() => setOuvert(false)} className={btnSecondary}>{dict.common.cancel}</button>
            <button type="submit" form="form-annonce" disabled={enCours} className={btnPrimary}>{enCours ? dict.common.saving : t.publier}</button>
          </>
        }
      >
        <form
          id="form-annonce"
          action={(fd) =>
            startTransition(async () => {
              setErreur(null)
              const r = await publierAnnonce(fd)
              if (r.error) setErreur(r.error)
              else {
                toast.success(t.publieeOk)
                setOuvert(false)
              }
            })
          }
          className="space-y-4"
        >
          {erreur && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{erreur}</p>}
          <div><label htmlFor="an-titre" className={labelClass}>{t.titre}</label><input id="an-titre" name="titre" required maxLength={200} className={inputClass} /></div>
          <div><label htmlFor="an-contenu" className={labelClass}>{t.contenu}</label><textarea id="an-contenu" name="contenu" required rows={6} maxLength={5000} className={inputClass} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="an-cible" className={labelClass}>{t.cible}</label>
              <select id="an-cible" name="cible" value={cible} onChange={(e) => setCible(e.target.value)} className={inputClass}>
                {(['tous', 'personnel', 'familles', 'classe'] as const).map((c) => <option key={c} value={c}>{t.cibles[c]}</option>)}
              </select>
            </div>
            {cible === 'classe' && (
              <div>
                <label htmlFor="an-classe" className={labelClass}>{dict.eleves.classe}</label>
                <select id="an-classe" name="classe_id" required className={inputClass}>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </div>
            )}
          </div>
          <p className="text-xs text-foreground-muted">{t.aideNotification}</p>
        </form>
      </Modal>
    </>
  )
}

export function SupprimerAnnonce({ id, dict }: { id: string; dict: Dictionary }) {
  const [enCours, startTransition] = useTransition()
  return (
    <button
      type="button"
      disabled={enCours}
      onClick={() => {
        if (!confirm(dict.communication.confirmSuppression)) return
        startTransition(async () => {
          const r = await supprimerAnnonce(id)
          if (r.error) toast.error(r.error)
        })
      }}
      className={`${btnIcon} hover:text-danger`}
      aria-label={dict.common.delete}
      title={dict.common.delete}
    >
      <Trash2 className="h-4 w-4" />
    </button>
  )
}
