// Mises en forme communes aux écrans de la vue groupe.
export function formats(loc: string, fcfa: string) {
  const nombre = (v: number) => v.toLocaleString(loc)
  return {
    nombre,
    montant: (v: number) => `${nombre(Math.round(v))} ${fcfa}`,
    // Montants compacts pour les graphiques (ex. 12,4 M).
    compact: (v: number) => new Intl.NumberFormat(loc, { notation: 'compact', maximumFractionDigits: 1 }).format(v),
    taux: (v: number | null) => (v === null ? '—' : `${v.toLocaleString(loc, { maximumFractionDigits: 1 })} %`),
    moyenne: (v: number | null) => (v === null ? '—' : v.toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 })),
    mois: (ym: string) => new Date(ym + '-01T00:00:00').toLocaleDateString(loc, { month: 'short' }),
    moisLong: (ym: string) => new Date(ym + '-01T00:00:00').toLocaleDateString(loc, { month: 'long', year: 'numeric' }),
  }
}
