// Grille hebdomadaire d'un emploi du temps (classe ou enseignant). Mobile : un
// bloc par jour ; à partir de md : tableau jours × heures.

export type CreneauAffiche = {
  id: string
  jour: number
  debut: string // HH:MM
  fin: string
  titre: string
  detail: string
  couleur: string
}

export default function EmploiGrid({ creneaux, jours, vide }: { creneaux: CreneauAffiche[]; jours: string[]; vide: string }) {
  if (creneaux.length === 0) return <p className="px-5 py-10 text-center text-sm text-foreground-muted">{vide}</p>

  const horaires = [...new Set(creneaux.map((c) => `${c.debut}-${c.fin}`))].sort()
  const cellule = (jour: number, horaire: string) => creneaux.filter((c) => c.jour === jour && `${c.debut}-${c.fin}` === horaire)

  const carte = (c: CreneauAffiche) => (
    <div key={c.id} className="rounded-lg border-s-4 bg-background px-2.5 py-2 text-xs" style={{ borderColor: c.couleur }}>
      <p className="font-semibold text-foreground">{c.titre}</p>
      <p className="mt-0.5 text-foreground-muted">{c.detail}</p>
    </div>
  )

  return (
    <>
      <div className="space-y-4 p-4 md:hidden">
        {jours.map((nom, i) => {
          const duJour = creneaux.filter((c) => c.jour === i + 1).sort((a, b) => a.debut.localeCompare(b.debut))
          if (duJour.length === 0) return null
          return (
            <div key={nom}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">{nom}</p>
              <div className="space-y-2">
                {duJour.map((c) => (
                  <div key={c.id} className="flex gap-3">
                    <span className="w-14 shrink-0 pt-2 text-xs tabular-nums text-foreground-muted" dir="ltr">{c.debut}</span>
                    <div className="flex-1">{carte(c)}</div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full table-fixed border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-24 px-3 py-2" />
              {jours.map((j) => (
                <th key={j} className="px-2 py-2 text-start text-xs font-semibold uppercase tracking-wide text-foreground-muted">{j}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {horaires.map((h) => (
              <tr key={h} className="border-t border-surface-border align-top">
                <td className="px-3 py-2 text-xs tabular-nums text-foreground-muted" dir="ltr">{h.replace('-', ' – ')}</td>
                {jours.map((_, i) => (
                  <td key={i} className="px-1.5 py-1.5">
                    <div className="space-y-1.5">{cellule(i + 1, h).map(carte)}</div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
