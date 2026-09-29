// Plans de paiement d'une souscription annuelle. Tranche 1 ≥ 50 % (règle
// commerciale, réimposée en base par premiere_tranche_min_50 et
// creer_souscription()). Deux paiements au plus : 100 %, ou 50 % + 50 % —
// ce qui limite aussi les produits Chariow (prix fixes) à 2 par formule.

import { PALIERS, type PalierCode } from './paliers'

export type PlanCode = 'comptant' | 'deux_tranches'
export type Pourcentage = 100 | 50

export const PLANS: Record<PlanCode, { repartition: Pourcentage[]; decalagesMois: number[] }> = {
  comptant: { repartition: [100], decalagesMois: [0] },
  deux_tranches: { repartition: [50, 50], decalagesMois: [0, 3] },
}

export const PLAN_CODES = Object.keys(PLANS) as PlanCode[]
export const POURCENTAGES: Pourcentage[] = [100, 50]

// Accès selon le retard de paiement — miroir de public.acces_etablissement()
// (05_abonnements.sql), à garder synchronisé.
export const SEUIL_LECTURE_SEULE_JOURS = 15
export const SEUIL_SUSPENSION_JOURS = 30

// Durée couverte par une souscription, à partir du paiement de la tranche 1.
export const DUREE_SOUSCRIPTION_MOIS = 12

// Une nouvelle souscription (renouvellement) ne s'ouvre qu'à l'approche de la
// fin de la période en cours : payer plus tôt est presque toujours un doublon.
export const FENETRE_RENOUVELLEMENT_JOURS = 30

export type Acces = 'complet' | 'lecture_seule' | 'suspendu'

export function estPlanValide(v: string): v is PlanCode {
  return v in PLANS
}

export function estPalierValide(v: string): v is PalierCode {
  return v in PALIERS
}

// Montant de chaque tranche ; la dernière absorbe l'arrondi (même règle que
// creer_souscription() en SQL).
export function montantsTranches(palier: PalierCode, plan: PlanCode): number[] {
  const total = PALIERS[palier].prixAnnuelFcfa
  const parts = PLANS[plan].repartition
  let cumul = 0
  return parts.map((p, i) => {
    const montant = i === parts.length - 1 ? total - cumul : Math.round((total * p) / 100)
    cumul += montant
    return montant
  })
}

export function montantPourcentage(palier: PalierCode, pourcentage: Pourcentage): number {
  return Math.round((PALIERS[palier].prixAnnuelFcfa * pourcentage) / 100)
}
