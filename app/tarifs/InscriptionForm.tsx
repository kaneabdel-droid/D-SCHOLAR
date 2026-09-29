'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, Loader2 } from 'lucide-react'
import { btnPrimary, cardClass, hintClass, inputClass, labelClass } from '@/components/ui/styles'
import type { Dictionary } from '@/dictionaries'
import type { PalierCode } from '@/lib/abonnements/paliers'
import type { PlanCode } from '@/lib/abonnements/plans'
import { fmt } from '@/lib/i18n'
import { inscrire } from './actions'

type Offre = { palier: PalierCode; prix: number; plans: { plan: PlanCode; tranches: number[] }[] }

export default function InscriptionForm({
  offres,
  palierInitial,
  descriptions,
  pays,
  locale,
  dict,
}: {
  offres: Offre[]
  palierInitial: PalierCode
  descriptions: Record<PalierCode, string>
  pays: string[]
  locale: string
  dict: Dictionary
}) {
  const t = dict.tarifs
  const a = dict.abonnement
  const [palier, setPalier] = useState<PalierCode>(palierInitial)
  const [plan, setPlan] = useState<PlanCode>('deux_tranches')
  const [erreur, setErreur] = useState<{ texte: string; versAbonnement?: boolean } | null>(null)
  const [enCours, startTransition] = useTransition()
  const ouvertLe = useRef<HTMLInputElement>(null)
  const nombre = (n: number) => n.toLocaleString(locale)

  // Horodatage d'affichage (anti-robot, cf. actions.ts).
  useEffect(() => {
    if (ouvertLe.current) ouvertLe.current.value = String(Date.now())
  }, [])

  const offre = offres.find((o) => o.palier === palier)!
  const tranches = offre.plans.find((p) => p.plan === plan)!.tranches

  const soumettre = (formData: FormData) => {
    setErreur(null)
    startTransition(async () => {
      const res = await inscrire(formData)
      if ('checkoutUrl' in res) window.location.href = res.checkoutUrl
      else setErreur({ texte: res.error, versAbonnement: res.versAbonnement })
    })
  }

  const champ = (name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`insc-${name}`} className={labelClass}>{label}</label>
      <input id={`insc-${name}`} name={name} className={inputClass} {...props} />
    </div>
  )

  return (
    <form action={soumettre} className="space-y-6">
      <input ref={ouvertLe} type="hidden" name="ouvert_le" />
      <input type="text" name="site_web" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      <input type="hidden" name="palier" value={palier} />
      <input type="hidden" name="plan" value={plan} />

      {/* Formules */}
      <div className="grid gap-4 md:grid-cols-3">
        {offres.map((o) => {
          const actif = o.palier === palier
          return (
            <button
              key={o.palier}
              type="button"
              onClick={() => setPalier(o.palier)}
              className={`${cardClass} p-5 text-start transition ${actif ? 'border-primary ring-2 ring-primary/25' : 'hover:border-primary/40'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-heading text-lg font-semibold text-foreground">{dict.paliers[o.palier]}</p>
                {actif && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-3.5 w-3.5" /></span>}
              </div>
              <p className="mt-2 flex items-baseline gap-1.5">
                <span className="font-heading text-3xl font-semibold tabular-nums text-foreground">{nombre(o.prix)}</span>
                <span className="text-sm text-foreground-muted">{dict.landing.perYear}</span>
              </p>
              <p className="mt-2 text-sm text-foreground-muted">{descriptions[o.palier]}</p>
            </button>
          )
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className={`${cardClass} space-y-6 p-5 sm:p-6`}>
          <fieldset className="space-y-4">
            <legend className="font-heading text-base font-semibold text-foreground">{t.etablissementTitle}</legend>
            {champ('nom_etablissement', t.nomEtablissement, { required: true, maxLength: 255 })}
            <div className="grid gap-4 sm:grid-cols-2">
              {champ('ville', t.ville)}
              {champ('telephone', t.telephone, { type: 'tel' })}
            </div>
          </fieldset>
          <fieldset className="space-y-4">
            <legend className="font-heading text-base font-semibold text-foreground">{t.directionTitle}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              {champ('prenom', t.prenom)}
              {champ('nom', t.nom, { required: true })}
            </div>
            {champ('email', t.email, { type: 'email', required: true, autoComplete: 'email' })}
            <div>
              {champ('mot_de_passe', t.motDePasse, { type: 'password', required: true, minLength: 8, autoComplete: 'new-password' })}
              <p className={hintClass}>{t.motDePasseHint}</p>
            </div>
          </fieldset>
        </div>

        <div className={`${cardClass} h-fit space-y-5 p-5 sm:p-6`}>
          <p className="font-heading text-base font-semibold text-foreground">{t.paiementTitle}</p>
          <div className="space-y-2">
            {offre.plans.map((p) => (
              <label key={p.plan} className="flex cursor-pointer items-start gap-3 rounded-xl border border-surface-border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary-soft">
                <input type="radio" name="plan_choix" checked={plan === p.plan} onChange={() => setPlan(p.plan)} className="mt-1 accent-[var(--primary)]" />
                <span>
                  <span className="block text-sm font-semibold text-foreground">{a.plans[p.plan]}</span>
                  <span className="block text-xs text-foreground-muted">{a.planDetail[p.plan]}</span>
                </span>
              </label>
            ))}
          </div>

          <ul className="space-y-1 rounded-xl bg-background p-3 text-sm">
            {tranches.map((m, i) => (
              <li key={i} className={`flex justify-between gap-4 ${i === 0 ? 'font-semibold text-foreground' : 'text-foreground-muted'}`}>
                <span>{fmt(a.tranche, { n: i + 1 })}</span>
                <span className="tabular-nums">{nombre(m)} {a.fcfa}</span>
              </li>
            ))}
          </ul>

          <div>
            <div className="grid grid-cols-[6rem_1fr] gap-2">
              <div>
                <label htmlFor="insc-pays" className={labelClass}>{a.pays}</label>
                <select id="insc-pays" name="pays" defaultValue="SN" className={inputClass}>
                  {pays.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="insc-tel" className={labelClass}>{a.telephone}</label>
                <input id="insc-tel" name="telephone_paiement" type="tel" inputMode="tel" dir="ltr" required className={inputClass} />
              </div>
            </div>
            <p className={hintClass}>{a.telephoneHint}</p>
          </div>

          <div className="flex items-baseline justify-between gap-3 border-t border-surface-border pt-4">
            <span className="text-sm font-medium text-foreground">{a.aPayerMaintenant}</span>
            <span className="font-heading text-2xl font-semibold tabular-nums text-primary">{nombre(tranches[0])} {a.fcfa}</span>
          </div>

          {erreur && (
            <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {erreur.texte}
              {erreur.versAbonnement && (
                <Link href="/abonnement" className="mt-1 block font-semibold underline">{t.retry}</Link>
              )}
            </div>
          )}

          <button type="submit" disabled={enCours} className={`${btnPrimary} w-full py-3`}>
            {enCours ? <><Loader2 className="h-4 w-4 animate-spin" /> {t.enCours}</> : <>{t.submit} <ArrowRight className="h-4 w-4 rtl:-scale-x-100" /></>}
          </button>
        </div>
      </div>
    </form>
  )
}
