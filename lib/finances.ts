import type { SupabaseClient } from '@supabase/supabase-js'
import { un } from '@/lib/scolarite'

// Nombre d'échéances d'un service sur une année scolaire (9 mois de cours).
export const OCCURRENCES: Record<string, number> = { unique: 1, annuel: 1, trimestriel: 3, mensuel: 9 }
export const TYPES_SERVICE = ['tenue', 'transport', 'restauration', 'fournitures', 'activite', 'autre'] as const
export const PERIODICITES = ['unique', 'mensuel', 'trimestriel', 'annuel'] as const
export const MODES_PAIEMENT = ['especes', 'mobile_money', 'virement', 'cheque', 'autre'] as const

export type Situation = { du: number; paye: number; reste: number }

// Situation financière des élèves d'une année : frais de scolarité de leur
// niveau (et frais communs) + services souscrits, moins les paiements.
export async function situationsFinancieres(supabase: SupabaseClient, anneeId: string, eleveIds?: string[]) {
  let qInsc = supabase.from('inscriptions').select('eleve_id, classes(niveau_id)').eq('annee_id', anneeId)
  let qSous = supabase.from('souscriptions_services').select('eleve_id, services(tarif, periodicite)').eq('annee_id', anneeId)
  let qPaie = supabase.from('paiements_eleves').select('eleve_id, montant').eq('annee_id', anneeId)
  if (eleveIds) {
    qInsc = qInsc.in('eleve_id', eleveIds)
    qSous = qSous.in('eleve_id', eleveIds)
    qPaie = qPaie.in('eleve_id', eleveIds)
  }
  const [{ data: inscriptions }, { data: frais }, { data: souscriptions }, { data: paiements }] = await Promise.all([
    qInsc,
    supabase.from('frais_scolarite').select('niveau_id, montant').eq('annee_id', anneeId),
    qSous,
    qPaie,
  ])

  const situations = new Map<string, Situation>()
  for (const i of (inscriptions ?? []) as unknown as { eleve_id: string; classes: { niveau_id: string } | null }[]) {
    const niveau = un(i.classes)?.niveau_id
    const du = (frais ?? []).filter((f) => f.niveau_id === null || f.niveau_id === niveau).reduce((t, f) => t + Number(f.montant), 0)
    situations.set(i.eleve_id, { du, paye: 0, reste: 0 })
  }
  for (const s of (souscriptions ?? []) as unknown as { eleve_id: string; services: { tarif: number; periodicite: string } | null }[]) {
    const sv = un(s.services)
    const cur = situations.get(s.eleve_id)
    if (cur && sv) cur.du += Number(sv.tarif) * (OCCURRENCES[sv.periodicite] ?? 1)
  }
  for (const p of paiements ?? []) {
    const cur = situations.get(p.eleve_id)
    if (cur) cur.paye += Number(p.montant)
  }
  for (const s of situations.values()) s.reste = Math.max(0, s.du - s.paye)
  return situations
}
