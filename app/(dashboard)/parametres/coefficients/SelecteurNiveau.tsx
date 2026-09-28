'use client'

import { useRouter } from 'next/navigation'
import { inputClass, labelClass } from '@/components/ui/styles'

type Niveau = { id: string; nom: string; a_series: boolean }
type Serie = { id: string; code: string; nom: string }

// Le choix est porté par l'URL (?niveau=&serie=) : la page serveur recharge la
// grille correspondante, et un lien peut pointer directement sur un niveau.
export default function SelecteurNiveau({
  niveaux,
  series,
  niveauId,
  serieId,
  libelles,
}: {
  niveaux: Niveau[]
  series: Serie[]
  niveauId: string
  serieId: string | null
  libelles: { niveau: string; serie: string; toutesSeries: string }
}) {
  const router = useRouter()
  const niveau = niveaux.find((n) => n.id === niveauId)

  const aller = (niveau: string, serie: string | null) => {
    const params = new URLSearchParams({ niveau })
    if (serie) params.set('serie', serie)
    router.push(`/parametres/coefficients?${params.toString()}`)
  }

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:max-w-xl">
      <div>
        <label htmlFor="coef-niveau" className={labelClass}>{libelles.niveau}</label>
        <select id="coef-niveau" value={niveauId} onChange={(e) => aller(e.target.value, null)} className={inputClass}>
          {niveaux.map((n) => (
            <option key={n.id} value={n.id}>{n.nom}</option>
          ))}
        </select>
      </div>
      {niveau?.a_series && series.length > 0 && (
        <div>
          <label htmlFor="coef-serie" className={labelClass}>{libelles.serie}</label>
          <select id="coef-serie" value={serieId ?? ''} onChange={(e) => aller(niveauId, e.target.value || null)} className={inputClass}>
            <option value="">{libelles.toutesSeries}</option>
            {series.map((s) => (
              <option key={s.id} value={s.id}>{s.code} — {s.nom}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}
