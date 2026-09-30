// Barres horizontales d'une comparaison entre établissements : une seule série
// (couleur primaire), valeur écrite au bout de chaque barre, infobulle au survol.
// Les mêmes données figurent dans le tableau des comparatifs.
export type LigneBarre = { cle: string; libelle: string; valeur: number | null; affichage: string; detail?: string }

export function BarresHorizontales({ titre, lignes, vide, meilleurBas = false }: { titre: string; lignes: LigneBarre[]; vide: string; meilleurBas?: boolean }) {
  const valeurs = lignes.map((l) => l.valeur).filter((v): v is number => v !== null)
  const max = Math.max(...valeurs, 0)
  const meilleur = valeurs.length > 1 ? (meilleurBas ? Math.min(...valeurs) : Math.max(...valeurs)) : null
  return (
    <figure className="rounded-2xl border border-surface-border bg-surface p-5 shadow-xs">
      <figcaption className="mb-4 text-sm font-semibold text-foreground">{titre}</figcaption>
      {valeurs.length === 0 ? (
        <p className="py-6 text-center text-sm text-foreground-muted">{vide}</p>
      ) : (
        <ul className="space-y-3">
          {lignes.map((l) => (
            <li key={l.cle} className="group grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3 text-sm" title={`${l.libelle} · ${l.affichage}${l.detail ? ` · ${l.detail}` : ''}`}>
              <span className="truncate text-foreground-muted group-hover:text-foreground">{l.libelle}</span>
              <span className="flex items-center gap-2">
                <span className="relative h-3 flex-1 rounded-e bg-background">
                  {l.valeur !== null && max > 0 && (
                    <span
                      className="absolute inset-y-0 start-0 rounded-e bg-primary transition-opacity group-hover:opacity-80"
                      style={{ width: `${Math.max(2, (l.valeur / max) * 100)}%` }}
                    />
                  )}
                </span>
                <span className={`w-20 shrink-0 text-end tabular-nums ${l.valeur !== null && l.valeur === meilleur ? 'font-semibold text-foreground' : 'text-foreground-muted'}`} dir="ltr">
                  {l.affichage}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  )
}

// Colonnes mensuelles (encaissements) : barres ancrées sur la ligne de base,
// montant affiché au survol et libellé du mois sous chaque colonne.
export function ColonnesMois({ titre, colonnes, format, vide }: { titre: string; colonnes: { cle: string; libelle: string; valeur: number; affichage: string }[]; format?: (v: number) => string; vide: string }) {
  const max = Math.max(...colonnes.map((c) => c.valeur), 0)
  const total = colonnes.reduce((s, c) => s + c.valeur, 0)
  return (
    <figure className="rounded-2xl border border-surface-border bg-surface p-5 shadow-xs">
      <figcaption className="mb-4 flex flex-wrap items-baseline justify-between gap-2 text-sm font-semibold text-foreground">
        {titre}
        {format && <span className="font-normal text-foreground-muted tabular-nums" dir="ltr">{format(total)}</span>}
      </figcaption>
      {max === 0 ? (
        <p className="py-10 text-center text-sm text-foreground-muted">{vide}</p>
      ) : (
        <div className="flex h-48 items-end gap-[2px] border-b border-surface-border sm:gap-1">
          {colonnes.map((c) => (
            <div key={c.cle} className="group relative flex h-full flex-1 flex-col justify-end" title={`${c.libelle} · ${c.affichage}`}>
              <span className="pointer-events-none absolute -top-1 start-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs text-background opacity-0 shadow transition-opacity group-hover:opacity-100 rtl:translate-x-1/2" dir="ltr">
                {c.affichage}
              </span>
              <span className="w-full rounded-t bg-primary transition-opacity group-hover:opacity-80" style={{ height: `${c.valeur > 0 ? Math.max(1.5, (c.valeur / max) * 100) : 0}%` }} />
            </div>
          ))}
        </div>
      )}
      {max > 0 && (
        <div className="mt-1.5 flex gap-[2px] sm:gap-1">
          {colonnes.map((c) => <span key={c.cle} className="flex-1 truncate text-center text-[0.65rem] text-foreground-muted">{c.libelle}</span>)}
        </div>
      )}
    </figure>
  )
}

export function Tuile({ libelle, valeur, detail, ton }: { libelle: string; valeur: string; detail?: string; ton?: 'bon' | 'alerte' }) {
  return (
    <div className="rounded-2xl border border-surface-border bg-surface p-5 shadow-xs">
      <p className="text-sm text-foreground-muted">{libelle}</p>
      <p className="mt-1 font-heading text-2xl font-semibold tabular-nums text-foreground" dir="ltr">{valeur}</p>
      {detail && <p className={`mt-1 text-xs ${ton === 'alerte' ? 'text-danger' : ton === 'bon' ? 'text-success' : 'text-foreground-muted'}`}>{detail}</p>}
    </div>
  )
}
