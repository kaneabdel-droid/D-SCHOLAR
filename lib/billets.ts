// Billets délivrés par la surveillance (table billets, 09_billets_cartes.sql).
export const TYPES_BILLET = ['entree', 'sortie', 'visite_medicale', 'retard'] as const
export type TypeBillet = (typeof TYPES_BILLET)[number]

export const TEINTES_BILLET: Record<TypeBillet, string> = {
  entree: 'bg-success/10 text-success',
  sortie: 'bg-primary-soft text-primary',
  visite_medicale: 'bg-danger/10 text-danger',
  retard: 'bg-warning/10 text-warning',
}
