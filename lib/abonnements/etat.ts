import { cache } from 'react'
import { createAdminClient } from '@/utils/supabase/admin'
import { FENETRE_RENOUVELLEMENT_JOURS, type PlanCode, type Pourcentage } from './plans'
import type { PalierCode } from './paliers'

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
  echeances: Echeance[]
}

export type EtatAbonnement = {
  accesManuelJusquAu: string | null
  /** Souscription dont la période couvre aujourd'hui. */
  courante: Souscription | null
  /** Renouvellement déjà payé qui démarrera à la fin de la période courante. */
  future: Souscription | null
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
      .select('id, palier, plan, montant_total, statut, debut, fin, echeances_abonnement(id, rang, pourcentage, montant, date_echeance, statut, payee_le)')
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
  const future = payees.find((s) => new Date(s.debut!) > maintenant) ?? null
  const enAttente = souscriptions.find((s) => s.statut === 'en_attente') ?? null

  const prochaine = courante?.echeances.find((e) => e.statut === 'a_payer') ?? null
  const aujourdhui = maintenant.toISOString().slice(0, 10)
  const retardJours =
    prochaine && prochaine.date_echeance < aujourdhui
      ? Math.floor((Date.parse(aujourdhui) - Date.parse(prochaine.date_echeance)) / JOUR_MS)
      : 0

  // Nouvelle souscription : jamais si un renouvellement est déjà payé ; sinon
  // tout de suite sans période en cours, ou dans les 30 derniers jours de celle-ci.
  let peutSouscrire = !future
  let renouvellementLe: Date | null = null
  if (courante && !future) {
    const ouverture = new Date(new Date(courante.fin!).getTime() - FENETRE_RENOUVELLEMENT_JOURS * JOUR_MS)
    peutSouscrire = ouverture <= maintenant
    if (!peutSouscrire) renouvellementLe = ouverture
  }

  return {
    accesManuelJusquAu: etab?.acces_manuel_jusqu_au ?? null,
    courante,
    future,
    enAttente,
    prochaine,
    retardJours,
    peutSouscrire,
    renouvellementLe,
  }
})
