'use client'

import { useState, useTransition } from 'react'
import { ArrowLeftRight, KeyRound, LogOut, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import Modal from '@/components/ui/Modal'
import { btnPrimary, btnSecondary, hintClass, inputClass, labelClass } from '@/components/ui/styles'
import type { Dictionary } from '@/dictionaries'
import { fmt } from '@/lib/i18n'
import { changerClasse, declarerSortie, genererCodeAcces, modifierEleve } from '../actions'
import EleveChamps, { type IdentiteEleve } from '../EleveChamps'

type Fenetre = 'modifier' | 'classe' | 'sortie' | 'acces' | null

export default function EleveActions({
  eleveId,
  identite,
  inscriptionCourante,
  classesAnnee,
  compteEleveDisponible,
  sorti,
  urlActivation,
  dict,
}: {
  eleveId: string
  identite: IdentiteEleve
  inscriptionCourante: { id: string; classe_id: string } | null
  classesAnnee: { id: string; nom: string }[]
  compteEleveDisponible: boolean
  sorti: boolean
  urlActivation: string
  dict: Dictionary
}) {
  const t = dict.eleves
  const c = dict.common
  const [fenetre, setFenetre] = useState<Fenetre>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const [enCours, startTransition] = useTransition()

  const fermer = () => {
    setFenetre(null)
    setErreur(null)
    setCode(null)
  }

  const executer = (action: () => Promise<{ error?: string; code?: string }>, succes?: string) =>
    startTransition(async () => {
      setErreur(null)
      const res = await action()
      if (res.error) setErreur(res.error)
      else if (res.code) setCode(res.code)
      else {
        if (succes) toast.success(succes)
        fermer()
      }
    })

  const pied = (formId: string) => (
    <>
      <button type="button" onClick={fermer} className={btnSecondary}>{c.cancel}</button>
      <button type="submit" form={formId} disabled={enCours} className={btnPrimary}>{enCours ? c.saving : c.save}</button>
    </>
  )

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => setFenetre('modifier')} className={btnSecondary}><Pencil className="h-4 w-4" /> {t.modifier}</button>
      {inscriptionCourante && !sorti && (
        <button type="button" onClick={() => setFenetre('classe')} className={btnSecondary}><ArrowLeftRight className="h-4 w-4" /> {t.changerClasse}</button>
      )}
      <button type="button" onClick={() => setFenetre('acces')} className={btnSecondary}><KeyRound className="h-4 w-4" /> {t.acces.bouton}</button>
      {!sorti && (
        <button type="button" onClick={() => setFenetre('sortie')} className={`${btnSecondary} hover:text-danger`}><LogOut className="h-4 w-4 rtl:-scale-x-100" /> {t.sortie}</button>
      )}

      <Modal open={fenetre === 'modifier'} onClose={fermer} title={t.modifierTitre} closeLabel={c.close} size="lg" footer={pied('form-modifier-eleve')}>
        <form id="form-modifier-eleve" action={(fd) => executer(() => modifierEleve(eleveId, fd), c.saved)} className="space-y-4">
          {erreur && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{erreur}</p>}
          <EleveChamps dict={dict} valeurs={identite} />
        </form>
      </Modal>

      <Modal open={fenetre === 'classe'} onClose={fermer} title={t.changerClasseTitre} closeLabel={c.close} footer={pied('form-classe-eleve')}>
        <form
          id="form-classe-eleve"
          action={(fd) => executer(() => changerClasse(inscriptionCourante!.id, (fd.get('classe_id') as string) ?? ''), c.saved)}
          className="space-y-4"
        >
          {erreur && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{erreur}</p>}
          <label htmlFor="nouvelle-classe" className={labelClass}>{t.classe}</label>
          <select id="nouvelle-classe" name="classe_id" defaultValue={inscriptionCourante?.classe_id} className={inputClass}>
            {classesAnnee.map((cl) => <option key={cl.id} value={cl.id}>{cl.nom}</option>)}
          </select>
        </form>
      </Modal>

      <Modal open={fenetre === 'sortie'} onClose={fermer} title={t.sortieTitre} closeLabel={c.close} footer={pied('form-sortie-eleve')}>
        <form id="form-sortie-eleve" action={(fd) => executer(() => declarerSortie(eleveId, fd), t.sortieOk)} className="space-y-4">
          {erreur && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{erreur}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="sortie-type" className={labelClass}>{t.typeSortie}</label>
              <select id="sortie-type" name="type" className={inputClass}>
                {(['transfert_sortant', 'abandon', 'exclusion', 'fin_de_cycle'] as const).map((m) => (
                  <option key={m} value={m}>{dict.scolarite.mouvements[m]}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="sortie-date" className={labelClass}>{t.dateSortie}</label>
              <input id="sortie-date" name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className={inputClass} />
            </div>
          </div>
          <div>
            <label htmlFor="sortie-motif" className={labelClass}>{t.motif}</label>
            <input id="sortie-motif" name="motif" className={inputClass} />
          </div>
        </form>
      </Modal>

      <Modal
        open={fenetre === 'acces'}
        onClose={fermer}
        title={t.acces.titre}
        closeLabel={c.close}
        footer={code ? <button type="button" onClick={fermer} className={btnPrimary}>{c.close}</button> : pied('form-acces-eleve')}
      >
        {code ? (
          <div className="space-y-3 text-center">
            <p className="text-sm text-foreground-muted">{t.acces.code}</p>
            <p className="font-mono text-3xl font-bold tracking-[0.3em] text-primary" dir="ltr">{code}</p>
            <p className="text-sm text-foreground">{fmt(t.acces.instructions, { url: urlActivation })}</p>
            <p className={hintClass}>{t.acces.expire}</p>
          </div>
        ) : (
          <form
            id="form-acces-eleve"
            action={(fd) => executer(() => genererCodeAcces(eleveId, fd.get('type') === 'eleve' ? 'eleve' : 'parent', ((fd.get('lien') as string) ?? 'tuteur') as 'pere' | 'mere' | 'tuteur'))}
            className="space-y-4"
          >
            <p className="text-sm text-foreground-muted">{t.acces.desc}</p>
            {erreur && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{erreur}</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="acces-type" className={labelClass}>{t.acces.pour}</label>
                <select id="acces-type" name="type" className={inputClass}>
                  <option value="parent">{t.acces.parent}</option>
                  <option value="eleve" disabled={!compteEleveDisponible}>{t.acces.eleve}</option>
                </select>
              </div>
              <div>
                <label htmlFor="acces-lien" className={labelClass}>{t.acces.lien}</label>
                <select id="acces-lien" name="lien" className={inputClass}>
                  {(['pere', 'mere', 'tuteur'] as const).map((l) => <option key={l} value={l}>{t.acces.liens[l]}</option>)}
                </select>
              </div>
            </div>
            {!compteEleveDisponible && <p className={hintClass}>{dict.errors.niveauCompteEleve}</p>}
          </form>
        )}
      </Modal>
    </div>
  )
}
