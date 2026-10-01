// Plans de paiement d'une souscription. Depuis le passage à l'abonnement
// mensuel, seul `mensuel` est proposé : un paiement = un mois, au prix du
// palier (un produit Chariow par palier, prix fixe). Les plans annuels
// (comptant, deux tranches) restent lisibles pour les souscriptions déjà payées.

import { PALIERS, type PalierCode } from './paliers'

export type PlanCode = 'mensuel' | 'comptant' | 'deux_tranches'
export type Pourcentage = 100 | 50

export const PLANS: Record<PlanCode, { repartition: Pourcentage[]; decalagesMois: number[]; dureeMois: number }> = {
  mensuel: { repartition: [100], decalagesMois: [0], dureeMois: 1 },
  comptant: { repartition: [100], decalagesMois: [0], dureeMois: 12 },
  deux_tranches: { repartition: [50, 50], decalagesMois: [0, 3], dureeMois: 12 },
}

// Plans ouverts aux nouvelles souscriptions.
export const PLAN_CODES: PlanCode[] = ['mensuel']

// Accès selon le retard de paiement — miroir de public.acces_etablissement()
// (05_abonnements.sql), à garder synchronisé.
export const SEUIL_LECTURE_SEULE_JOURS = 15
export const SEUIL_SUSPENSION_JOURS = 30

// Année d'abonnement : 10 mois payés d'affilée, puis les vacances offertes selon
// le calendrier de l'établissement (lib/abonnements/cycle.ts). MOIS_OFFERTS sert
// quand la rentrée suivante n'est pas encore créée.
export const MOIS_PAYANTS_PAR_AN = 10
export const MOIS_OFFERTS = 2

// Mensuel : on peut payer d'avance, jusqu'à ce nombre de mois couverts.
export const MOIS_AVANCE_MAX = 12
// Bandeau de rappel quelques jours avant la fin de la période payée.
export const RAPPEL_RENOUVELLEMENT_JOURS = 7
// Ancien abonnement annuel : renouvellement ouvert dans les 30 derniers jours.
export const FENETRE_RENOUVELLEMENT_JOURS = 30

export type Acces = 'complet' | 'lecture_seule' | 'suspendu'

export function estPlanValide(v: string): v is PlanCode {
  return (PLAN_CODES as string[]).includes(v)
}

export function estPalierValide(v: string): v is PalierCode {
  return v in PALIERS
}

// Montant total d'une souscription (un mois pour le plan mensuel).
export function montantSouscription(palier: PalierCode, plan: PlanCode): number {
  return PALIERS[palier].prixMensuelFcfa * PLANS[plan].dureeMois
}

// Montant de chaque tranche ; la dernière absorbe l'arrondi (même règle que
// creer_souscription() en SQL).
export function montantsTranches(palier: PalierCode, plan: PlanCode): number[] {
  const total = montantSouscription(palier, plan)
  const parts = PLANS[plan].repartition
  let cumul = 0
  return parts.map((p, i) => {
    const montant = i === parts.length - 1 ? total - cumul : Math.round((total * p) / 100)
    cumul += montant
    return montant
  })
}
