import { CheckCircle2, Clock, Gift, Lock, PauseCircle, ShieldCheck } from 'lucide-react'
import { cardClass } from '@/components/ui/styles'
import type { UserContext } from '@/lib/auth/getCurrentUserContext'
import { etatAbonnement, type Souscription } from '@/lib/abonnements/etat'
import { PALIER_CODES, PALIERS } from '@/lib/abonnements/paliers'
import { montantsTranches, PLAN_CODES, SEUIL_LECTURE_SEULE_JOURS } from '@/lib/abonnements/plans'
import { PAYS_TELEPHONE_SUPPORTES } from '@/lib/abonnements/telephone'
import { fmt, intlLocale } from '@/lib/i18n'
import type { Dictionary } from '@/dictionaries'
import { EcheancierClient, SouscrireForm } from './AbonnementClient'

// Partagé par /abonnement et /compte-suspendu (la direction doit pouvoir payer
// même quand l'accès est coupé).
export default async function AbonnementPanel({ context, dict, locale }: { context: UserContext; dict: Dictionary; locale: string }) {
  const t = dict.abonnement
  const etat = await etatAbonnement(context.etablissementId)
  const loc = intlLocale(locale)
  const date = (iso: string) => new Date(iso.length === 10 ? iso + 'T00:00:00' : iso).toLocaleDateString(loc, { day: 'numeric', month: 'long', year: 'numeric' })
  const nombre = (n: number) => n.toLocaleString(loc)

  const icones = { complet: ShieldCheck, lecture_seule: Lock, suspendu: PauseCircle }
  const teintes = { complet: 'bg-success/10 text-success', lecture_seule: 'bg-warning/10 text-warning', suspendu: 'bg-danger/10 text-danger' }
  const Icone = icones[context.acces]

  // Montants de chaque plan pour chaque palier, calculés côté serveur (source unique : plans.ts).
  const offres = PALIER_CODES.map((palier) => ({
    palier,
    prix: PALIERS[palier].prixAnnuelFcfa,
    plans: PLAN_CODES.map((plan) => ({ plan, tranches: montantsTranches(palier, plan) })),
  }))

  const libelleEcheancier = {
    tranche: t.tranche,
    montant: t.montant,
    echeance: t.echeance,
    statut: t.statut,
    payee: t.payee,
    aPayer: t.aPayer,
    enRetard: t.enRetard,
    payer: t.payer,
    pays: t.pays,
    telephone: t.telephone,
    telephoneHint: t.telephoneHint,
    continuer: t.continuer,
    redirection: t.redirection,
    fcfa: t.fcfa,
    cancel: dict.common.cancel,
    close: dict.common.close,
  }

  const echeancier = (s: Souscription) => (
    <EcheancierClient
      echeances={s.echeances.map((e) => ({ ...e, dateLisible: date(e.date_echeance), payeeLeLisible: e.payee_le ? fmt(t.payeeLe, { date: date(e.payee_le) }) : null, montantLisible: nombre(e.montant) }))}
      aujourdhui={new Date().toISOString().slice(0, 10)}
      pays={PAYS_TELEPHONE_SUPPORTES as string[]}
      libelles={libelleEcheancier}
    />
  )

  return (
    <div className="space-y-6">
      <section className={`${cardClass} p-5 sm:p-6`}>
        <div className="flex flex-wrap items-start gap-4">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${teintes[context.acces]}`}>
            <Icone className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">{t.etatTitle}</p>
            <p className="mt-0.5 font-heading text-xl font-semibold text-foreground">{t.acces[context.acces]}</p>
            <p className="mt-1 text-sm text-foreground-muted">{t.accesDesc[context.acces]}</p>
          </div>
          {etat.courante && (
            <div className="rounded-xl bg-primary-soft px-4 py-2.5 text-sm">
              <p className="font-semibold text-primary">{dict.paliers[etat.courante.palier]} · {t.plans[etat.courante.plan]}</p>
              <p className="text-xs text-foreground-muted">{fmt(t.periode, { debut: date(etat.courante.debut!), fin: date(etat.courante.fin!) })}</p>
            </div>
          )}
        </div>
        {etat.accesManuelJusquAu && new Date(etat.accesManuelJusquAu) > new Date() && (
          <p className="mt-4 flex items-center gap-2 rounded-lg bg-info/10 px-3 py-2 text-sm text-info">
            <Gift className="h-4 w-4 shrink-0" /> {fmt(t.accesOffert, { date: date(etat.accesManuelJusquAu) })}
          </p>
        )}
        {etat.retardJours > 0 && etat.prochaine && (
          <p className="mt-4 flex items-center gap-2 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">
            <Clock className="h-4 w-4 shrink-0" />
            {fmt(t.bannerRetard, { n: etat.prochaine.rang, montant: nombre(etat.prochaine.montant), jours: etat.retardJours, seuil: SEUIL_LECTURE_SEULE_JOURS })}
          </p>
        )}
      </section>

      {etat.courante && (
        <section className={cardClass}>
          <h2 className="border-b border-surface-border px-5 py-4 font-heading text-base font-semibold text-foreground">{t.echeancier}</h2>
          {echeancier(etat.courante)}
        </section>
      )}

      {etat.future && (
        <section className={cardClass}>
          <h2 className="flex flex-wrap items-center gap-2 border-b border-surface-border px-5 py-4 font-heading text-base font-semibold text-foreground">
            <CheckCircle2 className="h-4 w-4 text-success" /> {t.renouvelerTitle}
            <span className="text-sm font-normal text-foreground-muted">{fmt(t.periode, { debut: date(etat.future.debut!), fin: date(etat.future.fin!) })}</span>
          </h2>
          {echeancier(etat.future)}
        </section>
      )}

      {!etat.courante && !etat.future && (
        <p className={`${cardClass} px-5 py-4 text-sm text-foreground-muted`}>{t.aucune}</p>
      )}

      {etat.peutSouscrire ? (
        <section className={`${cardClass} p-5 sm:p-6`}>
          <h2 className="font-heading text-base font-semibold text-foreground">{etat.courante ? t.renouvelerTitle : t.souscrireTitle}</h2>
          <p className="mt-0.5 text-sm text-foreground-muted">{t.souscrireDesc}</p>
          {etat.enAttente && <p className="mt-3 rounded-lg bg-info/10 px-3 py-2 text-sm text-info">{t.enAttente}</p>}
          <SouscrireForm
            offres={offres}
            palierInitial={etat.enAttente?.palier ?? etat.courante?.palier ?? context.palier}
            planInitial={etat.enAttente?.plan ?? 'deux_tranches'}
            pays={PAYS_TELEPHONE_SUPPORTES as string[]}
            locale={loc}
            libelles={{
              choisirPalier: t.choisirPalier,
              choisirPlan: t.choisirPlan,
              paliers: dict.paliers,
              plans: t.plans,
              planDetail: t.planDetail,
              aPayerMaintenant: t.aPayerMaintenant,
              total: t.total,
              fcfa: t.fcfa,
              pays: t.pays,
              telephone: t.telephone,
              telephoneHint: t.telephoneHint,
              continuer: t.continuer,
              redirection: t.redirection,
              tranche: t.tranche,
            }}
          />
        </section>
      ) : (
        etat.renouvellementLe && <p className="text-center text-sm text-foreground-muted">{fmt(t.renouvellementLe, { date: date(etat.renouvellementLe.toISOString()) })}</p>
      )}
    </div>
  )
}
