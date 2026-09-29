'use client'

import { useState, useTransition } from 'react'
import { ClipboardCheck, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import Modal from '@/components/ui/Modal'
import { btnIcon, btnPrimary, btnSecondary, inputClass, labelClass } from '@/components/ui/styles'
import type { Dictionary } from '@/dictionaries'
import { fmt } from '@/lib/i18n'
import { enregistrerAppel, justifierAbsence, listeAppel, supprimerAbsence, type Presence } from './actions'

type Etat = Presence['etat']

export function AppelButton({ classes, dict }: { classes: { id: string; nom: string }[]; dict: Dictionary }) {
  const t = dict.assiduite
  const c = dict.common
  const [ouvert, setOuvert] = useState(false)
  const [classe, setClasse] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [ens, setEns] = useState('')
  const [heures, setHeures] = useState('2')
  const [liste, setListe] = useState<{ eleves: { id: string; prenom: string; nom: string }[]; enseignements: { id: string; nom: string }[] } | null>(null)
  const [etats, setEtats] = useState<Record<string, { etat: Etat; minutes: number }>>({})
  const [enCours, startTransition] = useTransition()

  const charger = (id: string) => {
    setClasse(id)
    setListe(null)
    if (!id) return
    startTransition(async () => {
      const l = await listeAppel(id)
      setListe(l)
      setEns(l.enseignements[0]?.id ?? '')
      setEtats(Object.fromEntries(l.eleves.map((e) => [e.id, { etat: 'present' as Etat, minutes: 10 }])))
    })
  }

  const enregistrer = () =>
    startTransition(async () => {
      const res = await enregistrerAppel(
        classe,
        date,
        ens || null,
        Number(heures.replace(',', '.')),
        Object.entries(etats).map(([eleve_id, v]) => ({ eleve_id, etat: v.etat, minutes: v.minutes }))
      )
      if (res.error) toast.error(res.error)
      else {
        toast.success(fmt(t.appelOk, { n: res.n ?? 0 }))
        setOuvert(false)
        setClasse('')
        setListe(null)
      }
    })

  const bouton = (id: string, etat: Etat, label: string, teinte: string) => (
    <button
      type="button"
      onClick={() => setEtats((s) => ({ ...s, [id]: { ...s[id], etat } }))}
      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${etats[id]?.etat === etat ? teinte : 'bg-background text-foreground-muted'}`}
    >
      {label}
    </button>
  )

  return (
    <>
      <button type="button" onClick={() => setOuvert(true)} className={btnPrimary}><ClipboardCheck className="h-4 w-4" /> {t.faireAppel}</button>
      <Modal
        open={ouvert}
        onClose={() => setOuvert(false)}
        title={t.faireAppel}
        closeLabel={c.close}
        size="lg"
        footer={
          <>
            <button type="button" onClick={() => setOuvert(false)} className={btnSecondary}>{c.cancel}</button>
            <button type="button" onClick={enregistrer} disabled={enCours || !liste} className={btnPrimary}>{enCours ? c.saving : c.save}</button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="ap-classe" className={labelClass}>{dict.eleves.classe}</label>
              <select id="ap-classe" value={classe} onChange={(e) => charger(e.target.value)} className={inputClass}>
                <option value="">—</option>
                {classes.map((cl) => <option key={cl.id} value={cl.id}>{cl.nom}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="ap-date" className={labelClass}>{t.date}</label>
              <input id="ap-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
            </div>
            {liste && (
              <>
                <div>
                  <label htmlFor="ap-ens" className={labelClass}>{dict.eleves.matiere}</label>
                  <select id="ap-ens" value={ens} onChange={(e) => setEns(e.target.value)} className={inputClass}>
                    {liste.enseignements.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="ap-heures" className={labelClass}>{t.dureeSeance}</label>
                  <input id="ap-heures" inputMode="decimal" value={heures} onChange={(e) => setHeures(e.target.value)} className={inputClass} />
                </div>
              </>
            )}
          </div>
          {liste && (
            <ul className="divide-y divide-surface-border rounded-xl border border-surface-border">
              {liste.eleves.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm">{e.nom} {e.prenom}</span>
                  {bouton(e.id, 'present', t.present, 'bg-success/15 text-success')}
                  {bouton(e.id, 'absent', t.types.absence, 'bg-danger/15 text-danger')}
                  {bouton(e.id, 'retard', t.types.retard, 'bg-warning/15 text-warning')}
                  {etats[e.id]?.etat === 'retard' && (
                    <input
                      type="number"
                      min={1}
                      max={240}
                      value={etats[e.id].minutes}
                      onChange={(ev) => setEtats((s) => ({ ...s, [e.id]: { ...s[e.id], minutes: Number(ev.target.value) } }))}
                      aria-label={t.minutes}
                      className={`${inputClass} mt-0 w-20 py-1`}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>
    </>
  )
}

export function JustifierAbsence({
  absence,
  dict,
}: {
  absence: { id: string; justifiee: boolean; motif: string | null; justification_parent: string | null }
  dict: Dictionary
}) {
  const t = dict.assiduite
  const c = dict.common
  const [ouvert, setOuvert] = useState(false)
  const [enCours, startTransition] = useTransition()

  return (
    <>
      <div className="flex gap-1">
        <button type="button" onClick={() => setOuvert(true)} className={btnIcon} aria-label={c.edit} title={c.edit}><Pencil className="h-4 w-4" /></button>
        <button
          type="button"
          disabled={enCours}
          onClick={() => {
            if (!confirm(t.confirmSuppression)) return
            startTransition(async () => {
              const res = await supprimerAbsence(absence.id)
              if (res.error) toast.error(res.error)
            })
          }}
          className={`${btnIcon} hover:text-danger`}
          aria-label={c.delete}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <Modal
        open={ouvert}
        onClose={() => setOuvert(false)}
        title={t.justification}
        closeLabel={c.close}
        footer={
          <>
            <button type="button" onClick={() => setOuvert(false)} className={btnSecondary}>{c.cancel}</button>
            <button type="submit" form={`form-just-${absence.id}`} disabled={enCours} className={btnPrimary}>{enCours ? c.saving : c.save}</button>
          </>
        }
      >
        <form
          id={`form-just-${absence.id}`}
          action={(fd) =>
            startTransition(async () => {
              const res = await justifierAbsence(absence.id, fd.get('justifiee') === 'on', (fd.get('motif') as string) ?? '')
              if (res.error) toast.error(res.error)
              else {
                toast.success(c.saved)
                setOuvert(false)
              }
            })
          }
          className="space-y-4"
        >
          {absence.justification_parent && (
            <p className="rounded-lg bg-info/10 px-3 py-2 text-sm text-info"><b>{t.demandeFamille}</b> {absence.justification_parent}</p>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="justifiee" defaultChecked={absence.justifiee} className="h-4 w-4 accent-[var(--primary)]" /> {t.justifiee}
          </label>
          <div>
            <label htmlFor={`motif-${absence.id}`} className={labelClass}>{t.motif}</label>
            <input id={`motif-${absence.id}`} name="motif" defaultValue={absence.motif ?? absence.justification_parent ?? ''} className={inputClass} />
          </div>
        </form>
      </Modal>
    </>
  )
}
