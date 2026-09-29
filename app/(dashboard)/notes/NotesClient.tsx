'use client'

import { useMemo, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff, Plus, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import Modal from '@/components/ui/Modal'
import { btnIcon, btnPrimary, btnSecondary, cardClass, inputClass, labelClass } from '@/components/ui/styles'
import type { Dictionary } from '@/dictionaries'
import { fmt } from '@/lib/i18n'
import { creerEvaluation, enregistrerNotes, publierEvaluation, supprimerEvaluation } from './actions'

type Evaluation = { id: string; libelle: string | null; date_evaluation: string; bareme: number; publiee: boolean; type: string; nbNotes: number }

export function EvaluationsListe({
  enseignementId,
  periode,
  evaluations,
  types,
  selection,
  effectif,
  ecriture,
  locale,
  dict,
}: {
  enseignementId: string
  periode: { id: string; date_debut?: string }
  evaluations: Evaluation[]
  types: { id: string; libelle: string; code: string }[]
  selection: string | null
  effectif: number | null
  ecriture: boolean
  locale: string
  dict: Dictionary
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const t = dict.notes
  const c = dict.common
  const [ouvert, setOuvert] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, startTransition] = useTransition()

  const ouvrir = (id: string) => {
    const p = new URLSearchParams(params.toString())
    p.set('evaluation', id)
    router.push(`${pathname}?${p.toString()}`)
  }
  const date = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <section className={cardClass}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border px-5 py-4">
        <h2 className="font-heading text-base font-semibold text-foreground">{t.evaluations}</h2>
        {ecriture && (
          <button type="button" onClick={() => setOuvert(true)} className={btnPrimary}><Plus className="h-4 w-4" /> {t.nouvelle}</button>
        )}
      </div>
      {evaluations.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-foreground-muted">{t.aucune}</p>
      ) : (
        <ul className="divide-y divide-surface-border">
          {evaluations.map((e) => (
            <li key={e.id} className={`flex flex-wrap items-center gap-3 px-5 py-3 ${selection === e.id ? 'bg-primary-soft' : ''}`}>
              <button type="button" onClick={() => ouvrir(e.id)} className="min-w-0 flex-1 text-start">
                <p className="font-medium text-foreground">{e.libelle || e.type}</p>
                <p className="text-xs text-foreground-muted">
                  {e.type} · {date(e.date_evaluation)} · /{Number(e.bareme)} · {fmt(t.notesSaisies, { n: e.nbNotes, total: effectif ?? '—' })}
                </p>
              </button>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${e.publiee ? 'bg-success/10 text-success' : 'bg-foreground-muted/10 text-foreground-muted'}`}>
                {e.publiee ? t.publiee : t.nonPubliee}
              </span>
              {ecriture && (
                <button
                  type="button"
                  disabled={enCours}
                  onClick={() => {
                    if (!confirm(fmt(c.confirmDelete, { nom: e.libelle || e.type }))) return
                    startTransition(async () => {
                      const res = await supprimerEvaluation(e.id)
                      if (res.error) toast.error(res.error)
                      else toast.success(c.deleted)
                    })
                  }}
                  className={`${btnIcon} hover:text-danger`}
                  aria-label={c.delete}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={ouvert}
        onClose={() => setOuvert(false)}
        title={t.nouvelle}
        closeLabel={c.close}
        footer={
          <>
            <button type="button" onClick={() => setOuvert(false)} className={btnSecondary}>{c.cancel}</button>
            <button type="submit" form="form-evaluation" disabled={enCours} className={btnPrimary}>{enCours ? c.creating : c.create}</button>
          </>
        }
      >
        <form
          id="form-evaluation"
          action={(fd) =>
            startTransition(async () => {
              setErreur(null)
              const res = await creerEvaluation(fd)
              if (res.error) setErreur(res.error)
              else {
                setOuvert(false)
                if (res.id) ouvrir(res.id)
              }
            })
          }
          className="space-y-4"
        >
          <input type="hidden" name="enseignement_id" value={enseignementId} />
          <input type="hidden" name="periode_id" value={periode.id} />
          {erreur && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{erreur}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="ev-type" className={labelClass}>{dict.fields.type}</label>
              <select id="ev-type" name="type_id" className={inputClass}>
                {types.map((ty) => <option key={ty.id} value={ty.id}>{ty.libelle}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="ev-date" className={labelClass}>{dict.assiduite.date}</label>
              <input id="ev-date" name="date_evaluation" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className={inputClass} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <div>
              <label htmlFor="ev-libelle" className={labelClass}>{dict.fields.libelle}</label>
              <input id="ev-libelle" name="libelle" maxLength={80} placeholder={t.libellePlaceholder} className={inputClass} />
            </div>
            <div>
              <label htmlFor="ev-bareme" className={labelClass}>{t.bareme}</label>
              <input id="ev-bareme" name="bareme" type="number" min={1} max={100} step="any" defaultValue={20} className={inputClass} />
            </div>
          </div>
        </form>
      </Modal>
    </section>
  )
}

type Ligne = { eleve_id: string; valeur: string; absent: boolean; justifiee: boolean }

export function SaisieNotes({
  evaluation,
  eleves,
  notes,
  ecriture,
  publication,
  dict,
}: {
  evaluation: Evaluation
  eleves: { id: string; prenom: string; nom: string; statut: string }[]
  notes: Ligne[]
  ecriture: boolean
  publication: boolean
  dict: Dictionary
}) {
  const t = dict.notes
  const [lignes, setLignes] = useState<Record<string, Ligne>>(() =>
    Object.fromEntries(eleves.map((e) => [e.id, notes.find((n) => n.eleve_id === e.id) ?? { eleve_id: e.id, valeur: '', absent: false, justifiee: false }]))
  )
  const [enCours, startTransition] = useTransition()
  const maj = (id: string, champ: Partial<Ligne>) => setLignes((l) => ({ ...l, [id]: { ...l[id], ...champ } }))

  const stats = useMemo(() => {
    const vals = Object.values(lignes).filter((l) => !l.absent && l.valeur.trim() !== '').map((l) => (Number(l.valeur.replace(',', '.')) * 20) / Number(evaluation.bareme)).filter(Number.isFinite)
    return vals.length ? { moy: vals.reduce((a, b) => a + b, 0) / vals.length, min: Math.min(...vals), max: Math.max(...vals), n: vals.length } : null
  }, [lignes, evaluation.bareme])

  const enregistrer = () =>
    startTransition(async () => {
      const res = await enregistrerNotes(evaluation.id, Object.values(lignes))
      if (res.error) toast.error(res.error)
      else toast.success(t.enregistrees)
    })
  const publier = () =>
    startTransition(async () => {
      const res = await publierEvaluation(evaluation.id, !evaluation.publiee)
      if (res.error) toast.error(res.error)
      else toast.success(evaluation.publiee ? t.depubliee : t.publieeOk)
    })

  return (
    <section className={cardClass}>
      <div className="flex flex-wrap items-center gap-3 border-b border-surface-border px-5 py-4">
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-base font-semibold text-foreground">{evaluation.libelle || evaluation.type}</h2>
          <p className="text-xs text-foreground-muted">
            /{Number(evaluation.bareme)}
            {stats && ` · ${fmt(t.stats, { moy: stats.moy.toFixed(2), min: stats.min.toFixed(2), max: stats.max.toFixed(2) })}`}
          </p>
        </div>
        {publication && (
          <button type="button" onClick={publier} disabled={enCours} className={btnSecondary}>
            {evaluation.publiee ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />} {evaluation.publiee ? t.depublier : t.publier}
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
            <tr>
              <th className="px-5 py-3 text-start">{dict.eleves.eleve}</th>
              <th className="w-32 px-3 py-3 text-center">{t.note}</th>
              <th className="px-3 py-3 text-center">{t.absent}</th>
              <th className="px-3 py-3 text-center">{dict.assiduite.justifiee}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {eleves.map((e) => {
              const l = lignes[e.id]
              return (
                <tr key={e.id} className={e.statut === 'sorti' ? 'opacity-50' : ''}>
                  <td className="whitespace-nowrap px-5 py-2">{e.nom} {e.prenom}</td>
                  <td className="px-3 py-2">
                    <input
                      inputMode="decimal"
                      value={l.valeur}
                      disabled={!ecriture || l.absent}
                      onChange={(ev) => maj(e.id, { valeur: ev.target.value })}
                      aria-label={`${t.note} ${e.prenom} ${e.nom}`}
                      className={`${inputClass} mt-0 text-center tabular-nums`}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input type="checkbox" checked={l.absent} disabled={!ecriture} onChange={(ev) => maj(e.id, { absent: ev.target.checked, valeur: ev.target.checked ? '' : l.valeur })} className="h-4 w-4 accent-[var(--primary)]" aria-label={t.absent} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input type="checkbox" checked={l.justifiee} disabled={!ecriture || !l.absent} onChange={(ev) => maj(e.id, { justifiee: ev.target.checked })} className="h-4 w-4 accent-[var(--primary)]" aria-label={dict.assiduite.justifiee} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {ecriture && (
        <div className="sticky bottom-0 flex justify-end border-t border-surface-border bg-surface/95 px-5 py-3 backdrop-blur">
          <button type="button" onClick={enregistrer} disabled={enCours} className={btnPrimary}><Save className="h-4 w-4" /> {enCours ? dict.common.saving : dict.common.save}</button>
        </div>
      )}
    </section>
  )
}
