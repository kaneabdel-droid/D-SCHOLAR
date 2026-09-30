import type { SupabaseClient } from '@supabase/supabase-js'
import { un } from '@/lib/scolarite'
import { lireTout } from '@/lib/lireTout'

// Nombre d'échéances d'un service sur une année scolaire (9 mois de cours).
export const OCCURRENCES: Record<string, number> = { unique: 1, annuel: 1, trimestriel: 3, mensuel: 9 }
export const TYPES_SERVICE = ['tenue', 'transport', 'restauration', 'fournitures', 'activite', 'autre'] as const
export const PERIODICITES = ['unique', 'mensuel', 'trimestriel', 'annuel'] as const
export const MODES_PAIEMENT = ['especes', 'mobile_money', 'virement', 'cheque', 'autre'] as const

export const CYCLES = ['prescolaire', 'elementaire', 'moyen', 'secondaire'] as const
export const PERIODICITES_FRAIS = ['unique', 'mensuel'] as const

export type Situation = { du: number; paye: number; reste: number }
export type Frais = { libelle: string; montant: number; periodicite: string; niveau_id: string | null; cycle: string | null }

// Frais dus par un élève : à libellé égal, le plus précis l'emporte (niveau de
// classe > cycle > tous niveaux) ; une mensualité compte `mois` fois.
export function fraisDus(frais: Frais[], niveauId: string | null | undefined, cycle: string | null | undefined, mois: number) {
  const precision = (f: Frais) => (f.niveau_id ? (f.niveau_id === niveauId ? 3 : -1) : f.cycle ? (f.cycle === cycle ? 2 : -1) : 1)
  const retenus = new Map<string, { f: Frais; p: number }>()
  for (const f of frais) {
    const p = precision(f)
    if (p < 0) continue
    const cle = f.libelle.trim().toLowerCase()
    const cur = retenus.get(cle)
    if (!cur || p > cur.p) retenus.set(cle, { f, p })
  }
  return [...retenus.values()].reduce((t, { f }) => t + Number(f.montant) * (f.periodicite === 'mensuel' ? mois : 1), 0)
}

// Situation financière des élèves d'une année : frais de scolarité (communs,
// du cycle ou du niveau) + services souscrits, moins les paiements. Le nombre
// de mensualités est celui de l'établissement de l'année (vaut aussi pour la
// vue groupe, qui lit plusieurs établissements).
export async function situationsFinancieres(supabase: SupabaseClient, anneeId: string, eleveIds?: string[]) {
  const [inscriptions, { data: frais }, souscriptions, paiements, { data: annee }] = await Promise.all([
    lireTout((de, a) => {
      const q = supabase.from('inscriptions').select('eleve_id, classes(niveau_id, niveaux(cycle))').eq('annee_id', anneeId)
      return (eleveIds ? q.in('eleve_id', eleveIds) : q).order('id').range(de, a)
    }),
    supabase.from('frais_scolarite').select('libelle, montant, periodicite, niveau_id, cycle').eq('annee_id', anneeId),
    lireTout((de, a) => {
      const q = supabase.from('souscriptions_services').select('eleve_id, services(tarif, periodicite)').eq('annee_id', anneeId)
      return (eleveIds ? q.in('eleve_id', eleveIds) : q).order('id').range(de, a)
    }),
    lireTout((de, a) => {
      const q = supabase.from('paiements_eleves').select('eleve_id, montant').eq('annee_id', anneeId)
      return (eleveIds ? q.in('eleve_id', eleveIds) : q).order('id').range(de, a)
    }),
    supabase.from('annees_scolaires').select('etablissements(mois_scolarite)').eq('id', anneeId).maybeSingle(),
  ])
  const mois = Number(un(annee?.etablissements as unknown as { mois_scolarite: number } | null)?.mois_scolarite ?? 9)

  const situations = new Map<string, Situation>()
  type Insc = { eleve_id: string; classes: { niveau_id: string; niveaux: { cycle: string } | null } | null }
  for (const i of inscriptions as unknown as Insc[]) {
    const classe = un(i.classes)
    const du = fraisDus((frais ?? []) as Frais[], classe?.niveau_id, un(classe?.niveaux)?.cycle, mois)
    situations.set(i.eleve_id, { du, paye: 0, reste: 0 })
  }
  for (const s of souscriptions as unknown as { eleve_id: string; services: { tarif: number; periodicite: string } | null }[]) {
    const sv = un(s.services)
    const cur = situations.get(s.eleve_id)
    if (cur && sv) cur.du += Number(sv.tarif) * (OCCURRENCES[sv.periodicite] ?? 1)
  }
  for (const p of paiements as { eleve_id: string; montant: number }[]) {
    const cur = situations.get(p.eleve_id)
    if (cur) cur.paye += Number(p.montant)
  }
  for (const s of situations.values()) s.reste = Math.max(0, s.du - s.paye)
  return situations
}
