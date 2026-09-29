'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import Modal from '@/components/ui/Modal'
import { btnIcon, btnPrimary, btnSecondary, inputClass, labelClass } from '@/components/ui/styles'
import type { Dictionary } from '@/dictionaries'
import { fmt } from '@/lib/i18n'
import { affecterEnseignant, ajouterCreneau, creerClasse, genererEnseignements, modifierClasse, supprimerClasse, supprimerCreneau } from './actions'

type Option = { id: string; nom: string }
export type ReferentielClasse = {
  niveaux: { id: string; nom: string; a_series: boolean }[]
  series: { id: string; code: string }[]
  salles: Option[]
  enseignants: Option[]
}
type ValeursClasse = { nom?: string; niveau_id?: string; serie_id?: string | null; capacite?: number | null; salle_id?: string | null; professeur_principal_id?: string | null }

const erreurBloc = (e: string | null) => (e ? <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{e}</p> : null)

// Création (anneeId) ou modification (classeId) d'une classe.
export function ClasseFormButton({ anneeId, classeId, valeurs = {}, referentiel, dict }: { anneeId?: string; classeId?: string; valeurs?: ValeursClasse; referentiel: ReferentielClasse; dict: Dictionary }) {
  const router = useRouter()
  const t = dict.classes
  const c = dict.common
  const [ouvert, setOuvert] = useState(false)
  const [niveau, setNiveau] = useState(valeurs.niveau_id ?? referentiel.niveaux[0]?.id ?? '')
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, startTransition] = useTransition()
  const aSeries = referentiel.niveaux.find((n) => n.id === niveau)?.a_series

  const soumettre = (fd: FormData) =>
    startTransition(async () => {
      setErreur(null)
      const res = classeId ? await modifierClasse(classeId, fd) : await creerClasse(anneeId!, fd)
      if (res.error) setErreur(res.error)
      else {
        toast.success(classeId ? c.saved : c.created)
        setOuvert(false)
        if (!classeId && res.id) router.push(`/classes/${res.id}?vue=enseignements`)
      }
    })

  const select = (name: string, label: string, options: Option[], defaut: string | null | undefined, vide = true) => (
    <div>
      <label htmlFor={`cl-${name}`} className={labelClass}>{label}</label>
      <select id={`cl-${name}`} name={name} defaultValue={defaut ?? ''} className={inputClass}>
        {vide && <option value="">—</option>}
        {options.map((o) => <option key={o.id} value={o.id}>{o.nom}</option>)}
      </select>
    </div>
  )

  return (
    <>
      {classeId ? (
        <button type="button" onClick={() => setOuvert(true)} className={btnSecondary}><Pencil className="h-4 w-4" /> {c.edit}</button>
      ) : (
        <button type="button" onClick={() => setOuvert(true)} className={btnPrimary}><Plus className="h-4 w-4" /> {t.nouvelle}</button>
      )}
      <Modal
        open={ouvert}
        onClose={() => setOuvert(false)}
        title={classeId ? t.modifierTitre : t.nouvelleTitre}
        closeLabel={c.close}
        footer={
          <>
            <button type="button" onClick={() => setOuvert(false)} className={btnSecondary}>{c.cancel}</button>
            <button type="submit" form="form-classe" disabled={enCours} className={btnPrimary}>{enCours ? c.saving : c.save}</button>
          </>
        }
      >
        <form id="form-classe" action={soumettre} className="space-y-4">
          {erreurBloc(erreur)}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="cl-nom" className={labelClass}>{dict.fields.nom}</label>
              <input id="cl-nom" name="nom" required maxLength={30} defaultValue={valeurs.nom ?? ''} placeholder="6e B" className={inputClass} />
            </div>
            <div>
              <label htmlFor="cl-niveau" className={labelClass}>{dict.coefficients.niveau}</label>
              <select id="cl-niveau" name="niveau_id" value={niveau} onChange={(e) => setNiveau(e.target.value)} className={inputClass}>
                {referentiel.niveaux.map((n) => <option key={n.id} value={n.id}>{n.nom}</option>)}
              </select>
            </div>
          </div>
          {aSeries && select('serie_id', dict.coefficients.serie, referentiel.series.map((s) => ({ id: s.id, nom: s.code })), valeurs.serie_id)}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="cl-capacite" className={labelClass}>{dict.fields.capacite}</label>
              <input id="cl-capacite" name="capacite" type="number" min={1} defaultValue={valeurs.capacite ?? 45} className={inputClass} />
            </div>
            {select('salle_id', t.salle, referentiel.salles, valeurs.salle_id)}
          </div>
          {select('professeur_principal_id', t.pp, referentiel.enseignants, valeurs.professeur_principal_id)}
        </form>
      </Modal>
    </>
  )
}

export function SupprimerClasseButton({ classeId, nom, dict }: { classeId: string; nom: string; dict: Dictionary }) {
  const router = useRouter()
  const [enCours, startTransition] = useTransition()
  return (
    <button
      type="button"
      disabled={enCours}
      onClick={() => {
        if (!confirm(fmt(dict.common.confirmDelete, { nom }))) return
        startTransition(async () => {
          const res = await supprimerClasse(classeId)
          if (res.error) toast.error(res.error)
          else router.push('/classes')
        })
      }}
      className={`${btnSecondary} hover:text-danger`}
    >
      <Trash2 className="h-4 w-4" /> {dict.common.delete}
    </button>
  )
}

export function EnseignementsEditor({
  classeId,
  lignes,
  enseignants,
  dict,
}: {
  classeId: string
  lignes: { id: string; matiere: string; couleur: string; coef: string; volume: string; enseignantId: string | null }[]
  enseignants: Option[]
  dict: Dictionary
}) {
  const t = dict.classes
  const [enCours, startTransition] = useTransition()
  const affecter = (id: string, ens: string) =>
    startTransition(async () => {
      const res = await affecterEnseignant(id, ens || null)
      if (res.error) toast.error(res.error)
      else toast.success(dict.common.saved)
    })

  return (
    <div>
      <ul className="divide-y divide-surface-border">
        {lignes.map((l) => (
          <li key={l.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: l.couleur }} />
            <span className="min-w-40 flex-1 font-medium text-foreground">{l.matiere}</span>
            <span className="text-sm text-foreground-muted">{dict.eleves.coef} {l.coef} · {fmt(t.heuresSemaine, { h: l.volume })}</span>
            <select defaultValue={l.enseignantId ?? ''} disabled={enCours} onChange={(e) => affecter(l.id, e.target.value)} aria-label={t.enseignant} className={`${inputClass} mt-0 w-full sm:w-64`}>
              <option value="">{t.nonAffecte}</option>
              {enseignants.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
            </select>
          </li>
        ))}
      </ul>
      <div className="border-t border-surface-border px-5 py-3">
        <button
          type="button"
          disabled={enCours}
          onClick={() =>
            startTransition(async () => {
              const res = await genererEnseignements(classeId)
              if (res.error) toast.error(res.error)
              else toast.success(dict.common.saved)
            })
          }
          className={btnSecondary}
        >
          <RefreshCw className="h-4 w-4" /> {t.genererEnseignements}
        </button>
      </div>
    </div>
  )
}

export function EmploiEditor({
  enseignements,
  salles,
  creneaux,
  dict,
}: {
  enseignements: Option[]
  salles: Option[]
  creneaux: { id: string; jour: number; debut: string; fin: string; titre: string; detail: string }[]
  dict: Dictionary
}) {
  const t = dict.emplois
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, startTransition] = useTransition()

  const ajouter = (fd: FormData) =>
    startTransition(async () => {
      setErreur(null)
      const res = await ajouterCreneau(fd)
      if (res.error) setErreur(res.error)
      else toast.success(dict.common.created)
    })

  return (
    <div className="space-y-4 border-t border-surface-border p-5">
      <form action={ajouter} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1.4fr_auto] lg:items-end">
        <div>
          <label htmlFor="cr-ens" className={labelClass}>{dict.eleves.matiere}</label>
          <select id="cr-ens" name="enseignement_id" required className={inputClass}>
            {enseignements.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="cr-jour" className={labelClass}>{t.jour}</label>
          <select id="cr-jour" name="jour" className={inputClass}>
            {dict.scolarite.jours.map((j, i) => <option key={j} value={i + 1}>{j}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="cr-debut" className={labelClass}>{t.debut}</label>
          <input id="cr-debut" name="heure_debut" type="time" required defaultValue="08:00" className={inputClass} />
        </div>
        <div>
          <label htmlFor="cr-fin" className={labelClass}>{t.fin}</label>
          <input id="cr-fin" name="heure_fin" type="time" required defaultValue="10:00" className={inputClass} />
        </div>
        <div>
          <label htmlFor="cr-salle" className={labelClass}>{dict.classes.salle}</label>
          <select id="cr-salle" name="salle_id" className={inputClass}>
            <option value="">—</option>
            {salles.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
          </select>
        </div>
        <button type="submit" disabled={enCours} className={btnPrimary}><Plus className="h-4 w-4" /> {t.ajouter}</button>
      </form>
      {erreurBloc(erreur)}
      {creneaux.length > 0 && (
        <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {[...creneaux]
            .sort((a, b) => a.jour - b.jour || a.debut.localeCompare(b.debut))
            .map((c) => (
              <li key={c.id} className="flex items-center gap-2 rounded-lg bg-background px-3 py-2 text-xs">
                <span className="w-20 shrink-0 font-semibold">{dict.scolarite.jours[c.jour - 1]}</span>
                <span className="tabular-nums" dir="ltr">{c.debut}–{c.fin}</span>
                <span className="min-w-0 flex-1 truncate text-foreground-muted">{c.titre}</span>
                <button
                  type="button"
                  onClick={() =>
                    startTransition(async () => {
                      const res = await supprimerCreneau(c.id)
                      if (res.error) toast.error(res.error)
                    })
                  }
                  className={`${btnIcon} hover:text-danger`}
                  aria-label={dict.common.delete}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}
