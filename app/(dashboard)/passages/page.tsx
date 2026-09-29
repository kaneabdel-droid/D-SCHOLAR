import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import SelecteurAnnee from '@/components/SelecteurAnnee'
import { btnSecondary, cardClass } from '@/components/ui/styles'
import { createClient } from '@/utils/supabase/server'
import { getCurrentUserContext } from '@/lib/auth/getCurrentUserContext'
import { peutEcrire } from '@/lib/roles'
import { anneesEtSelection, moyenneLisible, TEINTES_DECISION, un } from '@/lib/scolarite'
import { fmt, intlLocale } from '@/lib/i18n'
import { getDictionary, getLocale } from '@/dictionaries'
import { CalculerDecisions, DecisionEditeur } from './PassagesClient'

type Ligne = {
  id: string
  moyenne_annuelle: number | null
  rang: number | null
  decision: string
  note_repechage: number | null
  decision_finale: string | null
  orientation: string | null
  inscriptions: { classe_id: string; eleves: { id: string; prenom: string; nom: string } | null } | null
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
  const gestion = peutEcrire(context.role, 'decisions')

  const { annees, selection } = await anneesEtSelection(supabase, sp.annee)
  const [{ data }, { data: etab }, { data: classes }] = await Promise.all([
    selection
      ? supabase
          .from('decisions')
          .select('id, moyenne_annuelle, rang, decision, note_repechage, decision_finale, orientation, inscriptions!inner(annee_id, classe_id, eleves(id, prenom, nom))')
          .eq('inscriptions.annee_id', selection.id)
      : Promise.resolve({ data: [] }),
    supabase.from('etablissements').select('moyenne_passage, moyenne_repechage').eq('id', context.etablissementId).single(),
    selection ? supabase.from('classes').select('id, nom, niveaux(ordre)').eq('annee_id', selection.id) : Promise.resolve({ data: [] }),
  ])

  const decisions = ((data ?? []) as unknown as Ligne[]).map((d) => {
    const i = un(d.inscriptions)
    return { ...d, eleve: un(i?.eleves), classeId: i?.classe_id ?? '' }
  })
  const groupes = ((classes ?? []) as unknown as { id: string; nom: string; niveaux: { ordre: number } | null }[])
    .map((c) => ({ id: c.id, nom: c.nom, ordre: un(c.niveaux)?.ordre ?? 0, lignes: decisions.filter((d) => d.classeId === c.id).sort((a, b) => (a.rang ?? 99) - (b.rang ?? 99)) }))
    .sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom))
  const badge = (code: string | null) =>
    code ? <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TEINTES_DECISION[code]}`}>{s.decisions[code as keyof typeof s.decisions]}</span> : <span className="text-foreground-muted">—</span>

  return (
    <div>
      <PageHeader
        title={t.title}
        subtitle={`${t.subtitle} ${fmt(t.seuils, { p: moyenneLisible(etab?.moyenne_passage, loc), r: moyenneLisible(etab?.moyenne_repechage, loc) })}`}
        actions={
          <>
            <SelecteurAnnee annees={annees} selection={selection?.id ?? null} libelles={{ annee: s.annee, active: s.active, cloturee: s.cloturee }} />
            {selection && peutEcrire(context.role, 'eleves') && (
              <Link href={`/passages/rentree?source=${selection.id}`} className={btnSecondary}>
                {t.rentree} <ArrowRight className="h-4 w-4 rtl:-scale-x-100" />
              </Link>
            )}
          </>
        }
      />
      {groupes.length === 0 ? (
        <p className={`${cardClass} px-5 py-10 text-center text-sm text-foreground-muted`}>{t.aucune}</p>
      ) : (
        <div className="space-y-6">
          {groupes.map((g) => {
            const compte = (code: string) => g.lignes.filter((l) => l.decision === code).length
            return (
              <section key={g.id} className={cardClass}>
                <div className="flex flex-wrap items-center gap-3 border-b border-surface-border px-5 py-4">
                  <Link href={`/classes/${g.id}`} className="font-heading text-lg font-semibold text-foreground hover:text-primary">{g.nom}</Link>
                  <div className="flex flex-wrap gap-2 text-xs font-semibold">
                    {(['admis', 'repechage', 'redouble'] as const).map((code) => (
                      <span key={code} className={`rounded-full px-2.5 py-1 ${TEINTES_DECISION[code]}`}>{s.decisions[code]} · {compte(code)}</span>
                    ))}
                  </div>
                  {gestion && <div className="ms-auto"><CalculerDecisions classeId={g.id} dict={dict} /></div>}
                </div>
                {g.lignes.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-foreground-muted">{t.aucuneClasse}</p>
                ) : (
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
                          {gestion && <th className="px-4 py-3"><span className="sr-only">{dict.common.actions}</span></th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-border">
                        {g.lignes.map((l) => (
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
                            {gestion && (
                              <td className="px-4 py-2.5">
                                <DecisionEditeur decision={l} eleve={l.eleve ? `${l.eleve.prenom} ${l.eleve.nom}` : ''} dict={dict} />
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
