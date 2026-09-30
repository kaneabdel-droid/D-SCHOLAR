import { cache } from 'react'
import { createAdminClient } from '@/utils/supabase/admin'
import { FENETRE_RENOUVELLEMENT_JOURS, MOIS_AVANCE_MAX, type PlanCode, type Pourcentage } from './plans'
import type { PalierCode } from './paliers'
import { prochainePeriode } from './cycle'

export type Echeance = {
  id: string
  rang: number
  pourcentage: Pourcentage
  montant: number
  date_echeance: string
  statut: 'a_payer' | 'payee'
  payee_le: string | null
}

export type Souscription = {
  id: string
  palier: PalierCode
  plan: PlanCode
  montant_total: number
  statut: 'en_attente' | 'active' | 'soldee' | 'annulee'
  debut: string | null
  fin: string | null
  /** Mois de vacances offerts ajoutés à cette période (10e mois payé). */
  mois_offerts: number
  echeances: Echeance[]
}

export type EtatAbonnement = {
  accesManuelJusquAu: string | null
  /** Souscription dont la période couvre aujourd'hui. */
  courante: Souscription | null
  /** Première période déjà payée qui démarrera après la période courante. */
  future: Souscription | null
  /** Toutes les périodes payées d'avance (mensuel : plusieurs mois possibles). */
  futures: Souscription[]
  /** Fin de la dernière période payée (null : jamais payé). */
  payeJusquau: string | null
  /** Dernières périodes payées, de la plus récente à la plus ancienne. */
  historique: Souscription[]
  /** Jours avant la fin de la dernière période payée (négatif : terminée). */
  joursAvantFin: number | null
  /** Prochain paiement mensuel : rang dans l'année (1 à 10) et période couverte. */
  prochainMois: { rang: number; moisOfferts: number; debut: string; fin: string }
  /** Souscription créée dont la tranche 1 n'est pas encore payée. */
  enAttente: Souscription | null
  /** Plus petite tranche non payée de la souscription courante. */
  prochaine: Echeance | null
  retardJours: number
  peutSouscrire: boolean
  /** Date d'ouverture du renouvellement quand il n'est pas encore possible. */
  renouvellementLe: Date | null
}

const JOUR_MS = 24 * 60 * 60 * 1000

// Lu avec le client service role, établissement imposé par l'appelant (issu
// de getCurrentUserContext) : le bandeau de retard s'affiche à tout le
// personnel alors que le RLS de ces tables est réservé à la direction.
export const etatAbonnement = cache(async (etablissementId: string): Promise<EtatAbonnement> => {
  const supabase = createAdminClient()
  const [{ data: etab }, { data: lignes }] = await Promise.all([
    supabase.from('etablissements').select('acces_manuel_jusqu_au').eq('id', etablissementId).single(),
    supabase
      .from('souscriptions')
      .select('id, palier, plan, montant_total, statut, debut, fin, mois_offerts, echeances_abonnement(id, rang, pourcentage, montant, date_echeance, statut, payee_le)')
      .eq('etablissement_id', etablissementId)
      .neq('statut', 'annulee')
      .order('created_at', { ascending: false }),
  ])

  const maintenant = new Date()
  const souscriptions: Souscription[] = (lignes ?? []).map((s) => ({
    ...(s as Omit<Souscription, 'echeances'>),
    echeances: [...((s.echeances_abonnement ?? []) as Echeance[])].sort((a, b) => a.rang - b.rang),
  }))

  const payees = souscriptions.filter((s) => (s.statut === 'active' || s.statut === 'soldee') && s.debut && s.fin)
  const courante = payees.find((s) => new Date(s.debut!) <= maintenant && new Date(s.fin!) > maintenant) ?? null
  const futures = payees.filter((s) => new Date(s.debut!) > maintenant).sort((a, b) => a.debut!.localeCompare(b.debut!))
  const future = futures[0] ?? null
  const payeJusquau = payees.reduce<string | null>((m, s) => (!m || s.fin! > m ? s.fin! : m), null)
  const historique = [...payees].sort((a, b) => b.debut!.localeCompare(a.debut!)).slice(0, 12)
  const enAttente = souscriptions.find((s) => s.statut === 'en_attente') ?? null

  const prochaine = courante?.echeances.find((e) => e.statut === 'a_payer') ?? null
  const aujourdhui = maintenant.toISOString().slice(0, 10)
  const retardJours =
    prochaine && prochaine.date_echeance < aujourdhui
      ? Math.floor((Date.parse(aujourdhui) - Date.parse(prochaine.date_echeance)) / JOUR_MS)
      : 0

  // Mensuel : payable d'avance, mois après mois, jusqu'à MOIS_AVANCE_MAX mois
  // couverts. Ancien abonnement annuel : renouvellement dans ses 30 derniers jours.
  const annuelEnCours = courante && courante.plan !== 'mensuel'
  let peutSouscrire = annuelEnCours ? !future : (courante ? 1 : 0) + futures.length < MOIS_AVANCE_MAX
  let renouvellementLe: Date | null = null
  if (annuelEnCours && !future) {
    const ouverture = new Date(new Date(courante.fin!).getTime() - FENETRE_RENOUVELLEMENT_JOURS * JOUR_MS)
    peutSouscrire = ouverture <= maintenant
    if (!peutSouscrire) renouvellementLe = ouverture
  }

  return {
    accesManuelJusquAu: etab?.acces_manuel_jusqu_au ?? null,
    courante,
    future,
    futures,
    payeJusquau,
    historique,
    prochainMois: (() => {
      const p = prochainePeriode(payees.map((s) => ({ plan: s.plan, debut: s.debut!, fin: s.fin!, mois_offerts: s.mois_offerts ?? 0 })), maintenant)
      return { rang: p.rang, moisOfferts: p.moisOfferts, debut: p.debut.toISOString(), fin: p.fin.toISOString() }
    })(),
    joursAvantFin: payeJusquau ? Math.ceil((new Date(payeJusquau).getTime() - maintenant.getTime()) / JOUR_MS) : null,
    enAttente,
    prochaine,
    retardJours,
    peutSouscrire,
    renouvellementLe,
  }
})
