// Année d'abonnement : 10 mois payés, puis 2 mois de vacances offerts. Règles
// partagées par le crédit d'un paiement (reconcile.ts) et l'affichage (etat.ts).
import { addMonths } from 'date-fns'
import { MOIS_OFFERTS, MOIS_PAYANTS_PAR_AN, SEUIL_SUSPENSION_JOURS } from './plans'

export type PeriodePayee = { plan: string; debut: string; fin: string; mois_offerts: number }

const JOUR_MS = 24 * 60 * 60 * 1000

// Début de la période payée maintenant. Paiement d'avance : à la fin de la
// période couverte. Paiement en retard, avant la suspension (≤ 30 jours) : à la
// fin de la période précédente aussi — les jours de grâce sont décomptés et la
// suite des mois reste continue. Au-delà : au jour du paiement, nouveau départ.
export function debutPeriode(finPrecedente: Date | null, paiement: Date): Date {
  if (!finPrecedente) return paiement
  if (finPrecedente > paiement) return finPrecedente
  return paiement.getTime() - finPrecedente.getTime() <= SEUIL_SUSPENSION_JOURS * JOUR_MS ? finPrecedente : paiement
}

// Mois payés consécutifs depuis la dernière période offerte (ou depuis la
// dernière interruption), en remontant depuis la période la plus récente.
export function moisPayesDansLeCycle(periodes: PeriodePayee[]): number {
  const triees = [...periodes].sort((a, b) => new Date(b.fin).getTime() - new Date(a.fin).getTime())
  let n = 0
  let debutAttendu: number | null = null
  for (const p of triees) {
    if (p.plan !== 'mensuel' || p.mois_offerts > 0) break
    // Chaque période doit se terminer exactement au début de la suivante.
    if (debutAttendu !== null && Math.abs(new Date(p.fin).getTime() - debutAttendu) > 60_000) break
    n++
    debutAttendu = new Date(p.debut).getTime()
  }
  return n
}

// Rang du prochain mois payé dans l'année d'abonnement (1 à 10), et la
// période qu'il couvrira (3 mois pour le 10e : 1 payé + 2 offerts).
export function prochainePeriode(periodes: PeriodePayee[], paiement: Date) {
  const derniere = periodes.reduce<PeriodePayee | null>((m, p) => (!m || new Date(p.fin) > new Date(m.fin) ? p : m), null)
  const finPrecedente = derniere ? new Date(derniere.fin) : null
  const debut = debutPeriode(finPrecedente, paiement)
  const continue_ = finPrecedente !== null && debut.getTime() === finPrecedente.getTime()
  const rang = continue_ ? moisPayesDansLeCycle(periodes) + 1 : 1
  const moisOfferts = rang >= MOIS_PAYANTS_PAR_AN ? MOIS_OFFERTS : 0
  return { debut, fin: addMonths(debut, 1 + moisOfferts), rang: Math.min(rang, MOIS_PAYANTS_PAR_AN), moisOfferts }
}
