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

// du / reste : sur toute l'année ; duADate / resteADate : seulement ce qui est
// déjà échu (frais passés à échéance, mensualités écoulées). C'est « à date »
// qui mesure un retard de paiement : en début d'année, l'année entière n'est
// pas encore due.
export type Situation = { du: number; paye: number; reste: number; duADate: number; resteADate: number }
export type Frais = { libelle: string; montant: number; periodicite: string; niveau_id: string | null; cycle: string | null; date_echeance?: string | null }

// Nombre de mois commencés entre deux dates (même mois = 1), borné à [0, max].
function moisEcoules(depuis: Date, jusqua: Date, max: number) {
  if (jusqua < depuis) return 0
  const n = (jusqua.getFullYear() - depuis.getFullYear()) * 12 + (jusqua.getMonth() - depuis.getMonth()) + (jusqua.getDate() >= depuis.getDate() ? 1 : 0)
  return Math.max(0, Math.min(max, n))
}

// Frais retenus pour un élève : à libellé égal, le plus précis l'emporte
// (niveau de classe > cycle > tous niveaux).
function fraisRetenus(frais: Frais[], niveauId: string | null | undefined, cycle: string | null | undefined) {
  const precision = (f: Frais) => (f.niveau_id ? (f.niveau_id === niveauId ? 3 : -1) : f.cycle ? (f.cycle === cycle ? 2 : -1) : 1)
  const retenus = new Map<string, { f: Frais; p: number }>()
  for (const f of frais) {
    const p = precision(f)
    if (p < 0) continue
    const cle = f.libelle.trim().toLowerCase()
    const cur = retenus.get(cle)
    if (!cur || p > cur.p) retenus.set(cle, { f, p })
  }
  return [...retenus.values()].map((r) => r.f)
}

// Frais dus par un élève sur l'année (une mensualité compte « mois » fois).
export function fraisDus(frais: Frais[], niveauId: string | null | undefined, cycle: string | null | undefined, mois: number) {
  return fraisRetenus(frais, niveauId, cycle).reduce((t, f) => t + Number(f.montant) * (f.periodicite === 'mensuel' ? mois : 1), 0)
}

// Part déjà échue à une date : un frais unique à son échéance (ou à la rentrée),
// une mensualité pour chaque mois commencé depuis sa première échéance.
export function fraisEchus(frais: Frais[], niveauId: string | null | undefined, cycle: string | null | undefined, mois: number, rentree: Date, aujourdhui: Date) {
  return fraisRetenus(frais, niveauId, cycle).reduce((t, f) => {
    const debut = f.date_echeance ? new Date(f.date_echeance + 'T00:00:00') : rentree
    const n = f.periodicite === 'mensuel' ? moisEcoules(debut, aujourdhui, mois) : debut <= aujourdhui ? 1 : 0
    return t + Number(f.montant) * n
  }, 0)
}

// Situation financière des élèves d'une année : frais de scolarité (communs,
// du cycle ou du niveau) + services souscrits, moins les paiements. Le nombre
// de mensualités est celui de l'établissement de l'année (vaut aussi pour la
// vue groupe, qui lit plusieurs établissements).
export async function situationsFinancieres(supabase: SupabaseClient, anneeId: string, eleveIds?: string[], aujourdhui = new Date()) {
  const [inscriptions, { data: frais }, souscriptions, paiements, { data: annee }] = await Promise.all([
    lireTout((de, a) => {
      const q = supabase.from('inscriptions').select('eleve_id, classes(niveau_id, niveaux(cycle))').eq('annee_id', anneeId)
      return (eleveIds ? q.in('eleve_id', eleveIds) : q).order('id').range(de, a)
    }),
    supabase.from('frais_scolarite').select('libelle, montant, periodicite, niveau_id, cycle, date_echeance').eq('annee_id', anneeId),
    lireTout((de, a) => {
      const q = supabase.from('souscriptions_services').select('eleve_id, services(tarif, periodicite)').eq('annee_id', anneeId)
      return (eleveIds ? q.in('eleve_id', eleveIds) : q).order('id').range(de, a)
    }),
    lireTout((de, a) => {
      const q = supabase.from('paiements_eleves').select('eleve_id, montant').eq('annee_id', anneeId)
      return (eleveIds ? q.in('eleve_id', eleveIds) : q).order('id').range(de, a)
    }),
    supabase.from('annees_scolaires').select('date_debut, etablissements(mois_scolarite)').eq('id', anneeId).maybeSingle(),
  ])
  const mois = Number(un(annee?.etablissements as unknown as { mois_scolarite: number } | null)?.mois_scolarite ?? 9)
  const rentree = new Date((annee?.date_debut ?? aujourdhui.toISOString().slice(0, 10)) + 'T00:00:00')
  // Services : échéances comptées depuis la rentrée (mensuel : chaque mois de
  // cours, trimestriel : tous les 3 mois, unique / annuel : à la rentrée).
  const occurrences = (periodicite: string) => (periodicite === 'mensuel' ? mois : OCCURRENCES[periodicite] ?? 1)
  const echues = (periodicite: string) => {
    const m = moisEcoules(rentree, aujourdhui, 12)
    if (periodicite === 'mensuel') return Math.min(mois, m)
    if (periodicite === 'trimestriel') return m === 0 ? 0 : Math.min(3, Math.floor((m - 1) / 3) + 1)
    return m > 0 ? 1 : 0
  }

  const situations = new Map<string, Situation>()
  type Insc = { eleve_id: string; classes: { niveau_id: string; niveaux: { cycle: string } | null } | null }
  for (const i of inscriptions as unknown as Insc[]) {
    const classe = un(i.classes)
    const cycle = un(classe?.niveaux)?.cycle
    situations.set(i.eleve_id, {
      du: fraisDus((frais ?? []) as Frais[], classe?.niveau_id, cycle, mois),
      duADate: fraisEchus((frais ?? []) as Frais[], classe?.niveau_id, cycle, mois, rentree, aujourdhui),
      paye: 0,
      reste: 0,
      resteADate: 0,
    })
  }
  for (const s of souscriptions as unknown as { eleve_id: string; services: { tarif: number; periodicite: string } | null }[]) {
    const sv = un(s.services)
    const cur = situations.get(s.eleve_id)
    if (!cur || !sv) continue
    cur.du += Number(sv.tarif) * occurrences(sv.periodicite)
    cur.duADate += Number(sv.tarif) * echues(sv.periodicite)
  }
  for (const p of paiements as { eleve_id: string; montant: number }[]) {
    const cur = situations.get(p.eleve_id)
    if (cur) cur.paye += Number(p.montant)
  }
  for (const s of situations.values()) {
    s.reste = Math.max(0, s.du - s.paye)
    s.resteADate = Math.max(0, s.duADate - s.paye)
  }
  return situations
}
