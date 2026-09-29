'use client'

import { useState, useTransition } from 'react'
import { CalendarRange, Lock, LockOpen, Plus, Trash2, Zap } from 'lucide-react'
import { toast } from 'sonner'
import Modal from '@/components/ui/Modal'
import { btnIcon, btnPrimary, btnSecondary, cardClass, hintClass, inputClass, labelClass } from '@/components/ui/styles'
import type { Dictionary } from '@/dictionaries'
import type { Cycle } from '@/lib/abonnements/paliers'
import { fmt, intlLocale } from '@/lib/i18n'
import { activerAnnee, creerAnnee, modifierPeriode, supprimerAnnee, verrouillerPeriode } from './actions'

type Decoupage = 'trimestre' | 'semestre'
type Periode = { id: string; rang: number; decoupage: Decoupage; date_debut: string | null; date_fin: string | null; verrouillee: boolean }
export type Annee = {
  id: string
  libelle: string
  date_debut: string
  date_fin: string
  decoupage: Decoupage
  decoupage_cycles: Partial<Record<Cycle, Decoupage>>
  active: boolean
  cloturee: boolean
  periodes: Periode[]
}

// Libellé proposé : à partir de juillet, l'année qui commence à la rentrée
// suivante ; avant, l'année en cours.
function libelleSuggere() {
  const maintenant = new Date()
  const debut = maintenant.getMonth() >= 6 ? maintenant.getFullYear() : maintenant.getFullYear() - 1
  return `${debut}-${debut + 1}`
}

function PeriodeLigne({ periode, libelle, dict }: { periode: Periode; libelle: string; dict: Dictionary }) {
  const t = dict.annees
  const [debut, setDebut] = useState(periode.date_debut ?? '')
  const [fin, setFin] = useState(periode.date_fin ?? '')
  const [enCours, startTransition] = useTransition()
  const modifie = debut !== (periode.date_debut ?? '') || fin !== (periode.date_fin ?? '')

  const enregistrer = () =>
    startTransition(async () => {
      const res = await modifierPeriode(periode.id, debut, fin)
      if (res.error) toast.error(res.error)
      else toast.success(t.periodeSaved)
    })

  // Verrouiller fige les notes de la période : bulletins et relevés deviennent définitifs.
  const basculer = () => {
    if (!periode.verrouillee && !confirm(t.confirmVerrou)) return
    startTransition(async () => {
      const res = await verrouillerPeriode(periode.id, !periode.verrouillee)
      if (res.error) toast.error(res.error)
      else toast.success(periode.verrouillee ? t.deverrouillee : t.verrouillee)
    })
  }

  return (
    <li className="grid gap-2 py-3 sm:grid-cols-[9rem_1fr_1fr_auto_auto] sm:items-center sm:gap-3">
      <p className="flex items-center gap-2 text-sm font-medium text-foreground">
        {libelle}
        {periode.verrouillee && (
          <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-[0.68rem] font-semibold text-warning">
            <Lock className="h-3 w-3" /> {t.verrouillee}
          </span>
        )}
      </p>
      <label className="flex items-center gap-2 text-xs text-foreground-muted">
        <span className="w-8 shrink-0">{t.du}</span>
        <input type="date" value={debut} onChange={(e) => setDebut(e.target.value)} disabled={periode.verrouillee} className={`${inputClass} mt-0`} />
      </label>
      <label className="flex items-center gap-2 text-xs text-foreground-muted">
        <span className="w-8 shrink-0">{t.au}</span>
        <input type="date" value={fin} onChange={(e) => setFin(e.target.value)} disabled={periode.verrouillee} className={`${inputClass} mt-0`} />
      </label>
      <button type="button" onClick={enregistrer} disabled={!modifie || enCours} className={`${btnSecondary} py-1.5`}>
        {enCours ? dict.common.saving : dict.common.save}
      </button>
      <button type="button" onClick={basculer} disabled={enCours} className={`${btnSecondary} py-1.5`} title={periode.verrouillee ? t.deverrouiller : t.verrouiller}>
        {periode.verrouillee ? <LockOpen className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
        <span className="hidden lg:inline">{periode.verrouillee ? t.deverrouiller : t.verrouiller}</span>
      </button>
    </li>
  )
}

export default function AnneesClient({ annees, dict, locale, cycles }: { annees: Annee[]; dict: Dictionary; locale: string; cycles: Cycle[] }) {
  const t = dict.annees
  const c = dict.common
  const [ouvert, setOuvert] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, startTransition] = useTransition()

  const dateLisible = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString(intlLocale(locale), { day: 'numeric', month: 'short', year: 'numeric' })
  const libelleDecoupage = (d: Decoupage) => (d === 'trimestre' ? t.trimestre : t.semestre)
  const libellePeriode = (p: Periode) => fmt(p.decoupage === 'trimestre' ? t.trimestreN : t.semestreN, { n: p.rang })

  // Cycles concernés par chaque découpage de l'année (pour l'en-tête des périodes).
  const cyclesDe = (a: Annee, d: Decoupage) => cycles.filter((cy) => (a.decoupage_cycles[cy] ?? a.decoupage) === d)

  const soumettre = (formData: FormData) => {
    setErreur(null)
    startTransition(async () => {
      const res = await creerAnnee(formData)
      if (res.error) setErreur(res.error)
      else {
        toast.success(c.created)
        setOuvert(false)
      }
    })
  }

  const activer = (id: string) =>
    startTransition(async () => {
      const res = await activerAnnee(id)
      if (res.error) toast.error(res.error)
      else toast.success(t.activated)
    })

  const supprimer = (annee: Annee) => {
    if (!confirm(fmt(c.confirmDelete, { nom: annee.libelle }))) return
    startTransition(async () => {
      const res = await supprimerAnnee(annee.id)
      if (res.error) toast.error(res.error)
      else toast.success(c.deleted)
    })
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-base font-semibold text-foreground">{t.title}</h2>
          <p className="mt-0.5 text-sm text-foreground-muted">{t.desc}</p>
        </div>
        <button type="button" onClick={() => setOuvert(true)} className={`${btnPrimary} shrink-0`}>
          <Plus className="h-4 w-4" /> {t.newButton}
        </button>
      </div>

      {annees.length === 0 && (
        <div className={`${cardClass} flex flex-col items-center px-6 py-12 text-center`}>
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <CalendarRange className="h-6 w-6" />
          </span>
          <p className="mt-4 max-w-sm text-sm text-foreground-muted">{t.empty}</p>
        </div>
      )}

      {annees.map((annee) => {
        const decoupages = [...new Set(annee.periodes.map((p) => p.decoupage))].sort()
        return (
          <article key={annee.id} className={`${cardClass} overflow-hidden ${annee.active ? 'ring-2 ring-primary/30' : ''}`}>
            <header className="flex flex-wrap items-center gap-3 border-b border-surface-border px-5 py-4">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
                  {annee.libelle}
                  {annee.active && <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">{t.active}</span>}
                </p>
                <p className="mt-0.5 text-sm text-foreground-muted">
                  {dateLisible(annee.date_debut)} → {dateLisible(annee.date_fin)}
                </p>
              </div>
              {!annee.active && (
                <div className="flex gap-1">
                  <button type="button" onClick={() => activer(annee.id)} disabled={enCours} className={btnSecondary}>
                    <Zap className="h-4 w-4" /> {t.activer}
                  </button>
                  <button type="button" onClick={() => supprimer(annee)} disabled={enCours} className={`${btnIcon} hover:text-danger`} aria-label={c.delete} title={c.delete}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </header>
            {decoupages.map((d) => (
              <div key={d} className="border-b border-surface-border px-5 py-2 last:border-b-0">
                <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                  {libelleDecoupage(d)}
                  <span className="ms-2 font-normal normal-case">{cyclesDe(annee, d).map((cy) => dict.cycles[cy]).join(' · ')}</span>
                </p>
                <ul className="divide-y divide-surface-border">
                  {annee.periodes
                    .filter((p) => p.decoupage === d)
                    .map((p) => (
                      <PeriodeLigne key={p.id} periode={p} libelle={libellePeriode(p)} dict={dict} />
                    ))}
                </ul>
              </div>
            ))}
          </article>
        )
      })}

      <Modal
        open={ouvert}
        onClose={() => setOuvert(false)}
        title={t.newTitle}
        closeLabel={c.close}
        footer={
          <>
            <button type="button" onClick={() => setOuvert(false)} className={btnSecondary}>{c.cancel}</button>
            <button type="submit" form="form-annee" disabled={enCours} className={btnPrimary}>{enCours ? c.creating : c.create}</button>
          </>
        }
      >
        <form id="form-annee" action={soumettre} className="space-y-4">
          {erreur && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{erreur}</p>}
          <div>
            <label htmlFor="annee-libelle" className={labelClass}>{t.libelle}</label>
            <input id="annee-libelle" name="libelle" required maxLength={20} defaultValue={libelleSuggere()} placeholder={t.libellePlaceholder} className={inputClass} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="annee-debut" className={labelClass}>{t.dateDebut}</label>
              <input id="annee-debut" name="date_debut" type="date" required className={inputClass} />
            </div>
            <div>
              <label htmlFor="annee-fin" className={labelClass}>{t.dateFin}</label>
              <input id="annee-fin" name="date_fin" type="date" required className={inputClass} />
            </div>
          </div>
          <fieldset>
            <legend className={labelClass}>{t.decoupageParCycle}</legend>
            <p className={hintClass}>{t.decoupageParCycleHint}</p>
            <div className="mt-2 space-y-2">
              {cycles.map((cy) => (
                <div key={cy} className="flex items-center justify-between gap-3 rounded-lg border border-surface-border px-3 py-2">
                  <span className="text-sm text-foreground">{dict.cycles[cy]}</span>
                  <select name={`decoupage_${cy}`} defaultValue={cy === 'prescolaire' || cy === 'elementaire' ? 'trimestre' : 'semestre'} className={`${inputClass} mt-0 w-40`}>
                    <option value="trimestre">{t.trimestre}</option>
                    <option value="semestre">{t.semestre}</option>
                  </select>
                </div>
              ))}
            </div>
          </fieldset>
        </form>
      </Modal>
    </section>
  )
}
