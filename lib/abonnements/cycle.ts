// Année d'abonnement : au moins 10 mois payés d'affilée, puis les vacances
// offertes selon le CALENDRIER DE L'ÉTABLISSEMENT (elles diffèrent d'un pays à
// l'autre) : de la fin de l'année scolaire à la rentrée suivante. Règles
// partagées par le crédit d'un paiement (reconcile.ts) et l'affichage (etat.ts).
import { addMonths } from 'date-fns'
import { MOIS_OFFERTS, MOIS_PAYANTS_PAR_AN, SEUIL_SUSPENSION_JOURS } from './plans'

export type PeriodePayee = { plan: string; debut: string; fin: string; mois_offerts: number }
// Années scolaires de l'établissement (Paramètres › Années), dates AAAA-MM-JJ.
export type AnneeCalendrier = { date_debut: string; date_fin: string }

const JOUR_MS = 24 * 60 * 60 * 1000
// Vacances offertes au plus : 3 mois (au-delà, le calendrier est probablement erroné).
const VACANCES_MAX_MOIS = 3

const jour = (iso: string) => new Date(iso + 'T00:00:00Z')

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

// Fin des vacances qui suivent une fin d'année scolaire : la rentrée suivante
// du calendrier, sinon deux mois après la fin de l'année (année suivante pas
// encore créée), bornée à trois mois.
function finVacances(finAnnee: Date, calendrier: AnneeCalendrier[]): Date {
  const rentree = calendrier.map((a) => jour(a.date_debut)).filter((d) => d > finAnnee).sort((a, b) => a.getTime() - b.getTime())[0]
  const plafond = addMonths(finAnnee, VACANCES_MAX_MOIS)
  const fin = rentree ?? addMonths(finAnnee, MOIS_OFFERTS)
  return fin > plafond ? plafond : fin
}

// Prochain mois payé : rang dans la suite (1, 2, …), période couverte et mois
// offerts. Si ce mois contient la fin d'une année scolaire et qu'au moins 10 mois
// d'affilée sont alors payés, l'accès est prolongé jusqu'à la rentrée suivante.
// Sans calendrier renseigné : 2 mois offerts au 10e mois.
export function prochainePeriode(periodes: PeriodePayee[], paiement: Date, calendrier: AnneeCalendrier[] = []) {
  const derniere = periodes.reduce<PeriodePayee | null>((m, p) => (!m || new Date(p.fin) > new Date(m.fin) ? p : m), null)
  const finPrecedente = derniere ? new Date(derniere.fin) : null
  const debut = debutPeriode(finPrecedente, paiement)
  const suite = finPrecedente !== null && debut.getTime() === finPrecedente.getTime()
  const rang = suite ? moisPayesDansLeCycle(periodes) + 1 : 1
  const finPayee = addMonths(debut, 1)

  let fin = finPayee
  if (calendrier.length > 0) {
    const finAnnee = calendrier.map((a) => jour(a.date_fin)).find((d) => d >= debut && d < finPayee)
    if (finAnnee && rang >= MOIS_PAYANTS_PAR_AN) {
      const vacances = finVacances(finAnnee, calendrier)
      if (vacances > fin) fin = vacances
    }
  } else if (rang >= MOIS_PAYANTS_PAR_AN) {
    fin = addMonths(finPayee, MOIS_OFFERTS)
  }
  const moisOfferts = Math.min(VACANCES_MAX_MOIS, Math.round((fin.getTime() - finPayee.getTime()) / (30 * JOUR_MS)))
  return { debut, fin, rang, moisOfferts: fin > finPayee ? Math.max(1, moisOfferts) : 0 }
}
