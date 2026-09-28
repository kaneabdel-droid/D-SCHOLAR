import { cardClass } from '@/components/ui/styles'
import { createClient } from '@/utils/supabase/server'
import { getDictionary, getLocale } from '@/dictionaries'
import CoefficientsGrid from './CoefficientsGrid'
import SelecteurNiveau from './SelecteurNiveau'

export default async function CoefficientsPage({ searchParams }: { searchParams: Promise<{ niveau?: string; serie?: string }> }) {
  const params = await searchParams
  const supabase = await createClient()
  const dict = await getDictionary(await getLocale())
  const t = dict.coefficients

  const [{ data: niveaux }, { data: series }, { data: matieres }] = await Promise.all([
    supabase.from('niveaux').select('id, nom, a_series').eq('actif', true).order('ordre'),
    supabase.from('series').select('id, code, nom').eq('actif', true).order('code'),
    supabase.from('matieres').select('id, nom, code, couleur').eq('actif', true).order('nom'),
  ])

  if (!niveaux?.length || !matieres?.length) {
    return (
      <section className={`${cardClass} px-6 py-12 text-center text-sm text-foreground-muted`}>
        {!niveaux?.length ? t.noNiveaux : t.noMatieres}
      </section>
    )
  }

  const niveau = niveaux.find((n) => n.id === params.niveau) ?? niveaux[0]
  const serieId = niveau.a_series && series?.some((s) => s.id === params.serie) ? params.serie! : null

  let requete = supabase.from('coefficients').select('matiere_id, coefficient, volume_horaire').eq('niveau_id', niveau.id)
  requete = serieId ? requete.eq('serie_id', serieId) : requete.is('serie_id', null)
  const { data: coefficients } = await requete

  return (
    <section className={cardClass}>
      <div className="border-b border-surface-border px-5 py-4">
        <h2 className="font-heading text-base font-semibold text-foreground">{t.title}</h2>
        <p className="mt-0.5 text-sm text-foreground-muted">{t.desc}</p>
        <SelecteurNiveau
          niveaux={niveaux}
          series={series ?? []}
          niveauId={niveau.id}
          serieId={serieId}
          libelles={{ niveau: t.niveau, serie: t.serie, toutesSeries: t.toutesSeries }}
        />
      </div>
      <CoefficientsGrid
        key={`${niveau.id}-${serieId ?? 'tous'}`}
        niveauId={niveau.id}
        serieId={serieId}
        matieres={matieres}
        existants={(coefficients ?? []).map((c) => ({ matiere_id: c.matiere_id, coefficient: Number(c.coefficient), volume_horaire: c.volume_horaire === null ? null : Number(c.volume_horaire) }))}
        dict={dict}
      />
    </section>
  )
}
