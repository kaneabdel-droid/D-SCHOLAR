// Paliers d'abonnement D-Scholar — seule source de vérité côté application.
// Le miroir SQL est public.cycles_du_palier() (02_rls_functions.sql) : à garder
// synchronisé si la répartition des cycles change.

export type Cycle = 'prescolaire' | 'elementaire' | 'moyen' | 'secondaire'
export type PalierCode = 'elementaire' | 'secondaire' | 'complet'

export const CYCLES: Cycle[] = ['prescolaire', 'elementaire', 'moyen', 'secondaire']

// Abonnement mensuel : prix d'un mois, égal au prix du produit Chariow du palier
// (CHARIOW_PRODUCT_Scholar_Elem / _MS / _FULL, ou /admin/config).
export const PALIERS: Record<PalierCode, { prixMensuelFcfa: number; cyclesAutorises: Cycle[] }> = {
  elementaire: { prixMensuelFcfa: 10_000, cyclesAutorises: ['prescolaire', 'elementaire'] },
  secondaire: { prixMensuelFcfa: 15_000, cyclesAutorises: ['moyen', 'secondaire'] },
  complet: { prixMensuelFcfa: 22_500, cyclesAutorises: ['prescolaire', 'elementaire', 'moyen', 'secondaire'] },
}

export const PALIER_CODES = Object.keys(PALIERS) as PalierCode[]

export function cycleAutorise(palier: PalierCode, cycle: Cycle): boolean {
  return PALIERS[palier]?.cyclesAutorises.includes(cycle) ?? false
}
