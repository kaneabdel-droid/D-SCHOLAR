'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowLeftRight, KeyRound, LogOut, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import Modal from '@/components/ui/Modal'
import { btnPrimary, btnSecondary, hintClass, inputClass, labelClass } from '@/components/ui/styles'
import type { Dictionary } from '@/dictionaries'
import { fmt } from '@/lib/i18n'
import { annulerSortie, changerClasse, declarerSortie, genererCodeAcces, modifierEleve, supprimerEleve } from '../actions'
import EleveChamps, { type IdentiteEleve } from '../EleveChamps'

type Fenetre = 'modifier' | 'classe' | 'sortie' | 'annuler-sortie' | 'acces' | 'supprimer' | null

export default function EleveActions({
  eleveId,
  identite,
  inscriptionCourante,
  classesAnnee,
  compteEleveDisponible,
  sorti,
  urlActivation,
  dict,
  estAdmin = false,
}: {
  eleveId: string
  identite: IdentiteEleve
  inscriptionCourante: { id: string; classe_id: string } | null
  classesAnnee: { id: string; nom: string }[]
  compteEleveDisponible: boolean
  sorti: boolean
  urlActivation: string
  dict: Dictionary
  estAdmin?: boolean
}) {
  const router = useRouter()
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
      {!sorti ? (
        <button type="button" onClick={() => setFenetre('sortie')} className={`${btnSecondary} hover:text-danger`}><LogOut className="h-4 w-4 rtl:-scale-x-100" /> {t.sortie}</button>
      ) : (
        <button
          type="button"
          onClick={() => setFenetre('annuler-sortie')}
          className={`${btnSecondary} text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10`}
        >
          <RotateCcw className="h-4 w-4" /> {t.annulerSortie || 'Annuler la sortie / transfert'}
        </button>
      )}
      {estAdmin && (
        <button
          type="button"
          onClick={() => setFenetre('supprimer')}
          className={`${btnSecondary} text-danger hover:bg-danger/10 border-danger/30`}
          title="Supprimer définitivement l'élève (si aucune information pédagogique ni financière)"
        >
          <Trash2 className="h-4 w-4" /> {dict.common.delete || 'Supprimer'}
        </button>
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
        open={fenetre === 'annuler-sortie'}
        onClose={fermer}
        title={t.annulerSortieTitre || "Annuler la sortie de l'élève"}
        closeLabel={c.close}
        footer={
          <>
            <button type="button" onClick={fermer} className={btnSecondary}>{c.cancel}</button>
            <button
              type="button"
              disabled={enCours}
              onClick={() => executer(() => annulerSortie(eleveId), t.annulerSortieOk || 'Sortie annulée avec succès')}
              className={`${btnPrimary} bg-emerald-600 hover:bg-emerald-700 text-white`}
            >
              {enCours ? c.saving : (t.annulerSortieAction || "Confirmer l'annulation")}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          {erreur && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{erreur}</p>}
          <p className="text-sm text-foreground">
            {t.annulerSortieConfirmation || "Êtes-vous sûr de vouloir annuler le transfert sortant ou la sortie de cet élève ? L'élève retrouvera son statut actif et le mouvement de sortie sera supprimé."}
          </p>
        </div>
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

      <Modal
        open={fenetre === 'supprimer'}
        onClose={fermer}
        title="Supprimer définitivement cet élève"
        closeLabel={c.close}
        footer={
          <>
            <button type="button" onClick={fermer} className={btnSecondary}>{c.cancel}</button>
            <button
              type="button"
              disabled={enCours}
              onClick={() =>
                startTransition(async () => {
                  setErreur(null)
                  const res = await supprimerEleve(eleveId)
                  if (res.error) setErreur(res.error)
                  else {
                    toast.success('Élève supprimé avec succès.')
                    router.push('/eleves')
                  }
                })
              }
              className={`${btnPrimary} bg-danger hover:bg-danger/90 text-white`}
            >
              {enCours ? c.saving : 'Confirmer la suppression'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          {erreur && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger font-medium">{erreur}</p>}
          <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 text-xs">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">Règle de sécurité de l&apos;établissement :</p>
              <p>
                La suppression définitive est réservée aux <strong>erreurs de saisie ou inscriptions sans suite</strong>. Elle n&apos;est autorisée que si l&apos;élève n&apos;a <strong>aucune note, aucune absence, aucun paiement, aucune facture ni document officiel</strong>.
              </p>
              <p className="text-[11px] opacity-80">
                Si cet élève a déjà participé aux cours ou réglé des frais, utilisez plutôt le bouton <em>Déclarer une sortie</em> (abandon, transfert, exclusion).
              </p>
            </div>
          </div>
          <p className="text-sm text-foreground">
            Confirmez-vous la suppression de la fiche de <strong>{identite.prenom} {identite.nom}</strong> ? Cette action est irréversible.
          </p>
        </div>
      </Modal>
    </div>
  )
}
