// Paliers d'abonnement D-Scholar — seule source de vérité côté application.
// Le miroir SQL est public.cycles_du_palier() (02_rls_functions.sql) : à garder
// synchronisé si la répartition des cycles change.

export type Cycle = 'prescolaire' | 'elementaire' | 'moyen' | 'secondaire'
export type PalierCode = 'elementaire' | 'secondaire' | 'complet'

export const CYCLES: Cycle[] = ['prescolaire', 'elementaire', 'moyen', 'secondaire']

export const PALIERS: Record<PalierCode, { prixAnnuelFcfa: number; cyclesAutorises: Cycle[] }> = {
  elementaire: { prixAnnuelFcfa: 120_000, cyclesAutorises: ['prescolaire', 'elementaire'] },
  secondaire: { prixAnnuelFcfa: 200_000, cyclesAutorises: ['moyen', 'secondaire'] },
  complet: { prixAnnuelFcfa: 300_000, cyclesAutorises: ['prescolaire', 'elementaire', 'moyen', 'secondaire'] },
}

export const PALIER_CODES = Object.keys(PALIERS) as PalierCode[]

export function cycleAutorise(palier: PalierCode, cycle: Cycle): boolean {
  return PALIERS[palier]?.cyclesAutorises.includes(cycle) ?? false
}
