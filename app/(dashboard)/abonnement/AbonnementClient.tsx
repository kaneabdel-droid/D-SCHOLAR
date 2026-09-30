'use client'

import { useEffect, useState, useTransition } from 'react'
import { ArrowRight, CheckCircle2, CreditCard, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import Modal from '@/components/ui/Modal'
import { btnPrimary, btnSecondary, hintClass, inputClass, labelClass } from '@/components/ui/styles'
import type { PalierCode } from '@/lib/abonnements/paliers'
import type { PlanCode } from '@/lib/abonnements/plans'
import { fmt } from '@/lib/i18n'
import { payerEcheance, souscrire } from './actions'

// Dernier numéro utilisé, mémorisé sur cet appareil (simple confort de saisie).
const CLE_TELEPHONE = 'ds-telephone-paiement'
function telephoneMemorise(): { pays: string; numero: string } {
  try {
    const v = JSON.parse(localStorage.getItem(CLE_TELEPHONE) ?? 'null')
    if (v && typeof v.pays === 'string' && typeof v.numero === 'string') return v
  } catch {}
  return { pays: 'SN', numero: '' }
}
function memoriserTelephone(pays: string, numero: string) {
  try {
    localStorage.setItem(CLE_TELEPHONE, JSON.stringify({ pays, numero }))
  } catch {}
}

type LibellesTelephone = { pays: string; telephone: string; telephoneHint: string }

function ChampsTelephone({
  pays,
  valeurPays,
  valeurNumero,
  onPays,
  onNumero,
  libelles,
}: {
  pays: string[]
  valeurPays: string
  valeurNumero: string
  onPays: (v: string) => void
  onNumero: (v: string) => void
  libelles: LibellesTelephone
}) {
  return (
    <div>
      <div className="grid grid-cols-[6.5rem_1fr] gap-2">
        <div>
          <label htmlFor="paiement-pays" className={labelClass}>{libelles.pays}</label>
          <select id="paiement-pays" value={valeurPays} onChange={(e) => onPays(e.target.value)} className={inputClass}>
            {pays.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="paiement-tel" className={labelClass}>{libelles.telephone}</label>
          <input id="paiement-tel" type="tel" inputMode="tel" dir="ltr" required value={valeurNumero} onChange={(e) => onNumero(e.target.value)} className={inputClass} />
        </div>
      </div>
      <p className={hintClass}>{libelles.telephoneHint}</p>
    </div>
  )
}

// ─── Échéancier ───────────────────────────────────────────────────────────────

type EcheanceAffichee = {
  id: string
  rang: number
  montant: number
  date_echeance: string
  statut: 'a_payer' | 'payee'
  dateLisible: string
  payeeLeLisible: string | null
  montantLisible: string
}

export function EcheancierClient({
  echeances,
  aujourdhui,
  pays,
  libelles,
}: {
  echeances: EcheanceAffichee[]
  aujourdhui: string
  pays: string[]
  libelles: LibellesTelephone & {
    tranche: string
    montant: string
    echeance: string
    statut: string
    payee: string
    aPayer: string
    enRetard: string
    payer: string
    continuer: string
    redirection: string
    fcfa: string
    cancel: string
    close: string
  }
}) {
  const [cible, setCible] = useState<EcheanceAffichee | null>(null)
  const [tel, setTel] = useState(() => ({ pays: 'SN', numero: '' }))
  const [enCours, startTransition] = useTransition()
  // Seule la plus petite tranche non payée est payable (ordre imposé côté serveur aussi).
  const payable = echeances.find((e) => e.statut === 'a_payer')?.id

  const ouvrir = (e: EcheanceAffichee) => {
    setTel(telephoneMemorise())
    setCible(e)
  }

  const payer = () => {
    if (!cible) return
    startTransition(async () => {
      const res = await payerEcheance(cible.id, tel.pays, tel.numero)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      memoriserTelephone(tel.pays, tel.numero)
      window.location.href = res.checkoutUrl
    })
  }

  return (
    <>
      <ul className="divide-y divide-surface-border">
        {echeances.map((e) => {
          const retard = e.statut === 'a_payer' && e.date_echeance < aujourdhui
          return (
            <li key={e.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${e.statut === 'payee' ? 'bg-success/10 text-success' : retard ? 'bg-danger/10 text-danger' : 'bg-primary-soft text-primary'}`}>
                {e.statut === 'payee' ? <CheckCircle2 className="h-4 w-4" /> : e.rang}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">
                  {fmt(libelles.tranche, { n: e.rang })} · <span className="tabular-nums">{e.montantLisible} {libelles.fcfa}</span>
                </p>
                <p className="text-xs text-foreground-muted">{e.payeeLeLisible ?? `${libelles.echeance} · ${e.dateLisible}`}</p>
              </div>
              {e.statut === 'payee' ? (
                <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">{libelles.payee}</span>
              ) : (
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${retard ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'}`}>
                    {retard ? libelles.enRetard : libelles.aPayer}
                  </span>
                  {e.id === payable && (
                    <button type="button" onClick={() => ouvrir(e)} className={`${btnPrimary} py-1.5`}>
                      <CreditCard className="h-4 w-4" /> {libelles.payer}
                    </button>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <Modal
        open={cible !== null}
        onClose={() => setCible(null)}
        title={cible ? `${fmt(libelles.tranche, { n: cible.rang })} · ${cible.montantLisible} ${libelles.fcfa}` : ''}
        closeLabel={libelles.close}
        footer={
          <>
            <button type="button" onClick={() => setCible(null)} className={btnSecondary}>{libelles.cancel}</button>
            <button type="button" onClick={payer} disabled={enCours || !tel.numero} className={btnPrimary}>
              {enCours ? <><Loader2 className="h-4 w-4 animate-spin" /> {libelles.redirection}</> : libelles.continuer}
            </button>
          </>
        }
      >
        <ChampsTelephone
          pays={pays}
          valeurPays={tel.pays}
          valeurNumero={tel.numero}
          onPays={(v) => setTel((t) => ({ ...t, pays: v }))}
          onNumero={(v) => setTel((t) => ({ ...t, numero: v }))}
          libelles={libelles}
        />
      </Modal>
    </>
  )
}

// ─── Souscription ─────────────────────────────────────────────────────────────

type Offre = { palier: PalierCode; prix: number; plans: { plan: PlanCode; tranches: number[] }[] }

export function SouscrireForm({
  offres,
  palierInitial,
  planInitial,
  periode,
  pays,
  locale,
  libelles,
}: {
  offres: Offre[]
  palierInitial: PalierCode
  planInitial: PlanCode
  /** Mensuel : période que couvrira le paiement. */
  periode?: string
  pays: string[]
  locale: string
  libelles: LibellesTelephone & {
    parMois: string
    choisirPalier: string
    choisirPlan: string
    paliers: Record<PalierCode, string>
    plans: Record<PlanCode, string>
    planDetail: Record<PlanCode, string>
    aPayerMaintenant: string
    total: string
    fcfa: string
    continuer: string
    redirection: string
    tranche: string
  }
}) {
  const [palier, setPalier] = useState<PalierCode>(palierInitial)
  const [plan, setPlan] = useState<PlanCode>(planInitial)
  const [tel, setTel] = useState({ pays: 'SN', numero: '' })
  // Chargé après le montage : localStorage n'existe pas au rendu serveur.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setTel(telephoneMemorise()), [])
  const [enCours, startTransition] = useTransition()
  const nombre = (n: number) => n.toLocaleString(locale)

  const offre = offres.find((o) => o.palier === palier)!
  const tranches = offre.plans.find((p) => p.plan === plan)!.tranches

  const valider = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const res = await souscrire(palier, plan, tel.pays, tel.numero)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      memoriserTelephone(tel.pays, tel.numero)
      window.location.href = res.checkoutUrl
    })
  }

  return (
    <form onSubmit={valider} className="mt-5 space-y-6">
      <fieldset>
        <legend className={labelClass}>{libelles.choisirPalier}</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {offres.map((o) => (
            <label
              key={o.palier}
              className="cursor-pointer rounded-xl border border-surface-border p-4 transition has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:checked]:ring-2 has-[:checked]:ring-primary/20"
            >
              <input type="radio" name="palier" value={o.palier} checked={palier === o.palier} onChange={() => setPalier(o.palier)} className="sr-only" />
              <p className="font-heading font-semibold text-foreground">{libelles.paliers[o.palier]}</p>
              <p className="mt-1 text-sm tabular-nums text-foreground-muted">{nombre(o.prix)} {libelles.fcfa} {libelles.parMois}</p>
            </label>
          ))}
        </div>
      </fieldset>

      {offre.plans.length > 1 && (
      <fieldset>
        <legend className={labelClass}>{libelles.choisirPlan}</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {offre.plans.map((p) => (
            <label
              key={p.plan}
              className="cursor-pointer rounded-xl border border-surface-border p-4 transition has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:checked]:ring-2 has-[:checked]:ring-primary/20"
            >
              <input type="radio" name="plan" value={p.plan} checked={plan === p.plan} onChange={() => setPlan(p.plan)} className="sr-only" />
              <p className="font-semibold text-foreground">{libelles.plans[p.plan]}</p>
              <p className="mt-1 text-xs text-foreground-muted">{libelles.planDetail[p.plan]}</p>
            </label>
          ))}
        </div>
      </fieldset>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <ChampsTelephone
          pays={pays}
          valeurPays={tel.pays}
          valeurNumero={tel.numero}
          onPays={(v) => setTel((t) => ({ ...t, pays: v }))}
          onNumero={(v) => setTel((t) => ({ ...t, numero: v }))}
          libelles={libelles}
        />

        <div className="rounded-xl bg-background p-4">
          {plan === 'mensuel' ? (
            <p className="text-sm text-foreground-muted">{libelles.planDetail.mensuel}{periode && <span className="mt-1 block font-medium text-foreground">{periode}</span>}</p>
          ) : (
          <>
          <ul className="space-y-1.5 text-sm">
            {tranches.map((montant, i) => (
              <li key={i} className={`flex justify-between gap-4 ${i === 0 ? 'font-semibold text-foreground' : 'text-foreground-muted'}`}>
                <span>{fmt(libelles.tranche, { n: i + 1 })}</span>
                <span className="tabular-nums">{nombre(montant)} {libelles.fcfa}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex justify-between gap-4 border-t border-surface-border pt-3 text-sm text-foreground-muted">
            <span>{libelles.total}</span>
            <span className="tabular-nums">{nombre(offre.prix)} {libelles.fcfa}</span>
          </div>
          </>
          )}
          <div className="mt-2 flex items-baseline justify-between gap-4">
            <span className="text-sm font-medium text-foreground">{libelles.aPayerMaintenant}</span>
            <span className="font-heading text-2xl font-semibold tabular-nums text-primary">{nombre(tranches[0])} {libelles.fcfa}</span>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={enCours || !tel.numero} className={`${btnPrimary} px-5 py-2.5`}>
          {enCours ? <><Loader2 className="h-4 w-4 animate-spin" /> {libelles.redirection}</> : <>{libelles.continuer} <ArrowRight className="h-4 w-4 rtl:-scale-x-100" /></>}
        </button>
      </div>
    </form>
  )
}

