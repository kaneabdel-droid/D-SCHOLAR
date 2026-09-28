import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import SelecteurAnnee from '@/components/SelecteurAnnee'
import { cardClass } from '@/components/ui/styles'
import { createClient } from '@/utils/supabase/server'
import { getCurrentUserContext } from '@/lib/auth/getCurrentUserContext'
import { anneesEtSelection, moyenneLisible, TEINTES_DECISION, un } from '@/lib/scolarite'
import { fmt, intlLocale } from '@/lib/i18n'
import { getDictionary, getLocale } from '@/dictionaries'

type Ligne = {
  id: string
  moyenne_annuelle: number | null
  rang: number | null
  decision: string
  note_repechage: number | null
  decision_finale: string | null
  orientation: string | null
  inscriptions: { classe_id: string; eleves: { id: string; prenom: string; nom: string } | null; classes: { nom: string; niveaux: { ordre: number } | null } | null } | null
}

export default async function PassagesPage({ searchParams }: { searchParams: Promise<{ annee?: string }> }) {
  const context = await getCurrentUserContext()
  const sp = await searchParams
  const supabase = await createClient()
  const locale = await getLocale()
  const loc = intlLocale(locale)
  const dict = await getDictionary(locale)
  const t = dict.passages
  const s = dict.scolarite

  const { annees, selection } = await anneesEtSelection(supabase, sp.annee)
  const [{ data }, { data: etab }] = await Promise.all([
    selection
      ? supabase
          .from('decisions')
          .select('id, moyenne_annuelle, rang, decision, note_repechage, decision_finale, orientation, inscriptions!inner(annee_id, classe_id, eleves(id, prenom, nom), classes(nom, niveaux(ordre)))')
          .eq('inscriptions.annee_id', selection.id)
      : Promise.resolve({ data: [] }),
    supabase.from('etablissements').select('moyenne_passage, moyenne_repechage').eq('id', context.etablissementId).single(),
  ])

  const decisions = ((data ?? []) as unknown as Ligne[]).map((d) => {
    const i = un(d.inscriptions)
    return { ...d, eleve: un(i?.eleves), classe: un(i?.classes), classeId: i?.classe_id ?? '' }
  })
  const parClasse = new Map<string, { nom: string; ordre: number; lignes: typeof decisions }>()
  for (const d of decisions) {
    const g = parClasse.get(d.classeId) ?? { nom: d.classe?.nom ?? '', ordre: un(d.classe?.niveaux)?.ordre ?? 0, lignes: [] }
    g.lignes.push(d)
    parClasse.set(d.classeId, g)
  }
  const groupes = [...parClasse.entries()].sort((a, b) => a[1].ordre - b[1].ordre)
  const badge = (code: string | null) =>
    code ? <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TEINTES_DECISION[code]}`}>{s.decisions[code as keyof typeof s.decisions]}</span> : <span className="text-foreground-muted">—</span>

  return (
    <div>
      <PageHeader
        title={t.title}
        subtitle={`${t.subtitle} ${fmt(t.seuils, { p: moyenneLisible(etab?.moyenne_passage, loc), r: moyenneLisible(etab?.moyenne_repechage, loc) })}`}
        actions={<SelecteurAnnee annees={annees} selection={selection?.id ?? null} libelles={{ annee: s.annee, active: s.active, cloturee: s.cloturee }} />}
      />
      {groupes.length === 0 ? (
        <p className={`${cardClass} px-5 py-10 text-center text-sm text-foreground-muted`}>{t.aucune}</p>
      ) : (
        <div className="space-y-6">
          {groupes.map(([classeId, g]) => {
            const compte = (code: string) => g.lignes.filter((l) => l.decision === code).length
            const lignes = [...g.lignes].sort((a, b) => (a.rang ?? 99) - (b.rang ?? 99))
            return (
              <section key={classeId} className={cardClass}>
                <div className="flex flex-wrap items-center gap-3 border-b border-surface-border px-5 py-4">
                  <Link href={`/classes/${classeId}`} className="font-heading text-lg font-semibold text-foreground hover:text-primary">{g.nom}</Link>
                  <div className="flex flex-wrap gap-2 text-xs font-semibold">
                    {(['admis', 'repechage', 'redouble'] as const).map((code) => (
                      <span key={code} className={`rounded-full px-2.5 py-1 ${TEINTES_DECISION[code]}`}>{s.decisions[code]} · {compte(code)}</span>
                    ))}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                      <tr>
                        <th className="px-4 py-3 text-center">{dict.classes.rangCol}</th>
                        <th className="px-4 py-3 text-start">{dict.eleves.eleve}</th>
                        <th className="px-4 py-3 text-center">{t.moyenne}</th>
                        <th className="px-4 py-3 text-start">{t.proposition}</th>
                        <th className="px-4 py-3 text-center">{t.repechage}</th>
                        <th className="px-4 py-3 text-start">{t.finale}</th>
                        <th className="px-4 py-3 text-start">{t.orientation}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-border">
                      {lignes.map((l) => (
                        <tr key={l.id} className={l.decision === 'repechage' ? 'bg-warning/5' : ''}>
                          <td className="px-4 py-2.5 text-center tabular-nums">{l.rang ?? '—'}</td>
                          <td className="whitespace-nowrap px-4 py-2.5">
                            {l.eleve ? <Link href={`/eleves/${l.eleve.id}?annee=${selection?.id}`} className="font-medium text-foreground hover:text-primary">{l.eleve.prenom} {l.eleve.nom}</Link> : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-center font-semibold tabular-nums">{moyenneLisible(l.moyenne_annuelle, loc)}</td>
                          <td className="px-4 py-2.5">{badge(l.decision)}</td>
                          <td className="px-4 py-2.5 text-center tabular-nums">{l.note_repechage !== null ? moyenneLisible(l.note_repechage, loc) : '—'}</td>
                          <td className="px-4 py-2.5">{badge(l.decision_finale)}</td>
                          <td className="px-4 py-2.5 text-foreground-muted">{l.orientation ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
